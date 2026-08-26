import React, { useState } from 'react';
import { Task, TeamMember, Priority, TaskStatus } from '../../types';
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
  FolderGit2
} from 'lucide-react';
import { generateId, toDateStr } from '../../utils/date';
import { getWorkItemAssignee } from '../../utils/assigneeUtils';

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
      sourceInstance: 'local',
      createdAt: new Date().toISOString()
    };

    onAddTask(taskPayload);
    setNewTaskTitle('');
    setIsAdding(false);
    setIsExpanded(true);
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
            <span>Tasks:</span>
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
              {closedTasks} closed
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
              title={`Add child task to this ${parentType === 'story' ? 'User Story' : 'Bug'}`}
            >
              <Plus size={12} />
              <span>Add Task</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg border border-[var(--border)] transition-all cursor-pointer"
          >
            <span>{isExpanded ? 'Hide' : 'View Tasks'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Quick Add Inline Form */}
      {isAdding && (
        <form 
          onSubmit={handleCreateTask}
          className="mt-2.5 p-3 bg-[var(--surface)] border border-[var(--primary)]/30 rounded-xl shadow-xs flex flex-col gap-2.5 animate-fadeIn"
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
            placeholder="e.g. Implement backend validation endpoint, unit test error cases..."
            className="w-full px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            autoFocus
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
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
              <span>Add to Daily Board</span>
            </button>
          </div>
        </form>
      )}

      {/* Expanded Task Checklist */}
      {isExpanded && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {childTasks.length > 0 ? (
            childTasks.map(task => {
              const isCompleted = task.status === 'complete';
              const assignee = getWorkItemAssignee(task, team);

              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs transition-all ${
                    isCompleted
                      ? 'bg-[var(--surface-hover)]/60 border-[var(--border)] opacity-80'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/30'
                  }`}
                >
                  {/* Left: Interactive Checkbox & Title */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleStatus && onToggleStatus(task.id)}
                      className={`shrink-0 transition-transform active:scale-90 cursor-pointer ${
                        isCompleted ? 'text-emerald-500' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'
                      }`}
                      title={isCompleted ? 'Mark as Open / Pending' : 'Mark as Complete'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={16} className="fill-emerald-500 text-white dark:text-gray-900" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>

                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                      {task.adoId && (
                        <span className="font-mono text-[10px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.2 rounded border border-[var(--border)] shrink-0">
                          Task #{task.adoId}
                        </span>
                      )}

                      <span className={`font-medium truncate ${
                        isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                      }`}>
                        {task.title}
                      </span>
                    </div>
                  </div>

                  {/* Right: Meta & Assignee & Delete */}
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
              );
            })
          ) : (
            <div className="py-2.5 px-3 text-center bg-[var(--surface-hover)] border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)]">
              No tasks logged under this {parentType === 'story' ? 'User Story' : 'Bug'} yet. Click <span className="font-bold text-[var(--primary)]">"Add Task"</span> above to plan daily execution.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
