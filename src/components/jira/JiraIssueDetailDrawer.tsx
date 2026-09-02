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
  Copy,
  Zap,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  Server
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

  const [activeTab, setActiveTab] = useState<'comments' | 'worklog' | 'daily_activity'>('daily_activity');
  const [commentText, setCommentText] = useState('');
  const [isSyncingComments, setIsSyncingComments] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Work Log form state
  const [logHours, setLogHours] = useState('2.0');
  const [logDescription, setLogDescription] = useState('');
  const [showLogForm, setShowLogForm] = useState(false);

  // Daily Activity Task form state
  const [showDailyTaskForm, setShowDailyTaskForm] = useState(false);
  const [dailyTaskTitle, setDailyTaskTitle] = useState('');
  const [dailyStatusNote, setDailyStatusNote] = useState('');
  const [dailyTaskStatus, setDailyTaskStatus] = useState<JiraIssueStatus>('In Progress');
  const [dailyHours, setDailyHours] = useState('3.0');
  const [dailyTotalTc, setDailyTotalTc] = useState('15');
  const [dailyPassedTc, setDailyPassedTc] = useState('14');
  const [dailyFailedTc, setDailyFailedTc] = useState('0');
  const [dailyBlockedTc, setDailyBlockedTc] = useState('0');

  // Simple Subtask quick add
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

  const handleIterationPathChange = (newIter: string) => {
    onUpdateIssue({
      ...issue,
      iterationPath: newIter.trim() || undefined,
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

    const currentAuthor = team.find(m => m.id === issue.assigneeId)?.name || 'QA Lead';
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

  // ⚡ DAILY ACTIVITY TASK & STATUS ROLL-UP GENERATOR
  const handleCreateDailyActivityTask = (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateDisplay = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const currentAuthor = team.find(m => m.id === issue.assigneeId)?.name || 'QA Lead';

    const title = dailyTaskTitle.trim() || `${issue.issueType === 'Bug' ? 'Defect Fix & Verification' : 'Test Scenario Execution & Verification'}`;
    const hours = parseFloat(dailyHours) || 3.0;

    const totTc = parseInt(dailyTotalTc) || 0;
    const passTc = parseInt(dailyPassedTc) || 0;
    const failTc = parseInt(dailyFailedTc) || 0;
    const blkTc = parseInt(dailyBlockedTc) || 0;

    // 1. Create Child Subtask
    const subtask: JiraIssue = {
      id: `sub-${Date.now()}`,
      issueKey: `${issue.issueKey}-D${Date.now().toString().slice(-3)}`,
      projectId: issue.projectId,
      sprintId: issue.sprintId,
      parentIssueId: issue.id,
      issueType: 'Subtask',
      summary: `[Daily Activity — ${dateDisplay}] ${title}`,
      description: dailyStatusNote.trim(),
      status: dailyTaskStatus,
      priority: issue.priority,
      storyPoints: 1,
      originalEstimateHours: hours,
      timeSpentHours: hours,
      assigneeId: issue.assigneeId,
      assigneeName: currentAuthor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 2. Generate Roll-Up Discussion Comment
    let commentBody = `[Daily Activity Status — ${dateDisplay}] by ${currentAuthor}:\n${dailyStatusNote.trim() || title}`;
    if (totTc > 0) {
      commentBody += `\n\n📊 Test Execution: ${passTc}/${totTc} Passed (${failTc} Failed, ${blkTc} Blocked) | Status: ${dailyTaskStatus}`;
    }

    const newComment: JiraIssueComment = {
      id: `c-daily-${Date.now()}`,
      issueId: issue.id,
      authorName: currentAuthor,
      body: commentBody,
      createdAt: new Date().toISOString()
    };

    // 3. Log Work
    const newWorkLog: JiraWorkLog = {
      id: `wl-daily-${Date.now()}`,
      issueId: issue.id,
      authorName: currentAuthor,
      timeSpentHours: hours,
      description: `[${dateDisplay}] ${title}`,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // 4. Update Parent Issue with rolled-up metrics & latest comment
    const updatedSubtasks = [subtask, ...(issue.subtasks || [])];
    const updatedComments = [newComment, ...(issue.comments || [])];
    const updatedWorkLogs = [newWorkLog, ...(issue.workLogs || [])];

    const updatedIssue: JiraIssue = {
      ...issue,
      subtasks: updatedSubtasks,
      comments: updatedComments,
      workLogs: updatedWorkLogs,
      timeSpentHours: (issue.timeSpentHours || 0) + hours,
      status: blkTc > 0 ? 'Blocked' : (dailyTaskStatus === 'QA Passed' ? 'QA Passed' : issue.status),
      executionMetrics: totTc > 0 ? {
        totalTestCases: totTc,
        completedTestCases: passTc + failTc + blkTc,
        passedTestCases: passTc,
        failedTestCases: failTc,
        blockedTestCases: blkTc,
        openDefects: failTc > 0 ? failTc : 0,
        statusLabel: blkTc > 0 ? 'Blocked' : passTc === totTc ? 'Passed' : 'In Progress',
        source: 'task_comment',
        assessedAt: new Date().toISOString()
      } : issue.executionMetrics,
      updatedAt: new Date().toISOString()
    };

    onUpdateIssue(updatedIssue);

    // Persist to GraphQL & ADO
    graphqlService.addComment(issue.id, currentAuthor, commentBody).catch(() => {});
    if (issue.adoId) {
      adoService.addWorkItemComment(issue.adoId, commentBody).catch(() => {});
    }

    setShowDailyTaskForm(false);
    setDailyTaskTitle('');
    setDailyStatusNote('');
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
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'QA Ready':
      case 'QA In Progress':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'Blocked':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-2xs animate-fadeIn font-sans">
      <div 
        className="w-full max-w-2xl bg-[var(--surface)] border-l border-[var(--border)] h-full shadow-2xl flex flex-col z-50 animate-slideLeft overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-hover)]/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {getTypeIcon(issue.issueType)}
            <span className="font-mono font-bold text-xs text-[var(--primary)] shrink-0">
              {issue.issueKey}
            </span>
            {issue.adoId && (
              <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                (ADO #{issue.adoId})
              </span>
            )}
            {issue.iterationPath && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0 max-w-[200px] truncate"
                title={`ADO Iteration Path: ${issue.iterationPath}`}
              >
                <FolderGit2 size={10} className="shrink-0 text-blue-500" />
                <span className="truncate">{issue.iterationPath}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyKey}
              className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Copy issue key & summary"
            >
              {copiedKey ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-xs">
          {/* Summary / Title */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-base font-bold text-[var(--text-primary)] leading-snug">
              {issue.summary}
            </h1>
          </div>

          {/* Quick Properties Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-[var(--surface-hover)]/60 border border-[var(--border)]">
            {/* Status Transition Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</span>
              <select
                value={issue.status}
                onChange={e => handleStatusChange(e.target.value as JiraIssueStatus)}
                className={`p-1.5 rounded-lg font-bold text-xs outline-none cursor-pointer ${getStatusBadge(issue.status)}`}
              >
                {STATUS_COLUMNS.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Priority</span>
              <select
                value={issue.priority || 'medium'}
                onChange={e => handlePriorityChange(e.target.value as Priority)}
                className="p-1.5 rounded-lg font-bold text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none cursor-pointer"
              >
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Assignee</span>
              <select
                value={issue.assigneeId || ''}
                onChange={e => handleAssigneeChange(e.target.value)}
                className="p-1.5 rounded-lg font-semibold text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Story Points */}
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Story Points</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={issue.storyPoints || 0}
                onChange={e => handleStoryPointsChange(parseFloat(e.target.value) || 0)}
                className="p-1.5 rounded-lg font-bold font-mono text-center text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
              />
            </div>

            {/* ADO Iteration Path */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <FolderGit2 size={11} className="text-blue-500" />
                <span>ADO Iteration Path</span>
              </span>
              <input
                type="text"
                value={issue.iterationPath || ''}
                placeholder="e.g. ACM\D5 R 2026.09"
                onChange={e => handleIterationPathChange(e.target.value)}
                className="p-1.5 rounded-lg font-mono font-medium text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              />
            </div>

            {/* Environment */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <Server size={11} className="text-purple-500" />
                <span>Environment</span>
              </span>
              <select
                value={issue.environment || 'QA'}
                onChange={e => onUpdateIssue({ ...issue, environment: e.target.value, updatedAt: new Date().toISOString() })}
                className="p-1.5 rounded-lg font-bold text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none cursor-pointer"
              >
                <option value="QA">🧪 QA Staging</option>
                <option value="Dev">💻 Dev Local / Test</option>
                <option value="UAT">🤝 UAT Client</option>
                <option value="Staging">🚀 Staging / Pre-Prod</option>
                <option value="Production">🌐 Production</option>
                <option value="Hotfix">⚡ Hotfix / Sandbox</option>
              </select>
            </div>

            {/* ADO Area Path */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <Layers size={11} className="text-purple-500" />
                <span>ADO Area Path</span>
              </span>
              <input
                type="text"
                value={issue.areaPath || 'ACM'}
                placeholder="e.g. ACM"
                onChange={e => onUpdateIssue({ ...issue, areaPath: e.target.value.trim() || undefined, updatedAt: new Date().toISOString() })}
                className="p-1.5 rounded-lg font-mono font-medium text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {/* Time Tracking & Execution Summary Bar */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Clock size={13} className="text-[var(--primary)]" />
                <span>Time Tracking & Activity</span>
              </span>
              <div className="font-mono text-xs font-bold text-[var(--text-primary)]">
                {issue.timeSpentHours || 0}h logged / {issue.originalEstimateHours || 8}h est
              </div>
            </div>

            <div className="w-full bg-[var(--surface-hover)] rounded-full h-2 overflow-hidden">
              <div 
                className="bg-[var(--primary)] h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.round(((issue.timeSpentHours || 0) / (issue.originalEstimateHours || 8)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Activity, Subtasks, Comments & Work Log Tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('daily_activity')}
                  className={`pb-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all border-b-2 ${
                    activeTab === 'daily_activity'
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Activity size={13} />
                  <span>Daily Tasks & Subtasks ({(issue.subtasks || []).length})</span>
                </button>

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

            {/* Tab 1: Daily Activity Tasks & Roll-Up */}
            {activeTab === 'daily_activity' && (
              <div className="flex flex-col gap-4">
                {/* 1-Click Today's Activity Generator Card */}
                {showDailyTaskForm ? (
                  <form onSubmit={handleCreateDailyActivityTask} className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--primary)]/40 shadow-xs flex flex-col gap-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-[var(--text-primary)]">
                        <Zap size={14} className="text-amber-500" />
                        <span>Log Today's Activity Task & Status Roll-Up</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDailyTaskForm(false)}
                        className="text-[11px] text-[var(--text-muted)] hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Task Title */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)]">Activity / Subtask Title</label>
                      <input
                        type="text"
                        value={dailyTaskTitle}
                        onChange={e => setDailyTaskTitle(e.target.value)}
                        placeholder={`e.g. ${issue.issueType === 'Bug' ? 'Hotfix modem timeout & execute verification' : 'Execute Test Scenarios on Staging'}`}
                        className="px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] font-semibold outline-none focus:border-[var(--primary)]"
                        autoFocus
                      />
                    </div>

                    {/* Status & Hours Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">Today's Task Status</label>
                        <select
                          value={dailyTaskStatus}
                          onChange={e => setDailyTaskStatus(e.target.value as JiraIssueStatus)}
                          className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-bold text-[var(--text-primary)] outline-none"
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="QA Ready">QA Ready</option>
                          <option value="QA Passed">QA Passed / Verified</option>
                          <option value="Done">Done / Fixed</option>
                          <option value="Blocked">⚠️ Blocked (Impediment)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">Hours Spent Today</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={dailyHours}
                          onChange={e => setDailyHours(e.target.value)}
                          className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono font-bold text-center text-[var(--text-primary)] outline-none"
                        />
                      </div>
                    </div>

                    {/* Test Execution Metrics Quick Inputs */}
                    <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-[var(--text-secondary)]">Test Scenario Execution Counts (Optional)</span>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-[var(--text-muted)]">Total</span>
                          <input
                            type="number"
                            value={dailyTotalTc}
                            onChange={e => setDailyTotalTc(e.target.value)}
                            className="w-full text-center p-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded font-mono font-bold text-xs"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-emerald-600 font-bold">Passed</span>
                          <input
                            type="number"
                            value={dailyPassedTc}
                            onChange={e => setDailyPassedTc(e.target.value)}
                            className="w-full text-center p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded font-mono font-bold text-xs"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-rose-600 font-bold">Failed</span>
                          <input
                            type="number"
                            value={dailyFailedTc}
                            onChange={e => setDailyFailedTc(e.target.value)}
                            className="w-full text-center p-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded font-mono font-bold text-xs"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-amber-600 font-bold">Blocked</span>
                          <input
                            type="number"
                            value={dailyBlockedTc}
                            onChange={e => setDailyBlockedTc(e.target.value)}
                            className="w-full text-center p-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded font-mono font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status / Blocker Note */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)]">Where We Stand / Blocker Note</label>
                      <textarea
                        value={dailyStatusNote}
                        onChange={e => setDailyStatusNote(e.target.value)}
                        placeholder="e.g. Completed initial regression suite. Blocked on modem roaming switchover until backend patch is deployed..."
                        rows={2}
                        className="p-2.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none leading-relaxed"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowDailyTaskForm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0052CC] hover:bg-[#0747A6] shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus size={13} />
                        <span>Create Daily Task & Sync Status</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 rounded-2xl bg-[var(--surface-hover)]/60 border border-[var(--border)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                        <Zap size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)]">Track Today's Progress as a Child Task</div>
                        <div className="text-[11px] text-[var(--text-muted)]">Creating today's task automatically updates status, test metrics, and CEO email briefs.</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDailyTaskForm(true)}
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-[#0052CC] hover:bg-[#0747A6] shadow-xs transition-all cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      <span>+ Today's Task</span>
                    </button>
                  </div>
                )}

                {/* Subtasks List */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Linked Daily Activity & Subtasks ({(issue.subtasks || []).length})
                  </span>

                  {(issue.subtasks || []).length > 0 ? (
                    (issue.subtasks || []).map((sub, idx) => (
                      <div key={sub.id || idx} className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckSquare size={15} className="text-sky-500 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10.5px] font-bold text-[var(--primary)]">{sub.issueKey}</span>
                              <span className="font-semibold text-[var(--text-primary)] truncate">{sub.summary}</span>
                            </div>
                            {sub.description && (
                              <p className="text-[11px] text-[var(--text-muted)] truncate">{sub.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {sub.timeSpentHours && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10.5px]">
                              {sub.timeSpentHours}h
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getStatusBadge(sub.status)}`}>
                            {sub.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-[var(--text-muted)] italic bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
                      No daily activity tasks logged yet. Click "+ Today's Task" above to track progress.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Comments Discussion */}
            {activeTab === 'comments' && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment or execution status note..."
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
                    <p className="text-xs text-[var(--text-muted)] italic py-2">No comments yet. Post a comment or add today's activity task.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Work Log */}
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
                      placeholder="Work activity description..."
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
          </div>
        </div>
      </div>
    </div>
  );
};
