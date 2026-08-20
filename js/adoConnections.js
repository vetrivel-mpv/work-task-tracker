// ADO connection management — a managed list (like releases.js) so a
// second organization/project can be configured without losing the first.
// Each Release picks which connection it syncs from (see releaseModalHTML);
// with only one connection configured, every release uses it implicitly.

import { MAX_ADO_CONNECTION_NAME_LENGTH, uid } from './state.js';
import { saveSettings, saveReleases } from './storage.js';

const DEFAULT_WORK_ITEM_TYPES = {userStory: 'User Story', defect: 'Bug', task: 'Task'};

export async function addAdoConnection(state, rawName, org, project, pat, workItemTypes){
  const name = String(rawName ?? '').trim().slice(0, MAX_ADO_CONNECTION_NAME_LENGTH);
  if(!name){
    state.adoConnectionWarn = 'Enter a name for this connection first.';
    return false;
  }
  state.settings.adoConnections.push({
    id: uid(), name,
    org: String(org ?? '').trim(), project: String(project ?? '').trim(), pat: String(pat ?? '').trim(),
    workItemTypes: {...DEFAULT_WORK_ITEM_TYPES, ...(workItemTypes || {})}
  });
  state.adoConnectionWarn = '';
  await saveSettings(state.settings);
  return true;
}

export async function updateAdoConnection(state, id, rawName, org, project, pat, workItemTypes){
  const c = state.settings.adoConnections.find(c => c.id === id);
  if(!c) return false;
  const name = String(rawName ?? '').trim().slice(0, MAX_ADO_CONNECTION_NAME_LENGTH);
  if(!name){
    state.adoConnectionWarn = 'Enter a name for this connection first.';
    return false;
  }
  c.name = name;
  c.org = String(org ?? '').trim();
  c.project = String(project ?? '').trim();
  c.pat = String(pat ?? '').trim();
  c.workItemTypes = {...DEFAULT_WORK_ITEM_TYPES, ...(workItemTypes || {})};
  state.adoConnectionWarn = '';
  await saveSettings(state.settings);
  return true;
}

export async function removeAdoConnection(state, id){
  state.settings.adoConnections = state.settings.adoConnections.filter(c => c.id !== id);
  // Drop the now-dangling reference rather than leaving a release pointed
  // at a connection that no longer exists.
  let releasesTouched = false;
  state.releases.forEach(r => {
    if(r.connectionId === id){ r.connectionId = null; releasesTouched = true; }
  });
  await saveSettings(state.settings);
  if(releasesTouched) await saveReleases(state.releases);
}
