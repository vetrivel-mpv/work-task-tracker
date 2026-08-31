import React, { useState, useMemo } from 'react';
import { 
  JiraIssue, 
  JiraSprint, 
  JiraProject, 
  JiraIssueType,
  TeamMember,
  Priority
} from '../../types';
import { 
  Plus, 
  Play, 
  CheckCircle2, 
  Bookmark, 
  Bug, 
  CheckSquare, 
  Calendar, 
  Search, 
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  ArrowRight,
  AlertCircle,
  SlidersHorizontal
} from 'lucide-react';
import { JiraIssueDetailDrawer } from './JiraIssueDetailDrawer';
import { graphqlService } from '../../services/graphqlService';

interface JiraBacklogViewProps {
  issues: JiraIssue[];
  sprints: JiraSprint[];
  projects: JiraProject[];
  team: TeamMember[];
  onUpdateIssue: (issue: JiraIssue) => void;
  onAddIssue: (issue: Partial<JiraIssue>) => void;
  onUpdateSprint: (sprint: JiraSprint) => void;
  onAddSprint: (sprint: Partial<JiraSprint>) => void;
}

export const JiraBacklogView: React.FC<JiraBacklogViewProps> = ({
  issues,
  sprints,
  projects,
  team,
  onUpdateIssue,
  onAddIssue,
  onUpdateSprint,
  onAddSprint
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);

  // Group By mode: 'type' (User Stories, Tasks, Bugs) vs 'none'
  const [groupByType, setGroupByType] = useState<boolean>(true);

  // New Sprint Modal / Form
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprintName, setNewSprintName] = useState(`Sprint ${(sprints.length || 0) + 1}`);
  const [newSprintGoal, setNewSprintGoal] = useState('');

  // Inline issue creation
  const [creatingInTarget, setCreatingInTarget] = useState<string | 'backlog' | null>(null);
  const [newIssueSummary, setNewIssueSummary] = useState('');
  const [newIssueType, setNewIssueType] = useState<JiraIssueType>('Story');

  // Collapse state for sprints
  const [collapsedSprints, setCollapsedSprints] = useState<Set<string>>(new Set());
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(new Set());

  const currentProject = projects[0] || { id: 'proj-acm', key: 'ACM', name: 'ACM Platform' };

  const toggleSprintCollapse = (id: string) => {
    setCollapsedSprints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubgroupCollapse = (groupId: string) => {
    setCollapsedSubgroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Group issues into sprints vs backlog
  const { sprintIssuesMap, backlogIssues } = useMemo(() => {
    const sMap = new Map<string, JiraIssue[]>();
    sprints.forEach(s => sMap.set(s.id, []));
    const backlog: JiraIssue[] = [];

    issues.forEach(issue => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = issue.issueKey.toLowerCase().includes(q);
        const matchSummary = issue.summary.toLowerCase().includes(q);
        const matchAdo = issue.adoId ? String(issue.adoId).includes(q) : false;
        if (!matchKey && !matchSummary && !matchAdo) return;
      }

      if (issue.sprintId && sMap.has(issue.sprintId)) {
        sMap.get(issue.sprintId)!.push(issue);
      } else {
        backlog.push(issue);
      }
    });

    return { sprintIssuesMap: sMap, backlogIssues: backlog };
  }, [issues, sprints, searchQuery]);

  const handleCreateSprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintName.trim()) return;

    const sprint: Partial<JiraSprint> = {
      id: `sprint-${Date.now()}`,
      projectId: currentProject.id,
      name: newSprintName.trim(),
      goal: newSprintGoal.trim() || undefined,
      state: 'future',
      sequenceNumber: (sprints.length || 0) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddSprint(sprint);
    setShowCreateSprint(false);
    setNewSprintName(`Sprint ${(sprints.length || 0) + 2}`);
    setNewSprintGoal('');
  };

  const handleStartSprint = (sprint: JiraSprint) => {
    const updated: JiraSprint = {
      ...sprint,
      state: 'active',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    };
    onUpdateSprint(updated);
  };

  const handleCompleteSprint = (sprint: JiraSprint) => {
    const updated: JiraSprint = {
      ...sprint,
      state: 'closed',
      completeDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    };
    onUpdateSprint(updated);
  };

  const handleMoveIssueToSprint = (issue: JiraIssue, targetSprintId: string | null) => {
    const updated: JiraIssue = {
      ...issue,
      sprintId: targetSprintId,
      updatedAt: new Date().toISOString()
    };
    onUpdateIssue(updated);
  };

  const handleCreateInlineIssue = (targetId: string | 'backlog') => {
    if (!newIssueSummary.trim()) return;

    const issueNum = Math.floor(100 + Math.random() * 900);
    const newIssue: Partial<JiraIssue> = {
      id: `issue-${Date.now()}`,
      issueKey: `${currentProject.key}-${issueNum}`,
      projectId: currentProject.id,
      sprintId: targetId === 'backlog' ? null : targetId,
      issueType: newIssueType,
      summary: newIssueSummary.trim(),
      status: 'To Do',
      priority: 'medium',
      storyPoints: newIssueType === 'Story' ? 3 : newIssueType === 'Bug' ? 2 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddIssue(newIssue);
    graphqlService.createIssue(newIssue).catch(() => {});

    setNewIssueSummary('');
    setCreatingInTarget(null);
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

  const renderIssueRow = (issue: JiraIssue) => {
    const assignee = team.find(m => m.id === issue.assigneeId);

    return (
      <div
        key={issue.id}
        onClick={() => setSelectedIssue(issue)}
        className="px-3.5 py-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-b border-[var(--border)] last:border-b-0 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer group"
      >
        {/* Left: Icon, Key, Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {getTypeIcon(issue.issueType)}
          <span className="font-mono font-bold text-[var(--primary)] group-hover:underline shrink-0 text-[11px]">
            {issue.issueKey}
          </span>
          <span className="font-semibold text-[var(--text-primary)] truncate">
            {issue.summary}
          </span>
          {issue.adoId && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0 hidden md:inline">
              (ADO #{issue.adoId})
            </span>
          )}
        </div>

        {/* Right: Status, Points, Assignee, Move menu */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status Tag */}
          <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
            {issue.status}
          </span>

          {/* Story Points Pill */}
          {issue.storyPoints !== undefined && (
            <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[11px] flex items-center justify-center border border-indigo-500/20">
              {issue.storyPoints}
            </span>
          )}

          {/* Assignee Avatar */}
          {assignee ? (
            <div 
              className="w-6 h-6 rounded-full text-white font-bold text-[10px] flex items-center justify-center shadow-2xs shrink-0"
              style={{ backgroundColor: assignee.avatarColor || '#0052CC' }}
              title={`Assigned to ${assignee.name}`}
            >
              {assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] italic">Unassigned</span>
          )}

          {/* Move to Sprint quick dropdown */}
          <div onClick={e => e.stopPropagation()} className="relative">
            <select
              value={issue.sprintId || 'backlog'}
              onChange={e => handleMoveIssueToSprint(issue, e.target.value === 'backlog' ? null : e.target.value)}
              className="text-[10px] font-semibold px-2 py-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded text-[var(--text-secondary)] outline-none cursor-pointer"
              title="Move issue to sprint or backlog"
            >
              <option value="backlog">Product Backlog</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render issue list either grouped by Type or flat
  const renderIssueGroupList = (containerId: string, issueList: JiraIssue[]) => {
    if (!groupByType) {
      return (
        <div className="flex flex-col">
          {issueList.length > 0 ? (
            issueList.map(issue => renderIssueRow(issue))
          ) : (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] italic">
              No issues in this iteration. Plan issues from the backlog or create a new one.
            </div>
          )}
        </div>
      );
    }

    // Group issues by Type
    const stories = issueList.filter(i => i.issueType === 'Story');
    const tasks = issueList.filter(i => i.issueType === 'Task' || i.issueType === 'Subtask');
    const bugs = issueList.filter(i => i.issueType === 'Bug');
    const epics = issueList.filter(i => i.issueType === 'Epic');

    const typeGroups = [
      { id: `${containerId}-stories`, title: 'User Stories', icon: Bookmark, color: 'text-emerald-600', badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', issues: stories },
      { id: `${containerId}-tasks`, title: 'Tasks & Subtasks', icon: CheckSquare, color: 'text-blue-600', badgeBg: 'bg-blue-500/10 text-blue-600 border-blue-500/20', issues: tasks },
      { id: `${containerId}-bugs`, title: 'Bugs & Defects', icon: Bug, color: 'text-rose-600', badgeBg: 'bg-rose-500/10 text-rose-600 border-rose-500/20', issues: bugs },
      { id: `${containerId}-epics`, title: 'Epics', icon: Bookmark, color: 'text-purple-600', badgeBg: 'bg-purple-500/10 text-purple-600 border-purple-500/20', issues: epics }
    ].filter(g => g.issues.length > 0);

    if (typeGroups.length === 0) {
      return (
        <div className="p-6 text-center text-xs text-[var(--text-muted)] italic">
          No issues in this iteration. Plan issues from the backlog or create a new one.
        </div>
      );
    }

    return (
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {typeGroups.map(group => {
          const isCollapsed = collapsedSubgroups.has(group.id);
          const GroupIcon = group.icon;
          const points = group.issues.reduce((acc, i) => acc + (i.storyPoints || 0), 0);

          return (
            <div key={group.id} className="flex flex-col">
              {/* Group Subheader */}
              <div 
                onClick={() => toggleSubgroupCollapse(group.id)}
                className="px-3.5 py-2 bg-[var(--surface-hover)]/60 hover:bg-[var(--surface-hover)] flex items-center justify-between text-xs font-bold transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <GroupIcon size={14} className={group.color} />
                  <span>{group.title}</span>
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono border ${group.badgeBg}`}>
                    {group.issues.length}
                  </span>
                </div>

                {points > 0 && (
                  <span className="text-[10.5px] font-mono text-[var(--text-muted)]">
                    {points} story points
                  </span>
                )}
              </div>

              {/* Group issues list */}
              {!isCollapsed && (
                <div className="flex flex-col">
                  {group.issues.map(issue => renderIssueRow(issue))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-5 animate-fadeIn select-none font-sans">
      {/* Backlog Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3">
          <Layers className="text-[var(--primary)]" size={20} />
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)]">
              {currentProject.name} &bull; Backlog & Sprint Planning
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Plan iterations, group by User Stories, Tasks, Bugs, and estimate velocity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Group By Toggle */}
          <button
            type="button"
            onClick={() => setGroupByType(!groupByType)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              groupByType
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/30'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)]'
            }`}
            title="Group by User Stories, Tasks, Bugs"
          >
            <SlidersHorizontal size={13} />
            <span>Group by Type (Stories / Tasks / Bugs)</span>
          </button>

          {/* Search Bar */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search issues..."
              className="pl-8 pr-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] w-44"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCreateSprint(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus size={13} />
            <span>Create Sprint</span>
          </button>
        </div>
      </div>

      {/* Create Sprint Modal */}
      {showCreateSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form 
            onSubmit={handleCreateSprint}
            className="w-full max-w-md bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col gap-3.5 animate-scaleUp"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Create New Sprint</h2>
              <button type="button" onClick={() => setShowCreateSprint(false)} className="text-xs text-[var(--text-muted)] hover:underline cursor-pointer">
                Cancel
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Sprint Name</label>
              <input
                type="text"
                value={newSprintName}
                onChange={e => setNewSprintName(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Sprint Goal</label>
              <textarea
                value={newSprintGoal}
                onChange={e => setNewSprintGoal(e.target.value)}
                placeholder="What is the objective of this sprint iteration?"
                rows={2}
                className="px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateSprint(false)}
                className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-2xs cursor-pointer"
              >
                Create Sprint
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sprints List & Product Backlog */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1">
        {/* Sprint Blocks */}
        {sprints.map(sprint => {
          const sprintIssues = sprintIssuesMap.get(sprint.id) || [];
          const totalPoints = sprintIssues.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
          const isCollapsed = collapsedSprints.has(sprint.id);
          const isCreatingHere = creatingInTarget === sprint.id;

          return (
            <div
              key={sprint.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs flex flex-col"
            >
              {/* Sprint Header */}
              <div className="p-3.5 bg-[var(--surface-hover)]/80 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSprintCollapse(sprint.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {sprint.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      sprint.state === 'active'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : sprint.state === 'future'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                    }`}>
                      {sprint.state.toUpperCase()}
                    </span>
                  </div>

                  {sprint.startDate && sprint.endDate && (
                    <span className="text-[11px] text-[var(--text-muted)] hidden md:inline">
                      ({sprint.startDate} &rarr; {sprint.endDate})
                    </span>
                  )}
                </div>

                {/* Right controls: Points count & Start/Complete Sprint button */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 font-mono text-xs font-bold text-[var(--text-secondary)]">
                    <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                      {sprintIssues.length} issues
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {totalPoints} pts
                    </span>
                  </div>

                  {sprint.state === 'future' && (
                    <button
                      type="button"
                      onClick={() => handleStartSprint(sprint)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Play size={11} />
                      <span>Start Sprint</span>
                    </button>
                  )}

                  {sprint.state === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleCompleteSprint(sprint)}
                      className="px-3 py-1 bg-[#0052CC] hover:bg-[#0747A6] text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} />
                      <span>Complete Sprint</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sprint Content: Grouped by Type or Flat */}
              {!isCollapsed && (
                <div className="flex flex-col">
                  {renderIssueGroupList(sprint.id, sprintIssues)}

                  {/* Inline Create Row */}
                  <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-hover)]/30">
                    {isCreatingHere ? (
                      <div className="p-3 bg-[var(--surface)] border border-[var(--primary)]/40 rounded-xl flex flex-col gap-2 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <select
                            value={newIssueType}
                            onChange={e => setNewIssueType(e.target.value as JiraIssueType)}
                            className="text-xs font-bold p-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                          >
                            <option value="Story">📖 User Story</option>
                            <option value="Bug">🐞 Bug / Defect</option>
                            <option value="Task">⚙️ Task</option>
                          </select>
                          <input
                            type="text"
                            value={newIssueSummary}
                            onChange={e => setNewIssueSummary(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCreateInlineIssue(sprint.id);
                            }}
                            placeholder="What needs to be done in this sprint? (Enter to create)"
                            className="flex-1 px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                            autoFocus
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setCreatingInTarget(null)}
                            className="px-3 py-1 text-xs text-[var(--text-muted)] hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateInlineIssue(sprint.id)}
                            disabled={!newIssueSummary.trim()}
                            className="px-4 py-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded shadow-2xs cursor-pointer"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingInTarget(sprint.id);
                          setNewIssueSummary('');
                        }}
                        className="w-full py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface)] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus size={13} />
                        <span>Create issue in {sprint.name}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Product Backlog Pool */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs flex flex-col">
          {/* Backlog Header */}
          <div className="p-3.5 bg-[var(--surface-hover)]/80 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[var(--text-primary)]">
                Backlog (Unassigned to Sprints)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                {backlogIssues.length} issues
              </span>
            </div>

            <div className="flex items-center gap-1 font-mono text-xs font-bold text-[var(--text-secondary)]">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {backlogIssues.reduce((acc, i) => acc + (i.storyPoints || 0), 0)} pts
              </span>
            </div>
          </div>

          {/* Backlog Issues List */}
          <div className="flex flex-col">
            {renderIssueGroupList('backlog', backlogIssues)}

            {/* Inline Add in Backlog */}
            <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-hover)]/30">
              {creatingInTarget === 'backlog' ? (
                <div className="p-3 bg-[var(--surface)] border border-[var(--primary)]/40 rounded-xl flex flex-col gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <select
                      value={newIssueType}
                      onChange={e => setNewIssueType(e.target.value as JiraIssueType)}
                      className="text-xs font-bold p-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                    >
                      <option value="Story">📖 User Story</option>
                      <option value="Bug">🐞 Bug / Defect</option>
                      <option value="Task">⚙️ Task</option>
                    </select>
                    <input
                      type="text"
                      value={newIssueSummary}
                      onChange={e => setNewIssueSummary(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateInlineIssue('backlog');
                      }}
                      placeholder="What needs to be done? (Enter to create)"
                      className="flex-1 px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatingInTarget(null)}
                      className="px-3 py-1 text-xs text-[var(--text-muted)] hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateInlineIssue('backlog')}
                      disabled={!newIssueSummary.trim()}
                      className="px-4 py-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded shadow-2xs cursor-pointer"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingInTarget('backlog');
                    setNewIssueSummary('');
                  }}
                  className="w-full py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface)] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus size={13} />
                  <span>Create issue in Backlog</span>
                </button>
              )}
            </div>
          </div>
        </div>
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
      />
    </div>
  );
};
