import React, { useState } from 'react';
import { 
  JiraIssue, 
  JiraIssueType, 
  JiraProject, 
  JiraSprint, 
  TeamMember, 
  Priority, 
  Severity 
} from '../../types';
import { 
  X, 
  Bookmark, 
  Bug, 
  CheckSquare, 
  User, 
  Layers, 
  Sparkles, 
  Plus,
  HelpCircle,
  Maximize2
} from 'lucide-react';
import { graphqlService } from '../../services/graphqlService';

interface JiraCreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: JiraProject[];
  sprints: JiraSprint[];
  team: TeamMember[];
  onAddIssue: (issue: Partial<JiraIssue>) => void;
}

export const JiraCreateIssueModal: React.FC<JiraCreateIssueModalProps> = ({
  isOpen,
  onClose,
  projects,
  sprints,
  team,
  onAddIssue
}) => {
  if (!isOpen) return null;

  const currentProject = projects[0] || { id: 'proj-acm', key: 'ACM', name: 'ACM Platform' };

  const [issueType, setIssueType] = useState<JiraIssueType>('Story');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [storyPoints, setStoryPoints] = useState('3');
  const [originalEstimate, setOriginalEstimate] = useState('8');
  const [selectedSprintId, setSelectedSprintId] = useState<string>(
    sprints.find(s => s.state === 'active')?.id || ''
  );
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [environment, setEnvironment] = useState('QA');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    const issueNum = Math.floor(100 + Math.random() * 900);
    const pts = parseFloat(storyPoints) || 0;
    const est = parseFloat(originalEstimate) || (pts * 3);
    const assignee = team.find(m => m.id === assigneeId);

    const newIssue: Partial<JiraIssue> = {
      id: `issue-${Date.now()}`,
      issueKey: `${currentProject.key}-${issueNum}`,
      projectId: currentProject.id,
      sprintId: selectedSprintId || null,
      issueType,
      summary: summary.trim(),
      description: description.trim(),
      status: 'To Do',
      priority,
      severity: issueType === 'Bug' ? severity : undefined,
      storyPoints: pts,
      originalEstimateHours: est,
      timeSpentHours: 0,
      assigneeId: assigneeId || null,
      assigneeName: assignee ? assignee.name : undefined,
      environment: issueType === 'Bug' ? environment : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddIssue(newIssue);
    graphqlService.createIssue(newIssue).catch(() => {});

    onClose();
  };

  const getTypeIcon = (type: JiraIssueType) => {
    switch (type) {
      case 'Epic':
        return <Bookmark size={15} className="text-purple-600" />;
      case 'Bug':
        return <Bug size={15} className="text-rose-600" />;
      case 'Story':
        return <Bookmark size={15} className="text-emerald-600" />;
      case 'Subtask':
        return <CheckSquare size={15} className="text-sky-600" />;
      case 'Task':
      default:
        return <CheckSquare size={15} className="text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Create Issue</h2>
            <span className="text-xs text-[var(--text-muted)] font-medium">in {currentProject.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4.5 text-xs">
          {/* Project & Issue Type Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[var(--text-secondary)]">Project</label>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] font-semibold text-[var(--text-primary)]">
                <span className="w-5 h-5 rounded bg-[#0052CC] text-white flex items-center justify-center text-[10px] font-bold">
                  {currentProject.key}
                </span>
                <span>{currentProject.name} ({currentProject.key})</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-between">
                <span>Issue Type</span>
                <span className="text-[10px] text-rose-500 font-normal">*Required</span>
              </label>
              <select
                value={issueType}
                onChange={e => setIssueType(e.target.value as JiraIssueType)}
                className="w-full p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="Story">Story (Requirement / Feature)</option>
                <option value="Bug">Bug (Defect / Failure)</option>
                <option value="Task">Task (Work Item)</option>
                <option value="Epic">Epic (Large Initiative)</option>
              </select>
            </div>
          </div>

          <div className="h-px bg-[var(--border)] my-1" />

          {/* Summary Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-between">
              <span>Summary</span>
              <span className="text-[10px] text-rose-500 font-normal">*Required</span>
            </label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="e.g. Implement dynamic roaming switchover service..."
              className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] font-semibold focus:outline-none focus:border-[var(--primary)] shadow-2xs"
              autoFocus
              required
            />
          </div>

          {/* Description Textarea */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[var(--text-secondary)]">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide background context, technical details, acceptance criteria, or logs..."
              rows={4}
              className="w-full p-3 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] leading-relaxed"
            />
          </div>

          {/* Sprint, Priority, Story Points Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 rounded-xl bg-[var(--surface-hover)]/60 border border-[var(--border)]">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[var(--text-secondary)]">Sprint</label>
              <select
                value={selectedSprintId}
                onChange={e => setSelectedSprintId(e.target.value)}
                className="p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="">Backlog (No Sprint)</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[var(--text-secondary)]">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[var(--text-secondary)]">Story Points</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={storyPoints}
                onChange={e => setStoryPoints(e.target.value)}
                className="p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-bold text-center text-[var(--text-primary)] outline-none"
              />
            </div>
          </div>

          {/* Assignee Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[var(--text-secondary)]">Assignee</label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="">Unassigned</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {issueType === 'Bug' && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[var(--text-secondary)]">Environment</label>
                <select
                  value={environment}
                  onChange={e => setEnvironment(e.target.value)}
                  className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text-primary)] outline-none"
                >
                  <option value="QA">QA Staging</option>
                  <option value="Dev">Dev Local</option>
                  <option value="UAT">UAT Client</option>
                  <option value="Production">Production</option>
                </select>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!summary.trim()}
              className="px-5 py-2 rounded-lg font-bold text-white bg-[#0052CC] hover:bg-[#0747A6] disabled:opacity-40 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
