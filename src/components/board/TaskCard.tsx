import React, { useState } from 'react';
import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  Defect, 
  Release, 
  TaskStatus, 
  Priority 
} from '../../types';
import { 
  Check, 
  Clock, 
  Calendar,
  AlertTriangle,
  MessageSquare, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Plus, 
  Minus,
  AlertCircle,
  Building2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Users,
  Lock,
  Unlock,
  Link as LinkIcon,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { 
  formatTime12, 
  isTaskOverdue, 
  formatDueDateBadge, 
  toDateStr, 
  shiftDate 
} from '../../utils/date';
import { HighlightText } from '../common/HighlightText';
import { cleanAdoHtml } from '../../utils/formatAdoHtml';
import { getTaskBlockedStatus } from '../../utils/taskDependencies';
import { getWorkItemAssignees } from '../../utils/assigneeUtils';
import { TaskDependencyModal } from './TaskDependencyModal';
import { TaskEditModal } from './TaskEditModal';

interface TaskCardProps {
  task: Task;
  allTasks?: Task[];
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  standup?: Record<string, any>;
  currentDateStr?: string;
  searchQuery?: string;
  isDragging?: boolean;
  isDragOver?: boolean;
  dropPosition?: 'before' | 'after' | null;
  onToggleStatus: (taskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddComment: (taskId: string, text: string) => void;
  onPushToStandup?: (task: Task) => void;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOverCard?: (e: React.DragEvent, taskId: string) => void;
  onDragLeaveCard?: (e: React.DragEvent, taskId: string) => void;
  onDropOnCard?: (e: React.DragEvent, taskId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToPriority?: (priority: Priority) => void;
  onMoveToGroup?: (groupId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  allTasks = [],
  team,
  groups,
  userStories,
  defects,
  releases,
  standup,
  currentDateStr,
  searchQuery = '',
  isDragging = false,
  isDragOver = false,
  dropPosition = null,
  onToggleStatus,
  onUpdateTask,
  onDeleteTask,
  onAddComment,
  onPushToStandup,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDragLeaveCard,
  onDropOnCard,
  onMoveUp,
  onMoveDown,
  onMoveToPriority,
  onMoveToGroup
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [dependencyModalOpen, setDependencyModalOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const assignees = getWorkItemAssignees(task, team);
  const taskGroups = groups.filter(g => task.groupIds.includes(g.id));
  const linkedStory = userStories.find(s => s.id === task.userStoryId);
  const linkedDefect = defects.find(d => d.id === task.defectId);
  const linkedRelease = releases.find(r => r.id === task.releaseId);

  // Blocked Status & Dependencies Calculation
  const blockedStatus = getTaskBlockedStatus(task, allTasks);
  const { isBlocked, blockingTasks, totalPrerequisites, completedPrerequisites, dependentTasks } = blockedStatus;

  // Due Date & Overdue Calculation
  const isOverdue = isTaskOverdue(task.dueDate, task.status, currentDateStr);
  const dueBadge = task.dueDate ? formatDueDateBadge(task.dueDate, currentDateStr) : null;
  const isDueToday = Boolean(task.dueDate && task.status !== 'complete' && task.dueDate === (currentDateStr || toDateStr(new Date())));

  const handleSetQuickDueDate = (newDueDate?: string) => {
    onUpdateTask({
      ...task,
      dueDate: newDueDate
    });
    setMenuOpen(false);
  };

  const handleUpdateDependencies = (taskId: string, newDependsOnTaskIds: string[]) => {
    onUpdateTask({
      ...task,
      dependsOnTaskIds: newDependsOnTaskIds
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(task.id, newCommentText.trim());
    setNewCommentText('');
  };

  const commentsCount = task.comments?.length || 0;

  // Standup mention detection
  const standupMention = React.useMemo(() => {
    if (!standup) return null;
    const taskTitleLower = task.title.toLowerCase();
    const idStr = task.adoId ? `#${task.adoId}` : task.id.slice(-4).toLowerCase();

    for (const [memberId, entry] of Object.entries(standup)) {
      if (!entry) continue;
      const member = team.find(m => m.id === memberId);
      const memberName = member ? member.name : 'Teammate';

      // Check blockers
      if (entry.blockers && entry.blockers.toLowerCase() !== 'none') {
        const bLower = entry.blockers.toLowerCase();
        if (bLower.includes(taskTitleLower) || bLower.includes(idStr) || (task.title.length > 8 && bLower.includes(task.title.toLowerCase().slice(0, 15)))) {
          return { type: 'blocker' as const, memberName, text: entry.blockers };
        }
      }

      // Check today
      if (entry.today) {
        const tLower = entry.today.toLowerCase();
        if (tLower.includes(taskTitleLower) || tLower.includes(idStr) || (task.title.length > 8 && tLower.includes(task.title.toLowerCase().slice(0, 15)))) {
          return { type: 'today' as const, memberName, text: entry.today };
        }
      }

      // Check yesterday
      if (entry.yesterday) {
        const yLower = entry.yesterday.toLowerCase();
        if (yLower.includes(taskTitleLower) || yLower.includes(idStr) || (task.title.length > 8 && yLower.includes(task.title.toLowerCase().slice(0, 15)))) {
          return { type: 'yesterday' as const, memberName, text: entry.yesterday };
        }
      }
    }
    return null;
  }, [standup, task, team]);

  // Search match detection for supplemental info
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const matchingAssignees = trimmedSearch 
    ? assignees.filter(m => m.name.toLowerCase().includes(trimmedSearch))
    : [];
  const matchingComment = trimmedSearch && task.comments
    ? task.comments.find(c => {
        const cleaned = cleanAdoHtml(c.text).toLowerCase();
        return cleaned.includes(trimmedSearch) || c.author.toLowerCase().includes(trimmedSearch);
      })
    : null;

  return (
    <div className="relative flex flex-col">
      {/* Drop Before Indicator Line */}
      {isDragOver && dropPosition === 'before' && (
        <div className="h-2 bg-gradient-to-r from-[var(--primary)] via-[var(--primary-hover)] to-[var(--primary)] rounded-full -mt-1.5 mb-2 shadow-md shadow-[var(--primary)]/30 transition-all relative drop-indicator-pulse z-20">
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--primary)] ring-4 ring-[var(--surface)] absolute -left-1 -top-[3px] shadow-sm animate-ping opacity-75" />
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--surface)] absolute -left-1 -top-[3px]" />
        </div>
      )}

      {/* Main Task Card */}
      <div
        draggable={true}
        onDragStart={(e) => {
          if (onDragStart) onDragStart(e, task.id);
        }}
        onDragEnd={(e) => {
          if (onDragEnd) onDragEnd(e);
        }}
        onDragOver={(e) => {
          if (onDragOverCard) onDragOverCard(e, task.id);
        }}
        onDragLeave={(e) => {
          if (onDragLeaveCard) onDragLeaveCard(e, task.id);
        }}
        onDrop={(e) => {
          if (onDropOnCard) onDropOnCard(e, task.id);
        }}
        className={`bg-[var(--surface)] border rounded-xl p-3.5 select-none relative group task-card-item cursor-grab active:cursor-grabbing ${
          isDragging
            ? 'opacity-40 scale-[0.98] -rotate-1 border-dashed border-2 border-[var(--primary)] shadow-2xl ring-2 ring-[var(--primary)]/30 bg-[var(--primary-light)]/30 is-dragging'
            : isDragOver
            ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 shadow-lg bg-[var(--primary-light)]/10 scale-[1.01]'
            : isBlocked && task.status !== 'complete'
            ? 'border-red-500/50 bg-red-50/20 dark:bg-red-950/20 shadow-xs ring-1 ring-red-500/30'
            : isOverdue
            ? 'border-[var(--critical-border)] bg-[var(--critical-bg)]/20 shadow-xs ring-1 ring-[var(--critical-border)]'
            : task.status === 'complete'
            ? 'border-[var(--border)] opacity-85 bg-[var(--surface-hover)]'
            : task.priority === 'critical'
            ? 'border-[var(--critical)] ring-1 ring-[var(--critical)]/20 shadow-xs'
            : task.priority === 'high'
            ? 'border-[var(--critical-border)] hover:border-[var(--critical)]'
            : 'border-[var(--border)] hover:border-[var(--primary)]'
        }`}
      >
        {/* Dragging In-Flight Visual Badge Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--primary-light)]/40 backdrop-blur-[0.5px] rounded-xl flex items-center justify-center pointer-events-none z-30 border-2 border-dashed border-[var(--primary)]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--primary)] text-white shadow-md animate-pulse">
              <GripVertical size={13} />
              <span>Moving Ticket...</span>
            </span>
          </div>
        )}

        {/* Blocked Status Banner */}
        {isBlocked && task.status !== 'complete' && (
          <div 
            onClick={() => setDependencyModalOpen(true)}
            className="task-alert-banner flex items-center justify-between gap-2 px-2.5 py-1 mb-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-[11px] font-bold cursor-pointer hover:bg-red-500/15 transition-colors"
            title={`Blocked by: ${blockingTasks.map(t => t.title).join(', ')}. Click to inspect.`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Lock size={12} className="text-red-500 flex-shrink-0 animate-pulse" />
              <span className="truncate">
                Blocked by {blockingTasks.length} prerequisite {blockingTasks.length === 1 ? 'task' : 'tasks'}: {blockingTasks[0]?.title}
              </span>
            </div>
            <span className="text-[10px] text-red-700 dark:text-red-300 underline font-extrabold flex-shrink-0">
              View ({totalPrerequisites})
            </span>
          </div>
        )}

        {/* Overdue Warning Alert Bar on Card */}
        {isOverdue && (
          <div className="task-alert-banner flex items-center justify-between gap-2 px-2.5 py-1 mb-2.5 rounded-lg bg-[var(--critical-bg)] border border-[var(--critical-border)] text-[var(--critical)] text-[11px] font-bold">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle size={13} className="flex-shrink-0 animate-pulse" />
              <span className="truncate">Overdue Warning: Due date passed ({dueBadge?.label})</span>
            </div>
            <button
              onClick={() => handleSetQuickDueDate(toDateStr(new Date()))}
              className="text-[10px] underline hover:no-underline font-extrabold flex-shrink-0 cursor-pointer"
              title="Reschedule due date to today"
            >
              Extend Today
            </button>
          </div>
        )}

        <div className="flex items-start gap-2 sm:gap-3">
          {/* Drag Grip Handle */}
          <div 
            className="mt-0.5 -ml-1 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors cursor-grab active:cursor-grabbing p-0.5 rounded flex-shrink-0"
            title="Drag to reorder or move between buckets"
          >
            <GripVertical size={15} />
          </div>

          {/* 3-State Status Cycler Button */}
          <button
            onClick={() => onToggleStatus(task.id)}
            className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
              task.status === 'complete'
                ? 'bg-[var(--primary)] text-white'
                : task.status === 'partial'
                ? 'bg-[var(--medium-bg)] text-[var(--medium)] border-2 border-[var(--medium)]'
                : isOverdue
                ? 'border-2 border-[var(--critical)] bg-[var(--surface)] hover:border-[var(--critical-hover)]'
                : 'border-2 border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)]'
            }`}
            title={`Status: ${task.status} (Click to cycle)`}
          >
            {task.status === 'complete' && <Check size={13} strokeWidth={3} />}
            {task.status === 'partial' && <Minus size={12} strokeWidth={3} />}
          </button>

          {/* Task Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 group/title">
              <p
                onClick={() => setEditModalOpen(true)}
                className={`task-title-text text-[13.5px] font-semibold leading-snug cursor-pointer hover:text-[var(--primary)] transition-colors break-words flex-1 ${
                  task.status === 'complete' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                }`}
                title="Click to open task editor popup"
              >
                <HighlightText text={task.title} query={searchQuery} />
              </p>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Quick Edit Popup Button (visible on card hover) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditModalOpen(true);
                  }}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Open task editor popup"
                >
                  <Edit3 size={13} />
                </button>

                {/* Time block badge */}
                {task.time && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md flex-shrink-0 cursor-pointer hover:opacity-80"
                    title="Click to edit time block"
                  >
                    <Clock size={11} />
                    <HighlightText text={formatTime12(task.time)} query={searchQuery} />
                  </span>
                )}
              </div>
            </div>

            {/* Badges: Due Date / Blocked Status / ADO Instance / Story / Defect / Release / Groups */}
            <div className="task-badge-row flex flex-wrap items-center gap-1.5 mt-2">
              {/* Blocked Status Badge */}
              {isBlocked && task.status !== 'complete' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDependencyModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-red-600 dark:text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  title={`Blocked by ${blockingTasks.length} pending prerequisite task(s): ${blockingTasks.map(t => t.title).join(', ')}. Click to manage.`}
                >
                  <Lock size={11} className="text-red-500 animate-pulse" />
                  <span>Blocked ({blockingTasks.length})</span>
                </button>
              )}

              {/* Prerequisites Met Badge */}
              {totalPrerequisites > 0 && !isBlocked && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDependencyModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  title={`All ${totalPrerequisites} prerequisite tasks are completed. Click to manage.`}
                >
                  <Unlock size={11} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{totalPrerequisites} Prereqs Met</span>
                </button>
              )}

              {/* Blocks Downstream Tasks Badge */}
              {dependentTasks.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDependencyModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  title={`Blocks ${dependentTasks.length} downstream ticket(s): ${dependentTasks.map(t => t.title).join(', ')}. Click to view.`}
                >
                  <ArrowUpRight size={11} className="text-amber-600 dark:text-amber-400" />
                  <span>Blocks {dependentTasks.length}</span>
                </button>
              )}

              {/* Due Date Badge */}
              {task.dueDate && (
                <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${
                  isOverdue
                    ? 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)] ring-1 ring-[var(--critical)]/20'
                    : isDueToday
                    ? 'bg-[var(--medium-bg)] text-[var(--medium)] border-[var(--medium-border)]'
                    : task.status === 'complete'
                    ? 'bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border)]'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)]'
                }`}>
                  {isOverdue ? (
                    <AlertTriangle size={11} className="text-[var(--critical)]" />
                  ) : (
                    <Calendar size={11} />
                  )}
                  <span>{dueBadge?.label || `Due: ${task.dueDate}`}</span>
                </span>
              )}

              {/* ADO Linked Work Item Badge */}
              {task.adoId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--internal-ado)] bg-[var(--internal-ado-bg)] px-2 py-0.5 rounded-md border border-[var(--internal-ado)]/20">
                  <Building2 size={10} />
                  <span>ADO #{task.adoId}</span>
                </span>
              )}

              {task.customerName && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8B5CF6] bg-[#EDE9FE] px-2 py-0.5 rounded-md">
                  <span>Client: </span>
                  <HighlightText text={task.customerName} query={searchQuery} />
                </span>
              )}

              {linkedStory && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md">
                  <span>Story: </span>
                  <HighlightText 
                    text={linkedStory.adoId ? `#${linkedStory.adoId} ${linkedStory.title.slice(0, 16)}` : `${linkedStory.title.slice(0, 18)}…`} 
                    query={searchQuery} 
                  />
                </span>
              )}

              {linkedDefect && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--critical)] bg-[var(--critical-bg)] px-2 py-0.5 rounded-md border border-[var(--critical-border)]">
                  <AlertCircle size={10} />
                  <span>Defect: </span>
                  <HighlightText 
                    text={linkedDefect.adoId ? `#${linkedDefect.adoId} ${linkedDefect.title.slice(0, 16)}` : `${linkedDefect.title.slice(0, 18)}…`} 
                    query={searchQuery} 
                  />
                </span>
              )}

              {linkedRelease && !linkedStory && (
                <span className="inline-flex items-center text-[10.5px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                  <HighlightText text={linkedRelease.name.split('-')[0]} query={searchQuery} />
                </span>
              )}

              {taskGroups.map(g => (
                <span 
                  key={g.id}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  <HighlightText text={g.name} query={searchQuery} />
                </span>
              ))}

              {/* Standup Discussion Indicator Badge */}
              {standupMention && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    standupMention.type === 'blocker'
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300'
                      : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
                  }`}
                  title={`Discussed in today's standup by ${standupMention.memberName}: "${standupMention.text}"`}
                >
                  {standupMention.type === 'blocker' ? (
                    <>
                      <AlertTriangle size={10} className="animate-pulse" />
                      <span>Standup Blocker ({standupMention.memberName.split(' ')[0]})</span>
                    </>
                  ) : (
                    <>
                      <Users size={10} />
                      <span>In Standup ({standupMention.memberName.split(' ')[0]})</span>
                    </>
                  )}
                </span>
              )}
            </div>

            {/* If assignee or comments matched search query, show visual context cue */}
            {matchingAssignees.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--primary-light)]/40 border border-[var(--primary)]/20 px-2 py-0.5 rounded-md">
                <Users size={11} className="text-[var(--primary)] flex-shrink-0" />
                <span>Assignee match: </span>
                {matchingAssignees.map(m => (
                  <span key={m.id} className="font-bold text-[var(--primary)]">
                    <HighlightText text={m.name} query={searchQuery} />
                  </span>
                ))}
              </div>
            )}

            {matchingComment && !showComments && (
              <div 
                onClick={() => setShowComments(true)}
                className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-[var(--text-secondary)] bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-md cursor-pointer hover:bg-amber-500/15 transition-colors"
                title="Click to open comments and view note"
              >
                <MessageSquare size={11} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="truncate">
                  <strong className="text-amber-800 dark:text-amber-300 font-bold">Note match: </strong>
                  <HighlightText text={matchingComment.text} query={searchQuery} />
                </span>
              </div>
            )}

            {/* Bottom Bar: Assignees & Actions */}
            <div className="task-bottom-bar flex items-center justify-between mt-3 pt-2 border-t border-[var(--border)]">
              {/* Assignee Avatar Stack */}
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {assignees.length > 0 ? (
                  assignees.map((member) => (
                    <div
                      key={member.id}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[var(--surface)] shadow-xs"
                      style={{ backgroundColor: member.avatarColor || 'var(--primary)' }}
                      title={`${member.name} (${member.role})`}
                    >
                      {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)] italic">Unassigned</span>
                )}
              </div>

              {/* Actions: Comments & Card Menu */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowComments(!showComments)}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    commentsCount > 0
                      ? 'text-[var(--primary)] bg-[var(--primary-light)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                  title="Notes & Comments"
                >
                  <MessageSquare size={12} />
                  {commentsCount > 0 && <span>{commentsCount}</span>}
                </button>

                <div className="relative">
                  <button
                    onClick={() => {
                      setMenuOpen(!menuOpen);
                    }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--surface-hover)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Task Actions & Reordering"
                  >
                    <MoreVertical size={13} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 bottom-7 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1 w-48 z-30 animate-in fade-in zoom-in-95 duration-100">
                      {/* Reordering shortcuts */}
                      {onMoveUp && (
                        <button
                          onClick={() => {
                            onMoveUp();
                            setMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <ArrowUp size={12} className="text-[var(--text-secondary)]" /> Move Up in Lane
                        </button>
                      )}

                      {onMoveDown && (
                        <button
                          onClick={() => {
                            onMoveDown();
                            setMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <ArrowDown size={12} className="text-[var(--text-secondary)]" /> Move Down in Lane
                        </button>
                      )}

                      <div className="my-1 border-t border-[var(--border)]" />

                      {/* Quick Due Date Controls */}
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                        <span>Set Due Date</span>
                        <Calendar size={10} />
                      </div>
                      <div className="px-1 flex flex-col gap-0.5">
                        <button
                          onClick={() => handleSetQuickDueDate(toDateStr(new Date()))}
                          className="w-full text-left px-2 py-1 text-[11px] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] font-medium cursor-pointer"
                        >
                          Due Today ({toDateStr(new Date()).slice(5)})
                        </button>
                        <button
                          onClick={() => handleSetQuickDueDate(shiftDate(toDateStr(new Date()), 1))}
                          className="w-full text-left px-2 py-1 text-[11px] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] font-medium cursor-pointer"
                        >
                          Due Tomorrow
                        </button>
                        <button
                          onClick={() => handleSetQuickDueDate(shiftDate(toDateStr(new Date()), 3))}
                          className="w-full text-left px-2 py-1 text-[11px] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] font-medium cursor-pointer"
                        >
                          Due in 3 Days
                        </button>
                        {task.dueDate && (
                          <button
                            onClick={() => handleSetQuickDueDate(undefined)}
                            className="w-full text-left px-2 py-1 text-[11px] rounded text-[var(--critical)] hover:bg-[var(--critical-bg)] font-medium cursor-pointer"
                          >
                            Clear Due Date
                          </button>
                        )}
                      </div>

                      <div className="my-1 border-t border-[var(--border)]" />

                      {/* Quick Move to Priority */}
                      {onMoveToPriority && (
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          Set Priority
                        </div>
                      )}
                      {onMoveToPriority && (
                        <div className="flex px-2 py-1 gap-1">
                          <button
                            onClick={() => {
                              onMoveToPriority('critical');
                              setMenuOpen(false);
                            }}
                            className={`flex-1 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                              task.priority === 'critical' 
                                ? 'bg-[var(--critical)] text-white border-[var(--critical)] shadow-xs' 
                                : 'text-[var(--critical)] hover:bg-[var(--critical-bg)] border-[var(--critical-border)]'
                            }`}
                          >
                            Crit
                          </button>
                          <button
                            onClick={() => {
                              onMoveToPriority('high');
                              setMenuOpen(false);
                            }}
                            className={`flex-1 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                              task.priority === 'high' 
                                ? 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)]' 
                                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                            }`}
                          >
                            High
                          </button>
                          <button
                            onClick={() => {
                              onMoveToPriority('medium');
                              setMenuOpen(false);
                            }}
                            className={`flex-1 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                              task.priority === 'medium' 
                                ? 'bg-[var(--medium-bg)] text-[var(--medium)] border-[var(--medium-border)]' 
                                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                            }`}
                          >
                            Med
                          </button>
                          <button
                            onClick={() => {
                              onMoveToPriority('low');
                              setMenuOpen(false);
                            }}
                            className={`flex-1 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                              task.priority === 'low' 
                                ? 'bg-[var(--low-bg)] text-[var(--low)] border-[var(--low-border)]' 
                                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                            }`}
                          >
                            Low
                          </button>
                        </div>
                      )}

                      {/* Move to Squad */}
                      {onMoveToGroup && groups.length > 0 && (
                        <>
                          <div className="my-1 border-t border-[var(--border)]" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                            <span>Move to Squad</span>
                            <Users size={10} />
                          </div>
                          <div className="max-h-24 overflow-y-auto px-1">
                            {groups.map(g => (
                              <button
                                key={g.id}
                                onClick={() => {
                                  onMoveToGroup(g.id);
                                  setMenuOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] rounded flex items-center justify-between font-medium cursor-pointer ${
                                  task.groupIds.includes(g.id)
                                    ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                                }`}
                              >
                                <span className="truncate">{g.name}</span>
                                {task.groupIds.includes(g.id) && <Check size={11} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="my-1 border-t border-[var(--border)]" />

                      {/* Dependencies Management Action */}
                      <button
                        onClick={() => {
                          setDependencyModalOpen(true);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-between font-medium cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Lock size={12} className={isBlocked ? 'text-red-500' : 'text-[var(--text-secondary)]'} />
                          <span>Task Dependencies</span>
                        </div>
                        {totalPrerequisites > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isBlocked ? 'bg-red-500/20 text-red-600' : 'bg-emerald-500/20 text-emerald-600'
                          }`}>
                            {totalPrerequisites}
                          </span>
                        )}
                      </button>

                      {/* Push to Standup */}
                      {onPushToStandup && (
                        <>
                          <div className="my-1 border-t border-[var(--border)]" />
                          <button
                            type="button"
                            onClick={() => {
                              onPushToStandup(task);
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-[var(--primary)] hover:bg-[var(--primary-light)] font-bold flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Users size={12} />
                            <span>Add to Today's Standup</span>
                          </button>
                        </>
                      )}

                      <div className="my-1 border-t border-[var(--border)]" />

                      <button
                        onClick={() => {
                          setEditModalOpen(true);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Edit3 size={12} /> Edit Task in Popup
                      </button>
                      <button
                        onClick={() => {
                          onDeleteTask(task.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--critical)] hover:bg-[var(--critical-bg)] flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comments / Notes Drawer */}
            {showComments && (
              <div className="mt-3 pt-2.5 border-t border-[var(--border)] bg-[var(--bg-subtle)] -mx-3.5 -mb-3.5 p-3 rounded-b-xl">
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto mb-2 pr-1">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map(c => (
                      <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                          <span className="font-bold text-[var(--text-primary)]">
                            <HighlightText text={c.author} query={searchQuery} />
                          </span>
                          <span>{c.createdAt}</span>
                        </div>
                        <p className="text-[var(--text-primary)] text-xs font-medium">
                          <HighlightText text={c.text} query={searchQuery} />
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)] italic">No comments yet. Add day notes or blockers.</p>
                  )}
                </div>

                <form onSubmit={handleCommentSubmit} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Add quick update note..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-[var(--primary)] text-white text-xs font-bold rounded-lg hover:bg-[var(--primary-hover)] cursor-pointer"
                  >
                    Post
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Full Edit Popup Modal */}
      <TaskEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        task={task}
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

      {/* Task Dependency Management Modal */}
      <TaskDependencyModal
        isOpen={dependencyModalOpen}
        onClose={() => setDependencyModalOpen(false)}
        task={task}
        allTasks={allTasks}
        team={team}
        onUpdateDependencies={handleUpdateDependencies}
      />

      {/* Drop After Indicator Line */}
      {isDragOver && dropPosition === 'after' && (
        <div className="h-2 bg-gradient-to-r from-[var(--primary)] via-[var(--primary-hover)] to-[var(--primary)] rounded-full mt-2 -mb-1.5 shadow-md shadow-[var(--primary)]/30 transition-all relative drop-indicator-pulse z-20">
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--primary)] ring-4 ring-[var(--surface)] absolute -left-1 -top-[3px] shadow-sm animate-ping opacity-75" />
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--surface)] absolute -left-1 -top-[3px]" />
        </div>
      )}
    </div>
  );
};
