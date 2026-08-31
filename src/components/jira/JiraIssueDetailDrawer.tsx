import React, { useState, useEffect } from 'react';
import { 
  JiraIssue, 
  JiraIssueStatus, 
  JiraIssueType, 
  JiraIssueComment,
  JiraWorkLog,
  Priority,
  Severity,
  TeamMember
} from '../../types';
import { 
  X, 
  CheckSquare, 
  Bookmark, 
  Bug, 
  Layers, 
  Clock, 
  User, 
  Tag, 
  Check, 
  Send, 
  Plus, 
  MessageSquare, 
  Activity, 
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  Copy
} from 'lucide-react';
import { adoService } from '../../services/adoService';
import { graphqlService } from '../../services/graphqlService';

interface JiraIssueDetailDrawerProps {
  issue: JiraIssue | null;
  isOpen: boolean;
  onClose: () => void;
  team: TeamMember[];
  onUpdateIssue: (updated: JiraIssue) => void;
  onDeleteIssue?: (issueId: string) => void;
}

const STATUS_COLUMNS: JiraIssueStatus[] = [
  'To Do',
  'In Progress',
  'Code Review',
  'QA Ready',
  'QA In Progress',
  'QA Passed',
  'Done',
  'Blocked'
];

export const JiraIssueDetailDrawer: React.FC<JiraIssueDetailDrawerProps> = ({
  issue,
  isOpen,
  onClose,
  team,
  onUpdateIssue,
  onDeleteIssue
}) => {
  if (!isOpen || !issue) return null;

  const [activeTab, setActiveTab] = useState<'comments' | 'worklog' | 'subtasks'>('comments');
  const [commentText, setCommentText] = useState('');
  const [isSyncingComments, setIsSyncingComments] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Work Log form state
  const [logHours, setLogHours] = useState('2.0');
  const [logDescription, setLogDescription] = useState('');
  const [showLogForm, setShowLogForm] = useState(false);

  // Subtask quick add
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const assignee = team.find(m => m.id === issue.assigneeId);

  // Auto-fetch live comments when drawer opens if ADO ID is present
  useEffect(() => {
    if (isOpen && issue && issue.adoId) {
      if (!issue.comments || issue.comments.length === 0) {
        handleSyncAdoComments();
      }
    }
  }, [isOpen, issue?.id, issue?.adoId]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(`${issue.issueKey}: ${issue.summary}`);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleStatusChange = (newStatus: JiraIssueStatus) => {
    const updated: JiraIssue = {
      ...issue,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    onUpdateIssue(updated);
    graphqlService.updateIssueStatus(issue.id, newStatus).catch(() => {});
  };

  const handlePriorityChange = (newPriority: Priority) => {
    onUpdateIssue({
      ...issue,
      priority: newPriority,
      updatedAt: new Date().toISOString()
    });
  };

  const handleAssigneeChange = (newAssigneeId: string) => {
    const member = team.find(m => m.id === newAssigneeId);
    onUpdateIssue({
      ...issue,
      assigneeId: newAssigneeId || null,
      assigneeName: member ? member.name : undefined,
      updatedAt: new Date().toISOString()
    });
  };

  const handleStoryPointsChange = (pts: number) => {
    onUpdateIssue({
      ...issue,
      storyPoints: pts,
      updatedAt: new Date().toISOString()
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const currentAuthor = team.find(m => m.id === issue.assigneeId)?.name || 'QA Engineer';
    const newComment: JiraIssueComment = {
      id: `c-${Date.now()}`,
      issueId: issue.id,
      authorName: currentAuthor,
      body: commentText.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedComments = [newComment, ...(issue.comments || [])];
    onUpdateIssue({
      ...issue,
      comments: updatedComments,
      updatedAt: new Date().toISOString()
    });

    setCommentText('');

    // Persist to GraphQL & ADO in background
    graphqlService.addComment(issue.id, currentAuthor, commentText.trim()).catch(() => {});
    if (issue.adoId) {
      adoService.addWorkItemComment(issue.adoId, commentText.trim()).catch(() => {});
    }
  };

  const handleSyncAdoComments = async () => {
    if (!issue.adoId) return;
    setIsSyncingComments(true);
    try {
      const res = await adoService.getWorkItemComments(issue.adoId);
      if (res.ok && Array.isArray(res.comments) && res.comments.length > 0) {
        const mapped: JiraIssueComment[] = res.comments.map(c => ({
          id: String(c.id || Date.now()),
          issueId: issue.id,
          authorName: c.author || 'Contributor',
          body: c.text,
          createdAt: c.createdAt || new Date().toISOString()
        }));

        onUpdateIssue({
          ...issue,
          comments: mapped,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Failed to sync ADO comments:', e);
    } finally {
      setIsSyncingComments(false);
    }
  };

  const handleLogWork = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) return;

    const currentAuthor = team.find(m => m.id === issue.assigneeId)?.name || 'Engineer';
    const newWorkLog: JiraWorkLog = {
      id: `wl-${Date.now()}`,
      issueId: issue.id,
      authorName: currentAuthor,
      timeSpentHours: hours,
      description: logDescription.trim() || undefined,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const updatedLogs = [newWorkLog, ...(issue.workLogs || [])];
    const newTotalHours = (issue.timeSpentHours || 0) + hours;

    onUpdateIssue({
      ...issue,
      workLogs: updatedLogs,
      timeSpentHours: newTotalHours,
      updatedAt: new Date().toISOString()
    });

    setLogDescription('');
    setShowLogForm(false);

    graphqlService.logWork(issue.id, currentAuthor, hours, logDescription.trim()).catch(() => {});
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const subtask: JiraIssue = {
      id: `sub-${Date.now()}`,
      issueKey: `${issue.issueKey}-S${(issue.subtasks || []).length + 1}`,
      projectId: issue.projectId,
      sprintId: issue.sprintId,
      parentIssueId: issue.id,
      issueType: 'Subtask',
      summary: newSubtaskTitle.trim(),
      status: 'To Do',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onUpdateIssue({
      ...issue,
      subtasks: [...(issue.subtasks || []), subtask],
      updatedAt: new Date().toISOString()
    });

    setNewSubtaskTitle('');
  };

  const getTypeIcon = (type: JiraIssueType) => {
    switch (type) {
      case 'Epic':
        return <Bookmark size={15} className="text-purple-500" />;
      case 'Bug':
        return <Bug size={15} className="text-rose-500" />;
      case 'Story':
        return <Bookmark size={15} className="text-emerald-500" />;
      case 'Subtask':
        return <CheckSquare size={15} className="text-sky-500" />;
      case 'Task':
      default:
        return <CheckSquare size={15} className="text-blue-500" />;
    }
  };

  const getStatusBadge = (status: JiraIssueStatus) => {
    switch (status) {
      case 'Done':
      case 'QA Passed':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'Blocked':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case 'QA In Progress':
      case 'In Progress':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'QA Ready':
      case 'Code Review':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-2xl lg:max-w-3xl bg-[var(--surface)] h-full shadow-2xl flex flex-col border-l border-[var(--border)] overflow-hidden animate-slideLeft"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Strip */}
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-hover)]/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-2xs">
              {getTypeIcon(issue.issueType)}
            </div>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <button
                type="button"
                onClick={handleCopyKey}
                className="font-mono text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--border)]"
                title="Click to copy issue key & summary"
              >
                <span>{issue.issueKey}</span>
                {copiedKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>

              {issue.adoId && (
                <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                  ADO #{issue.adoId}
                </span>
              )}

              {issue.areaPath && (
                <span className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                  {issue.areaPath}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Summary & Status Row */}
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={issue.summary}
              onChange={e => onUpdateIssue({ ...issue, summary: e.target.value, updatedAt: new Date().toISOString() })}
              className="text-lg font-bold text-[var(--text-primary)] bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] px-1 py-1 focus:outline-none rounded transition-all"
            />

            {/* Quick Status Pill Select */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Status:</span>
                <select
                  value={issue.status}
                  onChange={e => handleStatusChange(e.target.value as JiraIssueStatus)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer outline-none ${getStatusBadge(issue.status)}`}
                >
                  {STATUS_COLUMNS.map(st => (
                    <option key={st} value={st} className="bg-[var(--surface)] text-[var(--text-primary)]">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Priority:</span>
                <select
                  value={issue.priority}
                  onChange={e => handlePriorityChange(e.target.value as Priority)}
                  className="text-xs font-bold px-2.5 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] cursor-pointer outline-none"
                >
                  <option value="critical">🔴 Critical</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Story Points:</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={issue.storyPoints || 0}
                  onChange={e => handleStoryPointsChange(parseFloat(e.target.value) || 0)}
                  className="w-16 text-xs font-bold px-2 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-center outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          </div>

          {/* Grid Attributes (Assignee, Reporter, Release) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--surface-hover)]/40 border border-[var(--border)] text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">Assignee</span>
              <select
                value={issue.assigneeId || ''}
                onChange={e => handleAssigneeChange(e.target.value)}
                className="w-full font-semibold px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
              >
                <option value="">Unassigned</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">Time Tracking (Hours)</span>
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-xs">
                <span>{issue.timeSpentHours || 0}h logged</span>
                <span className="text-[var(--text-muted)]">/ {issue.originalEstimateHours || (issue.storyPoints || 0) * 3}h est.</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('worklog');
                    setShowLogForm(true);
                  }}
                  className="text-[11px] text-[var(--primary)] hover:underline font-sans font-bold cursor-pointer ml-auto"
                >
                  + Log Work
                </button>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Description</span>
            <textarea
              value={issue.description || ''}
              onChange={e => onUpdateIssue({ ...issue, description: e.target.value, updatedAt: new Date().toISOString() })}
              placeholder="Add detailed issue description, acceptance criteria, or reproduction logs..."
              rows={4}
              className="w-full text-xs p-3 bg-[var(--surface-hover)]/50 border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] leading-relaxed resize-y"
            />
          </div>

          {/* Activity & Subtasks Tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`pb-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all border-b-2 ${
                    activeTab === 'comments'
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Comments ({(issue.comments || []).length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('worklog')}
                  className={`pb-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all border-b-2 ${
                    activeTab === 'worklog'
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Clock size={13} />
                  <span>Work Log ({(issue.workLogs || []).length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('subtasks')}
                  className={`pb-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all border-b-2 ${
                    activeTab === 'subtasks'
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <CheckSquare size={13} />
                  <span>Subtasks ({(issue.subtasks || []).length})</span>
                </button>
              </div>

              {activeTab === 'comments' && issue.adoId && (
                <button
                  type="button"
                  disabled={isSyncingComments}
                  onClick={handleSyncAdoComments}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-50"
                  title="Sync discussion comments from Azure DevOps"
                >
                  <RefreshCw size={11} className={isSyncingComments ? 'animate-spin' : ''} />
                  <span>{isSyncingComments ? 'Syncing...' : 'Sync ADO'}</span>
                </button>
              )}
            </div>

            {/* Tab 1: Comments */}
            {activeTab === 'comments' && (
              <div className="flex flex-col gap-4">
                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment or execution status note (Markdown supported)..."
                    rows={3}
                    className="w-full text-xs p-3 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded-lg shadow-xs cursor-pointer transition-all"
                    >
                      <Send size={12} />
                      <span>Post Comment</span>
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="flex flex-col gap-2.5">
                  {(issue.comments || []).length > 0 ? (
                    (issue.comments || []).map((c, idx) => (
                      <div key={c.id || idx} className="p-3 rounded-xl bg-[var(--surface-hover)]/60 border border-[var(--border)] flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <span className="font-bold text-[var(--text-secondary)]">{c.authorName}</span>
                          <span>{c.createdAt ? new Date(c.createdAt).toLocaleString() : 'Just now'}</span>
                        </div>
                        <p className="text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap mt-0.5">{c.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic py-2">No comments yet. Be the first to leave a comment.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Work Log */}
            {activeTab === 'worklog' && (
              <div className="flex flex-col gap-4">
                {showLogForm ? (
                  <form onSubmit={handleLogWork} className="p-3.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)]">Log Work on {issue.issueKey}</span>
                      <button type="button" onClick={() => setShowLogForm(false)} className="text-[11px] text-[var(--text-muted)] hover:underline cursor-pointer">
                        Cancel
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Time Spent (Hours):</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={logHours}
                        onChange={e => setLogHours(e.target.value)}
                        className="w-20 px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center font-bold text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <input
                      type="text"
                      value={logDescription}
                      onChange={e => setLogDescription(e.target.value)}
                      placeholder="Work activity description (e.g. Executed automated test suite)..."
                      className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                    />

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg shadow-2xs cursor-pointer"
                      >
                        Save Work Log
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLogForm(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Log Time / Work on this Issue</span>
                  </button>
                )}

                {/* Work logs list */}
                <div className="flex flex-col gap-2">
                  {(issue.workLogs || []).length > 0 ? (
                    (issue.workLogs || []).map((w, idx) => (
                      <div key={w.id || idx} className="p-3 rounded-xl bg-[var(--surface-hover)]/60 border border-[var(--border)] flex items-center justify-between text-xs">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                            <span>{w.authorName}</span>
                            <span className="text-[11px] text-[var(--text-muted)] font-normal">
                              ({new Date(w.startedAt).toLocaleDateString()})
                            </span>
                          </div>
                          {w.description && <p className="text-[var(--text-secondary)] text-[11.5px]">{w.description}</p>}
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] font-mono font-bold text-xs">
                          {w.timeSpentHours}h
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic py-2">No work logs recorded yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Subtasks */}
            {activeTab === 'subtasks' && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    placeholder="Create new subtask (e.g. Write integration unit test)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="submit"
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                </form>

                <div className="flex flex-col gap-2">
                  {(issue.subtasks || []).length > 0 ? (
                    (issue.subtasks || []).map((sub, idx) => (
                      <div key={sub.id || idx} className="p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckSquare size={14} className="text-sky-500" />
                          <span className="font-mono text-[10px] font-bold text-[var(--primary)]">{sub.issueKey}</span>
                          <span className="font-semibold text-[var(--text-primary)]">{sub.summary}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getStatusBadge(sub.status)}`}>
                          {sub.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic py-2">No subtasks for this issue.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
