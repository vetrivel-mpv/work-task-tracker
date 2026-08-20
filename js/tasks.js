// Task list mutations. Each function mutates the shared `state` object and
// persists the result; callers are responsible for re-rendering afterward.

import { MAX_TITLE_LENGTH, MAX_COMMENT_LENGTH, NEXT_STATUS, uid, shiftDate } from './state.js';
import { loadTasks, saveTasks, loadStandup } from './storage.js';

export function nextOrder(priority, tasks){
  const lane = tasks.filter(t => t.priority === priority);
  return lane.length ? Math.max(...lane.map(t => t.order)) + 1 : 0;
}

// Rejects empty/whitespace-only titles and caps length so a huge paste
// can't bloat storage or blow out the card layout.
export function sanitizeTitle(rawTitle){
  const trimmed = String(rawTitle ?? '').trim();
  if(!trimmed) return null;
  return trimmed.slice(0, MAX_TITLE_LENGTH);
}

export async function switchDate(state, newDateStr){
  state.dateStr = newDateStr;
  state.clearArmed = false;
  state.bpMsg = '';
  state.emailMsg = '';
  state.emailWarn = '';
  state.openCommentIds.clear();
  state.deleteArmedIds.clear();
  state.editingTaskId = null;
  state.newTaskTarget = 'today';
  state.newTaskAssigneeIds.clear();
  state.newTaskGroupIds.clear();
  state.newTaskDraft = {title:'', time:''};
  state.newTaskNoteDraft = '';
  state.newTaskWarn = '';
  state.newTaskWorkItemType = '';
  state.newTaskLinkedItemId = '';
  state.taskSearchQuery = '';
  state.standupMsg = '';
  state.standupWarn = '';
  state.modal = null;
  state.assignPickerFor = null;
  state.assignPickerQuery = '';
  state.priorityDropdownFor = null;
  state.standupPersonQuery = '';
  state.standupPickerOpen = false;
  state.peopleSearch = '';
  state.expandedLane = 'high';
  state.tasks = await loadTasks(newDateStr);
  state.yesterdayTasks = await loadTasks(shiftDate(newDateStr, -1));
  state.standup = await loadStandup(newDateStr);
}

// opts.dateStr lets a task be logged onto a different day (e.g. "tomorrow")
// than the one currently on screen — used for capturing call outcomes at
// end of day without navigating away from today's board first.
export async function addTask(state, rawTitle, time, opts = {}){
  const title = sanitizeTitle(rawTitle);
  if(!title) return false;
  const targetDateStr = opts.dateStr || state.dateStr;
  const isCurrentDay = targetDateStr === state.dateStr;
  const targetTasks = isCurrentDay ? state.tasks : await loadTasks(targetDateStr);
  const t = {
    id: uid(), title, time: time || '',
    priority: state.newPriority, status: 'pending',
    comment: String(opts.comment ?? '').trim().slice(0, MAX_COMMENT_LENGTH),
    assignees: Array.isArray(opts.assignees) ? opts.assignees : [],
    assignedGroups: Array.isArray(opts.assignedGroups) ? opts.assignedGroups : [],
    releaseId: opts.releaseId || null, latestComment: null,
    // Usually set by an ADO sync (a synced Task's parent User Story or Bug)
    // but can also be picked by hand in the New Task modal, scoped to
    // whichever release is selected there (see newTaskLinkFieldHTML).
    iterationPath: '', assigneeEmail: '', createdByName: '', createdByEmail: '',
    userStoryId: opts.userStoryId || null, defectId: opts.defectId || null,
    order: nextOrder(state.newPriority, targetTasks), source: 'manual'
  };
  targetTasks.push(t);
  await saveTasks(targetDateStr, targetTasks);
  return true;
}

// Cycles Not started -> Partially complete -> Complete -> Not started.
export async function cycleStatus(state, id){
  const t = state.tasks.find(t => t.id === id);
  if(t){ t.status = NEXT_STATUS[t.status] || 'partial'; await saveTasks(state.dateStr, state.tasks); }
}

export async function setComment(state, id, rawComment){
  const t = state.tasks.find(t => t.id === id);
  if(!t) return;
  t.comment = String(rawComment ?? '').trim().slice(0, MAX_COMMENT_LENGTH);
  await saveTasks(state.dateStr, state.tasks);
}

export async function toggleAssignee(state, id, memberId){
  const t = state.tasks.find(t => t.id === id);
  if(!t) return;
  if(!Array.isArray(t.assignees)) t.assignees = [];
  t.assignees = t.assignees.includes(memberId)
    ? t.assignees.filter(a => a !== memberId)
    : [...t.assignees, memberId];
  await saveTasks(state.dateStr, state.tasks);
}

export async function toggleAssignedGroup(state, id, groupId){
  const t = state.tasks.find(t => t.id === id);
  if(!t) return;
  if(!Array.isArray(t.assignedGroups)) t.assignedGroups = [];
  t.assignedGroups = t.assignedGroups.includes(groupId)
    ? t.assignedGroups.filter(g => g !== groupId)
    : [...t.assignedGroups, groupId];
  await saveTasks(state.dateStr, state.tasks);
}

export async function deleteTask(state, id){
  state.tasks = state.tasks.filter(t => t.id !== id);
  await saveTasks(state.dateStr, state.tasks);
}

export async function setPriority(state, id, priority){
  const t = state.tasks.find(t => t.id === id);
  if(t && t.priority !== priority){
    t.priority = priority; t.order = nextOrder(priority, state.tasks);
    await saveTasks(state.dateStr, state.tasks);
  }
}

export async function setTaskRelease(state, id, releaseId){
  const t = state.tasks.find(t => t.id === id);
  if(t){ t.releaseId = releaseId || null; await saveTasks(state.dateStr, state.tasks); }
}

export async function moveTask(state, id, dir){
  const t = state.tasks.find(t => t.id === id);
  if(!t) return;
  const lane = state.tasks.filter(x => x.priority === t.priority).sort((a,b) => a.order - b.order);
  const idx = lane.findIndex(x => x.id === id);
  const swapIdx = idx + dir;
  if(swapIdx < 0 || swapIdx >= lane.length) return;
  const other = lane[swapIdx];
  const tmp = t.order; t.order = other.order; other.order = tmp;
  await saveTasks(state.dateStr, state.tasks);
}

export async function clearDay(state){
  state.tasks = [];
  await saveTasks(state.dateStr, []);
  state.clearArmed = false;
}

export async function loadBlueprint(state, schedule){
  const existingTitles = new Set(state.tasks.map(t => t.title.trim().toLowerCase()));
  let added = 0;
  const tasks = state.tasks.slice();
  schedule.forEach(item => {
    if(!item || !item.title) return;
    if(existingTitles.has(item.title.toLowerCase())) return;
    tasks.push({
      id: uid(), title: item.title, time: item.time || '', priority: item.priority,
      status: 'pending', comment: '', assignees: [], assignedGroups: [],
      order: nextOrder(item.priority, tasks), source: 'blueprint'
    });
    added++;
  });
  state.tasks = tasks;
  await saveTasks(state.dateStr, state.tasks);
  state.bpMsg = added > 0 ? `Added ${added} task${added===1?'':'s'} from the schedule.` : 'Those tasks are already on this day.';
}

// Fixes a typo without delete+recreate (which would also lose the
// comment/assignees/status history on the task).
export async function renameTask(state, id, rawTitle, time){
  const t = state.tasks.find(t => t.id === id);
  if(!t) return false;
  const title = sanitizeTitle(rawTitle);
  if(!title) return false;
  t.title = title;
  t.time = time || '';
  await saveTasks(state.dateStr, state.tasks);
  return true;
}

export async function carryForwardPending(state){
  const pendingAll = state.tasks.filter(t => t.status !== 'complete');
  if(!pendingAll.length) return 0;
  const tomorrowStr = shiftDate(state.dateStr, 1);
  const tomorrowTasks = await loadTasks(tomorrowStr);
  const existingTitles = new Set(tomorrowTasks.map(t => t.title.trim().toLowerCase()));
  let addedCount = 0;
  pendingAll.forEach(t => {
    if(existingTitles.has(t.title.trim().toLowerCase())) return;
    tomorrowTasks.push({
      id: uid(), title: t.title, time: t.time, priority: t.priority,
      status: 'pending', comment: t.comment || '',
      assignees: Array.isArray(t.assignees) ? [...t.assignees] : [],
      assignedGroups: Array.isArray(t.assignedGroups) ? [...t.assignedGroups] : [],
      releaseId: t.releaseId || null,
      userStoryId: t.userStoryId || null,
      defectId: t.defectId || null,
      order: nextOrder(t.priority, tomorrowTasks), source: 'carried'
    });
    addedCount++;
  });
  if(addedCount > 0) await saveTasks(tomorrowStr, tomorrowTasks);
  return addedCount;
}
