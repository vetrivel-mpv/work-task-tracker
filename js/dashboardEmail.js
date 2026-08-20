// Builds a "Defects Dashboard" summary email for a manager — counts and
// breakdowns only, not a per-ticket list (that's what defectsEmail.js is
// for). Scope matches whatever the Dashboard page is currently showing:
// the selected release, or every release if none is picked.

import { SEVERITY_LABELS, defectReleaseId, isResolvedState, isValidEmail } from './state.js';
import { tableRow, divider } from './emailFormat.js';
import { deliverEmailDraft, draftDeliveryMessage } from './mailtoDelivery.js';

function topRows(map, limit = 8){
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export async function sendDashboardEmail(state, toEmail){
  const email = (toEmail || state.settings.managerEmail || '').trim();
  if(email && !isValidEmail(email)){
    state.dashboardEmailWarn = "That doesn't look like a valid email address.";
    return {ok:false};
  }

  const usById = new Map(state.userStories.map(us => [us.id, us]));
  const releaseIdFor = d => defectReleaseId(d, state.releases, usById);
  const isOpen = d => !isResolvedState(d.adoState);

  const scopedRelease = state.releases.find(r => r.id === state.selectedReleaseId) || null;
  const defects = scopedRelease ? state.defects.filter(d => releaseIdFor(d) === scopedRelease.id) : state.defects;
  const scopeLabel = scopedRelease ? scopedRelease.name : 'All releases';

  if(!defects.length){
    state.dashboardEmailWarn = `No defects under ${scopeLabel} — nothing to send.`;
    return {ok:false};
  }

  const total = defects.length;
  const openCount = defects.filter(isOpen).length;
  const resolvedCount = total - openCount;
  const criticalCount = defects.filter(d => d.severity === 'critical').length;
  const highCount = defects.filter(d => d.severity === 'high').length;
  const unassignedOpen = defects.filter(d => isOpen(d) && !d.assigneeId && !(d.assigneeEmail || '').trim()).length;
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

  const severityMap = new Map();
  defects.forEach(d => severityMap.set(d.severity, (severityMap.get(d.severity) || 0) + 1));
  const severityRows = ['critical', 'high', 'medium', 'low']
    .filter(s => severityMap.has(s))
    .map(s => tableRow([SEVERITY_LABELS[s], severityMap.get(s)]));

  const statusMap = new Map();
  defects.forEach(d => { const k = d.adoState || 'No status set'; statusMap.set(k, (statusMap.get(k) || 0) + 1); });
  const statusRows = topRows(statusMap).map(([label, count]) => tableRow([label, count]));

  const assigneeMap = new Map();
  defects.forEach(d => {
    const name = d.assigneeId ? (state.team.find(m => m.id === d.assigneeId)?.name || 'Unknown') : 'Unassigned';
    assigneeMap.set(name, (assigneeMap.get(name) || 0) + 1);
  });
  const assigneeRows = topRows(assigneeMap).map(([label, count]) => tableRow([label, count]));

  const releaseSummaryRows = scopedRelease ? [] : state.releases.map(r => {
    const rDefects = state.defects.filter(d => releaseIdFor(d) === r.id);
    if(!rDefects.length) return null;
    const rOpen = rDefects.filter(isOpen).length;
    return tableRow([r.name, rDefects.length, rOpen, rDefects.length - rOpen]);
  }).filter(Boolean);

  const subject = `Defects Summary – ${scopeLabel}`;
  let body = `Hi,\n\nHere's the defects summary for ${scopeLabel} as of today.\n\n`;

  body += `OVERVIEW\n${tableRow(['Total', 'Critical', 'High', 'Open', 'Resolved'])}\n${divider(50)}\n`;
  body += `${tableRow([total, criticalCount, highCount, openCount, resolvedCount])}\n\n`;
  body += `LEAD SIGNALS\n${tableRow(['New (14d)', 'Aging 8d+', 'Unassigned open'])}\n${divider(50)}\n`;
  body += `${tableRow([new14d, aging8, unassignedOpen])}\n\n`;

  if(releaseSummaryRows.length){
    body += `BY RELEASE\n${tableRow(['Release', 'Total', 'Open', 'Resolved'])}\n${divider(50)}\n`;
    body += releaseSummaryRows.join('\n') + '\n\n';
  }

  body += `BY SEVERITY\n${tableRow(['Severity', 'Count'])}\n${divider(50)}\n${severityRows.join('\n')}\n\n`;
  body += `BY STATUS\n${tableRow(['Status', 'Count'])}\n${divider(50)}\n${statusRows.join('\n')}\n\n`;
  body += `BY ASSIGNEE\n${tableRow(['Assignee', 'Count'])}\n${divider(50)}\n${assigneeRows.join('\n')}`;

  body = body.trimEnd();
  if(state.settings.yourName) body += `\n\nBest regards,\n${state.settings.yourName}`;

  const result = await deliverEmailDraft({to: email, subject, body});
  if(result.via === 'failed'){
    state.dashboardEmailWarn = draftDeliveryMessage({label: 'Dashboard summary', via: 'failed'});
    state.dashboardEmailMsg = '';
    return {ok:false};
  }

  state.dashboardEmailWarn = '';
  state.dashboardEmailMsg = draftDeliveryMessage({
    label: 'Dashboard summary',
    via: result.via,
    clipboardOk: result.clipboardOk,
    recipientNote: email ? `for ${email}` : '(add a recipient in the mail app)'
  });
  return {ok:true, via: result.via};
}
