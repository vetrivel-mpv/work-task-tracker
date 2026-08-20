import React, { useState } from 'react';
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
  Tag
} from 'lucide-react';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber } from '../../utils/adoPaths';

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

  // Filter stories based on Area Path and Iteration Path
  const filteredStories = userStories.filter(s => {
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
      return matchTitle || matchDesc || matchAdo || matchArea || matchIter;
    }
    return true;
  });

  // Metrics
  const totalPoints = filteredStories.reduce((acc, s) => acc + (s.storyPoints || 0), 0);
  const passedStories = filteredStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;

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

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search stories, Area Path, Iteration Path, or ADO #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)]"
            />
          </div>

          {/* AREA PATH FILTER */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]">Area:</span>
            <select
              value={filterAreaPath}
              onChange={(e) => {
                setFilterAreaPath(e.target.value);
                setFilterRelease(''); // reset iteration filter when area changes
              }}
              className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="">All Area Paths</option>
              {availableAreaPaths.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* ITERATION PATH FILTER (DYNAMICALLY RETURNED BASED ON AREA PATH) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]">Iteration:</span>
            <select
              value={filterRelease}
              onChange={(e) => setFilterRelease(e.target.value)}
              className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer max-w-[260px]"
            >
              <option value="">
                {filterAreaPath 
                  ? `All Iterations in Area (${returnedIterationPaths.length} returned)`
                  : 'All Iteration Paths (Releases)'}
              </option>
              {returnedIterationPaths.map(iter => (
                <option key={iter.iterationPath + iter.releaseId} value={iter.releaseId || iter.iterationPath}>
                  {iter.releaseName} ({iter.releaseNumber})
                </option>
              ))}
            </select>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
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
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                    filterRelease === (iter.releaseId || iter.iterationPath)
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  {iter.releaseName} <span className="font-mono text-[10px]">[{iter.releaseNumber}]</span>
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
            const assignee = team.find(m => m.id === story.assigneeId);
            const rel = releases.find(r => r.id === story.releaseId);
            const storyArea = story.areaPath || rel?.areaPath || 'CareFlow-Core\\EHR-Connect';
            const storyIter = story.iterationPath || rel?.iterationPath || 'CareFlow-Core\\Sprint 24';
            const storyRelNum = rel?.releaseNumber || extractReleaseNumber(rel?.name || storyIter);
            const linkedTasks = tasks.filter(t => t.userStoryId === story.id);
            const linkedDefects = defects.filter(d => d.userStoryId === story.id);
            const openDefects = linkedDefects.filter(d => d.status !== 'Closed');
            const isCriteriaExpanded = expandedCriteria.has(story.id);

            return (
              <div
                key={story.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4.5 hover:border-[var(--primary)] transition-all shadow-xs"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      <BookOpen size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--internal-ado)] bg-[var(--internal-ado-bg)] px-2 py-0.5 rounded-md border border-[var(--internal-ado)]/20">
                          <Building2 size={10} />
                          <span>Internal ADO</span>
                        </span>

                        {/* Area Path Badge */}
                        <span className="text-[10.5px] font-mono font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                          {storyArea}
                        </span>

                        {/* Iteration Path / Release Badge */}
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md">
                          <FolderGit2 size={11} />
                          <span>{rel?.name || storyIter}</span>
                          <span className="font-mono text-[10px] px-1 py-0.2 bg-white/70 rounded">
                            {storyRelNum}
                          </span>
                        </span>

                        {story.adoId && (
                          <span className="text-[10.5px] font-bold text-[var(--primary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            US-{story.adoId}
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getStatusBadgeClass(story.status)}`}>
                          {story.status}
                        </span>
                        {story.storyPoints !== undefined && (
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-md">
                            {story.storyPoints} pts
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

                      {/* Criteria Accordion */}
                      {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleCriteria(story.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            <ListChecks size={13} />
                            <span>Acceptance Criteria ({story.acceptanceCriteria.length})</span>
                            {isCriteriaExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>

                          {isCriteriaExpanded && (
                            <ul className="mt-2 pl-2 space-y-1 text-xs text-[var(--text-secondary)] border-l-2 border-[var(--primary)]">
                              {story.acceptanceCriteria.map((c, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-[var(--primary)] font-bold font-mono">{i + 1}.</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Footer Info: Assignee, Release, Test Plan & Linked Defect Counters */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[var(--text-muted)] mt-3 pt-2.5 border-t border-[var(--border)]">
                        {assignee ? (
                          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                            <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-[10px] font-bold">
                              {assignee.name.charAt(0)}
                            </span>
                            <span>{assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">Unassigned</span>
                        )}

                        {story.testPlanRef && (
                          <div className="flex items-center gap-1 text-[var(--primary)] font-semibold">
                            <CheckCircle2 size={13} />
                            <span>
                              Test Suite: {story.testPlanRef.passedTests}/{story.testPlanRef.totalTests} Passed
                            </span>
                          </div>
                        )}

                        {openDefects.length > 0 && (
                          <div className="flex items-center gap-1 text-[var(--critical)] font-bold">
                            <AlertCircle size={13} />
                            <span>{openDefects.length} Open Defects</span>
                          </div>
                        )}

                        {linkedTasks.length > 0 && (
                          <span className="text-[var(--text-secondary)]">
                            {linkedTasks.length} linked dev tasks
                          </span>
                        )}

                        {story.adoUrl && (
                          <a
                            href={story.adoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline ml-auto"
                          >
                            <span>Open in ADO</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[var(--text-muted)] flex-shrink-0">
                    <button
                      onClick={() => openEditModal(story)}
                      className="p-1 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteStory(story.id)}
                      className="p-1 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg cursor-pointer"
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

      {/* Add / Edit Modal */}
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
                  className="w-full text-xs font-medium px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
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
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-all cursor-pointer ${
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
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStoryStatus)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    {STATUS_OPTIONS.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
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
                  <select
                    value={releaseId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setReleaseId(selectedId);
                      const matchedIter = modalReturnedIterations.find(i => i.releaseId === selectedId) || releases.find(r => r.id === selectedId);
                      if (matchedIter) {
                        setIterationPath(matchedIter.iterationPath || '');
                      }
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    <option value="">No Release</option>
                    {modalReturnedIterations.length > 0 ? (
                      modalReturnedIterations.map(iter => (
                        <option key={iter.iterationPath + iter.releaseId} value={iter.releaseId}>
                          {iter.releaseName} ({iter.releaseNumber})
                        </option>
                      ))
                    ) : (
                      releases.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.releaseNumber || 'v1.0.0'})</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    <option value="">Unassigned</option>
                    {team.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>
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
