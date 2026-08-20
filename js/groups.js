// Group roster management. A group is a named, reusable set of team members
// (e.g. "QA Team") so a User Story or task can be owned by several people
// at once. purpose captures why the group exists (delegation / ownership).
// Assigning a group to a task lives in tasks.js (toggleAssignedGroup);
// assigning a group to a User Story lives in userStories.js.

import { MAX_GROUP_NAME_LENGTH, MAX_COMMENT_LENGTH, uid } from './state.js';
import { saveGroups, saveTasks, saveUserStories, saveDefects } from './storage.js';

export async function addGroup(state, rawName, memberIds, rawPurpose = ''){
  const name = String(rawName ?? '').trim().slice(0, MAX_GROUP_NAME_LENGTH);
  if(!name) return false;
  const validIds = new Set(state.team.map(m => m.id));
  const members = Array.isArray(memberIds) ? memberIds.filter(id => validIds.has(id)) : [];
  const purpose = String(rawPurpose ?? '').trim().slice(0, MAX_COMMENT_LENGTH);
  state.groups.push({ id: uid(), name, memberIds: members, purpose });
  await saveGroups(state.groups);
  return true;
}

export async function updateGroupPurpose(state, groupId, rawPurpose){
  const g = state.groups.find(x => x.id === groupId);
  if(!g) return;
  g.purpose = String(rawPurpose ?? '').trim().slice(0, MAX_COMMENT_LENGTH);
  await saveGroups(state.groups);
}

export async function removeGroup(state, id){
  state.groups = state.groups.filter(g => g.id !== id);
  let tasksTouched = false;
  state.tasks.forEach(t => {
    if(Array.isArray(t.assignedGroups) && t.assignedGroups.includes(id)){
      t.assignedGroups = t.assignedGroups.filter(g => g !== id);
      tasksTouched = true;
    }
  });
  let storiesTouched = false;
  state.userStories.forEach(us => {
    if(Array.isArray(us.groupIds) && us.groupIds.includes(id)){
      us.groupIds = us.groupIds.filter(g => g !== id);
      storiesTouched = true;
    }
  });
  await saveGroups(state.groups);
  if(tasksTouched) await saveTasks(state.dateStr, state.tasks);
  if(storiesTouched) await saveUserStories(state.userStories);
}

export async function toggleGroupMember(state, groupId, memberId){
  const g = state.groups.find(g => g.id === groupId);
  if(!g) return;
  if(!Array.isArray(g.memberIds)) g.memberIds = [];
  g.memberIds = g.memberIds.includes(memberId)
    ? g.memberIds.filter(m => m !== memberId)
    : [...g.memberIds, memberId];
  await saveGroups(state.groups);
}

// When someone is absent, hand their personally-assigned board tasks for
// today to a peer (adds the peer as an assignee; does not remove the absent
// person so ownership history stays visible).
export async function delegateTasksToPeer(state, fromMemberId, toMemberId){
  if(!fromMemberId || !toMemberId || fromMemberId === toMemberId) return 0;
  let count = 0;
  state.tasks.forEach(t => {
    if(!Array.isArray(t.assignees) || !t.assignees.includes(fromMemberId)) return;
    if(t.status === 'complete') return;
    if(!t.assignees.includes(toMemberId)){
      t.assignees = [...t.assignees, toMemberId];
      count++;
    }
  });
  if(count) await saveTasks(state.dateStr, state.tasks);
  return count;
}

// Adds a group peer as co-owner. Never removes the absent person.
export async function delegateWorkToPeer(state, fromMemberId, toMemberId){
  if(!fromMemberId || !toMemberId || fromMemberId === toMemberId) return {tasks: 0, stories: 0, defects: 0};
  const tasks = await delegateTasksToPeer(state, fromMemberId, toMemberId);
  let stories = 0;
  (state.userStories || []).forEach(us => {
    const owns = us.assigneeId === fromMemberId
      || (Array.isArray(us.coAssigneeIds) && us.coAssigneeIds.includes(fromMemberId))
      || (us.groupIds || []).some(gid => {
        const g = state.groups.find(x => x.id === gid);
        return g && Array.isArray(g.memberIds) && g.memberIds.includes(fromMemberId);
      });
    if(!owns) return;
    if(!Array.isArray(us.coAssigneeIds)) us.coAssigneeIds = [];
    if(us.assigneeId === toMemberId || us.coAssigneeIds.includes(toMemberId)) return;
    us.coAssigneeIds = [...us.coAssigneeIds, toMemberId];
    stories++;
  });
  let defects = 0;
  const today = state.dateStr;
  (state.defects || []).forEach(d => {
    if(d.assigneeId !== fromMemberId) return;
    if(!d.dayActivity || typeof d.dayActivity !== 'object') d.dayActivity = {};
    const day = d.dayActivity[today] || {note: '', testerIds: []};
    const testers = Array.isArray(day.testerIds) ? [...day.testerIds] : [];
    if(!testers.includes(fromMemberId)) testers.push(fromMemberId);
    if(!testers.includes(toMemberId)){
      testers.push(toMemberId);
      defects++;
    }
    d.dayActivity[today] = {...day, testerIds: testers};
  });
  if(stories) await saveUserStories(state.userStories);
  if(defects) await saveDefects(state.defects);
  return {tasks, stories, defects};
}
