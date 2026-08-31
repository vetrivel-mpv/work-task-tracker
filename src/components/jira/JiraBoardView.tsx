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
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  MessageSquare,
  AlertTriangle,
  MoveRight
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
  const [swimlaneMode, setSwimlaneMode] = useState<'none' | 'assignee' | 'type'>('none');

  // Selected issue for detail drawer
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);

  // Quick inline add issue form
  const [addingInColumn, setAddingInColumn] = useState<JiraIssueStatus | null>(null);
  const [quickSummary, setQuickSummary] = useState('');
  const [quickType, setQuickType] = useState<JiraIssueType>('Story');

  const activeSprint = useMemo(() => {
    if (selectedSprintId) {
      return sprints.find(s => s.id === selectedSprintId) || sprints[0];
    }
    return sprints.find(s => s.state === 'active') || sprints[0];
  }, [sprints, selectedSprintId]);

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
        const matchDesc = (issue.description || '').toLowerCase().includes(q);
        const matchAdo = issue.adoId ? String(issue.adoId).includes(q) : false;
        if (!matchKey && !matchSummary && !matchDesc && !matchAdo) return false;
      }

      // Type filter
      if (filterType !== 'all' && issue.issueType !== filterType) return false;

      // Priority filter
      if (filterPriority !== 'all' && issue.priority !== filterPriority) return false;

      // Assignee filter
      if (filterAssignee !== 'all' && issue.assigneeId !== filterAssignee) return false;

      // Only my issues
      if (onlyMyIssues && team[0] && issue.assigneeId !== team[0].id) return false;

      return true;
    });
  }, [issues, activeSprint, searchQuery, filterType, filterPriority, filterAssignee, onlyMyIssues, team]);

  const handleQuickCreate = (status: JiraIssueStatus) => {
    if (!quickSummary.trim()) return;

    const currentProject = projects[0] || { id: 'proj-acm', key: 'ACM' };
    const issueNum = Math.floor(100 + Math.random() * 900);
    const newIssue: Partial<JiraIssue> = {
      id: `issue-${Date.now()}`,
      issueKey: `${currentProject.key}-${issueNum}`,
      projectId: currentProject.id,
      sprintId: activeSprint?.id,
      issueType: quickType,
      summary: quickSummary.trim(),
      status: status,
      priority: 'medium',
      storyPoints: quickType === 'Story' ? 3 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddIssue(newIssue);
    graphqlService.createIssue(newIssue).catch(() => {});

    setQuickSummary('');
    setAddingInColumn(null);
  };

  const handleStatusTransition = (issue: JiraIssue, newStatus: JiraIssueStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: JiraIssue = {
      ...issue,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    onUpdateIssue(updated);
    graphqlService.updateIssueStatus(issue.id, newStatus).catch(() => {});
  };

  const getTypeIcon = (type: JiraIssueType) => {
    switch (type) {
      case 'Epic':
        return <Bookmark size={13} className="text-purple-500 shrink-0" />;
      case 'Bug':
        return <Bug size={13} className="text-rose-500 shrink-0" />;
      case 'Story':
        return <Bookmark size={13} className="text-emerald-500 shrink-0" />;
      case 'Subtask':
        return <CheckSquare size={13} className="text-sky-500 shrink-0" />;
      case 'Task':
      default:
        return <CheckSquare size={13} className="text-blue-500 shrink-0" />;
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'high':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'medium':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'low':
      default:
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fadeIn">
      {/* Board Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="text-[var(--primary)]" size={20} />
            <h1 className="text-base font-bold text-[var(--text-primary)]">
              {activeSprint?.name || 'Active Scrum & Kanban Board'}
            </h1>
          </div>

          {activeSprint && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
              <span>Sprint Active</span>
              {activeSprint.endDate && <span>&bull; Ends {activeSprint.endDate}</span>}
            </div>
          )}

          {/* Sprints Switcher */}
          {sprints.length > 1 && (
            <select
              value={activeSprint?.id || ''}
              onChange={e => onSelectSprint && onSelectSprint(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.state})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Board Right Stats & Swimlane Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
            <span className="font-bold text-[var(--text-primary)]">{filteredIssues.length}</span> issues &bull;{' '}
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {filteredIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0)}
            </span>{' '}
            pts
          </div>

          <select
            value={swimlaneMode}
            onChange={e => setSwimlaneMode(e.target.value as any)}
            className="text-xs font-semibold px-2.5 py-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] outline-none cursor-pointer"
          >
            <option value="none">Swimlanes: None</option>
            <option value="assignee">Swimlanes: By Assignee</option>
            <option value="type">Swimlanes: By Issue Type</option>
          </select>
        </div>
      </div>

      {/* JQL & Quick Filters Strip */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap bg-[var(--surface-hover)]/60 p-2.5 rounded-xl border border-[var(--border)] text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by key, summary, ADO ID (JQL search)..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOnlyMyIssues(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer border ${
              onlyMyIssues
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Only My Issues
          </button>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-semibold outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="Story">Stories</option>
            <option value="Bug">Bugs</option>
            <option value="Task">Tasks</option>
            <option value="Epic">Epics</option>
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
            className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-semibold outline-none cursor-pointer max-w-[150px]"
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

      {/* Interactive Kanban Board Grid */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-[1400px] h-full items-start">
          {BOARD_COLUMNS.map(col => {
            const colIssues = filteredIssues.filter(i => i.status === col.id);
            const isAddingHere = addingInColumn === col.id;

            return (
              <div
                key={col.id}
                className="w-72 bg-[var(--surface-hover)]/40 border border-[var(--border)] rounded-2xl flex flex-col max-h-full shrink-0 overflow-hidden shadow-xs"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[var(--text-secondary)] uppercase">
                      {col.title}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-[var(--surface-hover)] text-[10.5px] font-mono font-bold flex items-center justify-center text-[var(--text-muted)] border border-[var(--border)]">
                      {colIssues.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAddingInColumn(col.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer"
                    title={`Create new issue in ${col.title}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Column Card List */}
                <div className="flex-1 p-2.5 overflow-y-auto flex flex-col gap-2.5 min-h-[150px]">
                  {/* Inline Quick Add Form */}
                  {isAddingHere && (
                    <div className="p-3 bg-[var(--surface)] border border-[var(--primary)]/40 rounded-xl shadow-xs flex flex-col gap-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <select
                          value={quickType}
                          onChange={e => setQuickType(e.target.value as JiraIssueType)}
                          className="text-[11px] font-bold px-2 py-0.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                        >
                          <option value="Story">Story</option>
                          <option value="Bug">Bug</option>
                          <option value="Task">Task</option>
                        </select>
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
                            handleQuickCreate(col.id);
                          }
                        }}
                        placeholder="What needs to be done? (Enter to create)"
                        rows={2}
                        className="w-full text-xs p-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                        autoFocus
                      />

                      <button
                        type="button"
                        onClick={() => handleQuickCreate(col.id)}
                        disabled={!quickSummary.trim()}
                        className="w-full py-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded-lg shadow-2xs cursor-pointer"
                      >
                        Create
                      </button>
                    </div>
                  )}

                  {/* Issues list */}
                  {colIssues.length > 0 ? (
                    colIssues.map(issue => {
                      const assignee = team.find(m => m.id === issue.assigneeId);

                      return (
                        <div
                          key={issue.id}
                          onClick={() => setSelectedIssue(issue)}
                          className="p-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 rounded-xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col gap-2 group"
                        >
                          {/* Top row: Type icon, Key, Priority */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {getTypeIcon(issue.issueType)}
                              <span className="font-mono text-[10.5px] font-bold text-[var(--primary)] group-hover:underline truncate">
                                {issue.issueKey}
                              </span>
                            </div>

                            <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${getPriorityBadge(issue.priority)}`}>
                              {issue.priority}
                            </span>
                          </div>

                          {/* Summary */}
                          <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                            {issue.summary}
                          </p>

                          {/* Bottom Row: Story Points, Assignee Avatar, Comments, Transitions */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[var(--border)]/60 text-[10.5px]">
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

                            {/* Assignee & Move Quick Menu */}
                            <div className="flex items-center gap-1">
                              {assignee ? (
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-2xs"
                                  style={{ backgroundColor: assignee.avatarColor || '#4f46e5' }}
                                  title={assignee.name}
                                >
                                  {assignee.name.slice(0, 2).toUpperCase()}
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[9px] text-[var(--text-muted)]">
                                  <User size={10} />
                                </span>
                              )}

                              {/* Quick Move dropdown */}
                              <select
                                value={issue.status}
                                onClick={e => e.stopPropagation()}
                                onChange={e => handleStatusTransition(issue, e.target.value as JiraIssueStatus, e as any)}
                                className="text-[10px] font-bold bg-[var(--surface-hover)] border border-[var(--border)] rounded px-1 py-0.5 text-[var(--text-secondary)] outline-none cursor-pointer"
                                title="Change Status"
                              >
                                {BOARD_COLUMNS.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : !isAddingHere ? (
                    <div className="h-24 flex items-center justify-center border border-dashed border-[var(--border)] rounded-xl text-[11px] text-[var(--text-muted)] italic">
                      No issues
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jira Issue Detail Drawer */}
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
