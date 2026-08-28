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
  Check, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Plus, 
  Building2, 
  Users, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  Flame, 
  Layers, 
  Sparkles, 
  Link as LinkIcon,
  ArrowRightLeft,
  Search,
  SlidersHorizontal,
  LayoutList
} from 'lucide-react';
import { isTaskOverdue, formatDueDateBadge } from '../../utils/date';
import { HighlightText } from '../common/HighlightText';
import { cleanAdoHtml } from '../../utils/formatAdoHtml';
import { getWorkItemAssignees } from '../../utils/assigneeUtils';
import { getTaskBlockedStatus } from '../../utils/taskDependencies';
import { TaskEditModal } from './TaskEditModal';
import { TaskDependencyModal } from './TaskDependencyModal';

export type ListGroupByMode = 'priority' | 'group' | 'status' | 'none';
export type SortField = 'priority' | 'dueDate' | 'title' | 'status' | 'assignee';
export type SortDirection = 'asc' | 'desc';

interface TaskListViewProps {
  tasks: Task[];
  allTasks: Task[];
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  standup?: Record<string, any>;
  currentDateStr: string;
  searchQuery: string;
  groupBy: 'priority' | 'group' | 'status';
  onToggleStatus: (taskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onAddComment: (taskId: string, text: string) => void;
  onPushToStandup?: (task: Task) => void;
  selectedReleaseId?: string | null;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  allTasks,
  team,
  groups,
  userStories,
  defects,
  releases,
  standup,
  currentDateStr,
  searchQuery,
  groupBy,
  onToggleStatus,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onAddComment,
  onPushToStandup,
  selectedReleaseId
}) => {
  const [activeGroupMode, setActiveGroupMode] = useState<ListGroupByMode>(groupBy);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [collapsedGroups, setCollapsedGroups] = useState<{ [groupId: string]: boolean }>({});
  const [quickInput, setQuickInput] = useState<{ [groupId: string]: string }>({});
  
  // Selected task for editing or dependencies
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dependencyTask, setDependencyTask] = useState<Task | null>(null);
  const [expandedCommentsTaskId, setExpandedCommentsTaskId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Keep activeGroupMode in sync if parent changes groupBy
  React.useEffect(() => {
    setActiveGroupMode(groupBy);
  }, [groupBy]);

  const toggleGroupCollapse = (id: string) => {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const priorityWeight: Record<Priority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };

  const statusWeight: Record<TaskStatus, number> = {
    pending: 0,
    partial: 1,
    complete: 2
  };

  // Sort function
  const sortTasks = (taskList: Task[]): Task[] => {
    return [...taskList].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'priority':
          comparison = (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2);
          break;
        case 'status':
          comparison = (statusWeight[a.status] ?? 0) - (statusWeight[b.status] ?? 0);
          break;
        case 'dueDate':
          const dateA = a.dueDate || '9999-99-99';
          const dateB = b.dueDate || '9999-99-99';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'assignee':
          const nameA = team.find(m => a.assigneeIds?.[0] === m.id)?.name || 'zzz';
          const nameB = team.find(m => b.assigneeIds?.[0] === m.id)?.name || 'zzz';
          comparison = nameA.localeCompare(nameB);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Group definitions
  interface ListGroup {
    id: string;
    title: string;
    color: string;
    badge?: string;
    tasks: Task[];
    getDefaultProps: () => Partial<Task>;
  }

  const groupsList: ListGroup[] = useMemo(() => {
    if (activeGroupMode === 'none') {
      return [
        {
          id: 'all',
          title: 'All Active Deliverables',
          color: 'var(--primary)',
          badge: `${tasks.length} Items`,
          tasks: sortTasks(tasks),
          getDefaultProps: () => ({ priority: 'medium', status: 'pending' })
        }
      ];
    }

    if (activeGroupMode === 'priority') {
      const priorityBuckets: { id: Priority; title: string; color: string; badge: string }[] = [
        { id: 'critical', title: 'Critical Focus & Urgent Blockers (P0)', color: 'var(--critical)', badge: 'P0 / Critical' },
        { id: 'high', title: 'High Priority — Daily Commitments (P1)', color: 'var(--high)', badge: 'P1 / Focus' },
        { id: 'medium', title: 'Medium Priority — Sprint Progress (P2)', color: 'var(--medium)', badge: 'P2 / Sprint' },
        { id: 'low', title: 'Low Priority & Housekeeping (P3)', color: 'var(--low)', badge: 'P3 / Low' }
      ];

      return priorityBuckets.map(b => ({
        id: b.id,
        title: b.title,
        color: b.color,
        badge: b.badge,
        tasks: sortTasks(tasks.filter(t => t.priority === b.id)),
        getDefaultProps: () => ({ priority: b.id })
      }));
    }

    if (activeGroupMode === 'group') {
      const groupBuckets = groups.map(g => ({
        id: g.id,
        title: g.name,
        color: g.color || 'var(--primary)',
        badge: `${g.memberIds?.length || 0} Members`,
        tasks: sortTasks(tasks.filter(t => t.groupIds.includes(g.id))),
        getDefaultProps: () => ({ groupIds: [g.id] })
      }));

      groupBuckets.push({
        id: 'unassigned-squad',
        title: 'General / Unassigned Squad',
        color: 'var(--text-muted)',
        badge: 'General',
        tasks: sortTasks(tasks.filter(t => !t.groupIds || t.groupIds.length === 0)),
        getDefaultProps: () => ({ groupIds: [] })
      });

      return groupBuckets;
    }

    if (activeGroupMode === 'status') {
      return [
        {
          id: 'pending',
          title: 'To Do / Pending Execution',
          color: 'var(--text-secondary)',
          badge: 'Backlog',
          tasks: sortTasks(tasks.filter(t => t.status === 'pending')),
          getDefaultProps: () => ({ status: 'pending' })
        },
        {
          id: 'partial',
          title: 'In Progress / In Review',
          color: 'var(--medium)',
          badge: 'Active',
          tasks: sortTasks(tasks.filter(t => t.status === 'partial')),
          getDefaultProps: () => ({ status: 'partial' })
        },
        {
          id: 'complete',
          title: 'Done & Verified',
          color: 'var(--low)',
          badge: 'Closed',
          tasks: sortTasks(tasks.filter(t => t.status === 'complete')),
          getDefaultProps: () => ({ status: 'complete', completedAt: new Date().toISOString() })
        }
      ];
    }

    return [];
  }, [activeGroupMode, tasks, groups, sortField, sortDirection]);

  const handleQuickAdd = (group: ListGroup) => {
    const text = (quickInput[group.id] || '').trim();
    if (!text) return;

    onAddTask({
      title: text,
      priority: 'medium',
      status: 'pending',
      dateStr: currentDateStr,
      dueDate: currentDateStr,
      assigneeIds: [],
      groupIds: [],
      releaseId: selectedReleaseId || undefined,
      ...group.getDefaultProps()
    });

    setQuickInput(prev => ({ ...prev, [group.id]: '' }));
  };

  const handlePriorityChange = (task: Task, newPriority: Priority) => {
    onUpdateTask({ ...task, priority: newPriority });
  };

  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    onUpdateTask({ 
      ...task, 
      status: newStatus,
      completedAt: newStatus === 'complete' ? (task.completedAt || new Date().toISOString()) : undefined
    });
  };

  const handleAddCommentSubmit = (taskId: string) => {
    if (!newCommentText.trim()) return;
    onAddComment(taskId, newCommentText.trim());
    setNewCommentText('');
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Controls & Quick Grouping Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <LayoutList size={15} className="text-[var(--primary)]" />
            <span>List Grouping:</span>
          </div>

          <div className="flex items-center bg-[var(--surface-hover)] p-1 rounded-xl border border-[var(--border)] gap-1">
            <button
              onClick={() => setActiveGroupMode('priority')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeGroupMode === 'priority'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Flame size={13} className={activeGroupMode === 'priority' ? 'text-[var(--critical)]' : ''} />
              <span>Priority</span>
            </button>

            <button
              onClick={() => setActiveGroupMode('group')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeGroupMode === 'group'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Users size={13} className={activeGroupMode === 'group' ? 'text-[var(--primary)]' : ''} />
              <span>Squad / Pod</span>
            </button>

            <button
              onClick={() => setActiveGroupMode('status')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeGroupMode === 'status'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CheckCircle2 size={13} className={activeGroupMode === 'status' ? 'text-[var(--low)]' : ''} />
              <span>Status</span>
            </button>

            <button
              onClick={() => setActiveGroupMode('none')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeGroupMode === 'none'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Layers size={13} />
              <span>Flat Table</span>
            </button>
          </div>
        </div>

        {/* Column Sorter Chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)] font-medium hidden sm:inline">Sort:</span>
          <button
            onClick={() => handleSort('priority')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sortField === 'priority'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/40'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span>Priority</span>
            {sortField === 'priority' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
          </button>

          <button
            onClick={() => handleSort('dueDate')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sortField === 'dueDate'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/40'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span>Due Date</span>
            {sortField === 'dueDate' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
          </button>

          <button
            onClick={() => handleSort('status')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sortField === 'status'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/40'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span>Status</span>
            {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
          </button>
        </div>
      </div>

      {/* Grouped Lists or Flat Table */}
      <div className="flex flex-col gap-4">
        {groupsList.map(group => {
          const isCollapsed = collapsedGroups[group.id] ?? false;
          const completedCount = group.tasks.filter(t => t.status === 'complete').length;
          const totalCount = group.tasks.length;
          const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return (
            <div 
              key={group.id} 
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs overflow-hidden transition-all"
            >
              {/* Group Section Header */}
              <div 
                className="flex items-center justify-between p-3.5 sm:px-5 bg-[var(--bg-subtle)]/70 border-b border-[var(--border)] cursor-pointer select-none"
                onClick={() => toggleGroupCollapse(group.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: group.color }}
                  />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                    {group.title}
                  </h3>
                  {group.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hidden sm:inline-block">
                      {group.badge}
                    </span>
                  )}
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                    {completedCount}/{totalCount}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Visual Completion Gauge */}
                  <div className="w-24 sm:w-32 h-2 bg-[var(--border)] rounded-full overflow-hidden hidden sm:block">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--text-muted)] hidden sm:inline">
                    {percent}%
                  </span>

                  <button 
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="flex flex-col">
                  {/* Inline Fast Add Bar */}
                  <div className="flex items-center gap-2 p-3 bg-[var(--surface)] border-b border-[var(--border)]">
                    <input
                      type="text"
                      placeholder={`+ Quick add deliverable to ${group.title.split(' ')[0]}...`}
                      value={quickInput[group.id] || ''}
                      onChange={(e) => setQuickInput({ ...quickInput, [group.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd(group)}
                      className="flex-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] placeholder-[var(--text-muted)]"
                    />
                    <button
                      onClick={() => handleQuickAdd(group)}
                      className="px-3.5 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--primary)] hover:text-white text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border)] transition-all cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Tasks Table / Rows */}
                  {group.tasks.length > 0 ? (
                    <div className="divide-y divide-[var(--border)]">
                      {group.tasks.map(task => {
                        const isOverdue = isTaskOverdue(task.dueDate, task.status, currentDateStr);
                        const assignees = getWorkItemAssignees(task, team);
                        const taskGroups = groups.filter(g => task.groupIds.includes(g.id));
                        const linkedStory = userStories.find(s => s.id === task.userStoryId);
                        const linkedDefect = defects.find(d => d.id === task.defectId);
                        const blockedStatus = getTaskBlockedStatus(task, allTasks);
                        const commentsCount = task.comments?.length || 0;
                        const isCommentsOpen = expandedCommentsTaskId === task.id;

                        return (
                          <div 
                            key={task.id} 
                            className={`group p-3.5 hover:bg-[var(--surface-hover)]/70 transition-all flex flex-col gap-2.5 ${
                              task.status === 'complete' ? 'opacity-75 bg-[var(--bg-subtle)]/30' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                              {/* Left: Checkbox + Title + Tags */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Direct Status Toggle Checkbox */}
                                <button
                                  onClick={() => onToggleStatus(task.id)}
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                    task.status === 'complete'
                                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                                      : task.status === 'partial'
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-600'
                                      : 'border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)]'
                                  }`}
                                  title={
                                    task.status === 'complete'
                                      ? 'Mark as incomplete'
                                      : task.status === 'partial'
                                      ? 'In progress — click to complete'
                                      : 'Click to complete'
                                  }
                                >
                                  {task.status === 'complete' && <Check size={13} strokeWidth={3} />}
                                  {task.status === 'partial' && <div className="w-2 h-2 rounded-xs bg-amber-500" />}
                                </button>

                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* ADO ID Tag */}
                                    {task.adoId && (
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--surface-hover)] text-[var(--primary)] border border-[var(--border)] shrink-0">
                                        #{task.adoId}
                                      </span>
                                    )}

                                    {/* Task Title with Search Highlight */}
                                    <span 
                                      onClick={() => setEditingTask(task)}
                                      className={`text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] hover:underline cursor-pointer truncate ${
                                        task.status === 'complete' ? 'line-through text-[var(--text-muted)]' : ''
                                      }`}
                                    >
                                      <HighlightText text={task.title} query={searchQuery} />
                                    </span>

                                    {/* Customer Tag */}
                                    {task.customerName && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0 flex items-center gap-1">
                                        <Building2 size={10} />
                                        <span>{task.customerName}</span>
                                      </span>
                                    )}

                                    {/* Linked Story / Defect Tag */}
                                    {linkedStory && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0 truncate max-w-[140px]" title={linkedStory.title}>
                                        Story: {linkedStory.adoId ? `#${linkedStory.adoId}` : linkedStory.title}
                                      </span>
                                    )}

                                    {linkedDefect && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 shrink-0 truncate max-w-[140px]" title={linkedDefect.title}>
                                        Bug: {linkedDefect.adoId ? `#${linkedDefect.adoId}` : linkedDefect.title}
                                      </span>
                                    )}

                                    {/* Blocker Pill */}
                                    {blockedStatus.isBlocked && (
                                      <button
                                        onClick={() => setDependencyTask(task)}
                                        className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30 flex items-center gap-1 animate-pulse cursor-pointer shrink-0"
                                        title="Task is blocked by upstream dependencies"
                                      >
                                        <Lock size={10} />
                                        <span>Blocked ({blockedStatus.blockingTasks.length})</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Subtitle / Details */}
                                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5 flex-wrap">
                                    {taskGroups.length > 0 && (
                                      <span className="font-medium text-[var(--text-secondary)]">
                                        {taskGroups.map(g => g.name).join(', ')} &bull;
                                      </span>
                                    )}
                                    {task.time && (
                                      <span className="flex items-center gap-1 font-mono">
                                        <Clock size={11} />
                                        {task.time}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Meta Badges + Actions */}
                              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                                {/* Priority Dropdown / Pill */}
                                <select
                                  value={task.priority}
                                  onChange={(e) => handlePriorityChange(task, e.target.value as Priority)}
                                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                                    task.priority === 'critical'
                                      ? 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)]'
                                      : task.priority === 'high'
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                      : task.priority === 'medium'
                                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)]'
                                  }`}
                                >
                                  <option value="critical">P0 Critical</option>
                                  <option value="high">P1 High</option>
                                  <option value="medium">P2 Medium</option>
                                  <option value="low">P3 Low</option>
                                </select>

                                {/* Due Date Badge */}
                                {task.dueDate && (
                                  <span 
                                    className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                                      isOverdue
                                        ? 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30 font-bold animate-pulse'
                                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                                    }`}
                                  >
                                    <Calendar size={11} />
                                    <span>{task.dueDate}</span>
                                  </span>
                                )}

                                {/* Assignee Avatars */}
                                <div className="flex items-center -space-x-1.5">
                                  {assignees.length > 0 ? (
                                    assignees.slice(0, 2).map((member) => (
                                      <div
                                        key={member.id}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs border border-[var(--surface)]"
                                        style={{ backgroundColor: member.avatarColor || 'var(--primary)' }}
                                        title={`${member.name} (${member.role})`}
                                      >
                                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                      </div>
                                    ))
                                  ) : (
                                    <div 
                                      className="w-6 h-6 rounded-full bg-[var(--surface-hover)] border border-dashed border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--text-muted)]"
                                      title="Unassigned"
                                    >
                                      <Users size={11} />
                                    </div>
                                  )}
                                </div>

                                {/* Comments Trigger */}
                                <button
                                  onClick={() => setExpandedCommentsTaskId(isCommentsOpen ? null : task.id)}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
                                    commentsCount > 0 || isCommentsOpen
                                      ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/30'
                                      : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border)]'
                                  }`}
                                  title="View / Add comments"
                                >
                                  <MessageSquare size={13} />
                                  {commentsCount > 0 && <span>{commentsCount}</span>}
                                </button>

                                {/* Push to Standup */}
                                {onPushToStandup && (
                                  <button
                                    onClick={() => onPushToStandup(task)}
                                    className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all cursor-pointer"
                                    title="Push item to today's Standup entry"
                                  >
                                    <ArrowRightLeft size={13} />
                                  </button>
                                )}

                                {/* Edit Modal Trigger */}
                                <button
                                  onClick={() => setEditingTask(task)}
                                  className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-all cursor-pointer"
                                  title="Edit deliverable details"
                                >
                                  <Edit3 size={13} />
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => onDeleteTask(task.id)}
                                  className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--critical-bg)] text-[var(--text-muted)] hover:text-[var(--critical)] border border-[var(--border)] hover:border-[var(--critical-border)] transition-all cursor-pointer"
                                  title="Delete task"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Inline Comments Accordion */}
                            {isCommentsOpen && (
                              <div className="mt-2 p-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl flex flex-col gap-2">
                                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                                  <MessageSquare size={13} className="text-[var(--primary)]" />
                                  <span>Deliverable Discussion ({commentsCount})</span>
                                </div>

                                {task.comments && task.comments.length > 0 ? (
                                  <div className="divide-y divide-[var(--border)] max-h-48 overflow-y-auto pr-1">
                                    {task.comments.map(c => (
                                      <div key={c.id} className="py-2 flex flex-col gap-1 text-xs">
                                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                                          <strong className="text-[var(--text-primary)]">{c.author}</strong>
                                          <span>{c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                        <div className="text-[var(--text-secondary)]" dangerouslySetInnerHTML={{ __html: cleanAdoHtml(c.text) }} />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-[var(--text-muted)] italic">No comments yet. Start the conversation below.</p>
                                )}

                                <div className="flex gap-2 mt-1">
                                  <input
                                    type="text"
                                    placeholder="Write a comment or status note..."
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCommentSubmit(task.id)}
                                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                                  />
                                  <button
                                    onClick={() => handleAddCommentSubmit(task.id)}
                                    className="px-3.5 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                                  >
                                    Post
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center">
                      <CheckCircle2 size={24} className="opacity-30 mb-1.5 text-[var(--primary)]" />
                      <span>No deliverables in {group.title}.</span>
                      <span className="text-[10px] mt-0.5">Use the add input above to queue a task.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          team={team}
          groups={groups}
          userStories={userStories}
          defects={defects}
          releases={releases}
          onUpdateTask={(updated) => {
            onUpdateTask(updated);
            setEditingTask(null);
          }}
          onDeleteTask={(id) => {
            onDeleteTask(id);
            setEditingTask(null);
          }}
        />
      )}

      {/* Dependency Modal */}
      {dependencyTask && (
        <TaskDependencyModal
          isOpen={!!dependencyTask}
          onClose={() => setDependencyTask(null)}
          task={dependencyTask}
          allTasks={allTasks}
          team={team}
          onUpdateDependencies={(taskId, newDependsOnTaskIds) => {
            onUpdateTask({ ...dependencyTask, dependsOnTaskIds: newDependsOnTaskIds });
            setDependencyTask(null);
          }}
        />
      )}
    </div>
  );
};
