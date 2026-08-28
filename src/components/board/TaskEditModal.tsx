import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  Defect, 
  Release, 
  Priority,
  TaskStatus,
  TaskComment
} from '../../types';
import { 
  X, 
  Clock, 
  Calendar, 
  Check, 
  AlertTriangle, 
  BookOpen, 
  Lock, 
  Unlock,
  Link as LinkIcon, 
  Search, 
  Users, 
  Trash2, 
  ExternalLink, 
  MessageSquare, 
  Send, 
  Tag, 
  Layers, 
  Flame, 
  ShieldAlert, 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  CheckCircle2, 
  Clock4, 
  Sparkles,
  HelpCircle,
  Building2,
  FolderGit2,
  AlertCircle,
  UserCheck,
  UserPlus,
  UserX,
  ChevronDown,
  User,
  Briefcase,
  Plus
} from 'lucide-react';
import { toDateStr, shiftDate } from '../../utils/date';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';
import { MultiSearchableSelect } from '../common/MultiSearchableSelect';
import { getTaskBlockedStatus, wouldCreateCircularDependency } from '../../utils/taskDependencies';
import { cleanAdoHtml } from '../../utils/formatAdoHtml';
import { getWorkItemAssignees, getAvatarColorForName } from '../../utils/assigneeUtils';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  allTasks?: Task[];
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  currentDateStr?: string;
  onUpdateTask: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddComment?: (taskId: string, commentText: string) => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  onClose,
  task,
  allTasks = [],
  team,
  groups,
  userStories,
  defects,
  releases,
  currentDateStr = toDateStr(new Date()),
  onUpdateTask,
  onDeleteTask,
  onAddComment
}) => {
  // Form State initialized from task
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dateStr, setDateStr] = useState(task.dateStr || currentDateStr);
  const [time, setTime] = useState(task.time || '');
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task.assigneeIds && task.assigneeIds.length > 0
      ? task.assigneeIds
      : task.assigneeId
      ? [task.assigneeId]
      : []
  );
  const [groupIds, setGroupIds] = useState<string[]>(task.groupIds || []);
  const [releaseId, setReleaseId] = useState<string>(task.releaseId || '');
  const [userStoryId, setUserStoryId] = useState<string>(task.userStoryId || '');
  const [defectId, setDefectId] = useState<string>(task.defectId || '');
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<string[]>(task.dependsOnTaskIds || []);
  
  // Local Comment state
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsList, setCommentsList] = useState<TaskComment[]>(task.comments || []);
  const [dependencySearch, setDependencySearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Quick Assign Dropdown State
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [quickAssignSearch, setQuickAssignSearch] = useState('');
  const [quickAssignSquadFilter, setQuickAssignSquadFilter] = useState<string>('all');
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const quickAssignRef = useRef<HTMLDivElement>(null);
  const quickAssignInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever opened with new task
  useEffect(() => {
    if (isOpen) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority);
      setDateStr(task.dateStr || currentDateStr);
      setTime(task.time || '');
      setDueDate(task.dueDate || '');
      setAssigneeIds(
        task.assigneeIds && task.assigneeIds.length > 0
          ? task.assigneeIds
          : task.assigneeId
          ? [task.assigneeId]
          : []
      );
      setGroupIds(task.groupIds || []);
      setReleaseId(task.releaseId || '');
      setUserStoryId(task.userStoryId || '');
      setDefectId(task.defectId || '');
      setDependsOnTaskIds(task.dependsOnTaskIds || []);
      setCommentsList(task.comments || []);
      setNewCommentText('');
      setConfirmDelete(false);
      setSaveSuccessNotice(false);
      setQuickAssignOpen(false);
      setQuickAssignSearch('');
      setQuickAssignSquadFilter('all');
      setToastNotice(null);
    }
  }, [isOpen, task, currentDateStr]);

  // Handle outside click to close Quick Assign dropdown
  useEffect(() => {
    if (!quickAssignOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickAssignRef.current && !quickAssignRef.current.contains(e.target as Node)) {
        setQuickAssignOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quickAssignOpen]);

  // Auto-focus search input when quick assign opens
  useEffect(() => {
    if (quickAssignOpen && quickAssignInputRef.current) {
      setTimeout(() => {
        quickAssignInputRef.current?.focus();
      }, 50);
    }
  }, [quickAssignOpen]);

  // Member Workload Calculation (active non-completed tasks)
  const memberWorkload = useMemo(() => {
    const map: Record<string, number> = {};
    team.forEach(m => { map[m.id] = 0; });
    allTasks.forEach(t => {
      if (t.status !== 'complete') {
        if (t.assigneeIds && t.assigneeIds.length > 0) {
          t.assigneeIds.forEach(id => {
            map[id] = (map[id] || 0) + 1;
          });
        } else if (t.assigneeId) {
          map[t.assigneeId] = (map[t.assigneeId] || 0) + 1;
        }
      }
    });
    return map;
  }, [team, allTasks]);

  // Filtered members for Quick Assign
  const filteredQuickAssignMembers = useMemo(() => {
    return team.filter(m => {
      const q = quickAssignSearch.trim().toLowerCase();
      const matchesSearch = !q || 
        m.name.toLowerCase().includes(q) || 
        (typeof m.role === 'string' && m.role.toLowerCase().includes(q));
      
      if (!matchesSearch) return false;
      
      if (quickAssignSquadFilter === 'all') return true;
      const squad = groups.find(g => g.id === quickAssignSquadFilter);
      return squad ? (squad.memberIds || []).includes(m.id) : true;
    });
  }, [team, quickAssignSearch, quickAssignSquadFilter, groups]);

  // Helper to trigger transient toast
  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice(prev => (prev === msg ? null : prev));
    }, 2500);
  };

  // Quick Assign Handlers
  const handleQuickToggleAssignee = (memberId: string) => {
    const member = team.find(m => m.id === memberId);
    const isCurrentlyAssigned = assigneeIds.includes(memberId);
    const nextIds = isCurrentlyAssigned
      ? assigneeIds.filter(id => id !== memberId)
      : [...assigneeIds, memberId];
    
    setAssigneeIds(nextIds);
    if (member) {
      showToast(isCurrentlyAssigned ? `Removed ${member.name}` : `Assigned ${member.name}`);
    }
  };

  const handleQuickAssignOnly = (memberId: string) => {
    const member = team.find(m => m.id === memberId);
    setAssigneeIds([memberId]);
    if (member) {
      showToast(`Assigned solely to ${member.name}`);
    }
  };

  const handleQuickUnassignAll = () => {
    setAssigneeIds([]);
    showToast('Unassigned all team members');
  };

  const handleQuickAssignSquad = (groupId: string) => {
    const squad = groups.find(g => g.id === groupId);
    if (!squad || !squad.memberIds || squad.memberIds.length === 0) return;
    
    const nextIds = Array.from(new Set([...assigneeIds, ...squad.memberIds]));
    setAssigneeIds(nextIds);
    if (!groupIds.includes(groupId)) {
      setGroupIds([...groupIds, groupId]);
    }
    showToast(`Assigned ${squad.name} (${squad.memberIds.length} members)`);
  };

  // Keyboard shortcut: Escape to close, Ctrl/Cmd + Enter to save
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, title, status, priority, dateStr, time, dueDate, assigneeIds, groupIds, releaseId, userStoryId, defectId, dependsOnTaskIds, commentsList]);

  if (!isOpen) return null;

  // Prerequisite & Blocker evaluation
  const previewTask: Task = {
    ...task,
    status,
    dependsOnTaskIds
  };
  const blockedStatus = getTaskBlockedStatus(previewTask, allTasks);
  const { isBlocked, blockingTasks, allPrerequisiteTasks, totalPrerequisites, completedPrerequisites } = blockedStatus;

  // Overdue status
  const isOverdue = Boolean(dueDate && status !== 'complete' && dueDate < currentDateStr);
  const isDueToday = Boolean(dueDate && status !== 'complete' && dueDate === currentDateStr);

  // Assignee options for selector
  const assigneeOptions: SelectOption[] = team.map(m => ({
    value: m.id,
    label: m.name,
    sublabel: typeof m.role === 'string' ? m.role : m.role,
    avatarColor: m.avatarColor || getAvatarColorForName(m.name),
    avatarInitials: m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }));

  // Squad / Group options
  const groupOptions: SelectOption[] = groups.map(g => ({
    value: g.id,
    label: g.name,
    badge: `${(g.memberIds || []).length} members`,
    badgeColor: g.color
  }));

  // Story options
  const storyOptions: SelectOption[] = [
    { value: '', label: 'None (Unlinked)' },
    ...userStories.map(s => ({
      value: s.id,
      label: s.title,
      sublabel: `Iteration: ${s.iterationPath || 'Unassigned'} • Status: ${s.status}`,
      badge: `#${s.id}`
    }))
  ];

  // Defect options
  const defectOptions: SelectOption[] = [
    { value: '', label: 'None (Unlinked)' },
    ...defects.map(d => ({
      value: d.id,
      label: d.title,
      sublabel: `Severity: ${d.severity} • Status: ${d.status}`,
      badge: `#${d.id}`
    }))
  ];

  // Release options
  const releaseOptions: SelectOption[] = [
    { value: '', label: 'No Specific Release' },
    ...releases.map(r => ({
      value: r.id,
      label: r.name,
      sublabel: `Target: ${r.targetDate} • ${r.status}`,
      badge: r.releaseNumber || r.id
    }))
  ];

  // Candidate prerequisites from allTasks (exclude self & already selected)
  const candidatePrerequisites = allTasks.filter(t => 
    t.id !== task.id &&
    !dependsOnTaskIds.includes(t.id) &&
    !wouldCreateCircularDependency(task.id, t.id, allTasks) &&
    (dependencySearch.trim() === '' || 
      t.title.toLowerCase().includes(dependencySearch.toLowerCase()) ||
      t.id.toLowerCase().includes(dependencySearch.toLowerCase())
    )
  );

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

  const addPrerequisite = (candidateId: string) => {
    if (!dependsOnTaskIds.includes(candidateId)) {
      setDependsOnTaskIds([...dependsOnTaskIds, candidateId]);
    }
  };

  const removePrerequisite = (prereqId: string) => {
    setDependsOnTaskIds(dependsOnTaskIds.filter(id => id !== prereqId));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      author: 'Current User (Engineer)',
      text: newCommentText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedComments = [...commentsList, newComment];
    setCommentsList(updatedComments);
    setNewCommentText('');

    if (onAddComment) {
      onAddComment(task.id, newComment.text);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const primaryAssignee = team.find(m => assigneeIds.includes(m.id));

    const updatedTask: Task = {
      ...task,
      title: title.trim(),
      status,
      priority,
      dateStr: dateStr.trim() || currentDateStr,
      time: time.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      assigneeIds,
      assigneeId: assigneeIds[0] || null,
      assigneeName: primaryAssignee?.name || task.assigneeName,
      groupIds,
      releaseId: releaseId || undefined,
      userStoryId: userStoryId || undefined,
      defectId: defectId || undefined,
      dependsOnTaskIds: dependsOnTaskIds.length > 0 ? dependsOnTaskIds : undefined,
      comments: commentsList,
      completedAt: status === 'complete' && !task.completedAt 
        ? new Date().toISOString() 
        : status !== 'complete' 
        ? undefined 
        : task.completedAt
    };

    onUpdateTask(updatedTask);
    setSaveSuccessNotice(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleDelete = () => {
    if (onDeleteTask) {
      onDeleteTask(task.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* TOP MODAL HEADER */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0 relative">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Task Type / ADO Badge */}
            {task.adoId ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-xs font-mono font-bold border border-[var(--primary)]/30">
                <FolderGit2 size={13} />
                <span>ADO #{task.adoId}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-xs font-mono font-bold border border-[var(--border)]">
                <span>Task #{task.id.slice(0, 8)}</span>
              </div>
            )}

            {task.adoId && (
              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                ADO #{task.adoId}
              </span>
            )}

            {task.adoUrl && (
              <a
                href={task.adoUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--primary)] hover:underline font-medium"
                title="Open directly in Azure DevOps"
              >
                <span>View in ADO</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* QUICK ASSIGN DROPDOWN */}
            <div className="relative" ref={quickAssignRef}>
              <button
                type="button"
                id="task-edit-quick-assign-btn"
                onClick={() => setQuickAssignOpen(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  quickAssignOpen
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                    : assigneeIds.length > 0
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary-light)]/80'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Quick assign team members directly from this popup"
              >
                <UserCheck size={14} className={assigneeIds.length > 0 ? (quickAssignOpen ? 'text-white' : 'text-[var(--primary)]') : 'text-[var(--text-muted)]'} />
                <span className="hidden sm:inline">Quick Assign</span>
                <span className="sm:hidden">Assign</span>
                {assigneeIds.length > 0 ? (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    quickAssignOpen ? 'bg-white/25 text-white' : 'bg-[var(--primary)] text-white'
                  }`}>
                    {assigneeIds.length}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-75 font-normal">None</span>
                )}
                <ChevronDown size={13} className={`transition-transform duration-150 ${quickAssignOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* QUICK ASSIGN DROPDOWN POPOVER */}
              {quickAssignOpen && (
                <div 
                  id="task-quick-assign-popover"
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Header */}
                  <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                      <Users size={14} className="text-[var(--primary)]" />
                      <span>Quick Assign ({assigneeIds.length}/{team.length} assigned)</span>
                    </div>
                    {assigneeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleQuickUnassignAll}
                        className="text-[11px] font-semibold text-[var(--critical)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <UserX size={12} />
                        <span>Unassign All</span>
                      </button>
                    )}
                  </div>

                  {/* Search Box */}
                  <div className="p-2.5 border-b border-[var(--border)]">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        ref={quickAssignInputRef}
                        type="text"
                        value={quickAssignSearch}
                        onChange={(e) => setQuickAssignSearch(e.target.value)}
                        placeholder="Search engineer by name or role..."
                        className="w-full text-xs pl-8 pr-7 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                      {quickAssignSearch && (
                        <button
                          type="button"
                          onClick={() => setQuickAssignSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Squad Filter Chips (if groups exist) */}
                    {groups.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
                        <button
                          type="button"
                          onClick={() => setQuickAssignSquadFilter('all')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            quickAssignSquadFilter === 'all'
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          All ({team.length})
                        </button>
                        {groups.map(g => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setQuickAssignSquadFilter(g.id === quickAssignSquadFilter ? 'all' : g.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                              quickAssignSquadFilter === g.id
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color || '#3b82f6' }} />
                            <span>{g.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Squad Assign Bar (if filtering by squad) */}
                  {quickAssignSquadFilter !== 'all' && (
                    <div className="px-3 py-1.5 bg-[var(--primary-light)]/40 border-b border-[var(--border)] flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Assign all members of this squad?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAssignSquad(quickAssignSquadFilter)}
                        className="px-2 py-0.5 bg-[var(--primary)] text-white rounded text-[10.5px] font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
                      >
                        Assign Squad
                      </button>
                    </div>
                  )}

                  {/* Member List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border)]">
                    {filteredQuickAssignMembers.length > 0 ? (
                      filteredQuickAssignMembers.map(member => {
                        const isAssigned = assigneeIds.includes(member.id);
                        const activeTasksCount = memberWorkload[member.id] || 0;
                        const avatarColor = member.avatarColor || getAvatarColorForName(member.name);
                        const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                        return (
                          <div
                            key={member.id}
                            className={`px-3 py-2 flex items-center justify-between transition-colors hover:bg-[var(--surface-hover)] ${
                              isAssigned ? 'bg-[var(--primary-light)]/20' : ''
                            }`}
                          >
                            <div 
                              onClick={() => handleQuickToggleAssignee(member.id)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer mr-2"
                            >
                              {/* Avatar */}
                              <div 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white flex-shrink-0 shadow-2xs"
                                style={{ backgroundColor: avatarColor }}
                              >
                                {initials}
                              </div>

                              {/* Name & Role */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {member.name}
                                  </span>
                                  {isAssigned && (
                                    <span className="px-1.5 py-0.2 text-[9.5px] font-extrabold rounded bg-[var(--primary)] text-white">
                                      Assigned
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-secondary)] truncate">
                                  <span>{typeof member.role === 'string' ? member.role : 'Engineer'}</span>
                                  <span>•</span>
                                  <span className={`${
                                    activeTasksCount === 0 
                                      ? 'text-emerald-600 dark:text-emerald-400 font-medium' 
                                      : activeTasksCount >= 4 
                                      ? 'text-red-500 font-bold' 
                                      : 'text-[var(--text-muted)]'
                                  }`}>
                                    {activeTasksCount} {activeTasksCount === 1 ? 'task' : 'tasks'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleQuickAssignOnly(member.id)}
                                className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] rounded cursor-pointer transition-all"
                                title="Assign solely this person (replaces others)"
                              >
                                Only
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickToggleAssignee(member.id)}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isAssigned
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-2xs'
                                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)]'
                                }`}
                                title={isAssigned ? 'Click to unassign' : 'Click to assign'}
                              >
                                {isAssigned ? <Check size={13} /> : <UserPlus size={13} />}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                        No team members match "{quickAssignSearch}"
                      </div>
                    )}
                  </div>

                  {/* Footer note */}
                  <div className="p-2.5 bg-[var(--bg-subtle)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span className="italic text-[10.5px] text-[var(--text-muted)]">Instant assignment staged</span>
                    <button
                      type="button"
                      onClick={() => setQuickAssignOpen(false)}
                      className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              title="Close popup (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* FEEDBACK TOAST NOTIFICATION */}
        {toastNotice && (
          <div className="bg-[var(--primary)] text-white text-xs font-bold px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-2 duration-150 flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{toastNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="text-white/80 hover:text-white cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* MODAL MAIN BODY: 2 COLUMN WORKSPACE */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT MAIN AREA (8 Cols): Title, Story/Defect Linkages, Dependencies, Work Notes */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            
            {/* Title Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Task Title <span className="text-[var(--critical)]">*</span>
              </label>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be accomplished in this task?"
                rows={2}
                className="w-full text-sm font-semibold p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 text-[var(--text-primary)] transition-all resize-none shadow-2xs leading-relaxed"
                autoFocus
              />
            </div>

            {/* Blocked / Overdue Alert Banners */}
            {isBlocked && status !== 'complete' && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-600 dark:text-red-300 animate-in fade-in duration-200">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">This task is currently BLOCKED by {blockingTasks.length} incomplete prerequisite(s)</div>
                  <div className="text-[11.5px] mt-0.5 opacity-90">
                    Prerequisites: {blockingTasks.map(t => t.title).join(', ')}
                  </div>
                </div>
              </div>
            )}

            {isOverdue && (
              <div className="p-3 rounded-xl bg-[var(--critical-bg)] border border-[var(--critical-border)] flex items-center gap-2.5 text-[var(--critical)] text-xs font-bold">
                <AlertCircle size={16} className="flex-shrink-0 animate-pulse" />
                <span>Overdue Alert: Target completion date ({dueDate}) has passed.</span>
              </div>
            )}

            {/* TRACEABILITY & LINKED WORK ITEMS */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 flex flex-col gap-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                <Layers size={15} className="text-[var(--primary)]" />
                <span>Work Item Traceability & Linkage</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Linked User Story */}
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                    <BookOpen size={13} className="text-[var(--primary)]" />
                    <span>Parent User Story</span>
                  </label>
                  <SearchableSelect
                    options={storyOptions}
                    value={userStoryId}
                    onChange={setUserStoryId}
                    placeholder="Link to User Story..."
                    searchPlaceholder="Search stories..."
                    allowClear={true}
                    size="sm"
                  />
                </div>

                {/* Linked Defect */}
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                    <ShieldAlert size={13} className="text-[var(--critical)]" />
                    <span>Parent Defect / Bug</span>
                  </label>
                  <SearchableSelect
                    options={defectOptions}
                    value={defectId}
                    onChange={setDefectId}
                    placeholder="Link to Defect..."
                    searchPlaceholder="Search defects..."
                    allowClear={true}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* PREREQUISITES & DEPENDENCIES SECTION */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={15} className={isBlocked ? 'text-red-500' : 'text-[var(--primary)]'} />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Prerequisites & Blocking Dependencies ({completedPrerequisites}/{totalPrerequisites} Completed)
                  </span>
                </div>
                {totalPrerequisites > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isBlocked 
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400' 
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {isBlocked ? 'Blocked' : 'All Clear'}
                  </span>
                )}
              </div>

              {/* Existing Prerequisites List */}
              {allPrerequisiteTasks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {allPrerequisiteTasks.map(prereq => (
                    <div 
                      key={prereq.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                        prereq.status === 'complete'
                          ? 'bg-emerald-50/20 border-emerald-500/30 text-[var(--text-primary)]'
                          : 'bg-red-50/20 border-red-500/30 text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                          prereq.status === 'complete'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}>
                          {prereq.status === 'complete' ? '✓' : '!'}
                        </span>
                        <span className={`font-medium truncate max-w-[280px] sm:max-w-md ${
                          prereq.status === 'complete' ? 'line-through opacity-70' : ''
                        }`}>
                          {prereq.title}
                        </span>
                        <span className="text-[10px] font-mono-token text-[var(--text-muted)]">
                          {prereq.status}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removePrerequisite(prereq.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                        title="Remove dependency"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] italic">
                  No prerequisite tasks attached. This task is ready to start anytime.
                </p>
              )}

              {/* Add Prerequisite Search & Add */}
              <div className="pt-2 border-t border-[var(--border)]">
                <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1.5 block">
                  Add Prerequisite Task
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Type task title to filter candidate dependencies..."
                      value={dependencySearch}
                      onChange={(e) => setDependencySearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {dependencySearch.trim() && (
                  <div className="mt-2 max-h-36 overflow-y-auto border border-[var(--border)] rounded-lg bg-[var(--surface)] divide-y divide-[var(--border)]">
                    {candidatePrerequisites.length > 0 ? (
                      candidatePrerequisites.slice(0, 5).map(cand => (
                        <div 
                          key={cand.id}
                          onClick={() => {
                            addPrerequisite(cand.id);
                            setDependencySearch('');
                          }}
                          className="p-2 text-xs flex items-center justify-between hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                        >
                          <span className="font-medium truncate mr-2">{cand.title}</span>
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] font-bold flex-shrink-0">
                            + Add Prereq
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                        No matching prerequisite tasks available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* WORK NOTES & DISCUSSION LOG */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-[var(--primary)]" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Work Notes & Discussion ({commentsList.length})
                  </span>
                </div>
              </div>

              {/* Comment History */}
              <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
                {commentsList.length > 0 ? (
                  commentsList.map(c => (
                    <div key={c.id} className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-xs flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[var(--text-primary)]">{c.author}</span>
                        <span className="text-[var(--text-muted)] font-mono-token">{c.createdAt}</span>
                      </div>
                      <div className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {cleanAdoHtml(c.text)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">No comments or activity logged yet.</p>
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add a progress note, blocker update, or handover note..."
                  className="flex-1 text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-3 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
                >
                  <Send size={12} />
                  <span>Post</span>
                </button>
              </form>
            </div>

          </div>

          {/* RIGHT METADATA SIDEBAR (4 Cols): Status, Priority, Timing, Assignees, Squads, ADO info */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* Status Control */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2 shadow-2xs">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Execution Status
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatus('pending')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    status === 'pending'
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--primary)] ring-1 ring-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Clock4 size={14} className="text-[var(--text-secondary)]" />
                  <span>Pending</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('partial')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    status === 'partial'
                      ? 'bg-[var(--medium-bg)] text-[var(--medium)] border-[var(--medium)] ring-1 ring-[var(--medium)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Minus size={14} className="text-[var(--medium)]" />
                  <span>In Progress</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('complete')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    status === 'complete'
                      ? 'bg-emerald-500 text-white border-emerald-600 ring-1 ring-emerald-600'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <CheckCircle2 size={14} className={status === 'complete' ? 'text-white' : 'text-emerald-500'} />
                  <span>Complete</span>
                </button>
              </div>
            </div>

            {/* Priority Control */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2 shadow-2xs">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('critical')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    priority === 'critical'
                      ? 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical)] ring-1 ring-[var(--critical)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <ShieldAlert size={14} className="text-[var(--critical)]" />
                  <span>Critical</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('high')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    priority === 'high'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/40 ring-1 ring-orange-500/40'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <ArrowUp size={14} className="text-orange-500" />
                  <span>High</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('medium')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    priority === 'medium'
                      ? 'bg-[var(--medium-bg)] text-[var(--medium)] border-[var(--medium)] ring-1 ring-[var(--medium)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Minus size={14} className="text-[var(--medium)]" />
                  <span>Medium</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('low')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    priority === 'low'
                      ? 'bg-[var(--low-bg)] text-[var(--low)] border-[var(--low)] ring-1 ring-[var(--low)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <ArrowDown size={14} className="text-[var(--low)]" />
                  <span>Low</span>
                </button>
              </div>
            </div>

            {/* Target Board Date & Time Block */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3 shadow-2xs">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                <span>Scheduling</span>
                <Clock size={13} />
              </label>

              {/* Target Board Date */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 block">
                  Board Date (Sprint Day)
                </label>
                <div className="flex gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => setDateStr(currentDateStr)}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      dateStr === currentDateStr
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateStr(shiftDate(currentDateStr, 1))}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      dateStr === shiftDate(currentDateStr, 1)
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                    }`}
                  >
                    Tomorrow
                  </button>
                </div>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)]"
                />
              </div>

              {/* Time Block */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 block">
                  Time Block
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)]"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['09:00', '11:30', '14:00', '16:30'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className="px-2 py-0.5 text-[10px] rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-mono-token cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                  {time && (
                    <button
                      type="button"
                      onClick={() => setTime('')}
                      className="px-1.5 py-0.5 text-[10px] rounded text-[var(--critical)] hover:bg-[var(--critical-bg)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div className="pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1">
                    <Calendar size={12} className="text-[var(--primary)]" />
                    <span>Hard Due Date</span>
                  </label>
                  {isOverdue && (
                    <span className="text-[10px] font-bold text-[var(--critical)] animate-pulse">Overdue</span>
                  )}
                  {isDueToday && (
                    <span className="text-[10px] font-bold text-amber-500">Due Today</span>
                  )}
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`w-full text-xs px-2.5 py-1.5 bg-[var(--bg-subtle)] border rounded-lg outline-none text-[var(--text-primary)] ${
                    isOverdue ? 'border-[var(--critical)] bg-[var(--critical-bg)]/20' : 'border-[var(--border)]'
                  }`}
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDueDate(currentDateStr)}
                    className="px-2 py-0.5 text-[10px] rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate(shiftDate(currentDateStr, 1))}
                    className="px-2 py-0.5 text-[10px] rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate(shiftDate(currentDateStr, 3))}
                    className="px-2 py-0.5 text-[10px] rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] cursor-pointer"
                  >
                    +3 Days
                  </button>
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => setDueDate('')}
                      className="px-1.5 py-0.5 text-[10px] rounded text-[var(--critical)] hover:bg-[var(--critical-bg)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Assignees Selection */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Users size={13} className="text-[var(--primary)]" />
                  <span>Assigned Engineers</span>
                  {assigneeIds.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold">
                      {assigneeIds.length}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setQuickAssignOpen(prev => !prev)}
                  className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  title="Open Quick Assign menu"
                >
                  <UserPlus size={12} />
                  <span>Quick Assign</span>
                </button>
              </div>

              <MultiSearchableSelect
                options={assigneeOptions}
                values={assigneeIds}
                onChange={setAssigneeIds}
                placeholder="Assign team members..."
                searchPlaceholder="Search engineers..."
                size="sm"
                maxDisplayTags={3}
              />

              {/* Quick Member Shortcut Chips */}
              {team.length > 0 && (
                <div className="pt-1 flex flex-col gap-1.5">
                  <div className="text-[10.5px] font-semibold text-[var(--text-muted)] flex items-center justify-between">
                    <span>Quick Select:</span>
                    {assigneeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleQuickUnassignAll}
                        className="text-[10.5px] text-[var(--critical)] hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {team.slice(0, 6).map(member => {
                      const isAssigned = assigneeIds.includes(member.id);
                      const avatarColor = member.avatarColor || getAvatarColorForName(member.name);
                      const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleQuickToggleAssignee(member.id)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                            isAssigned
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-bold'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: isAssigned ? '#ffffff30' : avatarColor }}
                          >
                            {initials}
                          </span>
                          <span className="truncate max-w-[90px]">{member.name.split(' ')[0]}</span>
                          {isAssigned ? <Check size={11} className="ml-0.5" /> : <Plus size={11} className="ml-0.5 opacity-60" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Squads / Groups */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2.5 shadow-2xs">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                <span>Team Squads & Tags</span>
                <Tag size={13} />
              </label>
              <MultiSearchableSelect
                options={groupOptions}
                values={groupIds}
                onChange={setGroupIds}
                placeholder="Tag squads..."
                searchPlaceholder="Search squads..."
                size="sm"
                icon={<Tag size={13} />}
              />
            </div>

            {/* Release Selector */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2 shadow-2xs">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Release Milestone
              </label>
              <SearchableSelect
                options={releaseOptions}
                value={releaseId}
                onChange={setReleaseId}
                placeholder="Assign to release..."
                searchPlaceholder="Search releases..."
                allowClear={true}
                size="sm"
              />
            </div>

            {/* ADO Metadata Card (if applicable) */}
            {task.adoId && (
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/50 text-[11px] flex flex-col gap-1.5 text-[var(--text-secondary)]">
                <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <FolderGit2 size={13} className="text-[var(--primary)]" />
                  <span>ADO Work Item Metadata</span>
                </div>
                <div><strong>Work Item Type:</strong> {task.adoWorkItemType || 'Task'}</div>
                {task.areaPath && <div><strong>Area:</strong> <span className="font-mono-token">{task.areaPath}</span></div>}
                {task.iterationPath && <div><strong>Iteration:</strong> <span className="font-mono-token">{task.iterationPath}</span></div>}
              </div>
            )}

          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <div className="flex items-center gap-2">
            {onDeleteTask && (
              confirmDelete ? (
                <div className="flex items-center gap-2 animate-in fade-in duration-150">
                  <span className="text-xs text-[var(--critical)] font-bold">Delete this task permanently?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 bg-[var(--critical)] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[var(--critical-hover)]"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-2.5 py-1.5 text-xs text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Task</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline text-[11px] text-[var(--text-muted)]">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border)] font-mono text-[10px]">Ctrl+Enter</kbd> to save
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
