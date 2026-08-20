/*
  Northstar Delivery — client delivery & team operations
  Vanilla JS (ES modules), no build step, no dependencies.
  Persists to the browser's localStorage — all data stays on this machine.

  This file owns the shared `state` object and wires DOM events (from
  render.js) to state mutations (in tasks.js / email.js), re-rendering after
  each one. See storage.js, tasks.js, email.js, render.js for the pieces.
*/
import { createInitialState, shiftDate, toDateStr } from './state.js';
import { loadTasks, loadSettings, saveSettings, loadTeam, loadGroups, loadStandup, loadReleases, loadUserStories, loadDefects, loadBlueprintSchedule, loadQaStatus } from './storage.js';
import * as Tasks from './tasks.js';
import * as Team from './team.js';
import * as Groups from './groups.js';
import * as Standup from './standup.js';
import * as Releases from './releases.js';
import * as UserStories from './userStories.js';
import * as Defects from './defects.js';
import * as AdoConnections from './adoConnections.js';
import * as Blueprint from './blueprint.js';
import { syncFromADO } from './adoSync.js';
import { sendEmailUpdate } from './email.js';
import { sendStandupEmail } from './standupEmail.js';
import { sendDefectsEmail } from './defectsEmail.js';
import { sendDashboardEmail } from './dashboardEmail.js';
import { buildQaStatusDraft, captureQaStatusForm, persistQaStatusDraft, sendQaStatusEmail, applyStoryCountsToDraft } from './qaStatusEmail.js';
import { draftAppreciationEmail, draftAppreciationEmailAll } from './peopleReviews.js';
import { summarizeDaySignals, defaultsForProvider, draftStandupHighlights, draftQaHighlights } from './aiAssist.js';
import { exportData, importData, exportTasksCSV, importTasksCSV } from './backup.js';
import { render } from './render.js';

const state = createInitialState();

let softRenderTimer = null;
let softRenderScope = null;
let modalCloseToken = 0;

function mergeRenderScope(a, b){
  if(!a) return b;
  if(!b) return a;
  if(a === 'full' || b === 'full') return 'full';
  if(a === b) return a;
  if(a === 'shell' || b === 'shell' || a === 'page' || b === 'page'){
    if(a === 'modal' || b === 'modal' || a === 'popover' || b === 'popover') return 'full';
    return 'page';
  }
  if((a === 'modal' && b === 'popover') || (a === 'popover' && b === 'modal')) return 'modal';
  // modal + popover together → full (independent hosts, but safer)
  return 'full';
}

function rerender(scope = 'page'){
  if(softRenderTimer){
    clearTimeout(softRenderTimer);
    softRenderTimer = null;
    const pending = softRenderScope;
    softRenderScope = null;
    render(state, handlers, {scope: mergeRenderScope(pending, scope)});
    return;
  }
  render(state, handlers, {scope});
}

// Debounced soft updates for high-frequency typing (search filters) so the
// whole app chrome isn't rebuilt on every keystroke.
function scheduleSoftRender(scope){
  softRenderScope = mergeRenderScope(softRenderScope, scope);
  clearTimeout(softRenderTimer);
  softRenderTimer = setTimeout(() => {
    const s = softRenderScope || scope;
    softRenderScope = null;
    softRenderTimer = null;
    render(state, handlers, {scope: s});
  }, 140);
}

function closeModalWithTransition(){
  closeAllPopovers();
  // Nested forms (member → People, connection → list) swap content in place
  // without a leave animation so the parent modal doesn't flash closed.
  if(state.modal && state.modal.returnTo){
    modalCloseToken++; // cancel any in-flight leave
    state.modal = {type: state.modal.returnTo};
    rerender();
    return;
  }
  const overlay = document.getElementById('modalOverlay');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const token = ++modalCloseToken;
  const finish = () => {
    if(token !== modalCloseToken) return;
    const refreshChrome = state.modal && state.modal.type === 'settings';
    state.modal = null;
    // Settings can change the sidebar identity — remount chrome when it closes.
    rerender(refreshChrome ? 'shell' : 'page');
  };
  if(!overlay || reduceMotion || overlay.classList.contains('is-leaving')){
    finish();
    return;
  }
  overlay.classList.add('is-leaving');
  const panel = overlay.querySelector('.modal-panel');
  if(panel) panel.classList.add('is-leaving');
  setTimeout(finish, 170);
}

// Only one floating popover (priority dropdown / assignee picker / standup
// person picker) is ever open at a time — used whenever something else
// (opening a modal, opening a different popover) should take over.
function closeAllPopovers(){
  state.priorityDropdownFor = null;
  state.assignPickerFor = null;
  state.standupPickerOpen = false;
}

function flashMessage(field, ms){
  setTimeout(() => {
    state[field] = '';
    // Standup delivery banner lives in chrome; other flashes are page/modal.
    rerender(field === 'standupMsg' || field === 'standupWarn' ? 'full' : 'page');
  }, ms);
}

async function switchDateAndRender(newDateStr){
  await Tasks.switchDate(state, newDateStr);
  rerender();
}

const handlers = {
  onPrevDay: () => switchDateAndRender(shiftDate(state.dateStr, -1)),
  onNextDay: () => switchDateAndRender(shiftDate(state.dateStr, 1)),
  onPillYesterday: () => switchDateAndRender(shiftDate(toDateStr(new Date()), -1)),
  onPillToday: () => switchDateAndRender(toDateStr(new Date())),
  onPillTomorrow: () => switchDateAndRender(shiftDate(toDateStr(new Date()), 1)),

  // ---- Floating modal (New Task / Board email / Settings / People / Groups / Add-Edit teammate) ----
  // `memberId` is reused generically as "the id of the entity this modal
  // instance is editing" across the newer release/user-story/defect modal
  // types too, not just teammates — keeps one mechanism instead of two.
  onOpenModal: (type, memberId, returnTo) => {
    modalCloseToken++; // cancel in-flight leave so a new open isn't wiped
    if(type === 'people' && !returnTo) state.peopleSearch = '';
    if(type === 'member' && !memberId){
      state.memberDraft = {name:'', role:'', email:''};
      state.teamWarn = '';
    }
    if(type === 'addRelease' && !memberId){
      state.releaseDraft = {name:'', targetDate:'', iterationPath:'', connectionId:''};
      state.releaseWarn = '';
    }
    if(type === 'addUserStory' && !memberId){
      state.userStoryDraft = {title:'', releaseId: state.selectedReleaseId || '', assigneeId:'', iterationPath:'', groupIds:[]};
    }
    if(type === 'addDefect' && !memberId){
      state.defectDraft = {title:'', userStoryId:'', severity:'medium', assigneeId:'', iterationPath:''};
    }
    if(type === 'adoConnectionForm' && !memberId){
      state.adoConnectionDraft = {name:'', org:'', project:'', pat:'', workItemTypes:{userStory:'User Story', defect:'Bug', task:'Task'}};
      state.adoConnectionWarn = '';
    }
    if(type === 'blueprintItemForm' && !memberId){
      state.blueprintItemDraft = {title:'', time:'', priority:'medium'};
      state.blueprintWarn = '';
    }
    if(type === 'settings' && state.modal && state.modal.type === 'qaStatus' && !returnTo){
      returnTo = 'qaStatus';
    }
    closeAllPopovers();
    if(type === 'newTask'){
      state.newTaskWarn = '';
      if(!state.newTaskReleaseId && state.selectedReleaseId){
        state.newTaskReleaseId = state.selectedReleaseId;
      }
    }
    state.modal = {type, memberId: memberId || null, returnTo: returnTo || null};
    rerender('modal');
  },
  onCloseModal: () => {
    // The member-edit modal hands back to the People modal it was opened
    // from, instead of closing everything. Also drop any picker that was
    // open inside the modal so it doesn't linger as a hidden portal.
    closeModalWithTransition();
  },

  // ---- Priority lanes: accordion, one expanded at a time ----
  onToggleLane: (priority) => {
    state.expandedLane = state.expandedLane === priority ? null : priority;
    rerender();
  },
  onToggleCompletedGroup: (priority) => {
    if(state.completedOpenFor.has(priority)) state.completedOpenFor.delete(priority);
    else state.completedOpenFor.add(priority);
    rerender();
  },

  // ---- People modal search ----
  onPeopleSearch: (value) => { state.peopleSearch = value; scheduleSoftRender('modal'); },

  // ---- Searchable assignee/group popover. Only one floating popover (this,
  // priority dropdown, or the standup person picker) is ever open at once —
  // opening one closes the others so they don't stack. ----
  onOpenAssignPicker: (forId) => {
    state.assignPickerFor = forId;
    state.assignPickerQuery = '';
    state.priorityDropdownFor = null;
    state.standupPickerOpen = false;
    rerender(forId === 'new' || state.modal ? 'modal' : 'page');
  },
  onCloseAssignPicker: () => { state.assignPickerFor = null; rerender(state.modal ? 'modal' : 'page'); },
  onAssignPickerQuery: (value) => { state.assignPickerQuery = value; scheduleSoftRender('popover'); },

  // ---- Priority dropdown (task cards + New Task modal) ----
  onOpenPriorityDropdown: (forId) => {
    state.priorityDropdownFor = forId;
    state.assignPickerFor = null;
    state.standupPickerOpen = false;
    rerender(forId === 'new' || state.modal ? 'modal' : 'page');
  },
  onClosePriorityDropdown: () => { state.priorityDropdownFor = null; rerender(state.modal ? 'modal' : 'page'); },
  onChoosePriority: async (forId, p) => {
    if(forId === 'new'){
      state.newPriority = p;
    }else{
      await Tasks.setPriority(state, forId, p);
    }
    state.priorityDropdownFor = null;
    rerender(forId === 'new' ? 'modal' : 'page');
  },

  onAddTask: async (title, time, comment) => {
    const targetDateStr = state.newTaskTarget === 'tomorrow' ? shiftDate(state.dateStr, 1) : state.dateStr;
    const added = await Tasks.addTask(state, title, time, {
      comment,
      assignees: [...state.newTaskAssigneeIds],
      assignedGroups: [...state.newTaskGroupIds],
      releaseId: state.newTaskReleaseId,
      userStoryId: state.newTaskWorkItemType === 'userStory' ? (state.newTaskLinkedItemId || null) : null,
      defectId: state.newTaskWorkItemType === 'defect' ? (state.newTaskLinkedItemId || null) : null,
      dateStr: targetDateStr
    });
    if(!added){
      state.newTaskWarn = 'Enter a title to add this task.';
      rerender('modal');
      const input = document.getElementById('taskInput');
      if(input) input.focus();
      return;
    }
    const createdPriority = state.newPriority;
    state.newTaskWarn = '';
    state.newTaskAssigneeIds.clear();
    state.newTaskGroupIds.clear();
    state.newTaskDraft = {title:'', time:''};
    state.newTaskNoteDraft = '';
    state.newPriority = 'medium';
    state.newTaskReleaseId = null;
    state.newTaskWorkItemType = '';
    state.newTaskLinkedItemId = '';
    state.newTaskTarget = 'today';
    state.modal = null;
    state.expandedLane = createdPriority;
    if(targetDateStr !== state.dateStr){
      await Tasks.switchDate(state, targetDateStr);
      state.expandedLane = createdPriority;
    }
    rerender('full');
  },
  // Changing the release invalidates whichever User Story/Defect was picked
  // for the old one (the filtered list in the modal depends on the release).
  onSetNewTaskRelease: (releaseId) => {
    state.newTaskReleaseId = releaseId || null;
    state.newTaskWorkItemType = '';
    state.newTaskLinkedItemId = '';
    rerender('modal');
  },
  onSetNewTaskWorkItemType: (type) => {
    state.newTaskWorkItemType = type === state.newTaskWorkItemType ? '' : type;
    state.newTaskLinkedItemId = '';
    rerender('modal');
  },
  onSetNewTaskLinkedItem: (id) => { state.newTaskLinkedItemId = id || ''; rerender('modal'); },
  onSetTaskRelease: async (id, releaseId) => { await Tasks.setTaskRelease(state, id, releaseId); rerender(); },

  // ---- Priority lane search — filters the board by task title/assignee,
  // the main thing that makes a large (e.g. ADO-synced) board navigable. ----
  onTaskSearch: (value) => { state.taskSearchQuery = value; scheduleSoftRender('page'); },

  onSetNewTaskTarget: (target) => { state.newTaskTarget = target; rerender('modal'); },
  onToggleNewTaskAssignee: (memberId) => {
    if(state.newTaskAssigneeIds.has(memberId)) state.newTaskAssigneeIds.delete(memberId);
    else state.newTaskAssigneeIds.add(memberId);
    rerender('modal');
  },
  onToggleNewTaskGroup: (groupId) => {
    if(state.newTaskGroupIds.has(groupId)) state.newTaskGroupIds.delete(groupId);
    else state.newTaskGroupIds.add(groupId);
    rerender('modal');
  },

  onLoadBlueprint: async (schedule) => {
    await Tasks.loadBlueprint(state, schedule);
    rerender();
    flashMessage('bpMsg', 4000);
  },

  onManagerEmailChange: (value) => { state.settings.managerEmail = value.trim(); saveSettings(state.settings); },
  onYourNameChange: (value) => { state.settings.yourName = value.trim(); saveSettings(state.settings); },
  onCarryForwardChange: (checked) => { state.settings.carryForward = checked; saveSettings(state.settings); },

  onSendEmail: async () => {
    const mgrInput = document.getElementById('managerEmail');
    const nameInput = document.getElementById('yourName');
    const result = await sendEmailUpdate(state, {
      managerEmail: mgrInput ? mgrInput.value : '',
      yourName: nameInput ? nameInput.value : ''
    });
    rerender();
    if(result.focusField){
      const el = document.getElementById(result.focusField);
      if(el) el.focus();
    } else if(state.emailMsg){
      flashMessage('emailMsg', 6000);
    }
  },

  onOpenQaStatus: async () => {
    modalCloseToken++;
    const saved = await loadQaStatus(state.dateStr);
    state.qaStatusDraft = buildQaStatusDraft(state, saved);
    state.qaStatusMsg = '';
    state.qaStatusWarn = '';
    closeAllPopovers();
    state.modal = {type: 'qaStatus', memberId: null, returnTo: null};
    rerender();
  },
  onSaveQaStatus: async () => {
    const draft = captureQaStatusForm(state);
    await persistQaStatusDraft(state, draft);
    state.qaStatusWarn = '';
    state.qaStatusMsg = 'QA status draft saved for this day.';
    rerender();
    flashMessage('qaStatusMsg', 4000);
  },
  onSendQaStatus: async () => {
    const draft = captureQaStatusForm(state);
    const result = await sendQaStatusEmail(state, draft);
    rerender();
    if(result.ok && state.qaStatusMsg) flashMessage('qaStatusMsg', 7000);
  },

  onCycleStatus: async (id) => { await Tasks.cycleStatus(state, id); rerender(); },
  onMoveUp: async (id) => { await Tasks.moveTask(state, id, -1); rerender(); },
  onMoveDown: async (id) => { await Tasks.moveTask(state, id, 1); rerender(); },

  // One click arms the delete (and un-arms any other armed task); the
  // second click within 3s actually deletes. Prevents a stray misclick
  // from silently destroying a task's comment/assignee/status history.
  onDeleteRequest: (id) => {
    if(state.deleteArmedIds.has(id)){
      state.deleteArmedIds.delete(id);
      Tasks.deleteTask(state, id).then(rerender);
    }else{
      state.deleteArmedIds.clear();
      state.deleteArmedIds.add(id);
      rerender();
      setTimeout(() => {
        if(state.deleteArmedIds.has(id)){ state.deleteArmedIds.delete(id); rerender(); }
      }, 3000);
    }
  },

  onEditTitle: (id) => { state.editingTaskId = id; rerender(); },
  onCancelEdit: () => { state.editingTaskId = null; rerender(); },
  onSaveEdit: async (id, title, time) => {
    const ok = await Tasks.renameTask(state, id, title, time);
    if(ok){ state.editingTaskId = null; rerender(); }
  },

  onToggleComment: (id) => {
    if(state.openCommentIds.has(id)) state.openCommentIds.delete(id);
    else state.openCommentIds.add(id);
    rerender();
  },
  onCommentChange: async (id, value) => { await Tasks.setComment(state, id, value); rerender(); },
  onToggleAssignee: async (id, memberId) => { await Tasks.toggleAssignee(state, id, memberId); rerender(); },
  onToggleAssignedGroup: async (id, groupId) => { await Tasks.toggleAssignedGroup(state, id, groupId); rerender(); },

  // ---- People (add/edit both go through the modal now) ----
  onSaveMember: async (id, name, role, email) => {
    const returnTo = state.modal && state.modal.returnTo;
    const ok = id
      ? await Team.updateMember(state, id, name, role, email)
      : await Team.addMember(state, name, role, email);
    if(ok){
      if(!id) state.memberDraft = {name:'', role:'', email:''};
      state.modal = returnTo ? {type: returnTo} : null;
    }
    rerender();
  },
  onRemoveMember: async (id) => {
    const member = state.team.find(m => m.id === id);
    const name = member ? member.name : 'this person';
    const ok = confirm(`Remove ${name} from the roster? They will be unassigned from board tasks on every saved day (all dates), not only today. Groups and today's standup notes for them are cleaned up too.`);
    if(!ok) return;
    await Team.removeMember(state, id);
    rerender();
  },

  onAddOooRange: async (memberId, from, to) => {
    const ok = await Team.addOooRange(state, memberId, from, to);
    rerender();
    return ok;
  },
  onRemoveOooRange: async (memberId, index) => {
    await Team.removeOooRange(state, memberId, index);
    rerender();
  },

  onStandupFieldChange: async (memberId, field, value) => {
    await Standup.setStandupField(state, memberId, field, value);
  },
  onSetStandupActiveMember: (id) => {
    state.standupActiveMemberId = id;
    state.standupPersonQuery = '';
    state.standupPickerOpen = false;
    rerender();
  },
  onToggleStandupPicker: () => {
    const opening = !state.standupPickerOpen;
    state.standupPickerOpen = opening;
    state.standupPersonQuery = '';
    if(opening){ state.assignPickerFor = null; state.priorityDropdownFor = null; }
    rerender();
  },
  onStandupPersonQuery: (value) => { state.standupPersonQuery = value; scheduleSoftRender('popover'); },
  onSendStandupEmail: async () => {
    // The standup card only shows one teammate's fields at a time, so seed
    // from the already-saved state.standup for everyone else, then layer
    // on whatever's currently in the DOM for the active person — in case
    // they're mid-edit and haven't blurred (same defensive read used for
    // the manager email fields).
    try{
      const liveStandup = {};
      (state.team || []).forEach(m => { liveStandup[m.id] = {...(state.standup[m.id] || {})}; });
      document.querySelectorAll('.standup-input').forEach(el => {
        if(!liveStandup[el.dataset.member]) liveStandup[el.dataset.member] = {};
        liveStandup[el.dataset.member][el.dataset.field] = el.value;
      });
      document.querySelectorAll('.standup-task-link').forEach(el => {
        if(!liveStandup[el.dataset.member]) liveStandup[el.dataset.member] = {};
        liveStandup[el.dataset.member].linkedTaskId = el.value;
      });
      // Preserve absences + discussion queue from saved standup meta.
      if(state.standup && state.standup.__meta) liveStandup.__meta = state.standup.__meta;
      const result = await sendStandupEmail(state, liveStandup);
      rerender('full');
      if(result.ok && state.standupMsg) flashMessage('standupMsg', 7000);
      if(state.standupWarn) flashMessage('standupWarn', 8000);
    }catch(err){
      console.error('Standup email failed', err);
      state.standupMsg = '';
      state.standupWarn = 'Standup email failed unexpectedly — check the browser console and try again.';
      rerender('full');
      flashMessage('standupWarn', 8000);
    }
  },
  onToggleStandupExpand: () => {
    state.standupRailExpanded = !state.standupRailExpanded;
    rerender();
  },

  onToggleNewGroupMember: (memberId) => {
    if(state.newGroupMemberIds.has(memberId)) state.newGroupMemberIds.delete(memberId);
    else state.newGroupMemberIds.add(memberId);
    rerender();
  },
  onAddGroup: async (name, purpose) => {
    const added = await Groups.addGroup(state, name, [...state.newGroupMemberIds], purpose);
    if(added){
      state.newGroupMemberIds.clear();
      state.newGroupNameDraft = '';
      state.newGroupPurposeDraft = '';
      rerender();
    }
  },
  onRemoveGroup: async (id) => { await Groups.removeGroup(state, id); rerender(); },
  onToggleGroupMember: async (groupId, memberId) => { await Groups.toggleGroupMember(state, groupId, memberId); rerender(); },
  onGroupPurposeChange: async (groupId, purpose) => { await Groups.updateGroupPurpose(state, groupId, purpose); rerender(); },

  onToggleBoardInsights: () => { state.boardInsightsOpen = !state.boardInsightsOpen; rerender(); },
  onToggleAbsence: async (memberId) => { await Standup.toggleAbsence(state, memberId); rerender(); },
  onDelegateToPeer: async (fromId, toId) => {
    const result = await Groups.delegateWorkToPeer(state, fromId, toId);
    const n = result.tasks + result.stories + result.defects;
    const from = state.team.find(m => m.id === fromId);
    state.standupMsg = n
      ? `Added peer as co-owner on ${result.tasks} task${result.tasks===1?'':'s'}, ${result.stories} stor${result.stories===1?'y':'ies'}, ${result.defects} defect${result.defects===1?'':'s'} — ${from ? from.name : 'the absent person'} stays assigned.`
      : 'Nothing new to share (already co-owned, or no open work).';
    rerender();
    flashMessage('standupMsg', 5000);
  },
  onToggleStandupQueue: async (kind, itemId, discussantIds) => {
    const queued = await Standup.toggleStandupQueue(state, kind, itemId, discussantIds);
    const key = `${kind}:${itemId}`;
    if(!state.workNotesExpanded) state.workNotesExpanded = new Set();
    if(queued) state.workNotesExpanded.add(key);
    else state.workNotesExpanded.delete(key);
    rerender();
  },
  onToggleWorkNotes: (kind, itemId) => {
    if(!state.workNotesExpanded) state.workNotesExpanded = new Set();
    const key = `${kind}:${itemId}`;
    if(state.workNotesExpanded.has(key)) state.workNotesExpanded.delete(key);
    else state.workNotesExpanded.add(key);
    rerender();
  },
  onRemoveDiscussion: async (discussionId) => { await Standup.removeDiscussion(state, discussionId); rerender(); },
  onDiscussionNote: async (discussionId, note) => { await Standup.setDiscussionNote(state, discussionId, note); },
  onDiscussionDiscussants: async (discussionId, ids) => { await Standup.setDiscussionDiscussants(state, discussionId, ids); },
  onToggleDiscussant: async (discussionId, memberId) => { await Standup.toggleDiscussionDiscussant(state, discussionId, memberId); rerender(); },
  onToggleStoryGroup: async (storyId, groupId) => { await UserStories.toggleStoryGroup(state, storyId, groupId); rerender(); },
  onDraftStoryGroup: (groupId) => {
    if(state.modal && state.modal.memberId){
      UserStories.toggleStoryGroup(state, state.modal.memberId, groupId).then(rerender);
      return;
    }
    const ids = new Set(state.userStoryDraft.groupIds || []);
    if(ids.has(groupId)) ids.delete(groupId); else ids.add(groupId);
    state.userStoryDraft.groupIds = [...ids];
    rerender();
  },
  onStoryOngoingNote: async (id, note) => { await UserStories.setOngoingNote(state, id, note); },
  onStoryProgressNote: async (id, note) => { await UserStories.setProgressNote(state, id, state.dateStr, note); },
  onStoryTestCount: async (id, field, value) => {
    const us = state.userStories.find(u => u.id === id);
    const current = us ? (us.testCounts && us.testCounts[state.dateStr]) || {} : {};
    await UserStories.setTestCounts(state, id, state.dateStr, {...current, [field]: value});
  },
  onDefectDayNote: async (id, note) => {
    const d = state.defects.find(x => x.id === id);
    const testers = d ? Defects.effectiveTesterIds(state, d, state.dateStr) : [];
    await Defects.setDayActivity(state, id, state.dateStr, {note, testerIds: testers});
  },
  onToggleDefectTester: async (id, memberId) => { await Defects.toggleDayTester(state, id, state.dateStr, memberId); rerender(); },
  onSetAlternateTester: async (id, memberId) => { await Defects.setAlternateTester(state, id, state.dateStr, memberId); rerender(); },
  onToggleAdoSyncType: (type) => {
    if(!state.adoSyncTypes) state.adoSyncTypes = {userStory: true, defect: true, task: true};
    if(!(type in state.adoSyncTypes)) return;
    const next = {...state.adoSyncTypes, [type]: !state.adoSyncTypes[type]};
    if(!next.userStory && !next.defect && !next.task) return;
    state.adoSyncTypes = next;
    rerender();
  },
  onAssignReleaseConnection: async (releaseId, connectionId) => {
    const r = state.releases.find(x => x.id === releaseId);
    if(!r) return;
    await Releases.updateRelease(state, releaseId, r.name, r.targetDate, r.iterationPath, connectionId);
    rerender();
  },

  // ---- Release Testing view — separate from the daily board, organized
  // by release rather than by date. ----
  // Every navigation — switching tabs or switching release — clears the
  // Defects tag filter. A tag selected in one visit (or under one release)
  // may not exist under another, and leaving it applied silently hid
  // results with no visible indication why.
  onSwitchView: (view) => {
    state.view = view;
    state.selectedDefectTag = null;
    closeAllPopovers();
    rerender('full');
  },
  onSelectRelease: (id) => {
    state.selectedReleaseId = id || null;
    state.selectedDefectTag = null;
    // '' = All releases (explicit); a concrete id sticks across reloads.
    state.settings.selectedReleaseId = id || '';
    saveSettings(state.settings);
    rerender();
  },
  onSelectDefectTag: (tag) => { state.selectedDefectTag = tag || null; rerender(); },
  onSetPeopleReviewPeriod: (period) => {
    state.peopleReviewPeriod = period === 'quarter' || period === 'year' ? period : 'month';
    state.peopleReviewWarn = '';
    state.peopleReviewMsg = '';
    rerender();
  },
  onDraftAppreciation: async (memberId) => {
    await draftAppreciationEmail(state, memberId, state.peopleReviewPeriod || 'month');
    rerender();
    flashMessage('peopleReviewMsg', 8000);
  },
  onDraftAppreciationAll: async () => {
    await draftAppreciationEmailAll(state, state.peopleReviewPeriod || 'month');
    rerender();
    flashMessage('peopleReviewMsg', 10000);
  },
  onAiAssistChange: (field, value) => {
    if(!state.settings.aiAssist){
      state.settings.aiAssist = {provider:'openai', endpoint:'', apiKey:'', model:'gpt-4o-mini'};
    }
    if(field === 'provider'){
      const next = defaultsForProvider(value);
      state.settings.aiAssist.provider = next.provider;
      state.settings.aiAssist.endpoint = next.endpoint;
      state.settings.aiAssist.model = next.model;
      // Keep existing apiKey — user may already have pasted one.
    }else{
      state.settings.aiAssist[field] = value;
    }
    saveSettings(state.settings);
    if(field === 'provider') rerender();
  },
  onSummarizeDaySignals: async () => {
    state.boardInsightsOpen = true;
    await summarizeDaySignals(state);
    rerender();
  },
  onDraftStandupHighlights: async () => {
    const result = await draftStandupHighlights(state);
    if(result.ok && result.text){
      await Standup.setStandupHighlights(state, result.text);
      state.aiAssistMsg = '';
      state.standupMsg = 'Standup highlights filled from today — edit before sending. Nothing was emailed.';
      flashMessage('standupMsg', 5000);
    }
    rerender();
  },
  onDraftQaHighlights: async () => {
    const result = await draftQaHighlights(state);
    if(result.ok){
      const draft = captureQaStatusForm(state);
      const parsed = result.parsed || {highlights: result.text, lowlights: ''};
      draft.highlights = parsed.highlights || draft.highlights;
      if(parsed.lowlights) draft.lowlights = parsed.lowlights;
      await persistQaStatusDraft(state, draft);
      state.qaStatusMsg = 'QA highlights filled from today — edit before sending. Nothing was emailed.';
      state.aiAssistMsg = '';
    }
    rerender();
    if(state.qaStatusMsg) flashMessage('qaStatusMsg', 5000);
  },
  onToggleSidebar: () => {
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    saveSettings(state.settings);
    rerender('shell');
  },
  onPrintPage: () => { window.print(); },
  onApplySavedView: (kind, viewId) => {
    const id = viewId || '';
    if(kind === 'defects'){
      state.selectedDefectViewId = id;
      state.settings.lastDefectViewId = id;
    }else{
      state.selectedStoryViewId = id;
      state.settings.lastStoryViewId = id;
    }
    saveSettings(state.settings);
    rerender();
  },
  onOpenCommandPalette: () => {
    modalCloseToken++;
    closeAllPopovers();
    state.commandPaletteQuery = '';
    state.modal = {type: 'commandPalette', memberId: null, returnTo: null};
    rerender();
  },
  onCommandPaletteQuery: (value) => { state.commandPaletteQuery = value; scheduleSoftRender('modal'); },
  onCommandGo: (action, id) => {
    state.modal = null;
    state.commandPaletteQuery = '';
    if(action === 'switch-view') handlers.onSwitchView(id);
    else if(action === 'open-settings') handlers.onOpenModal('settings', null);
    else if(action === 'open-people') handlers.onOpenModal('people', null);
    else if(action === 'open-groups') handlers.onOpenModal('groups', null);
    else if(action === 'open-new-task') handlers.onOpenModal('newTask', null);
    else if(action === 'open-qa-status') handlers.onOpenQaStatus();
    else if(action === 'open-board-email') handlers.onOpenModal('boardEmail', null);
    else rerender();
  },
  onQaStoryChange: async (userStoryId) => {
    const prevId = state.qaStatusDraft && state.qaStatusDraft.userStoryId;
    const draft = captureQaStatusForm(state);
    if(prevId && prevId !== userStoryId){
      await UserStories.setTestCounts(state, prevId, state.dateStr, {
        planned: draft.planned, executed: draft.executed, pass: draft.pass, fail: draft.fail, blocked: draft.blocked
      });
    }
    draft.userStoryId = userStoryId;
    state.qaStatusDraft = applyStoryCountsToDraft(state, draft);
    rerender();
  },
  onStandupHighlightsChange: async (value) => {
    await Standup.setStandupHighlights(state, value);
  },
  // Separate from onOpenModal's generic reset since it needs to pre-fill
  // which User Story the new Defect belongs to (the "+ Defect" button on
  // a specific User Story row), not just reset to empty.
  onOpenAddDefect: (userStoryId) => {
    state.defectDraft = {title:'', userStoryId: userStoryId || '', severity:'medium', assigneeId:'', iterationPath:''};
    closeAllPopovers();
    state.modal = {type:'addDefect', memberId:null, returnTo:null};
    rerender();
  },

  onSaveRelease: async (id, name, targetDate, iterationPath, connectionId) => {
    const ok = id
      ? await Releases.updateRelease(state, id, name, targetDate, iterationPath, connectionId)
      : await Releases.addRelease(state, name, targetDate, iterationPath, connectionId);
    if(ok){
      if(!id) state.releaseDraft = {name:'', targetDate:'', iterationPath:'', connectionId:''};
      state.settings.selectedReleaseId = state.selectedReleaseId;
      await saveSettings(state.settings);
      state.modal = null;
    }
    rerender();
  },
  // One click arms the delete (and un-arms anything else armed), the second
  // click within 3s actually deletes and closes the modal — same
  // click-again-to-confirm pattern as a task card's delete button, since
  // this also unlinks any User Stories/tasks pointed at the release.
  onRemoveRelease: (id) => {
    if(state.deleteArmedIds.has(id)){
      state.deleteArmedIds.delete(id);
      Releases.removeRelease(state, id).then(async () => {
        state.settings.selectedReleaseId = state.selectedReleaseId;
        await saveSettings(state.settings);
        state.modal = null;
        rerender();
      });
    }else{
      state.deleteArmedIds.clear();
      state.deleteArmedIds.add(id);
      rerender();
      setTimeout(() => {
        if(state.deleteArmedIds.has(id)){ state.deleteArmedIds.delete(id); rerender(); }
      }, 3000);
    }
  },

  onSaveUserStory: async (id, title, releaseId, assigneeId, iterationPath, groupIds) => {
    const ok = id
      ? await UserStories.updateUserStory(state, id, {title, releaseId, assigneeId, iterationPath, groupIds})
      : await UserStories.addUserStory(state, {title, releaseId, assigneeId, iterationPath, groupIds});
    if(ok){
      if(!id) state.userStoryDraft = {title:'', releaseId:'', assigneeId:'', iterationPath:'', groupIds:[]};
      state.modal = null;
    }
    rerender();
  },
  onRemoveUserStory: async (id) => { await UserStories.removeUserStory(state, id); rerender(); },
  onSetUserStoryStatus: async (id, status) => { await UserStories.setStatus(state, id, status); rerender(); },

  onSaveDefect: async (id, title, userStoryId, severity, assigneeId, iterationPath) => {
    let ok;
    if(id){
      ok = await Defects.updateDefect(state, id, {title, severity, assigneeId, iterationPath});
      if(ok) await Defects.linkToUserStory(state, id, userStoryId);
    }else{
      ok = await Defects.addDefect(state, {title, userStoryId, severity, assigneeId, iterationPath});
    }
    if(ok){
      if(!id) state.defectDraft = {title:'', userStoryId:'', severity:'medium', assigneeId:'', iterationPath:''};
      state.modal = null;
    }
    rerender();
  },
  onRemoveDefect: async (id) => { await Defects.removeDefect(state, id); rerender(); },
  onLinkDefectToUserStory: async (defectId, userStoryId) => { await Defects.linkToUserStory(state, defectId, userStoryId); rerender(); },
  onSetDefectStatus: async (id, status) => { await Defects.setStatus(state, id, status); rerender(); },

  // Opens straight into an Outlook draft with the To field blank — recipients
  // get typed there, not here, per the user's own workflow.
  onSendDefectsEmail: async () => {
    await sendDefectsEmail(state);
    rerender();
  },
  // Recipient defaults to the manager email already on file (see
  // dashboardEmail.js) — no prompt, matching the other one-click sends here.
  onSendDashboardEmail: async () => {
    await sendDashboardEmail(state);
    rerender();
  },

  onSaveAdoConnection: async (id, name, org, project, pat, workItemTypes) => {
    const ok = id
      ? await AdoConnections.updateAdoConnection(state, id, name, org, project, pat, workItemTypes)
      : await AdoConnections.addAdoConnection(state, name, org, project, pat, workItemTypes);
    if(ok){
      if(!id) state.adoConnectionDraft = {name:'', org:'', project:'', pat:'', workItemTypes:{userStory:'User Story', defect:'Bug', task:'Task'}};
      state.modal = state.modal && state.modal.returnTo ? {type: state.modal.returnTo} : null;
    }
    rerender();
  },
  // Same click-again-to-confirm pattern as onRemoveRelease — deleting a
  // connection silently unassigns any release pointed at it. Called both
  // from a row in the "Manage connections" list (stays open, row just
  // disappears) and from the single-connection edit form's own delete
  // button (hands back to the list it came from, like a save would).
  onRemoveAdoConnection: (id) => {
    if(state.deleteArmedIds.has(id)){
      state.deleteArmedIds.delete(id);
      AdoConnections.removeAdoConnection(state, id).then(() => {
        if(state.modal && state.modal.type === 'adoConnectionForm' && state.modal.memberId === id){
          state.modal = state.modal.returnTo ? {type: state.modal.returnTo} : null;
        }
        rerender();
      });
    }else{
      state.deleteArmedIds.clear();
      state.deleteArmedIds.add(id);
      rerender();
      setTimeout(() => {
        if(state.deleteArmedIds.has(id)){ state.deleteArmedIds.delete(id); rerender(); }
      }, 3000);
    }
  },

  onSaveBlueprintItem: async (id, title, time, priority) => {
    const ok = id
      ? await Blueprint.updateBlueprintItem(state, id, title, time, priority)
      : await Blueprint.addBlueprintItem(state, title, time, priority);
    if(ok){
      if(!id) state.blueprintItemDraft = {title:'', time:'', priority:'medium'};
      state.modal = state.modal && state.modal.returnTo ? {type: state.modal.returnTo} : null;
    }
    rerender();
  },
  onRemoveBlueprintItem: async (id) => { await Blueprint.removeBlueprintItem(state, id); rerender(); },

  onSyncFromAdo: async () => {
    await syncFromADO(state);
    rerender();
    flashMessage('adoSyncMsg', 8000);
  },

  onExportBackup: async () => { await exportData(state); rerender('shell'); },
  onImportBackup: async (file) => {
    const ok = confirm('Importing will overwrite your current team, groups, and settings, and add/overwrite tasks for any dates in this file. Continue?');
    if(!ok) return;
    try{
      await importData(state, file);
      state.csvMsg = 'Backup imported.';
    }catch(e){
      state.csvMsg = e.message || 'Import failed — that file could not be read.';
    }
    rerender();
    flashMessage('csvMsg', 7000);
  },

  onExportTasksCSV: () => { exportTasksCSV(state); },
  onImportTasksCSV: async (file) => {
    const result = await importTasksCSV(state, file);
    if(result.error){
      state.csvMsg = result.error;
    }else{
      const parts = [`Added ${result.added} task${result.added===1?'':'s'}.`];
      if(result.skipped) parts.push(`Skipped ${result.skipped} (already on that day, or missing a date/title).`);
      if(result.unmatchedNames.length) parts.push(`Didn't recognize: ${result.unmatchedNames.join(', ')}.`);
      state.csvMsg = parts.join(' ');
    }
    rerender();
    flashMessage('csvMsg', 7000);
  },

  onClearDay: () => {
    if(state.clearArmed){
      Tasks.clearDay(state).then(rerender);
    }else{
      state.clearArmed = true; rerender();
      setTimeout(() => { if(state.clearArmed){ state.clearArmed = false; rerender(); } }, 3000);
    }
  }
};

(async function init(){
  state.tasks = await loadTasks(state.dateStr);
  state.yesterdayTasks = await loadTasks(shiftDate(state.dateStr, -1));
  state.settings = await loadSettings();
  // loadSettings migrates an old single `ado` connection into
  // `adoConnections` in memory on every load but never persists that
  // itself — write it back once so the migration actually completes
  // instead of silently re-running from the old shape on every reload.
  await saveSettings(state.settings);
  state.team = await loadTeam();
  state.groups = await loadGroups();
  state.standup = await loadStandup(state.dateStr);
  state.releases = await loadReleases();
  state.userStories = await loadUserStories();
  state.defects = await loadDefects();
  state.blueprintSchedule = await loadBlueprintSchedule();
  // '' = explicit All releases; a concrete id restores that release;
  // null/missing falls back to the first release so Stories/ADO stay usable.
  const savedReleaseId = state.settings.selectedReleaseId;
  if(savedReleaseId === ''){
    state.selectedReleaseId = null;
  }else if(savedReleaseId && state.releases.some(r => r.id === savedReleaseId)){
    state.selectedReleaseId = savedReleaseId;
  }else if(state.releases.length){
    state.selectedReleaseId = state.releases[0].id;
    state.settings.selectedReleaseId = state.selectedReleaseId;
    await saveSettings(state.settings);
  }else{
    state.selectedReleaseId = null;
  }
  state.selectedDefectViewId = state.settings.lastDefectViewId || '';
  state.selectedStoryViewId = state.settings.lastStoryViewId || '';
  rerender();
})();
