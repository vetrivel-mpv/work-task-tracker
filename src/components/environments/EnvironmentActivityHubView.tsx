import React, { useState, useMemo } from 'react';
import { 
  Task, 
  UserStory, 
  Defect, 
  Release, 
  TeamMember, 
  AppState, 
  Priority,
  ExecutionMetrics 
} from '../../types';
import { JiraIssue } from '../../types/jira';
import { 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Layers, 
  Bookmark, 
  Bug, 
  CheckSquare, 
  FolderGit2, 
  RefreshCw, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Zap,
  Activity,
  Send,
  X
} from 'lucide-react';
import { generateId, toDateStr } from '../../utils/date';

export interface EnvironmentActivityHubViewProps {
  state: AppState;
  onUpdateTask?: (task: Task) => void;
  onAddTask?: (task: Task) => void;
  onUpdateStory?: (story: UserStory) => void;
  onUpdateDefect?: (defect: Defect) => void;
  onOpenEmailModal?: (template?: string) => void;
}

export const ENVIRONMENTS = [
  { id: 'QA', name: 'QA Staging', icon: '🧪', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', badge: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200' },
  { id: 'Dev', name: 'Dev Local / Test', icon: '💻', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200' },
  { id: 'UAT', name: 'UAT Client', icon: '🤝', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200' },
  { id: 'Staging', name: 'Staging / Pre-Prod', icon: '🚀', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30', badge: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200' },
  { id: 'Production', name: 'Production', icon: '🌐', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' },
  { id: 'Hotfix', name: 'Hotfix / Sandbox', icon: '⚡', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200' }
];

export interface UnifiedActivityItem {
  id: string;
  key: string;
  type: 'Task' | 'Story' | 'Bug' | 'Subtask';
  title: string;
  environment: string;
  status: string;
  priority: Priority;
  assigneeId?: string | null;
  assigneeName?: string;
  assigneeEmail?: string;
  iterationPath?: string;
  storyPoints?: number;
  timeSpentHours?: number;
  executionMetrics?: ExecutionMetrics;
  latestComment?: string;
  adoId?: number;
  parentKey?: string;
  parentTitle?: string;
}

export const EnvironmentActivityHubView: React.FC<EnvironmentActivityHubViewProps> = ({
  state,
  onUpdateTask,
  onAddTask,
  onUpdateStory,
  onUpdateDefect,
  onOpenEmailModal
}) => {
  const [selectedEnvFilter, setSelectedEnvFilter] = useState<string>('all');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [selectedIterationFilter, setSelectedIterationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewLayout, setViewLayout] = useState<'matrix' | 'list'>('matrix');

  // Quick Add Activity Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetModalEnv, setTargetModalEnv] = useState<string>('QA');
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'Task' | 'Story' | 'Bug'>('Task');
  const [modalAssigneeId, setModalAssigneeId] = useState('');
  const [modalPriority, setModalPriority] = useState<Priority>('medium');
  const [modalHours, setModalHours] = useState('2.0');
  const [modalIteration, setModalIteration] = useState('ACM\\D5 R 2026.09');
  const [modalTotalTc, setModalTotalTc] = useState('10');
  const [modalPassedTc, setModalPassedTc] = useState('10');
  const [modalFailedTc, setModalFailedTc] = useState('0');
  const [modalBlockedTc, setModalBlockedTc] = useState('0');

  // Compile Unified Activities from Tasks, User Stories, Defects, and JiraIssues
  const allActivities: UnifiedActivityItem[] = useMemo(() => {
    const items: UnifiedActivityItem[] = [];

    // 1. From Tasks
    (state.tasks || []).forEach((t, idx) => {
      const parentStory = t.userStoryId 
        ? state.userStories.find(s => s.id === t.userStoryId) 
        : null;
      const parentDefect = t.defectId 
        ? state.defects.find(d => d.id === t.defectId) 
        : null;
      const assignee = state.team.find(m => m.id === t.assigneeId);

      const env = (t as any).environment || (parentStory ? 'QA' : parentDefect ? 'QA' : 'Dev');

      items.push({
        id: t.id,
        key: (t as any).adoId ? `ACM-TASK-${(t as any).adoId}` : `TASK-${idx + 100}`,
        type: (t.userStoryId || t.defectId) ? 'Subtask' : 'Task',
        title: t.title,
        environment: env,
        status: t.status === 'complete' ? 'Done' : t.status === 'partial' ? 'In Progress' : 'To Do',
        priority: t.priority || 'medium',
        assigneeId: t.assigneeId,
        assigneeName: assignee ? assignee.name : t.assigneeName,
        assigneeEmail: assignee ? assignee.email : undefined,
        iterationPath: t.iterationPath || parentStory?.iterationPath || 'ACM\\D5 R 2026.09',
        timeSpentHours: (t as any).timeSpentHours || 2,
        executionMetrics: t.executionMetrics,
        latestComment: t.todayActivityComment || t.latestComment,
        adoId: (t as any).adoId,
        parentKey: parentStory ? (parentStory.adoId ? `ACM-${parentStory.adoId}` : parentStory.id) : undefined,
        parentTitle: parentStory ? parentStory.title : undefined
      });
    });

    // 2. From User Stories
    (state.userStories || []).forEach(s => {
      const assignee = state.team.find(m => m.id === s.assigneeId);
      items.push({
        id: s.id,
        key: s.adoId ? `ACM-${s.adoId}` : s.id,
        type: 'Story',
        title: s.title,
        environment: (s as any).environment || 'QA',
        status: s.status,
        priority: 'high',
        assigneeId: s.assigneeId,
        assigneeName: assignee ? assignee.name : s.assigneeName,
        assigneeEmail: assignee ? assignee.email : undefined,
        iterationPath: s.iterationPath || 'ACM\\D5 R 2026.09',
        storyPoints: s.storyPoints || 5,
        executionMetrics: s.executionMetrics,
        adoId: s.adoId
      });
    });

    // 3. From Defects
    (state.defects || []).forEach(d => {
      const assignee = state.team.find(m => m.id === d.assigneeId);
      items.push({
        id: d.id,
        key: d.adoId ? `ACM-BUG-${d.adoId}` : d.id,
        type: 'Bug',
        title: d.title,
        environment: d.environment || 'QA',
        status: d.status,
        priority: d.severity === 'critical' ? 'critical' : d.severity === 'high' ? 'high' : 'medium',
        assigneeId: d.assigneeId,
        assigneeName: assignee ? assignee.name : d.assigneeName,
        assigneeEmail: assignee ? assignee.email : undefined,
        iterationPath: d.iterationPath || 'ACM\\D5 R 2026.09',
        adoId: d.adoId
      });
    });

    return items;
  }, [state.tasks, state.userStories, state.defects, state.team]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return allActivities.filter(item => {
      if (selectedEnvFilter !== 'all' && item.environment !== selectedEnvFilter) {
        return false;
      }
      if (selectedPersonFilter !== 'all' && item.assigneeId !== selectedPersonFilter) {
        return false;
      }
      if (selectedIterationFilter !== 'all' && item.iterationPath !== selectedIterationFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = item.key.toLowerCase().includes(q);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchPerson = (item.assigneeName || '').toLowerCase().includes(q);
        const matchIter = (item.iterationPath || '').toLowerCase().includes(q);
        if (!matchKey && !matchTitle && !matchPerson && !matchIter) return false;
      }
      return true;
    });
  }, [allActivities, selectedEnvFilter, selectedPersonFilter, selectedIterationFilter, searchQuery]);

  // Available Iteration Paths for filtering
  const availableIterations = useMemo(() => {
    const set = new Set<string>();
    allActivities.forEach(i => {
      if (i.iterationPath && i.iterationPath.trim()) set.add(i.iterationPath.trim());
    });
    return Array.from(set).sort();
  }, [allActivities]);

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    const assignee = state.team.find(m => m.id === modalAssigneeId);
    const assignedPersonName = assignee ? assignee.name : 'Unassigned';

    const totalTc = parseInt(modalTotalTc) || 0;
    const passedTc = parseInt(modalPassedTc) || 0;
    const failedTc = parseInt(modalFailedTc) || 0;
    const blockedTc = parseInt(modalBlockedTc) || 0;

    const metrics: ExecutionMetrics = {
      totalTestCases: totalTc,
      completedTestCases: passedTc + failedTc,
      passedTestCases: passedTc,
      blockedTestCases: blockedTc,
      failedTestCases: failedTc,
      openDefects: failedTc > 0 ? 1 : 0,
      statusLabel: blockedTc > 0 ? 'Blocked' : failedTc > 0 ? 'Failed' : 'Passed'
    };

    if (modalType === 'Task') {
      const newTask: Task = {
        id: generateId('tsk'),
        title: modalTitle.trim(),
        status: 'partial',
        priority: modalPriority,
        dateStr: toDateStr(new Date()),
        assigneeIds: modalAssigneeId ? [modalAssigneeId] : [],
        assigneeId: modalAssigneeId || null,
        assigneeName: assignedPersonName,
        groupIds: [],
        iterationPath: modalIteration.trim() || undefined,
        environment: targetModalEnv,
        executionMetrics: metrics,
        timeSpentHours: parseFloat(modalHours) || 2.0,
        todayActivityComment: `Executing in [${targetModalEnv}]: ${modalTitle.trim()} (Passed: ${passedTc}/${totalTc})`
      } as any;

      if (onAddTask) onAddTask(newTask);
    }

    setIsAddModalOpen(false);
    setModalTitle('');
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'critical':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full font-sans animate-fadeIn">
      {/* Header & Overview Strip */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Server size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                Environment Activity Hub
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {filteredActivities.length} Activities
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                Track and align development, testing, defect validation, and live runs across all environments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Action: New Activity */}
          <button
            onClick={() => {
              setTargetModalEnv('QA');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>+ New Environment Activity</span>
          </button>
        </div>
      </div>

      {/* Filter & Toolbar Ribbon */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search activities, ticket keys, assignees, iterations..."
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Environment Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl">
            <Server size={13} className="text-purple-500 shrink-0" />
            <select
              value={selectedEnvFilter}
              onChange={e => setSelectedEnvFilter(e.target.value)}
              className="bg-transparent font-bold text-xs text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="all">All Environments ({ENVIRONMENTS.length})</option>
              {ENVIRONMENTS.map(env => (
                <option key={env.id} value={env.id}>
                  {env.icon} {env.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Person Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl">
            <Users size={13} className="text-blue-500 shrink-0" />
            <select
              value={selectedPersonFilter}
              onChange={e => setSelectedPersonFilter(e.target.value)}
              className="bg-transparent font-bold text-xs text-[var(--text-primary)] outline-none cursor-pointer max-w-[150px] truncate"
            >
              <option value="all">All People ({state.team.length})</option>
              {state.team.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Iteration Path Filter */}
          {availableIterations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl">
              <FolderGit2 size={13} className="text-emerald-500 shrink-0" />
              <select
                value={selectedIterationFilter}
                onChange={e => setSelectedIterationFilter(e.target.value)}
                className="bg-transparent font-bold text-xs text-[var(--text-primary)] outline-none cursor-pointer max-w-[160px] truncate"
              >
                <option value="all">All Iterations ({availableIterations.length})</option>
                {availableIterations.map(iter => (
                  <option key={iter} value={iter}>
                    {iter}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Grouped by Environments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {ENVIRONMENTS.filter(env => selectedEnvFilter === 'all' || selectedEnvFilter === env.id).map(env => {
          const envItems = filteredActivities.filter(a => a.environment === env.id || (env.id === 'QA' && !a.environment));
          const totalPoints = envItems.reduce((acc, i) => acc + (i.storyPoints || 1), 0);
          const doneCount = envItems.filter(i => i.status === 'Done' || i.status === 'QA Passed' || i.status === 'Closed').length;

          return (
            <div
              key={env.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex flex-col overflow-hidden shadow-xs hover:shadow-md transition-all"
            >
              {/* Environment Column Header */}
              <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between ${env.bg}`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">{env.icon}</span>
                  <div>
                    <h3 className="font-extrabold text-sm text-[var(--text-primary)]">
                      {env.name}
                    </h3>
                    <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                      {envItems.length} {envItems.length === 1 ? 'activity' : 'activities'} &bull; {doneCount}/{envItems.length} completed
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTargetModalEnv(env.id);
                    setIsAddModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] shadow-2xs transition-all cursor-pointer"
                  title={`Add activity to ${env.name}`}
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Activities Card List */}
              <div className="p-3.5 flex-1 overflow-y-auto flex flex-col gap-2.5 max-h-[600px] custom-scrollbar bg-[var(--surface-hover)]/30">
                {envItems.length > 0 ? (
                  envItems.map(item => {
                    const assignee = state.team.find(m => m.id === item.assigneeId);

                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 rounded-xl shadow-2xs transition-all flex flex-col gap-2"
                      >
                        {/* Key, Type & Priority */}
                        <div className="flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.type === 'Bug' ? (
                              <Bug size={13} className="text-rose-500 shrink-0" />
                            ) : item.type === 'Story' ? (
                              <Bookmark size={13} className="text-emerald-500 shrink-0" />
                            ) : (
                              <CheckSquare size={13} className="text-sky-500 shrink-0" />
                            )}
                            <span className="font-mono font-bold text-[10.5px] text-[var(--primary)] truncate">
                              {item.key}
                            </span>
                          </div>

                          <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${getPriorityBadge(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <p className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                          {item.title}
                        </p>

                        {/* Parent Story Badge if subtask */}
                        {item.parentKey && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[9.5px] font-bold border border-emerald-500/20 truncate max-w-full">
                            <Bookmark size={9} />
                            <span className="truncate">Story: {item.parentKey}</span>
                          </div>
                        )}

                        {/* Iteration Path Badge */}
                        {item.iterationPath && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-[9px] font-semibold border border-blue-500/20 truncate max-w-full">
                            <FolderGit2 size={9} className="text-blue-500 shrink-0" />
                            <span className="truncate">{item.iterationPath}</span>
                          </div>
                        )}

                        {/* Test Execution Metrics if available */}
                        {item.executionMetrics && (
                          <div className="p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ✓ {item.executionMetrics.passedTestCases} Passed
                            </span>
                            {item.executionMetrics.blockedTestCases > 0 && (
                              <span className="font-bold text-red-600 dark:text-red-400">
                                🚫 {item.executionMetrics.blockedTestCases} Blocked
                              </span>
                            )}
                            {item.executionMetrics.failedTestCases > 0 && (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                ❌ {item.executionMetrics.failedTestCases} Failed
                              </span>
                            )}
                            <span className="text-[var(--text-muted)]">
                              Total: {item.executionMetrics.totalTestCases}
                            </span>
                          </div>
                        )}

                        {/* Footer: Assignee Persona & Status */}
                        <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between gap-2 text-[11px]">
                          {/* Tagged Person */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {assignee ? (
                              <div
                                className="w-5 h-5 rounded-full text-white font-bold text-[9px] flex items-center justify-center shadow-2xs shrink-0"
                                style={{ backgroundColor: assignee.avatarColor || '#0052CC' }}
                                title={`Assigned to ${assignee.name} (${assignee.email})`}
                              >
                                {assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                            ) : null}
                            <span className="font-semibold text-[var(--text-secondary)] truncate">
                              {item.assigneeName || 'Unassigned'}
                            </span>
                          </div>

                          {/* Status Tag */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.status === 'Done' || item.status === 'QA Passed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : item.status === 'Blocked'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--text-muted)] italic">
                    No active tasks or runs recorded in {env.name}. Click + to add an activity.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Quick Add Environment Activity */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-purple-600" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">
                  Add Activity to {targetModalEnv} Environment
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="font-bold text-[var(--text-secondary)] block mb-1">Activity / Task Title *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={e => setModalTitle(e.target.value)}
                  placeholder="e.g. Validate carrier failover on QA Staging cluster..."
                  className="w-full p-2.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[var(--text-secondary)] block mb-1">Target Environment</label>
                  <select
                    value={targetModalEnv}
                    onChange={e => setTargetModalEnv(e.target.value)}
                    className="w-full p-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none font-bold"
                  >
                    {ENVIRONMENTS.map(env => (
                      <option key={env.id} value={env.id}>
                        {env.icon} {env.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[var(--text-secondary)] block mb-1">Assigned Person *</label>
                  <select
                    value={modalAssigneeId}
                    onChange={e => setModalAssigneeId(e.target.value)}
                    className="w-full p-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none font-semibold"
                  >
                    <option value="">Unassigned</option>
                    {state.team.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[var(--text-secondary)] block mb-1">ADO Iteration Path</label>
                  <input
                    type="text"
                    value={modalIteration}
                    onChange={e => setModalIteration(e.target.value)}
                    placeholder="e.g. ACM\D5 R 2026.09"
                    className="w-full p-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-[var(--text-secondary)] block mb-1">Priority</label>
                  <select
                    value={modalPriority}
                    onChange={e => setModalPriority(e.target.value as Priority)}
                    className="w-full p-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none font-bold"
                  >
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              {/* Test Metrics Inputs */}
              <div className="p-3 bg-[var(--surface-hover)]/60 border border-[var(--border)] rounded-xl flex flex-col gap-2">
                <span className="font-bold text-[11px] text-[var(--text-muted)] uppercase">Test Execution Counts</span>
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block">Total</label>
                    <input
                      type="number"
                      value={modalTotalTc}
                      onChange={e => setModalTotalTc(e.target.value)}
                      className="w-full p-1 bg-[var(--surface)] border border-[var(--border)] rounded text-center text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-600 block">Passed</label>
                    <input
                      type="number"
                      value={modalPassedTc}
                      onChange={e => setModalPassedTc(e.target.value)}
                      className="w-full p-1 bg-[var(--surface)] border border-[var(--border)] rounded text-center text-xs font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-red-600 block">Blocked</label>
                    <input
                      type="number"
                      value={modalBlockedTc}
                      onChange={e => setModalBlockedTc(e.target.value)}
                      className="w-full p-1 bg-[var(--surface)] border border-[var(--border)] rounded text-center text-xs font-bold text-red-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-rose-600 block">Failed</label>
                    <input
                      type="number"
                      value={modalFailedTc}
                      onChange={e => setModalFailedTc(e.target.value)}
                      className="w-full p-1 bg-[var(--surface)] border border-[var(--border)] rounded text-center text-xs font-bold text-rose-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold shadow-xs cursor-pointer"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
