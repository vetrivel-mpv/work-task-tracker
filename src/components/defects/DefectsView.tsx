import React, { useState, useMemo } from 'react';
import { 
  Defect, 
  Severity, 
  DefectStatus, 
  Release, 
  UserStory, 
  TeamMember,
  AdoInstanceType 
} from '../../types';
import { 
  Plus, 
  Bug, 
  AlertCircle, 
  Flame, 
  CheckCircle2, 
  Sparkles, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Layers,
  Terminal,
  Building2,
  Globe2,
  Filter,
  LifeBuoy,
  FolderGit2,
  Users,
  Search,
  Rocket,
  X,
  Tag
} from 'lucide-react';
import { generateDefectAnalysis } from '../../services/aiService';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber } from '../../utils/adoPaths';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';

interface DefectsViewProps {
  defects: Defect[];
  releases: Release[];
  userStories: UserStory[];
  team: TeamMember[];
  selectedReleaseId: string | null;
  geminiApiKey?: string;
  onAddDefect: (defect: Defect) => void;
  onUpdateDefect: (defect: Defect) => void;
  onDeleteDefect: (defectId: string) => void;
}

const SEVERITY_CONFIG: { [key in Severity]: { label: string; bg: string; text: string; border: string } } = {
  critical: { label: 'Critical', bg: 'bg-[var(--critical-bg)]', text: 'text-[var(--critical)]', border: 'border-[var(--critical-border)]' },
  high: { label: 'High', bg: 'bg-[var(--high-bg)]', text: 'text-[var(--high)]', border: 'border-[var(--high-border)]' },
  medium: { label: 'Medium', bg: 'bg-[var(--medium-bg)]', text: 'text-[var(--medium)]', border: 'border-[var(--medium-border)]' },
  low: { label: 'Low', bg: 'bg-[var(--low-bg)]', text: 'text-[var(--low)]', border: 'border-[var(--low-border)]' }
};

const STATUS_CONFIG: { [key in DefectStatus]: { label: string; bg: string; text: string } } = {
  New: { label: 'New', bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--text-secondary)]' },
  Active: { label: 'Active', bg: 'bg-[var(--critical-bg)]', text: 'text-[var(--critical)]' },
  Fixed: { label: 'Fixed', bg: 'bg-[var(--primary-light)]', text: 'text-[var(--primary)]' },
  Retest: { label: 'Retest', bg: 'bg-[#F4EBFF]', text: 'text-[#7C3AED]' },
  Closed: { label: 'Closed', bg: 'bg-[var(--low-bg)]', text: 'text-[var(--low)]' }
};

export const DefectsView: React.FC<DefectsViewProps> = ({
  defects,
  releases,
  userStories,
  team,
  selectedReleaseId,
  geminiApiKey,
  onAddDefect,
  onUpdateDefect,
  onDeleteDefect
}) => {
  const [filterSource, setFilterSource] = useState<'all' | 'internal' | 'external'>('all');
  const [filterAreaPath, setFilterAreaPath] = useState<string>('');
  const [filterRelease, setFilterRelease] = useState<string>(selectedReleaseId || '');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Available Area Paths and returned Iterations for internal ADO
  const availableAreaPaths = getAllAreaPaths(releases, userStories, defects);
  const returnedIterationPaths = getIterationPathsForArea(filterAreaPath, releases, userStories, defects);

  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  const [selectedAiDefect, setSelectedAiDefect] = useState<Defect | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [status, setStatus] = useState<DefectStatus>('Active');
  const [sourceInstance, setSourceInstance] = useState<AdoInstanceType>('internal');
  const [customerName, setCustomerName] = useState('');
  const [areaPath, setAreaPath] = useState<string>('CareFlow-Core\\EHR-Connect');
  const [userStoryId, setUserStoryId] = useState<string>('');
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('QA');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [rootCause, setRootCause] = useState<string>('');

  const modalReturnedIterations = getIterationPathsForArea(areaPath, releases, userStories, defects);

  const openAddModal = () => {
    setEditingDefect(null);
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setSeverity('medium');
    setStatus('Active');
    setSourceInstance('internal');
    setCustomerName('');
    const defaultArea = filterAreaPath || 'CareFlow-Core\\EHR-Connect';
    setAreaPath(defaultArea);
    const iters = getIterationPathsForArea(defaultArea, releases, userStories, defects);
    setUserStoryId('');
    setReleaseId(iters[0]?.releaseId || selectedReleaseId || (releases[0]?.id || ''));
    setAssigneeId('');
    setEnvironment('QA');
    setTagsInput('');
    setRootCause('');
    setModalOpen(true);
  };

  const openEditModal = (defect: Defect) => {
    setEditingDefect(defect);
    setTitle(defect.title);
    setDescription(defect.description || '');
    setStepsToReproduce(defect.stepsToReproduce || '');
    setSeverity(defect.severity);
    setStatus(defect.status);
    setSourceInstance(defect.sourceInstance || 'internal');
    setCustomerName(defect.customerName || '');
    const defArea = defect.areaPath || releases.find(r => r.id === defect.releaseId)?.areaPath || filterAreaPath || 'CareFlow-Core\\EHR-Connect';
    setAreaPath(defArea);
    setUserStoryId(defect.userStoryId || '');
    setReleaseId(defect.releaseId || '');
    setAssigneeId(defect.assigneeId || '');
    setEnvironment(defect.environment || 'QA');
    setTagsInput((defect.tags || []).join(', '));
    setRootCause(defect.rootCause || '');
    setModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tagsList = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const now = toDateStr(new Date());

    if (editingDefect) {
      onUpdateDefect({
        ...editingDefect,
        title: title.trim(),
        description: description.trim(),
        stepsToReproduce: stepsToReproduce.trim(),
        severity,
        status,
        sourceInstance,
        customerName: sourceInstance === 'external' ? (customerName.trim() || 'St. Jude Medical Health') : undefined,
        areaPath: sourceInstance === 'internal' ? areaPath.trim() : 'CareFlow-Ops\\Customer-Escalations',
        userStoryId: userStoryId || undefined,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        environment,
        tags: tagsList,
        rootCause: rootCause.trim() || undefined,
        updatedAt: now
      });
    } else {
      onAddDefect({
        id: generateId('def'),
        title: title.trim(),
        description: description.trim(),
        stepsToReproduce: stepsToReproduce.trim(),
        severity,
        status,
        sourceInstance,
        customerName: sourceInstance === 'external' ? (customerName.trim() || 'St. Jude Medical Health') : undefined,
        areaPath: sourceInstance === 'internal' ? areaPath.trim() : 'CareFlow-Ops\\Customer-Escalations',
        userStoryId: userStoryId || undefined,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        environment,
        tags: tagsList,
        rootCause: rootCause.trim() || undefined,
        createdAt: now,
        updatedAt: now
      });
    }

    setModalOpen(false);
  };

  const toggleSteps = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunAiAnalysis = async (defect: Defect) => {
    setSelectedAiDefect(defect);
    setAiModalOpen(true);
    setAiLoading(true);
    setAiAnalysisResult('');

    try {
      const linkedStory = userStories.find(s => s.id === defect.userStoryId) || null;
      const res = await generateDefectAnalysis(defect, linkedStory, geminiApiKey);
      if (res.ok && res.text) {
        setAiAnalysisResult(res.text);
      } else {
        setAiAnalysisResult(res.error || 'AI analysis could not be generated.');
      }
    } catch (err: any) {
      setAiAnalysisResult(`Failed to run AI root-cause analysis: ${err.message || 'Unknown error'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered defects with comprehensive criteria
  const filteredDefects = useMemo(() => {
    return defects.filter(d => {
      // Source Instance Filter
      if (filterSource === 'internal' && d.sourceInstance === 'external') return false;
      if (filterSource === 'external' && d.sourceInstance !== 'external') return false;

      // Assignee Filter
      if (filterAssignee) {
        if (filterAssignee === 'unassigned') {
          if (d.assigneeId) return false;
        } else if (d.assigneeId !== filterAssignee) {
          return false;
        }
      }

      // Area Path filter
      if (filterAreaPath) {
        const dArea = (d.areaPath || releases.find(r => r.id === d.releaseId)?.areaPath || '').toLowerCase();
        const targetArea = filterAreaPath.toLowerCase();
        const matchesArea = dArea === targetArea || dArea.includes(targetArea) || targetArea.includes(dArea);
        const matchesReturnedIteration = returnedIterationPaths.some(
          iter => iter.releaseId === d.releaseId || iter.iterationPath === d.iterationPath
        );
        if (!matchesArea && !matchesReturnedIteration) return false;
      }

      // Iteration / Release filter
      if (filterRelease) {
        const matchesRelId = d.releaseId === filterRelease;
        const matchesIterPath = d.iterationPath === filterRelease;
        const matchedRelease = releases.find(r => r.id === filterRelease);
        const matchesReleaseIteration = matchedRelease && (
          matchedRelease.iterationPath === d.iterationPath ||
          matchedRelease.name === d.iterationPath ||
          (d.iterationPath && matchedRelease.name.includes(d.iterationPath))
        );
        if (!matchesRelId && !matchesIterPath && !matchesReleaseIteration) return false;
      }

      // Severity & Status
      if (filterSeverity && d.severity !== filterSeverity) return false;
      if (filterStatus && d.status !== filterStatus) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = d.title.toLowerCase().includes(q);
        const matchDesc = (d.description || '').toLowerCase().includes(q);
        const matchSteps = (d.stepsToReproduce || '').toLowerCase().includes(q);
        const matchCust = (d.customerName || '').toLowerCase().includes(q);
        const matchArea = (d.areaPath || '').toLowerCase().includes(q);
        const matchAdo = d.adoId ? String(d.adoId).includes(q) : false;
        const matchTags = (d.tags || []).some(t => t.toLowerCase().includes(q));
        const memberName = d.assigneeId ? (team.find(t => t.id === d.assigneeId)?.name || '') : '';
        const matchAssignee = memberName ? memberName.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchDesc && !matchSteps && !matchCust && !matchArea && !matchAdo && !matchTags && !matchAssignee) return false;
      }

      return true;
    });
  }, [defects, releases, filterSource, filterAssignee, filterAreaPath, returnedIterationPaths, filterRelease, filterSeverity, filterStatus, search]);

  // Options for Searchable Area Path
  const areaOptions: SelectOption[] = useMemo(() => {
    return availableAreaPaths.map(area => {
      const count = defects.filter(d => (d.areaPath || '').toLowerCase() === area.toLowerCase()).length;
      return {
        value: area,
        label: area,
        badge: `${count} bugs`,
        icon: <FolderGit2 size={13} className="text-[var(--primary)]" />
      };
    });
  }, [availableAreaPaths, defects]);

  // Options for Searchable Iteration / Release
  const iterationOptions: SelectOption[] = useMemo(() => {
    return returnedIterationPaths.map(iter => {
      const count = defects.filter(d => d.releaseId === iter.releaseId || d.iterationPath === iter.iterationPath).length;
      return {
        value: iter.releaseId || iter.iterationPath,
        label: `${iter.releaseName} (${iter.releaseNumber || 'v1.0.0'})`,
        sublabel: iter.iterationPath,
        badge: `${count} bugs`,
        icon: <Rocket size={13} className="text-[var(--primary)]" />
      };
    });
  }, [returnedIterationPaths, defects]);

  // Options for Searchable Assignee Filter
  const assigneeOptions: SelectOption[] = useMemo(() => {
    const unassignedCount = defects.filter(d => !d.assigneeId).length;
    const list: SelectOption[] = [
      {
        value: 'unassigned',
        label: 'Unassigned Bugs',
        badge: `${unassignedCount}`,
        icon: <Users size={13} className="text-[var(--text-muted)]" />
      }
    ];

    team.forEach(m => {
      const count = defects.filter(d => d.assigneeId === m.id).length;
      list.push({
        value: m.id,
        label: m.name,
        sublabel: m.role,
        badge: `${count} bugs`,
        avatarColor: m.avatarColor || 'var(--primary)',
        avatarInitials: m.name.split(' ').map(n => n[0]).join('').slice(0, 2)
      });
    });

    return list;
  }, [team, defects]);

  // Options for Severity
  const severityOptions: SelectOption[] = useMemo(() => {
    return (['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => {
      const count = defects.filter(d => d.severity === sev).length;
      return {
        value: sev,
        label: sev.charAt(0).toUpperCase() + sev.slice(1),
        badge: `${count}`
      };
    });
  }, [defects]);

  // Options for Status
  const statusOptions: SelectOption[] = useMemo(() => {
    return (['New', 'Active', 'Fixed', 'Retest', 'Closed'] as DefectStatus[]).map(st => {
      const count = defects.filter(d => d.status === st).length;
      return {
        value: st,
        label: st,
        badge: `${count}`
      };
    });
  }, [defects]);

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

  // Modal Story Options
  const modalStoryOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: 'No Story Linked' },
      ...userStories.map(s => ({
        value: s.id,
        label: s.adoId ? `#${s.adoId} - ${s.title}` : s.title,
        sublabel: s.areaPath || 'User Story'
      }))
    ];
  }, [userStories]);

  // Modal Release Options
  const modalReleaseOptions: SelectOption[] = useMemo(() => {
    const source = modalReturnedIterations.length > 0 ? modalReturnedIterations : releases.map(r => ({
      releaseId: r.id,
      releaseName: r.name,
      releaseNumber: r.releaseNumber || 'v1.0.0',
      iterationPath: r.iterationPath || r.name
    }));

    return [
      { value: '', label: 'No Release Linked' },
      ...source.map(iter => ({
        value: iter.releaseId,
        label: `${iter.releaseName} (${iter.releaseNumber || 'v1.0.0'})`,
        sublabel: iter.iterationPath
      }))
    ];
  }, [modalReturnedIterations, releases]);

  // Counts
  const criticalCount = defects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const activeCount = defects.filter(d => d.status === 'Active').length;
  const externalCount = defects.filter(d => d.sourceInstance === 'external').length;
  const internalCount = defects.filter(d => d.sourceInstance !== 'external').length;
  const activeFiltersCount = (filterAreaPath ? 1 : 0) + (filterRelease ? 1 : 0) + (filterAssignee ? 1 : 0) + (filterSeverity ? 1 : 0) + (filterStatus ? 1 : 0) + (search ? 1 : 0);

  const handleClearFilters = () => {
    setFilterAreaPath('');
    setFilterRelease('');
    setFilterAssignee('');
    setFilterSeverity('');
    setFilterStatus('');
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header & Metrics */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Defect Tracking & Triage</h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              Dual-instance ADO bug tracking, Area Path root cause classification, and AI fix proposals
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--critical-bg)] border border-[var(--critical-border)] px-3.5 py-1.5 rounded-xl text-xs font-bold text-[var(--critical)]">
              <Flame size={14} />
              <span>Critical Active: {criticalCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-1.5 rounded-xl text-xs font-bold">
              <span className="text-[var(--text-muted)]">Active Total:</span>
              <span className="text-[var(--primary)]">{activeCount}/{defects.length}</span>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <Plus size={15} />
              <span>Log Defect</span>
            </button>
          </div>
        </div>

        {/* Source Instance Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => setFilterSource('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterSource === 'all'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Instances ({defects.length})
          </button>
          <button
            onClick={() => setFilterSource('internal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterSource === 'internal'
                ? 'bg-[var(--internal-ado)] text-white shadow-xs'
                : 'bg-[var(--internal-ado-bg)] text-[var(--internal-ado)] hover:opacity-80'
            }`}
          >
            <Building2 size={13} />
            <span>Internal Dev/QA ({internalCount})</span>
          </button>
          <button
            onClick={() => setFilterSource('external')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterSource === 'external'
                ? 'bg-[var(--external-ado)] text-white shadow-xs'
                : 'bg-[var(--external-ado-bg)] text-[var(--external-ado)] hover:opacity-80'
            }`}
          >
            <Globe2 size={13} />
            <span>External Customer OPS ({externalCount})</span>
          </button>
        </div>

        {/* Filter Controls Bar with Modern Searchable Selects */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          {/* Quick Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search defects by title, steps, customer, Area Path, tags, or ADO #..."
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
          <div className="min-w-[170px]">
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
          <div className="min-w-[170px]">
            <SearchableSelect
              options={areaOptions}
              value={filterAreaPath}
              onChange={(val) => {
                setFilterAreaPath(val);
                setFilterRelease('');
              }}
              placeholder="All Area Paths"
              label="Area Path"
              icon={<FolderGit2 size={14} />}
            />
          </div>

          {/* SEARCHABLE ITERATION FILTER */}
          <div className="min-w-[180px]">
            <SearchableSelect
              options={iterationOptions}
              value={filterRelease}
              onChange={setFilterRelease}
              placeholder={filterAreaPath ? `Iterations in Area (${returnedIterationPaths.length})` : 'All Releases / Iterations'}
              label="Iteration"
              icon={<Rocket size={14} />}
            />
          </div>

          {/* SEARCHABLE SEVERITY FILTER */}
          <div className="min-w-[140px]">
            <SearchableSelect
              options={severityOptions}
              value={filterSeverity}
              onChange={setFilterSeverity}
              placeholder="All Severities"
              label="Severity"
            />
          </div>

          {/* SEARCHABLE STATUS FILTER */}
          <div className="min-w-[140px]">
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
      </div>

      {/* Defects List */}
      <div className="flex flex-col gap-3.5">
        {filteredDefects.length > 0 ? (
          filteredDefects.map(defect => {
            const sev = SEVERITY_CONFIG[defect.severity];
            const st = STATUS_CONFIG[defect.status];
            const assignee = team.find(m => m.id === defect.assigneeId);
            const rel = releases.find(r => r.id === defect.releaseId);
            const defArea = defect.areaPath || rel?.areaPath || (defect.sourceInstance === 'external' ? 'CareFlow-Ops\\Customer-Escalations' : 'CareFlow-Core\\EHR-Connect');
            const story = userStories.find(s => s.id === defect.userStoryId);
            const isStepsExpanded = expandedSteps.has(defect.id);
            const isExternal = defect.sourceInstance === 'external';

            return (
              <div
                key={defect.id}
                className={`bg-[var(--surface)] border rounded-2xl p-5 transition-all shadow-xs ${
                  defect.severity === 'critical' && defect.status !== 'Closed'
                    ? 'border-[var(--critical-border)] bg-[var(--critical-bg)]/20'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div 
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 ${sev.bg} ${sev.text} border ${sev.border}`}
                    >
                      {defect.severity === 'critical' ? <Flame size={18} /> : <Bug size={18} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {/* Instance Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isExternal
                              ? 'bg-[var(--external-ado-bg)] text-[var(--external-ado)] border-[var(--external-ado)]/30'
                              : 'bg-[var(--internal-ado-bg)] text-[var(--internal-ado)] border-[var(--internal-ado)]/30'
                          }`}
                        >
                          {isExternal ? <Globe2 size={10} /> : <Building2 size={10} />}
                          {isExternal ? 'Customer ADO (External)' : 'Internal ADO (Dev/QA)'}
                        </span>

                        {defect.adoId && (
                          <span className="font-mono text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md border border-[var(--border)] flex items-center gap-1">
                            ADO #{defect.adoId}
                            {defect.adoUrl && (
                              <a
                                href={defect.adoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--text-muted)] hover:text-[var(--primary)]"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </span>
                        )}

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                          {sev.label}
                        </span>

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>

                        {isExternal && defect.customerName && (
                          <span className="text-[11px] font-bold text-[var(--external-ado)] bg-[var(--external-ado-bg)] px-2 py-0.5 rounded-md border border-[var(--external-ado)]/30">
                            Client: {defect.customerName}
                          </span>
                        )}

                        {defArea && (
                          <span className="text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FolderGit2 size={11} className="text-[var(--primary)]" />
                            {defArea}
                          </span>
                        )}

                        {rel && (
                          <span className="text-[11px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Rocket size={11} />
                            {rel.name} ({rel.releaseNumber || 'v1.0.0'})
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                        {defect.title}
                      </h3>

                      {defect.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                          {defect.description}
                        </p>
                      )}

                      {/* Steps to Reproduce Expandable */}
                      {defect.stepsToReproduce && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleSteps(defect.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            <Terminal size={14} />
                            <span>Steps to Reproduce</span>
                            {isStepsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isStepsExpanded && (
                            <div className="mt-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3.5 text-xs font-mono text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                              {defect.stepsToReproduce}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tags & Linked Story */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {story && (
                          <span className="text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Layers size={11} className="text-[var(--primary)]" />
                            Linked: {story.adoId ? `US #${story.adoId}` : story.title.slice(0, 24) + '...'}
                          </span>
                        )}

                        {defect.tags && defect.tags.map((tag, i) => (
                          <span key={i} className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Tag size={10} className="text-[var(--text-muted)]" />
                            {tag}
                          </span>
                        ))}
                      </div>

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

                        {defect.createdByName && (
                          <div className="flex items-center gap-1">
                            <span>Reported by:</span>
                            <span className="font-semibold text-[var(--text-secondary)]">{defect.createdByName}</span>
                          </div>
                        )}

                        <span className="ml-auto">Updated {defect.updatedAt}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 text-[var(--text-muted)] flex-shrink-0">
                    <button
                      onClick={() => handleRunAiAnalysis(defect)}
                      className="p-1.5 text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg cursor-pointer transition-all"
                      title="AI Root Cause Analysis"
                    >
                      <Sparkles size={15} />
                    </button>
                    <button
                      onClick={() => openEditModal(defect)}
                      className="p-1.5 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-all"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteDefect(defect.id)}
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
            <Bug size={36} className="mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">No defects match your filters</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              {filterAreaPath 
                ? `No defects found under Area Path "${filterAreaPath}". Try changing filters or logging a defect.`
                : 'All clear or no defects logged yet.'}
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Log New Defect</span>
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
                {editingDefect ? 'Edit Defect' : 'Log New Defect'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
              {/* Instance Selector */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Target ADO Instance</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceInstance('internal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceInstance === 'internal'
                        ? 'border-[var(--internal-ado)] bg-[var(--internal-ado-bg)] text-[var(--internal-ado)] shadow-xs'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Building2 size={13} />
                    <span>Internal ADO (Dev/QA)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceInstance('external')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceInstance === 'external'
                        ? 'border-[var(--external-ado)] bg-[var(--external-ado-bg)] text-[var(--external-ado)] shadow-xs'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Globe2 size={13} />
                    <span>External ADO (Customer OPS)</span>
                  </button>
                </div>
              </div>

              {sourceInstance === 'external' && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Customer / Hospital Client</label>
                  <input
                    type="text"
                    placeholder="e.g. St. Jude Medical Health, Kaiser Permanente"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Defect Title <span className="text-[var(--critical)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Appointment slot double-book occurs on concurrent submit"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Severity</label>
                  <SearchableSelect
                    options={[
                      { value: 'critical', label: 'Critical' },
                      { value: 'high', label: 'High' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'low', label: 'Low' }
                    ]}
                    value={severity}
                    onChange={(val) => setSeverity(val as Severity)}
                    placeholder="Severity"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Status</label>
                  <SearchableSelect
                    options={[
                      { value: 'New', label: 'New' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Fixed', label: 'Fixed' },
                      { value: 'Retest', label: 'Retest' },
                      { value: 'Closed', label: 'Closed' }
                    ]}
                    value={status}
                    onChange={(val) => setStatus(val as DefectStatus)}
                    placeholder="Status"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Environment</label>
                  <SearchableSelect
                    options={[
                      { value: 'QA', label: 'QA' },
                      { value: 'Staging', label: 'Staging' },
                      { value: 'Prod', label: 'Production' },
                      { value: 'Dev', label: 'Dev' }
                    ]}
                    value={environment}
                    onChange={setEnvironment}
                    placeholder="Environment"
                  />
                </div>
              </div>

              {sourceInstance === 'internal' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Area Path (ADO)
                    </label>
                    <SearchableSelect
                      options={areaOptions}
                      value={areaPath}
                      onChange={(newArea) => {
                        setAreaPath(newArea);
                        const iters = getIterationPathsForArea(newArea, releases, userStories, defects);
                        if (iters.length > 0) {
                          setReleaseId(iters[0].releaseId);
                        }
                      }}
                      placeholder="Select Area Path"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Returned Iteration / Release
                    </label>
                    <SearchableSelect
                      options={modalReleaseOptions}
                      value={releaseId}
                      onChange={setReleaseId}
                      placeholder="Select Release"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Linked Story</label>
                  <SearchableSelect
                    options={modalStoryOptions}
                    value={userStoryId}
                    onChange={setUserStoryId}
                    placeholder="Select User Story"
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
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Concurrency, Database, Blocker"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Defect Description</label>
                <textarea
                  rows={2}
                  placeholder="What is the observed vs expected behavior?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Steps to Reproduce</label>
                <textarea
                  rows={3}
                  placeholder="1. Navigate to /schedule&#10;2. Select slot 14:00&#10;3. Submit simultaneously"
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none font-mono text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Root Cause Hypothesis (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Missing PostgreSQL optimistic locking on slot_reservation"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
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
                  {editingDefect ? 'Update Defect' : 'Log Defect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Root Cause Analysis Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[var(--primary)]" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  AI Root Cause & Patch Proposal
                </h2>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
              {selectedAiDefect && (
                <div className="p-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Target Defect:</span>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                    {selectedAiDefect.adoId ? `#${selectedAiDefect.adoId} - ` : ''}{selectedAiDefect.title}
                  </p>
                </div>
              )}

              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Analyzing logs, stack traces, and ADO work item history...
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed bg-[var(--surface-hover)] p-4 rounded-xl border border-[var(--border)] font-mono">
                  {aiAnalysisResult}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
