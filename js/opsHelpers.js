// Cross-cutting delivery ops: release scoping, tester load, saved views,
// OOO ranges, test-count logs, defect inflow/outflow. No DOM here.

import { defectReleaseId, userStoryReleaseId, isResolvedState, findMemberByIdentity, toDateStr, fromDateStr, shiftDate } from './state.js';
import { normalizeStandup, STANDUP_META_KEY } from './standupShape.js';

export const DEFAULT_DEFECT_VIEWS = [
  {id: 'my-defects', name: 'My defects'},
  {id: 'critical-open', name: 'Critical open'},
  {id: 'in-standup', name: 'In standup'},
  {id: 'unassigned', name: 'Unassigned'}
];

export const DEFAULT_STORY_VIEWS = [
  {id: 'my-stories', name: 'My stories'},
  {id: 'in-standup', name: 'In standup'},
  {id: 'no-progress', name: 'No progress today'},
  {id: 'unassigned', name: 'Unassigned'}
];

export function blankTestCounts(){
  return {planned: '', executed: '', pass: '', fail: '', blocked: ''};
}

export function normalizeTestCounts(src){
  const s = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
  const pick = (k) => {
    if(s[k] === '' || s[k] === null || s[k] === undefined) return '';
    const n = Number(s[k]);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : '';
  };
  return {
    planned: pick('planned'),
    executed: pick('executed'),
    pass: pick('pass'),
    fail: pick('fail'),
    blocked: pick('blocked')
  };
}

export function testCountsFor(us, dateStr){
  const map = us && us.testCounts && typeof us.testCounts === 'object' ? us.testCounts : {};
  return normalizeTestCounts(map[dateStr]);
}

export function testCountsAreEmpty(c){
  if(!c) return true;
  return ['planned','executed','pass','fail','blocked'].every(k => c[k] === '' || c[k] === null || c[k] === undefined);
}

export function normalizeOooRanges(list){
  if(!Array.isArray(list)) return [];
  return list
    .filter(r => r && typeof r === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(r.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(r.to || ''))
    .map(r => {
      const from = r.from <= r.to ? r.from : r.to;
      const to = r.from <= r.to ? r.to : r.from;
      return {from, to};
    });
}

export function isOooOnDate(member, dateStr){
  if(!member || !dateStr) return false;
  return normalizeOooRanges(member.ooo).some(r => dateStr >= r.from && dateStr <= r.to);
}

export function dateIsoDay(value){
  if(!value) return '';
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if(m) return m[1];
  const d = new Date(s);
  if(!Number.isFinite(d.getTime())) return '';
  return toDateStr(d);
}

export function defectResolvedDay(d){
  if(!d) return '';
  return dateIsoDay(d.resolvedDate || d.closedDate || '');
}

export function scopedRelease(state){
  return (state.releases || []).find(r => r.id === state.selectedReleaseId) || null;
}

export function scopedUserStories(state){
  const selected = scopedRelease(state);
  if(!selected) return (state.userStories || []).slice();
  return state.userStories.filter(us => userStoryReleaseId(us, state.releases) === selected.id);
}

export function scopedDefects(state){
  const selected = scopedRelease(state);
  const usById = new Map((state.userStories || []).map(us => [us.id, us]));
  if(!selected) return (state.defects || []).slice();
  return state.defects.filter(d => defectReleaseId(d, state.releases, usById) === selected.id);
}

export function discussionInRelease(state){
  const meta = normalizeStandup(state.standup)[STANDUP_META_KEY];
  const selected = scopedRelease(state);
  if(!selected) return meta.discussion || [];
  const storyIds = new Set(scopedUserStories(state).map(us => us.id));
  const defectIds = new Set(scopedDefects(state).map(d => d.id));
  return (meta.discussion || []).filter(d =>
    (d.kind === 'userStory' && storyIds.has(d.itemId)) ||
    (d.kind === 'defect' && defectIds.has(d.itemId))
  );
}

export function storiesMissingTodayNote(state){
  const today = state.dateStr;
  return scopedUserStories(state).filter(us => {
    const todayNote = (us.progressNotes && us.progressNotes[today] || '').trim();
    return !todayNote;
  });
}

export function selfMember(state){
  const name = (state.settings && state.settings.yourName) || '';
  const email = (state.settings && state.settings.managerEmail) || '';
  return findMemberByIdentity(state.team, name, '') || findMemberByIdentity(state.team, name, email) || null;
}

function defectOpen(d){
  return !isResolvedState(d.adoState);
}

export function defectMatchesSavedView(state, d, viewId){
  if(!viewId) return true;
  const me = selfMember(state);
  const queued = discussionInRelease(state).some(x => x.kind === 'defect' && x.itemId === d.id)
    || normalizeStandup(state.standup)[STANDUP_META_KEY].discussion.some(x => x.kind === 'defect' && x.itemId === d.id);
  if(viewId === 'my-defects'){
    if(!me) return false;
    const testers = (d.dayActivity && d.dayActivity[state.dateStr] && d.dayActivity[state.dateStr].testerIds) || [];
    return d.assigneeId === me.id || testers.includes(me.id)
      || findMemberByIdentity(state.team, d.createdByName, d.createdByEmail)?.id === me.id;
  }
  if(viewId === 'critical-open') return defectOpen(d) && d.severity === 'critical';
  if(viewId === 'in-standup') return queued;
  if(viewId === 'unassigned') return defectOpen(d) && !d.assigneeId && !(d.assigneeEmail || '').trim();
  return true;
}

export function storyMatchesSavedView(state, us, viewId){
  if(!viewId) return true;
  const me = selfMember(state);
  const queued = normalizeStandup(state.standup)[STANDUP_META_KEY].discussion
    .some(x => x.kind === 'userStory' && x.itemId === us.id);
  if(viewId === 'my-stories'){
    if(!me) return false;
    const co = us.coAssigneeIds || [];
    const inGroup = (us.groupIds || []).some(gid => {
      const g = state.groups.find(x => x.id === gid);
      return g && Array.isArray(g.memberIds) && g.memberIds.includes(me.id);
    });
    return us.assigneeId === me.id || co.includes(me.id) || inGroup;
  }
  if(viewId === 'in-standup') return queued;
  if(viewId === 'no-progress') return !(us.progressNotes && (us.progressNotes[state.dateStr] || '').trim());
  if(viewId === 'unassigned') return !us.assigneeId && !(us.coAssigneeIds || []).length;
  return true;
}

export function defectFlowStats(defects, nowMs = Date.now()){
  const windows = [7, 14];
  const stats = {};
  let resolvedUnknown = 0;
  defects.forEach(d => {
    if(!defectResolvedDay(d) && isResolvedState(d.adoState)) resolvedUnknown++;
  });
  windows.forEach(days => {
    const since = nowMs - days * 86400000;
    let created = 0;
    let resolvedDated = 0;
    defects.forEach(d => {
      const createdMs = d.createdDate ? new Date(d.createdDate).getTime() : NaN;
      if(Number.isFinite(createdMs) && createdMs >= since && createdMs <= nowMs) created++;
      const resolvedDay = defectResolvedDay(d);
      if(resolvedDay){
        const rms = fromDateStr(resolvedDay).getTime();
        if(Number.isFinite(rms) && rms >= since && rms <= nowMs) resolvedDated++;
      }
    });
    stats[days] = {
      created,
      resolved: resolvedDated,
      resolvedUnknown,
      net: resolvedDated - created
    };
  });
  return stats;
}

export function testerLoadRows(state){
  const today = state.dateStr;
  const defects = scopedDefects(state);
  const stories = scopedUserStories(state);
  const discuss = normalizeStandup(state.standup)[STANDUP_META_KEY].discussion || [];
  const open = defects.filter(defectOpen);

  return (state.team || []).map(m => {
    const openOwned = open.filter(d => {
      const created = findMemberByIdentity(state.team, d.createdByName, d.createdByEmail);
      return d.assigneeId === m.id || (created && created.id === m.id);
    }).length;
    const todayActivity = defects.filter(d => {
      const day = d.dayActivity && d.dayActivity[today];
      if(!day) return false;
      const testers = day.testerIds || [];
      const noted = !!(day.note && String(day.note).trim());
      return testers.includes(m.id) && (noted || testers.length);
    }).length;
    const storiesDiscuss = discuss.filter(d => {
      if(d.kind !== 'userStory') return false;
      if(!(d.discussantIds || []).includes(m.id)) return false;
      return stories.some(us => us.id === d.itemId);
    }).length;
    return {
      id: m.id,
      name: m.name,
      openDefects: openOwned,
      todayActivity,
      storiesDiscuss
    };
  }).filter(r => r.openDefects || r.todayActivity || r.storiesDiscuss)
    .sort((a, b) => (b.openDefects + b.todayActivity + b.storiesDiscuss) - (a.openDefects + a.todayActivity + a.storiesDiscuss)
      || a.name.localeCompare(b.name));
}

export function backupIsStale(lastBackupAt, days = 4, now = Date.now()){
  if(!lastBackupAt) return true;
  const t = new Date(lastBackupAt).getTime();
  if(!Number.isFinite(t)) return true;
  return (now - t) > days * 86400000;
}

export function shouldRemindBackup(state, days = 4){
  const hasData = !!(
    (state.team && state.team.length) ||
    (state.tasks && state.tasks.length) ||
    (state.userStories && state.userStories.length) ||
    (state.defects && state.defects.length)
  );
  if(!hasData) return false;
  return backupIsStale(state.settings && state.settings.lastBackupAt, days);
}

export function daysUntil(fromStr, toStr){
  try{
    const a = fromDateStr(fromStr).getTime();
    const b = fromDateStr(toStr).getTime();
    return Math.round((b - a) / 86400000);
  }catch(e){
    return 0;
  }
}

export function enumerateDays(fromStr, toStr){
  const out = [];
  if(!fromStr || !toStr) return out;
  let cur = fromStr <= toStr ? fromStr : toStr;
  const end = fromStr <= toStr ? toStr : fromStr;
  let guard = 0;
  while(cur <= end && guard < 400){
    out.push(cur);
    cur = shiftDate(cur, 1);
    guard++;
  }
  return out;
}
