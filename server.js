import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Lazy GoogleGenAI client
let aiClient = null;
function getAiClient(clientApiKey) {
  const key = clientApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
}

// 1. AI Standup Summary endpoint
app.post('/api/ai/standup-summary', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Please configure GEMINI_API_KEY in environment or app Settings.'
      });
    }

    const { dateStr, entries } = req.body;
    const entriesText = (entries || [])
      .map(
        (e) =>
          `Teammate: ${e.member}\n- Yesterday: ${e.yesterday || 'None'}\n- Today: ${e.today || 'None'}\n- Blockers: ${e.blockers || 'None'}`
      )
      .join('\n\n');

    const prompt = `You are the AI Delivery Lead for Northstar Delivery.
Summarize the following daily standup updates for ${dateStr} into a crisp, executive briefing for engineering leadership.

STANDUP UPDATES:
${entriesText}

Format your response in clean Markdown with:
1. **Executive Overview** (2-3 sentences on team momentum and sprint alignment)
2. **Key Completed Deliverables** (bulleted achievements)
3. **Today's Commitments & High Impact Focus**
4. **🚨 Active Blockers & Risks Requiring Attention** (if any; else state "All clear")
5. **Delivery Recommendations** (1-2 actionable tips for unblocking or pairing)

Keep it concise, professional, and directly actionable.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt
    });

    res.json({ ok: true, summary: response.text });
  } catch (error) {
    console.error('[AI Standup Summary Error]:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

// 2. AI Release Notes & Risk Assessment endpoint
app.post('/api/ai/release-notes', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY or Settings.'
      });
    }

    const { releaseName, targetDate, status, description, stories, defects } = req.body;
    const prompt = `You are a Principal Release Manager for Northstar Delivery.
Generate professional Release Notes and a Launch Risk Assessment for the upcoming release.

RELEASE DETAILS:
- Name: ${releaseName}
- Target Date: ${targetDate}
- Current Status: ${status}
- Summary: ${description || 'N/A'}

USER STORIES IN SCOPE:
${JSON.stringify(stories || [], null, 2)}

DEFECTS & BUGS:
${JSON.stringify(defects || [], null, 2)}

Produce a structured Release Document in clean Markdown:
1. **Release Overview & Purpose**
2. **What's New (Feature Highlights & Capabilities)**
3. **Resolved Defects & Quality Improvements**
4. **⚠️ Release Risk Matrix & Go/No-Go Assessment** (Evaluate critical defects, incomplete stories, and staging readiness)
5. **QA & Rollback Plan Checklist**`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt
    });

    res.json({ ok: true, notes: response.text });
  } catch (error) {
    console.error('[AI Release Notes Error]:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

// 3. AI Defect Root Cause & QA Test Plan assistant
app.post('/api/ai/defect-analysis', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY or Settings.'
      });
    }

    const { title, description, severity, environment, stepsToReproduce, linkedStoryTitle, linkedStoryCriteria } = req.body;

    const prompt = `You are an expert QA Automation Lead and Systems Architect.
Analyze the following defect to provide root cause hypotheses and an exhaustive QA verification plan.

DEFECT DETAILS:
- Title: ${title}
- Description: ${description || 'N/A'}
- Severity: ${severity}
- Environment: ${environment || 'QA'}
- Steps to Reproduce: ${stepsToReproduce || 'N/A'}
- Linked User Story: ${linkedStoryTitle || 'N/A'}
- Acceptance Criteria: ${JSON.stringify(linkedStoryCriteria || [])}

Provide:
1. **Root Cause Analysis (RCA) Hypotheses**: Potential code / database / concurrency failure points.
2. **Defect Severity & Blast Radius Validation**: Is ${severity} appropriate?
3. **Recommended Fix Strategy**: Architectural and code-level suggestions.
4. **Step-by-Step Retest & Edge Case Matrix**: 4-5 high-value test scenarios to prevent regression.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt
    });

    res.json({ ok: true, analysis: response.text });
  } catch (error) {
    console.error('[AI Defect Analysis Error]:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

// 4. AI Team Appreciation & Performance Note Drafter
app.post('/api/ai/appreciation', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY or Settings.'
      });
    }

    const { memberName, role, period, completedTasksCount, highlights } = req.body;

    const prompt = `You are a supportive, high-performance Engineering Director.
Write a personalized, sincere, and motivating delivery appreciation note for an engineer.

ENGINEER DETAILS:
- Name: ${memberName}
- Role: ${role}
- Review Period: ${period}
- Completed Tasks: ${completedTasksCount}
- Key Highlights & Accomplishments: ${highlights}

Generate a concise (2-3 paragraphs) message highlighting their impact on client delivery, technical rigor, and team collaboration. Keep it authentic, appreciative, and professional.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt
    });

    res.json({ ok: true, note: response.text });
  } catch (error) {
    console.error('[AI Appreciation Error]:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

// 5. General Chat Completions proxy (for custom endpoints/compatibility)
const handleChatCompletions = async (req, res) => {
  try {
    let auth = req.headers['authorization'] || '';
    if (!auth && process.env.GEMINI_API_KEY) {
      auth = `Bearer ${process.env.GEMINI_API_KEY}`;
    }

    const UPSTREAM = (process.env.AI_PROXY_UPSTREAM || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions').replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = auth;

    const response = await fetch(UPSTREAM, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    const data = await response.text();
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      json = null;
    }

    res.status(response.status);
    if (json) res.json(json);
    else res.send(data);
  } catch (error) {
    console.error('[AI Proxy Error]:', error);
    res.status(502).json({ error: error.message || 'AI Proxy request failed' });
  }
};

app.post('/v1/chat/completions', handleChatCompletions);
app.post('/chat/completions', handleChatCompletions);

// 6. Azure DevOps API Integration endpoints
app.post('/api/ado/test', async (req, res) => {
  try {
    const { org, project, pat } = req.body;
    if (!org || !pat) {
      return res.status(400).json({ ok: false, error: 'Org and Personal Access Token (PAT) are required.' });
    }

    const auth = Buffer.from(`:${pat}`).toString('base64');
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects?api-version=7.0`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: `ADO returned HTTP ${response.status}: ${response.statusText}` });
    }

    const data = await response.json();
    res.json({ ok: true, projectsCount: data.count, projects: data.value?.map((p) => p.name) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper to flatten ADO classification nodes
function flattenNodes(node, currentPath = '') {
  const fullPath = currentPath ? `${currentPath}\\${node.name}` : node.name;
  let items = [{
    id: node.id,
    name: node.name,
    path: fullPath,
    startDate: node.attributes?.startDate,
    finishDate: node.attributes?.finishDate
  }];
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      items = items.concat(flattenNodes(child, fullPath));
    }
  }
  return items;
}

// 7. Fetch Iterations from Azure DevOps
app.post('/api/ado/iterations', async (req, res) => {
  const { org, project, pat } = req.body;
  if (!org || !project) {
    return res.status(400).json({ ok: false, error: 'Org and Project are required.' });
  }

  if (!pat) {
    return res.json({ ok: true, iterations: [], source: 'empty_no_pat' });
  }

  try {
    const auth = Buffer.from(`:${pat}`).toString('base64');
    
    // Attempt 1: Classification nodes iterations
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/classificationnodes/iterations?$depth=5&api-version=7.0`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const flattened = flattenNodes(data);
      const iterations = flattened.map(item => ({
        id: item.id,
        name: item.name,
        path: item.path,
        startDate: item.startDate ? item.startDate.split('T')[0] : undefined,
        finishDate: item.finishDate ? item.finishDate.split('T')[0] : undefined
      }));
      return res.json({ ok: true, iterations, source: 'live_ado' });
    }

    // Attempt 2: Team settings iterations
    const teamUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/work/teamsettings/iterations?api-version=7.0`;
    const teamResp = await fetch(teamUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (teamResp.ok) {
      const teamData = await teamResp.json();
      const iterations = (teamData.value || []).map(t => ({
        id: t.id,
        name: t.name,
        path: t.path,
        startDate: t.attributes?.startDate?.split('T')[0],
        finishDate: t.attributes?.finishDate?.split('T')[0]
      }));
      return res.json({ ok: true, iterations, source: 'live_ado_team' });
    }

    res.json({ ok: true, iterations: [], source: 'empty_on_error', error: `ADO API returned status ${response.status}` });
  } catch (err) {
    console.warn('[ADO Iterations API Warning]:', err.message);
    res.json({ ok: false, iterations: [], error: err.message });
  }
});

// 8. Fetch Areas from Azure DevOps
app.post('/api/ado/areas', async (req, res) => {
  const { org, project, pat } = req.body;
  if (!org || !project) {
    return res.status(400).json({ ok: false, error: 'Org and Project are required.' });
  }

  if (!pat) {
    return res.json({ ok: true, areas: [], source: 'empty_no_pat' });
  }

  try {
    const auth = Buffer.from(`:${pat}`).toString('base64');
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/classificationnodes/areas?$depth=5&api-version=7.0`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const flattened = flattenNodes(data);
      const areas = flattened.map(item => ({
        id: item.id,
        name: item.name,
        path: item.path
      }));
      return res.json({ ok: true, areas, source: 'live_ado' });
    }

    res.json({ ok: true, areas: [], source: 'empty_on_error', error: `ADO API returned status ${response.status}` });
  } catch (err) {
    console.warn('[ADO Areas API Warning]:', err.message);
    res.json({ ok: false, areas: [], error: err.message });
  }
});

// 9. Real Azure DevOps Work Item Sync (WIQL Query + Batch Extraction)
app.post('/api/ado/sync-workitems', async (req, res) => {
  const { org, project, pat, areaPath, iterationPath, targetInstance = 'internal' } = req.body;
  const startTime = Date.now();

  if (!org || !project || !pat) {
    return res.json({
      ok: false,
      error: 'Azure DevOps Organization, Project, and Personal Access Token (PAT) are required to sync live work items.',
      stories: [],
      defects: [],
      source: 'missing_credentials',
      durationMs: Date.now() - startTime,
      rawPayload: {
        request: { org, project, areaPath, iterationPath, targetInstance },
        diagnosticInfo: {
          status: '400 Bad Request - Missing credentials',
          totalReceived: 0,
          mappedAsStories: 0,
          mappedAsDefects: 0
        }
      }
    });
  }

  try {
    const auth = Buffer.from(`:${pat}`).toString('base64');
    
    // Normalize path separators to backslashes for ADO WIQL
    const normalizedIter = iterationPath ? iterationPath.replace(/\//g, '\\').trim() : '';
    const normalizedArea = areaPath ? areaPath.replace(/\//g, '\\').trim() : '';

    // WIQL query to fetch work items (User Stories, Bugs, Defects, Issues, Tasks)
    let wiqlQuery = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.WorkItemType], [System.AreaPath], [System.IterationPath] FROM WorkItems WHERE [System.TeamProject] = '${project}'`;
    
    if (normalizedIter) {
      const cleanIter = normalizedIter.replace(/'/g, "''");
      const prefixedIter = cleanIter.toLowerCase().startsWith((project + '\\').toLowerCase()) ? cleanIter : `${project}\\${cleanIter}`;
      if (cleanIter === prefixedIter) {
        wiqlQuery += ` AND ([System.IterationPath] UNDER '${cleanIter}' OR [System.IterationPath] = '${cleanIter}')`;
      } else {
        wiqlQuery += ` AND ([System.IterationPath] UNDER '${cleanIter}' OR [System.IterationPath] = '${cleanIter}' OR [System.IterationPath] UNDER '${prefixedIter}' OR [System.IterationPath] = '${prefixedIter}')`;
      }
    }
    if (normalizedArea) {
      const cleanArea = normalizedArea.replace(/'/g, "''");
      const prefixedArea = cleanArea.toLowerCase().startsWith((project + '\\').toLowerCase()) ? cleanArea : `${project}\\${cleanArea}`;
      if (cleanArea === prefixedArea) {
        wiqlQuery += ` AND ([System.AreaPath] UNDER '${cleanArea}' OR [System.AreaPath] = '${cleanArea}')`;
      } else {
        wiqlQuery += ` AND ([System.AreaPath] UNDER '${cleanArea}' OR [System.AreaPath] = '${cleanArea}' OR [System.AreaPath] UNDER '${prefixedArea}' OR [System.AreaPath] = '${prefixedArea}')`;
      }
    }
    wiqlQuery += ' ORDER BY [System.Id] DESC';

    const wiqlUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`;
    const wiqlResp = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: wiqlQuery })
    });

    if (!wiqlResp.ok) {
      const errorBody = await wiqlResp.text();
      console.warn(`[ADO WIQL error HTTP ${wiqlResp.status}]:`, errorBody);
      return res.json({
        ok: false,
        error: `Azure DevOps WIQL query failed (HTTP ${wiqlResp.status}): ${wiqlResp.statusText}`,
        stories: [],
        defects: [],
        source: 'wiql_error',
        durationMs: Date.now() - startTime,
        rawPayload: {
          request: { org, project, areaPath, iterationPath, targetInstance },
          wiql: { query: wiqlQuery, httpStatus: wiqlResp.status, errorText: errorBody },
          batchResponse: { count: 0, value: [] },
          diagnosticInfo: {
            status: `${wiqlResp.status} Error`,
            totalReceived: 0,
            mappedAsStories: 0,
            mappedAsDefects: 0
          }
        }
      });
    }

    const wiqlData = await wiqlResp.json();
    const allWorkItems = wiqlData.workItems || [];
    const workItemIds = allWorkItems.slice(0, 500).map(w => w.id);

    if (workItemIds.length === 0) {
      return res.json({
        ok: true,
        stories: [],
        defects: [],
        source: 'live_ado_empty',
        durationMs: Date.now() - startTime,
        rawPayload: {
          request: { org, project, areaPath, iterationPath, targetInstance },
          wiql: { query: wiqlQuery, resultCount: 0 },
          batchResponse: { count: 0, value: [] },
          diagnosticInfo: {
            status: '200 OK (0 work items found for query)',
            totalReceived: 0,
            mappedAsStories: 0,
            mappedAsDefects: 0
          }
        }
      });
    }

    // Batch fetch details in chunks of 200 (max allowed per ADO request)
    const batchUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/workitemsbatch?api-version=7.0`;
    const requestedFields = [
      'System.Id',
      'System.Title',
      'System.State',
      'System.AssignedTo',
      'System.CreatedBy',
      'System.WorkItemType',
      'System.AreaPath',
      'System.IterationPath',
      'System.Description',
      'Microsoft.VSTS.Common.AcceptanceCriteria',
      'Microsoft.VSTS.Common.Priority',
      'Microsoft.VSTS.Common.Severity',
      'Microsoft.VSTS.Scheduling.StoryPoints',
      'Microsoft.VSTS.TCM.ReproSteps',
      'Microsoft.VSTS.CMMI.Symptom',
      'System.Tags'
    ];

    const chunkSize = 200;
    const chunkPromises = [];
    for (let i = 0; i < workItemIds.length; i += chunkSize) {
      const chunk = workItemIds.slice(i, i + chunkSize);
      chunkPromises.push(
        fetch(batchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ids: chunk,
            fields: requestedFields
          })
        }).then(r => r.ok ? r.json() : { count: 0, value: [] })
      );
    }

    const chunkResults = await Promise.all(chunkPromises);
    const allFetchedItems = chunkResults.flatMap(res => res.value || []);

    const fetchedStories = [];
    const fetchedDefects = [];

    for (const item of allFetchedItems) {
      const rawType = (item.fields['System.WorkItemType'] || 'User Story').trim();
      const typeLower = rawType.toLowerCase();
      const isDefect = typeLower === 'bug' || 
                       typeLower.includes('bug') || 
                       typeLower.includes('defect') || 
                       typeLower.includes('issue') || 
                       typeLower.includes('incident') || 
                       typeLower.includes('problem') || 
                       typeLower.includes('impediment') ||
                       typeLower.includes('ticket') ||
                       typeLower.includes('flaw') ||
                       typeLower.includes('error');
      
      const rawState = (item.fields['System.State'] || 'New').trim();
      const rawStateLower = rawState.toLowerCase();

      // Map Story Status
      let mappedStoryStatus = 'To Do';
      if (rawStateLower.includes('in progress') || rawStateLower.includes('active') || rawStateLower.includes('doing') || rawStateLower.includes('committed')) {
        mappedStoryStatus = 'Dev In Progress';
      } else if (rawStateLower.includes('qa ready') || rawStateLower.includes('ready for test') || rawStateLower.includes('resolved')) {
        mappedStoryStatus = 'QA Ready';
      } else if (rawStateLower.includes('qa in progress') || rawStateLower.includes('testing')) {
        mappedStoryStatus = 'QA In Progress';
      } else if (rawStateLower.includes('closed') || rawStateLower.includes('done') || rawStateLower.includes('completed')) {
        mappedStoryStatus = 'Done';
      } else if (rawStateLower.includes('blocked')) {
        mappedStoryStatus = 'Blocked';
      }

      // Map Defect Status ('New' | 'Active' | 'Fixed' | 'Retest' | 'Closed')
      let mappedDefectStatus = 'Active';
      if (rawStateLower === 'new' || rawStateLower === 'proposed' || rawStateLower === 'triaged') {
        mappedDefectStatus = 'New';
      } else if (rawStateLower.includes('active') || rawStateLower.includes('in progress') || rawStateLower.includes('investigating') || rawStateLower.includes('approved') || rawStateLower.includes('committed')) {
        mappedDefectStatus = 'Active';
      } else if (rawStateLower.includes('fixed') || rawStateLower.includes('resolved') || rawStateLower.includes('ready for qa') || rawStateLower.includes('qa ready')) {
        mappedDefectStatus = 'Fixed';
      } else if (rawStateLower.includes('retest') || rawStateLower.includes('verified') || rawStateLower.includes('testing')) {
        mappedDefectStatus = 'Retest';
      } else if (rawStateLower.includes('closed') || rawStateLower.includes('done') || rawStateLower.includes('completed') || rawStateLower.includes('rejected')) {
        mappedDefectStatus = 'Closed';
      }

      // Map Severity ('critical' | 'high' | 'medium' | 'low')
      const rawSeverity = item.fields['Microsoft.VSTS.Common.Severity'] || item.fields['Microsoft.VSTS.Common.Priority'];
      let mappedSeverity = 'high';
      if (rawSeverity !== undefined && rawSeverity !== null) {
        const sStr = String(rawSeverity).toLowerCase();
        if (sStr.includes('1') || sStr.includes('crit') || sStr.includes('blocker')) mappedSeverity = 'critical';
        else if (sStr.includes('2') || sStr.includes('high')) mappedSeverity = 'high';
        else if (sStr.includes('3') || sStr.includes('med')) mappedSeverity = 'medium';
        else if (sStr.includes('4') || sStr.includes('low')) mappedSeverity = 'low';
      }

      const assigneeObj = item.fields['System.AssignedTo'];
      const assigneeName = typeof assigneeObj === 'object' ? (assigneeObj?.displayName || assigneeObj?.uniqueName) : (assigneeObj || 'Unassigned');

      const createdByObj = item.fields['System.CreatedBy'];
      const createdByName = typeof createdByObj === 'object' ? (createdByObj?.displayName || createdByObj?.uniqueName) : (createdByObj || '');

      const reproSteps = item.fields['Microsoft.VSTS.TCM.ReproSteps'] || item.fields['Microsoft.VSTS.CMMI.Symptom'] || '';
      const description = item.fields['System.Description'] || reproSteps || '';

      const tags = item.fields['System.Tags'] ? item.fields['System.Tags'].split(';').map(t => t.trim()).filter(Boolean) : [];

      if (isDefect) {
        fetchedDefects.push({
          id: `def-${item.id}`,
          adoId: item.id,
          title: item.fields['System.Title'] || `Defect ${item.id}`,
          status: mappedDefectStatus,
          severity: mappedSeverity,
          areaPath: item.fields['System.AreaPath'] || '',
          iterationPath: item.fields['System.IterationPath'] || '',
          assigneeName,
          createdByName,
          description: description,
          stepsToReproduce: reproSteps || description,
          tags: tags,
          environment: 'QA',
          sourceInstance: targetInstance === 'external' ? 'external' : 'internal'
        });
      } else {
        fetchedStories.push({
          id: `story-${item.id}`,
          adoId: item.id,
          title: item.fields['System.Title'] || `Story ${item.id}`,
          status: mappedStoryStatus,
          areaPath: item.fields['System.AreaPath'] || '',
          iterationPath: item.fields['System.IterationPath'] || '',
          assigneeName,
          createdByName,
          description: description,
          acceptanceCriteria: item.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] ? [item.fields['Microsoft.VSTS.Common.AcceptanceCriteria']] : [],
          storyPoints: item.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 5,
          sourceInstance: targetInstance === 'external' ? 'external' : 'internal'
        });
      }
    }

    return res.json({
      ok: true,
      stories: fetchedStories,
      defects: fetchedDefects,
      source: 'live_ado_wiql',
      durationMs: Date.now() - startTime,
      rawPayload: {
        request: { org, project, areaPath, iterationPath, targetInstance, authMode: 'Bearer/Basic' },
        wiql: {
          query: wiqlQuery,
          asOf: wiqlData.asOf || new Date().toISOString(),
          workItemsCount: (wiqlData.workItems || []).length
        },
        batchResponse: {
          count: allFetchedItems.length,
          value: allFetchedItems
        },
        diagnosticInfo: {
          status: '200 OK (Live Azure DevOps)',
          totalReceived: allFetchedItems.length,
          mappedAsStories: fetchedStories.length,
          mappedAsDefects: fetchedDefects.length,
          unmapped: 0,
          sourceEndpoint: batchUrl
        }
      }
    });
  } catch (err) {
    console.error('[ADO WorkItem Sync Error]:', err);
    return res.json({
      ok: false,
      error: err.message || String(err),
      stories: [],
      defects: [],
      source: 'error',
      durationMs: Date.now() - startTime,
      rawPayload: {
        request: { org, project, areaPath, iterationPath, targetInstance },
        error: { message: err.message || String(err) },
        batchResponse: { count: 0, value: [] }
      }
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), aiReady: Boolean(process.env.GEMINI_API_KEY) });
});

// Setup dev server with Vite or static serving in production
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Northstar Delivery v2 running at http://0.0.0.0:${PORT} (Mode: ${isDev ? 'Development' : 'Production'})`);
  });
}

startServer();
