import React, { useState } from 'react';
import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  Defect, 
  Release, 
  Priority, 
  TaskStatus,
  BlueprintItem 
} from '../../types';
import { TaskCard } from './TaskCard';
import { 
  Plus, 
  Flame, 
  CheckCircle2, 
  Zap,
  Layers,
  Users,
  CheckSquare,
  Building2,
  Globe2,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  AlertTriangle,
  Calendar,
  Filter,
  Search,
  X,
  UserCheck,
  GripVertical,
  Lock
} from 'lucide-react';
import { isTaskOverdue } from '../../utils/date';

export type GroupByMode = 'priority' | 'group' | 'status' | 'source';

interface TaskBoardProps {
  tasks: Task[];
  dateStr: string;
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  selectedReleaseId: string | null;
  searchQuery: string;
  blueprintSchedule: BlueprintItem[];
  onToggleStatus: (taskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onAddComment: (taskId: string, text: string) => void;
  onApplyBlueprint: (items: BlueprintItem[]) => void;
  onReorderTasks?: (reorderedTasks: Task[]) => void;
  onMoveTask?: (
    taskId: string,
    updates: Partial<Task>,
    targetTaskId?: string,
    position?: 'before' | 'after'
  ) => void;
}

interface BucketConfig {
  id: string;
  title: string;
  subtitle?: string;
  color: string;
  badge?: string;
  filter: (task: Task) => boolean;
  getDefaultProps: () => Partial<Task>;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  dateStr,
  team,
  groups,
  userStories,
  defects,
  releases,
  selectedReleaseId,
  searchQuery,
  blueprintSchedule,
  onToggleStatus,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onAddComment,
  onApplyBlueprint,
  onReorderTasks,
  onMoveTask
}) => {
  // Grouping mode
  const [groupBy, setGroupBy] = useState<GroupByMode>('priority');

  // Filter states
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterBlockedOnly, setFilterBlockedOnly] = useState(false);

  // Quick inputs per bucket
  const [quickInput, setQuickInput] = useState<{ [bucketId: string]: string }>({});

  // Completed task collapse states
  const [showCompleted, setShowCompleted] = useState<{ [bucketId: string]: boolean }>({});

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [lastMoveNotice, setLastMoveNotice] = useState<string | null>(null);

  // Filter tasks for active date
  const dayTasks = tasks.filter(t => t.dateStr === dateStr);

  // Apply release filter if active
  const scopedTasks = selectedReleaseId
    ? dayTasks.filter(t => !t.releaseId || t.releaseId === selectedReleaseId)
    : dayTasks;

  // Overdue tasks calculation
  const overdueTasks = scopedTasks.filter(t => isTaskOverdue(t.dueDate, t.status, dateStr));
  const overdueCount = overdueTasks.length;

  // Blocked tasks calculation
  const blockedTasks = scopedTasks.filter(t => {
    if (t.status === 'complete' || !t.dependsOnTaskIds || t.dependsOnTaskIds.length === 0) return false;
    return t.dependsOnTaskIds.some(depId => {
      const dep = tasks.find(p => p.id === depId);
      return dep && dep.status !== 'complete';
    });
  });
  const blockedCount = blockedTasks.length;

  // Priority counts on scoped tasks
  const criticalCount = scopedTasks.filter(t => t.priority === 'critical').length;
  const highCount = scopedTasks.filter(t => t.priority === 'high').length;
  const mediumCount = scopedTasks.filter(t => t.priority === 'medium').length;
  const lowCount = scopedTasks.filter(t => t.priority === 'low').length;

  // Assignee counts on scoped tasks
  const unassignedCount = scopedTasks.filter(t => !t.assigneeIds || t.assigneeIds.length === 0).length;

  // Multi-tier filtering pipeline
  // 1. Overdue / Blocked filters
  let baseTasks = scopedTasks;
  if (filterOverdueOnly) {
    baseTasks = baseTasks.filter(t => isTaskOverdue(t.dueDate, t.status, dateStr));
  }
  if (filterBlockedOnly) {
    baseTasks = baseTasks.filter(t => {
      if (t.status === 'complete' || !t.dependsOnTaskIds || t.dependsOnTaskIds.length === 0) return false;
      return t.dependsOnTaskIds.some(depId => {
        const dep = tasks.find(p => p.id === depId);
        return dep && dep.status !== 'complete';
      });
    });
  }

  // 2. Priority filter (Critical, High, Medium, Low)
  if (selectedPriorities.length > 0) {
    baseTasks = baseTasks.filter(t => selectedPriorities.includes(t.priority));
  }

  // 3. Assignee filter (specific member IDs or unassigned)
  if (selectedAssigneeIds.length > 0) {
    baseTasks = baseTasks.filter(t => {
      if (selectedAssigneeIds.includes('unassigned') && (!t.assigneeIds || t.assigneeIds.length === 0)) {
        return true;
      }
      return t.assigneeIds && t.assigneeIds.some(id => selectedAssigneeIds.includes(id));
    });
  }

  // 4. Search query
  const filteredTasks = searchQuery.trim()
    ? baseTasks.filter(t => {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesAssignee = team.some(m => t.assigneeIds && t.assigneeIds.includes(m.id) && m.name.toLowerCase().includes(q));
        const matchesGroup = groups.some(g => t.groupIds && t.groupIds.includes(g.id) && g.name.toLowerCase().includes(q));
        const matchesCustomer = t.customerName ? t.customerName.toLowerCase().includes(q) : false;
        const matchesStory = userStories.some(s => s.id === t.userStoryId && ((s.adoId && String(s.adoId).toLowerCase().includes(q)) || s.title.toLowerCase().includes(q)));
        const matchesDefect = defects.some(d => d.id === t.defectId && ((d.adoId && String(d.adoId).toLowerCase().includes(q)) || d.title.toLowerCase().includes(q)));
        const matchesComments = t.comments ? t.comments.some(c => c.text.toLowerCase().includes(q) || c.author.toLowerCase().includes(q)) : false;
        return matchesTitle || matchesAssignee || matchesGroup || matchesCustomer || matchesStory || matchesDefect || matchesComments;
      })
    : baseTasks;

  // Active filter count indicator
  const activeFilterCount = 
    (selectedPriorities.length > 0 ? 1 : 0) + 
    (selectedAssigneeIds.length > 0 ? 1 : 0) + 
    (filterOverdueOnly ? 1 : 0) + 
    (filterBlockedOnly ? 1 : 0) + 
    (searchQuery.trim() ? 1 : 0);

  // Metric rollups
  const totalCount = scopedTasks.length;
  const completedCount = scopedTasks.filter(t => t.status === 'complete').length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const highPending = scopedTasks.filter(t => (t.priority === 'high' || t.priority === 'critical') && t.status !== 'complete').length;

  // Priority toggle handler
  const handleTogglePriority = (priority: Priority) => {
    setSelectedPriorities(prev =>
      prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
    );
  };

  // Assignee toggle handler
  const handleToggleAssignee = (assigneeId: string) => {
    setSelectedAssigneeIds(prev =>
      prev.includes(assigneeId) ? prev.filter(id => id !== assigneeId) : [...prev, assigneeId]
    );
  };

  // Clear all active filters
  const handleClearAllFilters = () => {
    setSelectedPriorities([]);
    setSelectedAssigneeIds([]);
    setFilterOverdueOnly(false);
    setFilterBlockedOnly(false);
  };

  // Construct Dynamic Buckets according to GroupBy mode
  const getBucketConfigs = (): BucketConfig[] => {
    switch (groupBy) {
      case 'priority':
        return [
          {
            id: 'critical',
            title: 'Critical Focus & Urgent Blockers',
            subtitle: 'P0 incidents, customer SLAs, and blocking defects',
            color: 'var(--critical)',
            badge: 'P0 / Critical',
            filter: (t) => t.priority === 'critical',
            getDefaultProps: () => ({ priority: 'critical' })
          },
          {
            id: 'high',
            title: 'High Priority — Daily Commitments',
            subtitle: 'Non-negotiable sprint goals and core deliverables',
            color: 'var(--high)',
            badge: 'P1 / Focus',
            filter: (t) => t.priority === 'high',
            getDefaultProps: () => ({ priority: 'high' })
          },
          {
            id: 'medium',
            title: 'Medium Priority — Sprint Progress',
            subtitle: 'Active story delivery, test executions, and integrations',
            color: 'var(--medium)',
            badge: 'P2 / Sprint',
            filter: (t) => t.priority === 'medium',
            getDefaultProps: () => ({ priority: 'medium' })
          },
          {
            id: 'low',
            title: 'Low Priority & Housekeeping',
            subtitle: 'Tooling, housekeeping, review tickets, and backlog notes',
            color: 'var(--low)',
            badge: 'P3 / Low',
            filter: (t) => t.priority === 'low',
            getDefaultProps: () => ({ priority: 'low' })
          }
        ];

      case 'group':
        return [
          ...groups.map(g => ({
            id: g.id,
            title: g.name,
            subtitle: g.purpose || 'Squad deliveries and functional focus',
            color: g.color || 'var(--primary)',
            badge: `${g.memberIds?.length || 0} Members`,
            filter: (t: Task) => t.groupIds.includes(g.id),
            getDefaultProps: () => ({ groupIds: [g.id] })
          })),
          {
            id: 'unassigned-group',
            title: 'General / Unassigned Squad',
            subtitle: 'Tasks without a dedicated squad assignment',
            color: 'var(--text-muted)',
            badge: 'General',
            filter: (t: Task) => !t.groupIds || t.groupIds.length === 0,
            getDefaultProps: () => ({ groupIds: [] })
          }
        ];

      case 'status':
        return [
          {
            id: 'pending',
            title: 'To Do / Pending',
            subtitle: 'Queued for today, awaiting active execution',
            color: 'var(--text-secondary)',
            badge: 'Backlog',
            filter: (t) => t.status === 'pending',
            getDefaultProps: () => ({ status: 'pending' })
          },
          {
            id: 'partial',
            title: 'In Progress / Partial',
            subtitle: 'Currently underway or in pairing/review',
            color: 'var(--medium)',
            badge: 'Active',
            filter: (t) => t.status === 'partial',
            getDefaultProps: () => ({ status: 'partial' })
          },
          {
            id: 'complete',
            title: 'Done & Verified',
            subtitle: 'Completed deliverables with closed verification',
            color: 'var(--low)',
            badge: 'Closed',
            filter: (t) => t.status === 'complete',
            getDefaultProps: () => ({ status: 'complete', completedAt: new Date().toISOString() })
          }
        ];

      case 'source':
        return [
          {
            id: 'internal',
            title: 'Internal Dev ADO',
            subtitle: 'Core dev features, internal test suites, and regression',
            color: 'var(--internal-ado)',
            badge: 'Dev ADO',
            filter: (t) => !t.sourceInstance || t.sourceInstance === 'internal',
            getDefaultProps: () => ({ sourceInstance: 'internal' })
          },
          {
            id: 'external',
            title: 'External OPS ADO',
            subtitle: 'Customer reported escalations and client SLA tickets',
            color: 'var(--external-ado)',
            badge: 'OPS ADO',
            filter: (t) => t.sourceInstance === 'external',
            getDefaultProps: () => ({ sourceInstance: 'external' })
          },
          {
            id: 'local',
            title: 'Local & Hub Tasks',
            subtitle: 'Custom standup notes and direct board items',
            color: 'var(--primary)',
            badge: 'Local',
            filter: (t) => t.sourceInstance === 'local',
            getDefaultProps: () => ({ sourceInstance: 'local' })
          }
        ];
    }
  };

  const buckets = getBucketConfigs();

  const handleQuickAdd = (bucket: BucketConfig) => {
    const text = (quickInput[bucket.id] || '').trim();
    if (!text) return;

    onAddTask({
      title: text,
      priority: 'medium',
      status: 'pending',
      dateStr,
      dueDate: dateStr,
      assigneeIds: [],
      groupIds: [],
      releaseId: selectedReleaseId || undefined,
      ...bucket.getDefaultProps()
    });

    setQuickInput(prev => ({ ...prev, [bucket.id]: '' }));
  };

  // Helper to show brief feedback toast notice
  const notifyMove = (msg: string) => {
    setLastMoveNotice(msg);
    setTimeout(() => {
      setLastMoveNotice(null);
    }, 2800);
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumnId(null);
    setDragOverTaskId(null);
    setDropPosition(null);
  };

  const handleDragOverCard = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientY = e.clientY;
    const midpoint = targetRect.top + targetRect.height / 2;
    const position = clientY < midpoint ? 'before' : 'after';

    if (dragOverTaskId !== targetTaskId || dropPosition !== position) {
      setDragOverTaskId(targetTaskId);
      setDropPosition(position);
    }
  };

  const handleDragLeaveCard = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (dragOverTaskId === targetTaskId) {
      // Don't clear immediately if moving inside children
    }
  };

  const handleDropOnCard = (e: React.DragEvent, targetTaskId: string, bucket: BucketConfig) => {
    e.preventDefault();
    e.stopPropagation();

    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId || taskId === targetTaskId) {
      handleDragEnd();
      return;
    }

    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) {
      handleDragEnd();
      return;
    }

    // Determine target updates based on bucket
    const bucketUpdates = bucket.getDefaultProps();

    if (onMoveTask) {
      onMoveTask(taskId, bucketUpdates, targetTaskId, dropPosition || 'before');
      notifyMove(`Reordered task next to deliverable`);
    } else {
      // Fallback local update
      onUpdateTask({ ...currentTask, ...bucketUpdates });
    }

    handleDragEnd();
  };

  const handleDragOverColumn = (e: React.DragEvent, bucketId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== bucketId) {
      setDragOverColumnId(bucketId);
    }
  };

  const handleDragLeaveColumn = (e: React.DragEvent, bucketId: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverColumnId === bucketId) {
      setDragOverColumnId(null);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, bucket: BucketConfig) => {
    e.preventDefault();
    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) {
      handleDragEnd();
      return;
    }

    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) {
      handleDragEnd();
      return;
    }

    const bucketUpdates = bucket.getDefaultProps();

    if (onMoveTask) {
      onMoveTask(taskId, bucketUpdates);
      notifyMove(`Moved task to ${bucket.title}`);
    } else {
      onUpdateTask({ ...currentTask, ...bucketUpdates });
    }

    handleDragEnd();
  };

  // Keyboard / Touch accessibility reordering
  const handleMoveCardRelatively = (taskId: string, direction: 'up' | 'down') => {
    const taskIndex = filteredTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const targetIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredTasks.length) return;

    const targetTaskId = filteredTasks[targetIndex].id;
    if (onMoveTask) {
      onMoveTask(taskId, {}, targetTaskId, direction === 'up' ? 'before' : 'after');
      notifyMove(`Moved task ${direction}`);
    }
  };

  const handleMoveToPriority = (taskId: string, priority: Priority) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    onUpdateTask({ ...t, priority });
    notifyMove(`Set task priority to ${priority}`);
  };

  const handleMoveToGroup = (taskId: string, groupId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    onUpdateTask({ ...t, groupIds: [groupId] });
    const grpName = groups.find(g => g.id === groupId)?.name || 'Squad';
    notifyMove(`Assigned to ${grpName}`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Insights & Execution Health Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Progress metric */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)] font-bold text-base shadow-xs">
              {progressPercent}%
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">Daily Execution Rate</span>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  ({completedCount}/{totalCount} tasks closed)
                </span>
              </div>
              {/* Progress bar line */}
              <div className="w-48 sm:w-64 h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden mt-1.5 border border-[var(--border)]">
                <div 
                  className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick status signals, Overdue Warning Alert, Blocked Warning Alert & Blueprint Seeder */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Blocked Alert Warning Badge */}
            {blockedCount > 0 && (
              <button
                onClick={() => setFilterBlockedOnly(!filterBlockedOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  filterBlockedOnly
                    ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-500/30'
                    : 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30 hover:bg-red-600 hover:text-white'
                }`}
                title="Click to toggle filtering only blocked tasks"
              >
                <Lock size={14} className={filterBlockedOnly ? '' : 'animate-pulse text-red-500'} />
                <span>{blockedCount} Blocked {blockedCount === 1 ? 'Task' : 'Tasks'}</span>
                <span className="text-[10px] opacity-80 underline ml-1">
                  {filterBlockedOnly ? 'Show All' : 'Filter'}
                </span>
              </button>
            )}

            {/* Overdue Alert Warning Badge */}
            {overdueCount > 0 && (
              <button
                onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  filterOverdueOnly
                    ? 'bg-[var(--critical)] text-white border-[var(--critical)] ring-2 ring-[var(--critical)]/30'
                    : 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)] hover:bg-[var(--critical)] hover:text-white'
                }`}
                title="Click to toggle filtering only overdue tasks"
              >
                <AlertTriangle size={14} className="animate-pulse" />
                <span>{overdueCount} Overdue {overdueCount === 1 ? 'Task' : 'Tasks'}</span>
                <span className="text-[10px] opacity-80 underline ml-1">
                  {filterOverdueOnly ? 'Show All' : 'Filter'}
                </span>
              </button>
            )}

            {highPending > 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--critical-bg)] border border-[var(--critical-border)] text-[var(--critical)] text-xs font-bold">
                <Flame size={14} />
                <span>{highPending} High priority pending</span>
              </div>
            ) : totalCount > 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--low-bg)] border border-[var(--low-border)] text-[var(--low)] text-xs font-bold">
                <CheckCircle2 size={14} />
                <span>High priority cleared</span>
              </div>
            ) : null}

            {/* Quick Blueprint Seeder Button */}
            <button
              onClick={() => onApplyBlueprint(blueprintSchedule)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-hover)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all shadow-xs cursor-pointer"
              title="Pre-populate standard daily blocks (Team Check-in, Deep Work, Sanity checks)"
            >
              <Zap size={14} className="text-[var(--medium)]" />
              <span>Load Blueprint</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Filter Bar (Priority: Critical, High, Medium, Low & Assignees) */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col gap-3.5">
        {/* Filter Bar Header & Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Filter size={15} className="text-[var(--primary)]" />
              <span>Filter Workspace</span>
            </div>
            
            {/* Active Filters count chip */}
            {activeFilterCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] font-medium">
                All priority & assignee items visible
              </span>
            )}

            {/* Search Query indicator pill */}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Search size={11} className="text-amber-600 dark:text-amber-400" />
                <span className="truncate max-w-[150px]">Match: &ldquo;{searchQuery.trim()}&rdquo;</span>
              </span>
            )}

            {/* Scoped Count summary */}
            <span className="text-xs text-[var(--text-secondary)] font-medium hidden sm:inline-block">
              Showing <strong className="text-[var(--text-primary)] font-bold">{filteredTasks.length}</strong> of {scopedTasks.length} tasks
            </span>
          </div>

          {/* Quick Actions (Reset Filters / Overdue Toggle / Blocked Toggle) */}
          <div className="flex items-center gap-2">
            {blockedCount > 0 && (
              <button
                onClick={() => setFilterBlockedOnly(!filterBlockedOnly)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  filterBlockedOnly
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30 hover:bg-red-600 hover:text-white'
                }`}
                title="Filter tasks blocked by incomplete dependencies"
              >
                <Lock size={12} className={filterBlockedOnly ? '' : 'animate-pulse text-red-500'} />
                <span>Blocked ({blockedCount})</span>
              </button>
            )}

            {overdueCount > 0 && (
              <button
                onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  filterOverdueOnly
                    ? 'bg-[var(--critical)] text-white border-[var(--critical)] shadow-xs'
                    : 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)] hover:bg-[var(--critical)] hover:text-white'
                }`}
                title="Filter tasks that passed their due date"
              >
                <AlertTriangle size={12} className={filterOverdueOnly ? '' : 'animate-pulse'} />
                <span>Overdue ({overdueCount})</span>
              </button>
            )}

            {activeFilterCount > 0 && (
              <button
                onClick={handleClearAllFilters}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-[var(--critical)] hover:bg-[var(--critical-bg)] border border-transparent hover:border-[var(--critical-border)] transition-all flex items-center gap-1 cursor-pointer"
                title="Reset all priority and assignee filters"
              >
                <X size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Rows: Priority & Assignee */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Priority Filters (Critical, High, Medium, Low) */}
          <div className="lg:col-span-5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                <span>Priority:</span>
                {selectedPriorities.length > 0 && (
                  <span className="text-[10px] text-[var(--primary)] font-extrabold">({selectedPriorities.length} selected)</span>
                )}
              </span>
              {selectedPriorities.length > 0 && (
                <button
                  onClick={() => setSelectedPriorities([])}
                  className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                >
                  Clear Priority
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* All Priority Button */}
              <button
                onClick={() => setSelectedPriorities([])}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedPriorities.length === 0
                    ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]/20'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                All ({scopedTasks.length})
              </button>

              {/* Critical */}
              <button
                onClick={() => handleTogglePriority('critical')}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedPriorities.includes('critical')
                    ? 'bg-[var(--critical)] text-white border-[var(--critical)] shadow-xs ring-2 ring-[var(--critical)]/30'
                    : 'bg-[var(--critical-bg)]/40 text-[var(--critical)] border-[var(--critical-border)] hover:bg-[var(--critical-bg)]'
                }`}
              >
                <Flame size={12} className={selectedPriorities.includes('critical') ? 'text-white' : 'text-[var(--critical)]'} />
                <span>Critical</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  selectedPriorities.includes('critical') ? 'bg-white/25 text-white' : 'bg-[var(--critical-bg)] text-[var(--critical)]'
                }`}>
                  {criticalCount}
                </span>
              </button>

              {/* High */}
              <button
                onClick={() => handleTogglePriority('high')}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedPriorities.includes('high')
                    ? 'bg-[var(--critical)] text-white border-[var(--critical)] shadow-xs ring-2 ring-[var(--critical)]/30'
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--critical-border)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--high)]" />
                <span>High</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  selectedPriorities.includes('high') ? 'bg-white/25 text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                }`}>
                  {highCount}
                </span>
              </button>

              {/* Medium */}
              <button
                onClick={() => handleTogglePriority('medium')}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedPriorities.includes('medium')
                    ? 'bg-[var(--medium)] text-white border-[var(--medium)] shadow-xs ring-2 ring-[var(--medium)]/30'
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--medium-border)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--medium)]" />
                <span>Medium</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  selectedPriorities.includes('medium') ? 'bg-white/25 text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                }`}>
                  {mediumCount}
                </span>
              </button>

              {/* Low */}
              <button
                onClick={() => handleTogglePriority('low')}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedPriorities.includes('low')
                    ? 'bg-[var(--low)] text-white border-[var(--low)] shadow-xs ring-2 ring-[var(--low)]/30'
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--low-border)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--low)]" />
                <span>Low</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  selectedPriorities.includes('low') ? 'bg-white/25 text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                }`}>
                  {lowCount}
                </span>
              </button>
            </div>
          </div>

          {/* Assignee Filter Section */}
          <div className="lg:col-span-7 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                <Users size={12} />
                <span>Assignee:</span>
                {selectedAssigneeIds.length > 0 && (
                  <span className="text-[10px] text-[var(--primary)] font-extrabold">({selectedAssigneeIds.length} selected)</span>
                )}
              </span>
              {selectedAssigneeIds.length > 0 && (
                <button
                  onClick={() => setSelectedAssigneeIds([])}
                  className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                >
                  Clear Assignees
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* All Assignees */}
              <button
                onClick={() => setSelectedAssigneeIds([])}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedAssigneeIds.length === 0
                    ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]/20'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                All Members
              </button>

              {/* Team Members Chips */}
              {team.map(member => {
                const memberTaskCount = scopedTasks.filter(t => t.assigneeIds && t.assigneeIds.includes(member.id)).length;
                const isSelected = selectedAssigneeIds.includes(member.id);
                const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);

                return (
                  <button
                    key={member.id}
                    onClick={() => handleToggleAssignee(member.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]'
                    }`}
                    title={`${member.name} (${member.role})`}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white flex-shrink-0 shadow-xs"
                      style={{ backgroundColor: member.avatarColor || 'var(--primary)' }}
                    >
                      {initials}
                    </span>
                    <span className="truncate max-w-[105px]">{member.name.split(' ')[0]}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                    }`}>
                      {memberTaskCount}
                    </span>
                  </button>
                );
              })}

              {/* Unassigned Chip */}
              <button
                onClick={() => handleToggleAssignee('unassigned')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedAssigneeIds.includes('unassigned')
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <span className="italic">Unassigned</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedAssigneeIds.includes('unassigned') ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                }`}>
                  {unassignedCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grouping View Switcher & Drag-and-Drop Guidance Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Layers size={14} className="text-[var(--primary)]" />
            <span>Group By:</span>
          </span>

          <div className="flex items-center bg-[var(--surface-hover)] p-1 rounded-xl border border-[var(--border)] gap-1">
            <button
              onClick={() => setGroupBy('priority')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'priority'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Flame size={13} className={groupBy === 'priority' ? 'text-[var(--critical)]' : ''} />
              <span>Priority</span>
            </button>

            <button
              onClick={() => setGroupBy('group')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'group'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Users size={13} className={groupBy === 'group' ? 'text-[var(--primary)]' : ''} />
              <span>Squad / Pod</span>
            </button>

            <button
              onClick={() => setGroupBy('status')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'status'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CheckSquare size={13} className={groupBy === 'status' ? 'text-[var(--low)]' : ''} />
              <span>Status</span>
            </button>

            <button
              onClick={() => setGroupBy('source')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'source'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Building2 size={13} className={groupBy === 'source' ? 'text-[var(--internal-ado)]' : ''} />
              <span>ADO Source</span>
            </button>
          </div>

          {/* Quick Overdue Filter Toggle */}
          {overdueCount > 0 && (
            <button
              onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
              className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                filterOverdueOnly
                  ? 'bg-[var(--critical)] text-white border-[var(--critical)] shadow-xs'
                  : 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)] hover:bg-[var(--critical)] hover:text-white'
              }`}
            >
              <AlertTriangle size={12} />
              <span>{filterOverdueOnly ? 'Show All Tasks' : `Overdue Only (${overdueCount})`}</span>
            </button>
          )}
        </div>

        {/* DnD Tip & Move Notice Badge */}
        <div className="flex items-center gap-2">
          {lastMoveNotice ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 rounded-xl text-xs font-bold animate-in fade-in duration-150">
              <Sparkles size={13} />
              <span>{lastMoveNotice}</span>
            </div>
          ) : (
            <div className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <Info size={13} />
              <span>Drag & drop cards to reorder or move between group buckets</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Lanes Container */}
      <div className={`grid gap-6 items-start ${
        buckets.length <= 3 
          ? 'grid-cols-1 lg:grid-cols-3' 
          : buckets.length === 4 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' 
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
      }`}>
        {buckets.map(bucket => {
          const laneTasks = filteredTasks.filter(bucket.filter);
          const activeTasks = groupBy === 'status' 
            ? laneTasks 
            : laneTasks.filter(t => t.status !== 'complete');
          const doneTasks = groupBy === 'status' 
            ? [] 
            : laneTasks.filter(t => t.status === 'complete');
          const isCompletedOpen = showCompleted[bucket.id] ?? false;
          const isColumnHovered = dragOverColumnId === bucket.id;

          return (
            <div 
              key={bucket.id}
              onDragOver={(e) => handleDragOverColumn(e, bucket.id)}
              onDragLeave={(e) => handleDragLeaveColumn(e, bucket.id)}
              onDrop={(e) => handleDropOnColumn(e, bucket)}
              className={`bg-[var(--surface)] border rounded-2xl p-4 flex flex-col gap-3 shadow-xs transition-all duration-200 ${
                isColumnHovered
                  ? 'border-[var(--primary)] ring-4 ring-[var(--primary-light)] bg-[var(--surface-hover)] scale-[1.01] shadow-lg'
                  : draggedTaskId
                  ? 'border-dashed border-[var(--primary)]/40 bg-[var(--surface)]/95 shadow-sm'
                  : 'border-[var(--border)]'
              }`}
            >
              {/* Lane Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight truncate">
                    {bucket.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {bucket.badge && (
                    <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 rounded-md">
                      {bucket.badge}
                    </span>
                  )}
                  <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                    {activeTasks.length}
                  </span>
                </div>
              </div>

              {/* Fast Add Input for Lane */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={`+ Add to ${bucket.title.split(' ')[0]}...`}
                  value={quickInput[bucket.id] || ''}
                  onChange={(e) => setQuickInput({ ...quickInput, [bucket.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd(bucket)}
                  className="flex-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] placeholder-[var(--text-muted)]"
                />
                <button
                  onClick={() => handleQuickAdd(bucket)}
                  className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--text-primary)] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Active Tasks Drop Target List */}
              <div className={`flex flex-col gap-2.5 min-h-[140px] rounded-xl p-1 transition-all ${
                isColumnHovered ? 'bg-[var(--primary-light)]/30 ring-2 ring-dashed ring-[var(--primary)]/50' : ''
              }`}>
                {activeTasks.length > 0 ? (
                  activeTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      allTasks={tasks}
                      team={team}
                      groups={groups}
                      userStories={userStories}
                      defects={defects}
                      releases={releases}
                      currentDateStr={dateStr}
                      searchQuery={searchQuery}
                      isDragging={draggedTaskId === task.id}
                      isDragOver={dragOverTaskId === task.id}
                      dropPosition={dragOverTaskId === task.id ? dropPosition : null}
                      onToggleStatus={onToggleStatus}
                      onUpdateTask={onUpdateTask}
                      onDeleteTask={onDeleteTask}
                      onAddComment={onAddComment}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOverCard={handleDragOverCard}
                      onDragLeaveCard={handleDragLeaveCard}
                      onDropOnCard={(e, targetId) => handleDropOnCard(e, targetId, bucket)}
                      onMoveUp={() => handleMoveCardRelatively(task.id, 'up')}
                      onMoveDown={() => handleMoveCardRelatively(task.id, 'down')}
                      onMoveToPriority={(pri) => handleMoveToPriority(task.id, pri)}
                      onMoveToGroup={(grpId) => handleMoveToGroup(task.id, grpId)}
                    />
                  ))
                ) : (
                  <div className={`py-8 text-center flex flex-col items-center justify-center rounded-xl border border-dashed transition-all ${
                    isColumnHovered 
                      ? 'border-[var(--primary)] bg-[var(--primary-light)]/30 text-[var(--primary)]' 
                      : 'border-[var(--border)] text-[var(--text-muted)]'
                  }`}>
                    {isColumnHovered ? (
                      <>
                        <ArrowRightLeft size={22} className="mb-1.5 text-[var(--primary)] animate-bounce" />
                        <p className="text-xs font-bold">Drop here to move into {bucket.title}</p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={22} className="mb-1.5 opacity-30 text-[var(--primary)]" />
                        <p className="text-xs font-medium">No tasks in {bucket.title.split(' ')[0]}.</p>
                        <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Drag tasks here to assign</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Completed Tasks Toggle Drawer (if not in Status view) */}
              {doneTasks.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => setShowCompleted(prev => ({ ...prev, [bucket.id]: !isCompletedOpen }))}
                    className="w-full flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1.5 px-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <span>{doneTasks.length} Completed</span>
                    {isCompletedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isCompletedOpen && (
                    <div className="flex flex-col gap-2 mt-2">
                      {doneTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          allTasks={tasks}
                          team={team}
                          groups={groups}
                          userStories={userStories}
                          defects={defects}
                          releases={releases}
                          currentDateStr={dateStr}
                          searchQuery={searchQuery}
                          isDragging={draggedTaskId === task.id}
                          isDragOver={dragOverTaskId === task.id}
                          dropPosition={dragOverTaskId === task.id ? dropPosition : null}
                          onToggleStatus={onToggleStatus}
                          onUpdateTask={onUpdateTask}
                          onDeleteTask={onDeleteTask}
                          onAddComment={onAddComment}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOverCard={handleDragOverCard}
                          onDragLeaveCard={handleDragLeaveCard}
                          onDropOnCard={(e, targetId) => handleDropOnCard(e, targetId, bucket)}
                          onMoveUp={() => handleMoveCardRelatively(task.id, 'up')}
                          onMoveDown={() => handleMoveCardRelatively(task.id, 'down')}
                          onMoveToPriority={(pri) => handleMoveToPriority(task.id, pri)}
                          onMoveToGroup={(grpId) => handleMoveToGroup(task.id, grpId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating In-Flight Drag Visual Status Banner */}
      {draggedTaskId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface)] border-2 border-[var(--primary)] shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3.5 ring-4 ring-[var(--primary-light)] pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0 animate-bounce shadow-xs">
            <GripVertical size={18} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                {tasks.find(t => t.id === draggedTaskId)?.title || 'Task in flight'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 uppercase">
                In Transit
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-secondary)] font-medium">
              Drop on any lane to assign, or between cards to reorder
            </span>
          </div>
          <button
            onClick={handleDragEnd}
            className="ml-2 px-2.5 py-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg transition-colors cursor-pointer border border-[var(--border)]"
            title="Cancel dragging"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
