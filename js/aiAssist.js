// Optional AI assist — opt-in only. Calls a user-provided chat completions
// endpoint with a short Day Signals payload. Keys stay in local settings
// (never exported in backups — stripped like PATs).
//
// Providers:
//   openai  — any OpenAI-compatible /v1/chat/completions URL
//   gemini  — Google's OpenAI-compatible Gemini URL (same request/response
//             shape). Direct browser calls are blocked by CORS; use the
//             included ai-proxy.py on localhost, or any CORS-friendly proxy.
//
// Chrome / Google-account Gemini Pro (sidebar) cannot power this — there is
// no browser API to borrow that login. You need an API key from AI Studio.

import { daySignalsSnapshot } from './standupEmail.js';
import { memberStandupEntry } from './standupShape.js';
import { scopedUserStories, scopedDefects } from './opsHelpers.js';

/** Google's OpenAI-compatible chat completions path (server-side / proxy). */
export const GEMINI_OPENAI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/** Local proxy default — see ai-proxy.py in the project root. */
export const LOCAL_AI_PROXY_ENDPOINT = 'http://127.0.0.1:8787/v1/chat/completions';

export const AI_PROVIDER_PRESETS = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyPlaceholder: 'sk-…'
  },
  gemini: {
    // Browser → Gemini is CORS-blocked; point at the local proxy by default.
    endpoint: LOCAL_AI_PROXY_ENDPOINT,
    model: 'gemini-2.0-flash',
    keyPlaceholder: 'AIza… (AI Studio key)'
  }
};

export function aiSettingsFrom(settings){
  const src = (settings && settings.aiAssist) || {};
  const provider = src.provider === 'gemini' ? 'gemini' : 'openai';
  const preset = AI_PROVIDER_PRESETS[provider];
  return {
    provider,
    endpoint: String(src.endpoint || '').trim(),
    apiKey: String(src.apiKey || '').trim(),
    model: String(src.model || preset.model).trim() || preset.model
  };
}

export function isAiConfigured(settings){
  const ai = aiSettingsFrom(settings);
  return Boolean(ai.endpoint && ai.apiKey);
}

/** Defaults to apply when the user switches provider in Settings. */
export function defaultsForProvider(provider){
  const p = provider === 'gemini' ? 'gemini' : 'openai';
  const preset = AI_PROVIDER_PRESETS[p];
  return {provider: p, endpoint: preset.endpoint, model: preset.model};
}

function extractChoiceText(data){
  if(!data || typeof data !== 'object') return '';
  // OpenAI / Gemini OpenAI-compat
  const choice = data.choices && data.choices[0];
  if(choice && choice.message){
    return String(choice.message.content || '').trim();
  }
  // Gemini native generateContent (if someone points a proxy at that API)
  const parts = data.candidates
    && data.candidates[0]
    && data.candidates[0].content
    && data.candidates[0].content.parts;
  if(Array.isArray(parts)){
    return parts.map(p => (p && p.text) || '').join('').trim();
  }
  return '';
}

async function requestCompletion(state, {system, prompt}){
  const ai = aiSettingsFrom(state.settings);
  if(!ai.endpoint || !ai.apiKey){
    state.aiAssistWarn = 'Add an AI endpoint URL and API key under Settings → AI assist (optional), stored only in this browser.';
    state.aiAssistMsg = '';
    return {ok:false};
  }

  state.aiAssistWarn = '';
  state.aiAssistMsg = 'Requesting draft…';

  try{
    const res = await fetch(ai.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: prompt}
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    if(!res.ok){
      const text = await res.text().catch(() => '');
      state.aiAssistWarn = `AI request failed (${res.status}). Check endpoint, model, and key.${text ? ' ' + text.slice(0, 120) : ''}`;
      state.aiAssistMsg = '';
      return {ok:false};
    }
    const data = await res.json();
    const content = extractChoiceText(data);
    if(!content){
      state.aiAssistWarn = 'AI response had no text — try another model or endpoint.';
      state.aiAssistMsg = '';
      return {ok:false};
    }
    state.aiAssistWarn = '';
    state.aiAssistMsg = content;
    return {ok:true, text: content};
  }catch(e){
    const hint = ai.provider === 'gemini'
      ? ' For Gemini, run python3 ai-proxy.py (CORS blocks direct browser calls).'
      : ' CORS or offline may block browser calls.';
    state.aiAssistWarn = `AI request could not complete (${e && e.message ? e.message : 'network error'}).${hint}`;
    state.aiAssistMsg = '';
    return {ok:false};
  }
}

export async function summarizeDaySignals(state){
  const snap = daySignalsSnapshot(state);
  const prompt = [
    'You are assisting a test lead preparing a short standup briefing.',
    'Summarize these day signals in 4-6 concise bullets. Separate People vs Work/Quality.',
    'No fluff, no invented metrics.',
    '',
    `Date: ${state.dateStr}`,
    'People: ' + snap.people.map(p => `${p.label}=${p.value}`).join(', '),
    'Work/Quality: ' + snap.work.map(p => `${p.label}=${p.value}`).join(', ')
  ].join('\n');
  return requestCompletion(state, {
    system: 'You write terse operational standup summaries.',
    prompt
  });
}

export async function draftStandupHighlights(state){
  const snap = daySignalsSnapshot(state);
  const notes = (state.team || []).map(m => {
    const e = memberStandupEntry(state.standup, m.id);
    const bits = [e.yesterday, e.today, e.blockers].map(s => String(s || '').trim()).filter(Boolean);
    return bits.length ? `${m.name}: ${bits.join(' | ')}` : '';
  }).filter(Boolean).slice(0, 20);
  const prompt = [
    'Draft standup highlights as 4-8 short bullets the lead can edit.',
    'Use only the notes and signals provided. Do not invent work.',
    `Date: ${state.dateStr}`,
    'Signals: ' + [...snap.people, ...snap.work].map(p => `${p.label}=${p.value}`).join(', '),
    notes.length ? 'Notes:\n' + notes.join('\n') : 'No per-person notes yet.'
  ].join('\n');
  return requestCompletion(state, {
    system: 'You write editable standup highlight bullets. No email send. No product brand names.',
    prompt
  });
}

export async function draftQaHighlights(state){
  const stories = scopedUserStories(state).map(us => {
    const note = (us.progressNotes && us.progressNotes[state.dateStr] || us.ongoingNote || '').trim();
    return note ? `${us.title}: ${note}` : '';
  }).filter(Boolean).slice(0, 12);
  const defects = scopedDefects(state).filter(d => d.severity === 'critical' || d.severity === 'high').slice(0, 10)
    .map(d => `[${(d.severity||'').toUpperCase()}] ${d.title}`);
  const prompt = [
    'Draft Daily QA Status highlights and lowlights as two labeled sections.',
    'Highlights: what went well / completed. Lowlights: defects, blockers.',
    'Bullet lines starting with "- ". Editable. No invented metrics or brand names.',
    `Date: ${state.dateStr}`,
    stories.length ? 'Story notes:\n' + stories.join('\n') : 'No story notes.',
    defects.length ? 'Hot defects:\n' + defects.join('\n') : 'No critical/high titles listed.'
  ].join('\n');
  const result = await requestCompletion(state, {
    system: 'You write tester QA status bullets for a human to edit before sending.',
    prompt
  });
  if(result.ok && result.text) result.parsed = splitQaHighlightDraft(result.text);
  return result;
}

export function splitQaHighlightDraft(text){
  const highlights = [];
  const lowlights = [];
  let mode = 'h';
  String(text || '').split('\n').forEach(line => {
    const t = line.trim();
    if(!t) return;
    if(/^lowlights/i.test(t.replace(/[:]/g, ''))){ mode = 'l'; return; }
    if(/^highlights/i.test(t.replace(/[:]/g, ''))){ mode = 'h'; return; }
    const cleaned = t.replace(/^[-•*]\s*/, '').trim();
    if(!cleaned) return;
    if(mode === 'l') lowlights.push('- ' + cleaned);
    else highlights.push('- ' + cleaned);
  });
  return {
    highlights: highlights.join('\n'),
    lowlights: lowlights.join('\n')
  };
}
