// Daily System Testing (QA) status email — plain-text mailto draft for
// tester/day reporting. Test case counts are manual (ADO does not sync
// Test Cases here). Highlights / lowlights can be prefilled from board,
// defects, stories, standup, and discussion queue, then edited before send.

import { fromDateStr, isResolvedState, isValidEmail, MAX_NAME_LENGTH, userStoryReleaseId } from './state.js';
import { saveSettings, saveQaStatus } from './storage.js';
import { normalizeStandup, STANDUP_META_KEY, memberStandupEntry } from './standupShape.js';
import { deliverEmailDraft, draftDeliveryMessage } from './mailtoDelivery.js';
import { testCountsFor, testCountsAreEmpty, scopedDefects } from './opsHelpers.js';
import { setTestCounts } from './userStories.js';

export const QA_STATUS_OPTIONS = [
  {id: 'onTrack', label: 'On Track', emoji: '🟢'},
  {id: 'atRisk', label: 'At Risk', emoji: '🟡'},
  {id: 'blocked', label: 'Blocked', emoji: '🔴'}
];

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatQaSubjectDate(dateStr){
  const d = fromDateStr(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTH_ABBR[d.getMonth()]}`;
}

export function storyUsLabel(us){
  if(!us) return '';
  const idPart = us.adoId ? String(us.adoId) : String(us.id || '').replace(/^id-/, '').slice(0, 8);
  return `US-${idPart} – ${us.title || 'Untitled'}`;
}

function bulletLines(items, empty = '- None'){
  const clean = items.map(s => String(s || '').trim()).filter(Boolean);
  if(!clean.length) return empty;
  return clean.map(s => (s.startsWith('- ') ? s : `- ${s}`)).join('\n');
}

function scopedStories(state){
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  if(!selected) return state.userStories.slice();
  return state.userStories.filter(us => userStoryReleaseId(us, state.releases) === selected.id);
}

function suggestStatus(state){
  const meta = normalizeStandup(state.standup)[STANDUP_META_KEY];
  const open = d => !isResolvedState(d.adoState);
  const defects = scopedDefects(state);
  const openCritical = defects.filter(d => open(d) && d.severity === 'critical').length;
  const blockers = state.team.filter(m => (memberStandupEntry(state.standup, m.id).blockers || '').trim()).length;
  if(blockers > 0 || openCritical > 0) return 'blocked';
  const openHigh = defects.filter(d => open(d) && (d.severity === 'critical' || d.severity === 'high')).length;
  if(openHigh > 0 || meta.discussion.length > 0) return 'atRisk';
  return 'onTrack';
}

function buildHighlightPrefill(state){
  const lines = [];
  const done = state.tasks.filter(t => t.status === 'complete');
  done.slice(0, 8).forEach(t => lines.push(t.title));
  scopedStories(state).forEach(us => {
    const note = (us.progressNotes && us.progressNotes[state.dateStr] || '').trim();
    if(note) lines.push(`${us.adoId ? `#${us.adoId} ` : ''}${us.title}: ${note}`);
  });
  const partial = state.tasks.filter(t => t.status === 'partial');
  partial.slice(0, 4).forEach(t => lines.push(`In progress — ${t.title}`));
  return bulletLines(lines, '');
}

function buildLowlightPrefill(state){
  const lines = [];
  const open = d => !isResolvedState(d.adoState);
  const today = state.dateStr;
  const now = Date.now();

  scopedDefects(state).forEach(d => {
    if(!open(d)) return;
    const day = d.dayActivity && d.dayActivity[today];
    const createdToday = d.createdDate && String(d.createdDate).slice(0, 10) === today;
    const isHot = d.severity === 'critical' || d.severity === 'high';
    const hasActivity = day && (day.note || (day.testerIds || []).length);
    if(!(isHot || createdToday || hasActivity)) return;
    const sev = (d.severity || '').toUpperCase();
    const ado = d.adoId ? `#${d.adoId} ` : '';
    const note = day && day.note ? ` — ${day.note}` : '';
    const ageMs = d.createdDate ? new Date(d.createdDate).getTime() : NaN;
    const aging = Number.isFinite(ageMs) && Math.floor((now - ageMs) / 86400000) >= 8 ? ' (aging 8d+)' : '';
    lines.push(`[${sev}] ${ado}${d.title}${note}${aging}`);
  });

  state.team.forEach(m => {
    const blockers = (memberStandupEntry(state.standup, m.id).blockers || '').trim();
    if(blockers) lines.push(`${m.name} blocked: ${blockers}`);
  });

  const meta = normalizeStandup(state.standup)[STANDUP_META_KEY];
  meta.discussion.forEach(d => {
    const item = d.kind === 'userStory'
      ? state.userStories.find(u => u.id === d.itemId)
      : state.defects.find(x => x.id === d.itemId);
    if(!item) return;
    const kind = d.kind === 'userStory' ? 'US' : 'Defect';
    const note = (d.note || '').trim();
    lines.push(`Discuss [${kind}] ${item.title}${note ? ` — ${note}` : ''}`);
  });

  return bulletLines(lines, '');
}

function buildPlanPrefill(state){
  const lines = [];
  state.tasks.filter(t => t.status === 'pending' || t.status === 'partial').slice(0, 8).forEach(t => {
    lines.push(t.title);
  });
  return bulletLines(lines, '');
}

function buildHelpPrefill(state){
  const lines = [];
  state.team.forEach(m => {
    const q = (memberStandupEntry(state.standup, m.id).questions || '').trim();
    if(q) lines.push(`${m.name}: ${q}`);
  });
  return bulletLines(lines, '');
}

export function emptyQaStatusDraft(state){
  const stories = scopedStories(state);
  const first = stories[0];
  const counts = first ? testCountsFor(first, state.dateStr) : blankTestCountsSafe();
  return {
    reporterName: (state.settings.yourName || '').trim(),
    dateStr: state.dateStr,
    userStoryId: first ? first.id : '',
    executed: counts.executed,
    planned: counts.planned,
    pass: counts.pass,
    fail: counts.fail,
    blocked: counts.blocked,
    status: suggestStatus(state),
    highlights: '',
    lowlights: '',
    planTomorrow: '',
    helpNeeded: ''
  };
}

function blankTestCountsSafe(){
  return {planned: '', executed: '', pass: '', fail: '', blocked: ''};
}

function countsFromStory(state, userStoryId){
  const us = state.userStories.find(s => s.id === userStoryId);
  return us ? testCountsFor(us, state.dateStr) : blankTestCountsSafe();
}

export function applyStoryCountsToDraft(state, draft){
  const next = {...draft};
  const counts = countsFromStory(state, next.userStoryId);
  next.executed = counts.executed;
  next.planned = counts.planned;
  next.pass = counts.pass;
  next.fail = counts.fail;
  next.blocked = counts.blocked;
  return next;
}

// Merge saved draft with live prefills. Prefills only run when there is no
 // saved draft for the day — so clearing a field and saving sticks.
export function buildQaStatusDraft(state, saved){
  const base = emptyQaStatusDraft(state);
  if(!saved || typeof saved !== 'object'){
    return {
      ...base,
      highlights: buildHighlightPrefill(state),
      lowlights: buildLowlightPrefill(state),
      planTomorrow: buildPlanPrefill(state),
      helpNeeded: buildHelpPrefill(state)
    };
  }

  const merged = {...base, ...saved, dateStr: state.dateStr};
  if(!(merged.reporterName || '').trim()) merged.reporterName = base.reporterName;
  if(!merged.userStoryId && base.userStoryId) merged.userStoryId = base.userStoryId;
  if(!QA_STATUS_OPTIONS.some(o => o.id === merged.status)) merged.status = base.status;
  const countKeys = ['executed','planned','pass','fail','blocked'];
  const savedCountsEmpty = countKeys.every(k => saved[k] === '' || saved[k] === null || saved[k] === undefined);
  if(savedCountsEmpty && merged.userStoryId){
    const counts = countsFromStory(state, merged.userStoryId);
    if(!testCountsAreEmpty(counts)){
      countKeys.forEach(k => { merged[k] = counts[k]; });
    }
  }
  return merged;
}

function numOrBlank(v){
  if(v === '' || v === null || v === undefined) return '__';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : '__';
}

export function buildQaStatusEmail(state, draft){
  const name = (draft.reporterName || state.settings.yourName || 'Your Name').trim() || 'Your Name';
  const dateLabel = formatQaSubjectDate(draft.dateStr || state.dateStr);
  const stories = scopedStories(state);
  const us = stories.find(s => s.id === draft.userStoryId) || state.userStories.find(s => s.id === draft.userStoryId);
  const usLine = us ? storyUsLabel(us) : 'US-___ – [Story Title]';
  const statusOpt = QA_STATUS_OPTIONS.find(o => o.id === draft.status) || QA_STATUS_OPTIONS[0];

  const subject = `Daily QA Status – ${name} – ${dateLabel}`;

  const highlights = bulletLines(
    String(draft.highlights || '').split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()),
    '- [What went well / completed today]'
  );
  const lowlights = bulletLines(
    String(draft.lowlights || '').split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()),
    '- [Defects found, blockers, delays]'
  );
  const plan = bulletLines(
    String(draft.planTomorrow || '').split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()),
    '- [What you\'ll focus on next]'
  );
  const help = bulletLines(
    String(draft.helpNeeded || '').split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()),
    '- [Env access, clarification, dependency]'
  );

  const body = [
    `User Story: ${usLine}`,
    '',
    `Test Cases: Executed [${numOrBlank(draft.executed)}] / Planned [${numOrBlank(draft.planned)}]   |   Pass [${numOrBlank(draft.pass)}]   Fail [${numOrBlank(draft.fail)}]   Blocked [${numOrBlank(draft.blocked)}]`,
    '',
    `Status: ${statusOpt.emoji} ${statusOpt.label}`,
    '',
    'Highlights:',
    highlights,
    '',
    'Lowlights / Issues:',
    lowlights,
    '',
    'Plan for Tomorrow:',
    plan,
    '',
    'Help Needed (if any):',
    help
  ].join('\n');

  return {subject, body, name};
}

function readDraftFromDom(){
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const statusEl = document.querySelector('input[name="qaStatusChoice"]:checked');
  return {
    reporterName: val('qaReporterName'),
    dateStr: val('qaDateStr') || undefined,
    userStoryId: val('qaUserStoryId'),
    executed: val('qaExecuted'),
    planned: val('qaPlanned'),
    pass: val('qaPass'),
    fail: val('qaFail'),
    blocked: val('qaBlockedCount'),
    status: statusEl ? statusEl.value : 'onTrack',
    highlights: val('qaHighlights'),
    lowlights: val('qaLowlights'),
    planTomorrow: val('qaPlanTomorrow'),
    helpNeeded: val('qaHelpNeeded')
  };
}

export function captureQaStatusForm(state){
  const fromDom = readDraftFromDom();
  return {
    ...state.qaStatusDraft,
    ...fromDom,
    dateStr: state.dateStr
  };
}

export async function persistQaStatusDraft(state, draft){
  const next = {...(draft || state.qaStatusDraft), dateStr: state.dateStr};
  state.qaStatusDraft = next;
  await saveQaStatus(state.dateStr, next);
  if(next.userStoryId){
    await setTestCounts(state, next.userStoryId, state.dateStr, {
      planned: next.planned, executed: next.executed, pass: next.pass, fail: next.fail, blocked: next.blocked
    });
  }
}

export async function sendQaStatusEmail(state, formValues){
  const draft = {...(state.qaStatusDraft || emptyQaStatusDraft(state)), ...(formValues || {}), dateStr: state.dateStr};
  const name = (draft.reporterName || '').trim().slice(0, MAX_NAME_LENGTH);
  draft.reporterName = name;
  state.qaStatusDraft = draft;

  if(name){
    state.settings.yourName = name;
    await saveSettings(state.settings);
  }
  await saveQaStatus(state.dateStr, draft);
  if(draft.userStoryId){
    await setTestCounts(state, draft.userStoryId, state.dateStr, {
      planned: draft.planned, executed: draft.executed, pass: draft.pass, fail: draft.fail, blocked: draft.blocked
    });
  }

  const email = (state.settings.managerEmail || '').trim();
  if(email && !isValidEmail(email)){
    state.qaStatusWarn = "Manager email on file doesn't look valid — fix it in Settings, or clear it to open a blank To field.";
    state.qaStatusMsg = '';
    return {ok: false};
  }

  const {subject, body} = buildQaStatusEmail(state, draft);
  const result = await deliverEmailDraft({to: email, subject, body});

  if(result.via === 'failed'){
    state.qaStatusWarn = draftDeliveryMessage({label: 'Daily QA Status', via: 'failed'});
    state.qaStatusMsg = '';
    return {ok: false};
  }

  state.qaStatusWarn = '';
  state.qaStatusMsg = draftDeliveryMessage({
    label: 'Daily QA Status',
    via: result.via,
    clipboardOk: result.clipboardOk,
    recipientNote: email ? `for ${email}` : '(add a recipient in the mail app)'
  });
  return {ok: true, via: result.via};
}
