import { AppState, Defect, Release, StandupEntry, TeamMember, UserStory } from '../types';

export interface AiResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function generateStandupSummary(
  entries: Record<string, StandupEntry>,
  team: TeamMember[],
  dateStr: string,
  apiKey?: string
): Promise<AiResponse> {
  try {
    const payload = {
      dateStr,
      entries: Object.entries(entries).map(([memberId, entry]) => {
        const member = team.find(t => t.id === memberId);
        return {
          member: member ? `${member.name} (${member.role})` : 'Teammate',
          yesterday: entry.yesterday,
          today: entry.today,
          blockers: entry.blockers
        };
      })
    };

    const res = await fetch('/api/ai/standup-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, text: data.summary || data.text };
  } catch (err: any) {
    console.error('[AI Standup Summary Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not connect to AI service.'
    };
  }
}

export async function generateReleaseNotes(
  release: Release,
  stories: UserStory[],
  defects: Defect[],
  apiKey?: string
): Promise<AiResponse> {
  try {
    const payload = {
      releaseName: release.name,
      targetDate: release.targetDate,
      status: release.status,
      description: release.description,
      stories: stories.map(s => ({
        id: s.adoId ? `US-${s.adoId}` : s.id,
        title: s.title,
        status: s.status,
        points: s.storyPoints
      })),
      defects: defects.map(d => ({
        id: d.adoId ? `DEF-${d.adoId}` : d.id,
        title: d.title,
        severity: d.severity,
        status: d.status
      }))
    };

    const res = await fetch('/api/ai/release-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, text: data.notes || data.text };
  } catch (err: any) {
    console.error('[AI Release Notes Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not connect to AI service.'
    };
  }
}

export async function generateDefectAnalysis(
  defect: Defect,
  linkedStory?: UserStory | null,
  apiKey?: string
): Promise<AiResponse> {
  try {
    const payload = {
      title: defect.title,
      description: defect.description,
      severity: defect.severity,
      environment: defect.environment,
      stepsToReproduce: defect.stepsToReproduce,
      linkedStoryTitle: linkedStory?.title,
      linkedStoryCriteria: linkedStory?.acceptanceCriteria
    };

    const res = await fetch('/api/ai/defect-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, text: data.analysis || data.text };
  } catch (err: any) {
    console.error('[AI Defect Analysis Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not connect to AI service.'
    };
  }
}

export async function generateAppreciationNote(
  member: TeamMember,
  completedTasksCount: number,
  highlights: string,
  period: string,
  apiKey?: string
): Promise<AiResponse> {
  try {
    const payload = {
      memberName: member.name,
      role: member.role,
      period,
      completedTasksCount,
      highlights
    };

    const res = await fetch('/api/ai/appreciation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, text: data.note || data.text };
  } catch (err: any) {
    console.error('[AI Appreciation Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not connect to AI service.'
    };
  }
}

export interface WritingAssistOptions {
  text: string;
  action: 'improve' | 'expand' | 'shorten' | 'bulletize' | 'formal' | 'technical';
  tone?: string;
  context?: string;
}

export async function requestWritingAssist(
  options: WritingAssistOptions,
  apiKey?: string
): Promise<AiResponse> {
  try {
    const res = await fetch('/api/ai/writing-assist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(options)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, text: data.result || data.text };
  } catch (err: any) {
    console.error('[AI Writing Assist Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not connect to writing assistance service.'
    };
  }
}

export interface EmailFormatOptions {
  type?: string;
  subject?: string;
  recipient?: string;
  senderName?: string;
  rawNotes: string;
  dataContext?: any;
  tone?: string;
}

export async function requestEmailFormat(
  options: EmailFormatOptions,
  apiKey?: string
): Promise<AiResponse> {
  try {
    const res = await fetch('/api/ai/email-format', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(options)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, text: data.formattedEmail || data.text };
  } catch (err: any) {
    console.error('[AI Email Formatting Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not connect to email formatting service.'
    };
  }
}

export async function generateAiTestSteps(
  payload: {
    testTitle: string;
    testDescription?: string;
    userStoryTitle?: string;
    acceptanceCriteria?: string[];
    testType?: string;
  },
  apiKey?: string
): Promise<{ ok: boolean; steps?: { stepNumber: number; action: string; expectedResult: string }[]; error?: string }> {
  try {
    const res = await fetch('/api/ai/generate-test-steps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, steps: data.steps || [] };
  } catch (err: any) {
    console.error('[AI Generate Test Steps Error]:', err);
    return {
      ok: false,
      error: err.message || 'Could not generate test steps.'
    };
  }
}
