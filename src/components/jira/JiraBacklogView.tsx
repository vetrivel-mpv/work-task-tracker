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
  AlertCircle
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

  const currentProject = projects[0] || { id: 'proj-acm', key: 'ACM', name: 'ACM Platform' };

  const toggleSprintCollapse = (id: string) => {
    setCollapsedSprints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        if (!matchKey && !matchSummary) return;
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
      storyPoints: newIssueType === 'Story' ? 3 : 1,
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
        return <Bookmark size={14} className="text-purple-500 shrink-0" />;
      case 'Bug':
        return <Bug size={14} className="text-rose-500 shrink-0" />;
      case 'Story':
        return <Bookmark size={14} className="text-emerald-500 shrink-0" />;
      case 'Subtask':
        return <CheckSquare size={14} className="text-sky-500 shrink-0" />;
      case 'Task':
      default:
        return <CheckSquare size={14} className="text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full gap-5 animate-fadeIn">
      {/* Backlog Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3">
          <Layers className="text-[var(--primary)]" size={20} />
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)]">
              {currentProject.name} &bull; Backlog & Sprint Planning
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Plan iterations, estimate story points, and prioritize issue backlogs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter backlog..."
              className="pl-8 pr-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] w-48"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCreateSprint(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
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

      {/* Sprints List Section */}
      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        {sprints.map(sprint => {
          const sIssues = sprintIssuesMap.get(sprint.id) || [];
          const totalPts = sIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
          const isCollapsed = collapsedSprints.has(sprint.id);
          const isCreatingHere = creatingInTarget === sprint.id;

          return (
            <div
              key={sprint.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Sprint Header Bar */}
              <div className="p-3.5 bg-[var(--surface-hover)]/70 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSprintCollapse(sprint.id)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>

                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-bold text-xs text-[var(--text-primary)] truncate">
                      {sprint.name}
                    </span>

                    {sprint.state === 'active' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
                        Active
                      </span>
                    )}

                    {sprint.state === 'future' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                        Planned
                      </span>
                    )}

                    {sprint.state === 'closed' && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                        Completed
                      </span>
                    )}

                    {sprint.goal && (
                      <span className="text-[11px] text-[var(--text-muted)] italic truncate max-w-sm">
                        &mdash; {sprint.goal}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] font-bold">
                      {sIssues.length} issues
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                      {totalPts} pts
                    </span>
                  </div>

                  {sprint.state === 'future' && (
                    <button
                      type="button"
                      onClick={() => handleStartSprint(sprint)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg cursor-pointer transition-all"
                    >
                      <Play size={11} className="fill-current" />
                      <span>Start Sprint</span>
                    </button>
                  )}

                  {sprint.state === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleCompleteSprint(sprint)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer transition-all"
                    >
                      <CheckCircle2 size={12} />
                      <span>Complete Sprint</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sprint Issues List */}
              {!isCollapsed && (
                <div className="p-2 flex flex-col gap-1.5">
                  {sIssues.length > 0 ? (
                    sIssues.map(issue => {
                      const assignee = team.find(m => m.id === issue.assigneeId);

                      return (
                        <div
                          key={issue.id}
                          onClick={() => setSelectedIssue(issue)}
                          className="px-3 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)] rounded-xl transition-all flex items-center justify-between gap-3 text-xs cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {getTypeIcon(issue.issueType)}
                            <span className="font-mono text-[11px] font-bold text-[var(--primary)] group-hover:underline shrink-0">
                              {issue.issueKey}
                            </span>
                            <span className="font-semibold text-[var(--text-primary)] truncate">
                              {issue.summary}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                              {issue.status}
                            </span>

                            {issue.storyPoints !== undefined && (
                              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10.5px]">
                                {issue.storyPoints}
                              </span>
                            )}

                            {assignee ? (
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-2xs"
                                style={{ backgroundColor: assignee.avatarColor || '#4f46e5' }}
                                title={assignee.name}
                              >
                                {assignee.name.slice(0, 2).toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-[10.5px] text-[var(--text-muted)] italic">Unassigned</span>
                            )}

                            {/* Move to Backlog button */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleMoveIssueToSprint(issue, null);
                              }}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded transition-all cursor-pointer"
                              title="Move issue to Backlog"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-xs text-[var(--text-muted)] italic">
                      Plan this sprint by dragging or moving issues from the backlog below.
                    </div>
                  )}

                  {/* Inline Create Issue in Sprint */}
                  {isCreatingHere ? (
                    <div className="p-2.5 bg-[var(--surface-hover)] border border-[var(--primary)]/30 rounded-xl flex gap-2 animate-fadeIn">
                      <select
                        value={newIssueType}
                        onChange={e => setNewIssueType(e.target.value as JiraIssueType)}
                        className="text-xs font-bold px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none"
                      >
                        <option value="Story">Story</option>
                        <option value="Bug">Bug</option>
                        <option value="Task">Task</option>
                      </select>
                      <input
                        type="text"
                        value={newIssueSummary}
                        onChange={e => setNewIssueSummary(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreateInlineIssue(sprint.id);
                        }}
                        placeholder="What needs to be done? (Enter to create)"
                        className="flex-1 px-3 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateInlineIssue(sprint.id)}
                        disabled={!newIssueSummary.trim()}
                        className="px-3 py-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded-lg cursor-pointer"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatingInTarget(null)}
                        className="text-xs text-[var(--text-muted)] hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreatingInTarget(sprint.id)}
                      className="w-full py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer border border-dashed border-transparent hover:border-[var(--border)]"
                    >
                      <Plus size={13} />
                      <span>Create issue in {sprint.name}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Backlog Container */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs mt-2">
          <div className="p-3.5 bg-[var(--surface-hover)]/70 border-b border-[var(--border)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--text-primary)]">Backlog</span>
              <span className="px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] text-xs font-mono font-bold">
                {backlogIssues.length} issues
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold">
                {backlogIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0)} pts
              </span>
            </div>
          </div>

          <div className="p-2 flex flex-col gap-1.5">
            {backlogIssues.length > 0 ? (
              backlogIssues.map(issue => {
                const assignee = team.find(m => m.id === issue.assigneeId);

                return (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className="px-3 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)] rounded-xl transition-all flex items-center justify-between gap-3 text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {getTypeIcon(issue.issueType)}
                      <span className="font-mono text-[11px] font-bold text-[var(--primary)] group-hover:underline shrink-0">
                        {issue.issueKey}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] truncate">
                        {issue.summary}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                        {issue.status}
                      </span>

                      {issue.storyPoints !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10.5px]">
                          {issue.storyPoints}
                        </span>
                      )}

                      {assignee ? (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: assignee.avatarColor || '#4f46e5' }}
                          title={assignee.name}
                        >
                          {assignee.name.slice(0, 2).toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-[var(--text-muted)] italic">Unassigned</span>
                      )}

                      {/* Move to Sprint Select */}
                      {sprints.length > 0 && (
                        <select
                          value=""
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            if (e.target.value) handleMoveIssueToSprint(issue, e.target.value);
                          }}
                          className="text-[10.5px] font-bold bg-[var(--surface-hover)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--primary)] cursor-pointer outline-none"
                        >
                          <option value="">Move to...</option>
                          {sprints.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-[var(--text-muted)] italic">
                Backlog is empty. Create issues to queue up upcoming work.
              </div>
            )}

            {/* Inline Create Issue in Backlog */}
            {creatingInTarget === 'backlog' ? (
              <div className="p-2.5 bg-[var(--surface-hover)] border border-[var(--primary)]/30 rounded-xl flex gap-2 animate-fadeIn">
                <select
                  value={newIssueType}
                  onChange={e => setNewIssueType(e.target.value as JiraIssueType)}
                  className="text-xs font-bold px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none"
                >
                  <option value="Story">Story</option>
                  <option value="Bug">Bug</option>
                  <option value="Task">Task</option>
                </select>
                <input
                  type="text"
                  value={newIssueSummary}
                  onChange={e => setNewIssueSummary(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateInlineIssue('backlog');
                  }}
                  placeholder="What needs to be done? (Enter to create)"
                  className="flex-1 px-3 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleCreateInlineIssue('backlog')}
                  disabled={!newIssueSummary.trim()}
                  className="px-3 py-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded-lg cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingInTarget(null)}
                  className="text-xs text-[var(--text-muted)] hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingInTarget('backlog')}
                className="w-full py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer border border-dashed border-transparent hover:border-[var(--border)]"
              >
                <Plus size={13} />
                <span>Create issue in Backlog</span>
              </button>
            )}
          </div>
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
      />
    </div>
  );
};
