// localStorage-backed, mirrors the async storage API shape (get/set return
// Promises) so this can be swapped for IndexedDB or a remote API later
// without touching any of the callers.

import { uid, DAILY_BLUEPRINT_SCHEDULE } from './state.js';
import { normalizeStandup } from './standupShape.js';
import { DEFAULT_DEFECT_VIEWS, DEFAULT_STORY_VIEWS, normalizeOooRanges, normalizeTestCounts } from './opsHelpers.js';

const storage = {
  get(key){
    try{
      const v = localStorage.getItem(key);
      return Promise.resolve(v !== null ? {value:v} : null);
    }catch(e){ return Promise.resolve(null); }
  },
  set(key, value){
    try{
      localStorage.setItem(key, value);
      return Promise.resolve({value});
    }catch(e){ console.error('Storage error', e); return Promise.resolve(null); }
  }
};

// Older saves stored a boolean `completed` instead of a `status` string —
// map it forward so existing boards don't lose their history.
function migrateTask(t){
  const migrated = { source:'manual', comment:'', assignees:[], assignedGroups:[], ...t };
  if(!migrated.status){
    migrated.status = migrated.completed ? 'complete' : 'pending';
  }
  delete migrated.completed;
  return migrated;
}

export async function loadTasks(dateStr){
  try{
    const res = await storage.get(`tasks:${dateStr}`);
    if(res && res.value){
      const parsed = JSON.parse(res.value);
      if(!Array.isArray(parsed)) return [];
      return parsed.map(migrateTask);
    }
    return [];
  }catch(e){ return []; }
}

export async function saveTasks(dateStr, tasks){ await storage.set(`tasks:${dateStr}`, JSON.stringify(tasks)); }

// Legacy shape, kept only so loadSettings can migrate an old single `ado`
// connection forward — new code should never read `settings.ado` directly.
const DEFAULT_ADO_CONNECTION = {org:'', project:'', pat:'', workItemTypes:{userStory:'User Story', defect:'Bug', task:'Task'}};
const DEFAULT_AI_ASSIST = {provider:'openai', endpoint:'', apiKey:'', model:'gpt-4o-mini'};
const DEFAULT_SETTINGS = {
  managerEmail:'', yourName:'', carryForward:true,
  selectedReleaseId: null,
  sidebarCollapsed: false,
  lastBackupAt: null,
  lastDefectViewId: '',
  lastStoryViewId: '',
  savedViews: {defects: DEFAULT_DEFECT_VIEWS, stories: DEFAULT_STORY_VIEWS},
  aiAssist: {...DEFAULT_AI_ASSIST}
};

// Shared by loadSettings and backup import so an old single-`ado` blob
// (and connections missing workItemTypes) always become the current shape.
export function normalizeSettings(saved){
  const src = saved && typeof saved === 'object' ? saved : {};
  const merged = {...DEFAULT_SETTINGS, ...src};
  if(!Array.isArray(merged.adoConnections)){
    const legacy = {...DEFAULT_ADO_CONNECTION, ...(src.ado || {})};
    merged.adoConnections = (legacy.org || legacy.project || legacy.pat)
      ? [{id: uid(), name: 'Default', ...legacy}]
      : [];
  }
  merged.adoConnections = merged.adoConnections.map(c => ({
    ...DEFAULT_ADO_CONNECTION,
    ...c,
    workItemTypes: {...DEFAULT_ADO_CONNECTION.workItemTypes, ...((c && c.workItemTypes) || {})}
  }));
  const aiSrc = (src.aiAssist && typeof src.aiAssist === 'object') ? src.aiAssist : {};
  merged.aiAssist = {...DEFAULT_AI_ASSIST, ...aiSrc};
  if(merged.selectedReleaseId === undefined || merged.selectedReleaseId === null){
    merged.selectedReleaseId = null; // unset — init will pick first release
  }else{
    merged.selectedReleaseId = String(merged.selectedReleaseId);
  }
  merged.sidebarCollapsed = !!merged.sidebarCollapsed;
  merged.lastBackupAt = merged.lastBackupAt ? String(merged.lastBackupAt) : null;
  merged.lastDefectViewId = merged.lastDefectViewId ? String(merged.lastDefectViewId) : '';
  merged.lastStoryViewId = merged.lastStoryViewId ? String(merged.lastStoryViewId) : '';
  const savedSrc = (src.savedViews && typeof src.savedViews === 'object') ? src.savedViews : {};
  const mergeViews = (fallback, incoming) => {
    const list = Array.isArray(incoming) ? incoming : fallback;
    const cleaned = list.filter(v => v && v.id && v.name).map(v => ({id: String(v.id), name: String(v.name)}));
    return cleaned.length ? cleaned : fallback.slice();
  };
  merged.savedViews = {
    defects: mergeViews(DEFAULT_DEFECT_VIEWS, savedSrc.defects),
    stories: mergeViews(DEFAULT_STORY_VIEWS, savedSrc.stories)
  };
  delete merged.ado;
  return merged;
}

export async function loadSettings(){
  try{
    const res = await storage.get('settings');
    if(res && res.value) return normalizeSettings(JSON.parse(res.value));
  }catch(e){}
  return {...DEFAULT_SETTINGS, adoConnections: []};
}

export async function saveSettings(settings){ await storage.set('settings', JSON.stringify(settings)); }

export function migrateMember(m){
  const src = m && typeof m === 'object' ? m : {};
  return {
    ...src,
    ooo: normalizeOooRanges(src.ooo)
  };
}

export async function loadTeam(){
  try{
    const res = await storage.get('team');
    if(res && res.value){
      const parsed = JSON.parse(res.value);
      return Array.isArray(parsed) ? parsed.map(migrateMember) : [];
    }
  }catch(e){}
  return [];
}

export async function saveTeam(team){ await storage.set('team', JSON.stringify((team || []).map(migrateMember))); }

function migrateGroup(g){
  const src = g && typeof g === 'object' ? g : {};
  return {
    ...src,
    purpose: String(src.purpose || ''),
    memberIds: Array.isArray(src.memberIds) ? src.memberIds : []
  };
}

export async function loadGroups(){
  try{
    const res = await storage.get('groups');
    if(res && res.value){
      const parsed = JSON.parse(res.value);
      return Array.isArray(parsed) ? parsed.map(migrateGroup) : [];
    }
  }catch(e){}
  return [];
}

export async function saveGroups(groups){ await storage.set('groups', JSON.stringify((groups || []).map(migrateGroup))); }

export async function loadReleases(){
  try{
    const res = await storage.get('releases');
    if(res && res.value) return JSON.parse(res.value);
  }catch(e){}
  return [];
}

export async function saveReleases(releases){ await storage.set('releases', JSON.stringify(releases)); }

// User Stories span multiple days — progressNotes are keyed by date;
// ongoingNote is a durable cross-day summary. groupIds let several people
// own the story via Groups (in addition to a primary assigneeId).
export function migrateUserStory(us){
  const src = us && typeof us === 'object' ? us : {};
  const progressNotes = (src.progressNotes && typeof src.progressNotes === 'object' && !Array.isArray(src.progressNotes))
    ? {...src.progressNotes} : {};
  const testCountsSrc = (src.testCounts && typeof src.testCounts === 'object' && !Array.isArray(src.testCounts))
    ? src.testCounts : {};
  const testCounts = {};
  Object.keys(testCountsSrc).forEach(dateStr => {
    if(/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) testCounts[dateStr] = normalizeTestCounts(testCountsSrc[dateStr]);
  });
  return {
    defectIds: [], assigneeId: null, groupIds: [], ongoingNote: '',
    ...src,
    groupIds: Array.isArray(src.groupIds) ? src.groupIds.filter(Boolean) : [],
    coAssigneeIds: Array.isArray(src.coAssigneeIds) ? src.coAssigneeIds.filter(Boolean) : [],
    progressNotes,
    testCounts,
    ongoingNote: String(src.ongoingNote || '')
  };
}

export async function loadUserStories(){
  try{
    const res = await storage.get('userStories');
    if(res && res.value){
      const parsed = JSON.parse(res.value);
      return Array.isArray(parsed) ? parsed.map(migrateUserStory) : [];
    }
  }catch(e){}
  return [];
}

export async function saveUserStories(userStories){
  await storage.set('userStories', JSON.stringify((userStories || []).map(migrateUserStory)));
}

// Defects are day-scoped activity for testers — dayActivity[dateStr] holds
// a short note + who worked it that day.
export function migrateDefect(d){
  const src = d && typeof d === 'object' ? d : {};
  const dayActivity = (src.dayActivity && typeof src.dayActivity === 'object' && !Array.isArray(src.dayActivity))
    ? {...src.dayActivity} : {};
  return {
    tags: [], assigneeId: null, userStoryId: null,
    ...src,
    resolvedDate: src.resolvedDate || src.closedDate || null,
    closedDate: src.closedDate || src.resolvedDate || null,
    dayActivity
  };
}

export async function loadDefects(){
  try{
    const res = await storage.get('defects');
    if(res && res.value){
      const parsed = JSON.parse(res.value);
      return Array.isArray(parsed) ? parsed.map(migrateDefect) : [];
    }
  }catch(e){}
  return [];
}

export async function saveDefects(defects){
  await storage.set('defects', JSON.stringify((defects || []).map(migrateDefect)));
}

export async function loadStandup(dateStr){
  try{
    const res = await storage.get(`standup:${dateStr}`);
    if(res && res.value) return normalizeStandup(JSON.parse(res.value));
  }catch(e){}
  return normalizeStandup({});
}

export async function saveStandup(dateStr, standup){ await storage.set(`standup:${dateStr}`, JSON.stringify(normalizeStandup(standup))); }

// Daily QA Status email draft — keyed by board date so testers can refine
// counts and notes across the day and resend.
export function normalizeQaStatus(saved){
  const src = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  return {
    reporterName: String(src.reporterName || ''),
    dateStr: String(src.dateStr || ''),
    userStoryId: String(src.userStoryId || ''),
    executed: src.executed === '' || src.executed === null || src.executed === undefined ? '' : src.executed,
    planned: src.planned === '' || src.planned === null || src.planned === undefined ? '' : src.planned,
    pass: src.pass === '' || src.pass === null || src.pass === undefined ? '' : src.pass,
    fail: src.fail === '' || src.fail === null || src.fail === undefined ? '' : src.fail,
    blocked: src.blocked === '' || src.blocked === null || src.blocked === undefined ? '' : src.blocked,
    status: ['onTrack', 'atRisk', 'blocked'].includes(src.status) ? src.status : 'onTrack',
    highlights: String(src.highlights || ''),
    lowlights: String(src.lowlights || ''),
    planTomorrow: String(src.planTomorrow || ''),
    helpNeeded: String(src.helpNeeded || '')
  };
}

export async function loadQaStatus(dateStr){
  try{
    const res = await storage.get(`qaStatus:${dateStr}`);
    if(res && res.value) return normalizeQaStatus(JSON.parse(res.value));
  }catch(e){}
  return null;
}

export async function saveQaStatus(dateStr, draft){
  await storage.set(`qaStatus:${dateStr}`, JSON.stringify(normalizeQaStatus(draft)));
}

// Seeded from the built-in DAILY_BLUEPRINT_SCHEDULE the first time (so
// existing behavior doesn't change out of the box), then fully user-owned
// from there — editing it never touches the built-in constant.
export async function loadBlueprintSchedule(){
  try{
    const res = await storage.get('blueprintSchedule');
    if(res && res.value) return JSON.parse(res.value);
  }catch(e){}
  return DAILY_BLUEPRINT_SCHEDULE.map(item => ({id: uid(), ...item}));
}

export async function saveBlueprintSchedule(schedule){ await storage.set('blueprintSchedule', JSON.stringify(schedule)); }
