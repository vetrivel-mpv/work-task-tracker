// Pure(ish) DOM rendering. Takes state + a handlers object (event callbacks
// supplied by app.js) and never imports the task/email/storage modules
// directly, so there's no circular dependency between render and the logic
// it triggers.
//
// Interaction model: most floating UI (priority dropdown, assignee picker,
// standup person picker, modals) is driven by `data-action` + `data-id`
// attributes read once by the generic dispatcher in attachEvents(). A
// single document-level click/keydown listener (bound once, see
// bindGlobalListeners) closes whichever popover/modal is open when the
// user clicks outside it or presses Escape.

import { PRIORITIES, LABELS, PRIORITY_TEXT, EMPTY_MSG, STATUS_LABELS, SEVERITIES, SEVERITY_LABELS, defectReleaseId, userStoryReleaseId, resolveAdoConnection, isResolvedState, avatarColor, initials, formatDisplay, formatTime12, isToday, shiftDate, toDateStr, APP_NAME, APP_TAGLINE, workNotesKey, findMemberByIdentity } from './state.js';
import { normalizeStandup, STANDUP_META_KEY, memberStandupEntry, memberHasStandupNotes } from './standupShape.js';
import { computePeopleReviews } from './peopleReviews.js';
import { aiSettingsFrom, isAiConfigured, AI_PROVIDER_PRESETS } from './aiAssist.js';
import { daySignalsSnapshot } from './standupEmail.js';
import { QA_STATUS_OPTIONS, formatQaSubjectDate, storyUsLabel } from './qaStatusEmail.js';
import { isAbsent, effectiveAbsenceIds, isOooOnDate } from './standup.js';
import {
  testCountsFor, storiesMissingTodayNote, testerLoadRows, defectFlowStats, scopedDefects,
  scopedUserStories, discussionInRelease, defectMatchesSavedView, storyMatchesSavedView, shouldRemindBackup, DEFAULT_DEFECT_VIEWS, DEFAULT_STORY_VIEWS
} from './opsHelpers.js';

const GROUP_ICON_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none"><circle cx="8" cy="9" r="3.2" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="9" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3 19c.6-3 2.6-5 5-5s4.4 2 5 5M11 19c.6-3 2.6-5 5-5s4.4 2 5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

function renderRing(pct){
  const r = 16, c = 2*Math.PI*r, off = c - (pct/100)*c;
  return `<svg class="ring" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="${r}" fill="none" stroke="var(--border)" stroke-width="4"/>
    <circle cx="20" cy="20" r="${r}" fill="none" stroke="var(--accent)" stroke-width="4"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 20 20)"/>
  </svg>`;
}

export function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function avatarHTML(member, idx, extraClass){
  return `<span class="avatar ${extraClass||''}" style="--avatar-color:${avatarColor(idx)}" title="${escapeHtml(member.name)}${member.role ? ` — ${escapeHtml(member.role)}` : ''}">${escapeHtml(initials(member.name))}</span>`;
}

function timeGreeting(){
  const h = new Date().getHours();
  if(h < 12) return 'Good morning';
  if(h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name){
  const n = String(name || '').trim();
  if(!n) return '';
  return n.split(/\s+/)[0];
}

function todayLongDate(){
  return new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'});
}

function pageIntroHTML(kicker, title, sub){
  return `
  <div class="page-intro page-greeting">
    <p class="page-kicker">${kicker}</p>
    <h2 class="page-title">${title}</h2>
    ${sub ? `<p class="page-sub">${sub}</p>` : ''}
  </div>`;
}

function emptyStateHTML(title, hint){
  return `<div class="empty empty-state"><strong>${title}</strong>${hint ? `<span>${hint}</span>` : ''}</div>`;
}

function statTile(cls, value, label){
  return `<div class="stat-tile ${cls}"><strong>${value}</strong><span>${label}</span></div>`;
}

function metricCardHTML({label, value, sub, tone, icon}){
  return `
  <div class="metric-card ${tone || ''}">
    <div class="metric-card-body">
      <span class="metric-label">${label}</span>
      <strong class="metric-value">${value}</strong>
      ${sub ? `<span class="metric-sub">${sub}</span>` : ''}
    </div>
    <div class="metric-icon" aria-hidden="true">${icon}</div>
  </div>`;
}

const METRIC_ICONS = {
  progress: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2" stroke-linecap="round"/></svg>`,
  complete: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  partial: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 12 L12 4 A8 8 0 0 1 20 12 Z" fill="currentColor" stroke="none" opacity=".35"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v5" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/></svg>`,
  total: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5" stroke-linecap="round"/></svg>`
};

function boardProgressHTML(state){
  const total = state.tasks.length;
  const complete = state.tasks.filter(t => t.status === 'complete').length;
  const partial = state.tasks.filter(t => t.status === 'partial').length;
  const pending = total - complete - partial;
  const pct = total ? Math.round(((complete + partial * 0.5) / total) * 100) : 0;

  return `
  <div class="metric-row" aria-label="Day progress">
    ${metricCardHTML({label: "Today's progress", value: `${pct}%`, sub: total ? `${complete} of ${total} finished` : 'No tasks yet', tone: 'tone-accent', icon: METRIC_ICONS.progress})}
    ${metricCardHTML({label: 'Complete', value: complete, sub: 'Done today', tone: 'tone-complete', icon: METRIC_ICONS.complete})}
    ${metricCardHTML({label: 'Partial', value: partial, sub: 'In motion', tone: 'tone-partial', icon: METRIC_ICONS.partial})}
    ${metricCardHTML({label: 'Open', value: pending, sub: `${total} total on board`, tone: 'tone-pending', icon: METRIC_ICONS.pending})}
  </div>`;
}

const NAV_ICONS = {
  board: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="13" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/></svg>`,
  userStories: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4h10a2 2 0 0 1 2 2v14l-3.5-2-3.5 2-3.5-2L5 20V6a2 2 0 0 1 2-2z" stroke-linejoin="round"/><path d="M9 9h6M9 13h4" stroke-linecap="round"/></svg>`,
  defects: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 8v5" stroke-linecap="round"/><circle cx="12" cy="16.2" r="1" fill="currentColor" stroke="none"/></svg>`,
  defectsDashboard: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19V5M4 19h16" stroke-linecap="round"/><rect x="7" y="10" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="9" rx="1"/><rect x="17" y="12" width="3" height="4" rx="1"/></svg>`,
  peopleReview: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c.7-3.2 3-5 6-5s5.3 1.8 6 5M14 19c.4-2 1.8-3.2 3.5-3.5 1.5.2 2.7 1.2 3.2 3.5" stroke-linecap="round"/></svg>`,
  adoSync: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" stroke-linecap="round"/><rect x="9" y="3" width="12" height="12" rx="2"/><path d="M13 9h4M15 7v4" stroke-linecap="round"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" stroke-linecap="round"/></svg>`
};

const VIEW_NAV = [
  {id: 'board', label: 'Board'},
  {id: 'userStories', label: 'User stories'},
  {id: 'defects', label: 'Defects'},
  {id: 'defectsDashboard', label: 'Dashboard'},
  {id: 'peopleReview', label: 'People review'},
  {id: 'adoSync', label: 'ADO sync'}
];

const VIEW_TITLES = {
  board: 'Board',
  userStories: 'User stories',
  defects: 'Defects',
  defectsDashboard: 'Dashboard',
  adoSync: 'ADO sync',
  peopleReview: 'People review'
};

/* ---------------------------------------------------------------------- */
/* Priority dropdown & assignee picker — both are just compact triggers   */
/* here. Their menus/popovers render through a single floating "portal"   */
/* (see floatingPopoverHTML) instead of nesting inside the trigger, so     */
/* they can never be clipped by a card/lane's overflow or lose a z-index   */
/* fight against the next glass card (backdrop-filter creates a new       */
/* stacking context per card, which silently defeats a locally-scoped     */
/* z-index — this bit both of us before).                                 */
/* ---------------------------------------------------------------------- */

function priorityTriggerHTML(state, forId, currentPriority){
  const isOpen = state.priorityDropdownFor === forId;
  return `<button class="pd-trigger ${isOpen?'open':''}" data-action="toggle-priority-dd" data-id="${forId}">
    <span class="pd-dot ${currentPriority}"></span>
    <span class="pd-current">${PRIORITY_TEXT[currentPriority]}</span>
    <span class="pd-chevron">⌄</span>
  </button>`;
}

function priorityMenuBodyHTML(forId, currentPriority){
  return PRIORITIES.map(p => `
    <button class="pd-option ${p===currentPriority?'sel':''}" data-action="choose-priority" data-id="${forId}" data-p="${p}">
      <span class="pd-dot ${p}"></span>${PRIORITY_TEXT[p]}
    </button>`).join('');
}

// Resolves the priority/assignee context for a floating-popover forId,
// whether it's a real task on the board or the 'new' New Task draft.
function priorityFor(state, forId){
  if(forId === 'new') return state.newPriority;
  const t = state.tasks.find(t => t.id === forId);
  return t ? t.priority : 'medium';
}
function assignContextFor(state, forId){
  if(forId === 'new'){
    return {
      selectedMemberIds: [...state.newTaskAssigneeIds],
      selectedGroupIds: [...state.newTaskGroupIds],
      personAction: 'new-task-assignee',
      groupAction: 'new-task-group'
    };
  }
  const t = state.tasks.find(t => t.id === forId);
  return {
    selectedMemberIds: t ? (t.assignees || []) : [],
    selectedGroupIds: t ? (t.assignedGroups || []) : [],
    personAction: 'assign',
    groupAction: 'assign-group'
  };
}

/* Searchable assignee/group picker — scales to a large roster instead of
   showing every person as an always-visible pill. */

function assignTriggerHTML(state, forId, selectedMemberIds, selectedGroupIds){
  const open = state.assignPickerFor === forId;
  const members = selectedMemberIds.map(id => state.team.find(m => m.id === id)).filter(Boolean);
  const groups = selectedGroupIds.map(id => state.groups.find(g => g.id === id)).filter(Boolean);
  const total = members.length + groups.length;
  let inner;
  if(!total){
    inner = `<span class="assign-trigger-empty">+ Assign</span>`;
  }else{
    const shown = members.slice(0, 3).map(m => avatarHTML(m, state.team.findIndex(x => x.id === m.id), 'sm')).join('');
    const overflow = members.length > 3 ? `<span class="assign-overflow">+${members.length - 3}</span>` : '';
    const groupBits = groups.length ? `<span class="group-badge sm">${GROUP_ICON_SVG}<span>${groups.length===1?escapeHtml(groups[0].name):groups.length+' groups'}</span></span>` : '';
    inner = `<span class="assign-trigger-avatars">${shown}</span>${overflow}${groupBits}`;
  }
  return `<button class="assign-trigger ${open?'open':''}" data-action="toggle-assign-picker" data-id="${forId}">${inner}</button>`;
}

function assignPopoverBodyHTML(state, forId, selectedMemberIds, selectedGroupIds, personAction, groupAction){
  const q = state.assignPickerQuery.trim().toLowerCase();
  const people = state.team.filter(m => !q || m.name.toLowerCase().includes(q) || (m.role||'').toLowerCase().includes(q));
  const groups = state.groups.filter(g => !q || g.name.toLowerCase().includes(q));
  const peopleRows = people.map(m => {
    const idx = state.team.indexOf(m);
    const sel = selectedMemberIds.includes(m.id);
    return `<button class="picker-row ${sel?'sel':''}" data-action="${personAction}" data-id="${forId}" data-member="${m.id}">
      ${avatarHTML(m, idx, 'sm')}
      <span class="picker-row-label"><strong>${escapeHtml(m.name)}</strong>${m.role?`<span>${escapeHtml(m.role)}</span>`:''}</span>
      <span class="picker-check">${sel?'✓':''}</span>
    </button>`;
  }).join('');
  const groupRows = groups.map(g => {
    const sel = selectedGroupIds.includes(g.id);
    return `<button class="picker-row ${sel?'sel':''}" data-action="${groupAction}" data-id="${forId}" data-group="${g.id}">
      <span class="group-badge">${GROUP_ICON_SVG}</span>
      <span class="picker-row-label"><strong>${escapeHtml(g.name)}</strong></span>
      <span class="picker-check">${sel?'✓':''}</span>
    </button>`;
  }).join('');
  const nothingFound = !people.length && !groups.length && (state.team.length || state.groups.length);
  const nothingAtAll = !state.team.length && !state.groups.length;
  return `
    <input type="text" class="picker-search" data-role="assign-search" placeholder="Search people or groups…" value="${escapeHtml(state.assignPickerQuery)}">
    <div class="picker-list">
      ${peopleRows}
      ${groups.length ? `<div class="picker-divider">Groups</div>${groupRows}` : ''}
      ${nothingFound ? `<div class="picker-empty">No matches</div>` : ''}
      ${nothingAtAll ? `<div class="picker-empty">Add teammates in the sidebar first</div>` : ''}
    </div>
    <button class="picker-done" data-action="close-picker">Done</button>
  `;
}

function assignedSummaryHTML(state, t){
  const members = (t.assignees || []).map(id => state.team.find(m => m.id === id)).filter(Boolean);
  const groups = (t.assignedGroups || []).map(id => state.groups.find(g => g.id === id)).filter(Boolean);
  if(!members.length && !groups.length) return '';
  const memberBadges = members.map(m => avatarHTML(m, state.team.findIndex(x => x.id === m.id), 'sm')).join('');
  const groupBadges = groups.map(g => `<span class="group-badge sm" title="${escapeHtml(g.name)}">${GROUP_ICON_SVG}<span>${escapeHtml(g.name)}</span></span>`).join('');
  return `<span class="assigned-avatars">${memberBadges}${groupBadges}</span>`;
}

function releaseTagHTML(state, releaseId){
  if(!releaseId) return '';
  const r = state.releases.find(r => r.id === releaseId);
  return r ? `<span class="release-tag">${escapeHtml(r.name)}</span>` : '';
}

// A plain <select> rather than a searchable popover (like assignees use) —
// releases are a short, curated list, so a native select is enough. Hidden
// entirely until at least one release exists, so this stays invisible to
// anyone not using the Release Testing feature.
function releasePickerHTML(state, forId, currentReleaseId){
  if(!state.releases.length) return '';
  const options = state.releases.map(r => `<option value="${r.id}" ${currentReleaseId===r.id?'selected':''}>${escapeHtml(r.name)}</option>`).join('');
  return `<select class="task-release-select" data-id="${forId}"><option value="">No release</option>${options}</select>`;
}

/* ---------------------------------------------------------------------- */
/* Task cards / lanes                                                     */
/* ---------------------------------------------------------------------- */

function taskCardHTML(state, t, idx, groupLength, priority){
  const commentOpen = state.openCommentIds.has(t.id);
  const editing = state.editingTaskId === t.id;
  const deleteArmed = state.deleteArmedIds.has(t.id);
  return `
  <div class="card glass-card ${priority} status-${t.status}" data-task-id="${t.id}">
    <div class="card-row-main">
      <button class="status-ctrl ${t.status}" data-action="cycle" data-id="${t.id}" title="${STATUS_LABELS[t.status]} — click to update" aria-label="${STATUS_LABELS[t.status]}"></button>
      <div class="card-body">
        ${editing ? `
        <div class="card-edit-row">
          <input type="text" class="edit-title-input" data-id="${t.id}" value="${escapeHtml(t.title)}" maxlength="140">
          <input type="time" class="edit-time-input" data-id="${t.id}" value="${t.time||''}">
          <button class="mini-btn confirm" data-action="save-edit" data-id="${t.id}" title="Save">✓</button>
          <button class="mini-btn" data-action="cancel-edit" data-id="${t.id}" title="Cancel">✕</button>
        </div>
        ` : `
        <div class="card-title-row">
          <div class="card-title ${t.status==='complete'?'done':''}">${escapeHtml(t.title)}</div>
          <button class="edit-btn" data-action="edit-title" data-id="${t.id}" title="Edit task">✎</button>
          ${t.status!=='complete' ? `<span class="status-tag ${t.status}">${STATUS_LABELS[t.status]}</span>` : ''}
        </div>
        <div class="card-meta">
          ${t.time ? `<span class="card-time">${formatTime12(t.time)}</span>` : ''}
          ${t.source === 'manual' ? '<span class="src-tag">new</span>' : t.source === 'carried' ? '<span class="src-tag">carried</span>' : t.source === 'ado' ? '<span class="src-tag">ado</span>' : ''}
          ${t.adoId ? `<span class="ado-badge sm">#${t.adoId}</span>` : ''}
          ${releaseTagHTML(state, t.releaseId)}
          ${assignedSummaryHTML(state, t)}
        </div>
        ${taskParentLinkHTML(state, t)}
        ${createdByHTML(t.createdByName, t.createdByEmail)}
        ${iterationPathHTML(t.iterationPath)}
        `}
      </div>
      <button class="del-btn ${deleteArmed?'armed':''}" data-action="delete" data-id="${t.id}" title="${deleteArmed?'Click again to permanently delete':'Delete task'}">${deleteArmed?'Delete?':'✕'}</button>
    </div>

    <div class="card-row-controls">
      ${priorityTriggerHTML(state, t.id, t.priority)}
      ${assignTriggerHTML(state, t.id, t.assignees||[], t.assignedGroups||[])}
      <button class="comment-btn ${t.comment?'has-comment':''}" data-action="toggle-comment" data-id="${t.id}">
        ${t.comment ? 'Note ✓' : '+ Note'}
      </button>
      ${releasePickerHTML(state, t.id, t.releaseId)}
      <div class="reorder-btns">
        <button class="mini-btn" data-action="up" data-id="${t.id}" ${idx===0?'disabled':''} title="Move up">▲</button>
        <button class="mini-btn" data-action="down" data-id="${t.id}" ${idx===groupLength-1?'disabled':''} title="Move down">▼</button>
      </div>
    </div>
    ${commentPreviewHTML(t.latestComment)}

    ${commentOpen
      ? `<textarea class="comment-input" data-id="${t.id}" placeholder="Add context for your manager (optional)" maxlength="400">${escapeHtml(t.comment)}</textarea>`
      : (t.comment ? `<div class="comment-preview" data-action="toggle-comment" data-id="${t.id}">${escapeHtml(t.comment)}</div>` : '')}
  </div>`;
}

// A board synced from ADO can land hundreds of tasks in one lane (ADO items
// have no priority of their own, so a sync always tags them 'medium' — see
// adoSync.js) with no way to find one title among them. This is the filter
// that makes that navigable; matches title or an assignee's name.
function taskMatchesQuery(state, t, query){
  if(t.title.toLowerCase().includes(query)) return true;
  const assignees = (t.assignees || []).map(id => state.team.find(m => m.id === id)).filter(Boolean);
  return assignees.some(m => m.name.toLowerCase().includes(query));
}

function taskSearchBarHTML(state){
  const q = state.taskSearchQuery || '';
  return `
  <div class="task-search-bar">
    <svg class="task-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="var(--muted-2)" stroke-width="1.8"/><path d="M21 21l-4.3-4.3" stroke="var(--muted-2)" stroke-width="1.8" stroke-linecap="round"/></svg>
    <input type="text" id="taskSearchInput" placeholder="Filter by title or assignee…" maxlength="140" value="${escapeHtml(q)}" aria-label="Filter tasks">
    ${q ? `<button class="mini-btn" data-action="clear-task-search" title="Clear search">✕</button>` : ''}
  </div>`;
}

function laneHTML(state, priority){
  const query = (state.taskSearchQuery || '').trim().toLowerCase();
  const allTasks = state.tasks.filter(t => t.priority === priority).sort((a,b) => a.order - b.order);
  const tasks = query ? allTasks.filter(t => taskMatchesQuery(state, t, query)) : allTasks;
  const activeTasks = tasks.filter(t => t.status !== 'complete');
  const completeTasks = tasks.filter(t => t.status === 'complete');

  const activeCards = activeTasks.map((t, idx) => taskCardHTML(state, t, idx, activeTasks.length, priority)).join('');
  const completeCards = completeTasks.map((t, idx) => taskCardHTML(state, t, idx, completeTasks.length, priority)).join('');

  const complete = completeTasks.length;
  const partial = tasks.filter(t => t.status === 'partial').length;
  const pending = tasks.length - complete - partial;
  // A search result shouldn't stay hidden behind the accordion (only one
  // lane is normally expanded at a time) — any lane with a match opens for
  // as long as the search is active, on top of the normal single-lane state.
  const expanded = query ? tasks.length > 0 : state.expandedLane === priority;
  const completedOpen = state.completedOpenFor.has(priority);

  const completedStrip = complete ? `
    <div class="completed-group ${completedOpen?'open':''}">
      <button class="completed-toggle" data-action="toggle-completed" data-id="${priority}">
        <span class="completed-chevron">⌄</span>
        <span>${complete} completed</span>
      </button>
      <div class="completed-body">
        <div class="completed-body-inner">${completeCards}</div>
      </div>
    </div>` : '';

  let emptyHTML = '';
  if(!activeTasks.length){
    if(!allTasks.length) emptyHTML = emptyStateHTML(EMPTY_MSG[priority], 'Use New task or load the daily blueprint.');
    else if(query && !tasks.length) emptyHTML = emptyStateHTML('No matching tasks', `Nothing in ${LABELS[priority].toLowerCase()} for “${escapeHtml(state.taskSearchQuery.trim())}”.`);
    else if(!activeTasks.length && completeTasks.length) emptyHTML = '';
  }

  return `
  <section class="lane glass-card ${expanded?'expanded':''}" data-lane="${priority}">
    <button class="lane-head" data-action="toggle-lane" data-id="${priority}">
      <div class="flag ${priority}"></div>
      <h2>${LABELS[priority]}</h2>
      <div class="lane-stats">
        <span class="lane-stat pending">${pending} open</span>
        <span class="lane-stat partial">${partial} in progress</span>
        <span class="lane-stat complete">${complete} closed</span>
      </div>
      <span class="lane-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="lane-body">
      <div class="lane-body-inner">
        ${activeTasks.length ? activeCards : emptyHTML}
        ${completedStrip}
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------- */
/* People — compact sidebar tile (click to open) + full modal content.     */
/* Rendering every row inline in the sidebar doesn't scale past a handful  */
/* of people, so the sidebar only ever shows a preview; the searchable     */
/* full list lives in a floating modal instead.                            */
/* ---------------------------------------------------------------------- */

function peopleOpsChip(state){
  const count = state.team.length;
  const preview = state.team.slice(0, 4).map(m => avatarHTML(m, state.team.indexOf(m), 'sm')).join('');
  const overflow = count > 4 ? `<span class="assign-overflow">+${count - 4}</span>` : '';
  return `
  <button class="ops-chip" data-action="open-people" title="Manage people">
    <span class="ops-chip-label">People</span>
    ${count
      ? `<span class="ops-chip-preview">${preview}${overflow}</span>`
      : `<span class="ops-chip-empty">Add</span>`}
    <span class="summary-count">${count}</span>
  </button>`;
}

function peopleModalHTML(state){
  const q = state.peopleSearch.trim().toLowerCase();
  const filtered = state.team.filter(m => !q || m.name.toLowerCase().includes(q) || (m.role||'').toLowerCase().includes(q));
  const rows = filtered.map(m => {
    const idx = state.team.indexOf(m);
    const assigned = state.tasks.filter(t => Array.isArray(t.assignees) && t.assignees.includes(m.id));
    const complete = assigned.filter(t => t.status === 'complete').length;
    const partial = assigned.filter(t => t.status === 'partial').length;
    const pending = assigned.length - complete - partial;
    const pct = assigned.length ? Math.round(((complete + partial * 0.5) / assigned.length) * 100) : null;
    return `
    <div class="team-row">
      <div class="team-row-head">
        ${avatarHTML(m, idx)}
        <div class="roster-info">
          <strong>${escapeHtml(m.name)}</strong>
          ${m.role ? `<span>${escapeHtml(m.role)}</span>` : ''}
          ${m.email ? `<span>${escapeHtml(m.email)}</span>` : ''}
        </div>
        <div class="team-row-actions">
          <button class="icon-btn" data-action="edit-member" data-id="${m.id}" title="Edit teammate">✎</button>
          <button class="icon-btn danger" data-action="remove-member" data-id="${m.id}" title="Remove from roster and unassign from board tasks on every saved day">✕</button>
        </div>
      </div>
      <div class="align-bar"><div class="align-bar-fill" style="width:${pct===null?0:pct}%"></div></div>
      <div class="align-counts">${assigned.length} task${assigned.length===1?'':'s'} · ${complete} complete · ${partial} partial · ${pending} pending${pct!==null?` · ${pct}%`:''}</div>
    </div>`;
  }).join('');

  const unassignedCount = state.tasks.filter(t =>
    (!Array.isArray(t.assignees) || !t.assignees.length) &&
    (!Array.isArray(t.assignedGroups) || !t.assignedGroups.length)
  ).length;

  return `
  <div class="modal-head">
    <h2>People</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <p class="side-sub">Assign work, review progress, and keep roster details current.</p>
    ${state.team.length > 6 ? `<input type="text" class="picker-search" data-role="people-search" placeholder="Search people…" value="${escapeHtml(state.peopleSearch)}">` : ''}
    ${state.team.length
      ? `<div class="team-list modal-list">${rows || '<div class="picker-empty">No matches</div>'}</div>`
      : `<div class="empty small empty-state"><strong>No teammates yet</strong><span>Add someone to assign work and run standup.</span></div>`}
    ${state.team.length ? `<div class="align-unassigned">Unassigned: <strong>${unassignedCount}</strong> task${unassignedCount===1?'':'s'} today</div>` : ''}
    ${testerLoadStripHTML(state)}
  </div>
  <div class="modal-foot">
    <button class="add-btn" data-action="add-member">+ Add teammate</button>
  </div>`;
}

/* ---------------------------------------------------------------------- */
/* Groups — same compact-tile / floating-modal pattern as People.          */
/* ---------------------------------------------------------------------- */

function groupsOpsChip(state){
  const count = state.groups.length;
  const names = count
    ? state.groups.slice(0, 2).map(g => escapeHtml(g.name)).join(', ') + (count > 2 ? ` +${count - 2}` : '')
    : 'Add';
  return `
  <button class="ops-chip" data-action="open-groups" title="Manage groups">
    <span class="ops-chip-label">Groups</span>
    <span class="ops-chip-text">${names}</span>
    <span class="summary-count">${count}</span>
  </button>`;
}

function groupsModalHTML(state){
  const storyCountFor = (groupId) => state.userStories.filter(us => Array.isArray(us.groupIds) && us.groupIds.includes(groupId)).length;
  const rows = state.groups.map(g => {
    const members = (g.memberIds || [])
      .map(id => state.team.find(m => m.id === id))
      .filter(Boolean);
    const memberChips = members.map(m => {
      const idx = state.team.indexOf(m);
      return `<span class="group-member-pill" title="${escapeHtml(m.name)}">${avatarHTML(m, idx, 'sm')}<span>${escapeHtml(m.name.split(' ')[0])}</span></span>`;
    }).join('');
    const toggles = state.team.map((m, idx) => {
      const sel = Array.isArray(g.memberIds) && g.memberIds.includes(m.id);
      return `<button class="avatar-chip ${sel?'sel':''}" style="--avatar-color:${avatarColor(idx)}" data-action="group-member" data-id="${g.id}" data-member="${m.id}" title="${escapeHtml(m.name)}${sel?' — in group':''}">${escapeHtml(initials(m.name))}</button>`;
    }).join('');
    const assigned = state.tasks.filter(t => Array.isArray(t.assignedGroups) && t.assignedGroups.includes(g.id));
    const complete = assigned.filter(t => t.status === 'complete').length;
    const partial = assigned.filter(t => t.status === 'partial').length;
    const pct = assigned.length ? Math.round(((complete + partial * 0.5) / assigned.length) * 100) : null;
    const stories = storyCountFor(g.id);
    return `
    <article class="group-card">
      <div class="group-card-head">
        <div class="group-card-title">
          <strong>${escapeHtml(g.name)}</strong>
          ${g.purpose ? `<p class="group-purpose">${escapeHtml(g.purpose)}</p>` : '<p class="group-purpose muted">No purpose set — add one for delegation context.</p>'}
        </div>
        <button class="roster-remove" data-action="remove-group" data-id="${g.id}" title="Remove group">✕</button>
      </div>
      <div class="group-card-stats">
        <span>${members.length} member${members.length===1?'':'s'}</span>
        <span>${assigned.length} board task${assigned.length===1?'':'s'}${pct!==null?` · ${pct}%`:''}</span>
        <span>${stories} stor${stories===1?'y':'ies'}</span>
      </div>
      ${members.length ? `<div class="group-member-row">${memberChips}</div>` : ''}
      <div class="field compact">
        <label>Purpose</label>
        <input type="text" class="group-purpose-input" data-id="${g.id}" placeholder="e.g. Owns regression & US testing for Release X" maxlength="400" value="${escapeHtml(g.purpose||'')}">
      </div>
      <div class="field compact">
        <label>Members</label>
        ${state.team.length ? `<div class="group-members">${toggles}</div>` : `<div class="empty small">Add teammates to build this group.</div>`}
      </div>
    </article>`;
  }).join('');

  const newGroupToggles = state.team.map((m, idx) => {
    const sel = state.newGroupMemberIds.has(m.id);
    return `<button class="avatar-chip ${sel?'sel':''}" style="--avatar-color:${avatarColor(idx)}" data-action="new-group-member" data-member="${m.id}" title="${escapeHtml(m.name)}">${escapeHtml(initials(m.name))}</button>`;
  }).join('');

  return `
  <div class="modal-head">
    <h2>Groups</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <p class="side-sub">Groups own multi-person User Stories and board work. When someone is absent, hand off to peers in the same group.</p>
    ${state.groups.length ? `<div class="group-list modal-list">${rows}</div>` : `<div class="empty small empty-state"><strong>No groups yet</strong><span>Create a group for shared story ownership and delegation.</span></div>`}
    ${state.team.length
      ? `<div class="group-add">
          <p class="row-label">New group</p>
          <input type="text" id="groupName" placeholder="Group name (e.g. QA Team)" maxlength="60" value="${escapeHtml(state.newGroupNameDraft)}">
          <input type="text" id="groupPurpose" placeholder="Purpose (optional)" maxlength="400" value="${escapeHtml(state.newGroupPurposeDraft)}">
          <div class="group-add-members">${newGroupToggles}</div>
          <button class="side-btn" id="addGroupBtn">Create group</button>
        </div>`
      : `<div class="empty small">Add teammates first to build a group.</div>`}
  </div>`;
}

/* ---------------------------------------------------------------------- */
/* Daily standup — person walkthrough + discussion + absences              */
/* ---------------------------------------------------------------------- */

function standupTaskLines(tasks){
  if(!tasks.length) return null;
  const icon = {complete:'✓', partial:'◐', pending:'○'};
  return tasks.map(t => `${icon[t.status] || '○'} ${t.title}`).join('\n');
}

function standupTodayItemsHTML(tasks){
  return `<div class="standup-today-list">${tasks.map(t => `
    <div class="standup-today-row">
      <button class="status-ctrl ${t.status}" data-action="cycle" data-id="${t.id}" title="${STATUS_LABELS[t.status]} — click to update" aria-label="${STATUS_LABELS[t.status]}"></button>
      <span class="standup-today-title">${escapeHtml(t.title)}</span>
    </div>`).join('')}</div>`;
}

function standupBoardFromHTML(body){
  return `
  <div class="standup-from-board">
    <div class="standup-from-board-head">
      <span class="standup-from-board-label">From board</span>
    </div>
    ${body}
  </div>`;
}

function activeStandupMember(state){
  const idx = state.team.findIndex(m => m.id === state.standupActiveMemberId);
  return idx === -1 ? {member: state.team[0], idx: 0} : {member: state.team[idx], idx};
}

function standupPersonSelectorHTML(state, activeMember, activeIdx){
  const open = state.standupPickerOpen;
  const prevId = activeIdx > 0 ? state.team[activeIdx-1].id : '';
  const nextId = activeIdx < state.team.length-1 ? state.team[activeIdx+1].id : '';
  const absent = isAbsent(state, activeMember.id);

  return `
  <div class="standup-person-picker" role="group" aria-label="Standup person">
    <button type="button" class="mini-btn" data-action="select-standup-person" data-member="${prevId}" ${!prevId?'disabled':''} title="Previous teammate" aria-label="Previous teammate">‹</button>
    <button type="button" class="standup-person-trigger ${open?'open':''} ${absent?'is-absent':''}" data-action="toggle-standup-picker" aria-haspopup="listbox" aria-expanded="${open?'true':'false'}" aria-label="Choose teammate for standup">
      ${avatarHTML(activeMember, activeIdx)}
      <span class="standup-person-info">
        <strong>${escapeHtml(activeMember.name)}${absent ? ' · Absent' : ''}</strong>
        ${activeMember.role?`<span>${escapeHtml(activeMember.role)}</span>`:''}
      </span>
      <span class="standup-person-count" aria-hidden="true">${activeIdx+1}/${state.team.length}</span>
      <span class="pd-chevron" aria-hidden="true">⌄</span>
    </button>
    <button type="button" class="mini-btn" data-action="select-standup-person" data-member="${nextId}" ${!nextId?'disabled':''} title="Next teammate" aria-label="Next teammate">›</button>
  </div>`;
}

function standupPersonPopoverBodyHTML(state){
  const activeMember = activeStandupMember(state).member;
  const q = state.standupPersonQuery.trim().toLowerCase();
  const filtered = state.team.filter(m => !q || m.name.toLowerCase().includes(q));
  const meta = normalizeStandup(state.standup)[STANDUP_META_KEY];
  const rows = filtered.map(m => {
    const idx = state.team.indexOf(m);
    const entry = memberStandupEntry(state.standup, m.id);
    const has = memberHasStandupNotes(entry);
    const absent = isAbsent(state, m.id);
    return `<button type="button" class="picker-row ${m.id===activeMember.id?'sel':''} ${absent?'is-absent':''}" data-action="select-standup-person" data-member="${m.id}" role="option" aria-selected="${m.id===activeMember.id?'true':'false'}">
      ${avatarHTML(m, idx, 'sm')}
      <span class="picker-row-label"><strong>${escapeHtml(m.name)}</strong>${m.role?`<span>${escapeHtml(m.role)}</span>`:''}</span>
      ${absent ? '<span class="standup-absent-tag">Out</span>' : has ? '<span class="picker-check" title="Has standup notes">✓</span>' : ''}
    </button>`;
  }).join('');
  return `
    <input type="text" class="picker-search" data-role="standup-search" placeholder="Search teammates…" value="${escapeHtml(state.standupPersonQuery)}" aria-label="Search teammates">
    <div class="picker-list" role="listbox" aria-label="Teammates">${rows || '<div class="picker-empty">No matches</div>'}</div>
  `;
}

function standupTaskLinkHTML(member, yTasks, tTasks, entry){
  const allTasks = [...tTasks, ...yTasks];
  if(!allTasks.length){
    return `
    <div class="field compact standup-linked-field">
      <div class="standup-field-head">
        <label>Linked task</label>
        <span class="standup-field-hint">Optional</span>
      </div>
      <div class="standup-readout muted"><em>No board tasks assigned to link.</em></div>
    </div>`;
  }
  const options = allTasks.map(t => `<option value="${t.id}" ${entry.linkedTaskId===t.id?'selected':''}>${escapeHtml(t.title)}</option>`).join('');
  return `
  <div class="field compact standup-linked-field">
    <div class="standup-field-head">
      <label for="standup-link-${member.id}">Linked task</label>
      <span class="standup-field-hint">Optional</span>
    </div>
    <select id="standup-link-${member.id}" class="standup-task-link" data-member="${member.id}" aria-label="Link standup to a board task">
      <option value="">None selected</option>
      ${options}
    </select>
  </div>`;
}

function standupAbsenceBarHTML(state, activeMember){
  const dayMarked = normalizeStandup(state.standup)[STANDUP_META_KEY].absences.includes(activeMember.id);
  const oooToday = isOooOnDate(activeMember, state.dateStr);
  const absent = dayMarked || oooToday;
  const peerGroups = state.groups.filter(g => Array.isArray(g.memberIds) && g.memberIds.includes(activeMember.id));
  const peers = new Set();
  peerGroups.forEach(g => (g.memberIds || []).forEach(id => { if(id !== activeMember.id) peers.add(id); }));
  const peerBtns = [...peers].slice(0, 4).map(id => {
    const m = state.team.find(t => t.id === id);
    if(!m) return '';
    return `<button type="button" class="side-btn sm standup-delegate-btn" data-action="delegate-to-peer" data-from="${activeMember.id}" data-member="${id}" title="Add ${escapeHtml(m.name)} as co-owner on ${escapeHtml(activeMember.name)}'s open tasks and stories — keeps ${escapeHtml(activeMember.name)} assigned">→ ${escapeHtml(m.name.split(' ')[0])}</button>`;
  }).join('');

  return `
  <div class="standup-absence-bar">
    <button type="button" class="standup-absent-toggle ${dayMarked?'on':''}" data-action="toggle-absence" data-member="${activeMember.id}">
      ${dayMarked ? 'Marked absent today' : 'Mark absent today'}
    </button>
    ${oooToday ? `<span class="standup-ooo-tag">OOO today</span>` : ''}
    ${absent && peerBtns ? `<div class="standup-delegate"><span class="row-label">Delegate to group peer</span>${peerBtns}</div>` : ''}
    ${absent && !peerBtns ? `<span class="standup-delegate-hint">Add ${escapeHtml(activeMember.name)} to a Group to suggest peers. Delegation adds the peer and keeps ${escapeHtml(activeMember.name)} assigned.</span>` : ''}
  </div>`;
}

function standupDiscussionHTML(state){
  const items = discussionInRelease(state);
  if(!items.length){
    return `
    <div class="standup-section">
      <div class="standup-section-head">
        <span class="row-label">Discussion queue</span>
        <span class="standup-section-meta">From Stories / Defects</span>
      </div>
      <div class="standup-readout muted"><em>Nothing queued — use “Standup” on a User Story or Defect.</em></div>
    </div>`;
  }
  const rows = items.map(d => {
    const item = d.kind === 'userStory'
      ? state.userStories.find(u => u.id === d.itemId)
      : state.defects.find(x => x.id === d.itemId);
    const title = item ? item.title : '(removed)';
    const adoId = item && item.adoId ? `#${item.adoId}` : '';
    const kindLabel = d.kind === 'userStory' ? 'Story' : 'Defect';
    const selected = new Set(d.discussantIds || []);
    const chips = state.team.map((m, idx) => {
      const sel = selected.has(m.id);
      return `<button type="button" class="avatar-chip discuss-chip ${sel?'sel':''}" style="--avatar-color:${avatarColor(idx)}" data-action="toggle-discussant" data-id="${d.id}" data-member="${m.id}" title="${escapeHtml(m.name)}${sel?' — discussing':''}" aria-pressed="${sel?'true':'false'}">${escapeHtml(initials(m.name))}</button>`;
    }).join('');
    const who = selected.size
      ? [...selected].map(id => state.team.find(m => m.id === id)?.name).filter(Boolean).join(', ')
      : 'No discussants yet';
    return `
    <div class="standup-discuss-row" data-discussion="${d.id}">
      <div class="standup-discuss-head">
        <span class="standup-kind-tag ${d.kind}">${kindLabel}</span>
        <div class="standup-discuss-title-wrap">
          ${adoId ? `<span class="standup-discuss-ado">${adoId}</span>` : ''}
          <strong class="standup-discuss-title">${escapeHtml(title)}</strong>
        </div>
        <button type="button" class="mini-btn" data-action="remove-discussion" data-id="${d.id}" title="Remove from standup" aria-label="Remove from discussion queue">✕</button>
      </div>
      <div class="standup-discuss-people">
        <span class="standup-discuss-people-label">Discussants</span>
        <div class="discuss-chip-row" role="group" aria-label="Discussants for ${escapeHtml(title)}">${chips || '<span class="muted-hint">Add people in People first</span>'}</div>
        <span class="standup-discuss-who">${escapeHtml(who)}</span>
      </div>
      <textarea class="standup-discuss-note" data-id="${d.id}" placeholder="Discussion note (optional)" maxlength="400" aria-label="Discussion note">${escapeHtml(d.note||'')}</textarea>
    </div>`;
  }).join('');
  return `
  <div class="standup-section">
    <div class="standup-section-head">
      <span class="row-label">Discussion queue</span>
      <span class="standup-section-meta">${items.length}</span>
    </div>
    <div class="standup-discuss-list">${rows}</div>
  </div>`;
}

let lastStandupMemberId;

function dailyStandupCard(state){
  if(!state.team.length) return '';
  const {member: activeMember, idx: activeIdx} = activeStandupMember(state);

  const yTasks = state.yesterdayTasks.filter(t => Array.isArray(t.assignees) && t.assignees.includes(activeMember.id));
  const tTasksAll = state.tasks.filter(t => Array.isArray(t.assignees) && t.assignees.includes(activeMember.id));
  const tTasks = tTasksAll.filter(t => t.status !== 'complete');
  const yLines = standupTaskLines(yTasks);
  const entry = memberStandupEntry(state.standup, activeMember.id);
  const meta = normalizeStandup(state.standup)[STANDUP_META_KEY];

  const personChanged = lastStandupMemberId !== undefined && lastStandupMemberId !== activeMember.id;
  lastStandupMemberId = activeMember.id;

  const blockersCount = state.team.filter(m => (memberStandupEntry(state.standup, m.id).blockers || '').trim()).length;
  const absenceCount = effectiveAbsenceIds(state).length;
  const aiOn = isAiConfigured(state.settings);

  const yesterdayBoard = yLines
    ? standupBoardFromHTML(`<div class="standup-readout">${escapeHtml(yLines).replace(/\n/g,'<br>')}</div>`)
    : standupBoardFromHTML(`<div class="standup-readout muted"><em>No tasks logged yesterday</em></div>`);

  let todayBoardBody;
  if(tTasksAll.length === 0){
    todayBoardBody = `<div class="standup-readout muted"><em>Nothing assigned yet</em></div>`;
  } else if(tTasks.length === 0){
    todayBoardBody = `<div class="standup-readout muted"><em>All done for today</em></div>`;
  } else {
    todayBoardBody = standupTodayItemsHTML(tTasks);
  }
  const todayBoard = standupBoardFromHTML(todayBoardBody);

  const expanded = !!state.standupRailExpanded;
  return `
  <div class="glass-card standup-card">
    <div class="side-card-head">
      <div>
        <p class="zone-kicker">Standup</p>
        <h3>Daily standup</h3>
      </div>
      <div class="side-card-actions">
        <span class="side-sub-inline">${formatDisplay(state.dateStr)}</span>
        <button type="button" class="side-btn sm" data-action="toggle-standup-expand" title="${expanded ? 'Show priority lanes beside standup' : 'Expand standup to full workspace'}">${expanded ? 'Show lanes' : 'Expand'}</button>
        <button type="button" class="side-btn sm" data-action="send-standup-email" title="Email today's standup to the roster">✉ Standup email</button>
        ${aiOn
          ? `<button type="button" class="side-btn sm" data-action="draft-standup-highlights" title="Fill the highlights box from today's notes — you still edit and send">Draft standup highlights</button>`
          : `<button type="button" class="side-btn sm" data-action="open-settings" title="Configure AI assist in Settings first">Draft standup highlights</button>`}
      </div>
    </div>

    ${state.standupWarn ? `<div class="email-warn">${escapeHtml(state.standupWarn)}</div>` : ''}
    ${state.standupMsg ? `<div class="email-msg">${escapeHtml(state.standupMsg)}</div>` : ''}

    <div class="standup-pulse">
      <span><strong>${absenceCount}</strong> absent</span>
      <span><strong>${blockersCount}</strong> blockers</span>
      <span><strong>${discussionInRelease(state).length}</strong> discuss</span>
    </div>

    ${standupPersonSelectorHTML(state, activeMember, activeIdx)}
    ${standupAbsenceBarHTML(state, activeMember)}

    <div class="field compact standup-highlights-field">
      <label for="standupHighlights">Shared highlights (optional)</label>
      <textarea id="standupHighlights" class="standup-highlights" placeholder="Editable briefing bullets for the standup email — never auto-sent" maxlength="2000">${escapeHtml(meta.highlights||'')}</textarea>
    </div>

    <div class="standup-body ${personChanged?'standup-fade-in':''}">
      <div class="standup-fields">
        <div class="field compact">
          <label for="standup-yesterday-${activeMember.id}">Yesterday</label>
          <textarea id="standup-yesterday-${activeMember.id}" class="standup-input" data-member="${activeMember.id}" data-field="yesterday" placeholder="What did you get done?" maxlength="400">${escapeHtml(entry.yesterday||'')}</textarea>
          ${yesterdayBoard}
        </div>
        <div class="field compact">
          <label for="standup-today-${activeMember.id}">Today</label>
          <textarea id="standup-today-${activeMember.id}" class="standup-input" data-member="${activeMember.id}" data-field="today" placeholder="What are you working on?" maxlength="400">${escapeHtml(entry.today||'')}</textarea>
          ${todayBoard}
        </div>

        ${standupTaskLinkHTML(activeMember, yTasks, tTasks, entry)}

        <div class="field compact">
          <label for="standup-blockers-${activeMember.id}">Blockers</label>
          <textarea id="standup-blockers-${activeMember.id}" class="standup-input" data-member="${activeMember.id}" data-field="blockers" placeholder="Anything blocking progress?" maxlength="400">${escapeHtml(entry.blockers||'')}</textarea>
        </div>
        <div class="field compact">
          <label for="standup-questions-${activeMember.id}">Questions</label>
          <textarea id="standup-questions-${activeMember.id}" class="standup-input" data-member="${activeMember.id}" data-field="questions" placeholder="Questions for the team" maxlength="400">${escapeHtml(entry.questions||'')}</textarea>
        </div>
      </div>
    </div>

    ${standupDiscussionHTML(state)}
  </div>`;
}

/* ---------------------------------------------------------------------- */
/* Blueprint quick-load card — lives at the bottom of the board            */
/* ---------------------------------------------------------------------- */

function blueprintCardHTML(state){
  const schedule = state.blueprintSchedule || [];
  const namesPreview = schedule.slice(0, 6).map(i => i.title).join(', ') + (schedule.length > 6 ? `, +${schedule.length - 6} more` : '');
  return `
  <div class="glass-card bp-card">
    <div class="side-card-head">
      <div>
        <p class="zone-kicker">Tools</p>
        <h3>Quick-load blueprint</h3>
      </div>
      <button class="side-btn sm" data-action="manage-blueprint">Edit</button>
    </div>
    <div class="bp-item">
      <div class="bp-text">
        <strong>Daily blueprint</strong>
        <span>${schedule.length} recurring item${schedule.length===1?'':'s'} into ${formatDisplay(state.dateStr)}${namesPreview ? ` — ${escapeHtml(namesPreview)}` : ''}.</span>
      </div>
      <button class="bp-btn" ${schedule.length ? '' : 'disabled'}>Load</button>
    </div>
    ${state.bpMsg ? `<div class="bp-msg">${state.bpMsg}</div>` : ''}
  </div>`;
}

function standupRailHTML(state){
  const standup = dailyStandupCard(state);
  if(standup) return standup;
  return `
  <div class="glass-card standup-card standup-empty">
    <div class="side-card-head">
      <div>
        <p class="zone-kicker">Standup</p>
        <h3>Daily standup</h3>
      </div>
    </div>
    <div class="empty empty-state">
      <strong>Add teammates to run standup</strong>
      <span>Open People to build the roster, then walk through yesterday / today / blockers one person at a time.</span>
    </div>
    <button class="side-btn" data-action="open-people">Open People</button>
  </div>`;
}

// Compact day signals for the Board ops hub — not a second Dashboard.
// Deep breakdowns (by tag/status/assignee bars, release table) stay on
// the Dashboard page. People vs Work groups keep roster signals distinct
// from defect/task quality signals.
function testerLoadStripHTML(state){
  const rows = testerLoadRows(state);
  if(!rows.length) return '';
  return `
  <div class="tester-load glass-card dash-section">
    <p class="board-insight-group-label">Tester load</p>
    <div class="tester-load-table-wrap">
      <table class="tester-load-table">
        <thead><tr><th>Person</th><th>Open defects</th><th>Today</th><th>Stories in discuss</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${r.openDefects}</td><td>${r.todayActivity}</td><td>${r.storiesDiscuss}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function backupReminderHTML(state){
  if(!shouldRemindBackup(state, 4)) return '';
  const last = state.settings && state.settings.lastBackupAt
    ? formatDisplay(String(state.settings.lastBackupAt).slice(0, 10))
    : 'never';
  return `<div class="backup-reminder" role="status">Backup is older than 4 days (last export: ${escapeHtml(last)}). Export from the footer when convenient — nothing downloads automatically.</div>`;
}

function savedViewChipsHTML(kind, views, selectedId){
  const list = Array.isArray(views) && views.length ? views : (kind === 'defects' ? DEFAULT_DEFECT_VIEWS : DEFAULT_STORY_VIEWS);
  return `
  <div class="saved-view-row" role="group" aria-label="Saved ${kind} views">
    <button type="button" class="pill ${!selectedId?'active':''}" data-action="apply-saved-view" data-kind="${kind}" data-id="">All</button>
    ${list.map(v => `<button type="button" class="pill ${selectedId===v.id?'active':''}" data-action="apply-saved-view" data-kind="${kind}" data-id="${escapeHtml(v.id)}">${escapeHtml(v.name)}</button>`).join('')}
  </div>`;
}

function boardInsightsHTML(state){
  const snap = daySignalsSnapshot(state);
  const chip = (c) => `
    <div class="board-insight-chip ${c.warn?'warn':''}" title="${escapeHtml(c.label)}">
      <strong>${c.value}</strong>
      <span>${escapeHtml(c.label)}</span>
    </div>`;
  const missingNotes = storiesMissingTodayNote(state);
  const peopleChips = [
    {label: 'Absent', value: snap.people.find(p => p.label === 'Absent')?.value || 0, warn: (snap.people.find(p => p.label === 'Absent')?.value || 0) > 0},
    {label: 'Discuss', value: snap.people.find(p => p.label === 'Discuss')?.value || 0}
  ];
  const workChips = snap.work.map(w => ({
    ...w,
    warn: (w.label === 'Critical open' || w.label === 'Aging 8d+' || w.label === 'Blockers') && w.value > 0
  }));

  return `
  <div class="board-insights glass-card ${state.boardInsightsOpen?'open':''}">
    <button class="board-insights-toggle" data-action="toggle-board-insights" aria-expanded="${state.boardInsightsOpen?'true':'false'}">
      <span class="zone-kicker">Day signals</span>
      <strong>Board insights</strong>
      <span class="board-insights-chevron">${state.boardInsightsOpen?'▾':'▸'}</span>
    </button>
    ${state.boardInsightsOpen ? `
    <div class="board-insights-body">
      <div class="board-insight-groups">
        <div>
          <p class="board-insight-group-label">People</p>
          <div class="board-insight-chips">${peopleChips.map(chip).join('')}</div>
        </div>
        <div>
          <p class="board-insight-group-label">Work / Quality</p>
          <div class="board-insight-chips">${workChips.map(chip).join('')}
            <button type="button" class="board-insight-chip ${missingNotes.length?'warn':''}" data-action="switch-view" data-id="userStories" title="Stories in the selected release with no progress note for this board day">
              <strong>${missingNotes.length}</strong>
              <span>No note today</span>
            </button>
          </div>
        </div>
      </div>
      ${testerLoadStripHTML(state)}
      <div class="board-insights-ai">
        <div class="board-insights-ai-actions">
          <button type="button" class="side-btn sm" data-action="summarize-day-signals" title="Optional — uses your AI endpoint from Settings">Summarize day signals</button>
          ${isAiConfigured(state.settings)
            ? `<button type="button" class="side-btn sm" data-action="draft-standup-highlights">Draft standup highlights</button>`
            : ''}
          ${isAiConfigured(state.settings) ? '<span class="field-hint-block">Uses your saved AI endpoint</span>' : '<span class="field-hint-block">Configure endpoint + key under Settings → AI assist</span>'}
        </div>
        ${state.aiAssistWarn ? `<div class="email-warn">${escapeHtml(state.aiAssistWarn)}</div>` : ''}
        ${state.aiAssistMsg ? `<pre class="ai-summary">${escapeHtml(state.aiAssistMsg)}</pre>` : ''}
      </div>
      <p class="board-insights-foot">Deeper severity / status / tag / assignee breakdowns stay on <button type="button" class="text-link" data-action="switch-view" data-id="defectsDashboard">Dashboard</button>.</p>
    </div>` : ''}
  </div>`;
}

function boardPageHTML(state){
  const who = firstName(state.settings && state.settings.yourName);
  const greet = who ? `${timeGreeting()}, ${escapeHtml(who)}` : timeGreeting();
  const boardDate = isToday(state.dateStr)
    ? `${todayLongDate()} · Board`
    : `${formatDisplay(state.dateStr)} · Board`;

  return `
  <div class="board-shell">
    <header class="page-greeting board-greeting">
      <div class="page-greeting-main">
        <h2 class="page-title">${greet}</h2>
        <p class="page-greeting-date">${escapeHtml(boardDate)}</p>
      </div>
      <div class="board-day-controls">
        <div class="date-nav">
          <button class="date-btn" id="prevDay" title="Previous day" aria-label="Previous day">‹</button>
          <div class="date-label">${formatDisplay(state.dateStr)}${isToday(state.dateStr) ? '<span class="today-tag">Today</span>' : ''}</div>
          <button class="date-btn" id="nextDay" title="Next day" aria-label="Next day">›</button>
        </div>
        <div class="quick-pills">
          <button class="pill ${state.dateStr===shiftDate(toDateStr(new Date()),-1)?'active':''}" id="pillYesterday">Yesterday</button>
          <button class="pill ${isToday(state.dateStr)?'active':''}" id="pillToday">Today</button>
          <button class="pill ${state.dateStr===shiftDate(toDateStr(new Date()),1)?'active':''}" id="pillTomorrow">Tomorrow</button>
        </div>
      </div>
    </header>

    ${boardProgressHTML(state)}

    ${boardInsightsHTML(state)}

    <div class="board-ops glass-card">
      ${taskSearchBarHTML(state)}
      <div class="board-ops-people">
        ${peopleOpsChip(state)}
        ${groupsOpsChip(state)}
      </div>
    </div>

    <div class="board-workspace ${state.standupRailExpanded ? 'standup-expanded' : ''}">
      <div class="board-lanes">
        ${laneHTML(state, 'high')}
        ${laneHTML(state, 'medium')}
        ${laneHTML(state, 'low')}
      </div>
      <aside class="board-rail">
        ${standupRailHTML(state)}
      </aside>
    </div>

    <div class="board-tools">
      ${blueprintCardHTML(state)}
    </div>
  </div>`;
}

function blueprintListModalHTML(state){
  const schedule = state.blueprintSchedule || [];
  return `
  <div class="modal-head">
    <h2>Quick-load blueprint</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <p class="side-sub">These items get added to today's board in one click from "Quick-load blueprint" — already-present titles are skipped, never duplicated.</p>
    ${schedule.length ? schedule.map(item => `
    <div class="us-card">
      <div class="us-head">
        <div class="us-title">${escapeHtml(item.title)}</div>
        <button class="edit-btn" data-action="edit-blueprint-item" data-id="${item.id}" title="Edit">✎</button>
        <button class="del-btn" data-action="remove-blueprint-item" data-id="${item.id}" title="Remove">✕</button>
      </div>
      <p class="side-sub">${item.time ? `${formatTime12(item.time)} — ` : ''}${PRIORITY_TEXT[item.priority] || item.priority}</p>
    </div>`).join('') : '<div class="empty small">No items yet.</div>'}
  </div>
  <div class="modal-foot">
    <button class="add-btn" data-action="add-blueprint-item">+ Item</button>
  </div>`;
}

function blueprintItemFormModalHTML(state){
  const editing = state.modal.memberId ? (state.blueprintSchedule || []).find(i => i.id === state.modal.memberId) : null;
  const title = editing ? editing.title : state.blueprintItemDraft.title;
  const time = editing ? (editing.time||'') : state.blueprintItemDraft.time;
  const priority = editing ? editing.priority : state.blueprintItemDraft.priority;
  return `
  <div class="modal-head">
    <h2>${editing ? 'Edit item' : 'Add item'}</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Title</label>
      <input type="text" id="bpItemTitleInput" placeholder="e.g. Team Check-in" maxlength="140" value="${escapeHtml(title)}">
    </div>
    <div class="modal-row">
      <div class="field">
        <label>Time (optional)</label>
        <input type="time" id="bpItemTimeInput" value="${time}">
      </div>
      <div class="field">
        <label>Priority</label>
        <select id="bpItemPriorityInput">${PRIORITIES.map(p => `<option value="${p}" ${priority===p?'selected':''}>${PRIORITY_TEXT[p]}</option>`).join('')}</select>
      </div>
    </div>
    ${state.blueprintWarn ? `<div class="email-warn">${state.blueprintWarn}</div>` : ''}
  </div>
  <div class="modal-foot">
    <button class="add-btn" id="saveBlueprintItemBtn">${editing ? 'Save changes' : 'Add item'}</button>
  </div>`;
}

/* ---------------------------------------------------------------------- */
/* Release Testing — three separate top-level pages (User Stories,        */
/* Defects, ADO Sync), not the daily board, organized by release rather   */
/* than by date. User Stories/Defects can be added manually or pulled     */
/* from Azure DevOps.                                                     */
/* ---------------------------------------------------------------------- */

// Slim release manage strip — selection lives in the global chrome dropdown.
// Kept so Stories / Defects / ADO stay usable when the release list is empty.
function releaseManageBarHTML(state){
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  const hint = !state.releases.length
    ? 'No releases yet — add one to start tracking.'
    : selected
      ? `Active release: ${escapeHtml(selected.name)}`
      : 'No release selected — pick one in the header, or choose All releases for Dashboard-wide stats.';
  return `
  <div class="release-manage-bar glass-card">
    <p class="side-sub">${hint}</p>
    <div class="side-card-actions">
      ${selected ? `<button class="side-btn sm" data-action="edit-release" data-id="${selected.id}" title="Edit release">✎ Edit</button>` : ''}
      <button class="side-btn sm" data-action="add-release">+ Release</button>
    </div>
  </div>`;
}

function globalReleaseControlHTML(state){
  const options = [
    `<option value="" ${!state.selectedReleaseId?'selected':''}>All releases</option>`,
    ...state.releases.map(r => `<option value="${r.id}" ${state.selectedReleaseId===r.id?'selected':''}>${escapeHtml(r.name)}</option>`)
  ].join('');
  return `
  <div class="global-release">
    <label class="global-release-label" for="globalReleaseSelect">Release</label>
    <select id="globalReleaseSelect" class="global-release-select" aria-label="Active release">
      ${state.releases.length ? options : '<option value="">No releases yet</option>'}
    </select>
  </div>`;
}

// Synced items now always resolve to a Person — a sync upserts one from
// ADO's identity directly rather than only matching an existing one (see
// adoSync.js) — so there's no unmatched-name fallback to render here.
function assigneeDisplayHTML(state, assigneeId){
  if(!assigneeId) return '';
  const m = state.team.find(x => x.id === assigneeId);
  return m ? avatarHTML(m, state.team.indexOf(m), 'sm') : '';
}

// Who raised it in ADO — captured during sync so a reminder can reach them
// as well as the assignee (see defectsEmail.js).
function createdByHTML(createdByName, createdByEmail){
  if(!createdByName) return '';
  const title = createdByEmail ? `${createdByName} <${createdByEmail}>` : createdByName;
  return `<div class="created-by-tag" title="${escapeHtml(title)}">Created by ${escapeHtml(createdByName)}</div>`;
}

// The raw ADO iteration path (e.g. "Proj\Release2026.09\Sprint3") — this is
// what release membership is actually resolved from (see defectReleaseId /
// userStoryReleaseId in state.js), so showing it directly on the ticket
// makes that resolution visible instead of implicit.
function iterationPathHTML(iterationPath){
  if(!iterationPath) return '';
  return `<div class="iteration-tag" title="${escapeHtml(iterationPath)}">🔀 ${escapeHtml(iterationPath)}</div>`;
}

// A synced Task's ADO parent — a User Story or a Bug (see adoSync.js) — so
// the board shows what a task is actually for, not just its own title.
function taskParentLinkHTML(state, t){
  if(t.userStoryId){
    const us = state.userStories.find(u => u.id === t.userStoryId);
    if(us) return `<div class="linked-us-tag">Re: ${escapeHtml(us.title)}</div>`;
  }
  if(t.defectId){
    const d = state.defects.find(x => x.id === t.defectId);
    if(d) return `<div class="linked-us-tag">Re: ${escapeHtml(d.title)}</div>`;
  }
  return '';
}

// latestComment is pulled from ADO's discussion thread during sync (see
// adoSync.js) — read-only, distinct from this app's own "+ Note" field.
function commentPreviewHTML(latestComment){
  if(!latestComment || !latestComment.text) return '';
  const who = latestComment.author ? `${latestComment.author}: ` : '';
  const when = latestComment.date ? ` (${formatDisplay(latestComment.date.slice(0,10))})` : '';
  return `<div class="ado-comment-preview" title="${escapeHtml(who + latestComment.text + when)}">💬 ${escapeHtml(who)}${escapeHtml(latestComment.text)}</div>`;
}

// Suggestions for the status inputs below — every distinct adoState value
// seen across User Stories and Defects, not a fixed vocabulary of our own.
// Backs a <datalist> so the field behaves like a dropdown of what's
// actually in use while staying free text (a sync always overwrites it
// with ADO's real value anyway, and typing a new one is still allowed).
function adoStatusDatalistHTML(state){
  const values = new Set();
  state.userStories.forEach(us => { if(us.adoState) values.add(us.adoState); });
  state.defects.forEach(d => { if(d.adoState) values.add(d.adoState); });
  return `<datalist id="adoStatusOptions">${[...values].sort().map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
}

function userStoriesPageHTML(state){
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  const viewId = state.selectedStoryViewId || '';
  const userStories = scopedUserStories(state).filter(us => storyMatchesSavedView(state, us, viewId));
  const views = (state.settings.savedViews && state.settings.savedViews.stories) || DEFAULT_STORY_VIEWS;
  const heading = selected ? ` — ${escapeHtml(selected.name)}` : ' — All releases';
  return `
  ${pageIntroHTML('Release testing', 'User stories', 'Multi-day delivery items — ongoing notes, group ownership, and standup discussion queue.')}
  ${releaseManageBarHTML(state)}
  ${savedViewChipsHTML('stories', views, viewId)}
  ${adoStatusDatalistHTML(state)}
  <div class="glass-card release-us-card">
    <div class="side-card-head">
      <h3>User Stories${heading}</h3>
      <button class="side-btn sm" data-action="add-user-story">+ User Story</button>
    </div>
    ${userStories.length ? userStories.map(us => userStoryRowHTML(state, us)).join('') : emptyStateHTML('No stories match', selected ? 'Add one here, or sync from Azure DevOps.' : 'Nothing across releases for this view.')}
  </div>`;
}

function userStoryRowHTML(state, us){
  const defectCount = (us.defectIds || []).length;
  const queued = normalizeStandup(state.standup)[STANDUP_META_KEY].discussion.some(d => d.kind === 'userStory' && d.itemId === us.id);
  const groups = (us.groupIds || []).map(id => state.groups.find(g => g.id === id)).filter(Boolean);
  const groupBadges = groups.map(g => `<span class="group-badge sm" title="${escapeHtml(g.purpose||g.name)}">${GROUP_ICON_SVG}<span>${escapeHtml(g.name)}</span></span>`).join('');
  const todayNote = (us.progressNotes && us.progressNotes[state.dateStr]) || '';
  const counts = testCountsFor(us, state.dateStr);
  const co = (us.coAssigneeIds || []).map(id => state.team.find(m => m.id === id)).filter(Boolean);
  const coBadges = co.map(m => `<span class="group-badge sm" title="Co-assignee (original owner kept)">+ ${escapeHtml(m.name.split(' ')[0])}</span>`).join('');
  const discussants = us.assigneeId ? [us.assigneeId] : [];
  groups.forEach(g => (g.memberIds || []).forEach(id => { if(!discussants.includes(id)) discussants.push(id); }));
  const notesKey = workNotesKey('userStory', us.id);
  const expanded = state.workNotesExpanded.has(notesKey) || queued;
  const previewBits = [];
  if((us.ongoingNote || '').trim()) previewBits.push('Ongoing noted');
  if(todayNote.trim()) previewBits.push('Today noted');
  const preview = previewBits.length ? previewBits.join(' · ') : 'No progress notes yet';

  return `
  <div class="us-card ${expanded?'notes-open':''} ${queued?'in-standup':''}">
    <div class="us-head">
      ${us.adoId ? `<span class="ado-badge">#${us.adoId}</span>` : ''}
      <button type="button" class="us-title us-title-btn" data-action="toggle-work-notes" data-kind="userStory" data-id="${us.id}" title="Show or hide progress notes" aria-expanded="${expanded?'true':'false'}">${escapeHtml(us.title)}</button>
      <button class="side-btn sm ${queued?'queued':''}" data-action="toggle-standup-queue" data-kind="userStory" data-id="${us.id}" data-discussants="${discussants.join(',')}" title="${queued?'Remove from standup':'Queue for standup discussion'}">${queued?'In standup':'Standup'}</button>
      <button class="edit-btn" data-action="edit-user-story" data-id="${us.id}" title="Edit">✎</button>
      <button class="del-btn" data-action="remove-user-story" data-id="${us.id}" title="Remove">✕</button>
    </div>
    ${createdByHTML(us.createdByName, us.createdByEmail)}
    ${iterationPathHTML(us.iterationPath)}
    <div class="us-controls">
      ${assigneeDisplayHTML(state, us.assigneeId)}
      ${coBadges}
      ${groupBadges}
      <input type="text" class="status-input" list="adoStatusOptions" data-kind="user-story" data-id="${us.id}" value="${escapeHtml(us.adoState||'')}" placeholder="Status">
      <button class="side-btn sm" data-action="add-defect-for-us" data-id="${us.id}">+ Defect</button>
      ${defectCount ? `<button class="defect-count-link" data-action="switch-view" data-id="defects">${defectCount} defect${defectCount===1?'':'s'} →</button>` : ''}
    </div>
    <div class="test-log" title="Manual test execution for ${formatDisplay(state.dateStr)} — feeds Daily QA Status. ADO does not sync Test Cases.">
      <span class="test-log-label">Tests · ${formatDisplay(state.dateStr)}</span>
      ${['planned','executed','pass','fail','blocked'].map(k => `
        <label class="test-log-cell"><span>${k[0].toUpperCase()+k.slice(1)}</span>
          <input type="number" min="0" step="1" inputmode="numeric" class="story-test-count" data-id="${us.id}" data-field="${k}" value="${escapeHtml(counts[k] === '' || counts[k] === undefined || counts[k] === null ? '' : String(counts[k]))}">
        </label>`).join('')}
    </div>
    ${expanded ? `
    <div class="work-notes story-notes">
      <div class="field compact">
        <label>Ongoing status (multi-day)</label>
        <textarea class="story-ongoing-note" data-id="${us.id}" placeholder="Cross-day narrative — what's true across the sprint" maxlength="400">${escapeHtml(us.ongoingNote||'')}</textarea>
      </div>
      <div class="field compact">
        <label>Today's progress · ${formatDisplay(state.dateStr)}</label>
        <textarea class="story-progress-note" data-id="${us.id}" placeholder="What moved forward today" maxlength="400">${escapeHtml(todayNote)}</textarea>
      </div>
      ${state.groups.length ? `
      <div class="field compact">
        <label>Executing groups</label>
        <div class="group-toggle-row">
          ${state.groups.map(g => {
            const sel = (us.groupIds || []).includes(g.id);
            return `<button class="t-opt ${sel?'sel':''}" data-action="toggle-story-group" data-id="${us.id}" data-group="${g.id}">${escapeHtml(g.name)}</button>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>` : `
    <button type="button" class="work-notes-preview" data-action="toggle-work-notes" data-kind="userStory" data-id="${us.id}">
      <span>${escapeHtml(preview)}</span>
      <span class="work-notes-preview-hint">Expand notes</span>
    </button>`}
    ${commentPreviewHTML(us.latestComment)}
  </div>`;
}

// A defect can carry several tags — the pill row filters to defects that
// have the selected tag, rather than trying to bucket each defect under a
// single group (it may not have just one).
function defectTagPillsHTML(state, allDefects){
  const tagSet = new Set();
  allDefects.forEach(d => (d.tags || []).forEach(t => tagSet.add(t)));
  if(!tagSet.size) return '';
  const tags = [...tagSet].sort();
  return `
  <div class="release-picker-bar glass-card">
    <div class="release-pills">
      <button class="pill ${!state.selectedDefectTag?'active':''}" data-action="select-defect-tag" data-id="">All tags</button>
      ${tags.map(t => `<button class="pill ${state.selectedDefectTag===t?'active':''}" data-action="select-defect-tag" data-id="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
    </div>
  </div>`;
}

function defectsPageHTML(state){
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  const usById = new Map(state.userStories.map(us => [us.id, us]));
  const tagFilter = d => !state.selectedDefectTag || (d.tags || []).includes(state.selectedDefectTag);

  const releaseLinked = selected
    ? state.defects.filter(d => defectReleaseId(d, state.releases, usById) === selected.id)
    : state.defects.filter(d => defectReleaseId(d, state.releases, usById) !== null);
  const unlinkedAll = state.defects.filter(d => defectReleaseId(d, state.releases, usById) === null);
  const viewId = state.selectedDefectViewId || '';
  const views = (state.settings.savedViews && state.settings.savedViews.defects) || DEFAULT_DEFECT_VIEWS;
  const releaseFiltered = releaseLinked.filter(tagFilter).filter(d => defectMatchesSavedView(state, d, viewId));
  const unlinked = unlinkedAll.filter(tagFilter).filter(d => defectMatchesSavedView(state, d, viewId));
  const heading = selected ? ` — ${escapeHtml(selected.name)}` : ' — All releases';

  return `
  ${pageIntroHTML('Release testing', 'Defects', 'Day-scoped tester activity — short notes, who worked it today, standup queue.')}
  ${releaseManageBarHTML(state)}
  ${savedViewChipsHTML('defects', views, viewId)}
  ${defectTagPillsHTML(state, [...releaseLinked, ...unlinkedAll])}
  ${adoStatusDatalistHTML(state)}
  <div class="glass-card release-us-card">
    <div class="side-card-head">
      <h3>Defects${heading}</h3>
      <div class="side-card-actions">
        <button class="side-btn sm" data-action="open-qa-status" title="Daily System Testing (QA) status email">✉ Daily QA Status</button>
        <button class="side-btn sm" data-action="send-defects-email" title="Email exactly what's showing below">✉ Email</button>
        <button class="side-btn sm" data-action="add-defect">+ Defect</button>
      </div>
    </div>
    ${state.defectsEmailWarn ? `<div class="email-warn">${state.defectsEmailWarn}</div>` : ''}
    ${state.defectsEmailMsg ? `<div class="email-msg">${state.defectsEmailMsg}</div>` : ''}
    ${releaseFiltered.length ? releaseFiltered.map(d => defectRowHTML(state, d, usById.get(d.userStoryId))).join('') : emptyStateHTML('No defects match', 'Nothing for the current release and filter.')}
  </div>
  ${unlinked.length ? `
  <div class="glass-card release-us-card">
    <div class="side-card-head"><h3>Unlinked defects</h3></div>
    <p class="side-sub">Not tied to a user story, so they don't belong to any release yet.</p>
    ${unlinked.map(d => defectRowHTML(state, d, null)).join('')}
  </div>` : ''}
  `;
}

function defectRowHTML(state, d, linkedUs){
  const tagChips = (d.tags || []).map(t => `<span class="release-tag">${escapeHtml(t)}</span>`).join('');
  const queued = normalizeStandup(state.standup)[STANDUP_META_KEY].discussion.some(x => x.kind === 'defect' && x.itemId === d.id);
  const day = (d.dayActivity && d.dayActivity[state.dateStr]) || {note: '', testerIds: []};
  const defaultId = (() => {
    const created = findMemberByIdentity(state.team, d.createdByName, d.createdByEmail);
    if(created) return created.id;
    return d.assigneeId || null;
  })();
  const discussants = defaultId ? [defaultId] : (d.assigneeId ? [d.assigneeId] : []);
  const notesKey = workNotesKey('defect', d.id);
  const expanded = state.workNotesExpanded.has(notesKey) || queued;
  const testerIds = (day.testerIds && day.testerIds.length)
    ? day.testerIds
    : (defaultId ? [defaultId] : []);
  const meta = normalizeStandup(state.standup)[STANDUP_META_KEY];
  const defaultAbsent = defaultId && isAbsent(state, defaultId);
  const defaultMember = defaultId ? state.team.find(m => m.id === defaultId) : null;
  const peerIds = new Set();
  if(defaultId){
    state.groups.filter(g => Array.isArray(g.memberIds) && g.memberIds.includes(defaultId))
      .forEach(g => (g.memberIds || []).forEach(id => { if(id !== defaultId) peerIds.add(id); }));
  }
  const altPool = (peerIds.size ? [...peerIds] : state.team.map(m => m.id).filter(id => id !== defaultId))
    .map(id => state.team.find(m => m.id === id)).filter(Boolean);
  const preview = day.note
    ? `Activity: ${day.note.slice(0, 72)}${day.note.length > 72 ? '…' : ''}`
    : (testerIds.length ? `${testerIds.length} tester${testerIds.length===1?'':'s'} today` : 'No day activity yet');

  return `
  <div class="us-card ${expanded?'notes-open':''} ${queued?'in-standup':''}">
    <div class="us-head">
      ${d.adoId ? `<span class="ado-badge">#${d.adoId}</span>` : ''}
      <span class="severity-tag ${d.severity}">${SEVERITY_LABELS[d.severity]}</span>
      <button type="button" class="us-title us-title-btn" data-action="toggle-work-notes" data-kind="defect" data-id="${d.id}" title="Show or hide today's activity" aria-expanded="${expanded?'true':'false'}">${escapeHtml(d.title)}</button>
      <button class="side-btn sm ${queued?'queued':''}" data-action="toggle-standup-queue" data-kind="defect" data-id="${d.id}" data-discussants="${discussants.join(',')}" title="${queued?'Remove from standup':'Queue for standup discussion'}">${queued?'In standup':'Standup'}</button>
      <button class="edit-btn" data-action="edit-defect" data-id="${d.id}" title="Edit">✎</button>
      <button class="del-btn" data-action="remove-defect" data-id="${d.id}" title="Remove">✕</button>
    </div>
    ${linkedUs ? `<div class="linked-us-tag">Re: ${escapeHtml(linkedUs.title)}</div>` : ''}
    ${createdByHTML(d.createdByName, d.createdByEmail)}
    ${iterationPathHTML(d.iterationPath)}
    <div class="us-controls">
      ${assigneeDisplayHTML(state, d.assigneeId)}
      <input type="text" class="status-input" list="adoStatusOptions" data-kind="defect" data-id="${d.id}" value="${escapeHtml(d.adoState||'')}" placeholder="Status">
      ${tagChips}
    </div>
    ${expanded ? `
    <div class="work-notes defect-activity">
      <div class="field compact">
        <label>Today's activity · ${formatDisplay(state.dateStr)}</label>
        <textarea class="defect-day-note" data-id="${d.id}" placeholder="Short tester note for this day only" maxlength="400">${escapeHtml(day.note||'')}</textarea>
      </div>
      ${state.team.length ? `
      <div class="field compact">
        <label>Testers today${defaultMember ? ` <span class="field-hint">Default: ${escapeHtml(defaultMember.name)}${defaultAbsent?' (absent)':''}</span>` : ''}</label>
        <div class="group-toggle-row">
          ${state.team.map((m, idx) => {
            const sel = testerIds.includes(m.id);
            const isDefault = m.id === defaultId;
            return `<button class="avatar-chip ${sel?'sel':''} ${isDefault?'is-default':''}" style="--avatar-color:${avatarColor(idx)}" data-action="toggle-defect-tester" data-id="${d.id}" data-member="${m.id}" title="${escapeHtml(m.name)}${isDefault?' — default tester':''}${isAbsent(state, m.id)?' — absent':''}">${escapeHtml(initials(m.name))}</button>`;
          }).join('')}
        </div>
      </div>` : ''}
      ${defaultAbsent && altPool.length ? `
      <div class="field compact alt-tester-field">
        <label>Default tester absent — cover with</label>
        <select class="defect-alt-tester" data-id="${d.id}" aria-label="Alternate tester">
          <option value="">Pick alternate…</option>
          ${altPool.map(m => `<option value="${m.id}" ${testerIds.includes(m.id) && m.id !== defaultId ? 'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>` : `
    <button type="button" class="work-notes-preview" data-action="toggle-work-notes" data-kind="defect" data-id="${d.id}">
      <span>${escapeHtml(preview)}</span>
      <span class="work-notes-preview-hint">Expand activity</span>
    </button>`}
    ${commentPreviewHTML(d.latestComment)}
  </div>`;
}

// Horizontal bar-row breakdown, shared by every "By X" section on the
// dashboard — width is relative to the largest count in that section, not
// the grand total, so a small section doesn't render as all-empty slivers.
function dashBarRowsHTML(items){
  const max = Math.max(1, ...items.map(i => i.count));
  return items.map(i => `
    <div class="dash-bar-row">
      <span class="dash-bar-label">${escapeHtml(i.label)}</span>
      <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round((i.count / max) * 100)}%;${i.color ? ` background:${i.color};` : ''}"></div></div>
      <span class="dash-bar-count">${i.count}</span>
    </div>`).join('');
}

function dashSectionHTML(title, items){
  return `
  <div class="glass-card dash-section">
    <div class="dash-section-head">
      <h3>${title}</h3>
      <span class="dash-section-meta">${items.reduce((n, i) => n + i.count, 0)}</span>
    </div>
    ${items.length ? dashBarRowsHTML(items) : emptyStateHTML('No data yet')}
  </div>`;
}

function dashReleaseTableHTML(rows){
  if(!rows.length) return emptyStateHTML('No releases yet');
  return `
  <div class="dash-table-wrap">
    <table class="dash-table">
      <thead><tr><th>Release</th><th>Total</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Open</th><th>Resolved</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${r.total}</td><td>${r.critical}</td><td>${r.high}</td><td>${r.medium}</td><td>${r.low}</td><td>${r.open}</td><td>${r.resolved}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// Selection lives in the global Release dropdown — Dashboard treats empty
// selection as "All releases"; Stories/Defects/ADO still need a concrete one.
function defectsDashboardPageHTML(state){
  const usById = new Map(state.userStories.map(us => [us.id, us]));
  const releaseIdFor = d => defectReleaseId(d, state.releases, usById);
  const isOpen = d => !isResolvedState(d.adoState);

  const scopedRelease = state.releases.find(r => r.id === state.selectedReleaseId) || null;
  const defects = scopedRelease ? state.defects.filter(d => releaseIdFor(d) === scopedRelease.id) : state.defects;
  const scopeLabel = scopedRelease ? scopedRelease.name : 'All releases';

  const total = defects.length;
  const openCount = defects.filter(isOpen).length;
  const resolvedCount = total - openCount;
  const criticalCount = defects.filter(d => d.severity === 'critical').length;
  const highOpen = defects.filter(d => isOpen(d) && (d.severity === 'critical' || d.severity === 'high')).length;
  const unlinkedDefects = defects.filter(d => releaseIdFor(d) === null);
  const resolveRate = total ? Math.round((resolvedCount / total) * 100) : 0;
  const now = Date.now();
  const new14d = defects.filter(d => {
    const ms = d.createdDate ? new Date(d.createdDate).getTime() : NaN;
    return Number.isFinite(ms) && (now - ms) <= 14 * 86400000;
  }).length;
  const aging8 = defects.filter(d => {
    if(!isOpen(d)) return false;
    const ms = d.createdDate ? new Date(d.createdDate).getTime() : NaN;
    return Number.isFinite(ms) && Math.floor((now - ms) / 86400000) >= 8;
  }).length;
  const unassignedOpen = defects.filter(d => isOpen(d) && !d.assigneeId && !(d.assigneeEmail || '').trim()).length;
  const flow = defectFlowStats(defects);
  const flow7 = flow[7];
  const flow14 = flow[14];
  const testerThroughput = (() => {
    const map = new Map();
    defects.forEach(d => {
      const day = d.dayActivity && d.dayActivity[state.dateStr];
      if(!day) return;
      const touched = (day.note && day.note.trim()) || (day.testerIds || []).length;
      if(!touched) return;
      (day.testerIds || []).forEach(id => {
        const name = state.team.find(m => m.id === id)?.name || 'Unknown';
        map.set(name, (map.get(name) || 0) + 1);
      });
      if(!(day.testerIds || []).length) map.set('(note only)', (map.get('(note only)') || 0) + 1);
    });
    return [...map.entries()].sort((a,b) => b[1]-a[1]).map(([label, count]) => ({label, count}));
  })();
  const blockedStories = state.userStories.filter(us => {
    if(scopedRelease && userStoryReleaseId(us, state.releases) !== scopedRelease.id) return false;
    const queued = normalizeStandup(state.standup)[STANDUP_META_KEY].discussion
      .some(d => d.kind === 'userStory' && d.itemId === us.id);
    return queued;
  }).length;

  const releaseRow = (name, rDefects) => {
    const bySev = sev => rDefects.filter(d => d.severity === sev).length;
    const open = rDefects.filter(isOpen).length;
    return {name, total: rDefects.length, critical: bySev('critical'), high: bySev('high'), medium: bySev('medium'), low: bySev('low'), open, resolved: rDefects.length - open};
  };
  const releaseRows = scopedRelease ? [] : state.releases.map(r => releaseRow(r.name, state.defects.filter(d => releaseIdFor(d) === r.id)));
  if(!scopedRelease && unlinkedDefects.length) releaseRows.push(releaseRow('Unlinked', unlinkedDefects));

  const severityCounts = SEVERITIES.map(s => ({label: SEVERITY_LABELS[s], count: defects.filter(d => d.severity === s).length, color: `var(--${s})`}));

  const countBy = (getKey) => {
    const map = new Map();
    defects.forEach(d => { const k = getKey(d); if(k !== null) map.set(k, (map.get(k) || 0) + 1); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({label, count}));
  };
  const statusCounts = countBy(d => d.adoState || 'No status set');
  const tagCounts = (() => {
    const map = new Map();
    defects.forEach(d => (d.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({label, count}));
  })();
  const assigneeCounts = countBy(d => {
    if(d.assigneeId) return state.team.find(m => m.id === d.assigneeId)?.name || 'Unknown';
    const created = findMemberByIdentity(state.team, d.createdByName, d.createdByEmail);
    if(created) return created.name;
    return d.createdByName || 'Unassigned';
  });

  const AGE_BUCKETS = ['0–3 days', '4–7 days', '8–14 days', '15–30 days', '30+ days', 'Unknown'];
  const ageMap = new Map(AGE_BUCKETS.map(b => [b, 0]));
  defects.filter(isOpen).forEach(d => {
    const ms = d.createdDate ? new Date(d.createdDate).getTime() : NaN;
    const days = Number.isFinite(ms) ? Math.floor((now - ms) / 86400000) : -1;
    const bucket = days < 0 ? 'Unknown' : days <= 3 ? '0–3 days' : days <= 7 ? '4–7 days' : days <= 14 ? '8–14 days' : days <= 30 ? '15–30 days' : '30+ days';
    ageMap.set(bucket, ageMap.get(bucket) + 1);
  });
  const agingCounts = AGE_BUCKETS.map(label => ({label, count: ageMap.get(label)}));

  return `
  ${pageIntroHTML('Operations', 'Defects dashboard', 'Severity, status, ownership, and aging — scoped by the header release filter. Day-to-day signals stay on the Board.')}
  ${!state.releases.length ? releaseManageBarHTML(state) : ''}
  <div class="glass-card dash-hero">
    <div class="dash-hero-main">
      <p class="zone-kicker">Defect health</p>
      <h2>${escapeHtml(scopeLabel)}</h2>
      <p class="side-sub">As of ${formatDisplay(toDateStr(new Date()))} · ${resolveRate}% resolved</p>
    </div>
    <div class="dash-hero-actions no-print">
      <button class="side-btn sm" data-action="print-page" title="Print or save as PDF">Print / PDF</button>
      <button class="side-btn sm" data-action="open-qa-status" title="Daily System Testing (QA) status email">✉ Daily QA Status</button>
      <button class="side-btn sm" data-action="send-dashboard-email" title="Email this summary to a manager">✉ Email summary</button>
    </div>
    ${state.dashboardEmailWarn ? `<div class="email-warn">${state.dashboardEmailWarn}</div>` : ''}
    ${state.dashboardEmailMsg ? `<div class="email-msg">${state.dashboardEmailMsg}</div>` : ''}
  </div>
  <div class="dash-kpi-grid">
    <div class="dash-kpi"><span class="dash-kpi-label">Total</span><strong>${total}</strong></div>
    <div class="dash-kpi critical"><span class="dash-kpi-label">Critical</span><strong>${criticalCount}</strong></div>
    <div class="dash-kpi open"><span class="dash-kpi-label">Open</span><strong>${openCount}</strong><span class="dash-kpi-sub">${highOpen} crit/high open</span></div>
    <div class="dash-kpi resolved"><span class="dash-kpi-label">Resolved</span><strong>${resolvedCount}</strong></div>
    <div class="dash-kpi muted"><span class="dash-kpi-label">Unlinked</span><strong>${unlinkedDefects.length}</strong></div>
  </div>
  <div class="dash-lead-grid">
    <div class="dash-lead-card"><span class="dash-kpi-label">New (14 days)</span><strong>${new14d}</strong><span class="dash-kpi-sub">Created in window</span></div>
    <div class="dash-lead-card"><span class="dash-kpi-label">Aging 8d+ open</span><strong>${aging8}</strong><span class="dash-kpi-sub">Needs attention</span></div>
    <div class="dash-lead-card"><span class="dash-kpi-label">Unassigned open</span><strong>${unassignedOpen}</strong><span class="dash-kpi-sub">No owner yet</span></div>
    <div class="dash-lead-card"><span class="dash-kpi-label">Stories in discuss</span><strong>${blockedStories}</strong><span class="dash-kpi-sub">Queued for standup</span></div>
  </div>
  <div class="glass-card dash-section dash-section-wide">
    <div class="dash-section-head">
      <h3>Defect inflow vs outflow</h3>
      <span class="dash-section-meta">Created vs resolved dates</span>
    </div>
    <div class="dash-flow-grid">
      <div class="dash-flow-card">
        <span class="dash-kpi-label">Last 7 days</span>
        <p>Created <strong>${flow7.created}</strong> · Resolved <strong>${flow7.resolved}</strong></p>
        <p class="dash-kpi-sub">Net ${flow7.net >= 0 ? 'drain' : 'growth'} ${flow7.net > 0 ? '+' : ''}${flow7.net}${flow7.resolvedUnknown ? ` · ${flow7.resolvedUnknown} resolved with no date` : ''}</p>
      </div>
      <div class="dash-flow-card">
        <span class="dash-kpi-label">Last 14 days</span>
        <p>Created <strong>${flow14.created}</strong> · Resolved <strong>${flow14.resolved}</strong></p>
        <p class="dash-kpi-sub">Net ${flow14.net >= 0 ? 'drain' : 'growth'} ${flow14.net > 0 ? '+' : ''}${flow14.net}${flow14.resolvedUnknown ? ` · ${flow14.resolvedUnknown} resolved with no date` : ''}</p>
      </div>
    </div>
    <p class="field-hint-block">Resolved counts use Resolved/Closed dates when ADO provided them. Items already in a resolved state without a date are listed as unknown — reopen rate is not estimated.</p>
  </div>
  ${testerLoadStripHTML(state)}
  ${testerThroughput.length ? `
  <div class="glass-card dash-section dash-section-wide">
    <div class="dash-section-head">
      <h3>Tester throughput · ${formatDisplay(state.dateStr)}</h3>
      <span class="dash-section-meta">${testerThroughput.reduce((n,i)=>n+i.count,0)} touches</span>
    </div>
    ${dashBarRowsHTML(testerThroughput)}
  </div>` : ''}
  ${releaseRows.length ? `
  <div class="glass-card dash-section dash-section-wide">
    <div class="dash-section-head">
      <h3>By release</h3>
      <span class="dash-section-meta">${releaseRows.length} rows</span>
    </div>
    ${dashReleaseTableHTML(releaseRows)}
  </div>
  ` : ''}
  <div class="dash-grid">
    ${dashSectionHTML('By severity', severityCounts)}
    ${dashSectionHTML('By status', statusCounts)}
    ${dashSectionHTML('By tag', tagCounts)}
    ${dashSectionHTML('By owner', assigneeCounts)}
    ${dashSectionHTML('Aging (open)', agingCounts)}
  </div>`;
}

// Each release picks which ADO connection it syncs from (see releaseModalHTML
// and resolveAdoConnection in state.js) — with only one connection
// configured, every release uses it implicitly, so a single-org setup needs
// no per-release picking at all.
function formatSyncTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
}

function adoSyncPageHTML(state){
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  const connections = state.settings.adoConnections || [];
  const connection = resolveAdoConnection(selected, connections);
  const needsExplicitPick = selected && !connection && connections.length > 1;
  const types = state.adoSyncTypes || {userStory: true, defect: true, task: true};
  const wit = (connection && connection.workItemTypes) || {};
  const lastSync = selected && (selected.lastSync && selected.lastSync.at ? formatSyncTime(selected.lastSync.at) : (selected.lastSyncAt ? formatSyncTime(selected.lastSyncAt) : ''));
  const lastSummary = selected && selected.lastSync ? selected.lastSync : null;
  const typesThisRun = lastSummary && lastSummary.types
    ? ['userStory','defect','task'].filter(k => lastSummary.types[k]).map(k => k === 'userStory' ? 'User stories' : k === 'defect' ? 'Defects' : 'Tasks')
    : [];
  const typeToggle = (key, label, witName) => `
    <button type="button" class="sync-type-chip ${types[key]?'sel':''}" data-action="toggle-ado-sync-type" data-type="${key}" aria-pressed="${types[key]?'true':'false'}">
      <strong>${label}</strong>
      <span>${escapeHtml(witName || '—')}</span>
    </button>`;

  return `
  ${pageIntroHTML('Integrations', 'Azure DevOps sync', 'Pull stories, defects, and tasks into the selected release. Connections stay on this machine.')}
  ${releaseManageBarHTML(state)}
  ${selected ? `
  <div class="glass-card sync-target-card">
    <div class="sync-target-grid">
      <div>
        <span class="row-label">Target release</span>
        <strong>${escapeHtml(selected.name)}</strong>
      </div>
      <div>
        <span class="row-label">Connection</span>
        <strong>${connection ? escapeHtml(connection.name) : 'Not assigned'}</strong>
        ${connection ? `<span class="sync-meta">${escapeHtml(connection.org)}/${escapeHtml(connection.project)}</span>` : ''}
      </div>
      <div>
        <span class="row-label">Iteration path</span>
        <strong>${selected.iterationPath ? escapeHtml(selected.iterationPath) : 'Not set'}</strong>
      </div>
      <div>
        <span class="row-label">Last sync</span>
        <strong>${lastSync || 'Never'}</strong>
        ${lastSummary ? `<span class="sync-meta">${lastSummary.ok ? 'Succeeded' : 'Failed'}${typesThisRun.length ? ` · ${typesThisRun.join(', ')}` : ''}</span>` : ''}
      </div>
    </div>
    <div class="sync-target-actions">
      <button class="edit-btn" data-action="edit-release" data-id="${selected.id}" title="Edit release / iteration path / connection">✎ Release</button>
      ${connection ? `<button class="edit-btn" data-action="edit-ado-connection" data-id="${connection.id}" title="Edit this connection">✎ Connection</button>` : ''}
    </div>
  </div>
  ` : ''}
  <div class="glass-card ado-card">
    <div class="side-card-head">
      <div>
        <h3>Sync controls</h3>
        <p class="side-sub">Choose connection details and which work item types to pull this run.</p>
      </div>
      <button class="side-btn sm" data-action="manage-ado-connections">Manage connections</button>
    </div>
    ${connections.length > 1 && selected ? `
    <div class="field compact">
      <label>Switch connection for this release</label>
      <div class="sync-conn-row">
        ${connections.map(c => `
          <button type="button" class="sync-conn-chip ${connection && connection.id===c.id?'sel':''}" data-action="assign-release-connection" data-release="${selected.id}" data-connection="${c.id}">
            <strong>${escapeHtml(c.name)}</strong>
            <span>${escapeHtml(c.org)}/${escapeHtml(c.project)}</span>
          </button>`).join('')}
      </div>
    </div>` : ''}
    ${!selected ? emptyStateHTML('Choose a release', 'Select or add a release above before syncing.')
      : needsExplicitPick ? `<p class="side-sub">More than one ADO connection is configured — pick one for "${escapeHtml(selected.name)}" above before syncing.</p>`
      : !connection ? '<p class="side-sub">No ADO connection configured yet — click "Manage connections" to add one (Organization, Project, Personal Access Token).</p>'
      : `
    <div class="field compact">
      <label>Work item types this sync</label>
      <div class="sync-type-row">
        ${typeToggle('userStory', 'User stories', wit.userStory)}
        ${typeToggle('defect', 'Defects', wit.defect)}
        ${typeToggle('task', 'Tasks', wit.task)}
      </div>
    </div>
    <div class="ado-actions">
      <button class="side-btn primary" id="adoSyncBtn" ${state.adoSyncing?'disabled':''}>${state.adoSyncing ? 'Syncing…' : 'Sync from ADO'}</button>
    </div>
    `}
    ${state.adoSyncMsg ? `<div class="ado-msg ${/fail|error|check|missing|select|set |add |doesn't|rejected|couldn't/i.test(state.adoSyncMsg)?'warn':''}">${escapeHtml(state.adoSyncMsg)}</div>` : ''}
    ${lastSummary && lastSummary.message && lastSummary.message !== state.adoSyncMsg ? `<p class="field-hint-block">Last recorded result: ${escapeHtml(lastSummary.message)}</p>` : ''}
    <p class="field-hint-block">Personal Access Token stays in this browser. If sync cannot reach Azure DevOps, the usual cause is CORS (the browser blocks the org domain) or an expired PAT — a small local proxy or a token with Work Items: Read usually fixes it. This app does not sync Azure Test Plans / Test Cases.</p>
  </div>`;
}

/* ---------------------------------------------------------------------- */
/* Floating modals — New Task / Board email / Settings / Add-Edit teammate */
/* ---------------------------------------------------------------------- */

// Once a release is picked in the New Task modal, this narrows further:
// pick User Story or Defect, then the specific item — scoped to that
// release the same way the Release Testing pages resolve membership (see
// userStoryReleaseId/defectReleaseId in state.js) — so the task gets linked
// (userStoryId/defectId) instead of just tagged with a release name.
function newTaskLinkFieldHTML(state){
  if(!state.newTaskReleaseId) return '';
  const release = state.releases.find(r => r.id === state.newTaskReleaseId);
  if(!release) return '';
  const usById = new Map(state.userStories.map(u => [u.id, u]));
  const matchingUserStories = state.userStories.filter(us => userStoryReleaseId(us, state.releases) === release.id);
  const matchingDefects = state.defects.filter(d => defectReleaseId(d, state.releases, usById) === release.id);
  const type = state.newTaskWorkItemType;
  const items = type === 'userStory' ? matchingUserStories : type === 'defect' ? matchingDefects : [];
  const itemOptions = items.map(it => `<option value="${it.id}" ${state.newTaskLinkedItemId===it.id?'selected':''}>${escapeHtml(it.title)}</option>`).join('');
  return `
  <div class="field">
    <label>Link to (optional)</label>
    <div class="target-toggle">
      <button class="t-opt ${type==='userStory'?'sel':''}" data-action="set-new-task-item-type" data-type="userStory">User Story${matchingUserStories.length?` (${matchingUserStories.length})`:''}</button>
      <button class="t-opt ${type==='defect'?'sel':''}" data-action="set-new-task-item-type" data-type="defect">Defect${matchingDefects.length?` (${matchingDefects.length})`:''}</button>
    </div>
    ${type ? (items.length ? `
    <select class="new-task-link-select">
      <option value="">${type==='userStory' ? 'Select a User Story…' : 'Select a Defect…'}</option>
      ${itemOptions}
    </select>
    ` : `<div class="linked-item-empty">No ${type==='userStory'?'User Stories':'Defects'} in "${escapeHtml(release.name)}" yet.</div>`) : ''}
  </div>`;
}

function newTaskModalHTML(state){
  const tomorrowLabel = formatDisplay(shiftDate(state.dateStr, 1));
  return `
  <div class="modal-head">
    <h2>New task</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Title</label>
      <input type="text" id="taskInput" placeholder="What needs to happen?" maxlength="140" value="${escapeHtml(state.newTaskDraft.title)}" autocomplete="off">
      ${state.newTaskWarn ? `<div class="email-warn">${escapeHtml(state.newTaskWarn)}</div>` : ''}
    </div>
    <div class="modal-row">
      <div class="field">
        <label>Time (optional)</label>
        <input type="time" id="timeInput" value="${state.newTaskDraft.time}">
      </div>
      <div class="field">
        <label>Priority</label>
        ${priorityTriggerHTML(state, 'new', state.newPriority)}
      </div>
    </div>
    <div class="field">
      <label>Notes (optional)</label>
      <textarea id="taskNoteInput" class="add-note" placeholder="e.g. defect details from today's call" maxlength="400">${escapeHtml(state.newTaskNoteDraft)}</textarea>
    </div>
    <div class="field">
      <label>Assign</label>
      ${assignTriggerHTML(state, 'new', [...state.newTaskAssigneeIds], [...state.newTaskGroupIds])}
    </div>
    ${state.releases.length ? `
    <div class="field">
      <label>Release (optional)</label>
      ${releasePickerHTML(state, 'new', state.newTaskReleaseId)}
    </div>
    ${newTaskLinkFieldHTML(state)}
    ` : ''}
    <div class="field">
      <label>Add to</label>
      <div class="target-toggle">
        <button class="t-opt ${state.newTaskTarget==='today'?'sel':''}" data-action="set-target" data-target="today">Today</button>
        <button class="t-opt ${state.newTaskTarget==='tomorrow'?'sel':''}" data-action="set-target" data-target="tomorrow">Tomorrow · ${tomorrowLabel}</button>
      </div>
    </div>
  </div>
  <div class="modal-foot">
    <button type="button" class="add-btn" id="addBtn">${state.newTaskTarget==='tomorrow' ? "Add to tomorrow's board" : 'Add to board'}</button>
  </div>`;
}

function qaStatusModalHTML(state){
  const draft = state.qaStatusDraft || {
    reporterName: state.settings.yourName || '',
    userStoryId: '',
    executed: '', planned: '', pass: '', fail: '', blocked: '',
    status: 'onTrack',
    highlights: '', lowlights: '', planTomorrow: '', helpNeeded: ''
  };
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  const stories = selected
    ? state.userStories.filter(us => userStoryReleaseId(us, state.releases) === selected.id)
    : state.userStories.slice();
  const dateLabel = formatQaSubjectDate(state.dateStr);
  const previewName = (draft.reporterName || state.settings.yourName || 'Your Name').trim() || 'Your Name';
  const statusRadios = QA_STATUS_OPTIONS.map(o => `
    <label class="qa-status-opt ${draft.status===o.id?'sel':''}">
      <input type="radio" name="qaStatusChoice" value="${o.id}" ${draft.status===o.id?'checked':''}>
      <span>${o.emoji} ${escapeHtml(o.label)}</span>
    </label>`).join('');

  return `
  <div class="modal-head">
    <h2>Daily QA Status</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body qa-status-modal-body">
    <p class="side-sub">Subject preview: <strong>Daily QA Status – ${escapeHtml(previewName)} – ${dateLabel}</strong>. Draft saves for ${formatDisplay(state.dateStr)}. Test case counts auto-fill from the story's tester log for this day (still editable). ADO does not sync Test Cases.</p>
    <div class="modal-row">
      <div class="field">
        <label for="qaReporterName">Your name</label>
        <input type="text" id="qaReporterName" maxlength="80" value="${escapeHtml(draft.reporterName || '')}" placeholder="Your name">
      </div>
      <div class="field">
        <label for="qaDateStr">Date (board day)</label>
        <input type="text" id="qaDateStr" value="${escapeHtml(dateLabel)}" readonly title="Follows the board date — change the day on the Board to use another date">
      </div>
    </div>
    <div class="field">
      <label for="qaUserStoryId">User Story</label>
      <select id="qaUserStoryId" ${stories.length?'':'disabled'}>
        <option value="">${stories.length ? 'Select a user story…' : (selected ? 'No stories in this release' : 'Select a release first')}</option>
        ${stories.map(us => `<option value="${us.id}" ${draft.userStoryId===us.id?'selected':''}>${escapeHtml(storyUsLabel(us))}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Test Cases</label>
      <div class="qa-counts-grid">
        <label class="qa-count"><span>Executed</span><input type="number" id="qaExecuted" min="0" step="1" inputmode="numeric" value="${escapeHtml(draft.executed === '' || draft.executed === undefined || draft.executed === null ? '' : String(draft.executed))}"></label>
        <label class="qa-count"><span>Planned</span><input type="number" id="qaPlanned" min="0" step="1" inputmode="numeric" value="${escapeHtml(draft.planned === '' || draft.planned === undefined || draft.planned === null ? '' : String(draft.planned))}"></label>
        <label class="qa-count"><span>Pass</span><input type="number" id="qaPass" min="0" step="1" inputmode="numeric" value="${escapeHtml(draft.pass === '' || draft.pass === undefined || draft.pass === null ? '' : String(draft.pass))}"></label>
        <label class="qa-count"><span>Fail</span><input type="number" id="qaFail" min="0" step="1" inputmode="numeric" value="${escapeHtml(draft.fail === '' || draft.fail === undefined || draft.fail === null ? '' : String(draft.fail))}"></label>
        <label class="qa-count"><span>Blocked</span><input type="number" id="qaBlockedCount" min="0" step="1" inputmode="numeric" value="${escapeHtml(draft.blocked === '' || draft.blocked === undefined || draft.blocked === null ? '' : String(draft.blocked))}"></label>
      </div>
    </div>
    <div class="field">
      <label>Status</label>
      <div class="qa-status-row" role="radiogroup" aria-label="QA status">${statusRadios}</div>
    </div>
    <div class="field">
      <label for="qaHighlights">Highlights</label>
      <textarea id="qaHighlights" class="qa-textarea" maxlength="2000" placeholder="- What went well / completed today">${escapeHtml(draft.highlights || '')}</textarea>
    </div>
    <div class="field">
      <label for="qaLowlights">Lowlights / Issues</label>
      <textarea id="qaLowlights" class="qa-textarea" maxlength="2000" placeholder="- Defects found, blockers, delays">${escapeHtml(draft.lowlights || '')}</textarea>
    </div>
    <div class="field">
      <label for="qaPlanTomorrow">Plan for Tomorrow</label>
      <textarea id="qaPlanTomorrow" class="qa-textarea" maxlength="1200" placeholder="- What you'll focus on next">${escapeHtml(draft.planTomorrow || '')}</textarea>
    </div>
    <div class="field">
      <label for="qaHelpNeeded">Help Needed (if any)</label>
      <textarea id="qaHelpNeeded" class="qa-textarea" maxlength="1200" placeholder="- Env access, clarification, dependency">${escapeHtml(draft.helpNeeded || '')}</textarea>
    </div>
    ${state.qaStatusWarn ? `<div class="email-warn">${escapeHtml(state.qaStatusWarn)}</div>` : ''}
    ${state.qaStatusMsg ? `<div class="email-msg">${escapeHtml(state.qaStatusMsg)}</div>` : ''}
    ${state.aiAssistWarn && state.modal && state.modal.type === 'qaStatus' ? `<div class="email-warn">${escapeHtml(state.aiAssistWarn)}</div>` : ''}
  </div>
  <div class="modal-foot">
    <div class="modal-foot-row no-print">
      ${isAiConfigured(state.settings)
        ? `<button type="button" class="side-btn" data-action="draft-qa-highlights">Draft QA highlights</button>`
        : `<button type="button" class="side-btn" data-action="open-settings" title="Configure AI assist in Settings">Draft QA highlights</button>`}
      <button type="button" class="side-btn" data-action="print-page">Print / PDF</button>
      <button type="button" class="side-btn" data-action="save-qa-status">Save draft</button>
      <button type="button" class="add-btn" id="sendQaStatusBtn">Draft / open mail</button>
    </div>
  </div>`;
}

function boardEmailModalHTML(state){
  return `
  <div class="modal-head">
    <h2>Board email</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body board-email-modal-body">
    <div class="email-head">
      <svg class="email-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--accent)" stroke-width="1.6"/>
        <path d="M3 7l9 6 9-6" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div>
        <strong>Daily update</strong>
        <span>Status report for ${formatDisplay(state.dateStr)} — sent to the client lead or manager.</span>
      </div>
    </div>
    <div class="field">
      <label for="managerEmail">Manager's email</label>
      <input type="email" id="managerEmail" placeholder="manager@company.com" maxlength="200" value="${escapeHtml(state.settings.managerEmail)}">
    </div>
    <div class="field">
      <label for="yourName">Your name (optional)</label>
      <input type="text" id="yourName" placeholder="Your name" maxlength="80" value="${escapeHtml(state.settings.yourName)}">
    </div>
    <label class="checkbox-row"><input type="checkbox" id="carryForward" ${state.settings.carryForward?'checked':''}> Carry incomplete tasks to tomorrow when I send</label>
    <button class="send-btn" id="sendEmailBtn" type="button">Send email update</button>
    ${state.emailWarn ? `<div class="email-warn">${state.emailWarn}</div>` : ''}
    ${state.emailMsg ? `<div class="email-msg">${state.emailMsg}</div>` : ''}
    <p class="field-hint-block">Standup and QA Status are separate top-bar actions. Dashboard summary stays on the Dashboard page.</p>
  </div>`;
}

function settingsModalHTML(state){
  const ai = aiSettingsFrom(state.settings);
  return `
  <div class="modal-head">
    <h2>Settings</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body settings-modal-body">
    <div class="report-block">
      <div class="email-head">
        <svg class="email-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--accent)" stroke-width="1.6"/>
          <path d="M3 7l9 6 9-6" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div>
          <strong>Email identity</strong>
          <span>Used by Board email, Dashboard summary, and QA Status drafts. Stored only in this browser.</span>
        </div>
      </div>
      <div class="field">
        <label for="settingsManagerEmail">Manager's email</label>
        <input type="email" id="settingsManagerEmail" placeholder="manager@company.com" maxlength="200" value="${escapeHtml(state.settings.managerEmail)}">
      </div>
      <div class="field">
        <label for="settingsYourName">Your name (optional)</label>
        <input type="text" id="settingsYourName" placeholder="Your name" maxlength="80" value="${escapeHtml(state.settings.yourName)}">
      </div>
      <label class="checkbox-row"><input type="checkbox" id="settingsCarryForward" ${state.settings.carryForward?'checked':''}> Carry incomplete tasks to tomorrow when sending Board email</label>
    </div>

    <div class="report-divider"></div>

    <div class="report-block">
      <div class="email-head">
        <svg class="email-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="var(--accent)" stroke-width="1.6"/>
          <path d="M8 12h8M12 8v8" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <div>
          <strong>AI assist (optional)</strong>
          <span>Bring your own API key — stored only in this browser. Never auto-runs. Chrome Gemini Pro / sidebar login cannot be used here.</span>
        </div>
      </div>
      <div class="field">
        <label for="aiProviderSelect">Provider</label>
        <select id="aiProviderSelect">
          <option value="openai" ${ai.provider==='openai'?'selected':''}>OpenAI-compatible</option>
          <option value="gemini" ${ai.provider==='gemini'?'selected':''}>Gemini (via local proxy)</option>
        </select>
      </div>
      <div class="field">
        <label for="aiEndpointInput">Endpoint URL</label>
        <input type="url" id="aiEndpointInput" placeholder="${escapeHtml(AI_PROVIDER_PRESETS[ai.provider].endpoint)}" value="${escapeHtml(ai.endpoint)}">
      </div>
      <div class="field">
        <label for="aiApiKeyInput">API key</label>
        <input type="password" id="aiApiKeyInput" placeholder="${escapeHtml(AI_PROVIDER_PRESETS[ai.provider].keyPlaceholder)}" value="${escapeHtml(ai.apiKey)}">
      </div>
      <div class="field">
        <label for="aiModelInput">Model</label>
        <input type="text" id="aiModelInput" placeholder="${escapeHtml(AI_PROVIDER_PRESETS[ai.provider].model)}" value="${escapeHtml(ai.model)}">
      </div>
      <p class="field-hint-block">${ai.provider === 'gemini'
        ? 'Get a key at aistudio.google.com → Get API key. Run <code>python3 ai-proxy.py</code> while summarizing (Gemini blocks browser CORS). Endpoint should stay <code>http://127.0.0.1:8787/v1/chat/completions</code>. Model e.g. <code>gemini-2.0-flash</code>. Google One / Gemini Pro ≠ API access by itself.'
        : 'OpenAI-compatible chat completions URL + key. Browser CORS may block some hosts — a local proxy works best. Keys are stripped from backups.'}</p>
    </div>

    <div class="report-divider"></div>

    <div class="report-block">
      <div class="email-head">
        <div>
          <strong>Saved defect views</strong>
          <span>Chips on the Defects page. The last selected view is remembered here.</span>
        </div>
      </div>
      ${savedViewChipsHTML('defects', (state.settings.savedViews && state.settings.savedViews.defects) || DEFAULT_DEFECT_VIEWS, state.selectedDefectViewId || '')}
      <p class="field-hint-block">My / Critical open / In standup / Unassigned. Stories have their own chips on that page.</p>
    </div>
  </div>`;
}

function deliveryBannerHTML(state){
  const backup = backupReminderHTML(state);
  if(!state.standupMsg && !state.standupWarn && !backup) return '';
  return `
  <div class="delivery-banner" role="status">
    ${backup}
    ${state.standupWarn ? `<div class="email-warn">${escapeHtml(state.standupWarn)}</div>` : ''}
    ${state.standupMsg ? `<div class="email-msg">${escapeHtml(state.standupMsg)}</div>` : ''}
  </div>`;
}

function peopleReviewPageHTML(state){
  const {bounds, rows} = computePeopleReviews(state, state.peopleReviewPeriod || 'month');
  const period = state.peopleReviewPeriod || 'month';
  return `
  ${pageIntroHTML('Team', 'People review', `Rollups from local dated board + standup history for ${escapeHtml(bounds.label)}. Draft appreciation emails only — nothing is auto-sent.`)}
  <div class="glass-card release-us-card">
    <div class="side-card-head">
      <div>
        <h3>${escapeHtml(bounds.label)}</h3>
        <p class="side-sub">${escapeHtml(bounds.from)} → ${escapeHtml(bounds.to)} · tasks completed, standup days, defect touches, absences</p>
      </div>
      <div class="people-review-period">
        <button type="button" class="pill ${period==='month'?'active':''}" data-action="set-people-review-period" data-id="month">Month</button>
        <button type="button" class="pill ${period==='quarter'?'active':''}" data-action="set-people-review-period" data-id="quarter">Quarter</button>
        <button type="button" class="pill ${period==='year'?'active':''}" data-action="set-people-review-period" data-id="year">Year</button>
      </div>
    </div>
    ${state.peopleReviewWarn ? `<div class="email-warn">${state.peopleReviewWarn}</div>` : ''}
    ${state.peopleReviewMsg ? `<div class="email-msg">${state.peopleReviewMsg}</div>` : ''}
    ${testerLoadStripHTML(state)}
    ${!rows.length ? emptyStateHTML('No teammates yet', 'Open People from the Board to build the roster.') : `
    <div class="dash-table-wrap">
      <table class="people-review-table">
        <thead>
          <tr>
            <th>Person</th>
            <th class="num">Tasks done</th>
            <th class="num">Standup days</th>
            <th class="num">Defect touches</th>
            <th class="num">Absences</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.name)}</strong>${r.role ? `<div class="field-hint-block">${escapeHtml(r.role)}</div>` : ''}</td>
            <td class="num">${r.tasksComplete}</td>
            <td class="num">${r.standupDays}</td>
            <td class="num">${r.defectsTouched}</td>
            <td class="num">${r.absences}</td>
            <td><button type="button" class="side-btn sm" data-action="draft-appreciation" data-id="${r.id}">Draft appreciation email</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-foot" style="margin-top:14px">
      <button type="button" class="send-btn" data-action="draft-appreciation-all">Draft appreciation for all</button>
      <p class="people-review-note">Opens a mail-app draft (clipboard only if the message is too large). Nothing is auto-sent.</p>
    </div>`}
  </div>`;
}

function memberModalHTML(state){
  const editing = state.modal.memberId ? state.team.find(m => m.id === state.modal.memberId) : null;
  // Editing pre-fills from the record being edited (its identity doesn't
  // change across re-renders). Adding has no such backing record, so it
  // mirrors state.memberDraft instead — otherwise a failed validation (e.g.
  // a bad email) would wipe the name/role the user already typed.
  const name = editing ? editing.name : state.memberDraft.name;
  const role = editing ? (editing.role||'') : state.memberDraft.role;
  const email = editing ? (editing.email||'') : state.memberDraft.email;
  return `
  <div class="modal-head">
    <h2>${editing ? 'Edit teammate' : 'Add teammate'}</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Full name</label>
      <input type="text" id="memberNameInput" placeholder="Full name" maxlength="60" value="${escapeHtml(name)}">
    </div>
    <div class="field">
      <label>Role (optional)</label>
      <input type="text" id="memberRoleInput" placeholder="Role" maxlength="60" value="${escapeHtml(role)}">
    </div>
    <div class="field">
      <label>Email (optional)</label>
      <input type="email" id="memberEmailInput" placeholder="name@company.com" maxlength="200" value="${escapeHtml(email)}">
    </div>
    ${state.teamWarn ? `<div class="email-warn">${state.teamWarn}</div>` : ''}
    ${editing ? `
    <div class="field">
      <label>OOO ranges</label>
      <p class="field-hint-block">These dates auto-mark this person absent on the Board standup and show group-peer delegate suggestions. They do not replace the per-day toggle.</p>
      ${(editing.ooo || []).length
        ? `<ul class="ooo-list">${editing.ooo.map((r, i) => `<li>${escapeHtml(r.from)} → ${escapeHtml(r.to)} <button type="button" class="mini-btn" data-action="remove-ooo" data-id="${editing.id}" data-index="${i}" title="Remove range">✕</button></li>`).join('')}</ul>`
        : `<p class="muted-hint">No OOO ranges yet.</p>`}
      <div class="ooo-add-row">
        <input type="date" id="oooFromInput" aria-label="OOO from">
        <input type="date" id="oooToInput" aria-label="OOO to">
        <button type="button" class="side-btn sm" id="addOooBtn">Add range</button>
      </div>
    </div>` : ''}
  </div>
  <div class="modal-foot">
    <button class="add-btn" id="saveMemberBtn">${editing ? 'Save changes' : 'Add teammate'}</button>
  </div>`;
}

function releaseModalHTML(state){
  const editing = state.modal.memberId ? state.releases.find(r => r.id === state.modal.memberId) : null;
  const deleteArmed = editing && state.deleteArmedIds.has(editing.id);
  const name = editing ? editing.name : state.releaseDraft.name;
  const targetDate = editing ? (editing.targetDate||'') : state.releaseDraft.targetDate;
  const iterationPath = editing ? (editing.iterationPath||'') : state.releaseDraft.iterationPath;
  const connectionId = editing ? (editing.connectionId||'') : state.releaseDraft.connectionId;
  const connections = state.settings.adoConnections || [];
  const connectionOptions = connections.map(c => `<option value="${c.id}" ${connectionId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
  return `
  <div class="modal-head">
    <h2>${editing ? 'Edit release' : 'Add release'}</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Release name</label>
      <input type="text" id="releaseNameInput" placeholder="e.g. R2026.09" maxlength="60" value="${escapeHtml(name)}">
    </div>
    <div class="field">
      <label>Target date (optional)</label>
      <input type="date" id="releaseDateInput" value="${targetDate}">
    </div>
    <div class="field">
      <label>ADO iteration path (optional)</label>
      <input type="text" id="releaseIterationInput" placeholder="MyProject\\Sprint 12" value="${escapeHtml(iterationPath)}">
    </div>
    ${connections.length ? `
    <div class="field">
      <label>ADO connection${connections.length > 1 ? '' : ' (optional)'}</label>
      <select id="releaseConnectionInput"><option value="">${connections.length === 1 ? `Auto (${escapeHtml(connections[0].name)})` : 'Select connection'}</option>${connectionOptions}</select>
    </div>
    ` : ''}
    ${state.releaseWarn ? `<div class="email-warn">${state.releaseWarn}</div>` : ''}
  </div>
  <div class="modal-foot">
    ${editing ? `
    <div class="modal-foot-row">
      <button class="side-btn danger ${deleteArmed?'armed':''}" data-action="remove-release" data-id="${editing.id}">${deleteArmed ? 'Click again to delete' : 'Delete release'}</button>
      <button class="add-btn" id="saveReleaseBtn">Save changes</button>
    </div>
    ` : `<button class="add-btn" id="saveReleaseBtn">Add release</button>`}
  </div>`;
}

function adoConnectionsListModalHTML(state){
  const connections = state.settings.adoConnections || [];
  return `
  <div class="modal-head">
    <h2>ADO connections</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <p class="side-sub">Each release picks which connection it syncs from — with only one configured, every release uses it automatically. Personal Access Tokens stay in this browser only; never included in an exported backup.</p>
    ${connections.length ? connections.map(c => `
    <div class="us-card">
      <div class="us-head">
        <div class="us-title">${escapeHtml(c.name)}</div>
        <button class="edit-btn" data-action="edit-ado-connection" data-id="${c.id}" title="Edit">✎</button>
        <button class="del-btn ${state.deleteArmedIds.has(c.id)?'armed':''}" data-action="remove-ado-connection" data-id="${c.id}" title="${state.deleteArmedIds.has(c.id)?'Click again to permanently delete':'Remove'}">${state.deleteArmedIds.has(c.id)?'Delete?':'✕'}</button>
      </div>
      <p class="side-sub">${escapeHtml(c.org)}/${escapeHtml(c.project)}</p>
    </div>`).join('') : '<div class="empty small">No connections yet.</div>'}
  </div>
  <div class="modal-foot">
    <button class="add-btn" data-action="add-ado-connection">+ Connection</button>
  </div>`;
}

function adoConnectionFormModalHTML(state){
  const editing = state.modal.memberId ? (state.settings.adoConnections || []).find(c => c.id === state.modal.memberId) : null;
  const deleteArmed = editing && state.deleteArmedIds.has(editing.id);
  const name = editing ? editing.name : state.adoConnectionDraft.name;
  const org = editing ? editing.org : state.adoConnectionDraft.org;
  const project = editing ? editing.project : state.adoConnectionDraft.project;
  const pat = editing ? editing.pat : state.adoConnectionDraft.pat;
  const wit = editing ? editing.workItemTypes : state.adoConnectionDraft.workItemTypes;
  return `
  <div class="modal-head">
    <h2>${editing ? 'Edit connection' : 'Add connection'}</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Name</label>
      <input type="text" id="adoConnNameInput" placeholder="e.g. Acme Corp" maxlength="40" value="${escapeHtml(name)}">
    </div>
    <div class="field">
      <label>Organization</label>
      <input type="text" id="adoConnOrgInput" placeholder="my-org" value="${escapeHtml(org)}">
    </div>
    <div class="field">
      <label>Project</label>
      <input type="text" id="adoConnProjectInput" placeholder="MyProject" value="${escapeHtml(project)}">
    </div>
    <div class="field">
      <label>Personal Access Token</label>
      <input type="password" id="adoConnPatInput" placeholder="••••••••" value="${escapeHtml(pat)}">
    </div>
    <div class="field"><label>User Story work item type</label><input type="text" id="adoConnUsTypeInput" value="${escapeHtml(wit.userStory)}"></div>
    <div class="field">
      <label>Defect work item type</label>
      <input type="text" id="adoConnDefectTypeInput" value="${escapeHtml(wit.defect)}">
      <p class="field-hint-block">Usually <strong>Bug</strong> (Agile/Scrum) or <strong>Defect</strong> (CMMI). Stats boards use whatever you sync here — not a separate Bug list.</p>
    </div>
    <div class="field"><label>Task work item type</label><input type="text" id="adoConnTaskTypeInput" value="${escapeHtml(wit.task)}"></div>
    <p class="field-hint-block">Sync covers User Story, Defect/Bug, and Task only. Test Case, Impediment, Issue, and PBI are not synced — see Dashboard notes if you need those for reporting.</p>
    ${state.adoConnectionWarn ? `<div class="email-warn">${state.adoConnectionWarn}</div>` : ''}
  </div>
  <div class="modal-foot">
    ${editing ? `
    <div class="modal-foot-row">
      <button class="side-btn danger ${deleteArmed?'armed':''}" data-action="remove-ado-connection" data-id="${editing.id}">${deleteArmed ? 'Click again to delete' : 'Delete connection'}</button>
      <button class="add-btn" id="saveAdoConnectionBtn">Save changes</button>
    </div>
    ` : `<button class="add-btn" id="saveAdoConnectionBtn">Add connection</button>`}
  </div>`;
}

function userStoryModalHTML(state){
  const editing = state.modal.memberId ? state.userStories.find(u => u.id === state.modal.memberId) : null;
  const title = editing ? editing.title : state.userStoryDraft.title;
  const releaseId = editing ? (editing.releaseId||'') : state.userStoryDraft.releaseId;
  const assigneeId = editing ? (editing.assigneeId||'') : state.userStoryDraft.assigneeId;
  const iterationPath = editing ? (editing.iterationPath||'') : state.userStoryDraft.iterationPath;
  const selectedGroups = editing ? (editing.groupIds || []) : (state.userStoryDraft.groupIds || []);
  const releaseOptions = state.releases.map(r => `<option value="${r.id}" ${releaseId===r.id?'selected':''}>${escapeHtml(r.name)}</option>`).join('');
  const assigneeOptions = state.team.map(m => `<option value="${m.id}" ${assigneeId===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join('');
  return `
  <div class="modal-head">
    <h2>${editing ? 'Edit user story' : 'Add user story'}</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Title</label>
      <input type="text" id="usTitleInput" placeholder="What's the story?" maxlength="140" value="${escapeHtml(title)}">
    </div>
    <div class="field">
      <label>Release</label>
      <select id="usReleaseInput"><option value="">No release</option>${releaseOptions}</select>
    </div>
    <div class="field">
      <label>Primary assignee (optional)</label>
      <select id="usAssigneeInput"><option value="">Unassigned</option>${assigneeOptions}</select>
    </div>
    ${state.groups.length ? `
    <div class="field">
      <label>Executing groups</label>
      <div class="group-toggle-row" id="usGroupToggles">
        ${state.groups.map(g => {
          const sel = selectedGroups.includes(g.id);
          return `<button type="button" class="t-opt ${sel?'sel':''}" data-action="draft-story-group" data-group="${g.id}">${escapeHtml(g.name)}</button>`;
        }).join('')}
      </div>
    </div>` : ''}
    <div class="field">
      <label>ADO iteration path (optional)</label>
      <input type="text" id="usIterationInput" placeholder="MyProject\\Sprint 12" value="${escapeHtml(iterationPath)}">
    </div>
  </div>
  <div class="modal-foot">
    <button class="add-btn" id="saveUserStoryBtn">${editing ? 'Save changes' : 'Add user story'}</button>
  </div>`;
}

function defectModalHTML(state){
  const editing = state.modal.memberId ? state.defects.find(d => d.id === state.modal.memberId) : null;
  const title = editing ? editing.title : state.defectDraft.title;
  const userStoryId = editing ? (editing.userStoryId||'') : state.defectDraft.userStoryId;
  const severity = editing ? editing.severity : state.defectDraft.severity;
  const usOptions = state.userStories.map(u => `<option value="${u.id}" ${userStoryId===u.id?'selected':''}>${escapeHtml(u.title)}</option>`).join('');
  const severityOptions = SEVERITIES.map(s => `<option value="${s}" ${severity===s?'selected':''}>${SEVERITY_LABELS[s]}</option>`).join('');
  const assigneeId = editing ? (editing.assigneeId||'') : state.defectDraft.assigneeId;
  const assigneeOptions = state.team.map(m => `<option value="${m.id}" ${assigneeId===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join('');
  const iterationPath = editing ? (editing.iterationPath||'') : state.defectDraft.iterationPath;
  return `
  <div class="modal-head">
    <h2>${editing ? 'Edit defect' : 'Add defect'}</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>Title</label>
      <input type="text" id="defectTitleInput" placeholder="What broke?" maxlength="140" value="${escapeHtml(title)}">
    </div>
    <div class="field">
      <label>User Story</label>
      <select id="defectUsInput"><option value="">Unlinked</option>${usOptions}</select>
    </div>
    <div class="field">
      <label>Severity</label>
      <select id="defectSeverityInput">${severityOptions}</select>
    </div>
    <div class="field">
      <label>Assignee (optional)</label>
      <select id="defectAssigneeInput"><option value="">Unassigned</option>${assigneeOptions}</select>
    </div>
    <div class="field">
      <label>ADO iteration path (optional)</label>
      <input type="text" id="defectIterationInput" placeholder="MyProject\\Sprint 12" value="${escapeHtml(iterationPath)}">
    </div>
  </div>
  <div class="modal-foot">
    <button class="add-btn" id="saveDefectBtn">${editing ? 'Save changes' : 'Add defect'}</button>
  </div>`;
}

function commandPaletteModalHTML(state){
  const q = (state.commandPaletteQuery || '').trim().toLowerCase();
  const items = [
    ...VIEW_NAV.map(v => ({action: 'switch-view', id: v.id, label: v.label, hint: 'View'})),
    {action: 'open-settings', id: '', label: 'Settings', hint: 'Modal'},
    {action: 'open-people', id: '', label: 'People', hint: 'Modal'},
    {action: 'open-groups', id: '', label: 'Groups', hint: 'Modal'},
    {action: 'open-new-task', id: '', label: 'New task', hint: 'Modal'},
    {action: 'open-qa-status', id: '', label: 'Daily QA Status', hint: 'Modal'},
    {action: 'open-board-email', id: '', label: 'Board email', hint: 'Modal'}
  ].filter(it => !q || it.label.toLowerCase().includes(q));
  return `
  <div class="modal-head">
    <h2>Jump to</h2>
    <button class="modal-close" data-action="close-modal" title="Close">✕</button>
  </div>
  <div class="modal-body">
    <input type="text" id="commandPaletteInput" class="picker-search" data-role="command-palette" placeholder="Filter views and actions…" value="${escapeHtml(state.commandPaletteQuery || '')}" aria-label="Command palette">
    <div class="picker-list command-palette-list">
      ${items.length ? items.map(it => `<button type="button" class="picker-row" data-action="command-go" data-go="${it.action}" data-id="${it.id}">
        <span class="picker-row-label"><strong>${escapeHtml(it.label)}</strong><span>${escapeHtml(it.hint)}</span></span>
      </button>`).join('') : '<div class="picker-empty">No matches</div>'}
    </div>
    <p class="field-hint-block">⌘/Ctrl+K opens this. j / k walks standup people when you are not typing.</p>
  </div>`;
}

function modalContentHTML(state){
  if(!state.modal) return '';
  if(state.modal.type === 'commandPalette') return commandPaletteModalHTML(state);
  if(state.modal.type === 'newTask') return newTaskModalHTML(state);
  if(state.modal.type === 'boardEmail') return boardEmailModalHTML(state);
  if(state.modal.type === 'settings') return settingsModalHTML(state);
  if(state.modal.type === 'qaStatus') return qaStatusModalHTML(state);
  if(state.modal.type === 'member') return memberModalHTML(state);
  if(state.modal.type === 'people') return peopleModalHTML(state);
  if(state.modal.type === 'groups') return groupsModalHTML(state);
  if(state.modal.type === 'addRelease') return releaseModalHTML(state);
  if(state.modal.type === 'addUserStory') return userStoryModalHTML(state);
  if(state.modal.type === 'addDefect') return defectModalHTML(state);
  if(state.modal.type === 'manageAdoConnections') return adoConnectionsListModalHTML(state);
  if(state.modal.type === 'adoConnectionForm') return adoConnectionFormModalHTML(state);
  if(state.modal.type === 'manageBlueprint') return blueprintListModalHTML(state);
  if(state.modal.type === 'blueprintItemForm') return blueprintItemFormModalHTML(state);
  return '';
}

/* ---------------------------------------------------------------------- */
/* Floating popover portal — renders at the #app root (see render()), not  */
/* nested inside whichever trigger opened it, then gets positioned with    */
/* position:fixed in attachEvents() based on the trigger's actual position */
/* on screen. This is what keeps it from being clipped by an accordion's   */
/* overflow:hidden or losing a z-index fight to the next glass card.       */
/* ---------------------------------------------------------------------- */

function floatingPopoverBodyHTML(state){
  if(state.priorityDropdownFor !== null){
    const forId = state.priorityDropdownFor;
    return priorityMenuBodyHTML(forId, priorityFor(state, forId));
  }
  if(state.assignPickerFor !== null){
    const forId = state.assignPickerFor;
    const ctx = assignContextFor(state, forId);
    return assignPopoverBodyHTML(state, forId, ctx.selectedMemberIds, ctx.selectedGroupIds, ctx.personAction, ctx.groupAction);
  }
  if(state.standupPickerOpen){
    return standupPersonPopoverBodyHTML(state);
  }
  return '';
}

function floatingPopoverHTML(state){
  if(state.priorityDropdownFor !== null){
    return `<div class="pd-menu floating-popover" id="floatingPopover">${floatingPopoverBodyHTML(state)}</div>`;
  }
  if(state.assignPickerFor !== null){
    return `<div class="picker-popover floating-popover" id="floatingPopover">${floatingPopoverBodyHTML(state)}</div>`;
  }
  if(state.standupPickerOpen){
    return `<div class="picker-popover floating-popover" id="floatingPopover">${floatingPopoverBodyHTML(state)}</div>`;
  }
  return '';
}

function popoverIdentity(state){
  if(state.priorityDropdownFor !== null) return `priority:${state.priorityDropdownFor}`;
  if(state.assignPickerFor !== null) return `assign:${state.assignPickerFor}`;
  if(state.standupPickerOpen) return 'standup';
  return '';
}

function modalIdentity(state){
  if(!state.modal) return '';
  return `${state.modal.type}:${state.modal.memberId || ''}:${state.modal.returnTo || ''}`;
}

function chromeHTML(state){
  const viewLabel = VIEW_TITLES[state.view] || 'Operations';
  const yourName = ((state.settings && state.settings.yourName) || '').trim();
  const displayName = yourName || 'You';
  const userInitials = yourName ? escapeHtml(initials(yourName)) : 'NS';

  const navLinks = VIEW_NAV.map(v => `
    <button type="button"
      class="app-nav-link ${state.view===v.id?'active':''}"
      data-action="switch-view"
      data-id="${v.id}"
      ${state.view===v.id?'aria-current="page"':''}>
      <span class="app-nav-icon">${NAV_ICONS[v.id] || ''}</span>
      <span class="app-nav-label">${v.label}</span>
    </button>`).join('');

  return `
    <aside class="app-sidebar ${state.settings.sidebarCollapsed?'is-rail':''}" aria-label="Workspace">
      <div class="app-sidebar-brand">
        <svg class="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect width="36" height="36" rx="10" fill="var(--accent)"/>
          <circle cx="18" cy="18" r="10.5" stroke="#fff" stroke-width="1.4"/>
          <path d="M18 8.5 L20.2 14.2 L26.2 14.4 L21.4 18.2 L23 24 L18 20.8 L13 24 L14.6 18.2 L9.8 14.4 L15.8 14.2 Z" fill="#fff"/>
        </svg>
        <div class="app-sidebar-brand-text">
          <strong>${escapeHtml(APP_NAME)}</strong>
          <span>${escapeHtml(APP_TAGLINE)}</span>
        </div>
        <button type="button" class="sidebar-collapse-btn" data-action="toggle-sidebar" title="${state.settings.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}" aria-pressed="${state.settings.sidebarCollapsed?'true':'false'}">${state.settings.sidebarCollapsed ? '›' : '‹'}</button>
      </div>

      <p class="app-sidebar-section">Workspace</p>
      <nav class="app-sidebar-nav" aria-label="Primary">
        ${navLinks}
      </nav>

      <div class="app-sidebar-foot">
        <button type="button" class="app-nav-link" data-action="open-settings" title="Email identity &amp; AI assist">
          <span class="app-nav-icon">${NAV_ICONS.settings}</span>
          <span class="app-nav-label">Settings</span>
        </button>
        <div class="app-sidebar-user" title="${escapeHtml(displayName)}">
          <span class="avatar" style="--avatar-color:var(--accent)">${userInitials}</span>
          <div class="app-sidebar-user-text">
            <strong>${escapeHtml(displayName)}</strong>
            <span>${yourName ? 'Delivery lead' : 'Set your name in Settings'}</span>
          </div>
        </div>
      </div>
    </aside>

    <div class="app-topbar">
      <div class="app-topbar-row">
        <div class="app-breadcrumb" aria-label="Breadcrumb">
          <span class="app-breadcrumb-root">${escapeHtml(APP_NAME)}</span>
          <span class="app-breadcrumb-sep" aria-hidden="true">/</span>
          <strong class="app-breadcrumb-current">${escapeHtml(viewLabel)}</strong>
        </div>
        <div class="app-topbar-actions">
          <button type="button" class="btn-glass no-print" data-action="open-command-palette" title="Jump to a view (⌘/Ctrl+K)">Search</button>
          ${globalReleaseControlHTML(state)}
          <div class="send-cluster" role="group" aria-label="Send emails">
            <button type="button" class="btn-glass" data-action="open-board-email" title="Daily board status update to your manager">Board email</button>
            <button type="button" class="btn-glass" data-action="send-standup-email" title="Email today's standup to the roster">Standup email</button>
            <button type="button" class="btn-glass btn-send-primary" data-action="open-qa-status" title="Compose Daily QA Status">QA Status</button>
          </div>
          <button type="button" class="btn-primary" data-action="open-new-task">New task</button>
        </div>
      </div>
      ${deliveryBannerHTML(state)}
    </div>
  `;
}

function pageHTML(state){
  return `
    ${state.view === 'userStories' ? `<div class="page-shell">${userStoriesPageHTML(state)}</div>`
      : state.view === 'defects' ? `<div class="page-shell">${defectsPageHTML(state)}</div>`
      : state.view === 'defectsDashboard' ? `<div class="page-shell">${defectsDashboardPageHTML(state)}</div>`
      : state.view === 'adoSync' ? `<div class="page-shell">${adoSyncPageHTML(state)}</div>`
      : state.view === 'peopleReview' ? `<div class="page-shell">${peopleReviewPageHTML(state)}</div>`
      : boardPageHTML(state)}

    <div class="footer-wrap">
      <div class="footer">
        <span>${escapeHtml(APP_NAME)} · saved locally in this browser</span>
        <div class="footer-actions">
          <button id="exportBtn">Export backup</button>
          <label class="footer-link" for="importFile">Import backup</label>
          <input type="file" id="importFile" accept="application/json" hidden>
          <button id="exportCsvBtn">Export CSV</button>
          <label class="footer-link" for="importCsvFile">Import CSV</label>
          <input type="file" id="importCsvFile" accept=".csv,text/csv" hidden>
          <button class="${state.clearArmed?'warn':''}" id="clearDay">${state.clearArmed ? 'Click again to clear this day' : 'Clear day'}</button>
        </div>
      </div>
      ${state.csvMsg ? `<div class="csv-msg">${escapeHtml(state.csvMsg)}</div>` : ''}
    </div>
  `;
}

function ensureAppHosts(app, state){
  let shell = document.getElementById('appShell');
  let chrome = document.getElementById('appChrome');
  let page = document.getElementById('appPage');
  let popoverHost = document.getElementById('popoverHost');
  let modalHost = document.getElementById('modalHost');
  if(shell && chrome && page && popoverHost && modalHost){
    shell.classList.add('app-shell');
    shell.classList.toggle('sidebar-collapsed', !!(state && state.settings && state.settings.sidebarCollapsed));
    chrome.classList.add('app-chrome');
    page.classList.add('app-page');
    return {shell, chrome, page, popoverHost, modalHost};
  }
  app.innerHTML = `<div id="appShell" class="app-shell"><div id="appChrome" class="app-chrome"></div><div id="appPage" class="app-page"></div></div><div id="popoverHost"></div><div id="modalHost"></div>`;
  const created = {
    shell: document.getElementById('appShell'),
    chrome: document.getElementById('appChrome'),
    page: document.getElementById('appPage'),
    popoverHost: document.getElementById('popoverHost'),
    modalHost: document.getElementById('modalHost')
  };
  created.shell.classList.toggle('sidebar-collapsed', !!(state && state.settings && state.settings.sidebarCollapsed));
  return created;
}

function captureFocus(root){
  const el = document.activeElement;
  if(!el || !root || !root.contains(el)) return null;
  const tag = el.tagName;
  if(tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return null;
  return {
    id: el.id || '',
    role: el.dataset.role || '',
    member: el.dataset.member || '',
    field: el.dataset.field || '',
    dataId: el.dataset.id || '',
    name: el.getAttribute('name') || '',
    tag,
    type: el.getAttribute('type') || '',
    selStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
    selEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
    scrollTop: el.scrollTop || 0
  };
}

function restoreFocus(snap){
  if(!snap) return false;
  let el = null;
  if(snap.id) el = document.getElementById(snap.id);
  if(!el && snap.role) el = document.querySelector(`[data-role="${snap.role}"]`);
  if(!el && snap.member && snap.field){
    el = document.querySelector(`.standup-input[data-member="${snap.member}"][data-field="${snap.field}"]`);
  }
  if(!el && snap.member && snap.tag === 'SELECT'){
    el = document.querySelector(`.standup-task-link[data-member="${snap.member}"]`);
  }
  if(!el && snap.dataId && snap.field){
    el = document.querySelector(`[data-id="${snap.dataId}"][data-field="${snap.field}"]`);
  }
  if(!el && snap.dataId && snap.tag === 'TEXTAREA'){
    el = document.querySelector(`textarea[data-id="${snap.dataId}"]`);
  }
  if(!el && snap.name) el = document.querySelector(`${snap.tag.toLowerCase()}[name="${snap.name}"]`);
  if(!el) return false;
  try{ el.focus({preventScroll: true}); }catch(e){ el.focus(); }
  if(snap.selStart !== null && typeof el.setSelectionRange === 'function'){
    try{ el.setSelectionRange(snap.selStart, snap.selEnd ?? snap.selStart); }catch(e){ /* some input types */ }
  }
  if(typeof snap.scrollTop === 'number') el.scrollTop = snap.scrollTop;
  return true;
}

function syncPopoverHost(popoverHost, state){
  const identity = popoverIdentity(state);
  const prev = popoverHost.dataset.popoverId || '';
  if(!identity){
    popoverHost.innerHTML = '';
    popoverHost.dataset.popoverId = '';
    return {popoverJustOpened: false};
  }
  const existing = document.getElementById('floatingPopover');
  if(existing && prev === identity){
    existing.innerHTML = floatingPopoverBodyHTML(state);
    existing.classList.add('is-settled');
    return {popoverJustOpened: false, popoverPatched: true};
  }
  popoverHost.innerHTML = floatingPopoverHTML(state);
  popoverHost.dataset.popoverId = identity;
  return {popoverJustOpened: true};
}

function syncModalHost(modalHost, state){
  const identity = modalIdentity(state);
  const prev = modalHost.dataset.modalId || '';
  if(!identity){
    modalHost.innerHTML = '';
    modalHost.dataset.modalId = '';
    return {modalJustOpened: false};
  }
  const content = modalContentHTML(state);
  const existing = document.getElementById('modalOverlay');
  if(existing && prev === identity){
    const panel = existing.querySelector('.modal-panel');
    const scrollTop = panel ? panel.scrollTop : 0;
    if(panel){
      panel.innerHTML = content;
      panel.classList.add('is-settled');
      panel.scrollTop = scrollTop;
    }
    return {modalJustOpened: false, modalPatched: true};
  }
  modalHost.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-panel glass-card">${content}</div></div>`;
  modalHost.dataset.modalId = identity;
  return {modalJustOpened: true};
}

/* ---------------------------------------------------------------------- */
/* Top-level render                                                        */
/* ---------------------------------------------------------------------- */

// opts.scope: 'full' | 'shell' | 'modal' | 'popover'
// Soft scopes avoid tearing down unrelated chrome (modal stays mounted
// while the board updates; popover/modal search only patches their host).
export function render(state, handlers, opts = {}){
  bindGlobalListeners(state, handlers);

  const app = document.getElementById('app');
  const scope = opts.scope || 'full';
  const focusSnap = captureFocus(app);
  const {chrome, page, popoverHost, modalHost} = ensureAppHosts(app, state);

  const prevCardRects = new Map();
  if(scope === 'full' || scope === 'shell' || scope === 'page'){
    page.querySelectorAll('.card[data-task-id]').forEach(el => {
      prevCardRects.set(el.dataset.taskId, el.getBoundingClientRect());
    });
  }

  document.title = `${APP_NAME} — ${VIEW_TITLES[state.view] || 'Operations'}`;

  let modalJustOpened = false;
  let popoverJustOpened = false;

  if(scope === 'full'){
    chrome.innerHTML = chromeHTML(state);
    page.innerHTML = pageHTML(state);
  }else if(scope === 'shell' || scope === 'page'){
    // Keep topbar/nav mounted across board updates; fill chrome once if empty
    // (first paint) or when explicitly refreshing it.
    if(!chrome.innerHTML || opts.refreshChrome || scope === 'shell'){
      chrome.innerHTML = chromeHTML(state);
    }
    page.innerHTML = pageHTML(state);
  }

  if(scope === 'full' || scope === 'popover' || scope === 'modal' || scope === 'shell' || scope === 'page'){
    const pop = syncPopoverHost(popoverHost, state);
    popoverJustOpened = !!pop.popoverJustOpened;
  }

  if(scope === 'full' || scope === 'modal'){
    const mod = syncModalHost(modalHost, state);
    modalJustOpened = !!mod.modalJustOpened;
  }else if(scope === 'shell' || scope === 'page'){
    // Keep an open modal shell intact during board/shell updates so fields
    // and enter animations don't flash. Remount only if identity drifted.
    const identity = modalIdentity(state);
    if(!identity){
      modalHost.innerHTML = '';
      modalHost.dataset.modalId = '';
    }else if(modalHost.dataset.modalId !== identity){
      const mod = syncModalHost(modalHost, state);
      modalJustOpened = !!mod.modalJustOpened;
    }
  }

  attachEvents(state, handlers, {
    autofocusModal: modalJustOpened,
    autofocusPopover: popoverJustOpened
  });

  if(scope === 'full' || scope === 'shell' || scope === 'page'){
    animateCardChanges(page, prevCardRects);
  }

  const restored = restoreFocus(focusSnap);
  if(!restored && modalJustOpened){
    const firstField = document.querySelector('#modalOverlay input:not([type="hidden"]):not([readonly]), #modalOverlay textarea, #modalOverlay select');
    if(firstField){
      try{ firstField.focus({preventScroll: true}); }catch(e){ firstField.focus(); }
    }
  }
}

// FLIP (First-Last-Invert-Play): every render rebuilds the whole board's
// innerHTML from scratch, so there's no DOM continuity to animate across a
// reorder/status-change/priority-move on its own. This captures each card's
// on-screen position before the rebuild and, if it moved, plays the delta
// back as a transform transition — cheap when nothing moved (most renders),
// since the threshold check below just no-ops. A task id with no prior
// entry (a genuinely new card) gets a fade/slide-in instead of a FLIP.
function animateCardChanges(container, prevRects){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  container.querySelectorAll('.card[data-task-id]').forEach(el => {
    const id = el.dataset.taskId;
    const prev = prevRects.get(id);
    if(!prev){
      el.classList.add('card-enter');
      el.addEventListener('animationend', () => el.classList.remove('card-enter'), {once: true});
      return;
    }
    const next = el.getBoundingClientRect();
    const dx = prev.left - next.left, dy = prev.top - next.top;
    if(Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect(); // force a reflow so the starting transform is committed/painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform .32s cubic-bezier(.2,.7,.3,1)';
        el.style.transform = '';
        el.addEventListener('transitionend', () => { el.style.transition = ''; }, {once: true});
      });
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Event wiring                                                            */
/* ---------------------------------------------------------------------- */

function attachEvents(state, handlers, opts = {}){
  const autofocusModal = !!opts.autofocusModal;
  const autofocusPopover = !!opts.autofocusPopover;

  // Position (and reveal) the popover portal first — it starts
  // visibility:hidden, and a hidden element can't reliably take
  // programmatic focus, so this has to happen before the search-input
  // .focus() calls further down.
  positionFloatingPopover(state);

  // These only exist in board view — other views replace the day shell.
  const prevDayBtn = document.getElementById('prevDay');
  if(prevDayBtn){
    prevDayBtn.onclick = handlers.onPrevDay;
    document.getElementById('nextDay').onclick = handlers.onNextDay;
    document.getElementById('pillYesterday').onclick = handlers.onPillYesterday;
    document.getElementById('pillToday').onclick = handlers.onPillToday;
    document.getElementById('pillTomorrow').onclick = handlers.onPillTomorrow;
  }

  const bpBtn = document.querySelector('.bp-btn');
  if(bpBtn) bpBtn.onclick = () => handlers.onLoadBlueprint(state.blueprintSchedule || []);

  // New Task modal fields (present only while that modal is open)
  const input = document.getElementById('taskInput');
  if(input){
    const timeInput = document.getElementById('timeInput');
    const noteInput = document.getElementById('taskNoteInput');
    const addBtn = document.getElementById('addBtn');
    const doAdd = () => handlers.onAddTask(input.value, timeInput.value, noteInput.value);
    addBtn.onclick = doAdd;
    input.onkeydown = (e) => { if(e.key === 'Enter') doAdd(); };
    input.oninput = () => {
      state.newTaskDraft.title = input.value;
      if(state.newTaskWarn) state.newTaskWarn = '';
    };
    timeInput.oninput = () => { state.newTaskDraft.time = timeInput.value; };
    noteInput.oninput = () => { state.newTaskNoteDraft = noteInput.value; };
    if(autofocusModal) input.focus();
  }

  // Board email + Settings modal fields (present only while those modals are open)
  const mgrInput = document.getElementById('managerEmail') || document.getElementById('settingsManagerEmail');
  if(mgrInput){
    const nameInput = document.getElementById('yourName') || document.getElementById('settingsYourName');
    const carryInput = document.getElementById('carryForward') || document.getElementById('settingsCarryForward');
    mgrInput.onchange = () => handlers.onManagerEmailChange(mgrInput.value);
    if(nameInput) nameInput.onchange = () => handlers.onYourNameChange(nameInput.value);
    if(carryInput) carryInput.onchange = (e) => handlers.onCarryForwardChange(e.target.checked);
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    if(sendEmailBtn) sendEmailBtn.onclick = handlers.onSendEmail;
  }

  // Daily QA Status composer (modal)
  const sendQaStatusBtn = document.getElementById('sendQaStatusBtn');
  if(sendQaStatusBtn){
    const syncDraftField = (key, el) => {
      if(!state.qaStatusDraft) state.qaStatusDraft = {};
      state.qaStatusDraft[key] = el.value;
    };
    const map = [
      ['qaReporterName', 'reporterName'],
      ['qaUserStoryId', 'userStoryId'],
      ['qaExecuted', 'executed'],
      ['qaPlanned', 'planned'],
      ['qaPass', 'pass'],
      ['qaFail', 'fail'],
      ['qaBlockedCount', 'blocked'],
      ['qaHighlights', 'highlights'],
      ['qaLowlights', 'lowlights'],
      ['qaPlanTomorrow', 'planTomorrow'],
      ['qaHelpNeeded', 'helpNeeded']
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.oninput = () => syncDraftField(key, el);
      if(el.tagName === 'SELECT'){
        el.onchange = () => {
          if(key === 'userStoryId' && handlers.onQaStoryChange) handlers.onQaStoryChange(el.value);
          else syncDraftField(key, el);
        };
      }
    });
    document.querySelectorAll('input[name="qaStatusChoice"]').forEach(el => {
      el.onchange = () => {
        if(!state.qaStatusDraft) state.qaStatusDraft = {};
        state.qaStatusDraft.status = el.value;
        rerenderStatusOpts();
      };
    });
    function rerenderStatusOpts(){
      document.querySelectorAll('.qa-status-opt').forEach(label => {
        const input = label.querySelector('input');
        label.classList.toggle('sel', input && input.checked);
      });
    }
    sendQaStatusBtn.onclick = handlers.onSendQaStatus;
  }

  const aiEndpoint = document.getElementById('aiEndpointInput');
  if(aiEndpoint){
    const providerEl = document.getElementById('aiProviderSelect');
    if(providerEl){
      providerEl.onchange = () => handlers.onAiAssistChange('provider', providerEl.value);
    }
    aiEndpoint.onchange = () => handlers.onAiAssistChange('endpoint', aiEndpoint.value);
    document.getElementById('aiApiKeyInput').onchange = (e) => handlers.onAiAssistChange('apiKey', e.target.value);
    document.getElementById('aiModelInput').onchange = (e) => handlers.onAiAssistChange('model', e.target.value);
  }

  const globalRelease = document.getElementById('globalReleaseSelect');
  if(globalRelease){
    globalRelease.onchange = () => handlers.onSelectRelease(globalRelease.value || null);
  }

  // Member modal fields (present only while that modal is open)
  const saveMemberBtn = document.getElementById('saveMemberBtn');
  if(saveMemberBtn){
    const nameEl = document.getElementById('memberNameInput');
    const roleEl = document.getElementById('memberRoleInput');
    const emailEl = document.getElementById('memberEmailInput');
    const doSave = () => handlers.onSaveMember(state.modal.memberId, nameEl.value, roleEl.value, emailEl.value);
    saveMemberBtn.onclick = doSave;
    nameEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    roleEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    emailEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    if(!state.modal.memberId){
      nameEl.oninput = () => { state.memberDraft.name = nameEl.value; };
      roleEl.oninput = () => { state.memberDraft.role = roleEl.value; };
      emailEl.oninput = () => { state.memberDraft.email = emailEl.value; };
    }
    if(autofocusModal) nameEl.focus();
  }

  const addOooBtn = document.getElementById('addOooBtn');
  if(addOooBtn){
    addOooBtn.onclick = () => {
      const fromEl = document.getElementById('oooFromInput');
      const toEl = document.getElementById('oooToInput');
      handlers.onAddOooRange(state.modal.memberId, fromEl && fromEl.value, toEl && toEl.value);
    };
  }

  document.querySelectorAll('.standup-highlights').forEach(el => {
    el.onchange = () => handlers.onStandupHighlightsChange(el.value);
  });

  document.querySelectorAll('.story-test-count').forEach(el => {
    el.onchange = () => handlers.onStoryTestCount(el.dataset.id, el.dataset.field, el.value);
  });

  const commandPaletteInput = document.getElementById('commandPaletteInput');
  if(commandPaletteInput){
    commandPaletteInput.oninput = () => handlers.onCommandPaletteQuery(commandPaletteInput.value);
    if(autofocusModal){
      commandPaletteInput.focus();
      commandPaletteInput.setSelectionRange(commandPaletteInput.value.length, commandPaletteInput.value.length);
    }
  }

  // Release / User Story / Defect modal fields (present only while open)
  const saveReleaseBtn = document.getElementById('saveReleaseBtn');
  if(saveReleaseBtn){
    const nameEl = document.getElementById('releaseNameInput');
    const dateEl = document.getElementById('releaseDateInput');
    const iterationEl = document.getElementById('releaseIterationInput');
    const connectionEl = document.getElementById('releaseConnectionInput');
    const doSave = () => handlers.onSaveRelease(state.modal.memberId, nameEl.value, dateEl.value, iterationEl.value, connectionEl ? connectionEl.value : '');
    saveReleaseBtn.onclick = doSave;
    nameEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    if(!state.modal.memberId){
      nameEl.oninput = () => { state.releaseDraft.name = nameEl.value; };
      dateEl.oninput = () => { state.releaseDraft.targetDate = dateEl.value; };
      iterationEl.oninput = () => { state.releaseDraft.iterationPath = iterationEl.value; };
      if(connectionEl) connectionEl.onchange = () => { state.releaseDraft.connectionId = connectionEl.value; };
    }
    if(autofocusModal) nameEl.focus();
  }

  const saveAdoConnectionBtn = document.getElementById('saveAdoConnectionBtn');
  if(saveAdoConnectionBtn){
    const nameEl = document.getElementById('adoConnNameInput');
    const orgEl = document.getElementById('adoConnOrgInput');
    const projectEl = document.getElementById('adoConnProjectInput');
    const patEl = document.getElementById('adoConnPatInput');
    const usTypeEl = document.getElementById('adoConnUsTypeInput');
    const defectTypeEl = document.getElementById('adoConnDefectTypeInput');
    const taskTypeEl = document.getElementById('adoConnTaskTypeInput');
    const workItemTypes = () => ({userStory: usTypeEl.value, defect: defectTypeEl.value, task: taskTypeEl.value});
    const doSave = () => handlers.onSaveAdoConnection(state.modal.memberId, nameEl.value, orgEl.value, projectEl.value, patEl.value, workItemTypes());
    saveAdoConnectionBtn.onclick = doSave;
    nameEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    if(!state.modal.memberId){
      const fields = {name: nameEl, org: orgEl, project: projectEl, pat: patEl};
      Object.entries(fields).forEach(([key, el]) => { el.oninput = () => { state.adoConnectionDraft[key] = el.value; }; });
      [usTypeEl, defectTypeEl, taskTypeEl].forEach(el => { el.oninput = () => { state.adoConnectionDraft.workItemTypes = workItemTypes(); }; });
    }
    if(autofocusModal) nameEl.focus();
  }

  const saveBlueprintItemBtn = document.getElementById('saveBlueprintItemBtn');
  if(saveBlueprintItemBtn){
    const titleEl = document.getElementById('bpItemTitleInput');
    const timeEl = document.getElementById('bpItemTimeInput');
    const priorityEl = document.getElementById('bpItemPriorityInput');
    const doSave = () => handlers.onSaveBlueprintItem(state.modal.memberId, titleEl.value, timeEl.value, priorityEl.value);
    saveBlueprintItemBtn.onclick = doSave;
    titleEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    if(!state.modal.memberId){
      titleEl.oninput = () => { state.blueprintItemDraft.title = titleEl.value; };
      timeEl.oninput = () => { state.blueprintItemDraft.time = timeEl.value; };
      priorityEl.onchange = () => { state.blueprintItemDraft.priority = priorityEl.value; };
    }
    if(autofocusModal) titleEl.focus();
  }

  const saveUserStoryBtn = document.getElementById('saveUserStoryBtn');
  if(saveUserStoryBtn){
    const titleEl = document.getElementById('usTitleInput');
    const releaseEl = document.getElementById('usReleaseInput');
    const assigneeEl = document.getElementById('usAssigneeInput');
    const iterationEl = document.getElementById('usIterationInput');
    const groupIds = () => {
      if(state.modal.memberId){
        const us = state.userStories.find(u => u.id === state.modal.memberId);
        return us ? (us.groupIds || []) : [];
      }
      return state.userStoryDraft.groupIds || [];
    };
    const doSave = () => handlers.onSaveUserStory(state.modal.memberId, titleEl.value, releaseEl.value, assigneeEl.value, iterationEl.value, groupIds());
    saveUserStoryBtn.onclick = doSave;
    titleEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    if(!state.modal.memberId){
      titleEl.oninput = () => { state.userStoryDraft.title = titleEl.value; };
      releaseEl.onchange = () => { state.userStoryDraft.releaseId = releaseEl.value; };
      assigneeEl.onchange = () => { state.userStoryDraft.assigneeId = assigneeEl.value; };
      iterationEl.oninput = () => { state.userStoryDraft.iterationPath = iterationEl.value; };
    }
    if(autofocusModal) titleEl.focus();
  }

  const saveDefectBtn = document.getElementById('saveDefectBtn');
  if(saveDefectBtn){
    const titleEl = document.getElementById('defectTitleInput');
    const usEl = document.getElementById('defectUsInput');
    const severityEl = document.getElementById('defectSeverityInput');
    const assigneeEl = document.getElementById('defectAssigneeInput');
    const iterationEl = document.getElementById('defectIterationInput');
    const doSave = () => handlers.onSaveDefect(state.modal.memberId, titleEl.value, usEl.value, severityEl.value, assigneeEl.value, iterationEl.value);
    saveDefectBtn.onclick = doSave;
    titleEl.onkeydown = (e) => { if(e.key === 'Enter') doSave(); };
    if(!state.modal.memberId){
      titleEl.oninput = () => { state.defectDraft.title = titleEl.value; };
      usEl.onchange = () => { state.defectDraft.userStoryId = usEl.value; };
      severityEl.onchange = () => { state.defectDraft.severity = severityEl.value; };
      assigneeEl.onchange = () => { state.defectDraft.assigneeId = assigneeEl.value; };
      iterationEl.oninput = () => { state.defectDraft.iterationPath = iterationEl.value; };
    }
    if(autofocusModal) titleEl.focus();
  }

  // Release Testing view — status inputs (US + Defect), the task-card
  // release picker, and the ADO settings/sync controls.
  document.querySelectorAll('.status-input').forEach(el => {
    el.onchange = () => {
      if(el.dataset.kind === 'user-story') handlers.onSetUserStoryStatus(el.dataset.id, el.value);
      else handlers.onSetDefectStatus(el.dataset.id, el.value);
    };
    el.onkeydown = (e) => { if(e.key === 'Enter') el.blur(); };
  });
  document.querySelectorAll('.task-release-select').forEach(el => {
    el.onchange = () => {
      if(el.dataset.id === 'new') handlers.onSetNewTaskRelease(el.value);
      else handlers.onSetTaskRelease(el.dataset.id, el.value);
    };
  });
  const newTaskLinkSelect = document.querySelector('.new-task-link-select');
  if(newTaskLinkSelect) newTaskLinkSelect.onchange = () => handlers.onSetNewTaskLinkedItem(newTaskLinkSelect.value);

  const taskSearchInput = document.getElementById('taskSearchInput');
  if(taskSearchInput) taskSearchInput.oninput = () => handlers.onTaskSearch(taskSearchInput.value);
  const adoSyncBtn = document.getElementById('adoSyncBtn');
  if(adoSyncBtn) adoSyncBtn.onclick = handlers.onSyncFromAdo;

  // Modal backdrop click-to-close (clicking the panel itself must not close it)
  const overlay = document.getElementById('modalOverlay');
  if(overlay) overlay.onclick = (e) => { if(e.target === overlay) handlers.onCloseModal(); };

  const groupNameInput = document.getElementById('groupName');
  const addGroupBtn = document.getElementById('addGroupBtn');
  if(addGroupBtn){
    const purposeInput = document.getElementById('groupPurpose');
    const doAddGroup = () => handlers.onAddGroup(groupNameInput.value, purposeInput ? purposeInput.value : '');
    addGroupBtn.onclick = doAddGroup;
    groupNameInput.onkeydown = (e) => { if(e.key === 'Enter') doAddGroup(); };
    groupNameInput.oninput = () => { state.newGroupNameDraft = groupNameInput.value; };
    if(purposeInput) purposeInput.oninput = () => { state.newGroupPurposeDraft = purposeInput.value; };
  }

  document.querySelectorAll('.group-purpose-input').forEach(el => {
    el.onchange = () => handlers.onGroupPurposeChange(el.dataset.id, el.value);
  });

  document.querySelectorAll('.comment-input').forEach(el => {
    el.onchange = () => handlers.onCommentChange(el.dataset.id, el.value);
  });

  document.querySelectorAll('.story-ongoing-note').forEach(el => {
    el.onchange = () => handlers.onStoryOngoingNote(el.dataset.id, el.value);
  });
  document.querySelectorAll('.story-progress-note').forEach(el => {
    el.onchange = () => handlers.onStoryProgressNote(el.dataset.id, el.value);
  });
  document.querySelectorAll('.defect-day-note').forEach(el => {
    el.onchange = () => handlers.onDefectDayNote(el.dataset.id, el.value);
  });
  document.querySelectorAll('.standup-discuss-note').forEach(el => {
    el.onchange = () => handlers.onDiscussionNote(el.dataset.id, el.value);
  });
  document.querySelectorAll('.defect-alt-tester').forEach(el => {
    el.onchange = () => { if(el.value) handlers.onSetAlternateTester(el.dataset.id, el.value); };
  });

  document.querySelectorAll('.edit-title-input').forEach(el => {
    el.onkeydown = (e) => {
      if(e.key === 'Enter'){
        const timeEl = document.querySelector(`.edit-time-input[data-id="${el.dataset.id}"]`);
        handlers.onSaveEdit(el.dataset.id, el.value, timeEl.value);
      }else if(e.key === 'Escape'){
        handlers.onCancelEdit();
      }
    };
    el.focus();
    el.select();
  });

  const exportBtn = document.getElementById('exportBtn');
  if(exportBtn) exportBtn.onclick = handlers.onExportBackup;
  const importFile = document.getElementById('importFile');
  if(importFile) importFile.onchange = (e) => {
    const file = e.target.files[0];
    if(file) handlers.onImportBackup(file);
    e.target.value = '';
  };

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if(exportCsvBtn) exportCsvBtn.onclick = handlers.onExportTasksCSV;
  const importCsvFile = document.getElementById('importCsvFile');
  if(importCsvFile) importCsvFile.onchange = (e) => {
    const file = e.target.files[0];
    if(file) handlers.onImportTasksCSV(file);
    e.target.value = '';
  };

  // Search inputs inside popovers keep focus/cursor/scroll across the
  // re-render each keystroke triggers — restoreFocus handles caret; only
  // autofocus when the popover just opened.
  document.querySelectorAll('.picker-search[data-role="assign-search"]').forEach(el => {
    el.oninput = () => handlers.onAssignPickerQuery(el.value);
    if(autofocusPopover){
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });
  document.querySelectorAll('.picker-search[data-role="standup-search"]').forEach(el => {
    el.oninput = () => handlers.onStandupPersonQuery(el.value);
    if(autofocusPopover){
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });
  document.querySelectorAll('.picker-list').forEach(el => {
    el.scrollTop = state.assignPickerScrollTop || 0;
    el.onscroll = () => { state.assignPickerScrollTop = el.scrollTop; };
  });

  const peopleSearchInput = document.querySelector('.picker-search[data-role="people-search"]');
  if(peopleSearchInput){
    peopleSearchInput.oninput = () => handlers.onPeopleSearch(peopleSearchInput.value);
    if(autofocusModal){
      peopleSearchInput.focus();
      peopleSearchInput.setSelectionRange(peopleSearchInput.value.length, peopleSearchInput.value.length);
    }
  }

  document.querySelectorAll('.standup-task-link').forEach(el => {
    el.onchange = () => handlers.onStandupFieldChange(el.dataset.member, 'linkedTaskId', el.value);
  });
  document.querySelectorAll('.standup-input').forEach(el => {
    el.onchange = () => handlers.onStandupFieldChange(el.dataset.member, el.dataset.field, el.value);
  });

  document.querySelectorAll('[data-action]').forEach(el => {
    const id = el.dataset.id, action = el.dataset.action;
    el.onclick = () => {
      if(action === 'cycle') handlers.onCycleStatus(id);
      else if(action === 'delete') handlers.onDeleteRequest(id);
      else if(action === 'up') handlers.onMoveUp(id);
      else if(action === 'down') handlers.onMoveDown(id);
      else if(action === 'toggle-comment') handlers.onToggleComment(id);
      else if(action === 'assign') handlers.onToggleAssignee(id, el.dataset.member);
      else if(action === 'assign-group') handlers.onToggleAssignedGroup(id, el.dataset.group);
      else if(action === 'new-task-assignee') handlers.onToggleNewTaskAssignee(el.dataset.member);
      else if(action === 'new-task-group') handlers.onToggleNewTaskGroup(el.dataset.group);
      else if(action === 'set-target') handlers.onSetNewTaskTarget(el.dataset.target);
      else if(action === 'set-new-task-item-type') handlers.onSetNewTaskWorkItemType(el.dataset.type);
      else if(action === 'clear-task-search') handlers.onTaskSearch('');
      else if(action === 'edit-title') handlers.onEditTitle(id);
      else if(action === 'cancel-edit') handlers.onCancelEdit();
      else if(action === 'save-edit'){
        const titleEl = document.querySelector(`.edit-title-input[data-id="${id}"]`);
        const timeEl = document.querySelector(`.edit-time-input[data-id="${id}"]`);
        handlers.onSaveEdit(id, titleEl.value, timeEl.value);
      }
      else if(action === 'remove-member') handlers.onRemoveMember(id);
      else if(action === 'edit-member') handlers.onOpenModal('member', id, 'people');
      else if(action === 'add-member') handlers.onOpenModal('member', null, 'people');
      else if(action === 'open-people') handlers.onOpenModal('people', null);
      else if(action === 'open-groups') handlers.onOpenModal('groups', null);
      else if(action === 'toggle-lane') handlers.onToggleLane(id);
      else if(action === 'toggle-completed') handlers.onToggleCompletedGroup(id);
      else if(action === 'remove-group') handlers.onRemoveGroup(id);
      else if(action === 'group-member') handlers.onToggleGroupMember(id, el.dataset.member);
      else if(action === 'new-group-member') handlers.onToggleNewGroupMember(el.dataset.member);
      else if(action === 'toggle-priority-dd'){
        if(state.priorityDropdownFor === id) handlers.onClosePriorityDropdown();
        else handlers.onOpenPriorityDropdown(id);
      }
      else if(action === 'choose-priority') handlers.onChoosePriority(id, el.dataset.p);
      else if(action === 'toggle-assign-picker'){
        if(state.assignPickerFor === id) handlers.onCloseAssignPicker();
        else handlers.onOpenAssignPicker(id);
      }
      else if(action === 'close-picker') handlers.onCloseAssignPicker();
      else if(action === 'toggle-standup-picker') handlers.onToggleStandupPicker();
      else if(action === 'select-standup-person') handlers.onSetStandupActiveMember(el.dataset.member);
      else if(action === 'open-new-task') handlers.onOpenModal('newTask', null);
      else if(action === 'open-board-email') handlers.onOpenModal('boardEmail', null);
      else if(action === 'open-settings') handlers.onOpenModal('settings', null);
      else if(action === 'send-standup-email') handlers.onSendStandupEmail();
      else if(action === 'toggle-standup-expand') handlers.onToggleStandupExpand();
      else if(action === 'open-qa-status') handlers.onOpenQaStatus();
      else if(action === 'save-qa-status') handlers.onSaveQaStatus();
      else if(action === 'close-modal') handlers.onCloseModal();
      else if(action === 'switch-view') handlers.onSwitchView(id);
      else if(action === 'select-release') handlers.onSelectRelease(id);
      else if(action === 'select-defect-tag') handlers.onSelectDefectTag(id);
      else if(action === 'add-release') handlers.onOpenModal('addRelease', null);
      else if(action === 'edit-release') handlers.onOpenModal('addRelease', id);
      else if(action === 'remove-release') handlers.onRemoveRelease(id);
      else if(action === 'add-user-story') handlers.onOpenModal('addUserStory', null);
      else if(action === 'edit-user-story') handlers.onOpenModal('addUserStory', id);
      else if(action === 'remove-user-story') handlers.onRemoveUserStory(id);
      else if(action === 'add-defect') handlers.onOpenAddDefect('');
      else if(action === 'add-defect-for-us') handlers.onOpenAddDefect(id);
      else if(action === 'edit-defect') handlers.onOpenModal('addDefect', id);
      else if(action === 'remove-defect') handlers.onRemoveDefect(id);
      else if(action === 'send-defects-email') handlers.onSendDefectsEmail();
      else if(action === 'manage-ado-connections') handlers.onOpenModal('manageAdoConnections', null);
      else if(action === 'add-ado-connection') handlers.onOpenModal('adoConnectionForm', null, 'manageAdoConnections');
      else if(action === 'edit-ado-connection') handlers.onOpenModal('adoConnectionForm', id, state.modal && state.modal.type === 'manageAdoConnections' ? 'manageAdoConnections' : null);
      else if(action === 'remove-ado-connection') handlers.onRemoveAdoConnection(id);
      else if(action === 'manage-blueprint') handlers.onOpenModal('manageBlueprint', null);
      else if(action === 'add-blueprint-item') handlers.onOpenModal('blueprintItemForm', null, 'manageBlueprint');
      else if(action === 'edit-blueprint-item') handlers.onOpenModal('blueprintItemForm', id, state.modal && state.modal.type === 'manageBlueprint' ? 'manageBlueprint' : null);
      else if(action === 'remove-blueprint-item') handlers.onRemoveBlueprintItem(id);
      else if(action === 'send-dashboard-email') handlers.onSendDashboardEmail();
      else if(action === 'toggle-board-insights') handlers.onToggleBoardInsights();
      else if(action === 'toggle-absence') handlers.onToggleAbsence(el.dataset.member);
      else if(action === 'delegate-to-peer') handlers.onDelegateToPeer(el.dataset.from, el.dataset.member);
      else if(action === 'toggle-standup-queue') handlers.onToggleStandupQueue(el.dataset.kind, id, (el.dataset.discussants || '').split(',').filter(Boolean));
      else if(action === 'toggle-work-notes') handlers.onToggleWorkNotes(el.dataset.kind, id);
      else if(action === 'toggle-discussant') handlers.onToggleDiscussant(id, el.dataset.member);
      else if(action === 'toggle-ado-sync-type') handlers.onToggleAdoSyncType(el.dataset.type);
      else if(action === 'assign-release-connection') handlers.onAssignReleaseConnection(el.dataset.release, el.dataset.connection);
      else if(action === 'remove-discussion') handlers.onRemoveDiscussion(id);
      else if(action === 'toggle-story-group') handlers.onToggleStoryGroup(id, el.dataset.group);
      else if(action === 'draft-story-group') handlers.onDraftStoryGroup(el.dataset.group);
      else if(action === 'toggle-defect-tester') handlers.onToggleDefectTester(id, el.dataset.member);
      else if(action === 'summarize-day-signals') handlers.onSummarizeDaySignals();
      else if(action === 'draft-standup-highlights') handlers.onDraftStandupHighlights();
      else if(action === 'draft-qa-highlights') handlers.onDraftQaHighlights();
      else if(action === 'toggle-sidebar') handlers.onToggleSidebar();
      else if(action === 'print-page') handlers.onPrintPage();
      else if(action === 'apply-saved-view') handlers.onApplySavedView(el.dataset.kind, el.dataset.id || '');
      else if(action === 'open-command-palette') handlers.onOpenCommandPalette();
      else if(action === 'command-go') handlers.onCommandGo(el.dataset.go, el.dataset.id || '');
      else if(action === 'remove-ooo') handlers.onRemoveOooRange(id, el.dataset.index);
      else if(action === 'set-people-review-period') handlers.onSetPeopleReviewPeriod(id);
      else if(action === 'draft-appreciation') handlers.onDraftAppreciation(id);
      else if(action === 'draft-appreciation-all') handlers.onDraftAppreciationAll();
    };
  });

  document.getElementById('clearDay').onclick = handlers.onClearDay;
}

/* ---------------------------------------------------------------------- */
/* Positions the floating-popover portal against whichever trigger opened  */
/* it, using position:fixed + the trigger's actual on-screen rect — so it  */
/* renders correctly regardless of which card/lane/modal it came from.     */
/* Flips above the trigger if there's not enough room below, and clamps    */
/* horizontally so it never runs off the right edge of the viewport.       */
/* ---------------------------------------------------------------------- */

function popoverTriggerSelector(state){
  if(state.priorityDropdownFor !== null) return `.pd-trigger[data-id="${cssEscape(state.priorityDropdownFor)}"]`;
  if(state.assignPickerFor !== null) return `.assign-trigger[data-id="${cssEscape(state.assignPickerFor)}"]`;
  if(state.standupPickerOpen) return '.standup-person-trigger';
  return null;
}

function cssEscape(value){
  return (window.CSS && CSS.escape) ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
}

function positionFloatingPopover(state){
  const popover = document.getElementById('floatingPopover');
  const selector = popoverTriggerSelector(state);
  if(!popover || !selector) return;
  const trigger = document.querySelector(selector);
  if(!trigger){ popover.style.visibility = 'hidden'; return; }

  const rect = trigger.getBoundingClientRect();
  const pw = popover.offsetWidth;
  const ph = popover.offsetHeight;

  let left = rect.left;
  const maxLeft = window.innerWidth - pw - 12;
  if(left > maxLeft) left = Math.max(12, maxLeft);

  let top = rect.bottom + 6;
  if(top + ph > window.innerHeight - 12 && rect.top - ph - 6 > 12){
    top = rect.top - ph - 6; // not enough room below — flip above the trigger
  }

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
  popover.style.visibility = 'visible';
}

function isTypingTarget(el){
  if(!el || el === document.body) return false;
  const tag = el.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if(el.isContentEditable) return true;
  return false;
}

/* ---------------------------------------------------------------------- */
/* Global listeners — bound exactly once, since state/handlers are stable */
/* references for the lifetime of the app. Closes whatever popover/modal  */
/* is open on an outside click, Escape, page scroll, or viewport resize   */
/* (scroll/resize just close rather than reposition, since a fixed-       */
/* position popover would otherwise visually detach from its trigger).    */
/* ---------------------------------------------------------------------- */

let globalListenersBound = false;
function bindGlobalListeners(state, handlers){
  if(globalListenersBound) return;
  globalListenersBound = true;

  const closePopovers = () => {
    let changed = false;
    if(state.priorityDropdownFor !== null){ state.priorityDropdownFor = null; changed = true; }
    if(state.assignPickerFor !== null){ state.assignPickerFor = null; changed = true; }
    if(state.standupPickerOpen){ state.standupPickerOpen = false; changed = true; }
    if(changed) render(state, handlers);
  };

  document.addEventListener('click', (e) => {
    const keepOpen = '.pd-trigger, .assign-trigger, .standup-person-trigger, #floatingPopover';
    if(e.target && typeof e.target.closest === 'function' && e.target.closest(keepOpen)) return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if(path.some(n => n && n.nodeType === 1 && (n.id === 'floatingPopover' || (n.matches && n.matches(keepOpen))))) return;
    closePopovers();
  });

  window.addEventListener('scroll', closePopovers, true);
  window.addEventListener('resize', closePopovers);

  document.addEventListener('keydown', (e) => {
    const typing = isTypingTarget(e.target);

    if(state.modal && state.modal.type === 'commandPalette'){
      if(e.key === 'Enter' && !e.metaKey && !e.ctrlKey){
        const first = document.querySelector('.command-palette-list .picker-row');
        if(first){
          e.preventDefault();
          first.click();
        }
        return;
      }
    }

    if((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      if(state.modal && state.modal.type === 'commandPalette'){
        const input = document.getElementById('commandPaletteInput');
        if(input) input.focus();
      }else{
        handlers.onOpenCommandPalette();
      }
      return;
    }

    if(!typing && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey){
      e.preventDefault();
      const search = document.getElementById('taskSearchInput');
      if(search){ search.focus(); search.select(); }
      else handlers.onOpenCommandPalette();
      return;
    }

    if(!typing && (e.key === 'j' || e.key === 'k') && !e.metaKey && !e.ctrlKey && !e.altKey){
      if(!state.team.length) return;
      if(state.modal) return;
      const idx = Math.max(0, state.team.findIndex(m => m.id === state.standupActiveMemberId));
      const next = e.key === 'j'
        ? Math.min(state.team.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      const member = state.team[next];
      if(member && member.id !== state.standupActiveMemberId){
        e.preventDefault();
        handlers.onSetStandupActiveMember(member.id);
      }
      return;
    }

    if(e.key !== 'Escape') return;
    // Topmost layer first: a popover inside a modal should close before
    // the modal itself. Modal close uses onCloseModal so nested forms
    // (member edit, connection form) still hand back to their parent list.
    if(state.priorityDropdownFor !== null || state.assignPickerFor !== null || state.standupPickerOpen){
      closePopovers();
      return;
    }
    if(state.modal) handlers.onCloseModal();
  });
}
