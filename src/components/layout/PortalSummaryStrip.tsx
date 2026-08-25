import React from 'react';
import { 
  AppView, 
  AppState 
} from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  Bug, 
  FileCheck2, 
  BookOpen, 
  Rocket, 
  Users, 
  Sparkles,
  FolderGit2,
  Target,
  X,
  MessageSquareQuote,
  Zap
} from 'lucide-react';

interface PortalSummaryStripProps {
  activeView: AppView;
  state: AppState;
  currentDateStr: string;
  searchQuery: string;
  onClearSearch: () => void;
  selectedReleaseId: string | null;
  onClearReleaseFilter: () => void;
}

export const PortalSummaryStrip: React.FC<PortalSummaryStripProps> = ({
  activeView,
  state,
  currentDateStr,
  searchQuery,
  onClearSearch,
  selectedReleaseId,
  onClearReleaseFilter
}) => {
  // Calculations
  const tasksForDay = (state.tasks || []).filter(t => t.dateStr === currentDateStr);
  const completedTasks = tasksForDay.filter(t => t.status === 'complete').length;
  const pendingTasks = tasksForDay.length - completedTasks;
  const progressPercent = tasksForDay.length > 0 ? Math.round((completedTasks / tasksForDay.length) * 100) : 0;

  const totalStories = (state.userStories || []).length;
  const doneStories = (state.userStories || []).filter(s => s.status === 'Done' || s.status === 'QA Passed').length;

  const totalTestCases = (state.testCases || []).length;
  const passedTestCases = (state.testCases || []).filter(tc => tc.status === 'Passed').length;
  const testPassRate = totalTestCases > 0 ? Math.round((passedTestCases / totalTestCases) * 100) : 0;

  const openDefects = (state.defects || []).filter(d => d.status !== 'Closed');
  const criticalDefects = openDefects.filter(d => d.severity === 'critical' || d.severity === 'high').length;

  const selectedRelease = (state.releases || []).find(r => r.id === selectedReleaseId);

  // View title & metadata descriptor mapping
  const viewMeta: Record<string, { title: string; subtitle: string; icon: any }> = {
    board: {
      title: 'Daily Execution & Workstream Board',
      subtitle: `Target date: ${currentDateStr} • ${tasksForDay.length} planned items (${completedTasks} completed)`,
      icon: CheckCircle2
    },
    stories: {
      title: 'User Stories & Sprint Scope Backlog',
      subtitle: `${totalStories} mapped deliverables • ${doneStories} finalized & passed QA`,
      icon: BookOpen
    },
    userStories: {
      title: 'User Stories & Sprint Scope Backlog',
      subtitle: `${totalStories} mapped deliverables • ${doneStories} finalized & passed QA`,
      icon: BookOpen
    },
    testCases: {
      title: 'Test Repository & QA Validation Matrix',
      subtitle: `${totalTestCases} formal test specifications • ${testPassRate}% execution pass rate`,
      icon: FileCheck2
    },
    defects: {
      title: 'Defect Registry & AI Root Cause Engine',
      subtitle: `${openDefects.length} active defects (${criticalDefects} critical/high priority)`,
      icon: Bug
    },
    qa_dashboard: {
      title: 'QA Delivery Analytics & Velocity Intelligence',
      subtitle: 'Real-time defect arrival, test run coverage, and SLA compliance metrics',
      icon: Sparkles
    },
    apiAutomation: {
      title: 'API Automation Studio & CI/CD Runner',
      subtitle: `${(state.apiCollections || []).length} active API suites • Live collection trigger, Postman/Newman & Playwright integration`,
      icon: Zap
    },
    defectsDashboard: {
      title: 'QA Delivery Analytics & Velocity Intelligence',
      subtitle: 'Real-time defect arrival, test run coverage, and SLA compliance metrics',
      icon: Sparkles
    },
    releases: {
      title: 'Release Milestones & Scope Governance',
      subtitle: `${(state.releases || []).length} tracked release cycles across staging and production`,
      icon: Rocket
    },
    standup: {
      title: 'Daily Standup & AI Executive Digest',
      subtitle: 'Aggregated blocker tracking, daily deliverables, and instant summary generator',
      icon: Users
    },
    retrospective: {
      title: 'Retrospective & Continuous Improvement Board',
      subtitle: `${(state.retroItems || []).length} recorded Keep, Stop, and Start reflections • ${(state.retroActionItems || []).length} action commitments`,
      icon: MessageSquareQuote
    },
    people: {
      title: 'People Review, Capacity & Team Recognition',
      subtitle: `${(state.team || []).length} active team members across ${(state.groups || []).length} specialized work groups`,
      icon: Sparkles
    },
    peopleReview: {
      title: 'People Review, Capacity & Team Recognition',
      subtitle: `${(state.team || []).length} active team members across ${(state.groups || []).length} specialized work groups`,
      icon: Sparkles
    },
    blueprint: {
      title: 'Daily Time Blocking Blueprint',
      subtitle: 'Standardized daily schedule templates and recurrent execution slots',
      icon: Clock
    },
    settings: {
      title: 'System Preferences & Integrations',
      subtitle: 'Azure DevOps connections, workspace themes, and local storage configurations',
      icon: FolderGit2
    }
  };

  const currentMeta = viewMeta[activeView] || viewMeta.board;
  const Icon = currentMeta.icon;

  return (
    <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 py-3 transition-colors">
      <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Left: View Title & Context Description */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0 border border-[var(--primary)]/20 shadow-2xs">
            <Icon size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight truncate">
                {currentMeta.title}
              </h1>
              
              {/* Active Filters Indicators */}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                  Search: "{searchQuery}"
                  <button onClick={onClearSearch} className="hover:opacity-75 cursor-pointer ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedRelease && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
                  Release: {selectedRelease.name}
                  <button onClick={onClearReleaseFilter} className="hover:opacity-75 cursor-pointer ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium truncate mt-0.5">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Real-time Telemetry Indicators */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
          
          {/* Daily Completion Meter */}
          <div 
            id="strip-daily-target-indicator"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] shadow-2xs"
            title={`${completedTasks} of ${tasksForDay.length} daily tasks completed (${progressPercent}%)`}
          >
            <div className="flex items-center gap-1.5">
              <Target size={13} className="text-[var(--primary)] shrink-0" />
              <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider whitespace-nowrap">
                Daily Target
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[var(--text-primary)] font-mono">
                {progressPercent}%
              </span>
              <div className="w-14 sm:w-16 h-2 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
                <div 
                  className="h-full bg-[var(--primary)] rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Defects Status Pill */}
          <div 
            id="strip-defects-status-indicator"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] shadow-2xs"
            title={`${openDefects.length} open defects total (${criticalDefects} critical/high)`}
          >
            <div className="flex items-center gap-1.5">
              <Bug size={13} className={criticalDefects > 0 ? 'text-rose-500 shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
              <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider whitespace-nowrap">
                Open Defects
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span className={`text-xs font-black px-1.5 py-0.2 rounded-md ${
                criticalDefects > 0 
                  ? 'bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical-border)]' 
                  : 'text-[var(--text-primary)]'
              }`}>
                {openDefects.length}
              </span>
              {criticalDefects > 0 && (
                <span className="text-[10px] text-[var(--critical)] font-bold">
                  ({criticalDefects} crit)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
