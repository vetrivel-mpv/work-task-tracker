// All app data lives in localStorage, scoped to this one browser+origin —
// there's no server and no sync. Export/import gives a way to move data
// between machines or recover after clearing browser storage.
//
// The JSON export/import above is the full-fidelity backup (settings, team,
// groups, exact task state, restorable byte-for-byte). The CSV export/import
// below is a lighter, Excel-friendly view focused on tasks only — assignees
// and groups round-trip by name (not internal id), so a CSV re-import can't
// restore something as precisely as the JSON one does; it's meant for
// reviewing/bulk-editing tasks in a spreadsheet, not as the primary backup.

import { loadTasks, saveTasks, saveSettings, saveTeam, saveGroups, saveReleases, saveUserStories, saveDefects, saveBlueprintSchedule, saveStandup, loadStandup, normalizeSettings, loadUserStories, loadDefects, loadGroups, saveQaStatus, loadQaStatus, migrateMember } from './storage.js';
import { PRIORITIES, PRIORITY_TEXT, STATUSES, STATUS_LABELS, MAX_COMMENT_LENGTH, uid, APP_SLUG, APP_NAME } from './state.js';
import { sanitizeTitle, nextOrder } from './tasks.js';

export function exportData(state){
  // The ADO Personal Access Token is a credential, not app data — never
  // written to an export file, since backups get shared more casually than
  // people expect. Everything else about a connection is harmless.
  const connectionsWithoutPat = (state.settings.adoConnections || []).map(({pat, ...rest}) => rest);
  // Strip AI API key the same way as PATs — credentials never leave the browser via backup.
  const aiAssist = state.settings.aiAssist
    ? {...state.settings.aiAssist, apiKey: ''}
    : {provider:'openai', endpoint:'', apiKey:'', model:'gpt-4o-mini'};
  const data = {
    exportedAt: new Date().toISOString(),
    settings: {...state.settings, adoConnections: connectionsWithoutPat, aiAssist},
    team: state.team,
    groups: state.groups,
    releases: state.releases,
    userStories: state.userStories,
    defects: state.defects,
    blueprintSchedule: state.blueprintSchedule,
    tasksByDate: {},
    standupByDate: {},
    qaStatusByDate: {}
  };
  Object.keys(localStorage)
    .filter(k => k.startsWith('tasks:') || k.startsWith('standup:') || k.startsWith('qaStatus:'))
    .forEach(k => {
      try{
        const parsed = JSON.parse(localStorage.getItem(k));
        if(k.startsWith('tasks:')) data.tasksByDate[k.slice('tasks:'.length)] = parsed;
        else if(k.startsWith('standup:')) data.standupByDate[k.slice('standup:'.length)] = parsed;
        else data.qaStatusByDate[k.slice('qaStatus:'.length)] = parsed;
      }
      catch(e){ /* skip an unreadable entry rather than fail the whole export */ }
    });

  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_SLUG}-backup-${state.dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  state.settings.lastBackupAt = new Date().toISOString();
  return saveSettings(state.settings);
}

// Merges settings/team/groups and writes any dates present in the file,
// then reloads today's tasks into state. Caller is responsible for
// confirming the overwrite with the user first.
export async function importData(state, file){
  let data;
  try{
    data = JSON.parse(await file.text());
  }catch(e){
    throw new Error('That file is not valid JSON.');
  }
  if(!data || typeof data !== 'object' || Array.isArray(data)){
    throw new Error(`That file does not look like a ${APP_NAME} backup.`);
  }

  if(data.settings && typeof data.settings === 'object'){
    // Exports never include PATs (see exportData) — for each imported
    // connection, keep whatever PAT is already configured locally for that
    // same connection id instead of wiping it to empty. Old backups that
    // still have a single `ado` object (no adoConnections) are migrated
    // the same way loadSettings does, including any PAT stored there.
    const localConnections = state.settings.adoConnections || [];
    const normalized = normalizeSettings(data.settings);
    const mergedConnections = normalized.adoConnections.map(c => {
      const local = localConnections.find(l => l.id === c.id);
      return {...c, pat: c.pat || (local ? local.pat : '')};
    });
    const localAi = state.settings.aiAssist || {};
    const importedAi = normalized.aiAssist || {};
    const aiAssist = {
      ...importedAi,
      apiKey: importedAi.apiKey || localAi.apiKey || ''
    };
    state.settings = {...state.settings, ...normalized, adoConnections: mergedConnections, aiAssist};
    await saveSettings(state.settings);
  }
  if(Array.isArray(data.team)){
    state.team = data.team.map(migrateMember);
    await saveTeam(state.team);
  }
  if(Array.isArray(data.groups)){
    await saveGroups(data.groups);
    state.groups = await loadGroups();
  }
  if(Array.isArray(data.releases)){
    state.releases = data.releases;
    await saveReleases(state.releases);
  }
  if(Array.isArray(data.userStories)){
    await saveUserStories(data.userStories);
    state.userStories = await loadUserStories();
  }
  if(Array.isArray(data.defects)){
    await saveDefects(data.defects);
    state.defects = await loadDefects();
  }
  if(Array.isArray(data.blueprintSchedule)){
    state.blueprintSchedule = data.blueprintSchedule;
    await saveBlueprintSchedule(state.blueprintSchedule);
  }
  if(data.tasksByDate && typeof data.tasksByDate === 'object'){
    for(const [dateStr, tasks] of Object.entries(data.tasksByDate)){
      if(Array.isArray(tasks)) await saveTasks(dateStr, tasks);
    }
  }
  if(data.standupByDate && typeof data.standupByDate === 'object'){
    for(const [dateStr, standup] of Object.entries(data.standupByDate)){
      if(standup && typeof standup === 'object' && !Array.isArray(standup)){
        await saveStandup(dateStr, standup);
      }
    }
  }
  if(data.qaStatusByDate && typeof data.qaStatusByDate === 'object'){
    for(const [dateStr, draft] of Object.entries(data.qaStatusByDate)){
      if(draft && typeof draft === 'object' && !Array.isArray(draft)){
        await saveQaStatus(dateStr, draft);
      }
    }
  }
  state.tasks = await loadTasks(state.dateStr);
  state.standup = await loadStandup(state.dateStr);
  const qaDraft = await loadQaStatus(state.dateStr);
  if(qaDraft) state.qaStatusDraft = qaDraft;
}

/* ---------------------------------------------------------------------- */
/* CSV — tasks only, Excel/Sheets-friendly. See file header for scope.    */
/* ---------------------------------------------------------------------- */

const CSV_COLUMNS = ['Date', 'Time', 'Title', 'Priority', 'Status', 'Assignees', 'Groups', 'Note'];

function csvField(value){
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// A hand-rolled RFC 4180-ish parser (quoted fields, embedded commas/quotes/
// newlines) since this project has no dependencies to reach for a library.
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if(c === '"'){
      inQuotes = true;
    } else if(c === ','){
      row.push(field); field = '';
    } else if(c === '\n'){
      row.push(field); rows.push(row); row = []; field = '';
    } else if(c === '\r'){
      // paired \n (if any) handles the line break; a bare \r is dropped
    } else {
      field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

export function exportTasksCSV(state){
  const teamById = new Map(state.team.map(m => [m.id, m.name]));
  const groupsById = new Map(state.groups.map(g => [g.id, g.name]));
  const rows = [CSV_COLUMNS];

  Object.keys(localStorage)
    .filter(k => k.startsWith('tasks:'))
    .map(k => k.slice('tasks:'.length))
    .sort()
    .forEach(dateStr => {
      let tasks;
      try{ tasks = JSON.parse(localStorage.getItem('tasks:' + dateStr)) || []; }
      catch(e){ return; }
      tasks.slice().sort((a, b) => a.order - b.order).forEach(t => {
        const assignees = (t.assignees || []).map(id => teamById.get(id)).filter(Boolean).join('; ');
        const groups = (t.assignedGroups || []).map(id => groupsById.get(id)).filter(Boolean).join('; ');
        rows.push([
          dateStr, t.time || '', t.title,
          PRIORITY_TEXT[t.priority] || t.priority,
          STATUS_LABELS[t.status] || t.status,
          assignees, groups, t.comment || ''
        ]);
      });
    });

  const csv = rows.map(r => r.map(csvField).join(',')).join('\r\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_SLUG}-tasks-${state.dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Additive only — adds a task per row (deduped by same-day title, like the
// blueprint loader) into whatever date each row names. Never deletes,
// never touches settings/team/groups. Assignees/Groups match existing
// roster names case-insensitively; unmatched names are reported back so
// the caller can surface them, but don't block the rest of the import.
export async function importTasksCSV(state, file){
  const text = await file.text();
  const rows = parseCSV(text);
  if(!rows.length) return {added: 0, skipped: 0, unmatchedNames: [], error: 'The file is empty.'};

  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = {
    date: header.indexOf('date'), time: header.indexOf('time'), title: header.indexOf('title'),
    priority: header.indexOf('priority'), status: header.indexOf('status'),
    assignees: header.indexOf('assignees'), groups: header.indexOf('groups'), note: header.indexOf('note')
  };
  if(col.date === -1 || col.title === -1){
    return {added: 0, skipped: 0, unmatchedNames: [], error: 'Missing required "Date" and/or "Title" column.'};
  }

  const teamByName = new Map(state.team.map(m => [m.name.trim().toLowerCase(), m.id]));
  const groupsByName = new Map(state.groups.map(g => [g.name.trim().toLowerCase(), g.id]));
  const priorityByLabel = new Map(PRIORITIES.flatMap(p => [[p, p], [PRIORITY_TEXT[p].toLowerCase(), p]]));
  const statusByLabel = new Map(STATUSES.flatMap(s => [[s, s], [STATUS_LABELS[s].toLowerCase(), s]]));

  const byDate = new Map(); // dateStr -> tasks array, loaded lazily, one save per date at the end
  const unmatchedNames = new Set();
  let added = 0, skipped = 0;

  for(let r = 1; r < rows.length; r++){
    const row = rows[r];
    if(!row.some(c => c.trim() !== '')) continue;

    const dateStr = (row[col.date] || '').trim();
    const title = sanitizeTitle(row[col.title]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !title){ skipped++; continue; }

    if(!byDate.has(dateStr)) byDate.set(dateStr, await loadTasks(dateStr));
    const tasks = byDate.get(dateStr);
    if(tasks.some(t => t.title.trim().toLowerCase() === title.toLowerCase())){ skipped++; continue; }

    const priority = (col.priority > -1 && priorityByLabel.get((row[col.priority] || '').trim().toLowerCase())) || 'medium';
    const status = (col.status > -1 && statusByLabel.get((row[col.status] || '').trim().toLowerCase())) || 'pending';
    const time = col.time > -1 ? (row[col.time] || '').trim() : '';
    const note = col.note > -1 ? String(row[col.note] || '').trim().slice(0, MAX_COMMENT_LENGTH) : '';

    const assignees = [];
    if(col.assignees > -1 && row[col.assignees]){
      row[col.assignees].split(';').map(s => s.trim()).filter(Boolean).forEach(name => {
        const id = teamByName.get(name.toLowerCase());
        if(id) assignees.push(id); else unmatchedNames.add(name);
      });
    }
    const assignedGroups = [];
    if(col.groups > -1 && row[col.groups]){
      row[col.groups].split(';').map(s => s.trim()).filter(Boolean).forEach(name => {
        const id = groupsByName.get(name.toLowerCase());
        if(id) assignedGroups.push(id); else unmatchedNames.add(name);
      });
    }

    tasks.push({
      id: uid(), title, time, priority, status, comment: note,
      assignees, assignedGroups, order: nextOrder(priority, tasks), source: 'manual'
    });
    added++;
  }

  for(const [dateStr, tasks] of byDate) await saveTasks(dateStr, tasks);
  if(byDate.has(state.dateStr)) state.tasks = byDate.get(state.dateStr);

  return {added, skipped, unmatchedNames: [...unmatchedNames]};
}
