import React, { useState, useMemo } from 'react';
import { 
  JiraIssue, 
  JiraSprint, 
  JiraProject, 
  Release, 
  TeamMember 
} from '../../types';
import { 
  Calendar, 
  Bookmark, 
  Bug, 
  CheckSquare, 
  Layers, 
  ChevronRight, 
  Clock, 
  Flag,
  Sparkles,
  Search
} from 'lucide-react';
import { JiraIssueDetailDrawer } from './JiraIssueDetailDrawer';

interface JiraTimelineViewProps {
  issues: JiraIssue[];
  sprints: JiraSprint[];
  releases: Release[];
  projects: JiraProject[];
  team: TeamMember[];
  onUpdateIssue: (issue: JiraIssue) => void;
}

export const JiraTimelineView: React.FC<JiraTimelineViewProps> = ({
  issues,
  sprints,
  releases,
  projects,
  team,
  onUpdateIssue
}) => {
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentProject = projects[0] || { id: 'proj-acm', key: 'ACM', name: 'ACM Platform' };

  // Calculate timeline spans (3 months window)
  const today = new Date();
  const timelineDays = useMemo(() => {
    const days: { date: Date; dateStr: string; label: string; isToday: boolean }[] = [];
    const start = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 45; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      days.push({
        date: d,
        dateStr: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        isToday: d.toDateString() === today.toDateString()
      });
    }
    return days;
  }, []);

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return i.issueKey.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q);
      }
      return true;
    });
  }, [issues, searchQuery]);

  return (
    <div className="flex flex-col h-full gap-5 animate-fadeIn">
      {/* Timeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3">
          <Calendar className="text-[var(--primary)]" size={20} />
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)]">
              {currentProject.name} &bull; Roadmap & Release Timeline
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Gantt schedule tracking sprints, stories, critical bugs, and upcoming target releases.
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
              placeholder="Search roadmap..."
              className="pl-8 pr-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none w-48"
            />
          </div>
        </div>
      </div>

      {/* Timeline Visual Container */}
      <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs flex flex-col">
        {/* Release Milestones Strip */}
        <div className="p-3 bg-[var(--surface-hover)]/80 border-b border-[var(--border)] flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
            <Flag size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>Target Releases:</span>
          </div>

          {releases.map(r => (
            <div
              key={r.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] font-mono text-xs font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[var(--text-primary)]">{r.name}</span>
              <span className="text-[var(--text-muted)]">({r.targetDate})</span>
            </div>
          ))}
        </div>

        {/* Timeline Gantt Grid */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[1200px] flex flex-col">
            {/* Days Header */}
            <div className="flex border-b border-[var(--border)] bg-[var(--surface-hover)]/50 text-[11px] font-mono text-[var(--text-muted)] sticky top-0 z-10">
              <div className="w-80 p-2.5 font-bold font-sans text-[var(--text-secondary)] border-r border-[var(--border)] shrink-0">
                Work Item
              </div>
              <div className="flex flex-1">
                {timelineDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 min-w-[32px] p-2 text-center border-r border-[var(--border)]/40 ${
                      day.isToday ? 'bg-[var(--primary-light)] font-bold text-[var(--primary)]' : ''
                    }`}
                  >
                    {day.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Sprints Group */}
            {sprints.map(s => {
              const sprintIssues = filteredIssues.filter(i => i.sprintId === s.id);

              return (
                <div key={s.id} className="flex flex-col border-b border-[var(--border)]">
                  {/* Sprint Row */}
                  <div className="flex items-center bg-[var(--surface-hover)]/30 border-b border-[var(--border)]/60 text-xs font-bold text-[var(--text-primary)]">
                    <div className="w-80 p-2.5 flex items-center gap-2 border-r border-[var(--border)] shrink-0">
                      <Layers size={14} className="text-[var(--primary)]" />
                      <span>{s.name}</span>
                    </div>
                    <div className="flex-1 p-2 relative h-8 flex items-center">
                      <div className="h-4 bg-indigo-500/20 border border-indigo-500/40 rounded-full w-2/3 flex items-center px-3 text-[10px] text-indigo-700 dark:text-indigo-300 font-mono">
                        {s.goal || 'Sprint Iteration'}
                      </div>
                    </div>
                  </div>

                  {/* Issues under sprint */}
                  {sprintIssues.map(issue => {
                    const assignee = team.find(m => m.id === issue.assigneeId);
                    const isDone = issue.status === 'Done' || issue.status === 'QA Passed';

                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className="flex items-center hover:bg-[var(--surface-hover)] transition-all cursor-pointer text-xs border-b border-[var(--border)]/30 group"
                      >
                        <div className="w-80 p-2.5 flex items-center justify-between gap-2 border-r border-[var(--border)] shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {issue.issueType === 'Bug' ? (
                              <Bug size={13} className="text-rose-500 shrink-0" />
                            ) : (
                              <Bookmark size={13} className="text-emerald-500 shrink-0" />
                            )}
                            <span className="font-mono text-[11px] font-bold text-[var(--primary)] group-hover:underline shrink-0">
                              {issue.issueKey}
                            </span>
                            <span className="truncate font-medium text-[var(--text-primary)]">{issue.summary}</span>
                          </div>
                          {assignee && (
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                              style={{ backgroundColor: assignee.avatarColor || '#4f46e5' }}
                              title={assignee.name}
                            >
                              {assignee.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Gantt Bar */}
                        <div className="flex-1 p-1.5 relative h-9 flex items-center">
                          <div
                            className={`h-5 rounded-lg border flex items-center justify-between px-2.5 text-[10.5px] font-bold font-mono transition-all ${
                              isDone
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 w-3/4'
                                : issue.status === 'Blocked'
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300 w-1/2'
                                : 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300 w-3/5'
                            }`}
                          >
                            <span>{issue.status}</span>
                            <span>{issue.storyPoints || 3} pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
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
