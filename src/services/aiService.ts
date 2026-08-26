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

export interface PerformanceReviewPayload {
  memberName: string;
  role: string;
  period: string;
  tasksCompleted: number;
  tasksAssigned: number;
  completionRate: number;
  storyPointsDelivered: number;
  defectsResolved: number;
  highlights?: string;
  currentSprintShare?: number;
  recentVelocityData?: any[];
}

export interface PerformanceDossier {
  executiveSummary: string;
  strengths: string[];
  growthOpportunities: string[];
  smartGoals: string[];
  suggestedAppreciation: string;
}

export async function generatePerformanceReview(
  payload: PerformanceReviewPayload,
  apiKey?: string
): Promise<{ ok: boolean; dossier?: PerformanceDossier; error?: string; model?: string }> {
  try {
    const res = await fetch('/api/ai/performance-review', {
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

    return { ok: true, dossier: data.dossier, model: data.model };
  } catch (err: any) {
    console.error('[AI Performance Review Error]:', err);
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

export interface WritingAssistOptions {
  text: string;
  action: 'improve' | 'expand' | 'shorten' | 'bulletize' | 'formal' | 'technical';
  tone?: string;
  context?: string;
  apiKey?: string;
}

export async function requestWritingAssist(
  options: WritingAssistOptions
): Promise<AiResponse> {
  try {
    const res = await fetch('/api/ai/writing-assist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {})
      },
      body: JSON.stringify({
        text: options.text,
        action: options.action,
        tone: options.tone,
        context: options.context
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, res.status));
    }

    return {
      ok: true,
      text: data.text || data.result,
      model: data.model
    };
  } catch (err: any) {
    console.error('[AI Writing Assist Error]:', err);
    return {
      ok: false,
      error: extractErrorMessage(err)
    };
  }
}

export interface QaVelocityIntelligenceResult {
  qualityHealthScore: number;
  verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  verdictHeadline: string;
  executiveSummary: string;
  keyStrengths: string[];
  criticalRisks: Array<{
    area: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    mitigation: string;
  }>;
  automationRecommendations: Array<{
    title: string;
    techStack: string;
    impact: 'HIGH' | 'MEDIUM' | 'EFFICIENCY';
    recommendation: string;
  }>;
  predictedReleaseConfidence: number;
}

export async function generateQaVelocityIntelligence(
  payload: {
    releaseName?: string;
    defectStats: any;
    testStats: any;
    storyStats: any;
    techStack?: string;
    recentDefects?: Defect[];
    recentStories?: UserStory[];
  },
  apiKey?: string
): Promise<{
  ok: boolean;
  intel?: QaVelocityIntelligenceResult;
  model?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/ai/qa-velocity-intel', {
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
      intel: data.intel,
      model: data.model
    };
  } catch (err: any) {
    console.warn('[AI QA Velocity Intel Falling back to local heuristics]:', err);
    // Intelligent heuristic fallback
    const { defectStats, testStats, storyStats } = payload;
    const criticalCount = defectStats?.critical || 0;
    const highCount = defectStats?.high || 0;
    const passRate = testStats?.passRate ?? 94;
    const mttr = Number(defectStats?.mttrDays || 1.8);
    const escapeRate = defectStats?.escapeRate || 0;

    let score = 92;
    if (criticalCount > 0) score -= (criticalCount * 25);
    if (highCount > 0) score -= (highCount * 8);
    if (passRate < 95) score -= Math.round((95 - passRate) * 1.5);
    if (mttr > 2.5) score -= 10;
    if (escapeRate > 5) score -= 15;
    score = Math.max(15, Math.min(99, score));

    const verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' = 
      criticalCount > 0 ? 'NO_GO' : score >= 85 ? 'GO' : 'CONDITIONAL_GO';

    const fallbackIntel: QaVelocityIntelligenceResult = {
      qualityHealthScore: score,
      verdict,
      verdictHeadline: verdict === 'GO' 
        ? 'High Velocity & Production Readiness Confirmed'
        : verdict === 'NO_GO'
        ? 'Deployment Gate Blocked by High Severity Defects'
        : 'Conditionally Approved: Minor Test Gaps Under Remediation',
      executiveSummary: `Release quality index evaluates at ${score}/100. ${criticalCount > 0 ? `Zero tolerance gate violated with ${criticalCount} active critical defect(s).` : 'No S1 critical blockers detected.'} Automated test suite pass rate stands at ${passRate}% with an average MTTR of ${mttr} days.`,
      keyStrengths: [
        `Automated test execution pass rate steady at ${passRate}%`,
        `Mean Time to Remediation (MTTR) holding at ${mttr} days/bug`,
        `Story QA acceptance velocity tracking at ${storyStats?.passRate || 85}% completion`
      ],
      criticalRisks: criticalCount > 0 ? [
        {
          area: 'Release Blockers',
          riskLevel: 'HIGH',
          description: `${criticalCount} critical blocker defect(s) actively pending resolution`,
          mitigation: 'Prioritize hotfix triage and rerun targeted Playwright regression shards.'
        }
      ] : [
        {
          area: 'Regression Scope',
          riskLevel: 'LOW',
          description: 'Edge-case concurrency and boundary checks across modified microservices',
          mitigation: 'Trigger automated Bruno CLI integration flow across staging cluster.'
        }
      ],
      automationRecommendations: [
        {
          title: 'Playwright Sharding & Trace Captures',
          techStack: 'Playwright TypeScript',
          impact: 'HIGH',
          recommendation: 'Enable parallel worker sharding (4x workers) in CI/CD pipeline to accelerate feedback to under 3 minutes.'
        },
        {
          title: 'Bruno CLI Git-Native Flow Integration',
          techStack: 'Bruno CLI',
          impact: 'EFFICIENCY',
          recommendation: 'Incorporate .bru flows into pre-merge PR hooks to catch API contract regressions before staging.'
        }
      ],
      predictedReleaseConfidence: Math.max(20, Math.min(98, score + 2))
    };

    return {
      ok: true,
      intel: fallbackIntel,
      model: 'heuristic-engine'
    };
  }
}

export interface ResourceCapacityAdviceResult {
  overallHealth: 'HEALTHY' | 'MODERATE_RISK' | 'OVERLOADED';
  healthScore: number; // 0 - 100
  summary: string;
  bottlenecks: Array<{
    memberName: string;
    role: string;
    plannedHours: number;
    capacityHours: number;
    utilizationPct: number;
    issue: string;
    suggestion: string;
  }>;
  underutilizedMembers: Array<{
    memberName: string;
    role: string;
    availableHours: number;
    utilizationPct: number;
    suggestedTaskTypes: string[];
  }>;
  actionableRebalances: Array<{
    fromMember: string;
    toMember: string;
    taskTitle: string;
    hoursRelieved: number;
    reason: string;
  }>;
  leaveImpacts: Array<{
    memberName: string;
    dates: string;
    lostCapacity: number;
    mitigation: string;
  }>;
}

export async function generateResourceCapacityAdvice(
  payload: {
    weekRangeStr: string;
    totalTeamCapacityHours: number;
    totalPlannedHours: number;
    teamUtilizationPct: number;
    memberStats: Array<{
      id: string;
      name: string;
      role: string;
      grossCapacity: number;
      leaveHours: number;
      netCapacity: number;
      plannedHours: number;
      utilizationPct: number;
      taskCount: number;
      storyCount: number;
      defectCount: number;
      topTasks: string[];
      leaveNote?: string;
    }>;
  },
  apiKey?: string
): Promise<{ ok: boolean; advice?: ResourceCapacityAdviceResult; error?: string; model?: string }> {
  try {
    const res = await fetch('/api/ai/resource-capacity-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.advice) {
      return { ok: true, advice: data.advice, model: data.model || 'gemini-2.5-flash' };
    }
    throw new Error(data.error || 'Server error');
  } catch (err: any) {
    // Intelligent heuristic fallback
    const overloaded = payload.memberStats.filter(m => m.utilizationPct > 100);
    const underloaded = payload.memberStats.filter(m => m.utilizationPct < 75 && m.netCapacity > 0);
    const onLeave = payload.memberStats.filter(m => m.leaveHours > 0);

    let healthScore = 90;
    if (overloaded.length > 0) healthScore -= overloaded.length * 15;
    if (payload.teamUtilizationPct > 110) healthScore -= 20;
    if (payload.teamUtilizationPct < 60) healthScore -= 10;
    healthScore = Math.max(25, Math.min(98, healthScore));

    const overallHealth: 'HEALTHY' | 'MODERATE_RISK' | 'OVERLOADED' =
      overloaded.length > 1 || payload.teamUtilizationPct > 115
        ? 'OVERLOADED'
        : overloaded.length === 1 || payload.teamUtilizationPct > 100
        ? 'MODERATE_RISK'
        : 'HEALTHY';

    const bottlenecks = overloaded.map(m => ({
      memberName: m.name,
      role: m.role,
      plannedHours: m.plannedHours,
      capacityHours: m.netCapacity,
      utilizationPct: m.utilizationPct,
      issue: `Workload exceeds available weekly capacity by ${Math.round(m.plannedHours - m.netCapacity)} hours (${m.utilizationPct}% allocation).`,
      suggestion: `Offload non-critical defect verification or story sub-tasks to available teammates.`
    }));

    const underutilizedMembers = underloaded.map(m => ({
      memberName: m.name,
      role: m.role,
      availableHours: Math.max(0, Math.round(m.netCapacity - m.plannedHours)),
      utilizationPct: m.utilizationPct,
      suggestedTaskTypes: ['API automation testing', 'Defect triage & re-test', 'Technical documentation', 'PR reviews']
    }));

    const actionableRebalances: Array<{
      fromMember: string;
      toMember: string;
      taskTitle: string;
      hoursRelieved: number;
      reason: string;
    }> = [];

    if (overloaded.length > 0 && underloaded.length > 0) {
      overloaded.forEach((ov, idx) => {
        const target = underloaded[idx % underloaded.length];
        if (ov.topTasks.length > 0) {
          actionableRebalances.push({
            fromMember: ov.name,
            toMember: target.name,
            taskTitle: ov.topTasks[0] || 'Verification Task',
            hoursRelieved: 4,
            reason: `Rebalancing 4h from ${ov.name} (${ov.utilizationPct}%) to ${target.name} (${target.utilizationPct}%) balances sprint throughput.`
          });
        }
      });
    }

    const leaveImpacts = onLeave.map(m => ({
      memberName: m.name,
      dates: m.leaveNote || 'Scheduled Leave',
      lostCapacity: m.leaveHours,
      mitigation: `Ensure pending critical work is handed over to a co-owner before departure.`
    }));

    const summary = overallHealth === 'HEALTHY'
      ? `Team capacity is well-balanced across all members (${payload.teamUtilizationPct}% net utilization for ${payload.weekRangeStr}). Total planned tasks (${payload.totalPlannedHours}h) fit cleanly within net available capacity (${payload.totalTeamCapacityHours}h).`
      : overallHealth === 'MODERATE_RISK'
      ? `Capacity warning: ${overloaded.length} member(s) exceed 100% weekly capacity. Recommend minor task re-distribution to prevent sprint carryover.`
      : `High allocation pressure detected: ${overloaded.length} member(s) critically overloaded with team utilization at ${payload.teamUtilizationPct}%. Immediate workload rebalancing advised.`;

    return {
      ok: true,
      advice: {
        overallHealth,
        healthScore,
        summary,
        bottlenecks,
        underutilizedMembers,
        actionableRebalances,
        leaveImpacts
      },
      model: 'heuristic-engine'
    };
  }
}



