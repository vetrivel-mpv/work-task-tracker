// Quick-load blueprint management — a user-editable list of recurring
// items (like releases.js/team.js), seeded once from the built-in
// DAILY_BLUEPRINT_SCHEDULE (see storage.js's loadBlueprintSchedule) but
// fully editable from there. loadBlueprint (tasks.js) bulk-adds whatever
// this list currently holds onto today's board.

import { MAX_TITLE_LENGTH, PRIORITIES, uid } from './state.js';
import { saveBlueprintSchedule } from './storage.js';

export async function addBlueprintItem(state, rawTitle, time, priority){
  const title = String(rawTitle ?? '').trim().slice(0, MAX_TITLE_LENGTH);
  if(!title){
    state.blueprintWarn = 'Enter a title first.';
    return false;
  }
  state.blueprintSchedule.push({
    id: uid(), title, time: time || '',
    priority: PRIORITIES.includes(priority) ? priority : 'medium'
  });
  state.blueprintWarn = '';
  await saveBlueprintSchedule(state.blueprintSchedule);
  return true;
}

export async function updateBlueprintItem(state, id, rawTitle, time, priority){
  const item = state.blueprintSchedule.find(i => i.id === id);
  if(!item) return false;
  const title = String(rawTitle ?? '').trim().slice(0, MAX_TITLE_LENGTH);
  if(!title){
    state.blueprintWarn = 'Enter a title first.';
    return false;
  }
  item.title = title;
  item.time = time || '';
  item.priority = PRIORITIES.includes(priority) ? priority : 'medium';
  state.blueprintWarn = '';
  await saveBlueprintSchedule(state.blueprintSchedule);
  return true;
}

export async function removeBlueprintItem(state, id){
  state.blueprintSchedule = state.blueprintSchedule.filter(i => i.id !== id);
  await saveBlueprintSchedule(state.blueprintSchedule);
}
