import React, { useState, useMemo } from 'react';
import { 
  Defect, 
  Severity, 
  Priority,
  DefectStatus, 
  Release, 
  UserStory, 
  TeamMember,
  AdoInstanceType,
  DualAdoConfig,
  AppUser
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
  FolderGit2,
  Users,
  Search,
  Rocket,
  X,
  Tag,
  Copy,
  Check,
  User,
  UserCheck,
  Calendar,
  Clock,
  Filter,
  CheckCircle
} from 'lucide-react';
import { generateDefectAnalysis } from '../../services/aiService';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber, matchesReleaseOrIteration, formatReleaseDisplayName } from '../../utils/adoPaths';
import { getWorkItemAssignee, matchesAssigneeFilter } from '../../utils/assigneeUtils';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';
import { FilterBar, FilterDropdownConfig } from '../common/FilterBar';
import { useWorkItemFilters } from '../../utils/useWorkItemFilters';
import { HighlightText } from '../common/HighlightText';

interface DefectsViewProps {
  defects: Defect[];
  releases: Release[];
  userStories: UserStory[];
  team: TeamMember[];
  selectedReleaseId: string | null;
  geminiApiKey?: string;
  dualAdoConfig?: DualAdoConfig;
  adoConfig?: any;
  currentUserId?: string;
  users?: AppUser[];
  onSelectRelease?: (releaseId: string | null) => void;
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

const STATUS_CONFIG: { [key in DefectStatus]: { label: string; bg: string; text: string; border: string } } = {
  New: { label: 'New', bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--text-secondary)]', border: 'border-[var(--border)]' },
  Active: { label: 'Active', bg: 'bg-[var(--critical-bg)]', text: 'text-[var(--critical)]', border: 'border-[var(--critical-border)]' },
  Fixed: { label: 'Fixed', bg: 'bg-[var(--primary-light)]', text: 'text-[var(--primary)]', border: 'border-[var(--primary)]/30' },
  Retest: { label: 'Retest', bg: 'bg-[#F4EBFF]', text: 'text-[#7C3AED]', border: 'border-[#7C3AED]/30' },
  Closed: { label: 'Closed', bg: 'bg-[var(--low-bg)]', text: 'text-[var(--low)]', border: 'border-[var(--low-border)]' }
};

export const DefectsView: React.FC<DefectsViewProps> = ({
  defects,
  releases,
  userStories,
  team,
  selectedReleaseId,
  geminiApiKey,
  dualAdoConfig,
  adoConfig,
  currentUserId,
  users = [],
  onSelectRelease,
  onAddDefect,
  onUpdateDefect,
  onDeleteDefect
}) => {
  const [copiedLinkDefectId, setCopiedLinkDefectId] = useState<string | null>(null);

  const {
    search,
    setSearch,
    filterRelease,
    handleReleaseChange,
    filterAssignee,
    setFilterAssignee,
    filterStatus,
    setFilterStatus,
    customFilters,
    setCustomFilter,
    activeFiltersCount,
    handleClearFilters
  } = useWorkItemFilters({
    selectedReleaseId,
    onSelectRelease
  });

  const filterSeverity = customFilters.severity || '';
  const setFilterSeverity = (val: string) => setCustomFilter('severity', val);

  const filterTag = customFilters.tag || '';
  const setFilterTag = (val: string) => setCustomFilter('tag', val);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Returned Iterations for internal ADO under project ACM
  const returnedIterationPaths = getIterationPathsForArea('ACM', releases, userStories, defects);

  // Extract all unique tags across defects
  const allTags = useMemo(() => {
    const set = new Set<string>();
    defects.forEach(d => {
      if (Array.isArray(d.tags)) {
        d.tags.forEach(t => {
          const trimmed = t?.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [defects]);

  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
  const [selectedAiDefect, setSelectedAiDefect] = useState<Defect | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<DefectStatus>('Active');
  const [sourceInstance, setSourceInstance] = useState<AdoInstanceType>('internal');
  const [customerName, setCustomerName] = useState('');
  const [areaPath, setAreaPath] = useState<string>('ACM');
  const [userStoryId, setUserStoryId] = useState<string>('');
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [createdByName, setCreatedByName] = useState<string>('');
  const [adoIdInput, setAdoIdInput] = useState<string>('');
  const [adoUrlInput, setAdoUrlInput] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('QA');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [rootCause, setRootCause] = useState<string>('');

  const modalReturnedIterations = getIterationPathsForArea('ACM', releases, userStories, defects);

  // Direct ADO link resolution helper
  const getDefectDirectUrl = (defect: Defect): string | null => {
    if (defect.adoUrl && defect.adoUrl.startsWith('http')) {
      return defect.adoUrl;
    }
    if (!defect.adoId) return null;

    if (dualAdoConfig?.internal?.organization && dualAdoConfig?.internal?.project) {
      return `https://dev.azure.com/${encodeURIComponent(dualAdoConfig.internal.organization)}/${encodeURIComponent(dualAdoConfig.internal.project)}/_workitems/edit/${defect.adoId}`;
    }

    if (adoConfig?.organization && adoConfig?.project) {
      return `https://dev.azure.com/${encodeURIComponent(adoConfig.organization)}/${encodeURIComponent(adoConfig.project)}/_workitems/edit/${defect.adoId}`;
    }

    // Default Azure DevOps instance path
    return `https://dev.azure.com/simetricwdh/ACM/_workitems/edit/${defect.adoId}`;
  };

  const handleCopyDirectLink = (defect: Defect, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getDefectDirectUrl(defect);
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedLinkDefectId(defect.id);
      setTimeout(() => {
        setCopiedLinkDefectId(null);
      }, 2000);
    }
  };

  const openAddModal = () => {
    setEditingDefect(null);
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setSeverity('medium');
    setPriority('medium');
    setStatus('Active');
    setSourceInstance('internal');
    setCustomerName('');
    const defaultArea = 'ACM';
    setAreaPath(defaultArea);
    const iters = getIterationPathsForArea(defaultArea, releases, userStories, defects);
    setUserStoryId('');
    setReleaseId(iters[0]?.releaseId || selectedReleaseId || (releases[0]?.id || ''));
    setAssigneeId('');
    
    // Default createdByName to current logged in user or team lead
    const currentUser = users.find(u => u.id === currentUserId);
    setCreatedByName(currentUser ? currentUser.name : (team[0]?.name || 'QA Lead'));
    setAdoIdInput('');
    setAdoUrlInput('');
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
    setPriority(defect.priority || 'medium');
    setStatus(defect.status);
    setSourceInstance(defect.sourceInstance || 'internal');
    setCustomerName(defect.customerName || '');
    const defArea = defect.areaPath || releases.find(r => r.id === defect.releaseId)?.areaPath || 'ACM';
    setAreaPath(defArea);
    setUserStoryId(defect.userStoryId || '');
    setReleaseId(defect.releaseId || '');
    setAssigneeId(defect.assigneeId || '');
    setCreatedByName(defect.createdByName || '');
    setAdoIdInput(defect.adoId ? String(defect.adoId) : '');
    setAdoUrlInput(defect.adoUrl || '');
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
    const parsedAdoId = adoIdInput.trim() ? parseInt(adoIdInput.trim(), 10) : undefined;
    const selectedAssignee = team.find(m => m.id === assigneeId);

    if (editingDefect) {
      onUpdateDefect({
        ...editingDefect,
        title: title.trim(),
        description: description.trim(),
        stepsToReproduce: stepsToReproduce.trim(),
        severity,
        priority,
        status,
        sourceInstance: 'internal',
        customerName: customerName.trim() || undefined,
        areaPath: 'ACM',
        userStoryId: userStoryId || undefined,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        assigneeName: selectedAssignee ? selectedAssignee.name : (assigneeId ? editingDefect.assigneeName : undefined),
        createdByName: createdByName.trim() || editingDefect.createdByName || 'QA Lead',
        adoId: parsedAdoId !== undefined && !isNaN(parsedAdoId) ? parsedAdoId : editingDefect.adoId,
        adoUrl: adoUrlInput.trim() || editingDefect.adoUrl,
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
        priority,
        status,
        sourceInstance: 'internal',
        customerName: customerName.trim() || undefined,
        areaPath: 'ACM',
        userStoryId: userStoryId || undefined,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        assigneeName: selectedAssignee ? selectedAssignee.name : undefined,
        createdByName: createdByName.trim() || 'QA Lead',
        adoId: parsedAdoId !== undefined && !isNaN(parsedAdoId) ? parsedAdoId : undefined,
        adoUrl: adoUrlInput.trim() || undefined,
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
    setAiError(null);
    setAiModelUsed(null);

    try {
      const linkedStory = userStories.find(s => s.id === defect.userStoryId) || null;
      const res = await generateDefectAnalysis(defect, linkedStory, geminiApiKey);
      if (res.ok && res.text) {
        setAiAnalysisResult(res.text);
        setAiModelUsed(res.model || 'gemini-2.5-flash');
        setAiError(null);
      } else {
        setAiError(res.error || 'AI analysis could not be generated at this time.');
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to run AI root-cause analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered defects with comprehensive criteria including tags
  const filteredDefects = useMemo(() => {
    return defects.filter(d => {
      // Assignee Filter
      if (filterAssignee) {
        if (!matchesAssigneeFilter(d, filterAssignee, team)) return false;
      }

      // Iteration / Release filter
      if (filterRelease && filterRelease !== 'all') {
        if (!matchesReleaseOrIteration(d, filterRelease, releases)) return false;
      }

      // Severity & Status
      if (filterSeverity && d.severity !== filterSeverity) return false;
      if (filterStatus && d.status !== filterStatus) return false;

      // Tag Filter
      if (filterTag && filterTag !== 'all') {
        const hasTag = (d.tags || []).some(t => t.toLowerCase() === filterTag.toLowerCase());
        if (!hasTag) return false;
      }

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
        const resolved = getWorkItemAssignee(d, team);
        const matchAssignee = resolved ? (resolved.name.toLowerCase().includes(q) || (resolved.email && resolved.email.toLowerCase().includes(q))) : false;
        const matchCreator = (d.createdByName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSteps && !matchCust && !matchArea && !matchAdo && !matchTags && !matchAssignee && !matchCreator) return false;
      }

      return true;
    });
  }, [defects, releases, filterAssignee, filterRelease, filterSeverity, filterStatus, filterTag, search, team]);

  // Options for Searchable Iteration / Release
  const iterationOptions: SelectOption[] = useMemo(() => {
    return returnedIterationPaths.map(iter => {
      const count = defects.filter(d => d.releaseId === iter.releaseId || d.iterationPath === iter.iterationPath).length;
      return {
        value: iter.releaseId || iter.iterationPath,
        label: formatReleaseDisplayName(iter.releaseName, iter.releaseNumber),
        sublabel: iter.iterationPath !== iter.releaseName ? iter.iterationPath : undefined,
        badge: `${count} bugs`,
        icon: <Rocket size={13} className="text-[var(--primary)]" />
      };
    });
  }, [returnedIterationPaths, defects]);

  // Options for Searchable Assignees
  const assigneeOptions: SelectOption[] = useMemo(() => {
    const unassignedCount = defects.filter(d => !d.assigneeId && !d.assigneeName).length;
    const items: SelectOption[] = [
      {
        value: 'unassigned',
        label: 'Unassigned',
        badge: unassignedCount > 0 ? `${unassignedCount}` : undefined,
        icon: <Users size={13} className="text-[var(--text-muted)]" />
      }
    ];

    team.forEach(member => {
      const count = defects.filter(d => {
        const resolved = getWorkItemAssignee(d, team);
        return resolved?.id === member.id;
      }).length;

      items.push({
        value: member.id,
        label: member.name,
        sublabel: member.role,
        badge: `${count}`,
        avatarColor: member.avatarColor || 'var(--primary)',
        avatarInitials: member.name.split(' ').map(n => n[0]).join('').slice(0, 2)
      });
    });

    return items;
  }, [team, defects]);

  // Options for Severity
  const severityOptions: SelectOption[] = useMemo(() => {
    return [
      {
        value: 'critical',
        label: 'Critical',
        badge: `${defects.filter(d => d.severity === 'critical').length}`,
        icon: <Flame size={13} className="text-[var(--critical)]" />
      },
      {
        value: 'high',
        label: 'High',
        badge: `${defects.filter(d => d.severity === 'high').length}`,
        icon: <AlertCircle size={13} className="text-[var(--high)]" />
      },
      {
        value: 'medium',
        label: 'Medium',
        badge: `${defects.filter(d => d.severity === 'medium').length}`,
        icon: <Bug size={13} className="text-[var(--medium)]" />
      },
      {
        value: 'low',
        label: 'Low',
        badge: `${defects.filter(d => d.severity === 'low').length}`,
        icon: <CheckCircle2 size={13} className="text-[var(--low)]" />
      }
    ];
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

  // Options for Tags Filter
  const tagOptions: SelectOption[] = useMemo(() => {
    return allTags.map(tag => {
      const count = defects.filter(d => (d.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())).length;
      return {
        value: tag,
        label: `#${tag}`,
        badge: `${count}`,
        icon: <Tag size={12} className="text-[var(--primary)]" />
      };
    });
  }, [allTags, defects]);

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

  // Modal Creator Options
  const modalCreatorOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [];
    team.forEach(m => {
      list.push({
        value: m.name,
        label: m.name,
        sublabel: `${m.role} (Team)`,
        avatarColor: m.avatarColor || 'var(--primary)',
        avatarInitials: m.name.split(' ').map(n => n[0]).join('').slice(0, 2)
      });
    });
    users.forEach(u => {
      if (!list.some(item => item.value === u.name)) {
        list.push({
          value: u.name,
          label: u.name,
          sublabel: `${u.role} (User)`,
          avatarColor: u.avatarColor || 'var(--primary)',
          avatarInitials: u.name.split(' ').map(n => n[0]).join('').slice(0, 2)
        });
      }
    });
    if (!list.some(item => item.value === 'QA Lead')) {
      list.unshift({ value: 'QA Lead', label: 'QA Lead' });
    }
    return list;
  }, [team, users]);

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
        label: formatReleaseDisplayName(iter.releaseName, iter.releaseNumber),
        sublabel: iter.iterationPath !== iter.releaseName ? iter.iterationPath : undefined
      }))
    ];
  }, [modalReturnedIterations, releases]);

  // Counts
  const criticalCount = defects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const activeCount = defects.filter(d => d.status === 'Active').length;

  const totalActiveFilters = activeFiltersCount + (filterTag ? 1 : 0);

  const filterConfigs: FilterDropdownConfig[] = useMemo(() => [
    {
      id: 'assignee',
      label: 'Assigned To',
      placeholder: 'All Assignees',
      allOptionLabel: 'All Assignees',
      icon: <Users size={14} className="text-[var(--primary)]" />,
      options: assigneeOptions,
      value: filterAssignee,
      onChange: setFilterAssignee,
      minWidth: '165px'
    },
    {
      id: 'tag',
      label: 'Tag / Label',
      placeholder: 'All Tags',
      allOptionLabel: 'All Tags',
      icon: <Tag size={14} className="text-[var(--primary)]" />,
      options: tagOptions,
      value: filterTag,
      onChange: setFilterTag,
      minWidth: '150px'
    },
    {
      id: 'severity',
      label: 'Severity',
      placeholder: 'All Severities',
      allOptionLabel: 'All Severities',
      icon: <Flame size={14} className="text-[var(--critical)]" />,
      options: severityOptions,
      value: filterSeverity,
      onChange: setFilterSeverity,
      minWidth: '145px'
    },
    {
      id: 'status',
      label: 'Status',
      placeholder: 'All Statuses',
      allOptionLabel: 'All Statuses',
      icon: <CheckCircle2 size={14} className="text-[var(--low)]" />,
      options: statusOptions,
      value: filterStatus,
      onChange: setFilterStatus,
      minWidth: '140px'
    }
  ], [
    assigneeOptions,
    filterAssignee,
    setFilterAssignee,
    tagOptions,
    filterTag,
    setFilterTag,
    severityOptions,
    filterSeverity,
    setFilterSeverity,
    statusOptions,
    filterStatus,
    setFilterStatus
  ]);

  const handleResetAll = () => {
    handleClearFilters();
    setFilterTag('');
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header & Metrics */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Defect Tracking & Triage</h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              Azure DevOps bug tracking, Area Path root cause classification, and AI fix proposals
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--critical-bg)] border border-[var(--critical-border)] px-3.5 py-1.5 rounded-xl text-xs font-bold text-[var(--critical)]">
              <Flame size={14} />
              <span>Critical: {criticalCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-1.5 rounded-xl text-xs font-bold">
              <span className="text-[var(--text-muted)]">Active:</span>
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

        {/* Organized Standard Filter Bar */}
        <div className="pt-2">
          <FilterBar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search defects by title, steps, reporter, assignee, Area Path, tags, or ADO #...'
            }}
            filters={filterConfigs}
            onReset={handleResetAll}
            activeFiltersCount={totalActiveFilters}
          />
        </div>

        {/* Tag Quick Bar */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[var(--border)]">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1 mr-1">
              <Tag size={12} className="text-[var(--primary)]" />
              Tags:
            </span>
            <button
              onClick={() => setFilterTag('')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                !filterTag
                  ? 'bg-[var(--primary)] text-white shadow-2xs font-bold'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
              }`}
            >
              All Tags ({defects.length})
            </button>
            {allTags.map(tag => {
              const count = defects.filter(d => (d.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())).length;
              const isSelected = filterTag.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => setFilterTag(isSelected ? '' : tag)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[var(--primary)] text-white shadow-2xs font-bold'
                      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)] border border-[var(--border)]'
                  }`}
                >
                  <span>#{tag}</span>
                  <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Defects List */}
      <div className="flex flex-col gap-3.5">
        {filteredDefects.length > 0 ? (
          filteredDefects.map(defect => {
            const sev = SEVERITY_CONFIG[defect.severity];
            const st = STATUS_CONFIG[defect.status];
            const assignee = getWorkItemAssignee(defect, team);
            const rel = releases.find(r => r.id === defect.releaseId);
            const defArea = 'ACM';
            const story = userStories.find(s => s.id === defect.userStoryId);
            const isStepsExpanded = expandedSteps.has(defect.id);
            const directAdoUrl = getDefectDirectUrl(defect);
            const isCopied = copiedLinkDefectId === defect.id;

            return (
              <div
                key={defect.id}
                className={`bg-[var(--surface)] border rounded-2xl p-5 transition-all shadow-xs ${
                  defect.severity === 'critical' && defect.status !== 'Closed'
                    ? 'border-[var(--critical-border)] bg-[var(--critical-bg)]/15'
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
                      {/* Top Badges Bar */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {/* Direct ADO Work Item Link Badge */}
                        {directAdoUrl ? (
                          <div className="inline-flex items-center bg-[var(--primary-light)] border border-[var(--primary)]/30 rounded-md overflow-hidden shadow-2xs">
                            <a
                              href={directAdoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[11px] font-bold text-[var(--primary)] px-2 py-0.5 hover:underline flex items-center gap-1"
                              title="Open work item directly in Azure DevOps"
                            >
                              <Building2 size={10} />
                              <span>ADO #{defect.adoId || 'Link'}</span>
                              <ExternalLink size={10} />
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyDirectLink(defect, e)}
                              className="px-1.5 py-0.5 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors cursor-pointer border-l border-[var(--primary)]/30"
                              title="Copy direct ADO link"
                            >
                              {isCopied ? <Check size={11} className="text-[var(--low)]" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ) : defect.adoId ? (
                          <span className="font-mono text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md border border-[var(--border)] flex items-center gap-1">
                            <Building2 size={10} />
                            ADO #{defect.adoId}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-[var(--internal-ado-bg)] text-[var(--internal-ado)] border-[var(--internal-ado)]/30">
                            <Building2 size={10} />
                            Azure DevOps
                          </span>
                        )}

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                          {sev.label}
                        </span>

                        {defect.priority && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            defect.priority === 'critical' ? 'bg-red-500/15 text-red-600 border-red-500/30' :
                            defect.priority === 'high' ? 'bg-orange-500/15 text-orange-600 border-orange-500/30' :
                            defect.priority === 'medium' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' :
                            'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                          }`}>
                            {defect.priority === 'critical' ? 'P1 Critical' :
                             defect.priority === 'high' ? 'P2 High' :
                             defect.priority === 'medium' ? 'P3 Medium' : 'P4 Low'}
                          </span>
                        )}

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                          {st.label}
                        </span>

                        {defect.customerName && (
                          <span className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md border border-[var(--primary)]/30">
                            Client: {defect.customerName}
                          </span>
                        )}

                        <span 
                          className="text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1"
                          title="Area Path: ACM"
                        >
                          <FolderGit2 size={11} className="text-[var(--primary)]" />
                          ACM
                        </span>

                        {(defect.iterationPath || rel?.iterationPath || rel?.name) && (
                          <span className="text-[11px] font-semibold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Rocket size={11} />
                            {defect.iterationPath || rel?.iterationPath || rel?.name}
                          </span>
                        )}
                      </div>

                      {/* Defect Title */}
                      <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                        <HighlightText text={defect.title} query={search} />
                      </h3>

                      {defect.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                          <HighlightText text={defect.description} query={search} />
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
                              <HighlightText text={defect.stepsToReproduce} query={search} />
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
                          <button
                            key={i}
                            type="button"
                            onClick={() => setFilterTag(tag)}
                            className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-hover)] hover:border-[var(--primary)] hover:text-[var(--primary)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                            title={`Filter by tag: ${tag}`}
                          >
                            <Tag size={10} className="text-[var(--primary)]" />
                            <span>#{tag}</span>
                          </button>
                        ))}
                      </div>

                      {/* Prominent Assigned To & Created By Meta Bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-[var(--border)] text-xs">
                        {/* Assigned To Section */}
                        <div className="flex items-center gap-2 bg-[var(--surface-hover)]/60 px-2.5 py-1.5 rounded-xl border border-[var(--border)]">
                          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider shrink-0">
                            Assigned To:
                          </span>
                          {assignee ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                                style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                              >
                                {assignee.name.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="font-semibold text-[var(--text-primary)] truncate" title={assignee.name}>
                                {assignee.name}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] truncate shrink-0">
                                ({assignee.role})
                              </span>
                            </div>
                          ) : (
                            <span className="italic text-[var(--text-muted)] font-medium">Unassigned</span>
                          )}
                        </div>

                        {/* Created By / Reported By Section */}
                        <div className="flex items-center gap-2 bg-[var(--surface-hover)]/60 px-2.5 py-1.5 rounded-xl border border-[var(--border)]">
                          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider shrink-0">
                            Created By:
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                              <User size={12} />
                            </div>
                            <span className="font-semibold text-[var(--text-secondary)] truncate" title={defect.createdByName || 'QA Lead'}>
                              {defect.createdByName || 'QA Lead'}
                            </span>
                          </div>
                        </div>

                        {/* Timestamp & Direct Link Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>Updated {defect.updatedAt || defect.createdAt}</span>
                          </div>
                          {directAdoUrl && (
                            <a
                              href={directAdoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--primary)] hover:underline font-bold flex items-center gap-1 ml-2"
                              title="Direct link to Azure DevOps work item"
                            >
                              <span>ADO Link</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions Toolbar */}
                  <div className="flex items-center gap-1 text-[var(--text-muted)] flex-shrink-0">
                    {directAdoUrl && (
                      <a
                        href={directAdoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg cursor-pointer transition-all"
                        title="Open direct work item in Azure DevOps"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
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
                      title="Edit Defect"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteDefect(defect.id)}
                      className="p-1.5 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg cursor-pointer transition-all"
                      title="Delete Defect"
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
              All clear or no defects logged yet for the selected filters.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              {totalActiveFilters > 0 && (
                <button
                  onClick={handleResetAll}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
              <button
                onClick={openAddModal}
                className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Log New Defect</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal with Created By, Assigned To, Tags and Direct ADO Link */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Bug size={18} className="text-[var(--primary)]" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {editingDefect ? 'Edit Defect' : 'Log New Defect'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
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

              {/* ADO ID and ADO URL (Direct link configuration) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    ADO Work Item ID #
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 10293"
                    value={adoIdInput}
                    onChange={(e) => setAdoIdInput(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                    <span>Direct ADO URL (Optional)</span>
                    {adoUrlInput && (
                      <a
                        href={adoUrlInput}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--primary)] hover:underline flex items-center gap-0.5 text-[10px]"
                      >
                        <ExternalLink size={10} />
                        <span>Test</span>
                      </a>
                    )}
                  </label>
                  <input
                    type="url"
                    placeholder="https://dev.azure.com/org/project/_workitems/edit/10293"
                    value={adoUrlInput}
                    onChange={(e) => setAdoUrlInput(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Severity</label>
                  <SearchableSelect
                    options={[
                      { value: 'critical', label: 'Critical (S1)', icon: <Flame size={13} className="text-[var(--critical)]" /> },
                      { value: 'high', label: 'High (S2)', icon: <AlertCircle size={13} className="text-[var(--high)]" /> },
                      { value: 'medium', label: 'Medium (S3)', icon: <Bug size={13} className="text-[var(--medium)]" /> },
                      { value: 'low', label: 'Low (S4)', icon: <CheckCircle2 size={13} className="text-[var(--low)]" /> }
                    ]}
                    value={severity}
                    onChange={(val) => setSeverity(val as Severity)}
                    placeholder="Severity"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Priority</label>
                  <SearchableSelect
                    options={[
                      { value: 'critical', label: 'Critical (P1)', icon: <Flame size={13} className="text-[var(--critical)]" /> },
                      { value: 'high', label: 'High (P2)', icon: <AlertCircle size={13} className="text-[var(--high)]" /> },
                      { value: 'medium', label: 'Medium (P3)', icon: <Bug size={13} className="text-[var(--medium)]" /> },
                      { value: 'low', label: 'Low (P4)', icon: <CheckCircle2 size={13} className="text-[var(--low)]" /> }
                    ]}
                    value={priority}
                    onChange={(val) => setPriority(val as Priority)}
                    placeholder="Priority"
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

              {/* People: Assigned To and Created By */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1">
                    <UserCheck size={13} className="text-[var(--primary)]" />
                    <span>Assigned To</span>
                  </label>
                  <SearchableSelect
                    options={modalAssigneeOptions}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="Select Assignee"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1">
                    <User size={13} className="text-[var(--primary)]" />
                    <span>Created / Reported By</span>
                  </label>
                  <SearchableSelect
                    options={modalCreatorOptions}
                    value={createdByName}
                    onChange={setCreatedByName}
                    placeholder="Select Creator"
                  />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-3">
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

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Release / Iteration (ACM)
                    </label>
                    <SearchableSelect
                      options={modalReleaseOptions}
                      value={releaseId}
                      onChange={setReleaseId}
                      placeholder="Select Release"
                    />
                  </div>
                </div>

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
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                  <span>Tags (Comma-separated)</span>
                  <span className="text-[10px] text-[var(--text-muted)]">e.g. concurrency, database, blocker</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Concurrency, Database, Blocker"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Defect Description</label>
                <textarea
                  rows={2}
                  placeholder="What is the observed vs expected behavior?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Steps to Reproduce</label>
                <textarea
                  rows={3}
                  placeholder="1. Navigate to /schedule&#10;2. Select slot 14:00&#10;3. Submit simultaneously"
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none font-mono text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Root Cause Hypothesis (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Missing PostgreSQL optimistic locking on slot_reservation"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
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
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs"
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
                {aiModelUsed && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-mono">
                    {aiModelUsed}
                  </span>
                )}
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
              {selectedAiDefect && (
                <div className="p-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Target Defect:</span>
                    <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                      {selectedAiDefect.adoId ? `#${selectedAiDefect.adoId} - ` : ''}{selectedAiDefect.title}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${SEVERITY_CONFIG[selectedAiDefect.severity].bg} ${SEVERITY_CONFIG[selectedAiDefect.severity].text} ${SEVERITY_CONFIG[selectedAiDefect.severity].border}`}>
                    {SEVERITY_CONFIG[selectedAiDefect.severity].label}
                  </span>
                </div>
              )}

              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    Analyzing defect logs, reproduction steps, and root causes...
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Connecting to Google Gemini with automated fallback redundancy...
                  </p>
                </div>
              ) : aiError ? (
                <div className="p-4 bg-[var(--critical-bg)] border border-[var(--critical-border)] rounded-xl flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={18} className="text-[var(--critical)] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-[var(--critical)]">AI Generation Notice</h4>
                      <p className="text-xs text-[var(--text-primary)] mt-1 leading-relaxed">
                        {aiError}
                      </p>
                    </div>
                  </div>
                  {selectedAiDefect && (
                    <div className="flex justify-end pt-2 border-t border-[var(--critical-border)]">
                      <button
                        type="button"
                        onClick={() => handleRunAiAnalysis(selectedAiDefect)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--critical)] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                      >
                        <RotateCcw size={13} />
                        Retry Analysis
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed bg-[var(--surface-hover)] p-4 rounded-xl border border-[var(--border)] font-mono">
                  {aiAnalysisResult}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <div>
                  {!aiLoading && !aiError && aiAnalysisResult && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(aiAnalysisResult);
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      Copy Analysis
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!aiLoading && selectedAiDefect && !aiError && (
                    <button
                      type="button"
                      onClick={() => handleRunAiAnalysis(selectedAiDefect)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      Regenerate
                    </button>
                  )}
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
        </div>
      )}
    </div>
  );
};
