import React, { useState, useMemo } from 'react';
import { 
  Task, 
  UserStory, 
  Defect, 
  TeamMember, 
  Release 
} from '../../types';
import { 
  BookOpen, 
  Bug, 
  CheckSquare, 
  CheckCircle2, 
  Search, 
  Filter, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  FolderGit2,
  Rocket,
  Flame,
  ExternalLink,
  Target,
  BarChart3,
  Layers,
  Sparkles
} from 'lucide-react';
import { StoryBugTaskTracker } from '../common/StoryBugTaskTracker';
import { getWorkItemAssignee } from '../../utils/assigneeUtils';
import { matchesReleaseOrIteration } from '../../utils/adoPaths';

interface StoryBugTaskTrackerViewProps {
  userStories: UserStory[];
  defects: Defect[];
  tasks: Task[];
  team: TeamMember[];
  releases: Release[];
  selectedReleaseId: string | null;
  currentDateStr?: string;
  onToggleTaskStatus: (taskId: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onUpdateTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onSelectRelease?: (releaseId: string | null) => void;
}

export const StoryBugTaskTrackerView: React.FC<StoryBugTaskTrackerViewProps> = ({
  userStories,
  defects,
  tasks,
  team,
  releases,
  selectedReleaseId,
  currentDateStr,
  onToggleTaskStatus,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSelectRelease
}) => {
  const [activeTypeTab, setActiveTypeTab] = useState<'all' | 'stories' | 'bugs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWithTasksOnly, setFilterWithTasksOnly] = useState(false);

  const selectedRelease = releases.find(r => r.id === selectedReleaseId);

  // Filter items according to selected release
  const filteredStories = useMemo(() => {
    return userStories.filter(s => {
      if (selectedReleaseId && !matchesReleaseOrIteration(s, selectedReleaseId, releases)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (s.title || '').toLowerCase().includes(q);
        const matchesAdo = s.adoId && String(s.adoId).includes(q);
        const matchesArea = (s.areaPath || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesAdo && !matchesArea) return false;
      }
      if (filterWithTasksOnly) {
        const hasTasks = tasks.some(t => t.userStoryId === s.id || (s.adoId && (t as any).parentId === s.adoId));
        if (!hasTasks) return false;
      }
      return true;
    });
  }, [userStories, selectedReleaseId, releases, searchQuery, filterWithTasksOnly, tasks]);

  const filteredDefects = useMemo(() => {
    return defects.filter(d => {
      if (selectedReleaseId && !matchesReleaseOrIteration(d, selectedReleaseId, releases)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (d.title || '').toLowerCase().includes(q);
        const matchesAdo = d.adoId && String(d.adoId).includes(q);
        const matchesArea = (d.areaPath || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesAdo && !matchesArea) return false;
      }
      if (filterWithTasksOnly) {
        const hasTasks = tasks.some(t => t.defectId === d.id || (d.adoId && (t as any).parentId === d.adoId));
        if (!hasTasks) return false;
      }
      return true;
    });
  }, [defects, selectedReleaseId, releases, searchQuery, filterWithTasksOnly, tasks]);

  // Overall Task Aggregation Metrics
  const totalLinkedStories = filteredStories.length;
  const totalLinkedDefects = filteredDefects.length;

  const totalTasksLinkedToStories = tasks.filter(t => t.userStoryId || (t as any).parentId && userStories.some(s => s.adoId === (t as any).parentId)).length;
  const totalClosedTasksLinkedToStories = tasks.filter(t => (t.userStoryId || (t as any).parentId && userStories.some(s => s.adoId === (t as any).parentId)) && t.status === 'complete').length;

  const totalTasksLinkedToBugs = tasks.filter(t => t.defectId || (t as any).parentId && defects.some(d => d.adoId === (t as any).parentId)).length;
  const totalClosedTasksLinkedToBugs = tasks.filter(t => (t.defectId || (t as any).parentId && defects.some(d => d.adoId === (t as any).parentId)) && t.status === 'complete').length;

  const grandTotalTasks = totalTasksLinkedToStories + totalTasksLinkedToBugs;
  const grandTotalClosed = totalClosedTasksLinkedToStories + totalClosedTasksLinkedToBugs;
  const grandTotalOpen = grandTotalTasks - grandTotalClosed;
  const overallRate = grandTotalTasks > 0 ? Math.round((grandTotalClosed / grandTotalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 w-full pb-12">
      
      {/* Top Banner & Global Task Progress Telemetry */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                <Target size={18} />
              </span>
              <h2 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
                User Story & Bug Task Tracker
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
              Real-time daily task completion, open vs closed task ratios, and inline task breakdown per deliverable
            </p>
          </div>

          {/* Aggregate Telemetry Strip */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] shadow-2xs">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                  Open Tasks
                </span>
                <span className="text-sm font-black text-amber-500 font-mono">
                  {grandTotalOpen}
                </span>
              </div>
              <div className="h-7 w-px bg-[var(--border)]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                  Closed Tasks
                </span>
                <span className="text-sm font-black text-emerald-500 font-mono">
                  {grandTotalClosed}
                </span>
              </div>
              <div className="h-7 w-px bg-[var(--border)]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                  Completion
                </span>
                <span className="text-sm font-black text-[var(--primary)] font-mono">
                  {overallRate}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          
          {/* Tabs: All / User Stories / Bugs */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setActiveTypeTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTypeTab === 'all'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Items ({filteredStories.length + filteredDefects.length})
            </button>
            <button
              onClick={() => setActiveTypeTab('stories')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTypeTab === 'stories'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen size={13} />
              <span>User Stories ({filteredStories.length})</span>
            </button>
            <button
              onClick={() => setActiveTypeTab('bugs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTypeTab === 'bugs'
                  ? 'bg-[var(--surface)] text-[var(--critical)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Bug size={13} />
              <span>Bugs & Defects ({filteredDefects.length})</span>
            </button>
          </div>

          {/* Search & Only With Tasks Filter */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md ml-auto">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by title, ADO #, or Area Path..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={filterWithTasksOnly}
                onChange={e => setFilterWithTasksOnly(e.target.checked)}
                className="rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
              />
              <span>With tasks only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="flex flex-col gap-4">
        
        {/* User Stories Section */}
        {(activeTypeTab === 'all' || activeTypeTab === 'stories') && filteredStories.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <BookOpen size={16} className="text-[var(--primary)]" />
              <h3 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                User Stories ({filteredStories.length})
              </h3>
            </div>

            {filteredStories.map(story => {
              const assignee = getWorkItemAssignee(story, team);
              return (
                <div 
                  key={story.id}
                  className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)]/30 rounded-2xl p-4.5 shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="p-1.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] shrink-0 mt-0.5">
                        <BookOpen size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {story.adoId && (
                            <span className="font-mono text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                              ADO #{story.adoId}
                            </span>
                          )}
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {story.status}
                          </span>
                          {story.areaPath && (
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border)] flex items-center gap-1">
                              <FolderGit2 size={10} />
                              {story.areaPath}
                            </span>
                          )}
                          {story.iterationPath && (
                            <span className="text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded border border-[var(--border)] flex items-center gap-1">
                              <Rocket size={10} />
                              {story.iterationPath}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {story.title}
                        </h4>
                      </div>
                    </div>

                    {assignee && (
                      <div className="flex items-center gap-1.5 shrink-0 bg-[var(--surface-hover)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                        <span
                          className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                        >
                          {assignee.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {assignee.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Interactive Embedded Task Tracker */}
                  <StoryBugTaskTracker
                    parentType="story"
                    parentId={story.id}
                    parentAdoId={story.adoId}
                    parentTitle={story.title}
                    tasks={tasks}
                    team={team}
                    currentDateStr={currentDateStr}
                    onToggleStatus={onToggleTaskStatus}
                    onAddTask={onAddTask}
                    onUpdateTask={onUpdateTask}
                    onDeleteTask={onDeleteTask}
                    defaultExpanded={true}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Bugs Section */}
        {(activeTypeTab === 'all' || activeTypeTab === 'bugs') && filteredDefects.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-2 px-1">
              <Bug size={16} className="text-[var(--critical)]" />
              <h3 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                Bugs & Defects ({filteredDefects.length})
              </h3>
            </div>

            {filteredDefects.map(defect => {
              const assignee = getWorkItemAssignee(defect, team);
              return (
                <div 
                  key={defect.id}
                  className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--critical)]/30 rounded-2xl p-4.5 shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="p-1.5 rounded-lg bg-[var(--critical-bg)] text-[var(--critical)] shrink-0 mt-0.5">
                        <Bug size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {defect.adoId && (
                            <span className="font-mono text-[11px] font-bold text-[var(--critical)] bg-[var(--critical-bg)] px-2 py-0.5 rounded-md border border-[var(--critical-border)]">
                              ADO #{defect.adoId}
                            </span>
                          )}
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            defect.status === 'Closed' ? 'bg-[var(--low-bg)] text-[var(--low)] border-[var(--low-border)]' : 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)]'
                          }`}>
                            {defect.status}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {defect.severity}
                          </span>
                          {defect.areaPath && (
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border)] flex items-center gap-1">
                              <FolderGit2 size={10} />
                              {defect.areaPath}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {defect.title}
                        </h4>
                      </div>
                    </div>

                    {assignee && (
                      <div className="flex items-center gap-1.5 shrink-0 bg-[var(--surface-hover)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                        <span
                          className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                        >
                          {assignee.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {assignee.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Interactive Embedded Task Tracker */}
                  <StoryBugTaskTracker
                    parentType="bug"
                    parentId={defect.id}
                    parentAdoId={defect.adoId}
                    parentTitle={defect.title}
                    tasks={tasks}
                    team={team}
                    currentDateStr={currentDateStr}
                    onToggleStatus={onToggleTaskStatus}
                    onAddTask={onAddTask}
                    onUpdateTask={onUpdateTask}
                    onDeleteTask={onDeleteTask}
                    defaultExpanded={true}
                  />
                </div>
              );
            })}
          </div>
        )}

        {filteredStories.length === 0 && filteredDefects.length === 0 && (
          <div className="text-center py-12 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
            <CheckSquare size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
            <h4 className="text-sm font-bold text-[var(--text-primary)]">No User Stories or Bugs Found</h4>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              No work items match the current filters. Clear the search or sync items from Azure DevOps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
