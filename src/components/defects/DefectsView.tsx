import React, { useState } from 'react';
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
  FolderGit2
} from 'lucide-react';
import { generateDefectAnalysis } from '../../services/aiService';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber } from '../../utils/adoPaths';

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
    const defArea = defect.areaPath || releases.find(r => r.id === defect.releaseId)?.areaPath || 'CareFlow-Core\\EHR-Connect';
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

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
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
        customerName: sourceInstance === 'external' ? customerName.trim() : undefined,
        areaPath: sourceInstance === 'internal' ? areaPath : undefined,
        userStoryId: userStoryId || null,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        environment,
        tags,
        rootCause: rootCause.trim() || undefined,
        updatedAt: now,
        closedAt: status === 'Closed' ? now : undefined
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
        customerName: sourceInstance === 'external' ? customerName.trim() : undefined,
        areaPath: sourceInstance === 'internal' ? areaPath : undefined,
        userStoryId: userStoryId || null,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        environment,
        tags,
        rootCause: rootCause.trim() || undefined,
        createdAt: now,
        updatedAt: now
      });
    }

    setModalOpen(false);
  };

  const handleRunAiAnalysis = async (defect: Defect) => {
    setSelectedAiDefect(defect);
    setAiAnalysisResult('');
    setAiLoading(true);
    setAiModalOpen(true);

    const linkedStory = userStories.find(s => s.id === defect.userStoryId);
    const result = await generateDefectAnalysis(defect, linkedStory, geminiApiKey);

    setAiLoading(false);
    if (result.ok && result.text) {
      setAiAnalysisResult(result.text);
    } else {
      setAiAnalysisResult(`⚠️ AI Analysis could not complete: ${result.error}`);
    }
  };

  const toggleSteps = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter defects
  const filteredDefects = defects.filter(d => {
    if (filterSource !== 'all' && (d.sourceInstance || 'internal') !== filterSource) return false;
    
    // Area Path filter (returns matching iterations/releases in internal ADO)
    if (filterAreaPath) {
      const dArea = (d.areaPath || releases.find(r => r.id === d.releaseId)?.areaPath || '').toLowerCase();
      const targetArea = filterAreaPath.toLowerCase();
      const matchesAreaDirectly = dArea === targetArea || dArea.includes(targetArea);
      const matchesReturnedIteration = returnedIterationPaths.some(
        iter => iter.releaseId === d.releaseId
      );
      if (!matchesAreaDirectly && !matchesReturnedIteration) return false;
    }

    if (filterRelease && d.releaseId !== filterRelease) return false;
    if (filterSeverity && d.severity !== filterSeverity) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = d.title.toLowerCase().includes(q);
      const matchDesc = (d.description || '').toLowerCase().includes(q);
      const matchAdo = d.adoId ? String(d.adoId).includes(q) : false;
      const matchCustomer = (d.customerName || '').toLowerCase().includes(q);
      const matchArea = (d.areaPath || '').toLowerCase().includes(q);
      const matchTag = (d.tags || []).some(t => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchAdo || matchTag || matchCustomer || matchArea;
    }
    return true;
  });

  // Metrics
  const criticalCount = filteredDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const closedCount = filteredDefects.filter(d => d.status === 'Closed').length;
  const externalCount = defects.filter(d => d.sourceInstance === 'external').length;
  const internalCount = defects.filter(d => (d.sourceInstance || 'internal') === 'internal').length;
  const resolutionRate = filteredDefects.length > 0 ? Math.round((closedCount / filteredDefects.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner & QA Health */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Defects & Customer OPS Tracker</h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              Dual-source defect triage: Internal QA Dev Bugs + External Customer OPS Tickets
            </p>
          </div>

          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 bg-[var(--critical-bg)] border border-[var(--critical-border)] px-3.5 py-1.5 rounded-xl text-xs font-bold text-[var(--critical)]">
                <Flame size={14} />
                <span>{criticalCount} Critical Active</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-1.5 rounded-xl text-xs font-bold">
              <span className="text-[var(--text-muted)]">Resolution:</span>
              <span className="text-[var(--primary)]">{resolutionRate}%</span>
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

        {/* Source Switcher Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => setFilterSource('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterSource === 'all'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Defects ({defects.length})
          </button>
          <button
            onClick={() => setFilterSource('internal')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterSource === 'external'
                ? 'bg-[var(--external-ado)] text-white shadow-xs'
                : 'bg-[var(--external-ado-bg)] text-[var(--external-ado)] hover:opacity-80'
            }`}
          >
            <Globe2 size={13} />
            <span>External Customer OPS ({externalCount})</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search defects by title, steps, customer, Area Path, tags, or ADO #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)]"
            />
          </div>

          {/* Area Path filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]">Area:</span>
            <select
              value={filterAreaPath}
              onChange={(e) => {
                setFilterAreaPath(e.target.value);
                setFilterRelease('');
              }}
              className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="">All Area Paths</option>
              {availableAreaPaths.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* Iteration filter (returned for Area) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]">Iteration:</span>
            <select
              value={filterRelease}
              onChange={(e) => setFilterRelease(e.target.value)}
              className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer max-w-[220px]"
            >
              <option value="">
                {filterAreaPath ? `All Iterations in Area (${returnedIterationPaths.length})` : 'All Releases / Iterations'}
              </option>
              {returnedIterationPaths.map(iter => (
                <option key={iter.iterationPath + iter.releaseId} value={iter.releaseId}>
                  {iter.releaseName} ({iter.releaseNumber})
                </option>
              ))}
            </select>
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Active">Active</option>
            <option value="Fixed">Fixed</option>
            <option value="Retest">Retest</option>
            <option value="Closed">Closed</option>
          </select>
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
                className={`bg-[var(--surface)] border rounded-2xl p-4.5 transition-all shadow-xs ${
                  defect.severity === 'critical' && defect.status !== 'Closed'
                    ? 'border-[var(--critical-border)] bg-[var(--critical-bg)]/20'
                    : 'border-[var(--border)] hover:border-[var(--primary)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div 
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 ${sev.bg} ${sev.text} border ${sev.border}`}
                    >
                      <Bug size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {/* ADO Instance Indicator */}
                        {isExternal ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--external-ado)] bg-[var(--external-ado-bg)] px-2 py-0.5 rounded-md border border-[var(--external-ado)]/20">
                            <Globe2 size={10} />
                            <span>External OPS ADO</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--internal-ado)] bg-[var(--internal-ado-bg)] px-2 py-0.5 rounded-md border border-[var(--internal-ado)]/20">
                            <Building2 size={10} />
                            <span>Internal Dev ADO</span>
                          </span>
                        )}

                        {/* Area Path Badge */}
                        <span className="text-[10.5px] font-mono font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                          {defArea}
                        </span>

                        {rel && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md">
                            <FolderGit2 size={11} />
                            <span>{rel.name}</span>
                            <span className="font-mono text-[10px] bg-white/70 px-1 py-0.2 rounded">
                              {rel.releaseNumber || extractReleaseNumber(rel.name)}
                            </span>
                          </span>
                        )}

                        {defect.customerName && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#8B5CF6] bg-[#EDE9FE] px-2 py-0.5 rounded-md">
                            <LifeBuoy size={11} />
                            <span>Client: {defect.customerName}</span>
                          </span>
                        )}

                        {defect.adoId && (
                          <span className="text-[10.5px] font-bold text-[var(--critical)] bg-[var(--critical-bg)] px-2 py-0.5 rounded-md border border-[var(--critical-border)]">
                            DEF-{defect.adoId}
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${sev.bg} ${sev.text} ${sev.border}`}>
                          {sev.label}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                        {defect.environment && (
                          <span className="text-[10.5px] font-bold text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            Env: {defect.environment}
                          </span>
                        )}
                        {story && (
                          <span className="text-[11px] font-semibold text-[var(--primary)]">
                            &bull; Story: {story.adoId ? `#${story.adoId}` : story.title.slice(0, 24)}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                        {defect.title}
                      </h3>

                      {defect.description && (
                        <p className="text-xs text-[var(--text-secondary)] font-medium mt-1 leading-relaxed">
                          {defect.description}
                        </p>
                      )}

                      {/* Tags */}
                      {defect.tags && defect.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {defect.tags.map((tag, idx) => (
                            <span key={idx} className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-subtle)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Repro Steps & Root Cause Actions */}
                      <div className="flex flex-wrap items-center gap-3 mt-3 pt-2.5 border-t border-[var(--border)]">
                        {defect.stepsToReproduce && (
                          <button
                            onClick={() => toggleSteps(defect.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            <Terminal size={13} />
                            <span>Steps to Reproduce</span>
                            {isStepsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}

                        {defect.rootCause && (
                          <span className="text-xs text-[var(--text-secondary)]">
                            <strong>Root Cause:</strong> {defect.rootCause}
                          </span>
                        )}

                        {/* AI Defect Analyzer Button */}
                        <button
                          onClick={() => handleRunAiAnalysis(defect)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] bg-[#F4EBFF] hover:bg-[#E9D7FE] px-2.5 py-1 rounded-lg transition-colors ml-auto cursor-pointer"
                          title="Generate RCA hypotheses and exhaustive QA verification plan"
                        >
                          <Sparkles size={13} />
                          <span>AI Triage & QA Plan</span>
                        </button>
                      </div>

                      {/* Expanded Steps Box */}
                      {isStepsExpanded && defect.stepsToReproduce && (
                        <div className="mt-3 bg-[#0F172A] text-[#E2E8F0] rounded-xl p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap border border-[#334155]">
                          {defect.stepsToReproduce}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Assignee & Actions */}
                  <div className="flex items-center gap-3">
                    {assignee ? (
                      <div className="flex items-center gap-1.5" title={assignee.role}>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: assignee.avatarColor || 'var(--primary)' }}
                        >
                          {assignee.name[0]}
                        </div>
                        <span className="text-xs font-bold text-[var(--text-primary)] hidden sm:inline">{assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)] italic">Unassigned</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(defect)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
                        title="Edit Defect"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteDefect(defect.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg transition-colors cursor-pointer"
                        title="Delete Defect"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center flex flex-col items-center justify-center text-[var(--text-muted)]">
            <CheckCircle2 size={32} className="mb-2 opacity-30 text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">No Defects Found</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1">
              All defects in this filter are resolved or no bugs have been logged yet.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Log New Defect
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editingDefect ? 'Edit Defect / Ticket' : 'Log New Defect / OPS Ticket'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
                        ? 'border-[var(--internal-ado)] bg-[var(--internal-ado-bg)] text-[var(--internal-ado)]'
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
                        ? 'border-[var(--external-ado)] bg-[var(--external-ado-bg)] text-[var(--external-ado)]'
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
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DefectStatus)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    <option value="New">New</option>
                    <option value="Active">Active</option>
                    <option value="Fixed">Fixed</option>
                    <option value="Retest">Retest</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    <option value="QA">QA</option>
                    <option value="Staging">Staging</option>
                    <option value="Prod">Production</option>
                    <option value="Dev">Dev</option>
                  </select>
                </div>
              </div>

              {sourceInstance === 'internal' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Area Path (ADO)
                    </label>
                    <select
                      value={areaPath}
                      onChange={(e) => {
                        const newArea = e.target.value;
                        setAreaPath(newArea);
                        const iters = getIterationPathsForArea(newArea, releases, userStories, defects);
                        if (iters.length > 0) {
                          setReleaseId(iters[0].releaseId);
                        }
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                    >
                      {availableAreaPaths.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Returned Iteration Path / Release
                    </label>
                    <select
                      value={releaseId}
                      onChange={(e) => setReleaseId(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                    >
                      <option value="">No Release Linked</option>
                      {modalReturnedIterations.map(iter => (
                        <option key={iter.iterationPath + iter.releaseId} value={iter.releaseId}>
                          {iter.iterationPath} ({iter.releaseNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Linked Story</label>
                  <select
                    value={userStoryId}
                    onChange={(e) => setUserStoryId(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                  >
                    <option value="">No Story</option>
                    {userStories.map(s => (
                      <option key={s.id} value={s.id}>{s.adoId ? `US-${s.adoId}: ` : ''}{s.title}</option>
                    ))}
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
                  placeholder="e.g. Missing transaction isolation on booking table"
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

      {/* AI Triage & Analysis Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F4EBFF] text-[#7C3AED] flex items-center justify-center font-bold">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">Gemini Defect RCA & QA Test Plan</h2>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate max-w-md">{selectedAiDefect?.title}</p>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                &times;
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin mb-3"></div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Analyzing Defect & Formulating Test Plan…</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Grounded on root cause patterns and regression boundaries.</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap bg-[var(--surface-hover)] p-4 rounded-xl border border-[var(--border)]">
                  {aiAnalysisResult}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <button
                onClick={() => setAiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

