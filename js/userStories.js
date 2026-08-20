// User Story management for the Release Testing view. adoState is the one
// and only status field — no separate locally-tracked status alongside it
// (see adoSync.js). Stories span multiple days: ongoingNote + progressNotes
// capture durable / per-day status; groupIds let several people execute one
// story via Groups.

import { MAX_TITLE_LENGTH, MAX_COMMENT_LENGTH, MAX_STANDUP_FIELD_LENGTH, uid } from './state.js';
import { saveUserStories, saveDefects, saveStandup } from './storage.js';
import { normalizeStandup, STANDUP_META_KEY } from './standupShape.js';
import { normalizeTestCounts, testCountsAreEmpty } from './opsHelpers.js';

async function scrubDiscussion(state, kind, itemId){
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  const before = meta.discussion.length;
  meta.discussion = meta.discussion.filter(d => !(d.kind === kind && d.itemId === itemId));
  if(meta.discussion.length !== before) await saveStandup(state.dateStr, state.standup);
}

export async function addUserStory(state, {title: rawTitle, releaseId, adoId, assigneeId, iterationPath, groupIds} = {}){
  const title = String(rawTitle ?? '').trim().slice(0, MAX_TITLE_LENGTH);
  if(!title) return false;
  const validGroupIds = new Set(state.groups.map(g => g.id));
  state.userStories.push({
    id: uid(), adoId: adoId || null, title,
    releaseId: releaseId || null, adoState: '', defectIds: [],
    assigneeId: assigneeId || null,
    groupIds: Array.isArray(groupIds) ? groupIds.filter(id => validGroupIds.has(id)) : [],
    coAssigneeIds: [],
    ongoingNote: '',
    progressNotes: {},
    testCounts: {},
    assigneeEmail: '', createdByName: '', createdByEmail: '',
    iterationPath: String(iterationPath ?? '').trim(), latestComment: null
  });
  await saveUserStories(state.userStories);
  return true;
}

export async function updateUserStory(state, id, patch){
  const us = state.userStories.find(u => u.id === id);
  if(!us) return false;
  if(patch.title !== undefined){
    const title = String(patch.title ?? '').trim().slice(0, MAX_TITLE_LENGTH);
    if(!title) return false;
    us.title = title;
  }
  if(patch.releaseId !== undefined) us.releaseId = patch.releaseId || null;
  if(patch.assigneeId !== undefined) us.assigneeId = patch.assigneeId || null;
  if(patch.iterationPath !== undefined) us.iterationPath = String(patch.iterationPath ?? '').trim();
  if(patch.groupIds !== undefined){
    const validGroupIds = new Set(state.groups.map(g => g.id));
    us.groupIds = Array.isArray(patch.groupIds) ? patch.groupIds.filter(gid => validGroupIds.has(gid)) : [];
  }
  if(patch.ongoingNote !== undefined){
    us.ongoingNote = String(patch.ongoingNote ?? '').trim().slice(0, MAX_COMMENT_LENGTH);
  }
  await saveUserStories(state.userStories);
  return true;
}

export async function setProgressNote(state, id, dateStr, rawNote){
  const us = state.userStories.find(u => u.id === id);
  if(!us) return;
  if(!us.progressNotes || typeof us.progressNotes !== 'object') us.progressNotes = {};
  const note = String(rawNote ?? '').trim().slice(0, MAX_STANDUP_FIELD_LENGTH);
  if(note) us.progressNotes[dateStr] = note;
  else delete us.progressNotes[dateStr];
  await saveUserStories(state.userStories);
}

export async function setOngoingNote(state, id, rawNote){
  const us = state.userStories.find(u => u.id === id);
  if(!us) return;
  us.ongoingNote = String(rawNote ?? '').trim().slice(0, MAX_COMMENT_LENGTH);
  await saveUserStories(state.userStories);
}

export async function setTestCounts(state, id, dateStr, counts){
  const us = state.userStories.find(u => u.id === id);
  if(!us || !dateStr) return;
  if(!us.testCounts || typeof us.testCounts !== 'object') us.testCounts = {};
  const next = normalizeTestCounts(counts);
  if(testCountsAreEmpty(next)) delete us.testCounts[dateStr];
  else us.testCounts[dateStr] = next;
  await saveUserStories(state.userStories);
}

export async function toggleStoryGroup(state, id, groupId){
  const us = state.userStories.find(u => u.id === id);
  if(!us) return;
  if(!Array.isArray(us.groupIds)) us.groupIds = [];
  us.groupIds = us.groupIds.includes(groupId)
    ? us.groupIds.filter(g => g !== groupId)
    : [...us.groupIds, groupId];
  await saveUserStories(state.userStories);
}

export async function removeUserStory(state, id){
  state.userStories = state.userStories.filter(u => u.id !== id);
  let touched = false;
  state.defects.forEach(d => {
    if(d.userStoryId === id){ d.userStoryId = null; touched = true; }
  });
  await saveUserStories(state.userStories);
  if(touched) await saveDefects(state.defects);
  await scrubDiscussion(state, 'userStory', id);
}

export async function setStatus(state, id, status){
  const us = state.userStories.find(u => u.id === id);
  if(!us) return;
  us.adoState = status;
  await saveUserStories(state.userStories);
}
