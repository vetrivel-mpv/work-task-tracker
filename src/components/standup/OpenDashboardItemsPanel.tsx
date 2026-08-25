import React, { useState } from 'react';
import { 
  AppState, 
  TeamMember, 
  Task, 
  UserStory, 
  Defect, 
  StandupEntry, 
  TaskStatus, 
  DefectStatus, 
  UserStoryStatus 
} from '../../types';
import { 
  getMemberDashboardItems, 
  formatItemForStandup 
} from '../../utils/standupDashboardSync';
import { 
  Layers, 
  CheckCircle2, 
  Target, 
  AlertTriangle, 
  CheckSquare, 
  Bug, 
  BookOpen, 
  Plus, 
  Sparkles, 
  RefreshCw, 
  ArrowRightLeft, 
  Check, 
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Clock,
  ShieldAlert
} from 'lucide-react';

interface OpenDashboardItemsPanelProps {
  member: TeamMember;
  state: AppState;
  activeEntry: StandupEntry;
  onUpdateStandupEntry: (entry: StandupEntry) => void;
  onUpdateTask?: (task: Task) => void;
  onUpdateDefect?: (defect: Defect) => void;
  onUpdateStory?: (story: UserStory) => void;
  onAddDefect?: (defect: Partial<Defect>) => void;
  onOpenReconciliationModal: () => void;
  onBulkSyncAll: () => void;
}

type TabType = 'all' | 'tasks' | 'stories' | 'defects' | 'done';

export const OpenDashboardItemsPanel: React.FC<OpenDashboardItemsPanelProps> = ({
  member,
  state,
  activeEntry,
  onUpdateStandupEntry,
  onUpdateTask,
  onUpdateDefect,
  onUpdateStory,
  onAddDefect,
  onOpenReconciliationModal,
  onBulkSyncAll
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [syncedFeedback, setSyncedFeedback] = useState<string | null>(null);

  const items = getMemberDashboardItems(member.id, state);

  const showToast = (msg: string) => {
    setSyncedFeedback(msg);
    setTimeout(() => setSyncedFeedback(null), 2500);
  };

  // Append a bullet point to a specific standup field
  const handleAppendToField = (field: 'yesterday' | 'today' | 'blockers', bulletText: string) => {
    const currentVal = (activeEntry[field] || '').trim();
    const formattedBullet = bulletText.startsWith('•') ? bulletText : `• ${bulletText}`;
    
    // Check if already present
    if (currentVal.includes(bulletText)) {
      showToast(`Already included in ${field}!`);
      return;
    }

    let updatedVal: string;
    if (!currentVal || currentVal.toLowerCase() === 'none') {
      updatedVal = formattedBullet;
    } else {
      updatedVal = `${currentVal}\n${formattedBullet}`;
    }

    onUpdateStandupEntry({
      ...activeEntry,
      [field]: updatedVal
    });

    showToast(`Added to ${field === 'yesterday' ? "Yesterday's Accomplishments" : field === 'today' ? "Today's Focus" : "Blockers"}!`);
  };

  // Full Autofill for this member
  const handleAutofillMember = () => {
    const yesterdayLines: string[] = [];
    items.completedTasksYesterday.forEach(t => {
      yesterdayLines.push(`• ${formatItemForStandup(t, 'task')}`);
    });
    if (yesterdayLines.length === 0 && items.completedTasksToday.length > 0) {
      items.completedTasksToday.forEach(t => {
        yesterdayLines.push(`• ${formatItemForStandup(t, 'task')}`);
      });
    }

    const todayLines: string[] = [];
    items.openTasks.forEach(t => {
      todayLines.push(`• ${formatItemForStandup(t, 'task')}`);
    });
    items.activeStories.forEach(s => {
      todayLines.push(`• ${formatItemForStandup(s, 'story')}`);
    });
    items.activeDefects.forEach(d => {
      todayLines.push(`• ${formatItemForStandup(d, 'defect')}`);
    });

    const blockerLines: string[] = [];
    items.blockedTasks.forEach(t => {
      blockerLines.push(`• Blocked: [Task #${t.adoId || t.id.slice(-4)}] ${t.title} (Waiting on dependencies)`);
    });
    items.activeDefects.filter(d => d.severity === 'critical' || d.severity === 'high').forEach(d => {
      blockerLines.push(`• [${d.severity.toUpperCase()} Defect #${d.adoId || d.id.slice(-4)}] ${d.title}`);
    });

    onUpdateStandupEntry({
      ...activeEntry,
      yesterday: yesterdayLines.length > 0 ? yesterdayLines.join('\n') : (activeEntry.yesterday || 'Completed daily deliverables and PR reviews'),
      today: todayLines.length > 0 ? todayLines.join('\n') : (activeEntry.today || 'Sprint backlog development & defect fixes'),
      blockers: blockerLines.length > 0 ? blockerLines.join('\n') : 'None',
      syncedWithDashboardAt: new Date().toISOString()
    });

    showToast(`Synced ${items.totalOpenCount} open dashboard items!`);
  };

  // Push Standup Discussion Notes as Comments into open tasks
  const handlePushNotesToTaskComments = () => {
    if (!onUpdateTask || items.openTasks.length === 0) return;

    const note = `[Daily Standup ${state.dateStr}] Today: ${activeEntry.today || 'Active'}${activeEntry.blockers && activeEntry.blockers.toLowerCase() !== 'none' ? ` | Blocker: ${activeEntry.blockers}` : ''}`;

    let updatedCount = 0;
    items.openTasks.forEach(task => {
      const newComment = {
        id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        author: member.name,
        text: note,
        createdAt: new Date().toISOString()
      };
      onUpdateTask({
        ...task,
        comments: [...(task.comments || []), newComment],
        discussedInStandup: true,
        standupDiscussionNotes: activeEntry.today
      });
      updatedCount++;
    });

    showToast(`Logged standup discussion note on ${updatedCount} open tasks!`);
  };

  // Convert typed blocker to new defect
  const handleConvertBlockerToDefect = () => {
    if (!onAddDefect) return;
    if (!activeEntry.blockers || activeEntry.blockers.trim() === '' || activeEntry.blockers.toLowerCase() === 'none') {
      showToast('No active blocker written in standup to convert.');
      return;
    }

    const title = activeEntry.blockers.split('\n')[0].replace(/^[•\-\*\s]+/, '').trim();
    const newDefect: Partial<Defect> = {
      title: `[Standup Blocker] ${title.slice(0, 100)}`,
      description: `Blocker raised by ${member.name} during daily standup on ${state.dateStr}:\n\n${activeEntry.blockers}`,
      severity: activeEntry.blockers.toLowerCase().includes('critical') ? 'critical' : 'high',
      status: 'Active',
      origin: 'internal_qa',
      assigneeId: member.id,
      assigneeName: member.name,
      environment: 'Dev',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddDefect(newDefect);
    showToast('Created new Dashboard Blocker Defect!');
  };

  // Inline status updates
  const handleToggleTaskStatus = (task: Task, nextStatus: TaskStatus) => {
    if (!onUpdateTask) return;
    onUpdateTask({
      ...task,
      status: nextStatus,
      completedAt: nextStatus === 'complete' ? new Date().toISOString() : undefined
    });
    showToast(`Task status changed to ${nextStatus.toUpperCase()}`);
  };

  const handleToggleDefectStatus = (defect: Defect, nextStatus: DefectStatus) => {
    if (!onUpdateDefect) return;
    onUpdateDefect({
      ...defect,
      status: nextStatus,
      closedAt: nextStatus === 'Closed' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    });
    showToast(`Defect status changed to ${nextStatus.toUpperCase()}`);
  };

  const handleToggleStoryStatus = (story: UserStory, nextStatus: UserStoryStatus) => {
    if (!onUpdateStory) return;
    onUpdateStory({
      ...story,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });
    showToast(`Story status changed to ${nextStatus}`);
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
      {/* Header & Sync Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Open Dashboard Items</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                {items.totalOpenCount} Active for {member.name.split(' ')[0]}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">
              Seamlessly link & sync live sprint deliverables with daily standup call discussion
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleAutofillMember}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            title="Import all open items into this member's standup notes"
          >
            <Sparkles size={13} />
            <span>Auto-Sync Member</span>
          </button>

          <button
            onClick={onBulkSyncAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
            title="Auto-populate today's standup entries for the whole team roster from open dashboard items"
          >
            <RefreshCw size={13} />
            <span>Sync Entire Team</span>
          </button>

          <button
            onClick={onOpenReconciliationModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
            title="Compare standup call discussion against open dashboard items to reconcile statuses"
          >
            <ArrowRightLeft size={13} />
            <span>Reconcile Board</span>
          </button>
        </div>
      </div>

      {/* Toast feedback banner */}
      {syncedFeedback && (
        <div className="bg-[var(--primary-light)] border border-[var(--primary)] text-[var(--primary)] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all">
          <div className="flex items-center gap-2">
            <Check size={14} />
            <span>{syncedFeedback}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border)] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-[var(--surface-hover)] text-[var(--primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          All Items ({items.totalOpenCount})
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'bg-[var(--surface-hover)] text-[var(--primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CheckSquare size={13} className="text-[var(--primary)]" />
          <span>Tasks ({items.openTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stories')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'stories'
              ? 'bg-[var(--surface-hover)] text-[var(--primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BookOpen size={13} className="text-[var(--info)]" />
          <span>Stories ({items.activeStories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('defects')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'defects'
              ? 'bg-[var(--surface-hover)] text-[var(--primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Bug size={13} className="text-[var(--critical)]" />
          <span>Defects ({items.activeDefects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('done')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'done'
              ? 'bg-[var(--surface-hover)] text-[var(--primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CheckCircle2 size={13} className="text-[var(--success)]" />
          <span>Done ({items.completedTasksYesterday.length + items.completedTasksToday.length})</span>
        </button>
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
        {items.totalOpenCount === 0 && activeTab !== 'done' && (
          <div className="p-6 text-center bg-[var(--surface-hover)] rounded-xl border border-[var(--border)] flex flex-col items-center justify-center gap-2">
            <CheckCircle2 size={24} className="text-[var(--success)] opacity-70" />
            <p className="text-xs font-semibold text-[var(--text-primary)]">No Open Dashboard Items Assigned</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-sm">
              {member.name} has cleared all assigned tasks, stories, and defects for this sprint.
            </p>
          </div>
        )}

        {/* 1. Open Tasks */}
        {(activeTab === 'all' || activeTab === 'tasks') && items.openTasks.map(task => {
          const isBlocked = items.blockedTasks.some(b => b.id === task.id);
          return (
            <div
              key={task.id}
              className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                isBlocked
                  ? 'bg-[var(--critical-light)] border-[var(--critical-border)]'
                  : 'bg-[var(--surface-hover)] border-[var(--border)] hover:border-[var(--primary)]/40'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <CheckSquare size={16} className={`mt-0.5 flex-shrink-0 ${task.priority === 'critical' ? 'text-[var(--critical)]' : 'text-[var(--primary)]'}`} />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.adoId && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                        #{task.adoId}
                      </span>
                    )}
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {task.title}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      task.priority === 'critical' ? 'bg-[var(--critical)] text-white' :
                      task.priority === 'high' ? 'bg-[var(--critical-light)] text-[var(--critical)]' :
                      task.priority === 'medium' ? 'bg-[var(--medium-light)] text-[var(--medium)]' :
                      'bg-[var(--surface)] text-[var(--text-muted)]'
                    }`}>
                      {task.priority}
                    </span>
                    {isBlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--critical)] bg-[var(--surface)] px-1.5 py-0.2 rounded border border-[var(--critical-border)]">
                        <ShieldAlert size={11} /> Blocked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-muted)] mt-1">
                    <span>Due: {task.dueDate || 'Sprint End'}</span>
                    <span>&bull;</span>
                    <span>Status: <strong className="uppercase">{task.status}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-center">
                {/* Status Quick Changer */}
                {onUpdateTask && (
                  <select
                    value={task.status}
                    onChange={(e) => handleToggleTaskStatus(task, e.target.value as TaskStatus)}
                    className="text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] outline-none cursor-pointer"
                    title="Change Task Status"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">In Progress</option>
                    <option value="complete">Complete</option>
                  </select>
                )}

                <button
                  onClick={() => handleAppendToField('today', formatItemForStandup(task, 'task'))}
                  className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                  title="Add to Today's Focus"
                >
                  + Focus
                </button>

                <button
                  onClick={() => handleAppendToField('yesterday', formatItemForStandup(task, 'task'))}
                  className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                  title="Add to Yesterday's Accomplishments"
                >
                  + Done
                </button>

                <button
                  onClick={() => handleAppendToField('blockers', `Blocker on [Task #${task.adoId || task.id.slice(-4)}] ${task.title}`)}
                  className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--critical-light)] hover:text-[var(--critical)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                  title="Report as Blocker"
                >
                  + Blocker
                </button>
              </div>
            </div>
          );
        })}

        {/* 2. Active User Stories */}
        {(activeTab === 'all' || activeTab === 'stories') && items.activeStories.map(story => (
          <div
            key={story.id}
            className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--info)]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <BookOpen size={16} className="text-[var(--info)] mt-0.5 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {story.adoId && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                      #{story.adoId}
                    </span>
                  )}
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {story.title}
                  </span>
                  {story.storyPoints && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--info-light)] text-[var(--info)]">
                      {story.storyPoints} pts
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-muted)] mt-1">
                  <span>Status: <strong>{story.status}</strong></span>
                  {story.iterationPath && <span>&bull; {story.iterationPath}</span>}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-center">
              {onUpdateStory && (
                <select
                  value={story.status}
                  onChange={(e) => handleToggleStoryStatus(story, e.target.value as UserStoryStatus)}
                  className="text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="To Do">To Do</option>
                  <option value="Dev In Progress">Dev In Progress</option>
                  <option value="QA Ready">QA Ready</option>
                  <option value="QA In Progress">QA In Progress</option>
                  <option value="Done">Done</option>
                  <option value="Blocked">Blocked</option>
                </select>
              )}

              <button
                onClick={() => handleAppendToField('today', formatItemForStandup(story, 'story'))}
                className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                + Focus
              </button>

              <button
                onClick={() => handleAppendToField('yesterday', formatItemForStandup(story, 'story'))}
                className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                + Done
              </button>
            </div>
          </div>
        ))}

        {/* 3. Active Defects */}
        {(activeTab === 'all' || activeTab === 'defects') && items.activeDefects.map(defect => (
          <div
            key={defect.id}
            className="p-3 rounded-xl border border-[var(--critical-border)] bg-[var(--critical-light)]/40 hover:border-[var(--critical)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <Bug size={16} className="text-[var(--critical)] mt-0.5 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {defect.adoId && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                      #{defect.adoId}
                    </span>
                  )}
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {defect.title}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    defect.severity === 'critical' ? 'bg-[var(--critical)] text-white' :
                    defect.severity === 'high' ? 'bg-[var(--critical-light)] text-[var(--critical)]' :
                    'bg-[var(--surface)] text-[var(--text-secondary)]'
                  }`}>
                    {defect.severity}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-muted)] mt-1">
                  <span>Status: <strong>{defect.status}</strong></span>
                  {defect.environment && <span>&bull; Env: {defect.environment}</span>}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-center">
              {onUpdateDefect && (
                <select
                  value={defect.status}
                  onChange={(e) => handleToggleDefectStatus(defect, e.target.value as DefectStatus)}
                  className="text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="New">New</option>
                  <option value="Active">Active</option>
                  <option value="Fixed">Fixed</option>
                  <option value="Retest">Retest</option>
                  <option value="Closed">Closed</option>
                </select>
              )}

              <button
                onClick={() => handleAppendToField('today', formatItemForStandup(defect, 'defect'))}
                className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                + Focus
              </button>

              <button
                onClick={() => handleAppendToField('blockers', formatItemForStandup(defect, 'defect'))}
                className="px-2 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--critical-light)] hover:text-[var(--critical)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                + Blocker
              </button>
            </div>
          </div>
        ))}

        {/* 4. Completed Recently */}
        {activeTab === 'done' && (
          [...items.completedTasksYesterday, ...items.completedTasksToday].map(task => (
            <div
              key={task.id}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <CheckCircle2 size={16} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {task.title}
                  </span>
                  <span className="text-[10.5px] text-[var(--text-muted)]">
                    Completed on {task.dateStr || 'Recent'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleAppendToField('yesterday', formatItemForStandup(task, 'task'))}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer self-end md:self-center"
              >
                + Add to Yesterday
              </button>
            </div>
          ))
        )}
      </div>

      {/* Discussion Actions Footer */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-[var(--border)] bg-[var(--surface-hover)]/50 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-primary)]">Sync Discussion to Dashboard:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePushNotesToTaskComments}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--border)] border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Append today's standup commitments into task comments"
          >
            <MessageSquare size={13} className="text-[var(--primary)]" />
            <span>Log Notes to Task History</span>
          </button>

          {activeEntry.blockers && activeEntry.blockers.toLowerCase() !== 'none' && (
            <button
              onClick={handleConvertBlockerToDefect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--critical-light)] hover:bg-[var(--critical)] hover:text-white border border-[var(--critical-border)] rounded-lg text-xs font-bold text-[var(--critical)] transition-all cursor-pointer"
              title="Create a tracked defect from the standup blocker"
            >
              <Bug size={13} />
              <span>Convert Blocker to Defect</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
