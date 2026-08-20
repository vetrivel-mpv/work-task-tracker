// People review rollups + draft appreciation emails from local dated data
// (tasks:YYYY-MM-DD, standup:YYYY-MM-DD) plus live defects dayActivity.
// Browser-only — no scheduling; drafts open mailto / clipboard only.

import { isValidEmail } from './state.js';
import { normalizeStandup, STANDUP_META_KEY, memberHasStandupNotes } from './standupShape.js';
import { deliverEmailDraft, draftDeliveryMessage } from './mailtoDelivery.js';

function parseDateKey(dateStr){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if(!m) return null;
  return {y: +m[1], mo: +m[2], d: +m[3], key: dateStr};
}

function startOfQuarter(y, mo){
  const q = Math.floor((mo - 1) / 3) * 3 + 1;
  return {y, mo: q, d: 1};
}

export function periodBounds(period, refDate = new Date()){
  const y = refDate.getFullYear();
  const mo = refDate.getMonth() + 1;
  const d = refDate.getDate();
  if(period === 'year'){
    return {from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}`};
  }
  if(period === 'quarter'){
    const q = startOfQuarter(y, mo);
    const endMo = q.mo + 2;
    const endDay = endMo === 3 || endMo === 12 ? 31 : 30;
    const qNum = Math.floor((mo - 1) / 3) + 1;
    return {
      from: `${y}-${String(q.mo).padStart(2,'0')}-01`,
      to: `${y}-${String(endMo).padStart(2,'0')}-${endDay}`,
      label: `Q${qNum} ${y}`
    };
  }
  // month (default)
  const last = new Date(y, mo, 0).getDate();
  const monthName = refDate.toLocaleString(undefined, {month: 'long', year: 'numeric'});
  return {
    from: `${y}-${String(mo).padStart(2,'0')}-01`,
    to: `${y}-${String(mo).padStart(2,'0')}-${String(last).padStart(2,'0')}`,
    label: monthName
  };
}

function inRange(dateStr, from, to){
  return dateStr >= from && dateStr <= to;
}

function scanLocalDatedKeys(){
  const tasksByDate = {};
  const standupByDate = {};
  try{
    Object.keys(localStorage).forEach(k => {
      try{
        if(k.startsWith('tasks:')){
          const dateStr = k.slice('tasks:'.length);
          if(parseDateKey(dateStr)) tasksByDate[dateStr] = JSON.parse(localStorage.getItem(k)) || [];
        }else if(k.startsWith('standup:')){
          const dateStr = k.slice('standup:'.length);
          if(parseDateKey(dateStr)) standupByDate[dateStr] = normalizeStandup(JSON.parse(localStorage.getItem(k)));
        }
      }catch(e){ /* skip bad entries */ }
    });
  }catch(e){ /* private mode etc. */ }
  return {tasksByDate, standupByDate};
}

export function computePeopleReviews(state, period = 'month', refDate = new Date()){
  const bounds = periodBounds(period, refDate);
  const {tasksByDate, standupByDate} = scanLocalDatedKeys();
  // Prefer live in-memory day so unsaved same-session edits count.
  tasksByDate[state.dateStr] = state.tasks;
  standupByDate[state.dateStr] = normalizeStandup(state.standup);

  const rows = state.team.map(m => ({
    id: m.id,
    name: m.name,
    email: m.email || '',
    role: m.role || '',
    tasksComplete: 0,
    standupDays: 0,
    absences: 0,
    defectsTouched: 0
  }));
  const byId = new Map(rows.map(r => [r.id, r]));

  Object.entries(tasksByDate).forEach(([dateStr, tasks]) => {
    if(!inRange(dateStr, bounds.from, bounds.to)) return;
    (Array.isArray(tasks) ? tasks : []).forEach(t => {
      if(t.status !== 'complete') return;
      (t.assignees || []).forEach(id => {
        const row = byId.get(id);
        if(row) row.tasksComplete += 1;
      });
    });
  });

  Object.entries(standupByDate).forEach(([dateStr, standup]) => {
    if(!inRange(dateStr, bounds.from, bounds.to)) return;
    const meta = standup[STANDUP_META_KEY] || {absences: []};
    (meta.absences || []).forEach(id => {
      const row = byId.get(id);
      if(row) row.absences += 1;
    });
    state.team.forEach(m => {
      if(memberHasStandupNotes(standup[m.id])){
        const row = byId.get(m.id);
        if(row) row.standupDays += 1;
      }
    });
  });

  (state.defects || []).forEach(d => {
    const activity = d.dayActivity || {};
    Object.entries(activity).forEach(([dateStr, day]) => {
      if(!inRange(dateStr, bounds.from, bounds.to)) return;
      (day.testerIds || []).forEach(id => {
        const row = byId.get(id);
        if(row) row.defectsTouched += 1;
      });
    });
  });

  rows.sort((a, b) =>
    (b.tasksComplete + b.standupDays + b.defectsTouched) -
    (a.tasksComplete + a.standupDays + a.defectsTouched) ||
    a.name.localeCompare(b.name)
  );

  return {period, bounds, rows};
}

function appreciationBody(state, member, rollup, bounds){
  const bits = [];
  if(rollup.tasksComplete) bits.push(`${rollup.tasksComplete} task${rollup.tasksComplete===1?'':'s'} completed`);
  if(rollup.standupDays) bits.push(`standup notes on ${rollup.standupDays} day${rollup.standupDays===1?'':'s'}`);
  if(rollup.defectsTouched) bits.push(`defect day activity on ${rollup.defectsTouched} touch${rollup.defectsTouched===1?'':'es'}`);
  const highlights = bits.length
    ? bits.join(', ')
    : 'consistent presence with the team this period';

  let body = `Hi ${member.name},\n\n`;
  body += `Quick note of appreciation for your work during ${bounds.label}.\n\n`;
  body += `From the delivery board: ${highlights}.\n\n`;
  body += `Thank you — it shows up for the team and for delivery quality.\n`;
  if(state.settings.yourName) body += `\nBest,\n${state.settings.yourName}\n`;
  body += `\n— Draft only, not auto-sent`;
  return body;
}

export async function draftAppreciationEmail(state, memberId, period = 'month'){
  const member = state.team.find(m => m.id === memberId);
  if(!member){
    state.peopleReviewWarn = 'Pick a teammate first.';
    return {ok:false};
  }
  const {bounds, rows} = computePeopleReviews(state, period);
  const rollup = rows.find(r => r.id === member.id) || {
    tasksComplete: 0, standupDays: 0, absences: 0, defectsTouched: 0
  };
  const to = (member.email && isValidEmail(member.email)) ? member.email : '';
  const subject = `Appreciation · ${member.name} · ${bounds.label}`;
  const body = appreciationBody(state, member, rollup, bounds);
  const result = await deliverEmailDraft({to, subject, body});
  if(result.via === 'failed'){
    state.peopleReviewWarn = draftDeliveryMessage({label: 'Appreciation draft', via: 'failed'});
    state.peopleReviewMsg = '';
    return {ok:false};
  }
  state.peopleReviewWarn = '';
  state.peopleReviewMsg = draftDeliveryMessage({
    label: 'Appreciation email',
    via: result.via,
    clipboardOk: result.clipboardOk,
    recipientNote: to ? `for ${member.name}` : `(add ${member.name}'s address in the mail app)`
  });
  return {ok:true, via: result.via};
}

export async function draftAppreciationEmailAll(state, period = 'month'){
  const {bounds, rows} = computePeopleReviews(state, period);
  if(!rows.length){
    state.peopleReviewWarn = 'Add teammates in People before drafting appreciation emails.';
    return {ok:false};
  }
  // One combined draft the lead can split — avoids opening N mail windows.
  let body = `Hi,\n\n`;
  body += `Draft appreciation notes for ${bounds.label} (edit before sending).\n\n`;
  rows.forEach(r => {
    const m = state.team.find(t => t.id === r.id);
    if(!m) return;
    body += `---\nTo: ${m.email || '(add email)'}\n`;
    body += appreciationBody(state, m, r, bounds) + '\n\n';
  });
  body += `— Combined draft · not auto-sent`;

  const subject = `Appreciation drafts · ${bounds.label}`;
  const result = await deliverEmailDraft({to: '', subject, body});
  if(result.via === 'failed'){
    state.peopleReviewWarn = draftDeliveryMessage({label: 'Appreciation drafts', via: 'failed'});
    state.peopleReviewMsg = '';
    return {ok:false};
  }
  state.peopleReviewWarn = '';
  state.peopleReviewMsg = draftDeliveryMessage({
    label: `Appreciation drafts for ${rows.length} teammate${rows.length===1?'':'s'}`,
    via: result.via,
    clipboardOk: result.clipboardOk,
    tooLong: result.tooLong,
    recipientNote: `(${bounds.label} — review and send individually; nothing is auto-sent)`
  });
  return {ok:true, via: result.via};
}
