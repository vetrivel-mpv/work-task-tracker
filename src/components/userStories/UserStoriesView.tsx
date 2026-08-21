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
  X
} from 'lucide-react';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber } from '../../utils/adoPaths';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';

interface UserStoriesViewProps {
  userStories: UserStory[];
  releases: Release[];
  team: TeamMember[];
  groups: TeamGroup[];
  tasks: Task[];
  defects: Defect[];
  selectedReleaseId: string | null;
  onAddStory: (story: UserStory) => void;
  onUpdateStory: (story: UserStory) => void;
  onDeleteStory: (storyId: string) => void;
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
  onAddStory,
  onUpdateStory,
  onDeleteStory
}) => {
  const [filterAreaPath, setFilterAreaPath] = useState<string>('');
  const [filterRelease, setFilterRelease] = useState<string>(selectedReleaseId || '');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  // Discover all distinct Area Paths in the project
  const availableAreaPaths = getAllAreaPaths(releases, userStories, defects, tasks);

  // Form state for new / edit story
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<UserStoryStatus>('To Do');
  const [storyPoints, setStoryPoints] = useState<number>(5);
  const [areaPath, setAreaPath] = useState<string>(filterAreaPath || availableAreaPaths[0] || '');
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [iterationPath, setIterationPath] = useState<string>('');
  const [criteriaText, setCriteriaText] = useState<string>('');

  // Keep filter release in sync if user changes global selected release
  React.useEffect(() => {
    if (selectedReleaseId !== undefined) {
      setFilterRelease(selectedReleaseId || '');
    }
  }, [selectedReleaseId]);

  // Core Requirement: Based on the Area Path filter, all matching Iteration Paths are returned
  const returnedIterationPaths = getIterationPathsForArea(filterAreaPath, releases, userStories, defects);

  // Modal's returned Iteration Paths based on the modal's selected Area Path
  const modalReturnedIterations = getIterationPathsForArea(areaPath, releases, userStories, defects);

  const openAddModal = () => {
    setEditingStory(null);
    setTitle('');
    setDescription('');
    setStatus('To Do');
    setStoryPoints(5);
    const defaultArea = filterAreaPath || availableAreaPaths[0] || '';
    setAreaPath(defaultArea);
    const iters = getIterationPathsForArea(defaultArea, releases, userStories, defects);
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
    const storyArea = story.areaPath || releases.find(r => r.id === story.releaseId)?.areaPath || filterAreaPath || availableAreaPaths[0] || '';
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
        areaPath: areaPath.trim(),
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
        areaPath: areaPath.trim(),
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

  // Filter stories based on Area Path, Iteration Path, Assignee, Status, and exclude Test Cases
  const filteredStories = useMemo(() => {
    return userStories.filter(s => {
      // Exclude Test Cases mapped mistakenly as User Story
      const titleLower = (s.title || '').toLowerCase();
      const isTestCase = titleLower.startsWith('[test case]') || 
                         titleLower.startsWith('test case:') || 
                         (s as any).workItemType === 'Test Case' ||
                         (s as any).workItemType === 'Test Plan' ||
                         (s as any).workItemType === 'Test Suite';
      if (isTestCase) return false;

      // Assignee Filter
      if (filterAssignee) {
        if (filterAssignee === 'unassigned') {
          if (s.assigneeId) return false;
        } else if (s.assigneeId !== filterAssignee) {
          return false;
        }
      }

      // Area Path Filter
      if (filterAreaPath) {
        const sArea = (s.areaPath || releases.find(r => r.id === s.releaseId)?.areaPath || '').toLowerCase();
        const targetArea = filterAreaPath.toLowerCase();
        const matchesAreaDirectly = sArea === targetArea || sArea.includes(targetArea) || targetArea.includes(sArea);
        const matchesReturnedIteration = returnedIterationPaths.some(
          iter => iter.releaseId === s.releaseId || iter.iterationPath === s.iterationPath
        );
        if (!matchesAreaDirectly && !matchesReturnedIteration) return false;
      }

      // Iteration / Release Filter
      if (filterRelease) {
        const matchesRelId = s.releaseId === filterRelease;
        const matchesIterPath = s.iterationPath === filterRelease;
        const matchedRelease = releases.find(r => r.id === filterRelease);
        const matchesReleaseIteration = matchedRelease && (
          matchedRelease.iterationPath === s.iterationPath ||
          matchedRelease.name === s.iterationPath ||
          (s.iterationPath && matchedRelease.name.includes(s.iterationPath))
        );
        if (!matchesRelId && !matchesIterPath && !matchesReleaseIteration) return false;
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
        const memberName = s.assigneeId ? (team.find(t => t.id === s.assigneeId)?.name || '') : '';
        const matchAssignee = memberName ? memberName.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchDesc && !matchAdo && !matchArea && !matchIter && !matchAssignee) return false;
      }

      return true;
    });
  }, [userStories, releases, returnedIterationPaths, filterAssignee, filterAreaPath, filterRelease, filterStatus, search]);

  // Options for Searchable Area Path
  const areaOptions: SelectOption[] = useMemo(() => {
    return availableAreaPaths.map(area => {
      const count = userStories.filter(s => (s.areaPath || '').toLowerCase() === area.toLowerCase()).length;
      return {
        value: area,
        label: area,
        badge: `${count} stories`,
        icon: <FolderGit2 size={13} className="text-[var(--primary)]" />
      };
    });
  }, [availableAreaPaths, userStories]);

  // Options for Searchable Iteration / Release
  const iterationOptions: SelectOption[] = useMemo(() => {
    return returnedIterationPaths.map(iter => {
      const count = userStories.filter(s => s.releaseId === iter.releaseId || s.iterationPath === iter.iterationPath).length;
      return {
        value: iter.releaseId || iter.iterationPath,
        label: `${iter.releaseName} (${iter.releaseNumber || 'v1.0.0'})`,
        sublabel: iter.iterationPath,
        badge: `${count} stories`,
        icon: <Rocket size={13} className="text-[var(--primary)]" />
      };
    });
  }, [returnedIterationPaths, userStories]);

  // Options for Searchable Assignee Filter
  const assigneeOptions: SelectOption[] = useMemo(() => {
    const unassignedCount = userStories.filter(s => !s.assigneeId).length;
    const list: SelectOption[] = [
      {
        value: 'unassigned',
        label: 'Unassigned Stories',
        badge: `${unassignedCount}`,
        icon: <Users size={13} className="text-[var(--text-muted)]" />
      }
    ];

    team.forEach(m => {
      const count = userStories.filter(s => s.assigneeId === m.id).length;
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
  }, [team, userStories]);

  // Options for Status Filter
  const statusOptions: SelectOption[] = useMemo(() => {
    return STATUS_OPTIONS.map(st => {
      const count = userStories.filter(s => s.status === st).length;
      return {
        value: st,
        label: st,
        badge: `${count}`
      };
    });
  }, [userStories]);

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
        label: `${iter.releaseName} (${iter.releaseNumber || 'v1.0.0'})`,
        sublabel: iter.iterationPath
      }))
    ];
  }, [modalReturnedIterations, releases]);

  // Calculate metrics
  const totalPoints = filteredStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  const passedStories = filteredStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
  const blockedStories = filteredStories.filter(s => s.status === 'Blocked').length;
  const activeFiltersCount = (filterAreaPath ? 1 : 0) + (filterRelease ? 1 : 0) + (filterAssignee ? 1 : 0) + (filterStatus ? 1 : 0) + (search ? 1 : 0);

  const handleClearFilters = () => {
    setFilterAreaPath('');
    setFilterRelease('');
    setFilterAssignee('');
    setFilterStatus('');
    setSearch('');
  };

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

        {/* Filter Controls Bar - Searchable Dropdowns with Latest UI */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          {/* Quick Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search stories, Area Path, Iteration Path, or ADO #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text-primary)] outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] transition-all"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* SEARCHABLE ASSIGNEE FILTER */}
          <div className="min-w-[180px]">
            <SearchableSelect
              options={assigneeOptions}
              value={filterAssignee}
              onChange={setFilterAssignee}
              placeholder="All Assignees"
              label="Assignee"
              icon={<Users size={14} />}
            />
          </div>

          {/* SEARCHABLE AREA PATH FILTER */}
          <div className="min-w-[180px]">
            <SearchableSelect
              options={areaOptions}
              value={filterAreaPath}
              onChange={(val) => {
                setFilterAreaPath(val);
                setFilterRelease(''); // reset iteration filter when area changes
              }}
              placeholder="All Area Paths"
              label="Area Path"
              icon={<FolderGit2 size={14} />}
            />
          </div>

          {/* SEARCHABLE ITERATION PATH FILTER */}
          <div className="min-w-[190px]">
            <SearchableSelect
              options={iterationOptions}
              value={filterRelease}
              onChange={setFilterRelease}
              placeholder={filterAreaPath ? `Iterations in Area (${returnedIterationPaths.length})` : 'All Iteration Paths'}
              label="Iteration"
              icon={<Rocket size={14} />}
            />
          </div>

          {/* SEARCHABLE STATUS FILTER */}
          <div className="min-w-[150px]">
            <SearchableSelect
              options={statusOptions}
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="All Statuses"
              label="Status"
            />
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
              title="Reset all filters"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Informative Area Path returned Iterations bar when filter is active */}
        {filterAreaPath && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
            <span className="font-bold text-[var(--primary)] flex items-center gap-1">
              <FolderGit2 size={13} />
              Iterations returned for "{filterAreaPath}":
            </span>
            {returnedIterationPaths.length === 0 ? (
              <span className="italic text-[var(--text-muted)]">No iterations found for this area</span>
            ) : (
              returnedIterationPaths.map(iter => (
                <button
                  key={iter.iterationPath + iter.releaseId}
                  onClick={() => setFilterRelease(filterRelease === (iter.releaseId || iter.iterationPath) ? '' : (iter.releaseId || iter.iterationPath))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    filterRelease === (iter.releaseId || iter.iterationPath)
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                      : 'bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  {iter.releaseName} <span className="font-mono text-[10px] opacity-80">[{iter.releaseNumber}]</span>
                </button>
              ))
            )}
            {filterRelease && (
              <button
                onClick={() => setFilterRelease('')}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer ml-auto"
              >
                Clear Iteration Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stories List */}
      <div className="flex flex-col gap-3.5">
        {filteredStories.length > 0 ? (
          filteredStories.map(story => {
            const release = releases.find(r => r.id === story.releaseId);
            const assignee = team.find(m => m.id === story.assigneeId);
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
                        {story.title}
                      </h3>

                      {story.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                          {story.description}
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
                                  <span>{c}</span>
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
              {filterAreaPath 
                ? `No stories found under Area Path "${filterAreaPath}". Try switching Area or creating a story in this Area.`
                : 'Get started by creating a new deliverable or sync stories from Internal Azure DevOps.'}
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
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Area Path (Internal ADO Module)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CareFlow-Core\EHR-Connect"
                  value={areaPath}
                  onChange={(e) => {
                    const newArea = e.target.value;
                    setAreaPath(newArea);
                    const iters = getIterationPathsForArea(newArea, releases, userStories, defects);
                    if (iters[0]) {
                      setReleaseId(iters[0].releaseId);
                      setIterationPath(iters[0].iterationPath);
                    }
                  }}
                  className="w-full text-xs font-medium px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {availableAreaPaths.map(area => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => {
                        setAreaPath(area);
                        const iters = getIterationPathsForArea(area, releases, userStories, defects);
                        if (iters[0]) {
                          setReleaseId(iters[0].releaseId);
                          setIterationPath(iters[0].iterationPath);
                        }
                      }}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        areaPath === area 
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]' 
                          : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]/40'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
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

              {/* DYNAMIC ITERATION PATH / RELEASE SELECTOR BASED ON AREA PATH */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Release & Iteration Path
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
                  placeholder="e.g. CareFlow-Core\Sprint 24"
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
