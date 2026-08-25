import { AppState, Defect, Release, StandupEntry, TeamMember, UserStory, Task } from '../types';

export interface AiResponse {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

function extractErrorMessage(errData: any, status?: number): string {
  if (!errData) {
    return status ? `AI Service returned HTTP ${status}` : 'Could not connect to AI service.';
  }
  const raw = typeof errData === 'string' ? errData : (errData.error || errData.message || JSON.stringify(errData));
  try {
    const parsed = typeof raw === 'string' && raw.startsWith('{') ? JSON.parse(raw) : null;
    if (parsed?.error?.message) {
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE' || parsed.error.message.includes('high demand')) {
        return 'The Gemini model is experiencing temporary high demand on Google servers. Please try clicking Retry in a moment.';
      }
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  if (typeof raw === 'string') {
    if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
      return 'The Gemini model is experiencing temporary high demand on Google servers. Please try clicking Retry in a moment.';
    }
    return raw;
  }
  return 'AI generation failed. Please try again.';
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return { ok: true, text: data.summary || data.text, model: data.model };
  } catch (err: any) {
    console.error('[AI Standup Summary Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return { ok: true, text: data.notes || data.text, model: data.model };
  } catch (err: any) {
    console.error('[AI Release Notes Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return { ok: true, text: data.analysis || data.text, model: data.model };
  } catch (err: any) {
    console.error('[AI Defect Analysis Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return { ok: true, text: data.note || data.text, model: data.model };
  } catch (err: any) {
    console.error('[AI Appreciation Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
    };
  }
}

export interface RoastPayload {
  heatLevel: 'mild' | 'spicy' | 'fiery';
  target: 'sprint_team' | 'member';
  targetMemberName?: string;
  dateStr: string;
  stats?: {
    openBugs?: number;
    criticalBugs?: number;
    incompleteStories?: number;
    passedStories?: number;
    pendingTasks?: number;
  };
  openBugs?: any[];
  blockers?: string[];
  stories?: any[];
}

export async function generateTeamRoast(
  payload: RoastPayload,
  apiKey?: string
): Promise<{ ok: boolean; roast?: any; error?: string; model?: string }> {
  try {
    const res = await fetch('/api/ai/team-roast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return { ok: true, roast: data.roast, model: data.model };
  } catch (err: any) {
    console.error('[AI Team Roast Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
    };
  }
}

export async function analyzeDuplicateTickets(
  stories: UserStory[],
  defects: Defect[],
  tasks: Task[],
  testCases?: any[],
  apiKey?: string
): Promise<{
  ok: boolean;
  timestamp?: string;
  duplicatesFound?: number;
  matches?: any[];
  summary?: string;
  error?: string;
  model?: string;
}> {
  try {
    const payload = {
      stories,
      defects,
      tasks,
      testCases: testCases || []
    };

    const res = await fetch('/api/ai/duplicate-tickets-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return {
      ok: true,
      timestamp: data.timestamp,
      duplicatesFound: data.duplicatesFound || 0,
      matches: data.matches || [],
      summary: data.summary,
      model: data.model
    };
  } catch (err: any) {
    console.error('[AI Duplicate Analysis Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
    };
  }
}

export async function checkSingleTicketDuplicate(
  newTicket: {
    title: string;
    description?: string;
    stepsToReproduce?: string;
    acceptanceCriteria?: string;
    type?: string;
  },
  existingTickets: any[],
  apiKey?: string
): Promise<{
  ok: boolean;
  hasDuplicate?: boolean;
  highestConfidence?: number;
  matches?: Array<{
    existingTicketId: string;
    existingTicketAdoId?: number;
    existingTitle: string;
    confidenceScore: number;
    reason: string;
    recommendation: string;
  }>;
  error?: string;
  model?: string;
}> {
  try {
    const res = await fetch('/api/ai/check-ticket-duplicate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({ newTicket, existingTickets })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return {
      ok: true,
      hasDuplicate: data.hasDuplicate,
      highestConfidence: data.highestConfidence,
      matches: data.matches || [],
      model: data.model
    };
  } catch (err: any) {
    console.error('[AI Single Ticket Duplicate Check Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
    };
  }
}

export async function generateRetroSummary(
  items: any[],
  sessionTitle: string,
  sprintContext?: any,
  apiKey?: string
): Promise<{
  ok: boolean;
  summary?: {
    executiveSummary: string;
    moraleScore: number;
    moraleHealthCategory: string;
    keyThemes: Array<{ title: string; category: 'keep' | 'stop' | 'start'; summary: string }>;
    topStrengths: string[];
    criticalRisks: string[];
    recommendedActionItems: Array<{
      id: string;
      title: string;
      category: string;
      priority: 'high' | 'medium' | 'low';
      suggestedRole: string;
      rationale: string;
    }>;
    teamMantra: string;
  };
  model?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/ai/retro-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({ items, sessionTitle, sprintContext })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return {
      ok: true,
      summary: data.summary,
      model: data.model
    };
  } catch (err: any) {
    console.error('[AI Retro Summary Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
    };
  }
}



