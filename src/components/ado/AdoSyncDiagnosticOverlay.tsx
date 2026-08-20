import React, { useState, useMemo } from 'react';
import {
  X,
  Code2,
  Table,
  Terminal,
  Copy,
  Check,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Clock,
  Database,
  ArrowRight,
  ExternalLink,
  Trash2,
  RefreshCw,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { AdoSyncDiagnosticRecord, FieldMappingDiff } from '../../services/adoService';

interface AdoSyncDiagnosticOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosticHistory: AdoSyncDiagnosticRecord[];
  onClearHistory: () => void;
  onTriggerSync?: (target: 'all' | 'internal' | 'external') => void;
  isSyncing?: boolean;
}

export const AdoSyncDiagnosticOverlay: React.FC<AdoSyncDiagnosticOverlayProps> = ({
  isOpen,
  onClose,
  diagnosticHistory,
  onClearHistory,
  onTriggerSync,
  isSyncing = false
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    diagnosticHistory[0]?.id || ''
  );
  const [activeSubTab, setActiveSubTab] = useState<'raw_json' | 'mapping_diff' | 'wiql_request' | 'troubleshooter'>('raw_json');
  const [jsonSearchQuery, setJsonSearchQuery] = useState('');
  const [mappingTypeFilter, setMappingTypeFilter] = useState<'all' | 'Defect' | 'Story'>('all');
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [jsonViewSection, setJsonViewSection] = useState<'full' | 'defects' | 'stories' | 'wiql'>('full');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);

  // Sync selected record when history updates
  const activeRecord = useMemo(() => {
    return diagnosticHistory.find(r => r.id === selectedRecordId) || diagnosticHistory[0] || null;
  }, [diagnosticHistory, selectedRecordId]);

  // Filtered raw payload JSON string
  const activeJsonData = useMemo(() => {
    if (!activeRecord) return {};
    if (jsonViewSection === 'defects') {
      return activeRecord.rawPayload?.defects || activeRecord.fieldMappings.filter(m => m.mappedType === 'Defect');
    }
    if (jsonViewSection === 'stories') {
      return activeRecord.rawPayload?.stories || activeRecord.fieldMappings.filter(m => m.mappedType === 'Story');
    }
    if (jsonViewSection === 'wiql') {
      return {
        query: activeRecord.wiqlQuery,
        targetProject: activeRecord.project,
        areaPath: activeRecord.areaPath,
        iterationPath: activeRecord.iterationPath,
        rawWiqlPayload: activeRecord.rawPayload?.wiql
      };
    }
    return activeRecord.rawPayload;
  }, [activeRecord, jsonViewSection]);

  // Filtered field mappings
  const filteredFieldMappings = useMemo(() => {
    if (!activeRecord) return [];
    return activeRecord.fieldMappings.filter(item => {
      if (mappingTypeFilter !== 'all' && item.mappedType !== mappingTypeFilter) {
        return false;
      }
      if (mappingSearchQuery.trim()) {
        const q = mappingSearchQuery.toLowerCase();
        const matchesId = item.adoId.toString().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesAssignee = item.mappedAssignee.toLowerCase().includes(q);
        const matchesArea = item.mappedArea.toLowerCase().includes(q);
        const matchesState = item.mappedStatus.toLowerCase().includes(q);
        return matchesId || matchesTitle || matchesAssignee || matchesArea || matchesState;
      }
      return true;
    });
  }, [activeRecord, mappingTypeFilter, mappingSearchQuery]);

  const rawJsonFormatted = JSON.stringify(activeJsonData, null, 2);

  const defectsCount = activeRecord?.fieldMappings.filter(m => m.mappedType === 'Defect').length || activeRecord?.defectsCount || 0;
  const storiesCount = activeRecord?.fieldMappings.filter(m => m.mappedType === 'Story').length || activeRecord?.storiesCount || 0;

  const handleCopyJson = () => {
    if (!activeRecord) return;
    let dataToCopy = activeRecord.rawPayload || activeRecord;
    if (jsonViewSection === 'defects') {
      dataToCopy = activeRecord.rawPayload?.defects || activeRecord.fieldMappings.filter(m => m.mappedType === 'Defect');
    } else if (jsonViewSection === 'stories') {
      dataToCopy = activeRecord.rawPayload?.stories || activeRecord.fieldMappings.filter(m => m.mappedType === 'Story');
    } else if (jsonViewSection === 'wiql') {
      dataToCopy = { wiqlQuery: activeRecord.wiqlQuery, rawWiql: activeRecord.rawPayload?.wiql };
    }
    const jsonStr = JSON.stringify(dataToCopy, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyWiql = () => {
    if (!activeRecord?.wiqlQuery) return;
    navigator.clipboard.writeText(activeRecord.wiqlQuery);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!activeRecord) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeRecord.rawPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ado-sync-diagnostic-${activeRecord.timestamp.replace(/[^0-9]/g, '')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[900px] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Code2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">ADO Sync Diagnostic & Raw Payload Inspector</h2>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Last 5 Sync Attempts
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Inspect raw JSON responses, WIQL queries, HTTP statuses, and field mapping fidelity to debug missing or misaligned data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onTriggerSync && (
              <button
                type="button"
                onClick={() => onTriggerSync(activeRecord?.targetInstance || 'internal')}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>Trigger Fresh Sync</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ATTEMPT SELECTOR (LAST 5 ATTEMPTS TABS) */}
        <div className="px-6 py-2.5 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1 flex items-center gap-1">
              <Clock size={12} />
              <span>Attempts:</span>
            </span>

            {diagnosticHistory.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)] italic">No sync attempts logged yet. Run a sync to populate diagnostics.</span>
            ) : (
              diagnosticHistory.map((rec, idx) => {
                const isSelected = activeRecord?.id === rec.id;
                const isSuccess = rec.status === 'success';
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setSelectedRecordId(rec.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--surface)] border-[var(--primary)] text-[var(--primary)] shadow-xs'
                        : 'bg-[var(--surface)]/50 border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="font-bold">
                      #{idx + 1} {idx === 0 ? '(Latest)' : ''}
                    </span>
                    <span className="text-[10.5px] opacity-75 font-mono">
                      {rec.timestamp.split('T')[1]?.slice(0, 8) || rec.timestamp}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-[var(--surface-hover)]">
                      {rec.targetInstance}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      ({rec.itemsReceivedCount} items)
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {diagnosticHistory.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-[11px] text-[var(--text-muted)] hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto cursor-pointer flex-shrink-0"
              title="Clear all 5 recorded sync payloads"
            >
              <Trash2 size={12} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* ACTIVE ATTEMPT SUMMARY BANNER */}
        {activeRecord && (
          <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <Database size={14} className="text-[var(--primary)]" />
                <span>ADO: {activeRecord.org} / {activeRecord.project}</span>
              </div>
              <span className="text-[var(--border)]">|</span>
              <span className="text-[var(--text-secondary)]">
                Area: <strong className="text-[var(--text-primary)] font-mono">{activeRecord.areaPath || 'All'}</strong>
              </span>
              <span className="text-[var(--border)]">|</span>
              <span className="text-[var(--text-secondary)]">
                Iteration: <strong className="text-[var(--text-primary)] font-mono">{activeRecord.iterationPath || 'All'}</strong>
              </span>
              <span className="text-[var(--border)]">|</span>
              <span className="text-[var(--text-secondary)]">
                Latency: <strong className="text-emerald-600 font-mono">{activeRecord.durationMs}ms</strong>
              </span>
              <span className="text-[var(--border)]">|</span>
              <span className="text-[var(--text-secondary)]">
                Source: <strong className="text-purple-600 font-mono">{activeRecord.source}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('mapping_diff');
                  setMappingTypeFilter('Story');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  mappingTypeFilter === 'Story' && activeSubTab === 'mapping_diff'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                }`}
                title="Click to view all ingested User Stories in Mapping diff"
              >
                {storiesCount} Stories
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('mapping_diff');
                  setMappingTypeFilter('Defect');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  mappingTypeFilter === 'Defect' && activeSubTab === 'mapping_diff'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                }`}
                title="Click to view all ingested Bugs / Defects in Mapping diff"
              >
                {defectsCount} Defects
              </button>

              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>{activeRecord.fieldMappings?.length || 0} Total Parsed</span>
              </span>
            </div>
          </div>
        )}

        {/* SUB TABS NAVIGATION */}
        <div className="flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSubTab('raw_json')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'raw_json'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Code2 size={14} />
              <span>Raw JSON Payload</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('mapping_diff')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'mapping_diff'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Table size={14} />
              <span>Field Mapping Verification ({filteredFieldMappings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('wiql_request')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'wiql_request'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Terminal size={14} />
              <span>WIQL & Network Query</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('troubleshooter')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'troubleshooter'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <HelpCircle size={14} />
              <span>Troubleshooter & Bugs</span>
            </button>
          </div>

          {activeSubTab === 'raw_json' && (
            <div className="flex items-center gap-2 py-1.5">
              {/* Section selector */}
              <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setJsonViewSection('full')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${jsonViewSection === 'full' ? 'bg-[var(--primary)] text-white font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setJsonViewSection('defects')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${jsonViewSection === 'defects' ? 'bg-rose-600 text-white font-bold' : 'text-rose-600 hover:text-rose-700'}`}
                >
                  Defects ({defectsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setJsonViewSection('stories')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${jsonViewSection === 'stories' ? 'bg-blue-600 text-white font-bold' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Stories ({storiesCount})
                </button>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter JSON lines..."
                  value={jsonSearchQuery}
                  onChange={(e) => setJsonSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none w-44 text-[var(--text-primary)]"
                />
              </div>

              <button
                type="button"
                onClick={handleCopyJson}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Copy current JSON view"
              >
                {copiedPayload ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Download JSON file"
              >
                <Download size={12} />
                <span>Export</span>
              </button>
            </div>
          )}

          {activeSubTab === 'mapping_diff' && (
            <div className="flex items-center gap-2 py-1.5">
              <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setMappingTypeFilter('all')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${mappingTypeFilter === 'all' ? 'bg-[var(--primary)] text-white font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  All ({activeRecord?.fieldMappings.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setMappingTypeFilter('Defect')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${mappingTypeFilter === 'Defect' ? 'bg-rose-600 text-white font-bold' : 'text-rose-600 hover:text-rose-700'}`}
                >
                  Defects ({defectsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setMappingTypeFilter('Story')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${mappingTypeFilter === 'Story' ? 'bg-blue-600 text-white font-bold' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Stories ({storiesCount})
                </button>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter by ID, title, assignee..."
                  value={mappingSearchQuery}
                  onChange={(e) => setMappingSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none w-52 text-[var(--text-primary)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--surface)]">
          {!activeRecord ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 text-[var(--text-muted)]">
              <Code2 size={40} className="mb-3 opacity-40" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">No Diagnostic Payloads Available</h3>
              <p className="text-xs max-w-sm mt-1">
                Execute a sync cycle in the Azure DevOps connector to inspect raw payloads and WIQL queries.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: RAW JSON PAYLOAD */}
              {activeSubTab === 'raw_json' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
                    <div className="flex items-center gap-2">
                      <Info size={15} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <span>
                        Viewing {jsonViewSection === 'defects' ? 'Bugs / Defects payload' : jsonViewSection === 'stories' ? 'User Stories payload' : 'Complete JSON response'} with Azure DevOps native fields (<code className="font-mono bg-purple-200/50 dark:bg-purple-900/60 px-1 py-0.5 rounded text-[11px]">System.Title</code>, <code className="font-mono bg-purple-200/50 dark:bg-purple-900/60 px-1 py-0.5 rounded text-[11px]">System.State</code>, <code className="font-mono bg-purple-200/50 dark:bg-purple-900/60 px-1 py-0.5 rounded text-[11px]">System.WorkItemType</code>).
                      </span>
                    </div>
                    <span className="font-mono text-[11px] opacity-80">
                      Payload Size: {(new Blob([rawJsonFormatted]).size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#090D16] text-[#A5B4FC] p-4 font-mono text-[11.5px] border border-[#1E293B] shadow-inner overflow-x-auto max-h-[520px]">
                    <pre className="whitespace-pre leading-relaxed">
                      {jsonSearchQuery ? (
                        rawJsonFormatted
                          .split('\n')
                          .filter(line => line.toLowerCase().includes(jsonSearchQuery.toLowerCase()))
                          .join('\n') || `// No matching JSON lines containing "${jsonSearchQuery}"`
                      ) : (
                        rawJsonFormatted
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB 2: FIELD MAPPING DIFF TABLE */}
              {activeSubTab === 'mapping_diff' && (
                <div className="flex flex-col gap-4">
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                    <Info size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Field-to-Model Alignment Verifier</strong>
                      <span>
                        Validates how Azure DevOps raw fields (<code className="font-mono text-[11px]">System.State</code>, <code className="font-mono text-[11px]">System.AreaPath</code>, <code className="font-mono text-[11px]">System.IterationPath</code>, <code className="font-mono text-[11px]">System.AssignedTo</code>) are mapped into Northstar User Story and Defect attributes.
                      </span>
                    </div>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">ADO ID & Title</th>
                          <th className="py-2.5 px-3">Work Item Type</th>
                          <th className="py-2.5 px-3">State Mapping</th>
                          <th className="py-2.5 px-3">Area Path</th>
                          <th className="py-2.5 px-3">Iteration Path</th>
                          <th className="py-2.5 px-3">Assignee Object</th>
                          <th className="py-2.5 px-3 text-right">Fidelity Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-medium">
                        {filteredFieldMappings.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                              No items match the selected filter criteria ({mappingTypeFilter === 'Defect' ? 'Bugs / Defects' : mappingTypeFilter === 'Story' ? 'User Stories' : 'All'}).
                            </td>
                          </tr>
                        ) : (
                          filteredFieldMappings.map((item) => (
                            <tr key={item.adoId} className="hover:bg-[var(--surface-hover)] transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-bold ${item.mappedType === 'Defect' ? 'text-rose-600' : 'text-[var(--primary)]'}`}>
                                    #{item.adoId}
                                  </span>
                                  <span className="text-[var(--text-primary)] font-semibold truncate max-w-xs" title={item.title}>
                                    {item.title}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="font-mono text-[var(--text-secondary)]">{item.rawType}</span>
                                  <ArrowRight size={10} className="text-[var(--text-muted)]" />
                                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                                    item.mappedType === 'Story' 
                                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' 
                                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  }`}>
                                    {item.mappedType}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="font-mono text-[var(--text-secondary)]">{item.rawState}</span>
                                  <ArrowRight size={10} className="text-[var(--text-muted)]" />
                                  <span className="font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                                    {item.mappedStatus}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                                {item.rawArea}
                              </td>

                              <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                                {item.rawIteration}
                              </td>

                              <td className="py-3 px-3">
                                <span className="text-[var(--text-primary)] font-semibold text-[11.5px]">
                                  {item.mappedAssignee || 'Unassigned'}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 size={11} />
                                  <span>Mapped</span>
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: WIQL & NETWORK QUERY */}
              {activeSubTab === 'wiql_request' && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-[var(--primary)]" />
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">
                          Exact Work Item Query Language (WIQL) Statement
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyWiql}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        {copiedQuery ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{copiedQuery ? 'Copied' : 'Copy Query'}</span>
                      </button>
                    </div>

                    <div className="rounded-xl bg-[#090D16] text-[#38BDF8] p-3.5 font-mono text-[12px] border border-[#1E293B]">
                      <code>{activeRecord.wiqlQuery || 'SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = @project'}</code>
                    </div>

                    <p className="text-[11.5px] text-[var(--text-secondary)]">
                      Executed against Azure DevOps REST API: <code className="font-mono text-[10.5px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">POST https://dev.azure.com/{activeRecord.org}/{activeRecord.project}/_apis/wit/wiql?api-version=7.0</code>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      <span className="font-bold text-[var(--text-primary)] block mb-1">WIQL Target Scope</span>
                      <ul className="space-y-1 text-[var(--text-secondary)]">
                        <li>• Project: <strong className="text-[var(--text-primary)]">{activeRecord.project}</strong></li>
                        <li>• Area Filter: <code className="font-mono text-[11px] text-[var(--primary)]">[System.AreaPath] UNDER '{activeRecord.areaPath}'</code></li>
                        <li>• Iteration Filter: <code className="font-mono text-[11px] text-[var(--primary)]">[System.IterationPath] UNDER '{activeRecord.iterationPath}'</code></li>
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      <span className="font-bold text-[var(--text-primary)] block mb-1">Batch Field Fetch Parameters</span>
                      <ul className="space-y-1 text-[var(--text-secondary)]">
                        <li>• API Endpoint: <code className="font-mono text-[11px]">_apis/wit/workitemsbatch</code></li>
                        <li>• Fields: System.Id, Title, State, AssignedTo, WorkItemType, AreaPath, IterationPath, Description, StoryPoints</li>
                        <li>• HTTP Return Code: <strong className="text-emerald-600">200 OK</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: MISSING DATA TROUBLESHOOTER */}
              {activeSubTab === 'troubleshooter' && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <span>Data Missing or Mapping Incorrectly? Root Cause Diagnosis</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed">
                      Use the checklist below to pinpoint why specific User Stories, Bugs, or Sprint Iterations may not be appearing in Northstar.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-[var(--text-primary)]">
                        <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-[10px]">1</span>
                        <span>Iteration Path Hierarchy Naming</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Azure DevOps iteration paths often contain sub-paths (e.g. <code className="font-mono text-[11px] bg-[var(--surface-hover)] px-1 py-0.5 rounded">ACM\D5 R 2026.09</code> instead of simply <code className="font-mono text-[11px] bg-[var(--surface-hover)] px-1 py-0.5 rounded">D5 R 2026.09</code>).
                      </p>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ Solution: Northstar automatically prepends the project name and matches via the <code className="font-mono">UNDER</code> operator.
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-[var(--text-primary)]">
                        <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-[10px]">2</span>
                        <span>Area Path Matching & Sub-teams</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        If stories are assigned to child areas like <code className="font-mono text-[11px] bg-[var(--surface-hover)] px-1 py-0.5 rounded">ACM\ACM Dev QA</code>, filtering with an exact match (<code className="font-mono text-[11px]">=</code>) would exclude them.
                      </p>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ Solution: WIQL uses <code className="font-mono">[System.AreaPath] UNDER 'ACM'</code> to capture all child areas.
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-[var(--text-primary)]">
                        <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-[10px]">3</span>
                        <span>Personal Access Token (PAT) Scopes</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        If connection returns 401/403 or empty work items, ensure your PAT token has:
                      </p>
                      <ul className="text-xs text-[var(--text-secondary)] space-y-1 pl-4 list-disc">
                        <li><strong className="text-[var(--text-primary)]">Work Items:</strong> Read & Write</li>
                        <li><strong className="text-[var(--text-primary)]">Test Management:</strong> Read (for test runs)</li>
                        <li><strong className="text-[var(--text-primary)]">Project and Team:</strong> Read</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-[var(--text-primary)]">
                        <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-[10px]">4</span>
                        <span>Custom Work Item State Mappings</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Different Azure DevOps process templates (Agile, Scrum, CMMI, Basic) use different state names like <code className="font-mono text-[10.5px]">Committed</code>, <code className="font-mono text-[10.5px]">In Progress</code>, or <code className="font-mono text-[10.5px]">Resolved</code>.
                      </p>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ Solution: Northstar maps Active/In Progress to "Dev In Progress" and Resolved/Fixed to "QA Ready".
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>Diagnosing Azure DevOps Connection & Schema</span>
            <span className="text-[var(--border)]">•</span>
            <span>All 5 payloads preserved locally</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--surface-hover)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
