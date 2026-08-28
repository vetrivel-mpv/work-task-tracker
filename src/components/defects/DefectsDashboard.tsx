import React, { useState, useMemo } from 'react';
import { Defect, Release, UserStory, TeamMember, TestCase, AppState } from '../../types';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  CartesianGrid,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  Flame, 
  ShieldAlert, 
  Download, 
  Mail,
  TrendingUp,
  Layers,
  Activity,
  Rocket,
  Gauge,
  BookOpen,
  Cpu,
  ShieldCheck,
  Sparkles,
  Zap,
  SlidersHorizontal,
  FileCode,
  Clock,
  UserX,
  Filter,
  X,
  Search,
  ExternalLink,
  Tag,
  UserCheck
} from 'lucide-react';
import { buildQaStatusReport } from '../../services/emailService';
import { matchesReleaseOrIteration, formatReleaseDisplayName } from '../../utils/adoPaths';
import { getWorkItemAssignee, isUnassignedValue } from '../../utils/assigneeUtils';
import { toDateStr, fromDateStr, shiftDate, formatDisplayDate } from '../../utils/date';
import { DefectImpactMatrix } from './DefectImpactMatrix';
import { TechnicalDebtImpactModal } from './TechnicalDebtImpactModal';
import { QeVelocityWidgets } from './QeVelocityWidgets';
import { QeProcessPlaybook } from './QeProcessPlaybook';
import { QaTechStackSimulator } from './QaTechStackSimulator';
import { ReleaseQualityGates } from './ReleaseQualityGates';
import { QaAiCopilot } from './QaAiCopilot';

interface DefectsDashboardProps {
  defects: Defect[];
  releases: Release[];
  userStories: UserStory[];
  testCases?: TestCase[];
  team: TeamMember[];
  state: AppState;
  selectedReleaseId?: string | null;
  onOpenQaStatusEmail: () => void;
}

const SEVERITY_COLORS: { [key: string]: string } = {
  critical: '#9B1D32',
  high: '#B42318',
  medium: '#D97706',
  low: '#0F6E62'
};

const STATUS_COLORS: { [key: string]: string } = {
  New: '#84918A',
  Active: '#B42318',
  Fixed: '#0284C7',
  Retest: '#7C3AED',
  Closed: '#0C6E5E'
};

type DefectQuickFilter = 'all' | 'critical' | 'overdue' | 'unassigned';

function isDefectCritical(d: Defect): boolean {
  return d.severity === 'critical' || d.priority === 'critical';
}

function isDefectOverdue(d: Defect, releases: Release[] = [], refDate?: string): boolean {
  if (d.status === 'Closed') return false;
  const ref = refDate || toDateStr(new Date());

  // 1. Explicit SLA Deadline
  if (d.slaDeadline && d.slaDeadline < ref) {
    return true;
  }

  // 2. Release Target Date passed for open defect
  if (d.releaseId) {
    const rel = releases.find(r => r.id === d.releaseId);
    if (rel && rel.targetDate && rel.targetDate < ref && rel.status !== 'Archived') {
      return true;
    }
  }

  // 3. Aging > 14 days for open defect without target
  if (d.createdAt) {
    const createdStr = d.createdAt.slice(0, 10);
    if (createdStr && createdStr < shiftDate(ref, -14)) {
      return true;
    }
  }

  return false;
}

function isDefectUnassigned(d: Defect, team: TeamMember[] = []): boolean {
  if (!d.assigneeId && !d.assigneeName) return true;
  if (isUnassignedValue(d.assigneeId) && isUnassignedValue(d.assigneeName)) return true;
  const assignee = getWorkItemAssignee(d, team);
  return !assignee && isUnassignedValue(d.assigneeName);
}

export const DefectsDashboard: React.FC<DefectsDashboardProps> = ({
  defects,
  releases,
  userStories,
  testCases = [],
  team,
  state,
  selectedReleaseId,
  onOpenQaStatusEmail
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'velocity' | 'tech_stack' | 'quality_gates' | 'ai_copilot' | 'playbook'>('analytics');
  const [isTechDebtModalOpen, setIsTechDebtModalOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<DefectQuickFilter>('all');
  const [quickSearch, setQuickSearch] = useState<string>('');

  const refDate = state?.dateStr || toDateStr(new Date());

  // Scoped datasets based on global top header release selector
  const activeRelease = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return null;
    return releases.find(r => r.id === selectedReleaseId);
  }, [releases, selectedReleaseId]);

  const activeDefects = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return defects;
    return defects.filter(d => matchesReleaseOrIteration(d, selectedReleaseId, releases));
  }, [defects, selectedReleaseId, releases]);

  const activeStories = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return userStories;
    return userStories.filter(s => matchesReleaseOrIteration(s, selectedReleaseId, releases));
  }, [userStories, selectedReleaseId, releases]);

  const activeTestCases = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return testCases;
    return testCases.filter(t => matchesReleaseOrIteration(t, selectedReleaseId, releases));
  }, [testCases, selectedReleaseId, releases]);

  // Quick Filter Slices and Counts
  const criticalDefectsList = useMemo(() => {
    return activeDefects.filter(isDefectCritical);
  }, [activeDefects]);

  const overdueDefectsList = useMemo(() => {
    return activeDefects.filter(d => isDefectOverdue(d, releases, refDate));
  }, [activeDefects, releases, refDate]);

  const unassignedDefectsList = useMemo(() => {
    return activeDefects.filter(d => isDefectUnassigned(d, team));
  }, [activeDefects, team]);

  // Filtered defects for active quick filter
  const displayedDefects = useMemo(() => {
    let list = activeDefects;
    if (quickFilter === 'critical') {
      list = criticalDefectsList;
    } else if (quickFilter === 'overdue') {
      list = overdueDefectsList;
    } else if (quickFilter === 'unassigned') {
      list = unassignedDefectsList;
    }

    if (quickSearch.trim()) {
      const q = quickSearch.toLowerCase();
      list = list.filter(d => 
        d.title.toLowerCase().includes(q) ||
        (d.adoId && String(d.adoId).includes(q)) ||
        (d.assigneeName && d.assigneeName.toLowerCase().includes(q)) ||
        (d.areaPath && d.areaPath.toLowerCase().includes(q)) ||
        (d.environment && d.environment.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeDefects, quickFilter, criticalDefectsList, overdueDefectsList, unassignedDefectsList, quickSearch]);

  // Toggle quick filter handler
  const toggleQuickFilter = (filter: DefectQuickFilter) => {
    setQuickFilter(prev => prev === filter ? 'all' : filter);
  };

  // KPI Calculations (reacts to quick filter)
  const totalDefects = displayedDefects.length;
  const criticalCount = displayedDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const highCount = displayedDefects.filter(d => d.severity === 'high' && d.status !== 'Closed').length;
  const closedDefects = displayedDefects.filter(d => d.status === 'Closed').length;
  const resolutionRate = totalDefects > 0 ? Math.round((closedDefects / totalDefects) * 100) : 0;
  
  const totalStories = activeStories.length;
  const passedStories = activeStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
  const qaPassRate = totalStories > 0 ? Math.round((passedStories / totalStories) * 100) : 0;

  // Chart Data: Severity
  const severityData = [
    { name: 'Critical', value: displayedDefects.filter(d => d.severity === 'critical').length, key: 'critical' },
    { name: 'High', value: displayedDefects.filter(d => d.severity === 'high').length, key: 'high' },
    { name: 'Medium', value: displayedDefects.filter(d => d.severity === 'medium').length, key: 'medium' },
    { name: 'Low', value: displayedDefects.filter(d => d.severity === 'low').length, key: 'low' }
  ].filter(d => d.value > 0);

  // Chart Data: Status
  const statusData = ['New', 'Active', 'Fixed', 'Retest', 'Closed'].map(st => ({
    name: st,
    count: displayedDefects.filter(d => d.status === st).length,
    fill: STATUS_COLORS[st]
  }));

  // Chart Data: Release breakdown
  const releaseData = releases.map(rel => {
    const relBugs = displayedDefects.filter(d => matchesReleaseOrIteration(d, rel.id, releases));
    return {
      name: rel.name.split('-')[0].trim().slice(0, 14),
      open: relBugs.filter(d => d.status !== 'Closed').length,
      closed: relBugs.filter(d => d.status === 'Closed').length
    };
  });

  // Trend View Mode: 'cumulative' (Trajectory) vs 'daily' (Daily Inflow/Outflow)
  const [trendViewMode, setTrendViewMode] = useState<'cumulative' | 'daily'>('cumulative');

  // Helper to safely parse dates from ISO/string
  const parseDateOnly = (val?: string | null): string => {
    if (!val || typeof val !== 'string') return '';
    if (val.length >= 10 && val[4] === '-' && val[7] === '-') {
      return val.slice(0, 10);
    }
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return toDateStr(d);
      }
    } catch {
      // fallback
    }
    return '';
  };

  // 30-day Trend Data of Open vs Closed Defects
  const trend30DaysData = useMemo(() => {
    const data: Array<{
      dateStr: string;
      displayDate: string;
      open: number;
      closed: number;
      newCreated: number;
      newClosed: number;
    }> = [];

    // Loop through 30 days window up to refDate
    for (let i = 29; i >= 0; i--) {
      const dStr = shiftDate(refDate, -i);
      const dateObj = fromDateStr(dStr);
      const displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let openCount = 0;
      let closedCount = 0;
      let newCreatedCount = 0;
      let newClosedCount = 0;

      displayedDefects.forEach(defect => {
        const createdDate = parseDateOnly(defect.createdAt) || (refDate ? shiftDate(refDate, -15) : '2026-08-01');
        const isClosed = defect.status === 'Closed';
        const closedDate = isClosed ? (parseDateOnly(defect.closedAt) || parseDateOnly(defect.updatedAt) || createdDate) : '';

        const createdByThisDay = createdDate <= dStr;
        const closedByThisDay = isClosed && Boolean(closedDate && closedDate <= dStr);

        if (createdByThisDay) {
          if (closedByThisDay) {
            closedCount++;
          } else {
            openCount++;
          }
        }

        if (createdDate === dStr) {
          newCreatedCount++;
        }
        if (isClosed && closedDate === dStr) {
          newClosedCount++;
        }
      });

      data.push({
        dateStr: dStr,
        displayDate,
        open: openCount,
        closed: closedCount,
        newCreated: newCreatedCount,
        newClosed: newClosedCount
      });
    }

    return data;
  }, [displayedDefects, refDate]);

  // 30-Day Trend Summary Statistics
  const trendSummary = useMemo(() => {
    const total30dCreated = trend30DaysData.reduce((acc, curr) => acc + curr.newCreated, 0);
    const total30dClosed = trend30DaysData.reduce((acc, curr) => acc + curr.newClosed, 0);
    const latestDay = trend30DaysData[trend30DaysData.length - 1] || { open: 0, closed: 0 };
    const firstDay = trend30DaysData[0] || { open: 0, closed: 0 };
    const openDelta = latestDay.open - firstDay.open;

    return {
      total30dCreated,
      total30dClosed,
      currentOpen: latestDay.open,
      currentClosed: latestDay.closed,
      openDelta,
      netContainment: total30dCreated > 0 ? Math.round((total30dClosed / total30dCreated) * 100) : 100
    };
  }, [trend30DaysData]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                QA Delivery Analytics & Velocity Intelligence
                {activeRelease && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                    <Rocket size={12} />
                    {formatReleaseDisplayName(activeRelease.name, activeRelease.releaseNumber)}
                  </span>
                )}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                Defect containment, Playwright/Bruno sharded execution velocity, quality gates, and AI risk prediction
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsTechDebtModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--surface)] hover:text-[var(--primary)] border border-[var(--border)] hover:border-red-500/40 rounded-xl shadow-xs transition-all cursor-pointer"
            id="open-tech-debt-modal-from-dashboard-btn"
            title="Open Technical Debt & Impact Matrix in popup window"
          >
            <ShieldAlert size={14} className="text-red-600 dark:text-red-400" />
            <span>Tech Debt Matrix</span>
          </button>

          <button
            onClick={onOpenQaStatusEmail}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Mail size={14} />
            <span>Broadcast QA Report</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Bar */}
      <div 
        id="defects-dashboard-quick-filter-bar" 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-all"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1">
            <SlidersHorizontal size={14} className="text-[var(--primary)]" />
            <span>Quick Filters:</span>
          </div>

          {/* All Defects */}
          <button
            onClick={() => setQuickFilter('all')}
            id="quick-filter-all-btn"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              quickFilter === 'all'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            <span>All Defects</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              quickFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--border)] text-[var(--text-secondary)]'
            }`}>
              {activeDefects.length}
            </span>
          </button>

          {/* Show Critical Only */}
          <button
            onClick={() => toggleQuickFilter('critical')}
            id="quick-filter-critical-btn"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              quickFilter === 'critical'
                ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-500/30 font-extrabold'
                : 'bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 border border-red-500/20'
            }`}
            title="Toggle Show Critical Only (Critical severity or P1 priority)"
          >
            <Flame size={13} className={quickFilter === 'critical' ? 'text-white' : 'text-red-500'} />
            <span>Show Critical Only</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              quickFilter === 'critical' ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-700 dark:text-red-300'
            }`}>
              {criticalDefectsList.length}
            </span>
          </button>

          {/* Show Overdue */}
          <button
            onClick={() => toggleQuickFilter('overdue')}
            id="quick-filter-overdue-btn"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              quickFilter === 'overdue'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/30 font-extrabold'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
            }`}
            title="Toggle Show Overdue (SLA expired, past release target, or aging >14d)"
          >
            <Clock size={13} className={quickFilter === 'overdue' ? 'text-white' : 'text-amber-500'} />
            <span>Show Overdue</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              quickFilter === 'overdue' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}>
              {overdueDefectsList.length}
            </span>
          </button>

          {/* Show Unassigned */}
          <button
            onClick={() => toggleQuickFilter('unassigned')}
            id="quick-filter-unassigned-btn"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              quickFilter === 'unassigned'
                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/30 font-extrabold'
                : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20'
            }`}
            title="Toggle Show Unassigned (No designated owner)"
          >
            <UserX size={13} className={quickFilter === 'unassigned' ? 'text-white' : 'text-indigo-500'} />
            <span>Show Unassigned</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              quickFilter === 'unassigned' ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
            }`}>
              {unassignedDefectsList.length}
            </span>
          </button>
        </div>

        {/* Active Filter Summary and Clear Action */}
        {quickFilter !== 'all' && (
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Active View: <strong className="text-[var(--text-primary)]">{
                quickFilter === 'critical' ? 'Critical Only' : quickFilter === 'overdue' ? 'Overdue' : 'Unassigned'
              }</strong> ({displayedDefects.length} {displayedDefects.length === 1 ? 'defect' : 'defects'})
            </span>
            <button
              onClick={() => { setQuickFilter('all'); setQuickSearch(''); }}
              id="clear-quick-filter-btn"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] hover:text-red-600 dark:hover:text-red-400 bg-[var(--surface-hover)] hover:bg-red-500/10 rounded-lg border border-[var(--border)] transition-all cursor-pointer"
              title="Clear active quick filter"
            >
              <X size={12} />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-tab Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-x-auto shadow-xs">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[var(--primary)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <BarChart3 size={15} />
          <span>QA Analytics & Defects</span>
          {quickFilter !== 'all' && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
              {displayedDefects.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('velocity')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'velocity'
              ? 'bg-[var(--primary)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <Gauge size={15} />
          <span>QE Velocity & DORA</span>
        </button>

        <button
          onClick={() => setActiveTab('tech_stack')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'tech_stack'
              ? 'bg-[var(--primary)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <Cpu size={15} />
          <span>Tech Stack & Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('quality_gates')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'quality_gates'
              ? 'bg-[var(--primary)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <ShieldCheck size={15} />
          <span>Release Quality Gates</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_copilot')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'ai_copilot'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
          }`}
        >
          <Sparkles size={15} />
          <span>AI QA Copilot</span>
        </button>

        <button
          onClick={() => setActiveTab('playbook')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'playbook'
              ? 'bg-[var(--primary)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <BookOpen size={15} />
          <span>SDET Playbook</span>
        </button>
      </div>

      {/* Tab: QE Velocity & DORA Quality */}
      {activeTab === 'velocity' && (
        <QeVelocityWidgets
          defects={displayedDefects}
          testCases={activeTestCases}
          userStories={activeStories}
          selectedRelease={activeRelease}
        />
      )}

      {/* Tab: Latest Tech Stack & Parallel Simulator */}
      {activeTab === 'tech_stack' && (
        <QaTechStackSimulator
          totalTestCases={activeTestCases.length || testCases.length || 85}
          automatedCount={activeTestCases.filter(t => t.automationStatus === 'Automated').length || 64}
          releaseName={activeRelease ? formatReleaseDisplayName(activeRelease.name, activeRelease.releaseNumber) : 'Current Release'}
        />
      )}

      {/* Tab: Release Quality Gates & Go/No-Go Decision Engine */}
      {activeTab === 'quality_gates' && (
        <ReleaseQualityGates
          defects={displayedDefects}
          releases={releases}
          userStories={activeStories}
          testCases={activeTestCases}
          team={team}
          selectedRelease={activeRelease}
          onOpenQaStatusEmail={onOpenQaStatusEmail}
        />
      )}

      {/* Tab: AI QA Velocity Copilot */}
      {activeTab === 'ai_copilot' && (
        <QaAiCopilot
          defects={displayedDefects}
          releases={releases}
          userStories={activeStories}
          testCases={activeTestCases}
          selectedRelease={activeRelease}
        />
      )}

      {/* Tab: SDET Playbook */}
      {activeTab === 'playbook' && (
        <QeProcessPlaybook />
      )}

      {/* Tab: QA Analytics & Defects Core */}
      {activeTab === 'analytics' && (
        <>
          {/* Top Level KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>{quickFilter !== 'all' ? 'Filtered Defects' : 'Total Logged Defects'}</span>
                <BarChart3 size={16} className="text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] mt-2">{totalDefects}</div>
              <div className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                {closedDefects} closed &bull; {totalDefects - closedDefects} active
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--critical)] uppercase tracking-wider">
                <span>Active Critical Blockers</span>
                <Flame size={16} className="text-[var(--critical)]" />
              </div>
              <div className="text-2xl font-black text-[var(--critical)] mt-2">{criticalCount}</div>
              <div className="text-xs text-[var(--critical)] font-semibold mt-1">
                {highCount} high severity open
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>Defect Resolution Rate</span>
                <CheckCircle2 size={16} className="text-[var(--low)]" />
              </div>
              <div className="text-2xl font-black text-[var(--low)] mt-2">{resolutionRate}%</div>
              <div className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                Target: &gt;85% for Staging cut
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>User Story QA Pass</span>
                <TrendingUp size={16} className="text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-black text-[var(--primary)] mt-2">{qaPassRate}%</div>
              <div className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                {passedStories}/{totalStories} stories verified
              </div>
            </div>
          </div>

          {/* Quick Filter Focus Tray (shown when quickFilter !== 'all') */}
          {quickFilter !== 'all' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${
                    quickFilter === 'critical' 
                      ? 'bg-red-500/10 text-red-600' 
                      : quickFilter === 'overdue' 
                      ? 'bg-amber-500/10 text-amber-600' 
                      : 'bg-indigo-500/10 text-indigo-600'
                  }`}>
                    {quickFilter === 'critical' && <Flame size={18} />}
                    {quickFilter === 'overdue' && <Clock size={18} />}
                    {quickFilter === 'unassigned' && <UserX size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {quickFilter === 'critical' && 'Critical & Blocker Defects'}
                      {quickFilter === 'overdue' && 'Overdue & SLA-At-Risk Defects'}
                      {quickFilter === 'unassigned' && 'Unassigned Defects Requiring Ownership'}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {displayedDefects.length} {displayedDefects.length === 1 ? 'item' : 'items'} matching current filter view
                    </p>
                  </div>
                </div>

                {/* In-tray Search */}
                <div className="relative min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="Search within filtered results..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--primary)]"
                  />
                  {quickSearch && (
                    <button
                      onClick={() => setQuickSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtered Defects List / Cards */}
              {displayedDefects.length === 0 ? (
                <div className="py-8 text-center bg-[var(--surface-hover)]/40 rounded-xl border border-dashed border-[var(--border)]">
                  <CheckCircle2 size={32} className="mx-auto text-[var(--low)] mb-2" />
                  <p className="text-xs font-bold text-[var(--text-primary)]">No matching defects found</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {quickSearch ? 'Try adjusting your search query.' : 'Zero defects match the selected filter condition.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedDefects.slice(0, 12).map((d) => {
                    const assignee = getWorkItemAssignee(d, team);
                    const isCrit = isDefectCritical(d);
                    const isOver = isDefectOverdue(d, releases, refDate);
                    const isUnassign = isDefectUnassigned(d, team);

                    return (
                      <div 
                        key={d.id}
                        className="p-3.5 bg-[var(--surface-hover)]/60 hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl flex flex-col justify-between gap-3 transition-all"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--primary)] border border-[var(--border)]">
                                {d.adoId ? `ADO #${d.adoId}` : d.id.slice(0, 8)}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                d.severity === 'critical' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                                d.severity === 'high' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                                d.severity === 'medium' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {d.severity.toUpperCase()}
                              </span>
                            </div>

                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              d.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-600' :
                              d.status === 'Active' ? 'bg-red-500/10 text-red-600' :
                              d.status === 'Fixed' ? 'bg-blue-500/10 text-blue-600' :
                              d.status === 'Retest' ? 'bg-purple-500/10 text-purple-600' :
                              'bg-zinc-500/10 text-zinc-600'
                            }`}>
                              {d.status}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2 mt-1">
                            {d.title}
                          </h4>
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]/60 text-[11px]">
                          {/* Assignee */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[var(--text-muted)] text-[10px] font-semibold">Assignee:</span>
                            {assignee ? (
                              <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                                <span 
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                  style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                                >
                                  {assignee.avatarInitials || assignee.name.slice(0, 1)}
                                </span>
                                <span className="truncate max-w-[120px]">{assignee.name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                                <UserX size={12} />
                                <span>Unassigned</span>
                              </span>
                            )}
                          </div>

                          {/* Overdue/SLA badge */}
                          {isOver && (
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                              <Clock size={10} />
                              <span>
                                {d.slaDeadline 
                                  ? `SLA expired (${formatDisplayDate(d.slaDeadline)})` 
                                  : 'Overdue resolution target'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {displayedDefects.length > 12 && (
                <p className="text-center text-[11px] text-[var(--text-muted)] font-medium">
                  Showing top 12 of {displayedDefects.length} filtered defects.
                </p>
              )}
            </div>
          )}

          {/* Visual Impact Matrix (Technical Debt Visualizer) */}
          <DefectImpactMatrix
            defects={displayedDefects}
            releases={releases}
            team={team}
            selectedReleaseId={selectedReleaseId}
          />

          {/* 30-Day Defect Velocity & Containment Trend Line Chart */}
          <div 
            id="defects-30-day-trend-chart-card"
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-4"
          >
            {/* Chart Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span>30-Day Defect Velocity & Containment Trend</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                      Last 30 Days
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Progression of 'Open' vs 'Closed' defects based on creation and closure timelines
                  </p>
                </div>
              </div>

              {/* KPI Badges & Mode Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Active Open Pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>{trendSummary.currentOpen} Open</span>
                </div>

                {/* Closed Pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  <span>{trendSummary.currentClosed} Closed</span>
                </div>

                {/* 30-day Net Flow */}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)]">
                  <span>30d Activity:</span>
                  <span className="font-bold text-red-500 font-mono">+{trendSummary.total30dCreated}</span>
                  <span className="text-[var(--text-muted)]">/</span>
                  <span className="font-bold text-emerald-600 font-mono">-{trendSummary.total30dClosed}</span>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center p-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTrendViewMode('cumulative')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      trendViewMode === 'cumulative'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Open vs Closed
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendViewMode('daily')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      trendViewMode === 'daily'
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Daily Activity
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts LineChart */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trend30DaysData}
                  margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="var(--text-muted)" 
                    fontSize={11} 
                    interval={3}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    fontSize={11} 
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    content={(props: any) => {
                      const { active, payload } = props;
                      if (active && payload && payload.length) {
                        const dataPoint = payload[0].payload;
                        return (
                          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-lg text-xs min-w-[210px] flex flex-col gap-2 z-50">
                            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 font-bold text-[var(--text-primary)]">
                              <div className="flex items-center gap-1.5">
                                <Activity size={13} className="text-[var(--primary)]" />
                                <span>{dataPoint.displayDate}</span>
                              </div>
                              <span className="font-mono text-[10.5px] text-[var(--text-muted)]">{dataPoint.dateStr}</span>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shrink-0" />
                                  <span>{trendViewMode === 'cumulative' ? 'Active Open Defects:' : 'New Logged:'}</span>
                                </span>
                                <span className="font-bold font-mono text-[#DC2626] text-sm">
                                  {trendViewMode === 'cumulative' ? dataPoint.open : `+${dataPoint.newCreated}`}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                                  <span>{trendViewMode === 'cumulative' ? 'Cumulative Closed:' : 'New Resolved:'}</span>
                                </span>
                                <span className="font-bold font-mono text-[#16A34A] text-sm">
                                  {trendViewMode === 'cumulative' ? dataPoint.closed : `+${dataPoint.newClosed}`}
                                </span>
                              </div>

                              <div className="mt-1 pt-1.5 border-t border-[var(--border)] flex items-center justify-between text-[10.5px] text-[var(--text-muted)] font-medium">
                                <span>Day Activity:</span>
                                <span className="flex items-center gap-1.5 font-mono">
                                  <span className="text-red-500 font-semibold">+{dataPoint.newCreated}</span>
                                  <span>/</span>
                                  <span className="text-emerald-500 font-semibold">+{dataPoint.newClosed}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: 600 }}
                  />
                  
                  {trendViewMode === 'cumulative' ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="open"
                        name="Open Defects (Active)"
                        stroke="#DC2626"
                        strokeWidth={2.5}
                        dot={{ r: 2, fill: '#DC2626' }}
                        activeDot={{ r: 5, fill: '#DC2626', stroke: 'var(--surface)', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="closed"
                        name="Closed Defects (Resolved)"
                        stroke="#16A34A"
                        strokeWidth={2.5}
                        dot={{ r: 2, fill: '#16A34A' }}
                        activeDot={{ r: 5, fill: '#16A34A', stroke: 'var(--surface)', strokeWidth: 2 }}
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey="newCreated"
                        name="New Defects Opened"
                        stroke="#DC2626"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={{ r: 2.5, fill: '#DC2626' }}
                        activeDot={{ r: 5, fill: '#DC2626', stroke: 'var(--surface)', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="newClosed"
                        name="Defects Resolved / Closed"
                        stroke="#16A34A"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: '#16A34A' }}
                        activeDot={{ r: 5, fill: '#16A34A', stroke: 'var(--surface)', strokeWidth: 2 }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Insight Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-primary)]">30-Day Defect Containment:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {trendSummary.netContainment}%
                </span>
                <span className="text-[var(--text-muted)]">
                  ({trendSummary.total30dClosed} resolved of {trendSummary.total30dCreated} newly reported)
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                <span>Window: {trend30DaysData[0]?.displayDate} &mdash; {trend30DaysData[trend30DaysData.length - 1]?.displayDate}</span>
              </div>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity Distribution Donut */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
                Defects by Severity {quickFilter !== 'all' && `(${quickFilter.toUpperCase()})`}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
                Defect Pipeline Distribution {quickFilter !== 'all' && `(${quickFilter.toUpperCase()})`}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <XAxis dataKey="name" fontSize={11} stroke="var(--text-muted)" />
                    <YAxis fontSize={11} allowDecimals={false} stroke="var(--text-muted)" />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Defects by Release Comparison */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Release Scope & Bug Burn-down</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={releaseData}>
                  <XAxis dataKey="name" fontSize={11} stroke="var(--text-muted)" />
                  <YAxis fontSize={11} allowDecimals={false} stroke="var(--text-muted)" />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="open" name="Active Bugs" fill="#B42318" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="closed" name="Resolved Bugs" fill="var(--low)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Technical Debt & Impact Matrix Full Popup Window */}
      <TechnicalDebtImpactModal
        isOpen={isTechDebtModalOpen}
        onClose={() => setIsTechDebtModalOpen(false)}
        defects={displayedDefects}
        releases={releases}
        team={team}
        selectedReleaseId={selectedReleaseId}
      />
    </div>
  );
};

