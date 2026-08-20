// Release roster management — a managed list (like team.js/groups.js) so
// release names stay consistent across User Stories, Defects, and tasks
// instead of being retyped as free text everywhere.

import { MAX_RELEASE_NAME_LENGTH, uid } from './state.js';
import { saveReleases, saveUserStories, saveTasks } from './storage.js';

export async function addRelease(state, rawName, targetDate, iterationPath, connectionId){
  const name = String(rawName ?? '').trim().slice(0, MAX_RELEASE_NAME_LENGTH);
  if(!name){
    state.releaseWarn = 'Enter a release name first.';
    return false;
  }
  // iterationPath lives per-release (not in the shared ADO settings) so two
  // releases can sync from two different ADO sprints. connectionId is which
  // ADO org/project this release syncs from — left unset it falls back to
  // the only configured connection, if there's just one (see
  // resolveAdoConnection in state.js).
  state.releases.push({ id: uid(), name, targetDate: targetDate || '', iterationPath: (iterationPath || '').trim(), connectionId: connectionId || null });
  state.releaseWarn = '';
  // Newly added release becomes active so Stories/Defects/ADO aren't stuck on All.
  state.selectedReleaseId = state.releases[state.releases.length - 1].id;
  if(state.settings) state.settings.selectedReleaseId = state.selectedReleaseId;
  await saveReleases(state.releases);
  return true;
}

export async function updateRelease(state, id, rawName, targetDate, iterationPath, connectionId){
  const r = state.releases.find(r => r.id === id);
  if(!r) return false;
  const name = String(rawName ?? '').trim().slice(0, MAX_RELEASE_NAME_LENGTH);
  if(!name){
    state.releaseWarn = 'Enter a release name first.';
    return false;
  }
  r.name = name;
  r.targetDate = targetDate || '';
  r.iterationPath = (iterationPath || '').trim();
  r.connectionId = connectionId || null;
  state.releaseWarn = '';
  await saveReleases(state.releases);
  return true;
}

export async function removeRelease(state, id){
  state.releases = state.releases.filter(r => r.id !== id);
  // Drop the now-dangling reference everywhere it's used, rather than
  // leaving a User Story or task pointed at a release that no longer exists.
  let usTouched = false;
  state.userStories.forEach(us => {
    if(us.releaseId === id){ us.releaseId = null; usTouched = true; }
  });
  let tasksTouched = false;
  state.tasks.forEach(t => {
    if(t.releaseId === id){ t.releaseId = null; tasksTouched = true; }
  });
  if(state.selectedReleaseId === id){
    state.selectedReleaseId = null;
    if(state.settings) state.settings.selectedReleaseId = '';
  }
  await saveReleases(state.releases);
  if(usTouched) await saveUserStories(state.userStories);
  if(tasksTouched) await saveTasks(state.dateStr, state.tasks);
}
