// Azure DevOps REST API client — runs a WIQL query, fetches full work item
// details, and upserts them into local User Stories / Defects / Tasks by
// ADO work item id (never duplicates on re-sync). Everything here runs in
// the browser: each connection's PAT lives in state.settings.adoConnections
// and is sent as a Basic-auth header, ADO's own convention (empty username,
// PAT as password). This is a deliberate trade-off — see README/plan —
// since this app has no server to hold the token instead.
//
// Multiple ADO connections (e.g. two orgs/projects) can be configured at
// once — each Release picks which one it syncs from via connectionId,
// resolved through resolveAdoConnection (state.js). With only one
// connection configured, every release uses it implicitly.
//
// Work item type names are configurable per connection because they vary
// by ADO process template: Agile uses "User Story"/"Bug", Scrum uses
// "Product Backlog Item"/"Bug", CMMI uses "Requirement"/"Bug".
//
// adoState is the one and only status field on synced User Stories/Defects
// — set directly from ADO's System.State, verbatim, with no mapping to a
// separate local vocabulary. A Defect's release membership is resolved
// primarily from its own iterationPath (see defects.js's defectReleaseId),
// not just its linked User Story, since a defect can exist without one.
// Assignees are upserted into the People roster from ADO's identity
// (name+email) rather than merely matched against who's already there, so
// the roster stays current with ADO instead of silently dropping unmatched
// names.

import { uid, resolveAdoConnection } from './state.js';
import { saveUserStories, saveDefects, saveTasks, saveTeam, saveReleases } from './storage.js';
import { nextOrder } from './tasks.js';
import { upsertMemberFromAdo } from './team.js';

function stampLastSync(release, {ok, message, types}){
  const at = new Date().toISOString();
  const typesOut = types || {userStory: false, defect: false, task: false};
  release.lastSyncAt = at;
  release.lastSync = {at, ok: !!ok, message: String(message || ''), types: {
    userStory: !!typesOut.userStory,
    defect: !!typesOut.defect,
    task: !!typesOut.task
  }};
}

function applyDefectResolutionDates(d, fields, adoState){
  const resolved = fields['Microsoft.VSTS.Common.ResolvedDate'] || null;
  const closed = fields['Microsoft.VSTS.Common.ClosedDate'] || null;
  if(resolved) d.resolvedDate = resolved;
  if(closed) d.closedDate = closed;
  if(!d.resolvedDate && closed) d.resolvedDate = closed;
  // If still open, keep any previously captured resolvedDate (item may have
  // been reopened — we do not invent reopen history).
}

async function adoFetch(ado, path, options = {}){
  const url = `https://dev.azure.com/${encodeURIComponent(ado.org)}/${encodeURIComponent(ado.project)}/_apis${path}`;
  let res;
  try{
    res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader(ado.pat),
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  }catch(e){
    throw new Error("Couldn't reach Azure DevOps — check your network connection, or a proxy/CORS restriction may be blocking the request.");
  }
  if(res.status === 401 || res.status === 203){
    throw new Error('Azure DevOps rejected the request — check your Personal Access Token (it needs Work Items: Read scope).');
  }
  if(res.status === 404){
    throw new Error("Azure DevOps org/project not found — check the Organization and Project settings.");
  }
  if(!res.ok){
    let detail = '';
    try{ const body = await res.json(); if(body && body.message) detail = `: ${body.message}`; }catch(e){}
    throw new Error(`Azure DevOps returned an error (${res.status})${detail}`);
  }
  return res.json();
}

function escapeWiql(s){ return String(s ?? '').replace(/'/g, "''"); }

// iterationPath is passed separately (not read from `ado`) since it lives
// per-release, not in the shared ADO settings — two releases can point at
// two different sprints.
//
// Defects get a state exclusion the other two types don't: a closed defect
// isn't worth reading, so it's filtered out of the query itself (never
// fetched at all) rather than pulled in and hidden client-side.
function buildQuery(ado, iterationPath, typeFilter){
  const types = ado.workItemTypes || {};
  const usType = types.userStory;
  const defectType = types.defect;
  const taskType = types.task;
  const include = typeFilter || {userStory: true, defect: true, task: true};
  const typeConditions = [];
  if(include.userStory !== false && usType) typeConditions.push(`[System.WorkItemType] = '${escapeWiql(usType)}'`);
  if(include.task !== false && taskType) typeConditions.push(`[System.WorkItemType] = '${escapeWiql(taskType)}'`);
  if(include.defect !== false && defectType) typeConditions.push(`([System.WorkItemType] = '${escapeWiql(defectType)}' AND [System.State] <> 'Closed')`);
  if(!typeConditions.length){
    throw new Error('Select at least one work item type to sync, and make sure type names are set on this connection.');
  }

  let query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapeWiql(ado.project)}' AND (${typeConditions.join(' OR ')})`;
  if(iterationPath) query += ` AND [System.IterationPath] UNDER '${escapeWiql(iterationPath)}'`;
  query += ' ORDER BY [System.Id]';
  return query;
}

async function runWiql(ado, query){
  const data = await adoFetch(ado, '/wit/wiql?api-version=7.1', {method:'POST', body: JSON.stringify({query})});
  return (data.workItems || []).map(w => w.id);
}

// $expand=all, not a `fields` list — ADO rejects combining `fields` with
// `$expand` outright (ConflictingParametersException). `$expand`'s own enum
// includes a bare "fields" value meaning "every field", so `all` (fields +
// relations + links together) is the one parameter that both guarantees
// System.IterationPath comes back and keeps the parent-Defect relation
// (needed by findParentAdoId) in the same request.
async function fetchWorkItems(ado, ids){
  if(!ids.length) return [];
  const results = [];
  for(let i = 0; i < ids.length; i += 200){ // ADO caps batch fetches at 200 ids
    const chunk = ids.slice(i, i + 200);
    const data = await adoFetch(ado, `/wit/workitems?ids=${chunk.join(',')}&$expand=all&api-version=7.1`);
    results.push(...(data.value || []));
  }
  return results;
}

// A child's parent shows up as a Hierarchy-Reverse relation — used for a
// Defect's parent User Story, and for a Task's parent (User Story or Bug).
function findParentAdoId(item){
  if(!Array.isArray(item.relations)) return null;
  const parentRel = item.relations.find(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
  if(!parentRel) return null;
  const m = parentRel.url.match(/\/workItems\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

// Fallback for orgs where the ADO hierarchy relation isn't reliably set:
// a tag formatted like "21293 - SMS Opt-in" leads with the parent User
// Story's own ADO id. Only consulted when the relation-based lookup above
// finds nothing — a real parent link always wins when one exists.
function findParentUsAdoIdFromTags(tags, userStories){
  for(const tag of tags){
    const m = String(tag).match(/^(\d+)\s*-\s*/);
    if(!m) continue;
    const taggedAdoId = Number(m[1]);
    if(userStories.some(u => u.adoId === taggedAdoId)) return taggedAdoId;
  }
  return null;
}

function mapSeverity(rawSeverity){
  const s = String(rawSeverity || '').toLowerCase();
  return ['critical','high','medium','low'].find(x => s.includes(x)) || 'medium';
}

// ADO's identity fields (System.AssignedTo, System.CreatedBy, ...) come back
// either as an object ({displayName, uniqueName, ...}, the modern shape) or
// a plain "Name <email>" string (older API behavior) — handle both. Used for
// both AssignedTo and CreatedBy so a reminder email can reach whoever's
// responsible for a defect and whoever raised it.
function extractIdentity(fields, fieldKey){
  const raw = fields[fieldKey];
  if(!raw) return {name: '', email: ''};
  if(typeof raw === 'string'){
    const m = raw.match(/^(.*?)\s*<(.+)>$/);
    return m ? {name: m[1].trim(), email: m[2].trim().toLowerCase()} : {name: raw.trim(), email: ''};
  }
  return {name: raw.displayName || '', email: (raw.uniqueName || raw.mail || '').toLowerCase()};
}


// ADO stores tags as one semicolon-separated string ("Security; Regression").
function parseTags(rawTags){
  return String(rawTags || '').split(';').map(t => t.trim()).filter(Boolean);
}

// Comment text comes back as HTML (ADO's discussion field is rich text) —
// strip tags for a plain-text preview rather than dumping raw markup.
function stripHtml(html){
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Work item comments are a separate endpoint, one call per item — there's
// no batch form the way workitems has. A failure here (e.g. comments
// disabled on that item) shouldn't abort the rest of the sync, so this
// swallows its own errors and just returns null.
async function fetchLatestComment(ado, workItemId){
  try{
    const data = await adoFetch(ado, `/wit/workItems/${workItemId}/comments?api-version=7.1-preview.4`);
    const comments = data.comments || [];
    if(!comments.length) return null;
    const latest = comments.reduce((a, b) => new Date(a.createdDate) > new Date(b.createdDate) ? a : b);
    return {
      text: stripHtml(latest.text),
      author: (latest.createdBy && latest.createdBy.displayName) || '',
      date: latest.createdDate || ''
    };
  }catch(e){
    return null;
  }
}

export async function syncFromADO(state){
  const selectedRelease = state.releases.find(r => r.id === state.selectedReleaseId);
  if(!selectedRelease){
    state.adoSyncMsg = 'Select (or add) a release first — that\'s what new items sync into, and where its iteration path comes from.';
    return;
  }
  const connections = state.settings.adoConnections || [];
  const ado = resolveAdoConnection(selectedRelease, connections);
  if(!ado){
    state.adoSyncMsg = connections.length === 0
      ? 'Add an ADO connection first (Organization, Project, Personal Access Token).'
      : `"${selectedRelease.name}" doesn't have an ADO connection assigned — pick one (✎ next to the release) since more than one is configured.`;
    stampLastSync(selectedRelease, {ok: false, message: state.adoSyncMsg, types: state.adoSyncTypes});
    await saveReleases(state.releases);
    return;
  }
  if(!ado.org || !ado.project || !ado.pat){
    state.adoSyncMsg = `The "${ado.name}" connection is missing its Organization, Project, or Personal Access Token — finish setting it up first.`;
    stampLastSync(selectedRelease, {ok: false, message: state.adoSyncMsg, types: state.adoSyncTypes});
    await saveReleases(state.releases);
    return;
  }
  const iterationPath = selectedRelease.iterationPath || '';
  // Without an iteration path, the WIQL query has nothing to scope by and
  // pulls every matching item in the whole ADO project — set the release's
  // iteration path (✎ next to "Syncing into") before syncing so it's
  // actually scoped to this one release.
  if(!iterationPath){
    state.adoSyncMsg = `Set "${selectedRelease.name}"'s iteration path first — without one, sync pulls every matching item in the whole ADO project, not just this release.`;
    stampLastSync(selectedRelease, {ok: false, message: state.adoSyncMsg, types: state.adoSyncTypes});
    await saveReleases(state.releases);
    return;
  }

  state.adoSyncing = true;
  try{
    const typeFilter = state.adoSyncTypes || {userStory: true, defect: true, task: true};
    const ids = await runWiql(ado, buildQuery(ado, iterationPath, typeFilter));
    if(!ids.length){
      state.adoSyncMsg = 'No matching work items found — check your iteration path, type toggles, and work item type names.';
      stampLastSync(selectedRelease, {ok: false, message: state.adoSyncMsg, types: typeFilter});
      await saveReleases(state.releases);
      return;
    }
    const items = await fetchWorkItems(ado, ids);

    const usTypeL = (ado.workItemTypes && ado.workItemTypes.userStory || '').toLowerCase();
    const defectTypeL = (ado.workItemTypes && ado.workItemTypes.defect || '').toLowerCase();
    const taskTypeL = (ado.workItemTypes && ado.workItemTypes.task || '').toLowerCase();

    let usAdded = 0, usUpdated = 0, defAdded = 0, defUpdated = 0, taskAdded = 0, taskUpdated = 0;

    // User Stories first, then Defects, then Tasks — parent links resolve
    // by looking up already-upserted local records. WIQL is ordered by id,
    // so a child with a lower id than its parent would otherwise be
    // processed first and miss the link on a first-time sync.
    const typeOf = item => (item.fields['System.WorkItemType'] || '').toLowerCase();
    const orderedItems = [
      ...items.filter(i => typeOf(i) === usTypeL),
      ...items.filter(i => typeOf(i) === defectTypeL),
      ...items.filter(i => typeOf(i) === taskTypeL)
    ];

    // Sequential, not parallel — the comments endpoint is one call per item
    // with no batch form, so this is naturally slower for a big sync. Worth
    // knowing if syncing a large backlog feels sluggish.
    for(const item of orderedItems){
      const type = (item.fields['System.WorkItemType'] || '').toLowerCase();
      const title = item.fields['System.Title'] || `Work item ${item.id}`;
      const adoState = item.fields['System.State'] || '';
      const itemIterationPath = item.fields['System.IterationPath'] || '';
      const assignedTo = extractIdentity(item.fields, 'System.AssignedTo');
      const createdBy = extractIdentity(item.fields, 'System.CreatedBy');
      // Upserts a Person into the roster from ADO's identity directly —
      // doesn't just look for an existing match, it creates/updates one so
      // the People roster reflects ADO instead of the other way around.
      const matchedMember = upsertMemberFromAdo(state, assignedTo.name, assignedTo.email);
      // Also land Created By on the roster so defect day activity can default
      // the tester to the person who filed it.
      upsertMemberFromAdo(state, createdBy.name, createdBy.email);
      const assigneeId = matchedMember ? matchedMember.id : null;
      const assigneeEmail = assignedTo.email || '';
      const createdByName = createdBy.name || '';
      const createdByEmail = createdBy.email || '';
      const latestComment = await fetchLatestComment(ado, item.id);

      if(type === usTypeL){
        const existing = state.userStories.find(u => u.adoId === item.id);
        if(existing){
          existing.title = title; existing.adoState = adoState;
          existing.assigneeId = assigneeId;
          existing.assigneeEmail = assigneeEmail;
          existing.createdByName = createdByName; existing.createdByEmail = createdByEmail;
          existing.latestComment = latestComment;
          // Live ADO field — always refreshed, same as on Defects.
          existing.iterationPath = itemIterationPath;
          // This item just matched the currently-selected release's iteration
          // path query, so it belongs to this release now — even if it was
          // first synced in under a different release (e.g. moved sprints in
          // ADO). Without this, re-syncing a moved item leaves it stuck
          // under whichever release it was originally pulled into.
          existing.releaseId = state.selectedReleaseId || null;
          usUpdated++;
        }else{
          state.userStories.push({
            id: uid(), adoId: item.id, title,
            releaseId: state.selectedReleaseId || null, adoState, iterationPath: itemIterationPath, defectIds: [],
            assigneeId, assigneeEmail, createdByName, createdByEmail, latestComment
          });
          usAdded++;
        }
      }else if(type === defectTypeL){
        const severity = mapSeverity(item.fields['Microsoft.VSTS.Common.Severity']);
        const tags = parseTags(item.fields['System.Tags']);
        let d = state.defects.find(x => x.adoId === item.id);
        if(d){
          d.title = title; d.adoState = adoState; d.severity = severity; d.tags = tags;
          d.assigneeId = assigneeId;
          d.assigneeEmail = assigneeEmail;
          d.createdByName = createdByName; d.createdByEmail = createdByEmail;
          d.latestComment = latestComment;
          // Live ADO field — always refreshed, unlike createdDate below.
          d.iterationPath = itemIterationPath;
          // Backfills createdDate for defects synced before this field
          // existed — never overwrites one that's already set, since it's
          // ADO's fixed creation date, not a sync timestamp.
          if(!d.createdDate) d.createdDate = item.fields['System.CreatedDate'] || null;
          applyDefectResolutionDates(d, item.fields, adoState);
          defUpdated++;
        }else{
          const createdDate = item.fields['System.CreatedDate'] || new Date().toISOString();
          d = {id: uid(), adoId: item.id, title, userStoryId: null, severity, tags, adoState, iterationPath: itemIterationPath, assigneeId, assigneeEmail, createdByName, createdByEmail, latestComment, createdDate};
          applyDefectResolutionDates(d, item.fields, adoState);
          state.defects.push(d);
          defAdded++;
        }
        // A defect's release membership is resolved primarily from its own
        // iterationPath now (see defects.js's defectReleaseId) — this
        // parent link is still captured for display ("Re: {story}") and as
        // a fallback for defects without their own iteration path. Falls
        // back to a tag-encoded parent id when the ADO relation itself
        // isn't set (see findParentUsAdoIdFromTags).
        const parentAdoId = findParentAdoId(item) || findParentUsAdoIdFromTags(tags, state.userStories);
        const parentUs = parentAdoId ? state.userStories.find(u => u.adoId === parentAdoId) : null;
        if(parentUs){
          if(d.userStoryId && d.userStoryId !== parentUs.id){
            const oldParent = state.userStories.find(u => u.id === d.userStoryId);
            if(oldParent && Array.isArray(oldParent.defectIds)){
              oldParent.defectIds = oldParent.defectIds.filter(id => id !== d.id);
            }
          }
          d.userStoryId = parentUs.id;
          if(!Array.isArray(parentUs.defectIds)) parentUs.defectIds = [];
          if(!parentUs.defectIds.includes(d.id)) parentUs.defectIds.push(d.id);
        }
      }else if(type === taskTypeL){
        // ADO Tasks land on whichever day is currently on screen — this
        // board is inherently date-scoped and an ADO Task has no date of
        // its own, so "today" (or whatever day you synced from) is the
        // closest fit.
        //
        // A Task is usually a child of a User Story or a Bug in ADO — link
        // to whichever the parent relation resolves to, so the board can
        // show what it's actually for.
        const taskParentAdoId = findParentAdoId(item);
        const parentUsForTask = taskParentAdoId ? state.userStories.find(u => u.adoId === taskParentAdoId) : null;
        const parentDefectForTask = (!parentUsForTask && taskParentAdoId) ? state.defects.find(d => d.adoId === taskParentAdoId) : null;

        const existing = state.tasks.find(x => x.adoId === item.id);
        if(existing){
          existing.title = title;
          existing.assignees = matchedMember ? [matchedMember.id] : existing.assignees;
          existing.latestComment = latestComment;
          existing.assigneeEmail = assigneeEmail;
          existing.createdByName = createdByName; existing.createdByEmail = createdByEmail;
          existing.iterationPath = itemIterationPath;
          existing.userStoryId = parentUsForTask ? parentUsForTask.id : null;
          existing.defectId = parentDefectForTask ? parentDefectForTask.id : null;
          // Same reassignment as User Stories above — this item matched the
          // currently-selected release's iteration path, so it belongs to
          // this release now even if it was first synced under another one.
          existing.releaseId = state.selectedReleaseId || null;
          taskUpdated++;
        }else{
          state.tasks.push({
            id: uid(), adoId: item.id, title, time: '', priority: 'medium', status: 'pending',
            comment: '', assignees: matchedMember ? [matchedMember.id] : [], assignedGroups: [],
            releaseId: state.selectedReleaseId || null, iterationPath: itemIterationPath,
            userStoryId: parentUsForTask ? parentUsForTask.id : null,
            defectId: parentDefectForTask ? parentDefectForTask.id : null,
            assigneeEmail, createdByName, createdByEmail, latestComment,
            order: nextOrder('medium', state.tasks), source: 'ado'
          });
          taskAdded++;
        }
      }
    }

    await saveUserStories(state.userStories);
    await saveDefects(state.defects);
    await saveTasks(state.dateStr, state.tasks);
    await saveTeam(state.team);

    const parts = [];
    if(usAdded || usUpdated) parts.push(`${usAdded} new / ${usUpdated} updated user ${usAdded + usUpdated === 1 ? 'story' : 'stories'}`);
    if(defAdded || defUpdated) parts.push(`${defAdded} new / ${defUpdated} updated defects`);
    if(taskAdded || taskUpdated) parts.push(`${taskAdded} new / ${taskUpdated} updated tasks`);
    state.adoSyncMsg = parts.length ? `Synced: ${parts.join(', ')}.` : 'Sync completed — nothing new.';
    stampLastSync(selectedRelease, {ok: true, message: state.adoSyncMsg, types: typeFilter});
    await saveReleases(state.releases);
  }catch(e){
    state.adoSyncMsg = e.message || 'Sync failed — check your ADO settings.';
    stampLastSync(selectedRelease, {ok: false, message: state.adoSyncMsg, types: state.adoSyncTypes});
    await saveReleases(state.releases);
  }finally{
    state.adoSyncing = false;
  }
}
