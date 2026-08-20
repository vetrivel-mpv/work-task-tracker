// Shared constants, date/time helpers, and the initial app state shape.

// Product identity — user-facing only. localStorage keys stay stable.
export const APP_NAME = 'Northstar Delivery';
export const APP_SLUG = 'northstar-delivery';
export const APP_TAGLINE = 'Client delivery & team operations';

export const PRIORITIES = ['high','medium','low'];
export const LABELS = {high:'High priority', medium:'Medium priority', low:'Low priority'};
export const PRIORITY_TEXT = {high:'High', medium:'Medium', low:'Low'};
export const EMPTY_MSG = {
  high:"Nothing urgent queued. Add what cannot slip today.",
  medium:'No medium-priority work yet.',
  low:'No low-priority work yet.'
};

// Work-only slice of the 15-Month Mastery Blueprint's daily schedule
export const BLUEPRINT_SCHEDULE = [
  {time:'11:00', title:'Team Check-in & Task Review', priority:'high'},
  {time:'13:00', title:'Deep Work Block', priority:'high'},
  {time:'16:15', title:'Work from Ground (Laptop)', priority:'high'},
  {time:'17:45', title:'Continue Work from Home', priority:'high'},
  {time:'21:00', title:'Client Call', priority:'high'}
];

// Recurring QA/release-cycle activities — no fixed time since these are
// ad hoc/urgent rather than scheduled blocks.
export const QA_BLUEPRINT_SCHEDULE = [
  {title:'QA Sanity', priority:'high'},
  {title:'Staging Sanity', priority:'high'},
  {title:'Prod Sanity', priority:'high'},
  {title:'OPS Ticket', priority:'medium'},
  {title:'Regression Testing', priority:'medium'},
  {title:'User Story Testing', priority:'medium'},
  {title:'Defect Validations', priority:'medium'},
  {title:'Documentation', priority:'low'}
];

// The single quick-load blueprint — both sets combined, so there's one
// button instead of two. Kept as separate arrays above too, since that's
// what you'd edit if your recurring schedule changes (see README).
export const DAILY_BLUEPRINT_SCHEDULE = [...BLUEPRINT_SCHEDULE, ...QA_BLUEPRINT_SCHEDULE];

export const MAX_TITLE_LENGTH = 140;
export const MAX_NAME_LENGTH = 80;
export const MAX_COMMENT_LENGTH = 400;
export const MAX_MEMBER_NAME_LENGTH = 60;
export const MAX_MEMBER_ROLE_LENGTH = 60;
export const MAX_MEMBER_EMAIL_LENGTH = 200;
export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_STANDUP_FIELD_LENGTH = 400;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email){ return EMAIL_RE.test(String(email ?? '').trim()); }

// Palette cycled by roster position to give each team member a stable,
// distinct avatar color without needing to store one explicitly. Chosen
// deep enough to hold WCAG-ish contrast as text/border on a white surface.
export const AVATAR_COLORS = ['#B23A2E','#A15E14','#0E7C6B','#3554C7','#7439B0','#1E7A44','#B02A63','#0E7490'];
export function avatarColor(index){ return AVATAR_COLORS[index % AVATAR_COLORS.length]; }
export function initials(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// Match a People-roster member to an ADO identity (email preferred, then name).
export function findMemberByIdentity(team, name, email){
  const emailLower = String(email || '').trim().toLowerCase();
  if(emailLower){
    const byEmail = (team || []).find(t => (t.email || '').toLowerCase() === emailLower);
    if(byEmail) return byEmail;
  }
  const nameLower = String(name || '').trim().toLowerCase();
  if(nameLower) return (team || []).find(t => (t.name || '').toLowerCase() === nameLower) || null;
  return null;
}

export function workNotesKey(kind, id){ return `${kind}:${id}`; }

export const STATUSES = ['pending','partial','complete'];
export const STATUS_LABELS = {pending:'Not started', partial:'Partially complete', complete:'Complete'};
// Cycle order when the status control is clicked: pending -> partial -> complete -> pending
export const NEXT_STATUS = {pending:'partial', partial:'complete', complete:'pending'};

export const SEVERITIES = ['critical','high','medium','low'];
export const SEVERITY_LABELS = {critical:'Critical', high:'High', medium:'Medium', low:'Low'};

export const MAX_RELEASE_NAME_LENGTH = 60;

// Which release a defect belongs to — direct iteration-path membership
// (matching ADO's own UNDER/prefix semantics) takes priority since it's
// authoritative and independent of any User Story link; falls back to the
// linked User Story's release for defects without a captured iteration
// path (manually added, or synced before this field existed). Returns
// null when neither resolves — that's what "Unlinked defects" means.
export function iterationMatchesRelease(iterationPath, releaseIterationPath){
  if(!iterationPath || !releaseIterationPath) return false;
  // ADO uses backslash; people often paste forward slashes. Treat them as
  // the same separator so a typed path still matches a synced one.
  const a = String(iterationPath).trim().replace(/\//g, '\\').toLowerCase();
  const b = String(releaseIterationPath).trim().replace(/\//g, '\\').toLowerCase();
  return a === b || a.startsWith(b + '\\');
}

export function defectReleaseId(d, releases, usById){
  const byIteration = releases.find(r => iterationMatchesRelease(d.iterationPath, r.iterationPath));
  if(byIteration) return byIteration.id;
  if(d.userStoryId){
    const us = usById.get(d.userStoryId);
    if(us) return us.releaseId || null;
  }
  return null;
}

// Same iteration-path-first resolution for a User Story — a re-sync always
// keeps its stored releaseId correct (see adoSync.js), but a story's own
// iterationPath is checked first anyway so the page reflects reality
// immediately, without waiting on a resync, if the two ever disagree.
export function userStoryReleaseId(us, releases){
  const byIteration = releases.find(r => iterationMatchesRelease(us.iterationPath, r.iterationPath));
  return byIteration ? byIteration.id : (us.releaseId || null);
}

// Which ADO connection a release syncs from. An explicit connectionId wins;
// otherwise, if there's exactly one connection configured, every release
// uses it implicitly — this is what keeps a single-org setup (the common
// case, and every setup before multi-connection support existed) working
// with zero per-release configuration. Once a second connection exists,
// each release needs one picked explicitly (see releaseModalHTML) — there's
// no longer a single unambiguous default.
export function resolveAdoConnection(release, connections){
  if(!release) return null;
  if(release.connectionId) return connections.find(c => c.id === release.connectionId) || null;
  return connections.length === 1 ? connections[0] : null;
}

export const MAX_ADO_CONNECTION_NAME_LENGTH = 40;

// A defect counts as "resolved" for dashboard KPIs/breakdowns and the
// summary email purely from its adoState text (a lightweight, unstored
// classification for this rollup — not a second status field to track).
export function isResolvedState(adoState){
  return /(resolv|clos|done|complet)/i.test(adoState || '');
}

export function toDateStr(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
export function fromDateStr(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
export function shiftDate(s, days){ const d = fromDateStr(s); d.setDate(d.getDate()+days); return toDateStr(d); }
export function formatDisplay(s){ const d = fromDateStr(s); return d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'}); }
export function formatLongDisplay(s){ const d = fromDateStr(s); return d.toLocaleDateString(undefined, {weekday:'long', year:'numeric', month:'long', day:'numeric'}); }
export function isToday(s){ return s === toDateStr(new Date()); }
export function formatTime12(t){
  if(!t) return '';
  const [h,m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}
export function uid(){ return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }

export function createInitialState(){
  return {
    dateStr: toDateStr(new Date()),
    tasks: [],
    yesterdayTasks: [], // preloaded so the standup card can show "yesterday achieved" synchronously
    team: [],
    groups: [],
    standup: {}, // {[memberId]: {yesterday, today, blockers, questions, linkedTaskId}} + __meta
    standupMsg: '',
    standupWarn: '',
    // Board: when true, standup takes the full workspace (lanes hidden on desktop).
    standupRailExpanded: false,
    teamWarn: '',
    settings: {
      managerEmail:'', yourName:'', carryForward:true,
      selectedReleaseId: null,
      sidebarCollapsed: false,
      lastBackupAt: null,
      lastDefectViewId: '',
      lastStoryViewId: '',
      savedViews: {defects: [], stories: []},
      aiAssist: {provider:'openai', endpoint:'', apiKey:'', model:'gpt-4o-mini'},
      // Work item type names vary by ADO process template (Agile/Scrum/CMMI
      // all name these differently), so they're configurable, not hardcoded.
      // Iteration path is deliberately NOT here — it lives per-release
      // (see releases.js), so two releases can sync from two different
      // ADO sprints instead of sharing one global filter.
      adoConnections: []
    },
    newPriority: 'medium',
    newTaskReleaseId: null, // optional release tag picked in the New Task modal
    // Once a release is picked, these narrow the task to one specific User
    // Story/Defect in that release (see newTaskLinkFieldHTML) — cleared
    // whenever the release changes since the filtered list depends on it.
    newTaskWorkItemType: '', // '' | 'userStory' | 'defect'
    newTaskLinkedItemId: '', // id of the picked User Story/Defect
    newTaskTarget: 'today', // 'today' | 'tomorrow' — which day the add-task form writes to
    newTaskAssigneeIds: new Set(), // people picked in the add-task form, not persisted
    newTaskGroupIds: new Set(), // groups picked in the add-task form, not persisted
    // Mirrors the add-task text inputs so picking an assignee/group/target
    // (each of which re-renders the whole board) doesn't wipe what's typed.
    newTaskDraft: {title:'', time:''},
    newTaskNoteDraft: '',
    newTaskWarn: '',
    clearArmed: false,
    bpMsg: '',
    csvMsg: '',
    emailMsg: '',
    emailWarn: '',
    openCommentIds: new Set(), // transient UI state, not persisted
    newGroupMemberIds: new Set(), // checkbox selections for the "create group" form, not persisted
    newGroupNameDraft: '', // mirrors the "create group" name input, survives re-renders from member toggles
    newGroupPurposeDraft: '', // mirrors the "create group" purpose input
    memberDraft: {name:'', role:'', email:''}, // mirrors the add/edit-teammate form, survives re-renders from a failed validation
    editingTaskId: null, // task currently showing its inline title/time editor, not persisted
    deleteArmedIds: new Set(), // tasks one click away from delete, not persisted

    // Floating modal: {type: 'newTask'|'boardEmail'|'settings'|'qaStatus'|'member'|'people'|'groups'|..., memberId?, returnTo?} or null when closed.
    // returnTo lets the member-edit modal hand back to the People modal it was opened from.
    modal: null,
    peopleSearch: '', // filters the People modal's list — keeps it usable with a large roster
    taskSearchQuery: '', // filters the priority lanes by title/assignee — keeps a large (e.g. ADO-synced) board usable

    // Priority lanes: only one expanded at a time; null collapses all.
    expandedLane: 'high',
    // Completed tasks collapse into a "N completed" strip at the bottom of
    // each lane; this tracks which lanes have that strip expanded.
    completedOpenFor: new Set(),

    // Searchable assignee/group popover: forId is a task id or 'new' (the New Task modal)
    assignPickerFor: null,
    assignPickerQuery: '',
    assignPickerScrollTop: 0, // preserves scroll position across the re-renders each toggle triggers

    // Priority dropdown: forId is a task id or 'new'
    priorityDropdownFor: null,

    // Daily standup — which single teammate's update is showing
    standupActiveMemberId: null,
    standupPickerOpen: false,
    standupPersonQuery: '',

    // Compact Board insight strip (day signals) — folded by default on small
    // boards so the lanes stay primary; expands on demand.
    boardInsightsOpen: true,

    // Which User Story / Defect day-note panels are expanded
    // (`userStory:id` / `defect:id`). Standup queue toggles expand; title
    // click toggles without queueing.
    workNotesExpanded: new Set(),

    // Release Testing — separate top-level pages from the daily board
    // (toggled via the topbar), organized by release rather than by date.
    view: 'board', // 'board' | 'userStories' | 'defects' | 'defectsDashboard' | 'adoSync' | 'peopleReview'
    releases: [],
    userStories: [],
    defects: [],
    selectedReleaseId: null,
    selectedDefectTag: null, // filters the Defects page; null shows every tag
    releaseWarn: '',
    adoSyncMsg: '',
    adoSyncing: false,
    // Per-sync scope toggles (UI only — connection WIT names stay authoritative).
    adoSyncTypes: {userStory: true, defect: true, task: true},
    // Drafts mirror their forms so a failed validation (or an unrelated
    // re-render, e.g. toggling a testing-status dropdown) doesn't wipe
    // what's already typed — same pattern as memberDraft/newGroupNameDraft.
    releaseDraft: {name:'', targetDate:'', iterationPath:'', connectionId:''},
    userStoryDraft: {title:'', releaseId:'', assigneeId:'', iterationPath:'', groupIds:[]},
    defectDraft: {title:'', userStoryId:'', severity:'medium', assigneeId:'', iterationPath:''},
    adoConnectionDraft: {name:'', org:'', project:'', pat:'', workItemTypes:{userStory:'User Story', defect:'Bug', task:'Task'}},
    adoConnectionWarn: '',

    // Defects email — opens straight into a blank-recipient mailto draft
    // (no address to collect), so these just carry the last result message.
    defectsEmailWarn: '',
    defectsEmailMsg: '',

    // Quick-load blueprint — loaded from storage in init() (see
    // storage.js's loadBlueprintSchedule); this placeholder is only what
    // renders before that finishes.
    blueprintSchedule: [],
    blueprintItemDraft: {title:'', time:'', priority:'medium'},
    blueprintWarn: '',

    // Dashboard summary email — defaults its recipient to the manager email
    // already on file (see dashboardEmail.js), so these just carry the
    // last result message.
    dashboardEmailWarn: '',
    dashboardEmailMsg: '',

    // People review (month/quarter/year rollups) + appreciation drafts
    peopleReviewPeriod: 'month', // 'month' | 'quarter' | 'year'
    peopleReviewWarn: '',
    peopleReviewMsg: '',

    // Optional AI assist feedback
    aiAssistWarn: '',
    aiAssistMsg: '',

    // Daily QA Status email composer (modal) — draft persisted per day
    // under qaStatus:YYYY-MM-DD; messages are transient.
    qaStatusDraft: null,
    qaStatusMsg: '',
    qaStatusWarn: '',

    selectedDefectViewId: '',
    selectedStoryViewId: '',
    commandPaletteQuery: ''
  };
}
