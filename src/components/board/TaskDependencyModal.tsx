import React, { useState, useMemo } from 'react';
import { Task, TeamMember } from '../../types';
import { 
  X, 
  Lock, 
  Unlock, 
  Link as LinkIcon, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Search, 
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { getTaskBlockedStatus, wouldCreateCircularDependency } from '../../utils/taskDependencies';

interface TaskDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  allTasks: Task[];
  team: TeamMember[];
  onUpdateDependencies: (taskId: string, newDependsOnTaskIds: string[]) => void;
}

export const TaskDependencyModal: React.FC<TaskDependencyModalProps> = ({
  isOpen,
  onClose,
  task,
  allTasks,
  team,
  onUpdateDependencies
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'same_day'>('all');

  if (!isOpen || !task) return null;

  const currentDependsOn = task.dependsOnTaskIds || [];
  const statusInfo = getTaskBlockedStatus(task, allTasks);

  // Available candidate tasks to add as prerequisites
  const candidateTasks = allTasks.filter(t => {
    if (t.id === task.id) return false;
    if (currentDependsOn.includes(t.id)) return false;
    
    // Check search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchAssignee = team.some(m => t.assigneeIds && t.assigneeIds.includes(m.id) && m.name.toLowerCase().includes(q));
      if (!matchTitle && !matchAssignee) return false;
    }

    if (filterType === 'pending' && t.status === 'complete') return false;
    if (filterType === 'same_day' && t.dateStr !== task.dateStr) return false;

    return true;
  });

  const handleAddDependency = (prerequisiteTaskId: string) => {
    if (wouldCreateCircularDependency(task.id, prerequisiteTaskId, allTasks)) {
      return;
    }
    const updated = [...currentDependsOn, prerequisiteTaskId];
    onUpdateDependencies(task.id, updated);
  };

  const handleRemoveDependency = (prerequisiteTaskId: string) => {
    const updated = currentDependsOn.filter(id => id !== prerequisiteTaskId);
    onUpdateDependencies(task.id, updated);
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)]';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl flex items-center justify-center ${
              statusInfo.isBlocked 
                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' 
                : currentDependsOn.length > 0 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-[var(--primary-light)] text-[var(--primary)]'
            }`}>
              {statusInfo.isBlocked ? <Lock size={18} /> : currentDependsOn.length > 0 ? <Unlock size={18} /> : <LinkIcon size={18} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">
                Manage Dependencies & Blockers
              </h2>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {task.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
          {/* Status Diagnostic Card */}
          {statusInfo.isBlocked ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <ShieldAlert className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1 text-xs">
                <span className="font-bold text-red-700 dark:text-red-300 block text-sm mb-0.5">
                  Task is currently Blocked
                </span>
                <p className="text-red-600/90 dark:text-red-300/90">
                  Waiting on <strong className="font-bold">{statusInfo.blockingTasks.length}</strong> unfinished prerequisite {statusInfo.blockingTasks.length === 1 ? 'task' : 'tasks'}. 
                  Once all prerequisites are completed, this task will automatically clear its blocked status on the board.
                </p>
              </div>
            </div>
          ) : currentDependsOn.length > 0 ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1 text-xs">
                <span className="font-bold text-emerald-700 dark:text-emerald-300 block text-sm mb-0.5">
                  All Dependencies Satisfied ({statusInfo.completedPrerequisites}/{statusInfo.totalPrerequisites})
                </span>
                <p className="text-emerald-600/90 dark:text-emerald-300/90">
                  All prerequisite tasks have been marked complete. This task is unblocked and ready for active delivery.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
              <HelpCircle size={16} className="text-[var(--primary)] flex-shrink-0 mt-0.5" />
              <p>
                Defining prerequisites prevents tasks from being started out of sequence and shows a prominent <strong className="text-[var(--text-primary)]">Blocked</strong> icon when waiting on work.
              </p>
            </div>
          )}

          {/* Section 1: Current Prerequisites */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide">
                <Lock size={13} className="text-[var(--primary)]" />
                <span>Prerequisites for this Task ({statusInfo.allPrerequisiteTasks.length})</span>
              </h3>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {statusInfo.completedPrerequisites} of {statusInfo.totalPrerequisites} completed
              </span>
            </div>

            {statusInfo.allPrerequisiteTasks.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
                No prerequisite tasks assigned. Select tasks below to define blockers.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {statusInfo.allPrerequisiteTasks.map(prereq => {
                  const isDone = prereq.status === 'complete';
                  const assignees = team.filter(m => prereq.assigneeIds?.includes(m.id));

                  return (
                    <div 
                      key={prereq.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isDone 
                          ? 'bg-emerald-500/5 border-emerald-500/30' 
                          : 'bg-red-500/5 border-red-500/30 ring-1 ring-red-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isDone ? 'bg-emerald-500 text-white' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                          {isDone ? <CheckCircle2 size={14} /> : <Lock size={13} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold truncate ${isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                              {prereq.title}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${getPriorityBadgeClass(prereq.priority)}`}>
                              {prereq.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                            <span>Status: <strong className={isDone ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{prereq.status}</strong></span>
                            {assignees.length > 0 && (
                              <span>• Assignee: {assignees.map(a => a.name.split(' ')[0]).join(', ')}</span>
                            )}
                            {prereq.dateStr && (
                              <span>• Target: {prereq.dateStr}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveDependency(prereq.id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer flex-shrink-0"
                        title="Remove dependency"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Add New Prerequisites */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide">
                <Plus size={13} className="text-[var(--primary)]" />
                <span>Add Prerequisite Task</span>
              </h3>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search available tasks to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center gap-1 bg-[var(--surface-hover)] p-0.5 rounded-xl border border-[var(--border)]">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    filterType === 'all' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('pending')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    filterType === 'pending' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Pending Only
                </button>
                <button
                  onClick={() => setFilterType('same_day')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    filterType === 'same_day' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Same Day
                </button>
              </div>
            </div>

            {/* Candidate List */}
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {candidateTasks.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
                  {searchQuery ? 'No matching candidate tasks found.' : 'No more candidate tasks available.'}
                </div>
              ) : (
                candidateTasks.map(candidate => {
                  const isCircular = wouldCreateCircularDependency(task.id, candidate.id, allTasks);
                  const isDone = candidate.status === 'complete';

                  return (
                    <div
                      key={candidate.id}
                      className={`p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] flex items-center justify-between gap-3 transition-colors ${
                        isCircular ? 'opacity-50 bg-slate-500/5' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold truncate ${isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                            {candidate.title}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${getPriorityBadgeClass(candidate.priority)}`}>
                            {candidate.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-muted)] mt-0.5">
                          <span>Status: <strong className={isDone ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}>{candidate.status}</strong></span>
                          <span>• Date: {candidate.dateStr}</span>
                          {candidate.time && <span>• Time: {candidate.time}</span>}
                        </div>
                      </div>

                      {isCircular ? (
                        <span className="text-[10px] text-red-500 font-bold px-2 py-1 bg-red-500/10 rounded-lg" title="Would create circular dependency">
                          Circular Loop
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddDependency(candidate.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                        >
                          <Plus size={12} />
                          <span>Add Blocker</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 3: Downstream Impact (Tasks Waiting on This Task) */}
          {statusInfo.dependentTasks.length > 0 && (
            <div className="pt-3 border-t border-[var(--border)]">
              <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wide mb-2">
                <ArrowRight size={13} className="text-amber-500" />
                <span>Downstream Impact: Tasks Waiting on this Ticket ({statusInfo.dependentTasks.length})</span>
              </h3>
              <div className="flex flex-col gap-1.5">
                {statusInfo.dependentTasks.map(dep => (
                  <div key={dep.id} className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)] truncate">{dep.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      task.status === 'complete' 
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-red-500/15 text-red-700 dark:text-red-300'
                    }`}>
                      {task.status === 'complete' ? 'Unblocked' : 'Blocked by this'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">
            Changes are saved in real-time.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
