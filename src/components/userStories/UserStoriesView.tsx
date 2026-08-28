import React, { useState, useMemo } from 'react';
import { 
  UserStory, 
  UserStoryStatus, 
  Release, 
  TeamMember, 
  TeamGroup, 
  Task, 
  Defect 
} from '../../types';
import { 
  Plus, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  ListChecks, 
  Edit3, 
  Trash2, 
  Filter, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  FolderGit2,
  Tag,
  Users,
  Search,
  Rocket,
  X,
  MessageSquare,
  Activity,
  CheckCheck
} from 'lucide-react';
import { getWorkItemAssignee, matchesAssigneeFilter } from '../../utils/assigneeUtils';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber, matchesReleaseOrIteration, formatReleaseDisplayName } from '../../utils/adoPaths';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';
import { FilterBar, FilterDropdownConfig } from '../common/FilterBar';
import { useWorkItemFilters } from '../../utils/useWorkItemFilters';
import { isTestCaseItem, filterPureUserStories } from '../../utils/itemClassification';
import { HighlightText } from '../common/HighlightText';
import { StoryBugTaskTracker } from '../common/StoryBugTaskTracker';
import { assessStoryTestStatus, getLatestCommentText } from '../../utils/executionCommentParser';

interface UserStoriesViewProps {
  userStories: UserStory[];
  releases: Release[];
  team: TeamMember[];
  groups: TeamGroup[];
  tasks: Task[];
  defects: Defect[];
  selectedReleaseId: string | null;
  currentDateStr?: string;
  onSelectRelease?: (releaseId: string | null) => void;
  onAddStory: (story: UserStory) => void;
  onUpdateStory: (story: UserStory) => void;
  onDeleteStory: (storyId: string) => void;
  onAddTask?: (task: Partial<Task>) => void;
  onUpdateTask?: (task: Task) => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

const STATUS_OPTIONS: UserStoryStatus[] = [
  'To Do',
  'In Analysis',
  'Dev In Progress',
  'QA Ready',
  'QA In Progress',
  'QA Passed',
  'Done',
  'Blocked'
];

export const UserStoriesView: React.FC<UserStoriesViewProps> = ({
  userStories,
  releases,
  team,
  groups,
  tasks,
  defects,
  selectedReleaseId,
  currentDateStr,
  onSelectRelease,
  onAddStory,
  onUpdateStory,
  onDeleteStory,
  onAddTask,
  onUpdateTask,
  onToggleTaskStatus,
  onDeleteTask
}) => {
  // Pure genuine User Stories only — strictly filter out any Test Cases, Test Plans, or Test Suites
  const pureStories = useMemo(() => {
    return filterPureUserStories(userStories);
  }, [userStories]);

  const {
    search,
    setSearch,
    filterRelease,
    handleReleaseChange,
    filterAssignee,
    setFilterAssignee,
    filterStatus,
    setFilterStatus,
    activeFiltersCount,
    handleClearFilters
  } = useWorkItemFilters({
    selectedReleaseId,
    onSelectRelease
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  // Form state for new / edit story
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<UserStoryStatus>('To Do');
  const [storyPoints, setStoryPoints] = useState<number>(5);
  const [areaPath, setAreaPath] = useState<string>('ACM');
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [iterationPath, setIterationPath] = useState<string>('');
  const [criteriaText, setCriteriaText] = useState<string>('');

  // Core Requirement: Iterations for ACM
  const returnedIterationPaths = getIterationPathsForArea('ACM', releases, pureStories, defects);

  // Modal's returned Iteration Paths for ACM
  const modalReturnedIterations = getIterationPathsForArea('ACM', releases, pureStories, defects);

  const openAddModal = () => {
    setEditingStory(null);
    setTitle('');
    setDescription('');
    setStatus('To Do');
    setStoryPoints(5);
    const defaultArea = 'ACM';
    setAreaPath(defaultArea);
    const iters = getIterationPathsForArea(defaultArea, releases, pureStories, defects);
    const firstIter = iters[0];
    setReleaseId(firstIter ? firstIter.releaseId : (selectedReleaseId || releases[0]?.id || ''));
    setIterationPath(firstIter ? firstIter.iterationPath : (releases[0]?.iterationPath || ''));
    setAssigneeId('');
    setCriteriaText('');
    setModalOpen(true);
  };

  const openEditModal = (story: UserStory) => {
    setEditingStory(story);
    setTitle(story.title);
    setDescription(story.description || '');
    setStatus(story.status);
    setStoryPoints(story.storyPoints || 0);
    const storyArea = story.areaPath || releases.find(r => r.id === story.releaseId)?.areaPath || 'ACM';
    setAreaPath(storyArea);
    setReleaseId(story.releaseId || '');
    setAssigneeId(story.assigneeId || '');
    setIterationPath(story.iterationPath || '');
    setCriteriaText((story.acceptanceCriteria || []).join('\n'));
    setModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const criteriaList = criteriaText
      .split('\n')
      .map(c => c.trim())
      .filter(Boolean);

    const now = toDateStr(new Date());

    if (editingStory) {
      onUpdateStory({
        ...editingStory,
        title: title.trim(),
        description: description.trim(),
        status,
        storyPoints: Number(storyPoints) || 0,
        areaPath: 'ACM',
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        iterationPath: iterationPath.trim(),
        acceptanceCriteria: criteriaList,
        updatedAt: now
      });
    } else {
      onAddStory({
        id: generateId('us'),
        title: title.trim(),
        description: description.trim(),
        status,
        storyPoints: Number(storyPoints) || 0,
        areaPath: 'ACM',
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        iterationPath: iterationPath.trim(),
        acceptanceCriteria: criteriaList,
        createdAt: now,
        updatedAt: now
      });
    }

    setModalOpen(false);
  };

  const toggleCriteria = (id: string) => {
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter stories based on Iteration Path, Assignee, Status, and search query
  const filteredStories = useMemo(() => {
    return pureStories.filter(s => {
      // Assignee Filter
      if (filterAssignee) {
        if (!matchesAssigneeFilter(s, filterAssignee, team)) return false;
      }

      // Iteration / Release Filter
      if (filterRelease && filterRelease !== 'all') {
        if (!matchesReleaseOrIteration(s, filterRelease, releases)) return false;
      }

      // Status Filter
      if (filterStatus && s.status !== filterStatus) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchDesc = (s.description || '').toLowerCase().includes(q);
        const matchAdo = s.adoId ? String(s.adoId).includes(q) : false;
        const matchArea = (s.areaPath || '').toLowerCase().includes(q);
        const matchIter = (s.iterationPath || '').toLowerCase().includes(q);
        const resolved = getWorkItemAssignee(s, team);
        const matchAssignee = resolved ? (resolved.name.toLowerCase().includes(q) || (resolved.email && resolved.email.toLowerCase().includes(q))) : false;
        if (!matchTitle && !matchDesc && !matchAdo && !matchArea && !matchIter && !matchAssignee) return false;
      }

      return true;
    });
  }, [pureStories, releases, filterAssignee, filterRelease, filterStatus, search, team]);

  // Options for Searchable Iteration / Release
  const iterationOptions: SelectOption[] = useMemo(() => {
    return returnedIterationPaths.map(iter => {
      const count = pureStories.filter(s => s.releaseId === iter.releaseId || s.iterationPath === iter.iterationPath).length;
      return {
        value: iter.releaseId || iter.iterationPath,
        label: formatReleaseDisplayName(iter.releaseName, iter.releaseNumber),
        sublabel: iter.iterationPath !== iter.releaseName ? iter.iterationPath : undefined,
        badge: `${count} stories`,
        icon: <Rocket size={13} className="text-[var(--primary)]" />
      };
    });
  }, [returnedIterationPaths, pureStories]);

  // Options for Searchable Assignee Filter
  const assigneeOptions: SelectOption[] = useMemo(() => {
    const unassignedCount = pureStories.filter(s => !getWorkItemAssignee(s, team)).length;
    const list: SelectOption[] = [
      {
        value: 'unassigned',
        label: 'Unassigned Stories',
        badge: `${unassignedCount}`,
        icon: <Users size={13} className="text-[var(--text-muted)]" />
      }
    ];

    team.forEach(m => {
      const count = pureStories.filter(s => matchesAssigneeFilter(s, m.id, team)).length;
      list.push({
        value: m.id,
        label: m.name,
        sublabel: m.role,
        badge: `${count} stories`,
        avatarColor: m.avatarColor || 'var(--primary)',
        avatarInitials: m.name.split(' ').map(n => n[0]).join('').slice(0, 2)
      });
    });

    return list;
  }, [team, pureStories]);

  // Options for Status Filter
  const statusOptions: SelectOption[] = useMemo(() => {
    return STATUS_OPTIONS.map(st => {
      const count = pureStories.filter(s => s.status === st).length;
      return {
        value: st,
        label: st,
        badge: `${count}`
      };
    });
  }, [pureStories]);

  // Modal Assignee Options
  const modalAssigneeOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: 'Unassigned', icon: <Users size={13} className="text-[var(--text-muted)]" /> },
      ...team.map(m => ({
        value: m.id,
        label: m.name,
        sublabel: m.role,
        avatarColor: m.avatarColor || 'var(--primary)',
        avatarInitials: m.name.split(' ').map(n => n[0]).join('').slice(0, 2)
      }))
    ];
  }, [team]);

  // Modal Release Options
  const modalReleaseOptions: SelectOption[] = useMemo(() => {
    const source = modalReturnedIterations.length > 0 ? modalReturnedIterations : releases.map(r => ({
      releaseId: r.id,
      releaseName: r.name,
      releaseNumber: r.releaseNumber || 'v1.0.0',
      iterationPath: r.iterationPath || r.name
    }));

    return [
      { value: '', label: 'No Release' },
      ...source.map(iter => ({
        value: iter.releaseId,
        label: formatReleaseDisplayName(iter.releaseName, iter.releaseNumber),
        sublabel: iter.iterationPath !== iter.releaseName ? iter.iterationPath : undefined
      }))
    ];
  }, [modalReturnedIterations, releases]);

  // Calculate metrics
  const totalPoints = filteredStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  const passedStories = filteredStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
  const blockedStories = filteredStories.filter(s => s.status === 'Blocked').length;

  const filterConfigs: FilterDropdownConfig[] = useMemo(() => [
    {
      id: 'assignee',
      label: 'Assignee',
      placeholder: 'All Assignees',
      allOptionLabel: 'All Assignees',
      icon: <Users size={14} />,
      options: assigneeOptions,
      value: filterAssignee,
      onChange: setFilterAssignee,
      minWidth: '170px'
    },
    {
      id: 'status',
      label: 'Status',
      placeholder: 'All Statuses',
      allOptionLabel: 'All Statuses',
      options: statusOptions,
      value: filterStatus,
      onChange: setFilterStatus,
      minWidth: '140px'
    }
  ], [
    assigneeOptions,
    filterAssignee,
    setFilterAssignee,
    statusOptions,
    filterStatus,
    setFilterStatus
  ]);

  const getStatusBadgeClass = (st: UserStoryStatus) => {
    switch (st) {
      case 'QA Passed':
      case 'Done':
        return 'bg-[var(--low-bg)] text-[var(--low)] border-[var(--low-border)]';
      case 'QA Ready':
      case 'QA In Progress':
        return 'bg-[#F4EBFF] text-[#7C3AED] border-[#E9D7FE]';
      case 'Dev In Progress':
      case 'In Analysis':
        return 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--border)]';
      case 'Blocked':
        return 'bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical-border)]';
      default:
        return 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)]';
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner & Metrics */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">User Stories & Dev Backlog</h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              Internal ADO deliverables, Area Path mapping, Sprint Iterations, and QA sign-offs
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-1.5 rounded-xl text-xs font-bold">
              <span className="text-[var(--text-muted)]">Total Points:</span>
              <span className="text-[var(--primary)]">{totalPoints} pts</span>
            </div>
            <div className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-1.5 rounded-xl text-xs font-bold">
              <span className="text-[var(--text-muted)]">QA Passed:</span>
              <span className="text-[var(--primary)]">{passedStories}/{filteredStories.length}</span>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <Plus size={15} />
              <span>New Story</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar - Standardized Reusable FilterBar */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <FilterBar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search stories, Area Path, Iteration Path, or ADO #...'
            }}
            filters={filterConfigs}
            onReset={handleClearFilters}
            activeFiltersCount={activeFiltersCount}
          />
        </div>
      </div>

      {/* Stories List */}
      <div className="flex flex-col gap-3.5">
        {filteredStories.length > 0 ? (
          filteredStories.map(story => {
            const release = releases.find(r => r.id === story.releaseId);
            const assignee = getWorkItemAssignee(story, team);
            const isCriteriaExpanded = expandedCriteria.has(story.id);
            const isPassed = story.status === 'QA Passed' || story.status === 'Done';
            const isBlocked = story.status === 'Blocked';

            return (
              <div
                key={story.id}
                className={`bg-[var(--surface)] border rounded-2xl p-5 shadow-xs transition-all hover:border-[var(--primary)]/30 ${
                  isBlocked
                    ? 'border-[var(--critical)]/40 bg-[var(--critical-bg)]/20'
                    : isPassed
                    ? 'border-[var(--border)]'
                    : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="mt-0.5 p-1.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg">
                      <BookOpen size={16} />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {story.adoId && (
                          <span className="font-mono text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md border border-[var(--border)] flex items-center gap-1">
                            ADO #{story.adoId}
                            {story.adoUrl && (
                              <a
                                href={story.adoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--text-muted)] hover:text-[var(--primary)]"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </span>
                        )}

                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(
                            story.status
                          )}`}
                        >
                          {story.status}
                        </span>

                        {story.storyPoints !== undefined && (
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-md">
                            {story.storyPoints} pts
                          </span>
                        )}

                        {story.areaPath && (
                          <span className="text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FolderGit2 size={11} className="text-[var(--primary)]" />
                            {story.areaPath}
                          </span>
                        )}

                        {(story.iterationPath || release?.name) && (
                          <span className="text-[11px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Rocket size={11} />
                            {story.iterationPath || release?.name}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                        <HighlightText text={story.title} query={search} />
                      </h3>

                      {story.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                          <HighlightText text={story.description} query={search} />
                        </p>
                      )}

                      {/* Acceptance Criteria Expandable */}
                      {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleCriteria(story.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            <ListChecks size={14} />
                            <span>Acceptance Criteria ({story.acceptanceCriteria.length})</span>
                            {isCriteriaExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isCriteriaExpanded && (
                            <div className="mt-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-1.5 text-xs text-[var(--text-primary)]">
                              {story.acceptanceCriteria.map((c, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <CheckCircle2 size={13} className="text-[var(--low)] mt-0.5 flex-shrink-0" />
                                  <span className="flex-1">
                                    <HighlightText text={c} query={search} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Assignee & Meta Bar */}
                      <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                        {assignee ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                            >
                              {assignee.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-semibold text-[var(--text-primary)]">{assignee.name}</span>
                            <span className="text-[10px]">({assignee.role})</span>
                          </div>
                        ) : (
                          <span className="italic">Unassigned</span>
                        )}

                        {story.createdByName && (
                          <div className="flex items-center gap-1">
                            <span>Created by:</span>
                            <span className="font-semibold text-[var(--text-secondary)]">{story.createdByName}</span>
                          </div>
                        )}

                        <span className="ml-auto">Updated {story.updatedAt}</span>
                      </div>

                      {/* Assessed Test Execution Status from Latest Comment / Tasks */}
                      {(() => {
                        const assessed = assessStoryTestStatus(story, tasks);
                        const hasMetrics = assessed.metrics.totalTestCases > 0 || assessed.metrics.completedTestCases > 0 || assessed.metrics.openDefects > 0;
                        const hasComment = Boolean(assessed.latestCommentText);

                        if (!hasMetrics && !hasComment && !assessed.statusLabel) return null;

                        return (
                          <div className={`mt-3 p-2.5 rounded-xl border flex flex-col gap-2 ${
                            assessed.statusLabel === 'Blocked'
                              ? 'bg-red-500/5 border-red-500/30'
                              : assessed.statusLabel === 'Not Applicable'
                              ? 'bg-slate-500/5 border-slate-500/30'
                              : 'bg-[var(--surface-hover)] border-[var(--primary)]/20'
                          }`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
                                <Activity size={13} />
                                <span>Test Execution Assessment:</span>
                                {assessed.statusLabel && (
                                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                                    assessed.statusLabel === 'Blocked'
                                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                                      : assessed.statusLabel === 'Not Applicable'
                                      ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                                      : assessed.statusLabel === 'Passed'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                  }`}>
                                    {assessed.statusLabel}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px] font-bold">
                                {assessed.statusLabel === 'Not Applicable' ? (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 font-sans italic text-[10.5px]">
                                    N/A (No QA Needed)
                                  </span>
                                ) : (
                                  <>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                      Total: {assessed.metrics.totalTestCases}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      Completed: {assessed.metrics.completedTestCases}
                                    </span>
                                    {assessed.metrics.blockedTestCases > 0 && (
                                      <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                        Blocked: {assessed.metrics.blockedTestCases}
                                      </span>
                                    )}
                                    {assessed.metrics.failedTestCases > 0 && (
                                      <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                        Failed: {assessed.metrics.failedTestCases}
                                      </span>
                                    )}
                                    {assessed.metrics.openDefects > 0 && (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        Defects: {assessed.metrics.openDefects}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {assessed.latestCommentText && (
                              <div className={`text-[11.5px] px-2.5 py-1.5 rounded-lg border leading-relaxed ${
                                assessed.statusLabel === 'Blocked'
                                  ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                                  : assessed.statusLabel === 'Not Applicable'
                                  ? 'bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-300'
                                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)]'
                              }`}>
                                <span className="font-semibold not-italic">Latest Execution Note: </span>
                                <em>"{assessed.latestCommentText}"</em>
                              </div>
                            )}
                          </div>
                        );
                      })()}

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
                        defaultExpanded={false}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[var(--text-muted)] flex-shrink-0">
                    <button
                      onClick={() => openEditModal(story)}
                      className="p-1.5 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-all"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteStory(story.id)}
                      className="p-1.5 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg cursor-pointer transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <BookOpen size={36} className="mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">No user stories found</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              Get started by creating a new deliverable or sync stories from Internal Azure DevOps.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Create User Story</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal with Modern Searchable Selects */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editingStory ? 'Edit User Story' : 'New User Story'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Story Title <span className="text-[var(--critical)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Provider Clinical Schedule - Real-time Slot Availability"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  autoFocus
                />
              </div>

              {/* AREA PATH FIELD */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                  <span>Area Path</span>
                  <span className="text-[10px] text-[var(--primary)] font-semibold">Fixed ADO Project</span>
                </label>
                <div className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-mono font-bold flex items-center gap-1.5">
                  <FolderGit2 size={13} className="text-[var(--primary)]" />
                  <span>ACM</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Status</label>
                  <SearchableSelect
                    options={STATUS_OPTIONS.map(st => ({ value: st, label: st }))}
                    value={status}
                    onChange={(val) => setStatus(val as UserStoryStatus)}
                    placeholder="Select Status"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Story Points</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(Number(e.target.value))}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* RELEASE / ITERATION SELECTOR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Release / Iteration (ACM)
                  </label>
                  <SearchableSelect
                    options={modalReleaseOptions}
                    value={releaseId}
                    onChange={(selectedId) => {
                      setReleaseId(selectedId);
                      const matchedIter = modalReturnedIterations.find(i => i.releaseId === selectedId) || releases.find(r => r.id === selectedId);
                      if (matchedIter) {
                        setIterationPath(matchedIter.iterationPath || '');
                      }
                    }}
                    placeholder="Select Release"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Assignee</label>
                  <SearchableSelect
                    options={modalAssigneeOptions}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="Select Assignee"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  ADO Iteration Path (Release Name / Number)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ACM\D5 R 2026.09"
                  value={iterationPath}
                  onChange={(e) => setIterationPath(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none font-mono text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">User Story Description</label>
                <textarea
                  rows={3}
                  placeholder="As a [user role], I want to [goal] so that [business value]..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Acceptance Criteria (One per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="1. Real-time slot update pushes within 250ms&#10;2. Fallback to polling on disconnect&#10;3. Handles timezone offsets"
                  value={criteriaText}
                  onChange={(e) => setCriteriaText(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none font-mono text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
                >
                  {editingStory ? 'Update Story' : 'Create Story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
