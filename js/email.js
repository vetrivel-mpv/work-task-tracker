// Builds the "Daily Update" mailto draft and validates the manager's email
// address before handing off to the mail app.

import { formatDisplay, formatLongDisplay, MAX_NAME_LENGTH, isValidEmail } from './state.js';
import { saveSettings } from './storage.js';
import { carryForwardPending } from './tasks.js';
import { tableRow, divider } from './emailFormat.js';
import { deliverEmailDraft, draftDeliveryMessage } from './mailtoDelivery.js';

function assigneeSuffix(t, team, groups){
  const names = (t.assignees || []).map(id => team.find(m => m.id === id)).filter(Boolean).map(m => m.name);
  const groupNames = (t.assignedGroups || []).map(id => groups.find(g => g.id === id)).filter(Boolean).map(g => `Group: ${g.name}`);
  const parts = [...names, ...groupNames];
  return parts.length ? ` (${parts.join(', ')})` : '';
}

function fmtTaskList(list, team, groups){
  if(!list.length) return null;
  const labelMap = {high:'High', medium:'Med', low:'Low'};
  const capped = list.slice(0, 25);
  const lines = capped.map(t => {
    const line = `- [${labelMap[t.priority]}] ${t.title}${assigneeSuffix(t, team, groups)}`;
    return t.comment ? `${line}\n      ↳ ${t.comment}` : line;
  });
  if(list.length > 25) lines.push(`...and ${list.length - 25} more`);
  return lines.join('\n');
}

// Per-teammate and per-group rollup for leadership reporting: how many
// tasks are owned and where those stand, as a column-aligned table.
// Partial credit counts as half, matching the stat bar. Group tasks are
// reported separately from individual tasks (not double-counted into each
// member's own row).
function fmtTeamAlignment(state){
  if(!state.team.length && !state.groups.length) return null;

  const rollup = (assigned) => {
    const complete = assigned.filter(t => t.status === 'complete').length;
    const partial = assigned.filter(t => t.status === 'partial').length;
    const pending = assigned.length - complete - partial;
    const pct = assigned.length ? Math.round(((complete + partial * 0.5) / assigned.length) * 100) : 0;
    return {complete, partial, pending, pct};
  };

  const rows = [tableRow(['Name', 'Complete', 'Partial', 'Pending', 'Weighted']), divider()];

  state.team.forEach(m => {
    const assigned = state.tasks.filter(t => Array.isArray(t.assignees) && t.assignees.includes(m.id));
    const r = rollup(assigned);
    rows.push(tableRow([m.name, r.complete, r.partial, r.pending, `${r.pct}%`]));
  });

  if(state.groups.length){
    rows.push('');
    rows.push('Groups');
    state.groups.forEach(g => {
      const assigned = state.tasks.filter(t => Array.isArray(t.assignedGroups) && t.assignedGroups.includes(g.id));
      const r = rollup(assigned);
      rows.push(tableRow([g.name, r.complete, r.partial, r.pending, `${r.pct}%`]));
    });
  }

  const unassignedCount = state.tasks.filter(t =>
    (!Array.isArray(t.assignees) || !t.assignees.length) &&
    (!Array.isArray(t.assignedGroups) || !t.assignedGroups.length)
  ).length;
  rows.push('');
  rows.push(`Unassigned: ${unassignedCount} task${unassignedCount===1?'':'s'}`);
  return rows.join('\n');
}

// formValues carries the live input values from the DOM so this stays
// framework-agnostic; state is mutated in place with the result.
// Returns {focusField} naming a field to focus, or null on success.
export async function sendEmailUpdate(state, formValues){
  const email = (formValues.managerEmail || state.settings.managerEmail || '').trim();
  if(!email){
    state.emailWarn = "Add your manager's email above first.";
    return {focusField: 'managerEmail'};
  }
  if(!isValidEmail(email)){
    state.emailWarn = "That doesn't look like a valid email address.";
    return {focusField: 'managerEmail'};
  }
  state.settings.managerEmail = email;
  state.settings.yourName = (formValues.yourName || '').trim().slice(0, MAX_NAME_LENGTH);
  await saveSettings(state.settings);

  const tasks = state.tasks.slice().sort((a,b)=>a.order-b.order);
  const completed = tasks.filter(t => t.status === 'complete');
  const partial = tasks.filter(t => t.status === 'partial');
  const pending = tasks.filter(t => t.status === 'pending');
  const added = tasks.filter(t => t.source === 'manual');
  // Partial credit counts as half toward the weighted completion figure.
  const pct = tasks.length ? Math.round(((completed.length + partial.length * 0.5) / tasks.length) * 100) : 0;

  // No repeated title line here — the mail client already shows the
  // Subject, so opening the body with the same text again was redundant.
  let body = `Hi,\n\nHere's the status for ${formatLongDisplay(state.dateStr)}.\n\n`;

  if(tasks.length){
    body += `SUMMARY\n${tableRow(['Complete', 'Partial', 'Pending', 'Weighted'])}\n${divider()}\n`;
    body += `${tableRow([completed.length, partial.length, pending.length, pct+'%'])}\n\n`;
  }else{
    body += `No tasks logged for this day.\n\n`;
  }

  body += `COMPLETE (${completed.length})\n${fmtTaskList(completed, state.team, state.groups) || '- None yet'}\n\n`;
  body += `PARTIALLY COMPLETE (${partial.length})\n${fmtTaskList(partial, state.team, state.groups) || '- None'}\n\n`;
  body += `PENDING — carrying to tomorrow (${pending.length})\n${fmtTaskList(pending, state.team, state.groups) || '- All clear, nothing pending'}\n\n`;
  const addedList = fmtTaskList(added, state.team, state.groups);
  if(addedList) body += `ADDED TODAY (outside the plan)\n${addedList}\n\n`;
  const teamList = fmtTeamAlignment(state);
  if(teamList) body += `TEAM ALIGNMENT\n${teamList}\n\n`;
  body = body.trimEnd();
  if(state.settings.yourName) body += `\n\nBest regards,\n${state.settings.yourName}`;

  const subject = `Daily Update – ${formatDisplay(state.dateStr)}`;

  let carriedCount = 0;
  if(state.settings.carryForward){
    carriedCount = await carryForwardPending(state);
  }

  const result = await deliverEmailDraft({to: email, subject, body});
  if(result.via === 'failed'){
    state.emailWarn = draftDeliveryMessage({label: 'Daily update', via: 'failed'});
    state.emailMsg = '';
    return {focusField: null};
  }

  state.emailWarn = '';
  const base = draftDeliveryMessage({
    label: 'Daily update',
    via: result.via,
    clipboardOk: result.clipboardOk,
    recipientNote: `for ${email}`
  });
  state.emailMsg = carriedCount > 0
    ? `${base} ${carriedCount} pending task${carriedCount===1?'':'s'} carried to tomorrow.`
    : base;
  return {focusField: null};
}
