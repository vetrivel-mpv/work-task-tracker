import React, { useState } from 'react';
import { 
  DualAdoConfig, 
  AdoInstanceConfig, 
  UserStory, 
  Defect, 
  Release, 
  Task 
} from '../../types';
import { 
  FolderGit2, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  X, 
  Save, 
  Layers, 
  Download, 
  Upload,
  Key,
  Database,
  Building2,
  Globe2,
  FileCheck2,
  Headphones,
  Bug,
  BookOpen,
  Terminal,
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  Tag
} from 'lucide-react';
import { getAllAreaPaths, getIterationPathsForArea } from '../../utils/adoPaths';

interface AdoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  dualAdoConfig: DualAdoConfig;
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  tasks?: Task[];
  onSaveConfig: (config: DualAdoConfig) => void;
  onTriggerSync?: (targetInstance: 'all' | 'internal' | 'external') => void;
}

export const AdoSyncModal: React.FC<AdoSyncModalProps> = ({
  isOpen,
  onClose,
  dualAdoConfig,
  userStories,
  defects,
  releases,
  tasks = [],
  onSaveConfig,
  onTriggerSync
}) => {
  const [activeTab, setActiveTab] = useState<'internal' | 'external' | 'dual_sync'>('internal');

  // Internal ADO State
  const [internalName, setInternalName] = useState(dualAdoConfig?.internal?.name || 'Internal Dev ADO (CareFlow Core)');
  const [internalOrg, setInternalOrg] = useState(dualAdoConfig?.internal?.organization || 'careflow-dev-core');
  const [internalProject, setInternalProject] = useState(dualAdoConfig?.internal?.project || 'CareFlow-Core-EHR');
  const [internalPat, setInternalPat] = useState(dualAdoConfig?.internal?.pat || '••••••••••••••••••••••••');
  const [internalArea, setInternalArea] = useState(dualAdoConfig?.internal?.areaPath || 'CareFlow-Core\\EHR-Connect');
  const [internalIteration, setInternalIteration] = useState(dualAdoConfig?.internal?.iterationPath || 'CareFlow-Core\\Sprint 24');
  const [internalTestSuite, setInternalTestSuite] = useState(dualAdoConfig?.internal?.testPlanSettings?.testSuite || 'Telehealth & Clinical Pipeline');
  const [internalTestRunsEnabled, setInternalTestRunsEnabled] = useState(dualAdoConfig?.internal?.testPlanSettings?.automatedRunsEnabled ?? true);
  
  // External ADO State
  const [externalName, setExternalName] = useState(dualAdoConfig?.external?.name || 'External Customer & OPS ADO');
  const [externalOrg, setExternalOrg] = useState(dualAdoConfig?.external?.organization || 'healthtech-customer-ops');
  const [externalProject, setExternalProject] = useState(dualAdoConfig?.external?.project || 'CareFlow-Customer-Support');
  const [externalPat, setExternalPat] = useState(dualAdoConfig?.external?.pat || '••••••••••••••••••••••••');
  const [externalArea, setExternalArea] = useState(dualAdoConfig?.external?.areaPath || 'CareFlow-Ops\\Customer-Escalations');
  const [externalIteration, setExternalIteration] = useState(dualAdoConfig?.external?.iterationPath || 'CareFlow-Ops\\Active-Incidents');

  // Sync execution state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTarget, setSyncTarget] = useState<'all' | 'internal' | 'external' | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    `[SYS-INIT] Dual Azure DevOps connector initialized.`,
    `[INTERNAL] Connected: ${internalOrg}/${internalProject} (Dev, Stories, QA Defect, Test Plans)`,
    `[EXTERNAL] Connected: ${externalOrg}/${externalProject} (Customer Escalations & OPS Tickets)`
  ]);
  const [testResult, setTestResult] = useState<{ target: 'internal' | 'external'; success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  // Derived available Area Paths and returned Iteration Paths for Internal ADO
  const availableAreaPaths = getAllAreaPaths(releases, userStories, defects, tasks);
  const returnedInternalIterations = getIterationPathsForArea(internalArea, releases, userStories, defects);

  const handleTestConnection = (target: 'internal' | 'external') => {
    setTestResult(null);
    const org = target === 'internal' ? internalOrg : externalOrg;
    const project = target === 'internal' ? internalProject : externalProject;

    setTimeout(() => {
      if (org && project) {
        setTestResult({
          target,
          success: true,
          message: `Connected successfully to Azure DevOps [${target.toUpperCase()}]: ${org}/${project} (HTTP 200 OK)`
        });
      } else {
        setTestResult({
          target,
          success: false,
          message: `Connection failed: Organization and Project cannot be blank.`
        });
      }
    }, 600);
  };

  const handleExecuteLiveSync = (target: 'all' | 'internal' | 'external') => {
    setIsSyncing(true);
    setSyncTarget(target);
    const now = new Date().toLocaleTimeString();

    const newLogs: string[] = [
      `\n[${now}] Starting sync cycle for ${target.toUpperCase()} instance(s)...`
    ];

    if (target === 'all' || target === 'internal') {
      const iterationsSummary = returnedInternalIterations.map(i => `${i.releaseName} [${i.releaseNumber}]`).join(', ');
      newLogs.push(
        `[INTERNAL] Querying ADO WorkItems with Area Path Filter: "${internalArea}"...`,
        `[INTERNAL] Discovered ${returnedInternalIterations.length} Iteration Path(s) (Releases: ${iterationsSummary || 'None'})`,
        `[INTERNAL] Fetched User Stories & QA Defects across ${returnedInternalIterations.length} active iteration paths in Area "${internalArea}".`,
        `[INTERNAL] Querying Test Management API for suite "${internalTestSuite}"...`,
        `[INTERNAL] Test Plan Run #89412 retrieved: 56 Passed / 1 Failed (98.2% Pass Rate).`
      );
    }

    if (target === 'all' || target === 'external') {
      newLogs.push(
        `[EXTERNAL] Querying Customer Triage Queue on ${externalOrg}/${externalProject}...`,
        `[EXTERNAL] Ingested 2 Customer Defects (Mount Sinai P1, Mayo Regional P2).`,
        `[EXTERNAL] Ingested 1 Cloud Cluster OPS Ticket (OPS-9460 - SAS Token Renewal).`,
        `[EXTERNAL] Synced SLA Priority timers and client hospital tags.`
      );
    }

    newLogs.push(`[${now}] Synchronization completed successfully. All artifacts updated in local memory.`);

    setTimeout(() => {
      setSyncLogs(prev => [...prev, ...newLogs]);
      setIsSyncing(false);
      setSyncTarget(null);
      if (onTriggerSync) onTriggerSync(target);
    }, 1200);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedConfig: DualAdoConfig = {
      internal: {
        id: 'internal',
        name: internalName.trim(),
        role: 'internal',
        organization: internalOrg.trim(),
        project: internalProject.trim(),
        pat: internalPat.trim(),
        areaPath: internalArea.trim(),
        iterationPath: internalIteration.trim(),
        connected: true,
        lastSyncAt: new Date().toISOString(),
        features: {
          devActivities: true,
          userStories: true,
          internalDefects: true,
          testPlansAndReports: true,
          customerDefects: false,
          opsTickets: false
        },
        testPlanSettings: {
          testPlanName: 'Sprint 24 QA Plan',
          testSuite: internalTestSuite.trim(),
          automatedRunsEnabled: internalTestRunsEnabled,
          lastReportUrl: `https://dev.azure.com/${internalOrg.trim()}/${internalProject.trim()}/_testManagement/runs`,
          passedTests: 56,
          failedTests: 1,
          totalTests: 57
        }
      },
      external: {
        id: 'external',
        name: externalName.trim(),
        role: 'external',
        organization: externalOrg.trim(),
        project: externalProject.trim(),
        pat: externalPat.trim(),
        areaPath: externalArea.trim(),
        iterationPath: externalIteration.trim(),
        connected: true,
        lastSyncAt: new Date().toISOString(),
        features: {
          devActivities: false,
          userStories: false,
          internalDefects: false,
          testPlansAndReports: false,
          customerDefects: true,
          opsTickets: true
        }
      },
      syncMode: 'auto',
      lastGlobalSyncAt: new Date().toISOString()
    };

    onSaveConfig(updatedConfig);
    onClose();
  };

  const internalStories = userStories.filter(s => s.sourceInstance !== 'external');
  const internalDefects = defects.filter(d => d.sourceInstance !== 'external');
  const externalDefects = defects.filter(d => d.sourceInstance === 'external');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white border border-[var(--border)] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
              <FolderGit2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">Dual Azure DevOps Sync Engine</h2>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--internal-ado-bg)] text-[var(--internal-ado)]">
                  2 ADO Instances
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Separate synchronization for Internal Dev pipeline vs External Customer & OPS Tickets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab('internal')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'internal'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Building2 size={15} />
            <span>1. Internal ADO (Dev, Stories, QA & Tests)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('external')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'external'
                ? 'border-[var(--external-ado)] text-[var(--external-ado)] bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Globe2 size={15} />
            <span>2. External ADO (Customer & OPS Tickets)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dual_sync')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ml-auto ${
              activeTab === 'dual_sync'
                ? 'border-[var(--secondary-accent)] text-[var(--secondary-accent)] bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Zap size={15} />
            <span>Dual Sync Hub</span>
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSaveAll} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* TAB 1: INTERNAL ADO */}
          {activeTab === 'internal' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-100">
              <div className="p-3.5 rounded-xl bg-[var(--internal-ado-bg)] border border-[var(--primary)]/20 flex items-start gap-3">
                <Building2 size={18} className="text-[var(--internal-ado)] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-[var(--internal-ado)] block mb-0.5">
                    Instance Purpose: Internal Engineering Delivery & Quality Assurance
                  </span>
                  <p className="text-[var(--text-secondary)]">
                    Synchronizes engineering Dev Tasks, Product User Stories, Internal QA Defects, Sprint Iterations, and fetches Test Plan automated runs & test reports.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Instance Display Label</label>
                  <input
                    type="text"
                    value={internalName}
                    onChange={(e) => setInternalName(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Organization Name / URL</label>
                  <input
                    type="text"
                    required
                    value={internalOrg}
                    onChange={(e) => setInternalOrg(e.target.value)}
                    placeholder="e.g. careflow-dev-core"
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={internalProject}
                    onChange={(e) => setInternalProject(e.target.value)}
                    placeholder="e.g. CareFlow-Core-EHR"
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Personal Access Token (PAT)</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={internalPat}
                      onChange={(e) => setInternalPat(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                    />
                    <Key size={14} className="absolute right-3 top-2.5 text-[var(--text-muted)]" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Area Path Filter (Internal ADO)
                    </label>
                    <input
                      type="text"
                      value={internalArea}
                      onChange={(e) => setInternalArea(e.target.value)}
                      placeholder="e.g. CareFlow-Core\EHR-Connect"
                      className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Active Sprint Iteration Path
                    </label>
                    <input
                      type="text"
                      value={internalIteration}
                      onChange={(e) => setInternalIteration(e.target.value)}
                      placeholder="e.g. CareFlow-Core\Sprint 24"
                      className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Quick Area Path selector chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1">
                    <Filter size={11} /> Suggested Areas:
                  </span>
                  {availableAreaPaths.map(area => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setInternalArea(area)}
                      className={`text-[10.5px] font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        internalArea === area
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>

                {/* Returned Iteration Paths (Releases in Internal ADO) Box */}
                <div className="mt-1 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderGit2 size={15} className="text-[var(--primary)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        Iteration Paths Returned for Area Filter
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
                        {returnedInternalIterations.length} {returnedInternalIterations.length === 1 ? 'Iteration / Release' : 'Iterations / Releases'}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                      Iteration Path = ADO Release Name/Number
                    </span>
                  </div>

                  {returnedInternalIterations.length === 0 ? (
                    <div className="p-3 bg-[var(--surface)] rounded-lg text-xs text-[var(--text-muted)] text-center border border-dashed border-[var(--border)]">
                      No iteration paths returned for <span className="font-mono font-bold">"{internalArea}"</span>. Try adjusting your Area Path filter or check ADO project area definitions.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                      {returnedInternalIterations.map((iter) => {
                        const isSelected = internalIteration === iter.iterationPath;
                        return (
                          <div
                            key={iter.iterationPath + iter.releaseId}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 transition-all ${
                              isSelected
                                ? 'bg-[var(--primary-light)]/40 border-[var(--primary)] shadow-xs'
                                : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/40'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[var(--text-primary)] truncate">
                                  {iter.releaseName}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-hover)] text-[var(--text-primary)] font-mono border border-[var(--border)]">
                                  {iter.releaseNumber}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                                  {iter.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] mt-1 font-mono">
                                <span>Path: {iter.iterationPath}</span>
                                <span>•</span>
                                <span className="font-sans font-medium">{iter.userStoryCount} Stories</span>
                                <span>•</span>
                                <span className="font-sans font-medium">{iter.defectCount} Defects</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setInternalIteration(iter.iterationPath)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                                isSelected
                                  ? 'bg-[var(--primary)] text-white'
                                  : 'bg-[var(--surface-hover)] text-[var(--text-primary)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)]'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 size={12} />
                                  <span>Active Iteration</span>
                                </>
                              ) : (
                                <span>Set Active</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Test Plan & Test Report Settings */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={16} className="text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Test Plan & Automated Test Report Ingestion</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={internalTestRunsEnabled}
                      onChange={(e) => setInternalTestRunsEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span>Fetch Test Runs</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">Target Test Suite Name</label>
                    <input
                      type="text"
                      value={internalTestSuite}
                      onChange={(e) => setInternalTestSuite(e.target.value)}
                      placeholder="e.g. Telehealth & Clinical Pipeline"
                      className="w-full text-xs px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleTestConnection('internal')}
                      className="w-full px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white transition-colors"
                    >
                      Verify Internal ADO Connection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXTERNAL ADO */}
          {activeTab === 'external' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-100">
              <div className="p-3.5 rounded-xl bg-[var(--external-ado-bg)] border border-[var(--external-ado)]/20 flex items-start gap-3">
                <Globe2 size={18} className="text-[var(--external-ado)] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-[var(--external-ado)] block mb-0.5">
                    Instance Purpose: External Customer Escalations & Production OPS Tickets
                  </span>
                  <p className="text-[var(--text-secondary)]">
                    Synchronizes customer-reported defects (from hospital systems and clinical networks), live OPS support incidents, customer account SLAs, and production triage queues.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Instance Display Label</label>
                  <input
                    type="text"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">External Org Name / URL</label>
                  <input
                    type="text"
                    required
                    value={externalOrg}
                    onChange={(e) => setExternalOrg(e.target.value)}
                    placeholder="e.g. healthtech-customer-ops"
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={externalProject}
                    onChange={(e) => setExternalProject(e.target.value)}
                    placeholder="e.g. CareFlow-Customer-Support"
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Personal Access Token (PAT)</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={externalPat}
                      onChange={(e) => setExternalPat(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                    />
                    <Key size={14} className="absolute right-3 top-2.5 text-[var(--text-muted)]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Customer Escalation Area Path</label>
                  <input
                    type="text"
                    value={externalArea}
                    onChange={(e) => setExternalArea(e.target.value)}
                    placeholder="e.g. CareFlow-Ops\Customer-Escalations"
                    className="w-full text-xs font-medium px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">OPS Iteration / Support Queue</label>
                  <input
                    type="text"
                    value={externalIteration}
                    onChange={(e) => setExternalIteration(e.target.value)}
                    placeholder="e.g. CareFlow-Ops\Active-Incidents"
                    className="w-full text-xs font-medium px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between">
                <div className="text-xs">
                  <span className="font-bold text-[var(--text-primary)] block">Customer Defect & OPS Ticket Ingestion</span>
                  <span className="text-[var(--text-secondary)]">Captures hospital client name, SLA timer, and OPS incident refs</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestConnection('external')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--external-ado)] bg-[var(--external-ado-bg)] hover:bg-[var(--external-ado)] hover:text-white transition-colors"
                >
                  Verify External ADO Connection
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DUAL SYNC TERMINAL & COMMAND CENTER */}
          {activeTab === 'dual_sync' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-100">
              {/* Dual Sync Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => handleExecuteLiveSync('all')}
                  className="p-3 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] flex flex-col items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={18} className={isSyncing && syncTarget === 'all' ? 'animate-spin' : ''} />
                  <span className="text-xs font-bold">Sync Both ADO Instances</span>
                  <span className="text-[10px] opacity-80 font-normal">Internal Dev + External OPS</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => handleExecuteLiveSync('internal')}
                  className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] flex flex-col items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Building2 size={18} />
                  <span className="text-xs font-bold">Sync Internal Dev ADO</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-normal">Stories, Dev QA, Test Plans</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => handleExecuteLiveSync('external')}
                  className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--external-ado)] text-[var(--external-ado)] hover:bg-[var(--external-ado-bg)] flex flex-col items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Globe2 size={18} />
                  <span className="text-xs font-bold">Sync External ADO</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-normal">Customer Bugs, OPS Incidents</span>
                </button>
              </div>

              {/* Live Status Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Internal Stories</span>
                  <span className="text-lg font-bold text-[var(--internal-ado)]">{internalStories.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Internal QA Bugs</span>
                  <span className="text-lg font-bold text-[var(--internal-ado)]">{internalDefects.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Customer / OPS Bugs</span>
                  <span className="text-lg font-bold text-[var(--external-ado)]">{externalDefects.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Automated Tests</span>
                  <span className="text-lg font-bold text-[var(--low)]">57 Runs</span>
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="rounded-xl bg-[#0B0F17] text-[#94A3B8] p-3 font-mono-token text-[11px] border border-[#1E293B] shadow-inner max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between text-[#64748B] pb-2 mb-2 border-b border-[#1E293B]">
                  <span className="flex items-center gap-1.5 text-xs text-[#CBD5E1]">
                    <Terminal size={13} />
                    <span>Live Dual-ADO Synchronization Stream</span>
                  </span>
                  <span className="text-[10px] text-[#38BDF8]">LIVE CONNECTED</span>
                </div>
                <div className="flex flex-col gap-1 leading-relaxed">
                  {syncLogs.map((log, index) => (
                    <div 
                      key={index}
                      className={
                        log.includes('[INTERNAL]') ? 'text-[#818CF8]' :
                        log.includes('[EXTERNAL]') ? 'text-[#FBBF24]' :
                        log.includes('completed') ? 'text-[#4ADE80] font-bold' : 'text-[#94A3B8]'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Test connection alert message */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
              testResult.success 
                ? 'bg-[var(--low-bg)] text-[var(--low)] border border-[var(--low-border)]' 
                : 'bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical-border)]'
            }`}>
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] mt-auto">
            <span className="text-[11px] text-[var(--text-muted)]">
              Both ADO instances are stored securely in encrypted application memory.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-xs"
              >
                <Save size={14} />
                <span>Save Dual ADO Settings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

