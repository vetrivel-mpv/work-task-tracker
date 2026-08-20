// Per-day standup notes, absences, and discussion queue.
// Yesterday / Today / Blockers / Questions are free-text notes. Board tasks
// still show as a separate "From board" readout in the rail. Absences +
// discussion live under reserved `__meta` (see standupShape.js).

import { MAX_STANDUP_FIELD_LENGTH, MAX_COMMENT_LENGTH, uid } from './state.js';
import { saveStandup } from './storage.js';
import { isOooOnDate } from './opsHelpers.js';
import {
  STANDUP_META_KEY, STANDUP_TEXT_FIELDS, blankMemberEntry, normalizeStandup
} from './standupShape.js';

export {
  STANDUP_META_KEY, STANDUP_TEXT_FIELDS, blankMemberEntry, normalizeStandup,
  memberStandupEntry, memberHasStandupNotes
} from './standupShape.js';

export function standupMeta(standup){
  return normalizeStandup(standup)[STANDUP_META_KEY];
}

export async function setStandupHighlights(state, raw){
  state.standup = normalizeStandup(state.standup);
  state.standup[STANDUP_META_KEY].highlights = String(raw ?? '').slice(0, 2000);
  await saveStandup(state.dateStr, state.standup);
}

export async function setStandupField(state, memberId, field, rawValue){
  const allowed = field === 'linkedTaskId' || STANDUP_TEXT_FIELDS.includes(field);
  if(!allowed) return;
  state.standup = normalizeStandup(state.standup);
  if(!state.standup[memberId]) state.standup[memberId] = blankMemberEntry();
  const value = field === 'linkedTaskId'
    ? String(rawValue ?? '')
    : String(rawValue ?? '').trim().slice(0, MAX_STANDUP_FIELD_LENGTH);
  state.standup[memberId][field] = value;
  await saveStandup(state.dateStr, state.standup);
}

export function isAbsent(state, memberId){
  if(standupMeta(state.standup).absences.includes(memberId)) return true;
  const m = (state.team || []).find(t => t.id === memberId);
  return isOooOnDate(m, state.dateStr);
}

export function effectiveAbsenceIds(state){
  const ids = new Set(standupMeta(state.standup).absences);
  (state.team || []).forEach(m => {
    if(isOooOnDate(m, state.dateStr)) ids.add(m.id);
  });
  return [...ids];
}

export { isOooOnDate };

export async function toggleAbsence(state, memberId){
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  meta.absences = meta.absences.includes(memberId)
    ? meta.absences.filter(id => id !== memberId)
    : [...meta.absences, memberId];
  await saveStandup(state.dateStr, state.standup);
}

export function discussionQueue(state){
  return standupMeta(state.standup).discussion;
}

export function isQueuedForStandup(state, kind, itemId){
  return discussionQueue(state).some(d => d.kind === kind && d.itemId === itemId);
}

export async function queueForStandup(state, kind, itemId, discussantIds = []){
  if(kind !== 'userStory' && kind !== 'defect') return false;
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  const existing = meta.discussion.find(d => d.kind === kind && d.itemId === itemId);
  const ids = Array.isArray(discussantIds) ? discussantIds.filter(Boolean) : [];
  if(existing){
    existing.discussantIds = ids.length ? ids : existing.discussantIds;
    await saveStandup(state.dateStr, state.standup);
    return true;
  }
  meta.discussion.push({
    id: uid(),
    kind,
    itemId,
    discussantIds: ids,
    note: '',
    queuedAt: new Date().toISOString()
  });
  await saveStandup(state.dateStr, state.standup);
  return true;
}

export async function dequeueFromStandup(state, kind, itemId){
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  meta.discussion = meta.discussion.filter(d => !(d.kind === kind && d.itemId === itemId));
  await saveStandup(state.dateStr, state.standup);
}

export async function toggleStandupQueue(state, kind, itemId, discussantIds = []){
  if(isQueuedForStandup(state, kind, itemId)){
    await dequeueFromStandup(state, kind, itemId);
    return false;
  }
  await queueForStandup(state, kind, itemId, discussantIds);
  return true;
}

export async function setDiscussionDiscussants(state, discussionId, discussantIds){
  state.standup = normalizeStandup(state.standup);
  const item = state.standup[STANDUP_META_KEY].discussion.find(d => d.id === discussionId);
  if(!item) return;
  item.discussantIds = Array.isArray(discussantIds) ? discussantIds.filter(Boolean) : [];
  await saveStandup(state.dateStr, state.standup);
}

export async function toggleDiscussionDiscussant(state, discussionId, memberId){
  state.standup = normalizeStandup(state.standup);
  const item = state.standup[STANDUP_META_KEY].discussion.find(d => d.id === discussionId);
  if(!item || !memberId) return;
  const ids = Array.isArray(item.discussantIds) ? [...item.discussantIds] : [];
  item.discussantIds = ids.includes(memberId)
    ? ids.filter(id => id !== memberId)
    : [...ids, memberId];
  await saveStandup(state.dateStr, state.standup);
}

export async function setDiscussionNote(state, discussionId, rawNote){
  state.standup = normalizeStandup(state.standup);
  const item = state.standup[STANDUP_META_KEY].discussion.find(d => d.id === discussionId);
  if(!item) return;
  item.note = String(rawNote ?? '').trim().slice(0, MAX_COMMENT_LENGTH);
  await saveStandup(state.dateStr, state.standup);
}

export async function removeDiscussion(state, discussionId){
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  meta.discussion = meta.discussion.filter(d => d.id !== discussionId);
  await saveStandup(state.dateStr, state.standup);
}

export function groupsForAbsentMember(state, memberId){
  return state.groups.filter(g => Array.isArray(g.memberIds) && g.memberIds.includes(memberId));
}

export function peerIdsInGroups(state, memberId){
  const peers = new Set();
  groupsForAbsentMember(state, memberId).forEach(g => {
    (g.memberIds || []).forEach(id => { if(id !== memberId) peers.add(id); });
  });
  return [...peers];
}
