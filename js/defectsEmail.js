// Builds the "Defects" mailto draft and opens it directly — no recipient
// prompt. Recipients are auto-filled from whoever's assigned to or raised
// each defect in scope (captured during ADO sync), so this doubles as a
// one-click reminder to the actual people who need to look at it — falls
// back to a blank To field only when none of that is known. Scope always
// mirrors exactly what's currently visible on the Defects page: the
// selected release plus whatever tag filter applies.
//
// A mailto body is plain text only — no mail client (Outlook, Apple Mail,
// Gmail) renders HTML tags inside it, so a real bordered table can't be
// embedded in the draft directly. Instead, a real HTML table is copied to
// the clipboard alongside the draft opening, and the draft's body tells you
// to paste it in — one manual step, but it's the only way to get an actual
// table rather than tab-aligned plain text. If the clipboard write fails
// (unsupported browser, permission denied), it falls back to embedding the
// plain-text table directly, same as before.

import { SEVERITY_LABELS, defectReleaseId, resolveAdoConnection } from './state.js';
import { tableRow, divider } from './emailFormat.js';
import { deliverEmailDraft, draftDeliveryMessage } from './mailtoDelivery.js';
import { scopedDefects } from './opsHelpers.js';

const MAX_COMMENT_PREVIEW = 100;
const TABLE_HEADERS = ['ADO #', 'Severity', 'Title', 'Status', 'User Story', 'Assignee', 'Latest Comment'];

function escapeHtmlText(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// A plain-text mailto body can't render a clickable link separate from its
// URL — but mail clients auto-linkify a bare URL that appears as text, so
// the full ADO work item URL doubles as the "ADO #" cell instead of a
// static "#2331". Falls back to the plain id when the connection (org/
// project) can't be resolved, e.g. a manually-added defect.
function adoWorkItemUrl(adoId, connection){
  if(!adoId || !connection || !connection.org || !connection.project) return null;
  return `https://dev.azure.com/${encodeURIComponent(connection.org)}/${encodeURIComponent(connection.project)}/_workitems/edit/${adoId}`;
}

function fmtLatestComment(latestComment){
  if(!latestComment || !latestComment.text) return '-';
  const who = latestComment.author ? `${latestComment.author}: ` : '';
  const text = who + latestComment.text;
  return text.length > MAX_COMMENT_PREVIEW ? text.slice(0, MAX_COMMENT_PREVIEW - 1) + '…' : text;
}

// Local People match first (same resolution the Defects page itself uses),
// falling back to the raw ADO email when nothing matched locally, so an
// unmatched assignee still shows as *something* reachable rather than
// silently disappearing.
function fmtAssignee(d, team){
  if(d.assigneeId){
    const m = team.find(t => t.id === d.assigneeId);
    if(m) return m.name;
  }
  return d.assigneeEmail || 'Unassigned';
}

function defectRowValues(d, usById, connection, team){
  const us = d.userStoryId ? usById.get(d.userStoryId) : null;
  const url = adoWorkItemUrl(d.adoId, connection);
  return {
    adoId: d.adoId ? `#${d.adoId}` : '-',
    adoUrl: url,
    severity: SEVERITY_LABELS[d.severity] || d.severity,
    title: d.title,
    status: d.adoState || '-',
    userStory: us ? us.title : '-',
    assignee: fmtAssignee(d, team),
    comment: fmtLatestComment(d.latestComment)
  };
}

function plainTextSection(title, defects, usById, connection, team){
  const header = tableRow(TABLE_HEADERS);
  const rows = defects.map(d => {
    const v = defectRowValues(d, usById, connection, team);
    // Plain text has no separate link text, so the full URL stands in for
    // the cell when one's resolvable — mail clients auto-linkify it.
    return tableRow([v.adoUrl || v.adoId, v.severity, v.title, v.status, v.userStory, v.assignee, v.comment]);
  });
  return `${title} (${defects.length})\n${header}\n${divider(60)}\n${rows.join('\n')}\n\n`;
}

const CELL = 'style="border:1px solid #ccc;padding:6px 10px;text-align:left;vertical-align:top;"';

function htmlTableSection(title, defects, usById, connection, team){
  const headerRow = `<tr style="background:#f2f2f2;font-weight:bold;">${TABLE_HEADERS.map(h => `<td ${CELL}>${escapeHtmlText(h)}</td>`).join('')}</tr>`;
  const bodyRows = defects.map(d => {
    const v = defectRowValues(d, usById, connection, team);
    const adoCell = v.adoUrl ? `<a href="${escapeHtmlText(v.adoUrl)}">${escapeHtmlText(v.adoId)}</a>` : escapeHtmlText(v.adoId);
    return `<tr>
      <td ${CELL}>${adoCell}</td>
      <td ${CELL}>${escapeHtmlText(v.severity)}</td>
      <td ${CELL}>${escapeHtmlText(v.title)}</td>
      <td ${CELL}>${escapeHtmlText(v.status)}</td>
      <td ${CELL}>${escapeHtmlText(v.userStory)}</td>
      <td ${CELL}>${escapeHtmlText(v.assignee)}</td>
      <td ${CELL}>${escapeHtmlText(v.comment)}</td>
    </tr>`;
  }).join('');
  return `
  <p style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;margin:16px 0 6px;">${escapeHtmlText(title)} (${defects.length})</p>
  <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">${headerRow}${bodyRows}</table>`;
}

// Assignee + reporter, deduped — a locally-matched assignee's People email
// is included too, so a manually-added defect (no ADO assigneeEmail) still
// reaches its assignee if they're in the roster.
function collectReminderEmails(defects, team){
  const seen = new Set();
  const emails = [];
  defects.forEach(d => {
    const candidates = [d.assigneeEmail, d.createdByEmail];
    if(d.assigneeId){
      const m = team.find(t => t.id === d.assigneeId);
      if(m && m.email) candidates.push(m.email);
    }
    candidates.forEach(e => {
      const email = (e || '').trim();
      if(email && !seen.has(email.toLowerCase())){
        seen.add(email.toLowerCase());
        emails.push(email);
      }
    });
  });
  return emails;
}

export async function sendDefectsEmail(state){
  const selected = state.releases.find(r => r.id === state.selectedReleaseId);
  const usById = new Map(state.userStories.map(us => [us.id, us]));
  const tagFilter = d => !state.selectedDefectTag || (d.tags || []).includes(state.selectedDefectTag);
  const releaseDefects = scopedDefects(state).filter(tagFilter).filter(d => defectReleaseId(d, state.releases, usById) !== null);
  const unlinked = state.defects.filter(d => defectReleaseId(d, state.releases, usById) === null).filter(tagFilter);

  if(!releaseDefects.length && !unlinked.length){
    state.defectsEmailWarn = 'No defects match the current release/tag filter — nothing to send.';
    return {ok:false};
  }

  const connection = resolveAdoConnection(selected, state.settings.adoConnections || []);
  const scopeName = selected ? selected.name : 'All releases';
  const tagSuffix = state.selectedDefectTag ? ` — tag: ${state.selectedDefectTag}` : '';
  const subject = `Defects – ${scopeName}${tagSuffix}`;
  const intro = `Hi,\n\nHere are the current defects for ${scopeName}${tagSuffix}.\n\n`;
  const signoff = state.settings.yourName ? `\n\nBest regards,\n${state.settings.yourName}` : '';

  let plainTable = '';
  if(releaseDefects.length) plainTable += plainTextSection(scopeName.toUpperCase(), releaseDefects, usById, connection, state.team);
  if(unlinked.length) plainTable += plainTextSection('UNLINKED', unlinked, usById, connection, state.team);
  plainTable = plainTable.trimEnd();

  let htmlTable = '';
  if(releaseDefects.length) htmlTable += htmlTableSection(scopeName, releaseDefects, usById, connection, state.team);
  if(unlinked.length) htmlTable += htmlTableSection('Unlinked', unlinked, usById, connection, state.team);
  const htmlTableOnly = `<div style="font-family:Arial,sans-serif;font-size:14px;">${htmlTable}</div>`;

  const recipients = collectReminderEmails([...releaseDefects, ...unlinked], state.team);
  const body = (intro + plainTable).trimEnd() + signoff;
  const result = await deliverEmailDraft({to: recipients, subject, body});

  if(result.mailtoOpened && htmlTable){
    try{
      if(navigator.clipboard && window.ClipboardItem){
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlTableOnly], {type: 'text/html'}),
            'text/plain': new Blob([plainTable], {type: 'text/plain'})
          })
        ]);
      }
    }catch(e){ /* table copy is optional extras */ }
  }

  if(result.via === 'failed'){
    state.defectsEmailWarn = draftDeliveryMessage({label: 'Defects email', via: 'failed'});
    state.defectsEmailMsg = '';
    return {ok:false};
  }

  state.defectsEmailWarn = '';
  const recipientNote = recipients.length
    ? `addressed to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} (assignees + reporters)`
    : '(add recipients in the mail app)';
  state.defectsEmailMsg = draftDeliveryMessage({
    label: 'Defects email',
    via: result.via,
    clipboardOk: result.clipboardOk,
    tooLong: result.tooLong,
    recipientNote
  });
  return {ok:true, via: result.via};
}
