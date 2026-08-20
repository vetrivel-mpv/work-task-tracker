// Team roster management. Assignment of a roster member to a task lives in
// tasks.js (toggleAssignee) since that mutates the task list, not the roster.

import { MAX_MEMBER_NAME_LENGTH, MAX_MEMBER_ROLE_LENGTH, MAX_MEMBER_EMAIL_LENGTH, isValidEmail, uid } from './state.js';
import { saveTeam, saveTasks, saveGroups, saveStandup } from './storage.js';
import { normalizeStandup, STANDUP_META_KEY } from './standupShape.js';

// Email is optional — a teammate can be assigned tasks without one — but if
// given it needs to be a real address, since it's used as a standup-email
// recipient later.
export async function addMember(state, rawName, rawRole, rawEmail){
  const name = String(rawName ?? '').trim().slice(0, MAX_MEMBER_NAME_LENGTH);
  if(!name){
    state.teamWarn = 'Enter a name first.';
    return false;
  }
  const email = String(rawEmail ?? '').trim().slice(0, MAX_MEMBER_EMAIL_LENGTH);
  if(email && !isValidEmail(email)){
    state.teamWarn = "That doesn't look like a valid email address.";
    return false;
  }
  const role = String(rawRole ?? '').trim().slice(0, MAX_MEMBER_ROLE_LENGTH);
  state.team.push({ id: uid(), name, role, email, ooo: [] });
  state.teamWarn = '';
  await saveTeam(state.team);
  return true;
}

export async function updateMember(state, id, rawName, rawRole, rawEmail){
  const m = state.team.find(m => m.id === id);
  if(!m) return false;
  const name = String(rawName ?? '').trim().slice(0, MAX_MEMBER_NAME_LENGTH);
  if(!name){
    state.teamWarn = 'Enter a name first.';
    return false;
  }
  const email = String(rawEmail ?? '').trim().slice(0, MAX_MEMBER_EMAIL_LENGTH);
  if(email && !isValidEmail(email)){
    state.teamWarn = "That doesn't look like a valid email address.";
    return false;
  }
  m.name = name;
  m.role = String(rawRole ?? '').trim().slice(0, MAX_MEMBER_ROLE_LENGTH);
  m.email = email;
  state.teamWarn = '';
  await saveTeam(state.team);
  return true;
}

// Upserts a Person from an ADO identity (name + email) — called during ADO
// sync so the People roster reflects who's actually assigned in ADO,
// instead of merely matching ADO names against whatever's already in the
// roster. Doesn't save on its own; the caller batches one save after
// processing every synced item. Returns the matched/created member, or
// null if given no identity at all (an unassigned work item).
export function upsertMemberFromAdo(state, name, email){
  if(!name && !email) return null;
  const emailLower = (email || '').trim().toLowerCase();
  let m = null;
  if(emailLower) m = state.team.find(t => (t.email || '').toLowerCase() === emailLower);
  if(!m && name) m = state.team.find(t => t.name.toLowerCase() === name.toLowerCase());
  if(m){
    if(name && m.name !== name) m.name = name;
    if(email && m.email !== email) m.email = email;
    return m;
  }
  const created = {id: uid(), name: name || email, role: '', email: email || '', ooo: []};
  state.team.push(created);
  return created;
}

export async function addOooRange(state, memberId, from, to){
  const m = state.team.find(t => t.id === memberId);
  if(!m) return false;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')){
    state.teamWarn = 'Pick a from and to date for OOO.';
    return false;
  }
  if(!Array.isArray(m.ooo)) m.ooo = [];
  const a = from <= to ? from : to;
  const b = from <= to ? to : from;
  if(m.ooo.some(r => r.from === a && r.to === b)){
    state.teamWarn = 'That OOO range is already listed.';
    return false;
  }
  m.ooo = [...m.ooo, {from: a, to: b}];
  state.teamWarn = '';
  await saveTeam(state.team);
  return true;
}

export async function removeOooRange(state, memberId, index){
  const m = state.team.find(t => t.id === memberId);
  if(!m || !Array.isArray(m.ooo)) return false;
  m.ooo = m.ooo.filter((_, i) => i !== Number(index));
  await saveTeam(state.team);
  return true;
}

function stripAssigneeFromTaskList(tasks, id){
  let touched = false;
  (tasks || []).forEach(t => {
    if(Array.isArray(t.assignees) && t.assignees.includes(id)){
      t.assignees = t.assignees.filter(a => a !== id);
      touched = true;
    }
  });
  return touched;
}

export async function removeMember(state, id){
  state.team = state.team.filter(m => m.id !== id);
  // Unassign from every saved day (all tasks:* keys), not only today.
  const todayTouched = stripAssigneeFromTaskList(state.tasks, id);
  try{
    Object.keys(localStorage).forEach(k => {
      if(!k.startsWith('tasks:')) return;
      const dateStr = k.slice('tasks:'.length);
      if(dateStr === state.dateStr) return;
      try{
        const parsed = JSON.parse(localStorage.getItem(k));
        if(!Array.isArray(parsed)) return;
        if(stripAssigneeFromTaskList(parsed, id)){
          localStorage.setItem(k, JSON.stringify(parsed));
        }
      }catch(e){ /* skip a bad day rather than abort the remove */ }
    });
  }catch(e){ /* private mode */ }
  let groupsTouched = false;
  state.groups.forEach(g => {
    if(Array.isArray(g.memberIds) && g.memberIds.includes(id)){
      g.memberIds = g.memberIds.filter(m => m !== id);
      groupsTouched = true;
    }
  });
  await saveTeam(state.team);
  if(todayTouched) await saveTasks(state.dateStr, state.tasks);
  if(groupsTouched) await saveGroups(state.groups);
  // Drop absence / discussion discussant refs for today so a removed
  // teammate doesn't linger in the standup picker / absences.
  state.standup = normalizeStandup(state.standup);
  const meta = state.standup[STANDUP_META_KEY];
  meta.absences = meta.absences.filter(a => a !== id);
  meta.discussion.forEach(d => {
    d.discussantIds = (d.discussantIds || []).filter(a => a !== id);
  });
  delete state.standup[id];
  await saveStandup(state.dateStr, state.standup);
}
