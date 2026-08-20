// Standup blob shape helpers — no storage I/O, so loaders and mutators
// can share normalization without a circular import.

import { MAX_COMMENT_LENGTH, uid } from './state.js';

export const STANDUP_META_KEY = '__meta';

export const STANDUP_TEXT_FIELDS = ['yesterday', 'today', 'blockers', 'questions'];

export function blankMemberEntry(){
  return {yesterday:'', today:'', blockers:'', questions:'', linkedTaskId:''};
}

export function blankStandupMeta(){
  return {absences: [], discussion: [], highlights: ''};
}

export function memberHasStandupNotes(entry){
  if(!entry) return false;
  return STANDUP_TEXT_FIELDS.some(f => String(entry[f] || '').trim());
}

// Older saves were a flat {[memberId]: entry} map with no __meta.
// Pre-notes saves only had blockers/questions/linkedTaskId — missing
// yesterday/today keys normalize to empty strings.
export function normalizeStandup(raw){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const metaSrc = src[STANDUP_META_KEY] && typeof src[STANDUP_META_KEY] === 'object'
    ? src[STANDUP_META_KEY] : {};
  const absences = Array.isArray(metaSrc.absences)
    ? metaSrc.absences.filter(id => typeof id === 'string')
    : [];
  const discussion = Array.isArray(metaSrc.discussion)
    ? metaSrc.discussion.filter(d => d && d.itemId && (d.kind === 'userStory' || d.kind === 'defect')).map(d => ({
        id: d.id || uid(),
        kind: d.kind,
        itemId: d.itemId,
        discussantIds: Array.isArray(d.discussantIds) ? d.discussantIds.filter(Boolean) : [],
        note: String(d.note || '').slice(0, MAX_COMMENT_LENGTH),
        queuedAt: d.queuedAt || null
      }))
    : [];
  const members = {};
  Object.keys(src).forEach(key => {
    if(key === STANDUP_META_KEY) return;
    const e = src[key] || {};
    members[key] = {
      yesterday: String(e.yesterday || ''),
      today: String(e.today || ''),
      blockers: String(e.blockers || ''),
      questions: String(e.questions || ''),
      linkedTaskId: String(e.linkedTaskId || '')
    };
  });
  return {[STANDUP_META_KEY]: {absences, discussion, highlights: String(metaSrc.highlights || '').slice(0, 2000)}, ...members};
}

export function memberStandupEntry(standup, memberId){
  const n = normalizeStandup(standup);
  return n[memberId] || blankMemberEntry();
}
