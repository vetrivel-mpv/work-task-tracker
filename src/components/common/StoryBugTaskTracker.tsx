import React, { useState } from 'react';
import { Task, TeamMember, Priority, TaskStatus, TaskComment } from '../../types';
import { 
  CheckSquare, 
  CheckCircle2, 
  Circle, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Users, 
  Trash2, 
  AlertCircle,
  ExternalLink,
  Flame,
  Check,
  FolderGit2,
  MessageSquare,
  Sparkles,
  Send,
  CheckCheck
} from 'lucide-react';
import { generateId, toDateStr } from '../../utils/date';
import { getWorkItemAssignee } from '../../utils/assigneeUtils';
import { parseExecutionMetricsFromText, getLatestCommentText } from '../../utils/executionCommentParser';

interface StoryBugTaskTrackerProps {
  parentType: 'story' | 'bug';
  parentId: string;
  parentAdoId?: number;
  parentTitle: string;
  tasks: Task[];
  team: TeamMember[];
  currentDateStr?: string;
  onToggleStatus?: (taskId: string) => void;
  onAddTask?: (task: Partial<Task>) => void;
  onUpdateTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  defaultExpanded?: boolean;
}

export const StoryBugTaskTracker: React.FC<StoryBugTaskTrackerProps> = ({
  parentType,
  parentId,
  parentAdoId,
  parentTitle,
  tasks,
  team,
  currentDateStr,
  onToggleStatus,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>('');
  const [initialComment, setInitialComment] = useState('');
  
  // State for closing a task with an EOD execution comment
  const [activeCommentTaskId, setActiveCommentTaskId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [closeOnComment, setCloseOnComment] = useState(true);

  // Find all child tasks linked to this User Story or Bug
  const childTasks = tasks.filter(t => {
    if (parentType === 'story') {
      if (t.userStoryId === parentId) return true;
      if (parentAdoId && (t as any).parentId === parentAdoId) return true;
      return false;
    } else {
      if (t.defectId === parentId) return true;
      if (parentAdoId && (t as any).parentId === parentAdoId) return true;
      return false;
    }
  });

  const totalTasks = childTasks.length;
  const closedTasks = childTasks.filter(t => t.status === 'complete').length;
  const openTasks = totalTasks - closedTasks;
  const progressPercent = totalTasks > 0 ? Math.round((closedTasks / totalTasks) * 100) : 0;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !onAddTask) return;

    const todayStr = currentDateStr || toDateStr(new Date());
    const assignedMember = team.find(m => m.id === newTaskAssigneeId);

    const initialCommentsList: TaskComment[] = [];
    if (initialComment.trim()) {
      initialCommentsList.push({
        id: `c-${Date.now()}`,
        author: assignedMember?.name || 'Engineer',
        text: initialComment.trim(),
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    const taskPayload: Partial<Task> = {
      id: generateId(),
      title: newTaskTitle.trim(),
      status: 'pending',
      priority: newTaskPriority,
      dateStr: todayStr,
      userStoryId: parentType === 'story' ? parentId : undefined,
      defectId: parentType === 'bug' ? parentId : undefined,
      parentId: parentAdoId || undefined,
      assigneeId: newTaskAssigneeId || undefined,
      assigneeName: assignedMember ? assignedMember.name : undefined,
      assigneeIds: newTaskAssigneeId ? [newTaskAssigneeId] : [],
      comments: initialCommentsList,
      latestComment: initialComment.trim() || undefined,
      todayActivityComment: initialComment.trim() || undefined,
      executionMetrics: initialComment.trim() ? (parseExecutionMetricsFromText(initialComment) || undefined) : undefined,
      sourceInstance: 'local',
      createdAt: new Date().toISOString()
    };

    onAddTask(taskPayload);
    setNewTaskTitle('');
    setInitialComment('');
    setIsAdding(false);
    setIsExpanded(true);
  };

  const handleSaveEodExecutionComment = (task: Task) => {
    if (!commentInput.trim() || !onUpdateTask) return;

    const assignedMember = team.find(m => m.id === task.assigneeId);
    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      author: assignedMember?.name || 'QA / Dev Engineer',
      text: commentInput.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedComments = [...(task.comments || []), newComment];
    const metrics = parseExecutionMetricsFromText(commentInput);

    const updatedTask: Task = {
      ...task,
      status: closeOnComment ? 'complete' : task.status,
      comments: updatedComments,
      latestComment: commentInput.trim(),
      todayActivityComment: commentInput.trim(),
      executionMetrics: metrics || undefined,
      completedAt: closeOnComment && !task.completedAt ? new Date().toISOString() : task.completedAt
    };

    onUpdateTask(updatedTask);
    setActiveCommentTaskId(null);
    setCommentInput('');
  };

  const applyExecutionTemplate = (templateType: 'all_passed' | 'partial' | 'blocked' | 'not_applicable') => {
    if (templateType === 'all_passed') {
      setCommentInput('EOD Test Execution: Total Test Cases: 8 | Completed: 8 | Blocked: 0 | Failed: 0 | Open Defects: 0. All validation scenarios passed smoothly.');
    } else if (templateType === 'partial') {
      setCommentInput('EOD Test Execution: Total Test Cases: 12 | Completed: 9 | Blocked: 1 | Failed: 2 | Open Defects: 2 (Logged DEF-1049 for payload timeout).');
    } else if (templateType === 'blocked') {
      setCommentInput('Status: Blocked | Total Test Cases: 6 | Completed: 2 | Blocked: 4 | Failed: 0 | Open Defects: 1. Execution Blocked due to external environment gateway outage.');
    } else if (templateType === 'not_applicable') {
      setCommentInput('Status: Not Applicable | Total Test Cases: 0 | Completed: 0 | Blocked: 0 | Failed: 0 | Open Defects: 0. No QA testing required (Documentation/Design review only).');
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'critical':
        return 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)]';
      case 'high':
        return 'bg-[var(--high-bg)] text-[var(--high)] border-[var(--high-border)]';
      case 'medium':
        return 'bg-[var(--medium-bg)] text-[var(--medium)] border-[var(--medium-border)]';
      case 'low':
      default:
        return 'bg-[var(--low-bg)] text-[var(--low)] border-[var(--low-border)]';
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]">
      {/* Tracker Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3.5 py-2.5">
        
        {/* Left: Summary Indicators */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <CheckSquare size={14} className="text-[var(--primary)] shrink-0" />
            <span>Today's Activity Tasks:</span>
          </div>

          {/* Counts Badges */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={`px-2 py-0.5 rounded-md font-mono ${
              openTasks > 0 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
            }`}>
              {openTasks} open
            </span>

            <span className={`px-2 py-0.5 rounded-md font-mono ${
              closedTasks > 0 
                ? 'bg-[var(--low-bg)] text-[var(--low)] border border-[var(--low-border)]' 
                : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
            }`}>
              {closedTasks} closed (EOD)
            </span>

            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              ({totalTasks} total)
            </span>
          </div>

          {/* Progress Bar & Percentage */}
          {totalTasks > 0 && (
            <div className="flex items-center gap-2 ml-1">
              <div className="w-16 h-2 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
                <div 
                  className={`h-full transition-all duration-300 ${
                    progressPercent === 100 ? 'bg-emerald-500' : 'bg-[var(--primary)]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-bold font-mono text-[var(--text-secondary)]">
                {progressPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions & Expand Button */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {onAddTask && (
            <button
              type="button"
              onClick={() => {
                setIsAdding(prev => !prev);
                if (!isExpanded) setIsExpanded(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-all cursor-pointer shadow-2xs"
              title={`Create today's activity task for this ${parentType === 'story' ? 'User Story' : 'Bug'}`}
            >
              <Plus size={12} />
              <span>Create Task for Today</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg border border-[var(--border)] transition-all cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Tasks' : `View Tasks (${totalTasks})`}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Quick Add Inline Form */}
      {isAdding && (
        <form 
          onSubmit={handleCreateTask}
          className="mt-2.5 p-3.5 bg-[var(--surface)] border border-[var(--primary)]/30 rounded-xl shadow-xs flex flex-col gap-2.5 animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Plus size={13} className="text-[var(--primary)]" />
              New Daily Task for {parentType === 'story' ? 'Story' : 'Bug'}: {parentAdoId ? `#${parentAdoId}` : parentTitle.slice(0, 30)}
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            placeholder="e.g. Execute Regression Test Suite for US, Verify payment error handling..."
            className="w-full px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            autoFocus
          />

          <input
            type="text"
            value={initialComment}
            onChange={e => setInitialComment(e.target.value)}
            placeholder="Today's planned scope or initial execution note (optional)..."
            className="w-full px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority Select */}
              <select
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value as Priority)}
                className="px-2 py-1 text-[11px] font-semibold bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] focus:outline-none"
              >
                <option value="critical">Critical Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              {/* Assignee Select */}
              <select
                value={newTaskAssigneeId}
                onChange={e => setNewTaskAssigneeId(e.target.value)}
                className="px-2 py-1 text-[11px] font-semibold bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] focus:outline-none max-w-[160px]"
              >
                <option value="">Unassigned</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Check size={13} />
              <span>Add Task for Today</span>
            </button>
          </div>
        </form>
      )}

      {/* Expanded Task Checklist */}
      {isExpanded && (
        <div className="mt-2.5 flex flex-col gap-2">
          {childTasks.length > 0 ? (
            childTasks.map(task => {
              const isCompleted = task.status === 'complete';
              const assignee = getWorkItemAssignee(task, team);
              const latestComment = getLatestCommentText(task);
              const metrics = task.executionMetrics || (latestComment ? parseExecutionMetricsFromText(latestComment) : null);
              const isCommentFormOpen = activeCommentTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`flex flex-col gap-2 p-3 rounded-xl border text-xs transition-all ${
                    isCompleted
                      ? 'bg-[var(--surface-hover)]/60 border-[var(--border)]'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/30'
                  }`}
                >
                  {/* Task Main Header Row */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Interactive Checkbox & Title */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleStatus && onToggleStatus(task.id)}
                        className={`shrink-0 transition-transform active:scale-90 cursor-pointer ${
                          isCompleted ? 'text-emerald-500' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'
                        }`}
                        title={isCompleted ? 'Mark as Open / Pending' : 'Mark as Closed (EOD)'}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={17} className="fill-emerald-500 text-white dark:text-gray-900" />
                        ) : (
                          <Circle size={17} />
                        )}
                      </button>

                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        {task.adoId && (
                          <span className="font-mono text-[10px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.2 rounded border border-[var(--border)] shrink-0">
                            Task #{task.adoId}
                          </span>
                        )}

                        <span className={`font-semibold truncate ${
                          isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                        }`}>
                          {task.title}
                        </span>

                        {isCompleted && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono">
                            EOD Closed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Meta & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Priority Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md border ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>

                      {/* Assignee Pill */}
                      {assignee ? (
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                            title={`${assignee.name} (${assignee.role})`}
                          >
                            {assignee.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="hidden sm:inline text-[11px] max-w-[80px] truncate font-medium">
                            {assignee.name.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)] italic hidden sm:inline">
                          Unassigned
                        </span>
                      )}

                      {/* Log EOD Execution Comment button */}
                      {onUpdateTask && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isCommentFormOpen) {
                              setActiveCommentTaskId(null);
                            } else {
                              setActiveCommentTaskId(task.id);
                              setCommentInput(latestComment || '');
                              setCloseOnComment(!isCompleted);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                            isCommentFormOpen 
                              ? 'bg-[var(--primary)] text-white' 
                              : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--primary)] border border-[var(--border)]'
                          }`}
                          title="Update EOD execution details and close task"
                        >
                          <MessageSquare size={11} />
                          <span>{latestComment ? 'Update EOD Note' : 'Log EOD Note'}</span>
                        </button>
                      )}

                      {/* Delete button */}
                      {onDeleteTask && (
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-md transition-all cursor-pointer"
                          title="Delete Task"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Latest Execution Comment & Parsed Metrics View */}
                  {latestComment && (
                    <div className="mt-1 p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] flex flex-col gap-1 text-[11.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)] text-[10.5px]">
                          <MessageSquare size={11} className="text-[var(--primary)]" />
                          <span>Latest Execution Details:</span>
                        </div>
                        {metrics && (metrics.totalTestCases > 0 || metrics.completedTestCases > 0 || metrics.openDefects > 0) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-mono font-bold text-[10px]">
                              {metrics.completedTestCases}/{metrics.totalTestCases} Tests Done
                            </span>
                            {metrics.blockedTestCases > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-red-500/10 text-red-600 font-mono font-bold text-[10px]">
                                {metrics.blockedTestCases} Blocked
                              </span>
                            )}
                            {metrics.failedTestCases > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-red-500/10 text-red-600 font-mono font-bold text-[10px]">
                                {metrics.failedTestCases} Failed
                              </span>
                            )}
                            {metrics.openDefects > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-mono font-bold text-[10px]">
                                {metrics.openDefects} Defects
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-[var(--text-primary)] italic text-[11px] leading-relaxed">
                        "{latestComment}"
                      </div>
                    </div>
                  )}

                  {/* Inline EOD Execution Comment / Close Task Form */}
                  {isCommentFormOpen && onUpdateTask && (
                    <div className="mt-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--primary)]/40 shadow-xs flex flex-col gap-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
                          <Sparkles size={13} />
                          <span>End of Day: Update Task & Log Complete Execution Details</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveCommentTaskId(null)}
                          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Quick Templates */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Quick Templates:</span>
                        <button
                          type="button"
                          onClick={() => applyExecutionTemplate('all_passed')}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[10.5px] font-semibold border border-emerald-500/20 cursor-pointer"
                        >
                          All Tests Passed (8/8)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyExecutionTemplate('partial')}
                          className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-[10.5px] font-semibold border border-amber-500/20 cursor-pointer"
                        >
                          Partial + 2 Defects
                        </button>
                        <button
                          type="button"
                          onClick={() => applyExecutionTemplate('blocked')}
                          className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 text-[10.5px] font-semibold border border-red-500/20 cursor-pointer"
                        >
                          Blocked
                        </button>
                        <button
                          type="button"
                          onClick={() => applyExecutionTemplate('not_applicable')}
                          className="px-2 py-0.5 rounded bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-400 text-[10.5px] font-semibold border border-slate-500/20 cursor-pointer"
                        >
                          Not Applicable (N/A)
                        </button>
                      </div>

                      <textarea
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                        rows={2}
                        placeholder="e.g. Total Test Cases: 10 | Completed: 10 | Blocked: 0 | Failed: 0 | Open Defects: 0. All acceptance criteria validated."
                        className="w-full px-3 py-2 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                        autoFocus
                      />

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={closeOnComment}
                            onChange={e => setCloseOnComment(e.target.checked)}
                            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-0"
                          />
                          <span>Close Task for Today (Mark Completed)</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleSaveEodExecutionComment(task)}
                          disabled={!commentInput.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCheck size={13} />
                          <span>Save & Close Task</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-2.5 px-3 text-center bg-[var(--surface-hover)] border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)]">
              No tasks logged under this {parentType === 'story' ? 'User Story' : 'Bug'} yet. Click <span className="font-bold text-[var(--primary)]">"Create Task for Today"</span> above to plan daily execution.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
