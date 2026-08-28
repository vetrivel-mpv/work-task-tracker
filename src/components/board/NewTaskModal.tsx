import React, { useState } from 'react';
import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  Defect, 
  Release, 
  Priority 
} from '../../types';
import { X, Clock, Calendar, Check, AlertCircle, BookOpen, Lock, Link as LinkIcon, Search, Users } from 'lucide-react';
import { toDateStr, shiftDate } from '../../utils/date';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';
import { MultiSearchableSelect } from '../common/MultiSearchableSelect';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  tasks?: Task[];
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  selectedReleaseId: string | null;
  onAddTask: (task: Partial<Task>) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  tasks = [],
  team,
  groups,
  userStories,
  defects,
  releases,
  selectedReleaseId,
  onAddTask
}) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [dueDate, setDueDate] = useState(dateStr);
  const [priority, setPriority] = useState<Priority>('medium');
  const [targetDay, setTargetDay] = useState<'today' | 'tomorrow'>('today');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || '');
  const [linkedItemType, setLinkedItemType] = useState<'none' | 'story' | 'defect'>('none');
  const [linkedItemId, setLinkedItemId] = useState<string>('');
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<string[]>([]);
  const [dependencySearch, setDependencySearch] = useState('');
  const [initialNote, setInitialNote] = useState('');

  if (!isOpen) return null;

  const targetDateStr = targetDay === 'today' ? dateStr : shiftDate(dateStr, 1);

  // Available stories and defects for linkage
  const availableStories = releaseId 
    ? userStories.filter(s => s.releaseId === releaseId) 
    : userStories;
  const availableDefects = releaseId 
    ? defects.filter(d => d.releaseId === releaseId) 
    : defects;

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleGroup = (id: string) => {
    setGroupIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleDependency = (taskId: string) => {
    setDependsOnTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      title: title.trim(),
      time: time.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      priority,
      status: 'pending',
      dateStr: targetDateStr,
      assigneeIds,
      groupIds,
      releaseId: releaseId || undefined,
      userStoryId: linkedItemType === 'story' ? linkedItemId : undefined,
      defectId: linkedItemType === 'defect' ? linkedItemId : undefined,
      dependsOnTaskIds: dependsOnTaskIds.length > 0 ? dependsOnTaskIds : undefined,
      comments: initialNote.trim() ? [
        {
          id: `c-${Date.now()}`,
          author: 'Alex Rivera (Lead)',
          text: initialNote.trim(),
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ] : []
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Create New Task</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
          {/* Target Board Day */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTargetDay('today');
                setDueDate(dateStr);
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                targetDay === 'today'
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Today ({dateStr})
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetDay('tomorrow');
                setDueDate(shiftDate(dateStr, 1));
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                targetDay === 'tomorrow'
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Tomorrow ({shiftDate(dateStr, 1)})
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              Task Title <span className="text-[var(--critical)]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sanity test EHR patient sync endpoint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              autoFocus
            />
          </div>

          {/* Priority, Scheduled Time & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              >
                <option value="critical">Critical (P0 / Urgent Blocker)</option>
                <option value="high">High (P1 / Daily Focus)</option>
                <option value="medium">Medium (P2 / Sprint Progress)</option>
                <option value="low">Low (P3 / Maintenance)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Time Block (Optional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Due Date Field with Quick Presets */}
          <div className="p-3 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Calendar size={13} className="text-[var(--primary)]" />
                <span>Due Date</span>
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">
                Warning triggers if pending past this date
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 text-xs font-semibold px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={() => setDueDate(dateStr)}
                className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] rounded-lg cursor-pointer transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDueDate(shiftDate(dateStr, 1))}
                className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] rounded-lg cursor-pointer transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDueDate(shiftDate(dateStr, 3))}
                className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] rounded-lg cursor-pointer transition-colors"
              >
                +3d
              </button>
            </div>
          </div>

          {/* Release Association */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Release Scope</label>
            <SearchableSelect
              options={releases.map(r => ({
                value: r.id,
                label: r.name,
                sublabel: r.targetDate ? `Target: ${r.targetDate}` : undefined,
                badge: r.status
              }))}
              value={releaseId}
              onChange={(val) => {
                setReleaseId(val);
                setLinkedItemId('');
              }}
              placeholder="No Specific Release"
              allOptionLabel="No Specific Release"
              searchPlaceholder="Search releases..."
              size="sm"
            />
          </div>

          {/* Link to User Story or Defect */}
          <div className="p-3 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl flex flex-col gap-2">
            <label className="block text-xs font-bold text-[var(--text-primary)]">Link to Deliverable (Optional)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setLinkedItemType('none'); setLinkedItemId(''); }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  linkedItemType === 'none' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                }`}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => { setLinkedItemType('story'); setLinkedItemId(''); }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  linkedItemType === 'story' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                }`}
              >
                User Story
              </button>
              <button
                type="button"
                onClick={() => { setLinkedItemType('defect'); setLinkedItemId(''); }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  linkedItemType === 'defect' ? 'bg-[var(--critical)] text-white border-[var(--critical)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                }`}
              >
                Defect
              </button>
            </div>

            {linkedItemType === 'story' && (
              <div className="mt-1">
                <SearchableSelect
                  options={availableStories.map(s => ({
                    value: s.id,
                    label: s.adoId ? `US-${s.adoId}: ${s.title}` : s.title,
                    sublabel: `Status: ${s.status} • Area: ${s.areaPath || 'None'}`,
                    badge: s.storyPoints ? `${s.storyPoints} pts` : undefined
                  }))}
                  value={linkedItemId}
                  onChange={setLinkedItemId}
                  placeholder="Select User Story..."
                  allOptionLabel="Select User Story..."
                  searchPlaceholder="Search stories by title or ID..."
                  size="sm"
                />
              </div>
            )}

            {linkedItemType === 'defect' && (
              <div className="mt-1">
                <SearchableSelect
                  options={availableDefects.map(d => ({
                    value: d.id,
                    label: d.adoId ? `DEF-${d.adoId}: ${d.title}` : d.title,
                    sublabel: `Status: ${d.status} • Sev: ${d.severity}`,
                    badge: d.severity.toUpperCase(),
                    badgeColor: d.severity === 'critical' ? '#E11D48' : '#D97706'
                  }))}
                  value={linkedItemId}
                  onChange={setLinkedItemId}
                  placeholder="Select Defect / Bug..."
                  allOptionLabel="Select Defect / Bug..."
                  searchPlaceholder="Search defects by title, severity, or ID..."
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* Assignees Selection */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">Assignees</label>
            <MultiSearchableSelect
              options={team.map(m => ({
                value: m.id,
                label: m.name,
                sublabel: m.role,
                avatarColor: m.avatarColor || 'var(--primary)',
                avatarInitials: m.name.split(' ').map(n => n[0]).join('').slice(0, 2)
              }))}
              values={assigneeIds}
              onChange={setAssigneeIds}
              placeholder="Assign team members..."
              allOptionLabel="Select all members"
              searchPlaceholder="Search members by name or role..."
              size="sm"
              icon={<Users size={13} />}
              maxDisplayTags={3}
            />
          </div>

          {/* Groups Selection */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">Squad / Pod (Optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(grp => {
                const isSelected = groupIds.includes(grp.id);
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => toggleGroup(grp.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {grp.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Dependencies & Blockers Section */}
          <div className="p-3.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Lock size={13} className="text-[var(--primary)]" />
                <span>Task Dependencies / Prerequisites</span>
              </label>
              {dependsOnTaskIds.length > 0 && (
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                  {dependsOnTaskIds.length} {dependsOnTaskIds.length === 1 ? 'Prereq' : 'Prereqs'} selected
                </span>
              )}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              If selected prerequisite tasks are incomplete, this task will display a <strong className="text-red-500 font-bold">Blocked</strong> status icon on the TaskBoard.
            </p>

            {tasks.length > 0 ? (
              <div className="flex flex-col gap-1.5 mt-1">
                {tasks.length > 5 && (
                  <div className="relative mb-1">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Filter available tasks..."
                      value={dependencySearch}
                      onChange={(e) => setDependencySearch(e.target.value)}
                      className="w-full text-[11px] pl-7 pr-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)]"
                    />
                  </div>
                )}

                <div className="max-h-32 overflow-y-auto flex flex-col gap-1 pr-1">
                  {tasks
                    .filter(t => {
                      if (!dependencySearch.trim()) return true;
                      return t.title.toLowerCase().includes(dependencySearch.toLowerCase().trim());
                    })
                    .map(t => {
                      const isSelected = dependsOnTaskIds.includes(t.id);
                      const isComplete = t.status === 'complete';

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleDependency(t.id)}
                          className={`p-2 rounded-lg text-left text-xs border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)] font-bold'
                              : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                              isSelected ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)]'
                            }`}>
                              {isSelected && '✓'}
                            </span>
                            <span className={`truncate text-xs ${isComplete ? 'line-through opacity-70' : ''}`}>
                              {t.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 text-[10px]">
                            <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                              t.priority === 'critical' ? 'bg-red-500/15 text-red-600' : 'bg-slate-500/10 text-slate-600'
                            }`}>
                              {t.priority}
                            </span>
                            <span className={`font-semibold ${isComplete ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`}>
                              {isComplete ? 'Done' : 'Pending'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] italic">No existing tasks available to link as prerequisites.</span>
            )}
          </div>

          {/* Initial Note / Comments */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Initial Note (Optional)</label>
            <textarea
              rows={2}
              placeholder="Any context, links, or verification steps..."
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-xs cursor-pointer"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
