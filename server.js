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

// 6. Azure DevOps connectivity test proxy (optional helper to overcome browser CORS on PAT)
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
