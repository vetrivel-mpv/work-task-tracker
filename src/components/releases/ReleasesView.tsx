import React, { useState } from 'react';
import { Release, ReleaseStatus, UserStory, Defect, Task } from '../../types';
import { 
  Plus, 
  Rocket, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Edit3, 
  Trash2, 
  Clock, 
  ShieldCheck,
  FolderGit2,
  Layers,
  Filter
} from 'lucide-react';
import { generateReleaseNotes } from '../../services/aiService';
import { generateId, toDateStr, formatDisplayDate } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber } from '../../utils/adoPaths';

interface ReleasesViewProps {
  releases: Release[];
  userStories: UserStory[];
  defects: Defect[];
  tasks: Task[];
  geminiApiKey?: string;
  onAddRelease: (release: Release) => void;
  onUpdateRelease: (release: Release) => void;
  onDeleteRelease: (releaseId: string) => void;
}

const STATUS_CONFIG: { [key in ReleaseStatus]: { label: string; bg: string; text: string } } = {
  Planning: { label: 'Planning', bg: 'bg-[#F3F6F4]', text: 'text-[#5A675F]' },
  'Active QA': { label: 'Active QA', bg: 'bg-[#F4EBFF]', text: 'text-[#7C3AED]' },
  Staging: { label: 'Staging', bg: 'bg-[#E0F2FE]', text: 'text-[#0284C7]' },
  Deployed: { label: 'Deployed', bg: 'bg-[#E8F3F0]', text: 'text-[#0C6E5E]' },
  Archived: { label: 'Archived', bg: 'bg-[#F3F6F4]', text: 'text-[#84918A]' }
};

export const ReleasesView: React.FC<ReleasesViewProps> = ({
  releases,
  userStories,
  defects,
  tasks,
  geminiApiKey,
  onAddRelease,
  onUpdateRelease,
  onDeleteRelease
}) => {
  const [filterAreaPath, setFilterAreaPath] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [iterationPath, setIterationPath] = useState('');
  const [areaPath, setAreaPath] = useState('');
  const [releaseNumber, setReleaseNumber] = useState('');
  const [status, setStatus] = useState<ReleaseStatus>('Active QA');
  const [description, setDescription] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');

  // AI Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotesResult, setAiNotesResult] = useState('');
  const [selectedAiRelease, setSelectedAiRelease] = useState<Release | null>(null);

  const availableAreaPaths = getAllAreaPaths(releases, userStories, defects);
  const returnedIterationPaths = getIterationPathsForArea(filterAreaPath, releases, userStories, defects);

  const filteredReleases = releases.filter(rel => {
    if (!filterAreaPath) return true;
    const rArea = (rel.areaPath || '').toLowerCase();
    const targetArea = filterAreaPath.toLowerCase();
    const matchesAreaDirectly = rArea === targetArea || rArea.includes(targetArea);
    const matchesReturnedIteration = returnedIterationPaths.some(iter => iter.releaseId === rel.id);
    return matchesAreaDirectly || matchesReturnedIteration;
  });

  const openAddModal = () => {
    setEditingRelease(null);
    setName('');
    setTargetDate(toDateStr(new Date()));
    setIterationPath('CareFlow\\Sprint 24');
    setAreaPath(filterAreaPath || 'CareFlow-Core\\EHR-Connect');
    setReleaseNumber('v4.2.0');
    setStatus('Active QA');
    setDescription('');
    setScopeNotes('');
    setModalOpen(true);
  };

  const openEditModal = (rel: Release) => {
    setEditingRelease(rel);
    setName(rel.name);
    setTargetDate(rel.targetDate);
    setIterationPath(rel.iterationPath || '');
    setAreaPath(rel.areaPath || 'CareFlow-Core\\EHR-Connect');
    setReleaseNumber(rel.releaseNumber || extractReleaseNumber(rel.name));
    setStatus(rel.status);
    setDescription(rel.description || '');
    setScopeNotes(rel.scopeNotes || '');
    setModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetDate) return;

    if (editingRelease) {
      onUpdateRelease({
        ...editingRelease,
        name: name.trim(),
        targetDate,
        iterationPath: iterationPath.trim() || undefined,
        areaPath: areaPath.trim() || undefined,
        releaseNumber: releaseNumber.trim() || undefined,
        status,
        description: description.trim() || undefined,
        scopeNotes: scopeNotes.trim() || undefined
      });
    } else {
      onAddRelease({
        id: generateId('rel'),
        name: name.trim(),
        targetDate,
        iterationPath: iterationPath.trim() || undefined,
        areaPath: areaPath.trim() || undefined,
        releaseNumber: releaseNumber.trim() || undefined,
        status,
        description: description.trim() || undefined,
        scopeNotes: scopeNotes.trim() || undefined,
        createdAt: toDateStr(new Date())
      });
    }

    setModalOpen(false);
  };

  const handleGenerateAiNotes = async (rel: Release) => {
    setSelectedAiRelease(rel);
    setAiNotesResult('');
    setAiLoading(true);
    setAiModalOpen(true);

    const relStories = userStories.filter(s => s.releaseId === rel.id);
    const relDefects = defects.filter(d => d.releaseId === rel.id);

    const res = await generateReleaseNotes(rel, relStories, relDefects, geminiApiKey);
    setAiLoading(false);
    if (res.ok && res.text) {
      setAiNotesResult(res.text);
    } else {
      setAiNotesResult(`⚠️ AI Generation could not complete: ${res.error}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Releases & Scope Planner</h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Milestones, release verification gates, and ADO Iteration / Area mappings
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Area Path filter */}
          <div className="flex items-center gap-2 bg-[var(--surface-hover)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
            <Layers size={13} className="text-[var(--primary)] flex-shrink-0" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Area:</span>
            <select
              value={filterAreaPath}
              onChange={(e) => setFilterAreaPath(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="">All Area Paths</option>
              {availableAreaPaths.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} />
            <span>New Release</span>
          </button>
        </div>
      </div>

      {filterAreaPath && (
        <div className="bg-[var(--primary-light)] border border-[var(--primary)]/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-[var(--primary)] flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-bold">Filtered Area:</span>
            <span className="font-mono bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)] font-bold truncate">{filterAreaPath}</span>
            <span>&rarr; Returned {returnedIterationPaths.length} Iteration Path(s) / Releases</span>
          </div>
          <button
            onClick={() => setFilterAreaPath('')}
            className="font-bold underline hover:opacity-80 cursor-pointer flex-shrink-0"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Releases Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReleases.map(rel => {
          const st = STATUS_CONFIG[rel.status] || STATUS_CONFIG['Planning'];
          const relStories = userStories.filter(s => s.releaseId === rel.id);
          const relDefects = defects.filter(d => d.releaseId === rel.id);
          const passedStories = relStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
          const openDefects = relDefects.filter(d => d.status !== 'Closed').length;
          const criticalDefects = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
          const relNum = rel.releaseNumber || extractReleaseNumber(rel.name);

          return (
            <div
              key={rel.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[var(--primary)] transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-md border border-[var(--border)]">
                      {relNum}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[var(--text-muted)] flex-shrink-0">
                    <button
                      onClick={() => openEditModal(rel)}
                      className="p-1 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteRelease(rel.id)}
                      className="p-1 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug break-words">{rel.name}</h3>
                
                {rel.description && (
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-1.5 leading-relaxed">
                    {rel.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] mt-3">
                  <Calendar size={13} className="text-[var(--primary)] flex-shrink-0" />
                  <span>Target: {formatDisplayDate(rel.targetDate)}</span>
                </div>

                {rel.areaPath && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-1.5 font-mono min-w-0">
                    <Layers size={13} className="text-[var(--text-muted)] flex-shrink-0" />
                    <span className="text-[11px] font-semibold truncate" title={rel.areaPath}>Area: {rel.areaPath}</span>
                  </div>
                )}

                {rel.iterationPath && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--primary)] mt-1 font-mono min-w-0">
                    <FolderGit2 size={13} className="flex-shrink-0" />
                    <span className="text-[11px] font-bold truncate" title={rel.iterationPath}>{rel.iterationPath}</span>
                  </div>
                )}

                {/* Scope & QA Metrics Pill Container */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                  <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-2.5 text-center">
                    <div className="text-sm font-black text-[var(--primary)]">
                      {passedStories}/{relStories.length}
                    </div>
                    <div className="text-[10.5px] font-bold text-[var(--text-muted)] uppercase">Stories Passed</div>
                  </div>

                  <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-2.5 text-center">
                    <div className={`text-sm font-black ${criticalDefects > 0 ? 'text-[var(--critical)]' : 'text-[var(--text-primary)]'}`}>
                      {openDefects} {criticalDefects > 0 && `(${criticalDefects} Crit)`}
                    </div>
                    <div className="text-[10.5px] font-bold text-[var(--text-muted)] uppercase">Open Bugs</div>
                  </div>
                </div>
              </div>

              {/* AI Release Notes Generator Button */}
              <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => handleGenerateAiNotes(rel)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white text-[var(--primary)] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Generate AI Release Notes</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editingRelease ? 'Edit Release' : 'New Release'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Release Name <span className="text-[var(--critical)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Release 4.2 - Telehealth & EHR Connect"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!releaseNumber || releaseNumber === 'v4.2.0') {
                      setReleaseNumber(extractReleaseNumber(e.target.value));
                    }
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Release / Version # <span className="text-[var(--critical)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. v4.2.0"
                    value={releaseNumber}
                    onChange={(e) => setReleaseNumber(e.target.value)}
                    className="w-full text-xs font-mono font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Target Date <span className="text-[var(--critical)]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Area Path (ADO)</label>
                  <input
                    type="text"
                    placeholder="e.g. CareFlow-Core\EHR-Connect"
                    value={areaPath}
                    onChange={(e) => setAreaPath(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] font-mono focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="Planning">Planning</option>
                    <option value="Active QA">Active QA</option>
                    <option value="Staging">Staging</option>
                    <option value="Deployed">Deployed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Iteration Path (ADO Sync)</label>
                <input
                  type="text"
                  placeholder="e.g. CareFlow\Sprint 24"
                  value={iterationPath}
                  onChange={(e) => setIterationPath(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] font-mono focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Description / Goals</label>
                <textarea
                  rows={2}
                  placeholder="Core objectives for this release..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)] mt-auto flex-shrink-0">
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
                  {editingRelease ? 'Update Release' : 'Create Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Release Notes Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-hover)] flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold flex-shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">Gemini Release Notes & Risk Matrix</h2>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{selectedAiRelease?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer flex-shrink-0"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin mb-3"></div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Synthesizing Release Scope & Launch Risks…</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Aggregating user stories, defect severity, and test coverage.</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap bg-[var(--surface-hover)] p-4 rounded-xl border border-[var(--border)]">
                  {aiNotesResult}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-hover)] flex-shrink-0">
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
