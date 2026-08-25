import React, { useState } from 'react';
import { Release, UserStory, Defect, Task, TestCase, ReleaseStatus } from '../../types';
import { 
  X, 
  Rocket, 
  Calendar, 
  Layers, 
  FolderGit2, 
  CheckSquare, 
  Bug, 
  ListTodo, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Edit3, 
  ExternalLink, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Info,
  ChevronRight,
  Filter,
  Flame
} from 'lucide-react';
import { formatDisplayDate } from '../../utils/date';
import { extractReleaseNumber, formatReleaseDisplayName } from '../../utils/adoPaths';
import { ReleaseFetchResult } from './ReleasesView';

interface ReleaseDetailModalProps {
  release: Release | null;
  isOpen: boolean;
  onClose: () => void;
  userStories: UserStory[];
  defects: Defect[];
  tasks: Task[];
  testCases?: TestCase[];
  lastFetch?: ReleaseFetchResult;
  isSyncing?: boolean;
  onFetchReleaseData?: (release: Release) => void;
  onGenerateAiNotes?: (release: Release) => void;
  onEditRelease?: (release: Release) => void;
}

const STATUS_CONFIG: { [key in ReleaseStatus]: { label: string; bg: string; text: string; border: string } } = {
  Planning: { label: 'Planning', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700' },
  'Active QA': { label: 'Active QA', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  Staging: { label: 'Staging', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-700' },
  Deployed: { label: 'Deployed', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
  Archived: { label: 'Archived', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-500 dark:text-zinc-400', border: 'border-zinc-300 dark:border-zinc-700' }
};

export const ReleaseDetailModal: React.FC<ReleaseDetailModalProps> = ({
  release,
  isOpen,
  onClose,
  userStories,
  defects,
  tasks,
  testCases = [],
  lastFetch,
  isSyncing = false,
  onFetchReleaseData,
  onGenerateAiNotes,
  onEditRelease
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'stories' | 'bugs' | 'tasks' | 'testCases' | 'adoSync'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [defectSeverityFilter, setDefectSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  if (!isOpen || !release) return null;

  const st = STATUS_CONFIG[release.status] || STATUS_CONFIG['Planning'];
  const relNum = release.releaseNumber || extractReleaseNumber(release.name);

  // Filter scoped items for this release
  const relStories = userStories;
  const relDefects = defects;
  const relTasks = tasks;
  const relTestCases = testCases;

  // Metric computations & deep explanations
  const totalStories = lastFetch && lastFetch.status === 'success' && lastFetch.storiesCount !== undefined
    ? Math.max(lastFetch.storiesCount, relStories.length)
    : relStories.length;
  const passedStories = relStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
  const inProgressStories = relStories.filter(s => s.status === 'QA In Progress' || s.status === 'Dev In Progress' || s.status === 'In Analysis').length;
  const readyForTestStories = relStories.filter(s => s.status === 'QA Ready' || s.status === 'To Do').length;
  const blockedStories = relStories.filter(s => s.status === 'Blocked').length;
  const storyProgressPercent = totalStories > 0 ? Math.round((passedStories / totalStories) * 100) : 0;

  // Bug breakdown
  const openDefectsList = relDefects.filter(d => d.status !== 'Closed');
  const totalOpenBugs = lastFetch && lastFetch.status === 'success' && lastFetch.bugsCount !== undefined
    ? Math.max(lastFetch.bugsCount, openDefectsList.length)
    : openDefectsList.length;
  const criticalDefects = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const highDefects = relDefects.filter(d => d.severity === 'high' && d.status !== 'Closed').length;
  const mediumDefects = relDefects.filter(d => d.severity === 'medium' && d.status !== 'Closed').length;
  const lowDefects = relDefects.filter(d => d.severity === 'low' && d.status !== 'Closed').length;
  const closedDefects = relDefects.filter(d => d.status === 'Closed').length;

  // Task breakdown
  const totalTasks = lastFetch && lastFetch.status === 'success' && lastFetch.tasksCount !== undefined
    ? Math.max(lastFetch.tasksCount, relTasks.length)
    : relTasks.length;
  const completedTasks = relTasks.filter(t => t.status === 'complete').length;
  const partialTasks = relTasks.filter(t => t.status === 'partial').length;
  const pendingTasks = relTasks.filter(t => t.status === 'pending').length;
  const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filtered lists for data explorer tabs
  const filteredStories = relStories.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.adoId || '').includes(searchQuery) ||
    s.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.assigneeName && s.assigneeName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDefects = relDefects.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(d.adoId || '').includes(searchQuery) ||
      d.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.assigneeName && d.assigneeName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (defectSeverityFilter === 'all') return true;
    return d.severity === defectSeverityFilter;
  });

  const filteredTasks = relTasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(t.adoId || '').includes(searchQuery) ||
    t.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.assigneeName && t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div 
      id="release-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="release-detail-modal-container"
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Modal Top Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold shadow-xs shrink-0 mt-0.5">
              <Rocket size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${st.bg} ${st.text} ${st.border}`}>
                  {st.label}
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-md border border-[var(--primary)]/20">
                  {relNum}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-semibold flex items-center gap-1">
                  <Calendar size={12} className="text-[var(--primary)]" />
                  <span>Target: {formatDisplayDate(release.targetDate)}</span>
                </span>
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight mt-1 truncate" title={release.name}>
                {release.name}
              </h2>
              {release.description && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                  {release.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEditRelease && (
              <button
                onClick={() => onEditRelease(release)}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors cursor-pointer"
                title="Edit Release Configuration"
              >
                <Edit3 size={15} />
              </button>
            )}
            <button
              id="close-release-detail-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Path Metadata Banner */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 bg-[var(--bg-subtle)] border-b border-[var(--border)] text-xs gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {release.areaPath && (
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-mono">
                <Layers size={13} className="text-[var(--text-muted)]" />
                <span className="text-[11px] font-medium">Area:</span>
                <strong className="text-[var(--text-primary)] text-[11px]">{release.areaPath}</strong>
              </div>
            )}
            {release.iterationPath && (
              <div className="flex items-center gap-1.5 text-[var(--primary)] font-mono">
                <FolderGit2 size={13} />
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Iteration:</span>
                <strong className="text-[11px] font-bold">{release.iterationPath}</strong>
              </div>
            )}
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2">
            {onFetchReleaseData && (
              <button
                onClick={() => onFetchReleaseData(release)}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync ADO Data'}</span>
              </button>
            )}
            {onGenerateAiNotes && (
              <button
                onClick={() => onGenerateAiNotes(release)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition-all cursor-pointer shadow-2xs"
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>AI Risk Notes</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'overview' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Rocket size={13} />
              <span>Scope Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'stories' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <CheckSquare size={13} />
              <span>User Stories ({relStories.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('bugs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'bugs' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Bug size={13} />
              <span>Bugs & Defects ({openDefectsList.length})</span>
              {criticalDefects > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-black">
                  {criticalDefects}C
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'tasks' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <ListTodo size={13} />
              <span>Sprint Tasks ({relTasks.length})</span>
            </button>
            {relTestCases.length > 0 && (
              <button
                onClick={() => setActiveTab('testCases')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'testCases' 
                    ? 'bg-[var(--primary)] text-white shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <ShieldCheck size={13} />
                <span>Test Cases ({relTestCases.length})</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('adoSync')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'adoSync' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Clock size={13} />
              <span>Sync Audit</span>
            </button>
          </div>

          {/* Search bar for item tabs */}
          {activeTab !== 'overview' && activeTab !== 'adoSync' && (
            <div className="relative min-w-[200px] max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder={`Search in ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
              />
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg)] min-h-0 space-y-6">

          {/* ========================================================================= */}
          {/* TAB 1: EXECUTIVE OVERVIEW WITH DEEP EXPLANATIONS */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Detailed Explanation Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Stories Explanation Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <CheckSquare size={15} className="text-emerald-500" />
                        <span>User Stories Verification</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {storyProgressPercent}% QA Verified
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {passedStories}/{totalStories}
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">Stories Passed / Done</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden my-2.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          storyProgressPercent === 100 ? 'bg-emerald-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${storyProgressPercent}%` }}
                      />
                    </div>

                    {/* Clear Explanatory Text */}
                    <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] leading-relaxed mt-2">
                      <strong className="text-[var(--text-primary)] block mb-0.5">What "{passedStories}/{totalStories} Stories" means:</strong>
                      {passedStories === totalStories && totalStories > 0 ? (
                        <span>All {totalStories} user stories in this release have passed QA verification and are fully completed.</span>
                      ) : (
                        <span>
                          <strong>{passedStories} of {totalStories}</strong> user stories have reached <strong>QA Passed</strong> or <strong>Done</strong> status. 
                          The remaining {totalStories - passedStories} {totalStories - passedStories === 1 ? 'story is' : 'stories are'} currently in development or undergoing testing.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stories Status Breakdown */}
                  <div className="grid grid-cols-3 gap-1.5 text-center mt-3 pt-3 border-t border-[var(--border)] text-[10px]">
                    <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                      <div>{passedStories}</div>
                      <div className="text-[9px] opacity-80 font-normal">Passed/Done</div>
                    </div>
                    <div className="p-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold">
                      <div>{inProgressStories}</div>
                      <div className="text-[9px] opacity-80 font-normal">In Dev/QA</div>
                    </div>
                    <div className="p-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 font-bold">
                      <div>{readyForTestStories}</div>
                      <div className="text-[9px] opacity-80 font-normal">To Do/Ready</div>
                    </div>
                  </div>
                </div>

                {/* 2. Bugs Explanation Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Bug size={15} className="text-rose-500" />
                        <span>Defects & Release Gate</span>
                      </div>
                      {criticalDefects > 0 ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500 text-white animate-pulse">
                          {criticalDefects} Critical Blocker
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          0 Critical Blockers
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 mt-1">
                      <div className={`text-2xl font-black font-mono ${criticalDefects > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>
                        {totalOpenBugs} {criticalDefects > 0 && <span className="text-sm font-bold text-rose-500">({criticalDefects}C)</span>}
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">Active Bugs</span>
                    </div>

                    {/* Visual Severity Distribution Bar */}
                    <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden my-2.5 flex">
                      {criticalDefects > 0 && (
                        <div style={{ width: `${Math.max(10, (criticalDefects / (totalOpenBugs || 1)) * 100)}%` }} className="h-full bg-rose-600" title={`Critical: ${criticalDefects}`} />
                      )}
                      {highDefects > 0 && (
                        <div style={{ width: `${(highDefects / (totalOpenBugs || 1)) * 100}%` }} className="h-full bg-amber-500" title={`High: ${highDefects}`} />
                      )}
                      {mediumDefects > 0 && (
                        <div style={{ width: `${(mediumDefects / (totalOpenBugs || 1)) * 100}%` }} className="h-full bg-blue-500" title={`Medium: ${mediumDefects}`} />
                      )}
                      {lowDefects > 0 && (
                        <div style={{ width: `${(lowDefects / (totalOpenBugs || 1)) * 100}%` }} className="h-full bg-slate-400" title={`Low: ${lowDefects}`} />
                      )}
                    </div>

                    {/* Clear Explanatory Text */}
                    <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] leading-relaxed mt-2">
                      <strong className="text-[var(--text-primary)] block mb-0.5">
                        What "{totalOpenBugs} {criticalDefects > 0 ? `(${criticalDefects}C)` : ''} Bugs" means:
                      </strong>
                      <span>
                        <strong>{totalOpenBugs} active defects</strong> are currently tracked in this release.
                        {criticalDefects > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">
                            "{criticalDefects}C" indicates {criticalDefects} Critical Severity defect(s) that must be resolved before deployment sign-off.
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                            No critical blockers currently prevent deployment.
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Bug Severity Breakdown */}
                  <div className="grid grid-cols-4 gap-1 text-center mt-3 pt-3 border-t border-[var(--border)] text-[10px]">
                    <div className={`p-1 rounded-lg font-bold ${criticalDefects > 0 ? 'bg-rose-600 text-white' : 'bg-slate-500/10 text-[var(--text-muted)]'}`}>
                      <div>{criticalDefects}</div>
                      <div className="text-[8.5px] opacity-90 font-normal">Critical (C)</div>
                    </div>
                    <div className="p-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                      <div>{highDefects}</div>
                      <div className="text-[8.5px] opacity-80 font-normal">High</div>
                    </div>
                    <div className="p-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold">
                      <div>{mediumDefects}</div>
                      <div className="text-[8.5px] opacity-80 font-normal">Medium</div>
                    </div>
                    <div className="p-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 font-bold">
                      <div>{lowDefects}</div>
                      <div className="text-[8.5px] opacity-80 font-normal">Low</div>
                    </div>
                  </div>
                </div>

                {/* 3. Tasks Explanation Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <ListTodo size={15} className="text-blue-500" />
                        <span>Sprint Tasks Throughput</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {taskProgressPercent}% Closed
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        {completedTasks}/{totalTasks}
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">Tasks Completed</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden my-2.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          taskProgressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${taskProgressPercent}%` }}
                      />
                    </div>

                    {/* Clear Explanatory Text */}
                    <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] leading-relaxed mt-2">
                      <strong className="text-[var(--text-primary)] block mb-0.5">What "{completedTasks}/{totalTasks} Tasks" means:</strong>
                      <span>
                        <strong>{completedTasks} of {totalTasks}</strong> engineering, QA, and operational sprint tasks have been closed. 
                        Tracks execution throughput and team work item burn-down for this iteration.
                      </span>
                    </div>
                  </div>

                  {/* Tasks Status Breakdown */}
                  <div className="grid grid-cols-3 gap-1.5 text-center mt-3 pt-3 border-t border-[var(--border)] text-[10px]">
                    <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                      <div>{completedTasks}</div>
                      <div className="text-[9px] opacity-80 font-normal">Closed/Done</div>
                    </div>
                    <div className="p-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold">
                      <div>{partialTasks}</div>
                      <div className="text-[9px] opacity-80 font-normal">In Progress</div>
                    </div>
                    <div className="p-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 font-bold">
                      <div>{pendingTasks}</div>
                      <div className="text-[9px] opacity-80 font-normal">Pending To Do</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Quick Jump Callout Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveTab('stories')}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-emerald-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <CheckSquare size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">Inspect All User Stories</h4>
                      <p className="text-[10px] text-[var(--text-secondary)]">{relStories.length} stories in scope</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => setActiveTab('bugs')}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-rose-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                      <Bug size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">Inspect Active Defects</h4>
                      <p className="text-[10px] text-[var(--text-secondary)]">{openDefectsList.length} open bugs {criticalDefects > 0 ? `(${criticalDefects} critical)` : ''}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => setActiveTab('tasks')}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-blue-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                      <ListTodo size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">Inspect Sprint Tasks</h4>
                      <p className="text-[10px] text-[var(--text-secondary)]">{relTasks.length} tasks assigned</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: USER STORIES LIST */}
          {/* ========================================================================= */}
          {activeTab === 'stories' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Showing {filteredStories.length} of {relStories.length} User Stories</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {passedStories} Verified ({storyProgressPercent}%)
                </span>
              </div>

              {filteredStories.length === 0 ? (
                <div className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-xs text-[var(--text-muted)]">
                  <CheckSquare size={24} className="mx-auto mb-2 opacity-50" />
                  <span>No user stories found matching your filter in this release scope.</span>
                </div>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden shadow-xs">
                  {filteredStories.map(story => (
                    <div key={story.id} className="p-4 hover:bg-[var(--surface-hover)] transition-colors flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {story.adoId && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
                              #{story.adoId}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            story.status === 'QA Passed' || story.status === 'Done'
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/40'
                              : story.status === 'Blocked'
                              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300/40'
                              : 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300/40'
                          }`}>
                            {story.status}
                          </span>
                          {story.storyPoints && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                              {story.storyPoints} pts
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                          {story.title}
                        </h4>

                        {story.description && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                            {story.description}
                          </p>
                        )}

                        {story.assigneeName && (
                          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-1.5">
                            <span>Assignee:</span>
                            <strong className="text-[var(--text-primary)]">{story.assigneeName}</strong>
                          </div>
                        )}
                      </div>

                      {story.adoUrl && (
                        <a
                          href={story.adoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
                          title="Open in Azure DevOps"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: BUGS & DEFECTS LIST */}
          {/* ========================================================================= */}
          {activeTab === 'bugs' && (
            <div className="space-y-3">
              {/* Severity Filter Chips */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1">
                    <Filter size={12} />
                    <span>Severity:</span>
                  </span>
                  <button
                    onClick={() => setDefectSeverityFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      defectSeverityFilter === 'all'
                        ? 'bg-[var(--text-primary)] text-[var(--bg)] shadow-xs'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                    }`}
                  >
                    All ({relDefects.length})
                  </button>
                  <button
                    onClick={() => setDefectSeverityFilter('critical')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      defectSeverityFilter === 'critical'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20'
                    }`}
                  >
                    <Flame size={12} />
                    <span>Critical ({criticalDefects})</span>
                  </button>
                  <button
                    onClick={() => setDefectSeverityFilter('high')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      defectSeverityFilter === 'high'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
                    }`}
                  >
                    High ({highDefects})
                  </button>
                  <button
                    onClick={() => setDefectSeverityFilter('medium')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      defectSeverityFilter === 'medium'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/20'
                    }`}
                  >
                    Medium ({mediumDefects})
                  </button>
                  <button
                    onClick={() => setDefectSeverityFilter('low')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      defectSeverityFilter === 'low'
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 hover:bg-slate-500/20'
                    }`}
                  >
                    Low ({lowDefects})
                  </button>
                </div>

                <span className="text-xs text-[var(--text-secondary)]">
                  Showing {filteredDefects.length} of {relDefects.length} defects
                </span>
              </div>

              {filteredDefects.length === 0 ? (
                <div className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-xs text-[var(--text-muted)]">
                  <Bug size={24} className="mx-auto mb-2 opacity-50" />
                  <span>No defects match the selected filter criteria.</span>
                </div>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden shadow-xs">
                  {filteredDefects.map(defect => (
                    <div key={defect.id} className="p-4 hover:bg-[var(--surface-hover)] transition-colors flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {defect.adoId && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
                              #{defect.adoId}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                            defect.severity === 'critical'
                              ? 'bg-rose-600 text-white font-black animate-pulse'
                              : defect.severity === 'high'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : defect.severity === 'medium'
                              ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                              : 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/30'
                          }`}>
                            {defect.severity}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {defect.status}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                          {defect.title}
                        </h4>

                        {defect.description && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                            {defect.description}
                          </p>
                        )}

                        {defect.assigneeName && (
                          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-1.5">
                            <span>Assignee:</span>
                            <strong className="text-[var(--text-primary)]">{defect.assigneeName}</strong>
                          </div>
                        )}
                      </div>

                      {defect.adoUrl && (
                        <a
                          href={defect.adoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
                          title="Open in Azure DevOps"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: SPRINT TASKS LIST */}
          {/* ========================================================================= */}
          {activeTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Showing {filteredTasks.length} of {relTasks.length} Tasks</span>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {completedTasks} Closed ({taskProgressPercent}%)
                </span>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-xs text-[var(--text-muted)]">
                  <ListTodo size={24} className="mx-auto mb-2 opacity-50" />
                  <span>No sprint tasks found in this release scope.</span>
                </div>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden shadow-xs">
                  {filteredTasks.map(task => (
                    <div key={task.id} className="p-3.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center shrink-0 ${
                          task.status === 'complete'
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : task.status === 'partial'
                            ? 'bg-blue-500/20 border-blue-500'
                            : 'border-[var(--border)]'
                        }`}>
                          {task.status === 'complete' && <CheckCircle2 size={12} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {task.adoId && (
                              <span className="text-[11px] font-mono font-bold text-[var(--text-muted)]">
                                #{task.adoId}
                              </span>
                            )}
                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {task.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                            <span className="capitalize font-semibold">{task.status}</span>
                            <span>&bull;</span>
                            <span className="capitalize">{task.priority} Priority</span>
                            {task.assigneeName && (
                              <>
                                <span>&bull;</span>
                                <span>{task.assigneeName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {task.adoUrl && (
                        <a
                          href={task.adoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
                          title="Open in Azure DevOps"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: TEST CASES (IF APPLICABLE) */}
          {/* ========================================================================= */}
          {activeTab === 'testCases' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Showing {relTestCases.length} Test Cases</span>
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] overflow-hidden shadow-xs">
                {relTestCases.map(tc => (
                  <div key={tc.id} className="p-3.5 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {tc.adoId && (
                          <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                            #{tc.adoId}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          {tc.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {tc.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: ADO LIVE SYNC AUDIT & RETURNED WORK ITEMS */}
          {/* ========================================================================= */}
          {activeTab === 'adoSync' && (
            <div className="space-y-4">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-primary)]">Azure DevOps Work Item Synchronization Audit</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">Live query timing and returned items summary</p>
                    </div>
                  </div>

                  {lastFetch && (
                    <span className="text-xs font-mono font-bold text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                      Last Query: {lastFetch.timestamp} ({lastFetch.durationMs}ms)
                    </span>
                  )}
                </div>

                {lastFetch ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {lastFetch.storiesCount}
                      </div>
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                        User Stories
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                        {lastFetch.bugsCount}
                      </div>
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                        Bugs
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        {lastFetch.tasksCount}
                      </div>
                      <div className="text-xs font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                        Tasks
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <div className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">
                        {lastFetch.totalCount}
                      </div>
                      <div className="text-xs font-bold text-purple-700 dark:text-purple-300 mt-0.5">
                        Total Scope
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                    <Info size={20} className="mx-auto mb-2 opacity-50" />
                    <span>No ADO live fetch recorded yet for this release. Click "Sync ADO Data" to query Azure DevOps.</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface)] shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Info size={13} className="text-[var(--primary)] shrink-0" />
            <span>Click any tab to deep-dive into Stories, Bugs, or Tasks.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
