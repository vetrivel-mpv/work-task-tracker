import { Defect, Priority, Severity, DefectStatus } from '../types';

export interface RiskTierConfig {
  id: 'critical_blocker' | 'high_risk' | 'moderate_debt' | 'low_backlog';
  label: string;
  shortLabel: string;
  description: string;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  glow: string;
  iconName: string;
  minScore: number;
}

export const RISK_TIERS: Record<string, RiskTierConfig> = {
  critical_blocker: {
    id: 'critical_blocker',
    label: 'Critical Release Blocker',
    shortLabel: 'Blocker',
    description: 'Catastrophic functional, security, or data integrity risk. Immediate hotfix required.',
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
    badgeBg: 'bg-red-500 text-white',
    glow: 'rgba(239, 68, 68, 0.25)',
    iconName: 'Flame',
    minScore: 12
  },
  high_risk: {
    id: 'high_risk',
    label: 'High Technical Debt',
    shortLabel: 'High Risk',
    description: 'Significant operational friction or major broken workflow. Fix before release candidate.',
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
    badgeBg: 'bg-orange-500 text-white',
    glow: 'rgba(249, 115, 22, 0.2)',
    iconName: 'AlertTriangle',
    minScore: 8
  },
  moderate_debt: {
    id: 'moderate_debt',
    label: 'Moderate Technical Debt',
    shortLabel: 'Moderate',
    description: 'Known edge cases and non-critical workflow defects. Planned sprint backlog.',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    badgeBg: 'bg-amber-500 text-white',
    glow: 'rgba(245, 158, 11, 0.15)',
    iconName: 'AlertCircle',
    minScore: 4
  },
  low_backlog: {
    id: 'low_backlog',
    label: 'Low Impact / Cosmetic Backlog',
    shortLabel: 'Low Backlog',
    description: 'Minor UI/UX inconsistencies, typos, or cosmetic polish. Minimal architectural debt.',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500 text-white',
    glow: 'rgba(16, 185, 129, 0.1)',
    iconName: 'CheckCircle2',
    minScore: 1
  }
};

/**
 * Resolves the effective priority for a defect if not explicitly provided.
 */
export function getDefectPriority(defect: Defect): Priority {
  if (defect.priority) return defect.priority;
  
  if (defect.slaPriority) {
    if (defect.slaPriority.includes('P1') || defect.slaPriority.toLowerCase().includes('critical')) {
      return 'critical';
    }
    if (defect.slaPriority.includes('P2') || defect.slaPriority.toLowerCase().includes('major')) {
      return 'high';
    }
    return 'medium';
  }

  // Fallback to defect severity
  if (defect.severity === 'critical') return 'critical';
  if (defect.severity === 'high') return 'high';
  if (defect.severity === 'medium') return 'medium';
  if (defect.severity === 'low') return 'low';

  return 'medium';
}

export function getSeverityWeight(severity: Severity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

export function getPriorityWeight(priority: Priority): number {
  switch (priority) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

export function getStatusMultiplier(status: DefectStatus): number {
  switch (status) {
    case 'New': return 1.0;
    case 'Active': return 1.0;
    case 'Retest': return 0.5;
    case 'Fixed': return 0.25;
    case 'Closed': return 0.0;
    default: return 1.0;
  }
}

/**
 * Calculates raw risk score for an individual defect (range 1 - 16).
 */
export function getDefectRiskScore(defect: Defect): number {
  const sevWeight = getSeverityWeight(defect.severity);
  const prioWeight = getPriorityWeight(getDefectPriority(defect));
  return sevWeight * prioWeight;
}

/**
 * Returns the categorical Risk Tier based on raw risk score.
 */
export function getDefectRiskTier(defect: Defect): RiskTierConfig {
  const score = getDefectRiskScore(defect);
  if (score >= 12) return RISK_TIERS.critical_blocker;
  if (score >= 8) return RISK_TIERS.high_risk;
  if (score >= 4) return RISK_TIERS.moderate_debt;
  return RISK_TIERS.low_backlog;
}

export interface MatrixCellData {
  severity: Severity;
  priority: Priority;
  score: number;
  tier: RiskTierConfig;
  defects: Defect[];
  activeCount: number;
  closedCount: number;
  totalCount: number;
}

export interface TechnicalDebtAnalysis {
  totalScore: number;
  maxPossibleScore: number;
  normalizedHealthScore: number; // 0 (terrible) to 100 (clean)
  debtGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeColor: string;
  tierCounts: {
    critical_blocker: number;
    high_risk: number;
    moderate_debt: number;
    low_backlog: number;
  };
  tierDefects: {
    critical_blocker: Defect[];
    high_risk: Defect[];
    moderate_debt: Defect[];
    low_backlog: Defect[];
  };
  estimatedRemediationHours: number;
  oldestBlockerDays: number;
  matrixGrid: MatrixCellData[][]; // 4 rows (severities) x 4 cols (priorities)
}

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
export const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

export const SEVERITY_LABELS: Record<Severity, { label: string; code: string; desc: string }> = {
  critical: { label: 'Critical', code: 'S1', desc: 'System outage / Data corruption' },
  high: { label: 'High', code: 'S2', desc: 'Major feature broken / No workaround' },
  medium: { label: 'Medium', code: 'S3', desc: 'Non-blocking defect / Workaround available' },
  low: { label: 'Low', code: 'S4', desc: 'Cosmetic / Minor UX inconsistency' }
};

export const PRIORITY_LABELS: Record<Priority, { label: string; code: string; desc: string }> = {
  critical: { label: 'Critical', code: 'P1', desc: 'Urgent hotfix / Release blocker' },
  high: { label: 'High', code: 'P2', desc: 'Fix before next milestone' },
  medium: { label: 'Medium', code: 'P3', desc: 'Standard sprint backlog' },
  low: { label: 'Low', code: 'P4', desc: 'Nice to have / Low urgency' }
};

/**
 * Computes full technical debt analysis & matrix grid.
 */
export function analyzeTechnicalDebt(
  defects: Defect[], 
  options?: { onlyActive?: boolean }
): TechnicalDebtAnalysis {
  const onlyActive = options?.onlyActive ?? true;
  const filtered = onlyActive ? defects.filter(d => d.status !== 'Closed') : defects;

  let totalScore = 0;
  let estimatedRemediationHours = 0;
  let oldestBlockerDays = 0;
  const now = new Date().getTime();

  const tierCounts = {
    critical_blocker: 0,
    high_risk: 0,
    moderate_debt: 0,
    low_backlog: 0
  };

  const tierDefects: {
    critical_blocker: Defect[];
    high_risk: Defect[];
    moderate_debt: Defect[];
    low_backlog: Defect[];
  } = {
    critical_blocker: [],
    high_risk: [],
    moderate_debt: [],
    low_backlog: []
  };

  filtered.forEach(d => {
    const rawScore = getDefectRiskScore(d);
    const multiplier = getStatusMultiplier(d.status);
    const weighted = rawScore * multiplier;
    totalScore += weighted;

    const tier = getDefectRiskTier(d);
    tierCounts[tier.id]++;
    tierDefects[tier.id].push(d);

    // Effort estimate: Critical=8h, High=5h, Medium=3h, Low=1h
    const sevHours = d.severity === 'critical' ? 8 : d.severity === 'high' ? 5 : d.severity === 'medium' ? 3 : 1;
    const prioMultiplier = getDefectPriority(d) === 'critical' ? 1.5 : getDefectPriority(d) === 'high' ? 1.2 : 1.0;
    estimatedRemediationHours += Math.round(sevHours * prioMultiplier * multiplier);

    // Blocker age
    if (tier.id === 'critical_blocker' && d.createdAt) {
      const createdTime = new Date(d.createdAt).getTime();
      if (!isNaN(createdTime)) {
        const days = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
        if (days > oldestBlockerDays) oldestBlockerDays = days;
      }
    }
  });

  // Calculate Health Grade
  // If no defects, grade is A (100)
  // For totalScore: 0 => 100, 10 => 90, 25 => 75, 50 => 60, >80 => <50
  const normalizedHealthScore = Math.max(0, Math.min(100, Math.round(100 - totalScore * 1.8)));

  let debtGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  let gradeColor = 'text-emerald-600 dark:text-emerald-400';

  if (normalizedHealthScore >= 90) {
    debtGrade = 'A';
    gradeColor = 'text-emerald-600 dark:text-emerald-400';
  } else if (normalizedHealthScore >= 75) {
    debtGrade = 'B';
    gradeColor = 'text-teal-600 dark:text-teal-400';
  } else if (normalizedHealthScore >= 60) {
    debtGrade = 'C';
    gradeColor = 'text-amber-600 dark:text-amber-400';
  } else if (normalizedHealthScore >= 40) {
    debtGrade = 'D';
    gradeColor = 'text-orange-600 dark:text-orange-400';
  } else {
    debtGrade = 'F';
    gradeColor = 'text-red-600 dark:text-red-400';
  }

  // Generate 4x4 matrix grid (Severity rows x Priority cols)
  const matrixGrid: MatrixCellData[][] = SEVERITIES.map(sev => {
    return PRIORITIES.map(prio => {
      const cellScore = getSeverityWeight(sev) * getPriorityWeight(prio);
      let tier = RISK_TIERS.low_backlog;
      if (cellScore >= 12) tier = RISK_TIERS.critical_blocker;
      else if (cellScore >= 8) tier = RISK_TIERS.high_risk;
      else if (cellScore >= 4) tier = RISK_TIERS.moderate_debt;

      const matchingDefects = defects.filter(d => {
        const dPrio = getDefectPriority(d);
        return d.severity === sev && dPrio === prio;
      });

      const activeCount = matchingDefects.filter(d => d.status !== 'Closed').length;
      const closedCount = matchingDefects.filter(d => d.status === 'Closed').length;

      return {
        severity: sev,
        priority: prio,
        score: cellScore,
        tier,
        defects: matchingDefects,
        activeCount,
        closedCount,
        totalCount: matchingDefects.length
      };
    });
  });

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    maxPossibleScore: defects.length * 16,
    normalizedHealthScore,
    debtGrade,
    gradeColor,
    tierCounts,
    tierDefects,
    estimatedRemediationHours,
    oldestBlockerDays,
    matrixGrid
  };
}
