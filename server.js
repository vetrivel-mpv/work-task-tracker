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

// 5. Direct Gemini AI Real-Time Text Writing Assistance endpoint
app.post('/api/ai/writing-assist', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY or Settings.'
      });
    }

    const { text, action, tone, context } = req.body;
    if (!text && !context) {
      return res.status(400).json({ error: 'Text or context is required for writing assistance.' });
    }

    let instruction = '';
    switch (action) {
      case 'improve':
        instruction = 'Improve clarity, flow, grammar, and executive punch while preserving core factual meaning.';
        break;
      case 'expand':
        instruction = 'Elaborate on the key points with concrete details, structured delivery bullet points, and actionable next steps.';
        break;
      case 'shorten':
        instruction = 'Condense into a crisp, high-impact executive summary with maximum information density.';
        break;
      case 'bulletize':
        instruction = 'Convert the provided paragraph text into structured, clean bullet points categorized logically.';
        break;
      case 'formal':
        instruction = 'Rewrite with a polished, highly professional corporate executive tone suitable for stakeholder updates.';
        break;
      case 'technical':
        instruction = 'Sharpen technical accuracy, architectural terminology, and engineering clarity.';
        break;
      default:
        instruction = 'Enhance and refine the text for engineering delivery and leadership communication.';
    }

    const prompt = `You are a Principal Technical Writer and Engineering Delivery Executive.
INSTRUCTION: ${instruction}
DESIRED TONE: ${tone || 'Professional & Crisp'}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

ORIGINAL TEXT:
"""
${text || ''}
"""

Provide the refined text directly in clean Markdown format without unnecessary preamble or meta-commentary.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt
    });

    res.json({ ok: true, result: response.text });
  } catch (error) {
    console.error('[AI Writing Assist Error]:', error);
    res.status(500).json({ error: error.message || 'AI writing assistance failed' });
  }
});

// 6. Direct Gemini AI Real-Time Email Formatting & Writing endpoint
app.post('/api/ai/email-format', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY or Settings.'
      });
    }

    const { 
      type, // 'standup_digest' | 'qa_status' | 'release_announcement' | 'client_update' | 'custom'
      subject,
      recipient,
      senderName,
      rawNotes,
      dataContext,
      tone 
    } = req.body;

    const prompt = `You are a Principal Engineering Delivery Lead writing an executive stakeholder email broadcast.
EMAIL TYPE: ${type || 'Executive Delivery Update'}
TONE: ${tone || 'Polished, direct, professional'}
SENDER: ${senderName || 'Delivery Lead'}
RECIPIENT: ${recipient || 'Engineering & Executive Stakeholders'}
USER SUBJECT IDEA: ${subject || 'Sprint & Delivery Status Update'}

RAW BULLET POINTS / CONTENT:
"""
${rawNotes || ''}
"""

${dataContext ? `SYSTEM METRICS & CONTEXT:\n${JSON.stringify(dataContext, null, 2)}` : ''}

Produce a complete, beautifully structured Email draft in clean format.
Include:
1. **Subject Line**: Crisp, high-impact, professional subject line (e.g. "[CareFlow EHR] Sprint 24 Delivery & Quality Digest — Aug 21").
2. **Salutation**: Professional greeting.
3. **Executive Summary**: 2-3 sentence high-level overview.
4. **Key Highlights & Completed Deliverables**: Bulleted key wins.
5. **Quality & QA Metrics / Blockers**: Clear risk assessment.
6. **Next Steps & Commitments**: Explicit ownership & timelines.
7. **Sign-off**: Professional signature.

Return the result formatted in clean Markdown with clear Subject and Body sections.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt
    });

    res.json({ ok: true, formattedEmail: response.text });
  } catch (error) {
    console.error('[AI Email Formatting Error]:', error);
    res.status(500).json({ error: error.message || 'AI email formatting failed' });
  }
});

// 7. Direct Gemini AI QA Test Steps Generator
app.post('/api/ai/generate-test-steps', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const userApiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const ai = getAiClient(userApiKey);

    if (!ai) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY or Settings.'
      });
    }

    const { testTitle, testDescription, userStoryTitle, acceptanceCriteria, testType } = req.body;

    const prompt = `You are a Lead QA Automation & Verification Engineer.
Generate concrete, sequential, verifiable Test Steps with precise Actions and Expected Results for the following test case:

TEST CASE TITLE: ${testTitle || 'Verification Scenario'}
TEST DESCRIPTION: ${testDescription || 'N/A'}
TEST TYPE: ${testType || 'Manual / Regression'}
LINKED USER STORY: ${userStoryTitle || 'N/A'}
ACCEPTANCE CRITERIA:
${(acceptanceCriteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n') || 'N/A'}

Respond strictly with a valid JSON array of test step objects. Each step must have:
- stepNumber: number (1, 2, 3...)
- action: string (precise instructions for the tester or test runner)
- expectedResult: string (verifiable system response or UI assertion)

Format output strictly as JSON array:
[
  { "stepNumber": 1, "action": "...", "expectedResult": "..." }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    let steps = [];
    try {
      steps = JSON.parse(response.text);
    } catch {
      steps = [
        { stepNumber: 1, action: 'Execute test verification setup', expectedResult: 'Environment ready' },
        { stepNumber: 2, action: 'Submit test payload according to requirements', expectedResult: 'Success status received' }
      ];
    }

    res.json({ ok: true, steps });
  } catch (error) {
    console.error('[AI Generate Test Steps Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to generate test steps' });
  }
});

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
