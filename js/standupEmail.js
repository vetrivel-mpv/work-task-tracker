// Builds the "Daily Standup" mailto draft — sent to the team, not to a
// manager. Structured for next-day tracking: day signals / done / in
// progress / blockers / absences / discussion / carry-forward. Falls back
// to clipboard when the mailto URI would likely exceed client limits.

import { formatDisplay, formatLongDisplay, isValidEmail, shiftDate, isResolvedState } from './state.js';
import { divider } from './emailFormat.js';
import { normalizeStandup, STANDUP_META_KEY, memberStandupEntry } from './standupShape.js';
import { deliverEmailDraft, draftDeliveryMessage } from './mailtoDelivery.js';
import { scopedDefects, scopedUserStories, discussionInRelease } from './opsHelpers.js';
import { effectiveAbsenceIds } from './standup.js';

function taskLines(tasks, labelKey){
  if(!tasks.length) return '  - None';
  return tasks.map(t => `  - [${t[labelKey]}] ${t.title}`).join('\n');
}

function memberEntry(state, m, liveStandup){
  const yTasks = state.yesterdayTasks.filter(t => Array.isArray(t.assignees) && t.assignees.includes(m.id));
  const tTasks = state.tasks.filter(t => Array.isArray(t.assignees) && t.assignees.includes(m.id));
  const entry = memberStandupEntry(liveStandup || state.standup, m.id);
  const yesterday = (entry.yesterday || '').trim();
  const today = (entry.today || '').trim();
  const blockers = (entry.blockers || '').trim();
  const questions = (entry.questions || '').trim();
  const linkedTask = entry.linkedTaskId && [...tTasks, ...yTasks].find(t => t.id === entry.linkedTaskId);
  return {yTasks, tTasks, yesterday, today, blockers, questions, linkedTask};
}

function section(title, body){
  return `${title}\n${divider(48)}\n${body}`;
}

function discussionLines(state){
  const items = discussionInRelease(state);
  if(!items.length) return '  - None queued';
  return items.map(d => {
    const item = d.kind === 'userStory'
      ? state.userStories.find(u => u.id === d.itemId)
      : state.defects.find(x => x.id === d.itemId);
    const label = d.kind === 'userStory' ? 'US' : 'Defect';
    const title = item ? item.title : '(removed item)';
    const people = (d.discussantIds || [])
      .map(id => state.team.find(m => m.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const note = (d.note || '').trim();
    return `  - [${label}] ${title}${people ? ` — ${people}` : ''}${note ? `\n      ↳ ${note}` : ''}`;
  }).join('\n');
}

function absenceLines(state, absenceIds){
  if(!absenceIds.length) return '  - None';
  return absenceIds.map(id => {
    const m = state.team.find(t => t.id === id);
    const name = m ? m.name : id;
    const groups = state.groups
      .filter(g => Array.isArray(g.memberIds) && g.memberIds.includes(id))
      .map(g => g.name);
    const peers = groups.length
      ? ` (delegate via ${groups.join(', ')})`
      : '';
    return `  - ${name}${peers}`;
  }).join('\n');
}

function carryForwardLines(state){
  const pending = state.tasks.filter(t => t.status === 'pending' || t.status === 'partial');
  if(!pending.length) return '  - Nothing carrying forward';
  return pending.slice(0, 40).map(t => {
    const owners = [
      ...(t.assignees || []).map(id => state.team.find(m => m.id === id)?.name).filter(Boolean),
      ...(t.assignedGroups || []).map(id => state.groups.find(g => g.id === id)?.name).filter(Boolean).map(n => `Group: ${n}`)
    ];
    return `  - [${t.status}] ${t.title}${owners.length ? ` (${owners.join(', ')})` : ''}`;
  }).join('\n') + (pending.length > 40 ? `\n  - …and ${pending.length - 40} more` : '');
}

function doneLines(state){
  const done = state.tasks.filter(t => t.status === 'complete');
  if(!done.length) return '  - None yet';
  return done.slice(0, 30).map(t => `  - ${t.title}`).join('\n')
    + (done.length > 30 ? `\n  - …and ${done.length - 30} more` : '');
}

function inProgressLines(state){
  const partial = state.tasks.filter(t => t.status === 'partial');
  if(!partial.length) return '  - None';
  return partial.map(t => `  - ${t.title}`).join('\n');
}

function blockerRollup(entries){
  const withBlockers = entries.filter(({entry}) => entry.blockers);
  if(!withBlockers.length) return '  - None reported';
  return withBlockers.map(({m, entry}) => `  - ${m.name}: ${entry.blockers}`).join('\n');
}

// Compact People + Work snapshot — mirrors Board Day Signals without
// duplicating the full per-person detail further down.
export function daySignalsSnapshot(state){
  const absenceIds = effectiveAbsenceIds(state);
  const open = d => !isResolvedState(d.adoState);
  const openDefects = scopedDefects(state).filter(open);
  const stories = scopedUserStories(state);
  const discuss = discussionInRelease(state);
  const criticalOpen = openDefects.filter(d => d.severity === 'critical').length;
  const now = Date.now();
  const aging = openDefects.filter(d => {
    const ms = d.createdDate ? new Date(d.createdDate).getTime() : NaN;
    return Number.isFinite(ms) && Math.floor((now - ms) / 86400000) >= 8;
  }).length;
  const blockers = state.team.filter(m => (memberStandupEntry(state.standup, m.id).blockers || '').trim()).length;
  const storiesWithNote = stories.filter(us => (us.progressNotes && us.progressNotes[state.dateStr]) || (us.ongoingNote || '').trim()).length;
  const defectActivityToday = scopedDefects(state).filter(d => d.dayActivity && d.dayActivity[state.dateStr] && (d.dayActivity[state.dateStr].note || (d.dayActivity[state.dateStr].testerIds || []).length)).length;
  const pending = state.tasks.filter(t => t.status !== 'complete').length;

  return {
    people: [
      {label: 'Absent', value: absenceIds.length},
      {label: 'Discuss', value: discuss.length}
    ],
    work: [
      {label: 'Open tasks', value: pending},
      {label: 'Blockers', value: blockers},
      {label: 'Critical open', value: criticalOpen},
      {label: 'Aging 8d+', value: aging},
      {label: 'Story notes', value: storiesWithNote},
      {label: 'Defect activity', value: defectActivityToday}
    ]
  };
}

function daySignalsLines(state){
  const snap = daySignalsSnapshot(state);
  const fmt = (rows) => rows.map(r => `  - ${r.label}: ${r.value}`).join('\n');
  return `People\n${fmt(snap.people)}\nWork / Quality\n${fmt(snap.work)}`;
}

function buildBody(state, liveStandup){
  const standup = normalizeStandup(liveStandup || state.standup);
  const meta = standup[STANDUP_META_KEY];
  const absenceIds = effectiveAbsenceIds({...state, standup});
  const tomorrow = formatDisplay(shiftDate(state.dateStr, 1));
  const entries = state.team.map(m => ({m, entry: memberEntry(state, m, standup)}));
  const release = (state.releases || []).find(r => r.id === state.selectedReleaseId);
  const releaseLabel = release && release.name ? release.name.trim() : '';

  let body = `Hi team,\n\n`;
  body += releaseLabel
    ? `${releaseLabel} daily standup — ${formatLongDisplay(state.dateStr)}\n`
    : `Daily standup — ${formatLongDisplay(state.dateStr)}\n`;
  body += `Use this as the handoff into ${tomorrow}.\n\n`;

  body += section('DAY SIGNALS', daySignalsLines(state)) + '\n\n';
  const sharedHighlights = (meta.highlights || '').trim();
  if(sharedHighlights){
    body += section('STANDUP HIGHLIGHTS', sharedHighlights.split('\n').map(l => `  ${l}`).join('\n')) + '\n\n';
  }
  body += section('DONE', doneLines(state)) + '\n\n';
  body += section('IN PROGRESS', inProgressLines(state)) + '\n\n';
  body += section('BLOCKERS', blockerRollup(entries)) + '\n\n';
  body += section('ABSENCES', absenceLines(state, absenceIds)) + '\n\n';
  body += section('DISCUSSION ITEMS', discussionLines(state)) + '\n\n';
  body += section('CARRY-FORWARD (into ' + tomorrow + ')', carryForwardLines(state)) + '\n\n';

  body += section('PER-PERSON DETAIL', entries.map(({m, entry}) => {
    const absent = absenceIds.includes(m.id) ? ' [ABSENT]' : '';
    const linkedLine = entry.linkedTask ? `  Linked: ${entry.linkedTask.title}\n` : '';
    const yNote = entry.yesterday ? `  Notes: ${entry.yesterday}\n` : '';
    const tNote = entry.today ? `  Notes: ${entry.today}\n` : '';
    return `${m.name}${absent}\nYesterday:\n${yNote}${taskLines(entry.yTasks, 'status')}\nToday:\n${tNote}${taskLines(entry.tTasks, 'priority')}\n${linkedLine}Blockers: ${entry.blockers || 'None'}\nQuestions: ${entry.questions || 'None'}`;
  }).join('\n\n')) + '\n';

  if(state.settings.yourName) body += `\nThanks,\n${state.settings.yourName}\n`;
  return body;
}

function standupSubject(state){
  const release = (state.releases || []).find(r => r.id === state.selectedReleaseId);
  const releaseLabel = release && release.name ? release.name.trim() : '';
  const datePart = formatDisplay(state.dateStr);
  return releaseLabel
    ? `${releaseLabel} — Daily Standup · ${datePart}`
    : `Daily Standup · ${datePart}`;
}

// liveStandup: {[memberId]: {yesterday, today, blockers, questions, linkedTaskId}} read from
// the DOM at send time so an un-blurred field still makes it into the email.
export async function sendStandupEmail(state, liveStandup){
  const recipients = (state.team || [])
    .filter(m => m && m.email && isValidEmail(m.email))
    .map(m => m.email);
  const missingRecipients = !recipients.length;

  const subject = standupSubject(state);
  const body = buildBody(state, liveStandup);
  // Always draft/copy/open — even with an empty To — so the topbar/card
  // buttons never look dead when People emails aren't filled in yet.
  const result = await deliverEmailDraft({to: recipients, subject, body});

  if(result.via === 'failed'){
    state.standupWarn = missingRecipients
      ? "Couldn't draft standup — add teammate emails in People, then try again. Clipboard copy also failed."
      : draftDeliveryMessage({label: 'Standup draft', via: 'failed'});
    state.standupMsg = '';
    return {ok:false};
  }

  state.standupWarn = missingRecipients
    ? 'No teammate emails on file — opened with an empty To. Add emails in People for the full roster.'
    : '';
  state.standupMsg = draftDeliveryMessage({
    label: 'Standup email',
    via: result.via,
    clipboardOk: result.clipboardOk,
    recipientNote: missingRecipients
      ? '(empty To)'
      : `(${recipients.length} recipient${recipients.length===1?'':'s'})`
  });
  return {ok:true, via: result.via, missingRecipients};
}
