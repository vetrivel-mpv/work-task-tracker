import React, { useState, useMemo } from 'react';
import { 
  JiraIssue, 
  JiraIssueStatus, 
  JiraIssueType, 
  JiraSprint, 
  JiraProject, 
  TeamMember, 
  Priority 
} from '../../types';
import { 
  Search, 
  Plus, 
  Filter, 
  Bookmark, 
  Bug, 
  CheckSquare, 
  User, 
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  MessageSquare,
  AlertTriangle,
  MoveRight,
  CheckCircle2
} from 'lucide-react';
import { JiraIssueDetailDrawer } from './JiraIssueDetailDrawer';
import { graphqlService } from '../../services/graphqlService';

interface JiraBoardViewProps {
  issues: JiraIssue[];
  sprints: JiraSprint[];
  projects: JiraProject[];
  team: TeamMember[];
  selectedSprintId?: string | null;
  onUpdateIssue: (issue: JiraIssue) => void;
  onAddIssue: (issue: Partial<JiraIssue>) => void;
  onDeleteIssue?: (issueId: string) => void;
  onSelectSprint?: (sprintId: string | null) => void;
}

interface BoardSwimlane {
  key: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  badgeBg?: string;
  issues: JiraIssue[];
  points?: number;
}

const BOARD_COLUMNS: { id: JiraIssueStatus; title: string; color: string }[] = [
  { id: 'To Do', title: 'TO DO', color: 'border-slate-500/30' },
  { id: 'In Progress', title: 'IN PROGRESS', color: 'border-blue-500/30' },
  { id: 'Code Review', title: 'CODE REVIEW', color: 'border-indigo-500/30' },
  { id: 'QA Ready', title: 'QA READY', color: 'border-amber-500/30' },
  { id: 'QA In Progress', title: 'QA IN PROGRESS', color: 'border-purple-500/30' },
  { id: 'QA Passed', title: 'QA PASSED', color: 'border-emerald-500/30' },
  { id: 'Done', title: 'DONE', color: 'border-emerald-500/40' },
  { id: 'Blocked', title: 'BLOCKED', color: 'border-rose-500/40' }
];

export const JiraBoardView: React.FC<JiraBoardViewProps> = ({
  issues,
  sprints,
  projects,
  team,
  selectedSprintId,
  onUpdateIssue,
  onAddIssue,
  onDeleteIssue,
  onSelectSprint
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [onlyMyIssues, setOnlyMyIssues] = useState(false);
  
  // Swimlane / Grouping Mode: default to 'type' (Stories / Tasks / Bugs)
  const [swimlaneMode, setSwimlaneMode] = useState<'type' | 'none' | 'assignee' | 'priority'>('type');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());

  // Selected issue for detail drawer
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);

  // Quick inline add issue form
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [quickSummary, setQuickSummary] = useState('');
  const [quickType, setQuickType] = useState<JiraIssueType>('Story');

  const activeSprint = useMemo(() => {
    if (selectedSprintId) {
      return sprints.find(s => s.id === selectedSprintId) || sprints[0];
    }
    return sprints.find(s => s.state === 'active') || sprints[0];
  }, [sprints, selectedSprintId]);

  const toggleSwimlaneCollapse = (key: string) => {
    setCollapsedSwimlanes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filter issues for the active board
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Sprint filter (if sprints exist)
      if (activeSprint && issue.sprintId && issue.sprintId !== activeSprint.id) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = issue.issueKey.toLowerCase().includes(q);
        const matchSummary = issue.summary.toLowerCase().includes(q);
        const matchAdo = issue.adoId ? String(issue.adoId).includes(q) : false;
        if (!matchKey && !matchSummary && !matchAdo) return false;
      }

      // Type filter
      if (filterType !== 'all' && issue.issueType !== filterType) {
        return false;
      }

      // Priority filter
      if (filterPriority !== 'all' && issue.priority !== filterPriority) {
        return false;
      }

      // Assignee filter
      if (filterAssignee !== 'all' && issue.assigneeId !== filterAssignee) {
        return false;
      }

      return true;
    });
  }, [issues, activeSprint, searchQuery, filterType, filterPriority, filterAssignee]);

  // Grouping / Swimlane Definitions
  const swimlanes: BoardSwimlane[] = useMemo(() => {
    if (swimlaneMode === 'none') {
      return [
        {
          key: 'all',
          title: 'All Active Issues',
          icon: Layers,
          color: 'text-[#0052CC]',
          issues: filteredIssues
        }
      ];
    }

    if (swimlaneMode === 'type') {
      const stories = filteredIssues.filter(i => i.issueType === 'Story');
      const tasks = filteredIssues.filter(i => i.issueType === 'Task' || i.issueType === 'Subtask');
      const bugs = filteredIssues.filter(i => i.issueType === 'Bug');
      const epics = filteredIssues.filter(i => i.issueType === 'Epic');

      const groups = [];
      if (stories.length > 0 || filterType === 'all' || filterType === 'Story') {
        groups.push({
          key: 'Story',
          title: 'User Stories',
          subtitle: 'Functional Requirements & Features',
          icon: Bookmark,
          color: 'text-emerald-600',
          badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          issues: stories,
          points: stories.reduce((acc, s) => acc + (s.storyPoints || 0), 0)
        });
      }

      if (tasks.length > 0 || filterType === 'all' || filterType === 'Task') {
        groups.push({
          key: 'Task',
          title: 'Tasks & Subtasks',
          subtitle: 'Technical Tasks & Verification Work',
          icon: CheckSquare,
          color: 'text-blue-600',
          badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          issues: tasks,
          points: tasks.reduce((acc, s) => acc + (s.storyPoints || 0), 0)
        });
      }

      if (bugs.length > 0 || filterType === 'all' || filterType === 'Bug') {
        groups.push({
          key: 'Bug',
          title: 'Bugs & Defects',
          subtitle: 'Defects & Quality Failures',
          icon: Bug,
          color: 'text-rose-600',
          badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          issues: bugs,
          points: bugs.reduce((acc, s) => acc + (s.storyPoints || 0), 0)
        });
      }

      if (epics.length > 0 || filterType === 'Epic') {
        groups.push({
          key: 'Epic',
          title: 'Epics',
          subtitle: 'Large Initiatives',
          icon: Bookmark,
          color: 'text-purple-600',
          badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          issues: epics,
          points: epics.reduce((acc, s) => acc + (s.storyPoints || 0), 0)
        });
      }

      return groups;
    }

    if (swimlaneMode === 'assignee') {
      const groups = team.map(member => ({
        key: member.id,
        title: member.name,
        subtitle: member.role,
        icon: User,
        color: 'text-indigo-600',
        badgeBg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        issues: filteredIssues.filter(i => i.assigneeId === member.id),
        points: filteredIssues.filter(i => i.assigneeId === member.id).reduce((acc, s) => acc + (s.storyPoints || 0), 0)
      }));

      const unassigned = filteredIssues.filter(i => !i.assigneeId);
      if (unassigned.length > 0) {
        groups.push({
          key: 'unassigned',
          title: 'Unassigned',
          subtitle: 'Requires Owner Assignment',
          icon: User,
          color: 'text-slate-500',
          badgeBg: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
          issues: unassigned,
          points: unassigned.reduce((acc, s) => acc + (s.storyPoints || 0), 0)
        });
      }

      return groups;
    }

    // Priority swimlanes
    const priorities: Priority[] = ['critical', 'high', 'medium', 'low'];
    return priorities.map(p => ({
      key: p,
      title: `${p.toUpperCase()} Priority`,
      subtitle: `${p} severity deliverables`,
      icon: AlertTriangle,
      color: p === 'critical' ? 'text-rose-600' : p === 'high' ? 'text-amber-600' : 'text-blue-600',
      badgeBg: p === 'critical' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      issues: filteredIssues.filter(i => i.priority === p),
      points: filteredIssues.filter(i => i.priority === p).reduce((acc, s) => acc + (s.storyPoints || 0), 0)
    }));
  }, [swimlaneMode, filteredIssues, team, filterType]);

  // Issue Quick Create Handler
  const handleQuickCreate = (status: JiraIssueStatus, defaultType: JiraIssueType = 'Story') => {
    if (!quickSummary.trim()) return;

    const currentProject = projects[0] || { id: 'proj-acm', key: 'ACM' };
    const issueNum = Math.floor(100 + Math.random() * 900);

    const newIssue: Partial<JiraIssue> = {
      id: `issue-${Date.now()}`,
      issueKey: `${currentProject.key}-${issueNum}`,
      projectId: currentProject.id,
      sprintId: activeSprint ? activeSprint.id : null,
      issueType: quickType || defaultType,
      summary: quickSummary.trim(),
      status,
      priority: 'medium',
      storyPoints: quickType === 'Story' ? 3 : quickType === 'Bug' ? 2 : 1,
      originalEstimateHours: 8,
      timeSpentHours: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddIssue(newIssue);
    graphqlService.createIssue(newIssue).catch(() => {});

    setQuickSummary('');
    setAddingInColumn(null);
  };

  const getTypeIcon = (type: JiraIssueType) => {
    switch (type) {
      case 'Epic':
        return <Bookmark size={14} className="text-purple-600 shrink-0" />;
      case 'Bug':
        return <Bug size={14} className="text-rose-600 shrink-0" />;
      case 'Story':
        return <Bookmark size={14} className="text-emerald-600 shrink-0" />;
      case 'Subtask':
        return <CheckSquare size={14} className="text-sky-600 shrink-0" />;
      case 'Task':
      default:
        return <CheckSquare size={14} className="text-blue-600 shrink-0" />;
    }
  };

  const getPriorityBadge = (p?: Priority) => {
    switch (p) {
      case 'critical':
        return 'text-rose-600 bg-rose-500/10 border-rose-500/20';
      case 'high':
        return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
      case 'medium':
        return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
      case 'low':
      default:
        return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 select-none font-sans">
      {/* Board Header & Controls Ribbon */}
      <div className="flex flex-col gap-3.5 pb-2 border-b border-[var(--border)]">
        {/* Top title & Sprint switcher */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Layers size={20} className="text-[var(--primary)]" />
              <span>Active Sprint Board</span>
            </h1>

            {/* Sprint Switcher Dropdown */}
            <div className="relative">
              <select
                value={activeSprint ? activeSprint.id : ''}
                onChange={e => onSelectSprint && onSelectSprint(e.target.value)}
                className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] shadow-2xs cursor-pointer"
              >
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state === 'active' ? '🟢 Active' : s.state === 'future' ? '📅 Upcoming' : '✅ Closed'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sprint Goal / Info Banner */}
          {activeSprint && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)]">
              <Clock size={13} className="text-[var(--primary)]" />
              <span className="font-semibold">{activeSprint.goal || 'Sprint deliverables and test verification'}</span>
            </div>
          )}
        </div>

        {/* Filters & Swimlane Grouping Ribbon */}
        <div className="flex items-center justify-between flex-wrap gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by key, summary, ADO ID..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] shadow-2xs"
              />
            </div>
          </div>

          {/* Group By (Swimlanes) & Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Group By Selector */}
            <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1">
              <SlidersHorizontal size={13} className="text-[var(--primary)]" />
              <span className="font-bold text-[11px] text-[var(--text-muted)] uppercase">Group By:</span>
              <select
                value={swimlaneMode}
                onChange={e => setSwimlaneMode(e.target.value as any)}
                className="bg-transparent font-bold text-xs text-[var(--text-primary)] outline-none cursor-pointer"
              >
                <option value="type">User Stories, Tasks, Bugs</option>
                <option value="none">None (Flat Board)</option>
                <option value="assignee">Assignee</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-semibold outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="Story">Stories Only</option>
              <option value="Bug">Bugs Only</option>
              <option value="Task">Tasks Only</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-semibold outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-semibold outline-none cursor-pointer max-w-[140px]"
            >
              <option value="all">All Assignees</option>
              {team.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Swimlanes & Kanban Grid */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
        {swimlanes.map(lane => {
          const isCollapsed = collapsedSwimlanes.has(lane.key);
          const LaneIcon = lane.icon || Layers;

          return (
            <div 
              key={lane.key}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 shadow-xs flex flex-col gap-3"
            >
              {/* Swimlane Header (User Stories / Tasks / Bugs / Epics) */}
              {swimlaneMode !== 'none' && (
                <div 
                  onClick={() => toggleSwimlaneCollapse(lane.key)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[var(--surface-hover)] transition-all cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <LaneIcon size={16} className={lane.color} />
                    <span className="font-extrabold text-sm text-[var(--text-primary)]">
                      {lane.title}
                    </span>
                    {lane.subtitle && (
                      <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                        &bull; {lane.subtitle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${lane.badgeBg || 'bg-[var(--surface-hover)]'}`}>
                      {lane.issues.length} {lane.issues.length === 1 ? 'issue' : 'issues'}
                    </span>
                    {lane.points !== undefined && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                        {lane.points} pts
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Kanban Column Grid for this Swimlane */}
              {!isCollapsed && (
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-3 min-w-[1440px] items-start">
                    {BOARD_COLUMNS.map(col => {
                      const colIssues = lane.issues.filter(i => i.status === col.id);
                      const isAddingHere = addingInColumn === `${lane.key}-${col.id}`;

                      return (
                        <div
                          key={col.id}
                          className="w-68 bg-[var(--surface-hover)]/40 border border-[var(--border)] rounded-xl flex flex-col shrink-0 overflow-hidden shadow-2xs"
                        >
                          {/* Column Header */}
                          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-bold tracking-wider text-[var(--text-secondary)] uppercase">
                                {col.title}
                              </span>
                              <span className="w-4.5 h-4.5 rounded-full bg-[var(--surface-hover)] text-[10px] font-mono font-bold flex items-center justify-center text-[var(--text-muted)] border border-[var(--border)]">
                                {colIssues.length}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setAddingInColumn(`${lane.key}-${col.id}`);
                                setQuickType(lane.key === 'Bug' ? 'Bug' : lane.key === 'Task' ? 'Task' : 'Story');
                              }}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer"
                              title={`Create ${lane.key === 'Bug' ? 'Bug' : lane.key === 'Task' ? 'Task' : 'Story'} in ${col.title}`}
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          {/* Cards List in this Column */}
                          <div className="p-2 overflow-y-auto flex flex-col gap-2 min-h-[100px] max-h-[480px]">
                            {/* Inline Quick Add Form */}
                            {isAddingHere && (
                              <div className="p-2.5 bg-[var(--surface)] border border-[var(--primary)]/40 rounded-xl shadow-xs flex flex-col gap-2 animate-fadeIn">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10.5px] font-bold text-[var(--primary)]">
                                    New {quickType}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAddingInColumn(null)}
                                    className="text-[10px] text-[var(--text-muted)] hover:underline cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>

                                <textarea
                                  value={quickSummary}
                                  onChange={e => setQuickSummary(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleQuickCreate(col.id, lane.key === 'Bug' ? 'Bug' : lane.key === 'Task' ? 'Task' : 'Story');
                                    }
                                  }}
                                  placeholder="Issue summary (Enter to add)..."
                                  rows={2}
                                  className="w-full text-xs p-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                                  autoFocus
                                />

                                <button
                                  type="button"
                                  onClick={() => handleQuickCreate(col.id, lane.key === 'Bug' ? 'Bug' : lane.key === 'Task' ? 'Task' : 'Story')}
                                  disabled={!quickSummary.trim()}
                                  className="w-full py-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded-lg shadow-2xs cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            )}

                            {/* Column Issues List */}
                            {colIssues.length > 0 ? (
                              colIssues.map(issue => {
                                const assignee = team.find(m => m.id === issue.assigneeId);

                                return (
                                  <div
                                    key={issue.id}
                                    onClick={() => setSelectedIssue(issue)}
                                    className="p-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 rounded-xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col gap-1.5 group"
                                  >
                                    {/* Key & Priority */}
                                    <div className="flex items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {getTypeIcon(issue.issueType)}
                                        <span className="font-mono text-[10.5px] font-bold text-[var(--primary)] group-hover:underline truncate">
                                          {issue.issueKey}
                                        </span>
                                      </div>

                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getPriorityBadge(issue.priority)}`}>
                                        {issue.priority}
                                      </span>
                                    </div>

                                    {/* Summary */}
                                    <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                                      {issue.summary}
                                    </p>

                                    {/* Footer: Story Points, Comments count, Assignee */}
                                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-[var(--border)]/60 text-[10px]">
                                      <div className="flex items-center gap-1.5">
                                        {issue.storyPoints !== undefined && (
                                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                            {issue.storyPoints} pts
                                          </span>
                                        )}

                                        {(issue.comments || []).length > 0 && (
                                          <span className="flex items-center gap-0.5 text-[var(--text-muted)] font-mono">
                                            <MessageSquare size={10} />
                                            {(issue.comments || []).length}
                                          </span>
                                        )}
                                      </div>

                                      {/* Assignee Avatar */}
                                      {assignee ? (
                                        <div 
                                          className="w-5 h-5 rounded-full text-white font-bold text-[9px] flex items-center justify-center shadow-2xs"
                                          style={{ backgroundColor: assignee.avatarColor || '#0052CC' }}
                                          title={`Assigned to ${assignee.name}`}
                                        >
                                          {assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-[var(--text-muted)] font-medium">Unassigned</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              !isAddingHere && (
                                <div className="h-16 flex items-center justify-center text-[10px] text-[var(--text-muted)] italic">
                                  No issues
                                </div>
                              )
                            )}
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

      {/* Slide-out Issue Detail Drawer */}
      <JiraIssueDetailDrawer
        issue={selectedIssue}
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        team={team}
        onUpdateIssue={updated => {
          onUpdateIssue(updated);
          setSelectedIssue(updated);
        }}
        onDeleteIssue={onDeleteIssue}
      />
    </div>
  );
};
