import React, { useState, useMemo } from 'react';
import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  Defect, 
  Release, 
  Priority, 
  TaskStatus 
} from '../../types';
import { 
  GitBranch, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ArrowDown, 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  ExternalLink, 
  Layers, 
  Flame, 
  ShieldAlert, 
  Sparkles,
  ChevronRight,
  ChevronDown,
  Check,
  Zap,
  Globe2,
  Building2,
  Calendar
} from 'lucide-react';
import { getTaskBlockedStatus } from '../../utils/taskDependencies';
import { TaskDependencyModal } from './TaskDependencyModal';
import { TaskEditModal } from './TaskEditModal';
import { HighlightText } from '../common/HighlightText';
import { formatTime12, formatDisplayDate } from '../../utils/date';

interface DependencyChainViewProps {
  tasks: Task[];
  allTasks: Task[];
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  currentDateStr: string;
  searchQuery?: string;
  onToggleStatus: (taskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddComment?: (taskId: string, text: string) => void;
}

type DependencyFilterMode = 'all' | 'blockers' | 'blocked' | 'chains' | 'matrix';

export const DependencyChainView: React.FC<DependencyChainViewProps> = ({
  tasks,
  allTasks,
  team,
  groups,
  userStories,
  defects,
  releases,
  currentDateStr,
  searchQuery = '',
  onToggleStatus,
  onUpdateTask,
  onDeleteTask,
  onAddComment
}) => {
  const [filterMode, setFilterMode] = useState<DependencyFilterMode>('all');
  const [selectedTaskIdForDeps, setSelectedTaskIdForDeps] = useState<string | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [searchFilter, setSearchFilter] = useState(searchQuery);
  const [collapsedBlockers, setCollapsedBlockers] = useState<{ [id: string]: boolean }>({});

  const toggleBlockerCollapse = (id: string) => {
    setCollapsedBlockers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Analyze all tasks for dependency metadata
  const tasksAnalysis = useMemo(() => {
    return tasks.map(task => {
      const statusInfo = getTaskBlockedStatus(task, allTasks);
      return {
        task,
        ...statusInfo,
        hasPrerequisites: statusInfo.totalPrerequisites > 0,
        hasDependents: statusInfo.dependentTasks.length > 0,
        isRootBlocker: task.status !== 'complete' && statusInfo.dependentTasks.length > 0
      };
    });
  }, [tasks, allTasks]);

  // Tasks with any dependency relationship (has prereqs or is depended upon)
  const connectedTasks = useMemo(() => {
    return tasksAnalysis.filter(t => t.hasPrerequisites || t.hasDependents);
  }, [tasksAnalysis]);

  // Root blockers: Incomplete tasks that block other downstream tasks
  const rootBlockers = useMemo(() => {
    return tasksAnalysis.filter(t => t.isRootBlocker);
  }, [tasksAnalysis]);

  // Blocked tasks: Incomplete tasks currently waiting on prerequisite tasks
  const blockedTasks = useMemo(() => {
    return tasksAnalysis.filter(t => t.isBlocked);
  }, [tasksAnalysis]);

  // Satisfied tasks: Tasks with prerequisites where all prerequisites are complete
  const satisfiedTasks = useMemo(() => {
    return tasksAnalysis.filter(t => t.hasPrerequisites && !t.isBlocked && t.task.status !== 'complete');
  }, [tasksAnalysis]);

  // Filter tasks based on search & view mode
  const filteredAnalysis = useMemo(() => {
    return tasksAnalysis.filter(item => {
      // Text search
      const q = (searchFilter || searchQuery).toLowerCase().trim();
      if (q) {
        const matchesTitle = item.task.title.toLowerCase().includes(q);
        const matchesAssignee = team.some(
          m => item.task.assigneeIds?.includes(m.id) && m.name.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesAssignee) return false;
      }

      // Filter modes
      if (filterMode === 'blockers') return item.isRootBlocker;
      if (filterMode === 'blocked') return item.isBlocked;
      if (filterMode === 'chains') return item.hasPrerequisites || item.hasDependents;
      return true; // 'all' or 'matrix'
    });
  }, [tasksAnalysis, searchFilter, searchQuery, filterMode, team]);

  // Build cascading dependency chains (Root ➔ Child ➔ Grandchild)
  const dependencyChains = useMemo(() => {
    // Find entry tasks: tasks that have downstream dependents but no incomplete prerequisites
    const entryTasks = tasksAnalysis.filter(t => t.hasDependents && (!t.hasPrerequisites || !t.isBlocked));
    
    // Fallback if circular or all have prerequisites: use all tasks with dependents
    const seedTasks = entryTasks.length > 0 ? entryTasks : tasksAnalysis.filter(t => t.hasDependents);

    const chains: Array<{
      id: string;
      root: Task;
      chainNodes: Array<{ task: Task; depth: number; isBlocked: boolean; blockingCount: number }>;
    }> = [];

    const visited = new Set<string>();

    seedTasks.forEach(seed => {
      if (visited.has(seed.task.id)) return;

      const chainNodes: Array<{ task: Task; depth: number; isBlocked: boolean; blockingCount: number }> = [];
      const queue: Array<{ task: Task; depth: number }> = [{ task: seed.task, depth: 0 }];

      while (queue.length > 0) {
        const { task: curr, depth } = queue.shift()!;
        if (visited.has(curr.id) && depth > 0) continue;
        visited.add(curr.id);

        const currStatus = getTaskBlockedStatus(curr, allTasks);
        chainNodes.push({
          task: curr,
          depth,
          isBlocked: currStatus.isBlocked,
          blockingCount: currStatus.dependentTasks.length
        });

        // Add downstream dependents to queue
        currStatus.dependentTasks.forEach(dep => {
          queue.push({ task: dep, depth: depth + 1 });
        });
      }

      if (chainNodes.length > 1) {
        chains.push({
          id: seed.task.id,
          root: seed.task,
          chainNodes
        });
      }
    });

    return chains;
  }, [tasksAnalysis, allTasks]);

  const activeTaskForDeps = selectedTaskIdForDeps 
    ? allTasks.find(t => t.id === selectedTaskIdForDeps) || null 
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner & Health Metrics */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
              <GitBranch size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Dependency Chain & Blocker Map</h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30">
                  {connectedTasks.length} Connected {connectedTasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Visualize upstream prerequisites, live execution bottlenecks, and cascading blockers across deliverables.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (tasks.length > 0) {
                  setSelectedTaskIdForDeps(tasks[0].id);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Link Task Dependencies</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Telemetry Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4">
          {/* Active Critical Blockers */}
          <div 
            onClick={() => setFilterMode('blockers')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterMode === 'blockers'
                ? 'bg-red-500/15 border-red-500 text-red-700 dark:text-red-300 ring-2 ring-red-500/30'
                : 'bg-[var(--bg-subtle)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Critical Blockers</span>
              <ShieldAlert size={15} className="text-red-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono-token">
                {rootBlockers.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">holding back work</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Incomplete tasks with downstream items waiting</p>
          </div>

          {/* Blocked Work Items */}
          <div 
            onClick={() => setFilterMode('blocked')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterMode === 'blocked'
                ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30'
                : 'bg-[var(--bg-subtle)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Blocked Tasks</span>
              <Lock size={15} className="text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono-token">
                {blockedTasks.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">cannot start yet</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Waiting on prerequisite tickets to complete</p>
          </div>

          {/* Ready to Execute / Unblocked */}
          <div 
            onClick={() => setFilterMode('chains')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterMode === 'chains'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                : 'bg-[var(--bg-subtle)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Prereqs Met (Ready)</span>
              <Unlock size={15} className="text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono-token">
                {satisfiedTasks.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">ready to execute</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">All prerequisites are completed</p>
          </div>

          {/* Active Cascading Chains */}
          <div 
            onClick={() => setFilterMode('all')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                : 'bg-[var(--bg-subtle)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Active Flow Chains</span>
              <GitBranch size={15} className="text-[var(--primary)]" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-[var(--primary)] font-mono-token">
                {dependencyChains.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">cascading paths</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Multi-step dependencies between tasks</p>
          </div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Filter size={14} className="text-[var(--primary)]" />
            <span>View Filter:</span>
          </span>

          <div className="flex items-center bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border)] gap-1 text-xs font-bold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Flow ({connectedTasks.length})
            </button>

            <button
              onClick={() => setFilterMode('blockers')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'blockers'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-red-500'
              }`}
            >
              <ShieldAlert size={12} />
              <span>Critical Blockers ({rootBlockers.length})</span>
            </button>

            <button
              onClick={() => setFilterMode('blocked')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'blocked'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-amber-500'
              }`}
            >
              <Lock size={12} />
              <span>Blocked Tasks ({blockedTasks.length})</span>
            </button>

            <button
              onClick={() => setFilterMode('matrix')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'matrix'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Layers size={12} />
              <span>Dependency Matrix Table</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-3 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search tasks, assignees..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {connectedTasks.length === 0 ? (
        /* Empty State */
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <GitBranch size={32} />
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">No Task Dependencies Linked Yet</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md">
            Connect tasks together by defining prerequisites. When a task is marked as blocking or blocked, you will see real-time critical path flows and execution bottlenecks here.
          </p>
          <button
            onClick={() => {
              if (tasks.length > 0) {
                setSelectedTaskIdForDeps(tasks[0].id);
              }
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Select a Task to Configure Dependencies</span>
          </button>
        </div>
      ) : filterMode === 'matrix' ? (
        /* Dependency Matrix Table View */
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Task Dependency Matrix</h3>
              <p className="text-xs text-[var(--text-secondary)]">Complete overview of prerequisites, blocking items, and execution status.</p>
            </div>
            <span className="text-xs font-bold text-[var(--text-muted)] font-mono-token">
              {filteredAnalysis.length} items evaluated
            </span>
          </div>

          <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3">Task & Status</th>
                  <th className="px-4 py-3">Upstream Prerequisites</th>
                  <th className="px-4 py-3">Downstream Blocked Tasks</th>
                  <th className="px-4 py-3">Assignee & Squad</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                {filteredAnalysis.map(({ task, isBlocked, totalPrerequisites, completedPrerequisites, blockingTasks, dependentTasks }) => {
                  const taskAssignees = team.filter(m => task.assigneeIds?.includes(m.id));
                  const isComplete = task.status === 'complete';

                  return (
                    <tr key={task.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => onToggleStatus(task.id)}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                              isComplete
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-[var(--border)] hover:border-[var(--primary)]'
                            }`}
                            title={isComplete ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {isComplete && <Check size={10} strokeWidth={3} />}
                          </button>
                          <div>
                            <span 
                              onClick={() => setSelectedTaskForEdit(task)}
                              className={`font-semibold cursor-pointer hover:text-[var(--primary)] ${
                                isComplete ? 'line-through text-[var(--text-muted)]' : ''
                              }`}
                            >
                              <HighlightText text={task.title} query={searchFilter} />
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                task.priority === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                                task.priority === 'high' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]'
                              }`}>
                                {task.priority}
                              </span>
                              {task.time && (
                                <span className="text-[10px] font-mono-token text-[var(--primary)]">
                                  {formatTime12(task.time)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Upstream Prerequisites */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {totalPrerequisites === 0 ? (
                          <span className="text-[11px] text-[var(--text-muted)] italic">None (Independent)</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              {isBlocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded">
                                  <Lock size={10} className="animate-pulse" />
                                  <span>Blocked ({blockingTasks.length} pending)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                  <Unlock size={10} />
                                  <span>All {totalPrerequisites} Satisfied</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)] truncate">
                              {completedPrerequisites}/{totalPrerequisites} finished
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Downstream Blocked Tasks */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {dependentTasks.length === 0 ? (
                          <span className="text-[11px] text-[var(--text-muted)] italic">No downstream dependents</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                              !isComplete
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}>
                              <ArrowRight size={10} />
                              <span>{dependentTasks.length} downstream {dependentTasks.length === 1 ? 'task' : 'tasks'}</span>
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)] truncate" title={dependentTasks.map(d => d.title).join(', ')}>
                              {dependentTasks.map(d => d.title).join(', ')}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {taskAssignees.length > 0 ? (
                            taskAssignees.map(m => (
                              <div key={m.id} className="flex items-center gap-1 text-[11px] text-[var(--text-primary)]">
                                <div 
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                                  style={{ backgroundColor: m.avatarColor || '#4F46E5' }}
                                >
                                  {m.name[0]}
                                </div>
                                <span className="font-medium truncate max-w-[90px]">{m.name.split(' ')[0]}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)] italic">Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTaskIdForDeps(task.id)}
                            className="p-1.5 text-xs text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            title="Manage Task Dependencies"
                          >
                            <GitBranch size={13} />
                            <span>Link</span>
                          </button>
                          <button
                            onClick={() => setSelectedTaskForEdit(task)}
                            className="p-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
                            title="Edit Full Task Details"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Graph / Blocker Cards Flow */
        <div className="flex flex-col gap-6">
          {/* Section 1: Active Critical Blockers (Immediate Bottlenecks) */}
          {rootBlockers.length > 0 && (filterMode === 'all' || filterMode === 'blockers') && (
            <div className="bg-[var(--surface)] border-2 border-red-500/30 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
                      Active Execution Blockers ({rootBlockers.length})
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      These tasks are incomplete and directly holding back downstream deliverables from being executed.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 animate-pulse">
                  High Urgency
                </span>
              </div>

              {/* Blocker Cards with Cascading Downstream Links */}
              <div className="flex flex-col gap-4">
                {rootBlockers.map(({ task, dependentTasks }) => {
                  const isCollapsed = !!collapsedBlockers[task.id];
                  const assignees = team.filter(m => task.assigneeIds?.includes(m.id));

                  return (
                    <div 
                      key={task.id}
                      className="border border-red-500/40 bg-red-50/10 dark:bg-red-950/10 rounded-xl p-4.5 flex flex-col gap-3 transition-all"
                    >
                      {/* Blocker Card Top Bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Quick Toggle Checkbox */}
                          <button
                            onClick={() => onToggleStatus(task.id)}
                            className="mt-0.5 w-5 h-5 rounded-md border-2 border-red-500 flex items-center justify-center hover:bg-emerald-600 hover:border-emerald-600 hover:text-white transition-all cursor-pointer flex-shrink-0"
                            title="Click to complete this blocker and UNBLOCK downstream tasks"
                          >
                            <Check size={12} className="opacity-0 hover:opacity-100" />
                          </button>

                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wide">
                                Root Blocker
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                task.priority === 'critical' ? 'bg-red-500/20 text-red-600 border border-red-500/30' :
                                task.priority === 'high' ? 'bg-orange-500/20 text-orange-600 border border-orange-500/30' :
                                'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)]'
                              }`}>
                                {task.priority} Priority
                              </span>
                              {task.time && (
                                <span className="text-[11px] font-bold text-[var(--primary)] flex items-center gap-1">
                                  <Clock size={11} />
                                  <span>{formatTime12(task.time)}</span>
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-mono-token">
                                  <Calendar size={11} />
                                  <span>Due: {task.dueDate}</span>
                                </span>
                              )}
                            </div>

                            <h4 
                              onClick={() => setSelectedTaskForEdit(task)}
                              className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--primary)] cursor-pointer break-words"
                            >
                              <HighlightText text={task.title} query={searchFilter} />
                            </h4>

                            {assignees.length > 0 && (
                              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
                                <span>Owner:</span>
                                {assignees.map(a => (
                                  <div key={a.id} className="flex items-center gap-1 font-medium">
                                    <div 
                                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                      style={{ backgroundColor: a.avatarColor || '#4F46E5' }}
                                    >
                                      {a.name[0]}
                                    </div>
                                    <span className="text-[var(--text-primary)] font-bold">{a.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Blocker Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => onToggleStatus(task.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Mark complete to instantly unblock downstream tasks"
                          >
                            <CheckCircle2 size={14} />
                            <span>Mark Complete (Unblock)</span>
                          </button>

                          <button
                            onClick={() => setSelectedTaskIdForDeps(task.id)}
                            className="p-1.5 text-xs text-[var(--primary)] hover:bg-[var(--surface)] border border-[var(--border)] rounded-xl cursor-pointer"
                            title="Manage Dependencies"
                          >
                            <GitBranch size={14} />
                          </button>

                          <button
                            onClick={() => toggleBlockerCollapse(task.id)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Cascading Downstream Dependents List */}
                      {!isCollapsed && (
                        <div className="mt-2 pt-3 border-t border-red-500/20 pl-4">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-2">
                            <ArrowDown size={13} className="animate-bounce" />
                            <span>Holding back {dependentTasks.length} downstream {dependentTasks.length === 1 ? 'ticket' : 'tickets'} from starting:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {dependentTasks.map(dep => {
                              const depAssignees = team.filter(m => dep.assigneeIds?.includes(m.id));
                              const isDepDone = dep.status === 'complete';

                              return (
                                <div
                                  key={dep.id}
                                  onClick={() => setSelectedTaskForEdit(dep)}
                                  className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)] flex items-start justify-between gap-2 cursor-pointer shadow-2xs transition-all"
                                >
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      <span className={`text-xs font-bold truncate ${isDepDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                                        <HighlightText text={dep.title} query={searchFilter} />
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] mt-1">
                                      <span className="uppercase font-bold text-[var(--text-muted)]">{dep.priority}</span>
                                      {depAssignees.length > 0 && (
                                        <span>&bull; {depAssignees.map(a => a.name.split(' ')[0]).join(', ')}</span>
                                      )}
                                      {dep.time && (
                                        <span>&bull; {formatTime12(dep.time)}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                      Waiting
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Full Cascading Dependency Flow Chains */}
          {(filterMode === 'all' || filterMode === 'chains') && dependencyChains.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      Sequential Delivery Flow Chains ({dependencyChains.length})
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Visual execution pipelines showing the order tasks must be completed in.
                    </p>
                  </div>
                </div>
              </div>

              {/* Chain Renderings */}
              <div className="flex flex-col gap-6">
                {dependencyChains.map((chain, cIdx) => (
                  <div key={chain.id || cIdx} className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-2 border-b border-[var(--border)]">
                      <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <GitBranch size={13} className="text-[var(--primary)]" />
                        <span>Execution Pipeline #{cIdx + 1} &bull; Root: {chain.root.title}</span>
                      </span>
                      <span className="text-[10px] font-mono-token font-bold">
                        {chain.chainNodes.length} sequential steps
                      </span>
                    </div>

                    {/* Nodes in the Chain */}
                    <div className="flex flex-col gap-2 relative">
                      {chain.chainNodes.map((node, nIdx) => {
                        const isDone = node.task.status === 'complete';
                        const isLast = nIdx === chain.chainNodes.length - 1;
                        const assignees = team.filter(m => node.task.assigneeIds?.includes(m.id));

                        return (
                          <div key={node.task.id} className="flex items-center gap-3">
                            {/* Step Badge & Line */}
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                                isDone 
                                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                                  : node.isBlocked
                                  ? 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400'
                                  : 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              }`}>
                                {isDone ? <Check size={12} /> : nIdx + 1}
                              </div>
                            </div>

                            {/* Task Card Node */}
                            <div 
                              onClick={() => setSelectedTaskForEdit(node.task)}
                              className={`flex-1 p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                isDone
                                  ? 'bg-[var(--surface)] border-[var(--border)] opacity-75'
                                  : node.isBlocked
                                  ? 'bg-red-50/10 dark:bg-red-950/10 border-red-500/40 shadow-xs'
                                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)] shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleStatus(node.task.id);
                                  }}
                                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer ${
                                    isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[var(--border)] hover:border-[var(--primary)]'
                                  }`}
                                >
                                  {isDone && <Check size={10} />}
                                </button>
                                <span className={`text-xs font-semibold truncate ${isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                                  <HighlightText text={node.task.title} query={searchFilter} />
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {node.isBlocked ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1">
                                    <Lock size={10} />
                                    <span>Blocked</span>
                                  </span>
                                ) : isDone ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Done
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                                    Ready
                                  </span>
                                )}

                                {assignees.length > 0 && (
                                  <span className="text-[10px] text-[var(--text-secondary)] font-medium hidden sm:inline">
                                    {assignees[0].name.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Dependency Manager Modal */}
      {activeTaskForDeps && (
        <TaskDependencyModal
          isOpen={!!selectedTaskIdForDeps}
          onClose={() => setSelectedTaskIdForDeps(null)}
          task={activeTaskForDeps}
          allTasks={allTasks}
          team={team}
          onUpdateDependencies={(taskId: string, newDependsOnTaskIds: string[]) => {
            const target = allTasks.find(t => t.id === taskId) || activeTaskForDeps;
            onUpdateTask({
              ...target,
              dependsOnTaskIds: newDependsOnTaskIds
            });
          }}
        />
      )}

      {/* Full Task Edit Modal */}
      {selectedTaskForEdit && (
        <TaskEditModal
          isOpen={!!selectedTaskForEdit}
          onClose={() => setSelectedTaskForEdit(null)}
          task={selectedTaskForEdit}
          allTasks={allTasks}
          team={team}
          groups={groups}
          userStories={userStories}
          defects={defects}
          releases={releases}
          currentDateStr={currentDateStr}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onAddComment={onAddComment}
        />
      )}
    </div>
  );
};
