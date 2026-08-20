// Defect management for the Release Testing view. Linking a defect to a
// User Story keeps both sides in sync (the defect's userStoryId and the
// story's defectIds array) so the mapping can be read from either end.
//
// adoState is the one and only status field. Defects are day activity for
// testers — dayActivity[dateStr] holds a short note + tester ids.

import { MAX_TITLE_LENGTH, MAX_STANDUP_FIELD_LENGTH, uid, findMemberByIdentity } from './state.js';
import { saveDefects, saveUserStories, saveStandup } from './storage.js';
import { normalizeStandup, STANDUP_META_KEY } from './standupShape.js';
import { isAbsent, peerIdsInGroups } from './standup.js';

async function scrubDiscussion(state, kind, itemId){
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  const before = meta.discussion.length;
  meta.discussion = meta.discussion.filter(d => !(d.kind === kind && d.itemId === itemId));
  if(meta.discussion.length !== before) await saveStandup(state.dateStr, state.standup);
}

// Created by is the default tester for day activity; assignee is the fallback
// when Created by isn't on the roster yet.
export function defaultTesterId(state, d){
  const created = findMemberByIdentity(state.team, d.createdByName, d.createdByEmail);
  if(created) return created.id;
  return d.assigneeId || null;
}

export function effectiveTesterIds(state, d, dateStr){
  const day = d.dayActivity && d.dayActivity[dateStr];
  if(day && Array.isArray(day.testerIds) && day.testerIds.length) return [...day.testerIds];
  const def = defaultTesterId(state, d);
  return def ? [def] : [];
}

export function alternateTesterOptions(state, d){
  const defId = defaultTesterId(state, d);
  if(!defId || !isAbsent(state, defId)) return [];
  const peers = peerIdsInGroups(state, defId);
  const pool = peers.length ? peers : state.team.map(m => m.id).filter(id => id !== defId);
  return pool.map(id => state.team.find(m => m.id === id)).filter(Boolean);
}

export async function addDefect(state, {title: rawTitle, userStoryId, severity, adoId, assigneeId, iterationPath} = {}){
  const title = String(rawTitle ?? '').trim().slice(0, MAX_TITLE_LENGTH);
  if(!title) return false;
  const d = {
    id: uid(), adoId: adoId || null, title,
    userStoryId: userStoryId || null, severity: severity || 'medium',
    adoState: '',
    assigneeId: assigneeId || null,
    dayActivity: {},
    tags: [], latestComment: null, createdDate: new Date().toISOString(),
    assigneeEmail: '', createdByName: '', createdByEmail: '',
    iterationPath: String(iterationPath ?? '').trim()
  };
  state.defects.push(d);
  if(d.userStoryId){
    const us = state.userStories.find(u => u.id === d.userStoryId);
    if(us){
      if(!Array.isArray(us.defectIds)) us.defectIds = [];
      if(!us.defectIds.includes(d.id)) us.defectIds.push(d.id);
    }
  }
  await saveDefects(state.defects);
  if(d.userStoryId) await saveUserStories(state.userStories);
  return true;
}

export async function updateDefect(state, id, patch){
  const d = state.defects.find(x => x.id === id);
  if(!d) return false;
  if(patch.title !== undefined){
    const title = String(patch.title ?? '').trim().slice(0, MAX_TITLE_LENGTH);
    if(!title) return false;
    d.title = title;
  }
  if(patch.severity !== undefined) d.severity = patch.severity;
  if(patch.assigneeId !== undefined) d.assigneeId = patch.assigneeId || null;
  if(patch.iterationPath !== undefined) d.iterationPath = String(patch.iterationPath ?? '').trim();
  await saveDefects(state.defects);
  return true;
}

export async function setDayActivity(state, id, dateStr, {note, testerIds} = {}){
  const d = state.defects.find(x => x.id === id);
  if(!d) return;
  if(!d.dayActivity || typeof d.dayActivity !== 'object') d.dayActivity = {};
  const trimmed = String(note ?? '').trim().slice(0, MAX_STANDUP_FIELD_LENGTH);
  const existing = d.dayActivity[dateStr];
  let testers;
  if(Array.isArray(testerIds)) testers = testerIds.filter(Boolean);
  else if(existing && Array.isArray(existing.testerIds) && existing.testerIds.length) testers = existing.testerIds;
  else testers = effectiveTesterIds(state, d, dateStr);
  if(!trimmed && !testers.length){
    delete d.dayActivity[dateStr];
  }else{
    d.dayActivity[dateStr] = {note: trimmed, testerIds: testers};
  }
  await saveDefects(state.defects);
}

export async function toggleDayTester(state, id, dateStr, memberId){
  const d = state.defects.find(x => x.id === id);
  if(!d) return;
  if(!d.dayActivity || typeof d.dayActivity !== 'object') d.dayActivity = {};
  const cur = d.dayActivity[dateStr] || {note: '', testerIds: effectiveTesterIds(state, d, dateStr)};
  const testerIds = Array.isArray(cur.testerIds) && cur.testerIds.length
    ? [...cur.testerIds]
    : effectiveTesterIds(state, d, dateStr);
  const next = testerIds.includes(memberId)
    ? testerIds.filter(t => t !== memberId)
    : [...testerIds, memberId];
  if(!cur.note && !next.length) delete d.dayActivity[dateStr];
  else d.dayActivity[dateStr] = {note: cur.note || '', testerIds: next};
  await saveDefects(state.defects);
}

export async function setAlternateTester(state, id, dateStr, memberId){
  const d = state.defects.find(x => x.id === id);
  if(!d || !memberId) return;
  if(!d.dayActivity || typeof d.dayActivity !== 'object') d.dayActivity = {};
  const note = (d.dayActivity[dateStr] && d.dayActivity[dateStr].note) || '';
  d.dayActivity[dateStr] = {note, testerIds: [memberId]};
  await saveDefects(state.defects);
}

export async function removeDefect(state, id){
  const d = state.defects.find(x => x.id === id);
  state.defects = state.defects.filter(x => x.id !== id);
  await saveDefects(state.defects);
  if(d && d.userStoryId){
    const us = state.userStories.find(u => u.id === d.userStoryId);
    if(us && Array.isArray(us.defectIds)){
      us.defectIds = us.defectIds.filter(defId => defId !== id);
      await saveUserStories(state.userStories);
    }
  }
  await scrubDiscussion(state, 'defect', id);
}

export async function linkToUserStory(state, defectId, userStoryId){
  const d = state.defects.find(x => x.id === defectId);
  if(!d) return;
  if(d.userStoryId && d.userStoryId !== userStoryId){
    const oldUs = state.userStories.find(u => u.id === d.userStoryId);
    if(oldUs && Array.isArray(oldUs.defectIds)) oldUs.defectIds = oldUs.defectIds.filter(id => id !== defectId);
  }
  d.userStoryId = userStoryId || null;
  if(d.userStoryId){
    const us = state.userStories.find(u => u.id === d.userStoryId);
    if(us){
      if(!Array.isArray(us.defectIds)) us.defectIds = [];
      if(!us.defectIds.includes(defectId)) us.defectIds.push(defectId);
    }
  }
  await saveDefects(state.defects);
  await saveUserStories(state.userStories);
}

export async function setStatus(state, id, status){
  const d = state.defects.find(x => x.id === id);
  if(!d) return;
  d.adoState = status;
  await saveDefects(state.defects);
}
