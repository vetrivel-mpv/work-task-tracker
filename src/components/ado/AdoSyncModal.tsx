import React, { useState } from 'react';
import { 
  DualAdoConfig, 
  UserStory, 
  TestCase, 
  Defect, 
  Release, 
  Task,
  TeamMember
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
  Key, 
  Database, 
  FileCheck2, 
  Bug, 
  BookOpen, 
  Terminal, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  Filter, 
  Plus,
  Code2,
  Check,
  Building2,
  Sliders,
  Play,
  ExternalLink,
  KeyRound,
  HelpCircle,
  Info
} from 'lucide-react';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber, parseAdoTarget, formatAdoUrl, normalizeAdoTarget } from '../../utils/adoPaths';
import { generateId, toDateStr } from '../../utils/date';
import { 
  adoService, 
  AdoIterationDto, 
  AdoAreaDto, 
  AdoSyncDiagnosticRecord,
  AdoServerConfig 
} from '../../services/adoService';
import { AdoSyncDiagnosticOverlay } from './AdoSyncDiagnosticOverlay';
import { WiqlEditorTab } from './WiqlEditorTab';
import { isTestCaseItem, isDefectItem, convertStoryToTestCase } from '../../utils/itemClassification';
import { getAcmPresetData } from '../../utils/acmDataset';
import { setStoredAdoPat } from '../../utils/authClient';

interface AdoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  dualAdoConfig: DualAdoConfig;
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  tasks?: Task[];
  team?: TeamMember[];
  onSaveConfig: (config: DualAdoConfig) => void;
  onTriggerSync?: (targetInstance?: 'all' | 'internal' | 'external') => void;
  onAddRelease?: (release: Release) => void;
  onSyncData?: (syncedData: {
    stories: UserStory[];
    testCases?: TestCase[];
    defects: Defect[];
    releases?: Release[];
    teamMembers?: Array<{ name: string; role?: string }>;
    tasks?: Task[];
    selectedReleaseId?: string;
  }) => void;
}

export const AdoSyncModal: React.FC<AdoSyncModalProps> = ({
  isOpen,
  onClose,
  dualAdoConfig,
  userStories,
  defects,
  releases,
  tasks = [],
  team = [],
  onSaveConfig,
  onTriggerSync,
  onAddRelease,
  onSyncData
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'wiql' | 'diagnostics'>('connection');
  const [showDiagnosticsOverlay, setShowDiagnosticsOverlay] = useState(false);

  // Diagnostic History (last 5 sync payloads)
  const [diagnosticHistory, setDiagnosticHistory] = useState<AdoSyncDiagnosticRecord[]>(() => {
    return adoService.getStoredDiagnostics();
  });

  // Single ADO Config State (backed by internal config in DualAdoConfig for persistence)
  const primaryConfig = dualAdoConfig?.internal || ({} as any);

  const initialTarget = parseAdoTarget(primaryConfig.organization, primaryConfig.project);
  const [org, setOrg] = useState(initialTarget.cleanOrg);
  const [project, setProject] = useState(initialTarget.cleanProject);
  const [pat, setPat] = useState(primaryConfig.pat || '');
  const [areaPath, setAreaPath] = useState(primaryConfig.areaPath || '');
  const [iterationPath, setIterationPath] = useState(primaryConfig.iterationPath || '');
  const [testSuite, setTestSuite] = useState(primaryConfig.testPlanSettings?.testSuite || 'Automated Regression Suite');
  const [automatedRunsEnabled, setAutomatedRunsEnabled] = useState(primaryConfig.testPlanSettings?.automatedRunsEnabled ?? true);

  // Active parsed target with normalization
  const currentTarget = parseAdoTarget(org, project);

  const handleOrgChange = (raw: string) => {
    // If user pasted a full URL or slash-separated string
    if (raw.includes('dev.azure.com') || raw.includes('visualstudio.com') || raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('/') || raw.includes('\\')) {
      const parsed = normalizeAdoTarget(raw, project);
      if (parsed.isValid) {
        setOrg(parsed.cleanOrg);
        if (parsed.cleanProject) {
          setProject(parsed.cleanProject);
        }
        setSyncLogs(prev => [...prev, `[SMART-URL] Normalized pasted ADO link: ${parsed.cleanOrg}/${parsed.cleanProject} (${parsed.detectedType})`]);
      } else {
        setOrg(raw);
      }
    } else {
      setOrg(raw);
    }
  };

  const handleProjectChange = (raw: string) => {
    if (raw.includes('dev.azure.com') || raw.includes('visualstudio.com') || raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('/') || raw.includes('\\')) {
      const parsed = normalizeAdoTarget(raw);
      if (parsed.isValid) {
        setProject(parsed.cleanProject || raw);
        if (parsed.cleanOrg) {
          setOrg(parsed.cleanOrg);
        }
        setSyncLogs(prev => [...prev, `[SMART-URL] Normalized pasted project link: ${parsed.cleanOrg}/${parsed.cleanProject}`]);
      } else {
        setProject(raw);
      }
    } else {
      setProject(raw);
    }
  };

  // Discovered ADO Metadata from Live API
  const [discoveredIterations, setDiscoveredIterations] = useState<AdoIterationDto[]>([]);
  const [discoveredAreas, setDiscoveredAreas] = useState<AdoAreaDto[]>([]);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [serverConfig, setServerConfig] = useState<AdoServerConfig | null>(null);

  // Sync execution state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    `[SYS-INIT] Azure DevOps connector ready.`
  ]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [createdReleaseName, setCreatedReleaseName] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  // Load server-side PAT config
  React.useEffect(() => {
    if (isOpen) {
      adoService.getServerConfig().then(cfg => {
        setServerConfig(cfg);
        if (cfg.hasServerPat && !pat) {
          setSyncLogs(prev => [...prev, `[SERVER-PAT] Active server-side Personal Access Token detected (${cfg.defaultOrg}/${cfg.defaultProject}).`]);
        }
      });
    }
  }, [isOpen]);

  // Derived available Area Paths and returned Iteration Paths
  const availableAreaPaths = getAllAreaPaths(releases, userStories, defects, tasks, discoveredAreas);
  const returnedIterations = getIterationPathsForArea(areaPath, releases, userStories, defects, discoveredIterations);

  // Auto-fetch metadata on initial load if project is present
  React.useEffect(() => {
    if (isOpen && currentTarget.cleanOrg && currentTarget.cleanProject && discoveredIterations.length === 0) {
      handleFetchMetadata();
    }
  }, [isOpen, currentTarget.cleanOrg, currentTarget.cleanProject]);

  const handleFetchMetadata = async () => {
    const target = parseAdoTarget(org, project);
    if (!target.cleanOrg || !target.cleanProject) {
      setTestResult({
        success: false,
        message: 'Organization and Project cannot be blank.'
      });
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const meta = await adoService.discoverMetadata(target.cleanOrg, target.cleanProject, pat);

      if (meta.ok) {
        if (meta.iterations && meta.iterations.length > 0) {
          setDiscoveredIterations(meta.iterations);
          // If no iteration is currently selected, suggest the active/current iteration
          if (!iterationPath && meta.currentIteration?.path) {
            setIterationPath(meta.currentIteration.path);
          }
        }
        if (meta.areas && meta.areas.length > 0) {
          setDiscoveredAreas(meta.areas);
        }

        const countIter = meta.iterations?.length || 0;
        const countArea = meta.areas?.length || 0;
        const activeName = meta.currentIteration?.name || 'None detected';

        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Metadata Discovery: Found ${countIter} iteration(s) (Active: ${activeName}) & ${countArea} area path(s) [Source: ${meta.source || 'live'}].`
        ]);
      } else {
        // Fallback to separate fetchers
        const [iterRes, areaRes] = await Promise.all([
          adoService.fetchIterations(target.cleanOrg, target.cleanProject, pat),
          adoService.fetchAreas(target.cleanOrg, target.cleanProject, pat)
        ]);

        if (iterRes.ok && iterRes.iterations && iterRes.iterations.length > 0) {
          setDiscoveredIterations(iterRes.iterations);
        }
        if (areaRes.ok && areaRes.areas && areaRes.areas.length > 0) {
          setDiscoveredAreas(areaRes.areas);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching metadata:', err);
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ADO Discovery Note: ${err.message || err}`
      ]);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleQuickCreateRelease = () => {
    if (!onAddRelease) return;
    const relName = iterationPath || currentTarget.cleanProject || 'New ADO Release';
    const newRel: Release = {
      id: generateId('rel'),
      name: relName,
      iterationPath: iterationPath || undefined,
      areaPath: areaPath || undefined,
      releaseNumber: extractReleaseNumber(relName) || 'v1.0.0',
      targetDate: toDateStr(new Date()),
      status: 'Active QA',
      description: `Created from Azure DevOps sync configuration (${currentTarget.cleanOrg}/${currentTarget.cleanProject})`,
      createdAt: new Date().toISOString()
    };
    onAddRelease(newRel);
    setCreatedReleaseName(relName);
    setTimeout(() => setCreatedReleaseName(null), 3000);
  };

  const handlePatChange = (val: string) => {
    setPat(val);
    setStoredAdoPat(val);
  };

  const handleLoadAcmOfflinePreset = () => {
    const dataset = getAcmPresetData();
    if (onSyncData) {
      onSyncData({
        stories: dataset.userStories,
        testCases: dataset.testCases,
        defects: dataset.defects,
        tasks: dataset.tasks,
        releases: dataset.releases,
        teamMembers: dataset.team
      });
    }

    const presetIters: AdoIterationDto[] = [
      { id: 'acm-d5', name: 'D5 R 2026.09', path: 'ACM\\D5 R 2026.09', startDate: '2026-05-15', finishDate: '2026-09-17', timeFrame: 'current', isCurrent: true, level: 1 },
      { id: 'acm-r08', name: 'R 2026.08 - Migration', path: 'ACM\\R 2026.08 - Migration', startDate: '2026-06-30', finishDate: '2026-08-20', timeFrame: 'current', level: 1 },
      { id: 'acm-d6', name: 'D6 R 2026.10', path: 'ACM\\D6 R 2026.10', startDate: '2026-08-01', finishDate: '2026-10-31', timeFrame: 'future', level: 1 },
      { id: 'acm-d4', name: 'D4 R 2026.07', path: 'ACM\\D4 R 2026.07', startDate: '2026-03-20', finishDate: '2026-07-23', timeFrame: 'past', level: 1 }
    ];

    const presetAreas: AdoAreaDto[] = [
      { id: '1', name: 'ACM', path: 'ACM', level: 0 },
      { id: '2', name: 'Delivery', path: 'ACM\\Delivery', level: 1 },
      { id: '3', name: 'Core', path: 'ACM\\Core', level: 1 },
      { id: '4', name: 'Integrations', path: 'ACM\\Integrations', level: 1 }
    ];

    setDiscoveredIterations(presetIters);
    setDiscoveredAreas(presetAreas);
    setIterationPath('ACM\\D5 R 2026.09');
    setAreaPath('ACM\\Delivery');

    setTestResult({
      success: true,
      message: 'Offline ACM Dataset loaded successfully! Populated 5 User Stories, 5 Test Cases, 3 Defects, 4 Tasks, and 4 Releases.'
    });

    setSyncLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [OFFLINE-PRESET] Successfully populated realistic AT&T Connection Manager (ACM) data into local workspace.`
    ]);
  };

  const handleTestConnection = async () => {
    const target = parseAdoTarget(org, project);
    if (!target.cleanOrg || !target.cleanProject) {
      setTestResult({
        success: false,
        message: 'Please fill in Organization and Project name.'
      });
      return;
    }

    setStoredAdoPat(pat);
    setTestResult(null);
    const now = new Date().toLocaleTimeString();
    setSyncLogs(prev => [...prev, `[${now}] Running PAT health check against https://dev.azure.com/${target.cleanOrg}/${target.cleanProject}...`]);

    try {
      const health = await adoService.checkHealth(target.cleanOrg, target.cleanProject, pat);
      if (health.ok) {
        setTestResult({
          success: true,
          message: health.message || `Connected & authenticated successfully to ${target.cleanOrg}/${target.cleanProject}! (HTTP 200 OK - ${health.durationMs || 0}ms)`,
          details: health
        });
        setSyncLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] Health check passed: ${health.target?.url} verified via ${health.authMethod || 'PAT'} (${health.durationMs || 0}ms).`
        ]);
        handleFetchMetadata();
      } else {
        setTestResult({
          success: false,
          message: health.error || 'Health check failed. Please check your PAT token or Project permissions.',
          details: health
        });
        setSyncLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] Health check failed (${health.status}): ${health.error || 'Check credentials'}`
        ]);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network request failed'
      });
    }
  };

  const handleExecuteLiveSync = async (customWiql?: string) => {
    setIsSyncing(true);
    const target = parseAdoTarget(org, project);
    const now = new Date().toLocaleTimeString();
    const newLogs: string[] = [
      `\n[${now}] Starting Azure DevOps synchronization...`,
      ...(customWiql ? [`[WIQL] Running custom WIQL query against Azure DevOps...`] : [])
    ];

    try {
      newLogs.push(`[CONNECT] Querying live items for ${target.cleanOrg}/${target.cleanProject} (${target.fullUrl})...`);
      setSyncLogs(prev => [...prev, ...newLogs]);

      const syncResult = await adoService.syncWorkItems({
        org: target.cleanOrg,
        project: target.cleanProject,
        pat,
        areaPath,
        iterationPath,
        customWiql
      });

      const rawIncomingStories = syncResult.stories || [];
      const storiesList: any[] = [];
      const testCasesList: any[] = [...(syncResult.testCases || [])];
      const defectsList: any[] = syncResult.defects || [];
      const tasksList: any[] = syncResult.tasks || [];

      rawIncomingStories.forEach((s: any) => {
        if (isTestCaseItem(s)) {
          const converted = convertStoryToTestCase(s);
          const exists = testCasesList.some(tc => tc.id === converted.id || (converted.adoId && tc.adoId === converted.adoId));
          if (!exists) testCasesList.push(converted);
        } else if (!isDefectItem(s)) {
          storiesList.push(s);
        }
      });

      newLogs.push(`[REST API] Received ${storiesList.length} User Stories, ${testCasesList.length} Test Cases, ${defectsList.length} Defects, ${tasksList.length} Tasks from live ADO.`);

      // Update diagnostic history
      const updatedHistory = adoService.getStoredDiagnostics();
      setDiagnosticHistory(updatedHistory);
      setLastSyncResult(syncResult);

      if (onSyncData) {
        onSyncData({
          stories: storiesList,
          testCases: testCasesList,
          defects: defectsList,
          tasks: tasksList,
          teamMembers: syncResult.teamMembers || []
        });
        newLogs.push(`[DATA INGEST] Successfully ingested and synchronized records into local state.`);
      }

      setSyncLogs(prev => [...prev, ...newLogs, `[COMPLETED] Azure DevOps synchronization finished (${syncResult.durationMs || 0}ms).`]);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncLogs(prev => [...prev, `[ERROR] Sync failed: ${err.message || err}`]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = () => {
    const target = parseAdoTarget(org, project);
    const updatedConfig: DualAdoConfig = {
      internal: {
        id: 'internal',
        name: `${target.cleanProject} ADO`,
        role: 'internal',
        organization: target.cleanOrg,
        project: target.cleanProject,
        pat: pat.trim(),
        areaPath: areaPath.trim(),
        iterationPath: iterationPath.trim(),
        connected: true,
        lastSyncAt: new Date().toISOString(),
        features: {
          devActivities: true,
          userStories: true,
          internalDefects: true,
          testPlansAndReports: true,
          customerDefects: true,
          opsTickets: true
        },
        testPlanSettings: {
          testSuite: testSuite.trim(),
          automatedRunsEnabled
        }
      },
      external: {
        id: 'external',
        name: 'Secondary (Disabled)',
        role: 'external',
        organization: '',
        project: '',
        pat: '',
        connected: false,
        features: {
          devActivities: false,
          userStories: false,
          internalDefects: false,
          testPlansAndReports: false,
          customerDefects: false,
          opsTickets: false
        }
      },
      syncMode: 'manual',
      lastGlobalSyncAt: new Date().toISOString()
    };

    onSaveConfig(updatedConfig);
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold shadow-xs">
              <FolderGit2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Azure DevOps Synchronization Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono">
                  REST API 7.0
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Sync Stories, Test Cases, Defects, Tasks, and execute custom WIQL queries.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadAcmOfflinePreset}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Load realistic pre-configured ACM delivery dataset into local workspace"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span>Load ACM Offline Dataset</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDiagnosticsOverlay(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-hover)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Code2 size={13} className="text-[var(--primary)]" />
              <span>Payloads & Diagnostics</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'connection'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders size={15} />
            <span>1. Connection & Scope Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wiql')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'wiql'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Code2 size={15} />
            <span>2. Custom WIQL Query Runner</span>
            <span className="px-1.5 py-0.5 rounded text-[9.5px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 font-extrabold uppercase">
              Editable
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Terminal size={15} />
            <span>3. Sync Console & Logs</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">

          {/* TAB 1: CONNECTION & SETTINGS */}
          {activeTab === 'connection' && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-150">
              
              {/* Credentials & Project */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Azure DevOps Credentials & Project
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                    {currentTarget.fullUrl}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Organization Name or URL *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. simetricwdh or https://dev.azure.com/simetricwdh"
                      value={org}
                      onChange={(e) => handleOrgChange(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] font-medium"
                    />
                    <div className="text-[10px] text-[var(--text-muted)] mt-1 truncate">
                      Pasting full links/deep-links auto-extracts org & project.
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ACM"
                      value={project}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] font-medium"
                    />
                    <div className="text-[10px] text-[var(--text-muted)] mt-1 truncate">
                      Target: <span className="font-mono font-medium text-[var(--text-primary)]">{currentTarget.displayTarget}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)]">
                        Personal Access Token (PAT)
                      </label>
                      {serverConfig?.hasServerPat && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={10} />
                          Server-Side PAT Configured
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Key size={13} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                      <input
                        type="password"
                        placeholder={serverConfig?.hasServerPat ? "Using server-side PAT (or override here)" : "••••••••••••••••"}
                        value={pat}
                        onChange={(e) => handlePatChange(e.target.value)}
                        className="w-full text-xs pl-8.5 pr-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Connection Test Action */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] flex-wrap gap-2">
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Requires <code className="text-[var(--primary)] font-mono">vso.work</code> (Work Items Read) and <code className="text-[var(--primary)] font-mono">vso.project</code> permissions.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleLoadAcmOfflinePreset}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300 dark:border-amber-700 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles size={13} className="text-amber-500" />
                      <span>Load ACM Preset (Offline)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} />
                      <span>Verify Connection</span>
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div className="flex flex-col gap-2">
                    <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      testResult.success 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    }`}>
                      {testResult.success ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                      <span className="flex-1">{testResult.message}</span>
                    </div>

                    {/* Dedicated 401 Assistant Card */}
                    {(!testResult.success && (testResult.details?.httpStatus === 401 || testResult.details?.status === 'unauthenticated' || testResult.message?.includes('401') || testResult.message?.includes('Unauthorized'))) && (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-300/60 dark:border-amber-700/60 flex flex-col gap-3 text-xs">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                          <KeyRound size={16} className="text-amber-600 dark:text-amber-400" />
                          <span>Azure DevOps Authentication & Scope Assistant</span>
                        </div>
                        
                        <p className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
                          Azure DevOps returned <strong className="text-[var(--text-primary)]">HTTP 401 (Unauthorized)</strong> for <code className="font-mono text-amber-700 dark:text-amber-300">https://dev.azure.com/{currentTarget.cleanOrg || 'simetricwdh'}/{currentTarget.cleanProject || 'ACM'}</code>. This indicates that a valid Personal Access Token (PAT) is required to query live work items.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-1">
                            <span className="font-bold text-[var(--text-primary)]">Required PAT Scopes:</span>
                            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-0.5">
                              <li><strong>Work Items:</strong> Read & Write</li>
                              <li><strong>Project & Team:</strong> Read</li>
                            </ul>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between gap-2">
                            <span className="font-bold text-[var(--text-primary)]">Generate Live PAT:</span>
                            <a
                              href={`https://dev.azure.com/${currentTarget.cleanOrg || 'simetricwdh'}/_usersSettings/tokens`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white font-bold text-[11px] hover:opacity-90 transition-opacity"
                            >
                              <span>Open ADO Token Generator</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-amber-300/40 dark:border-amber-700/40 flex-wrap gap-2">
                          <span className="text-[10px] text-[var(--text-muted)]">
                            Tip: You can continue testing all features (Kanban, QA Burndown, Daily Reports, AI Summary) right now using pre-loaded ACM data.
                          </span>
                          <button
                            type="button"
                            onClick={handleLoadAcmOfflinePreset}
                            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Sparkles size={12} />
                            <span>Load ACM Offline Dataset</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scope Filters (Area Path & Iteration) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Scope Filters (Sprint Iteration & Area Path)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchMetadata}
                    disabled={isFetchingMetadata}
                    className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} className={isFetchingMetadata ? 'animate-spin' : ''} />
                    <span>{isFetchingMetadata ? 'Querying ADO...' : 'Refresh Discovered Paths'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Iteration / Sprint */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)]">
                        Sprint / Iteration Path
                      </label>
                      <span className="text-[10px] text-[var(--text-muted)]">e.g. ACM\D2 R 2026.03</span>
                    </div>
                    <input
                      type="text"
                      list="discovered-iterations"
                      placeholder="Leave empty to query all iterations"
                      value={iterationPath}
                      onChange={(e) => setIterationPath(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] font-medium"
                    />
                    <datalist id="discovered-iterations">
                      {returnedIterations.map((iter) => (
                        <option key={iter.iterationPath} value={iter.iterationPath}>
                          {iter.displayName}
                        </option>
                      ))}
                    </datalist>

                    {/* Discovered Iteration Quick Selectors */}
                    {discoveredIterations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">Discovered:</span>
                        {discoveredIterations.slice(0, 4).map((iter) => {
                          const isSelected = iterationPath === iter.path;
                          const isCurrent = iter.isCurrent || iter.timeFrame === 'current';
                          return (
                            <button
                              key={iter.id || iter.path}
                              type="button"
                              onClick={() => setIterationPath(iter.path)}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected 
                                  ? 'bg-[var(--primary)] text-white' 
                                  : isCurrent
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                              }`}
                            >
                              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                              <span>{iter.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {iterationPath && (
                      <div className="mt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={handleQuickCreateRelease}
                          className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Auto-create Release for "{iterationPath}"</span>
                        </button>
                        {createdReleaseName && (
                          <span className="text-[10.5px] text-emerald-600 font-bold flex items-center gap-1">
                            <Check size={12} /> Created!
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Area Path */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)]">
                        Area Path Filter
                      </label>
                      <span className="text-[10px] text-[var(--text-muted)]">e.g. ACM\QA</span>
                    </div>
                    <input
                      type="text"
                      list="discovered-areas"
                      placeholder="Leave empty to query entire project root"
                      value={areaPath}
                      onChange={(e) => setAreaPath(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] font-medium"
                    />
                    <datalist id="discovered-areas">
                      {availableAreaPaths.map((area) => (
                        <option key={area} value={area} />
                      ))}
                    </datalist>

                    {/* Discovered Area Path Quick Selectors */}
                    {discoveredAreas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">Discovered:</span>
                        {discoveredAreas.slice(0, 3).map((area) => {
                          const isSelected = areaPath === area.path;
                          return (
                            <button
                              key={area.id || area.path}
                              type="button"
                              onClick={() => setAreaPath(area.path)}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-[var(--primary)] text-white' 
                                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                              }`}
                            >
                              {area.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sync Actions Bar */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">Ready to Synchronize</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Fetches stories, QA defects, test cases, and tasks matching your scope.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('wiql')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Code2 size={14} className="text-indigo-500" />
                    <span>Open Custom WIQL Console</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => handleExecuteLiveSync()}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Synchronizing ADO...' : '🚀 Synchronize Live ADO'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDITABLE WIQL RUNNER */}
          {activeTab === 'wiql' && (
            <WiqlEditorTab
              org={currentTarget.cleanOrg}
              project={currentTarget.cleanProject}
              pat={pat}
              areaPath={areaPath}
              iterationPath={iterationPath}
              onExecuteAndSync={async (customWiql) => {
                await handleExecuteLiveSync(customWiql);
              }}
              isSyncing={isSyncing}
            />
          )}

          {/* TAB 3: SYNC CONSOLE & LOGS */}
          {activeTab === 'diagnostics' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-[var(--primary)]" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Azure DevOps Sync Terminal Output
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncLogs([`[${new Date().toLocaleTimeString()}] Log cleared.`])}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              <div className="p-3 bg-[#0B0F17] rounded-xl font-mono text-[11px] text-emerald-400 h-64 overflow-y-auto border border-[#1E293B] shadow-inner">
                {syncLogs.map((log, index) => (
                  <div key={index} className="py-0.5 leading-relaxed whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
              </div>

              {lastSyncResult && (
                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="font-bold text-[var(--text-primary)]">Last Sync Summary</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] text-[var(--text-secondary)] font-mono">
                    <span>Stories: <strong>{lastSyncResult.stories?.length || 0}</strong></span>
                    <span>Test Cases: <strong>{lastSyncResult.testCases?.length || 0}</strong></span>
                    <span>Defects: <strong>{lastSyncResult.defects?.length || 0}</strong></span>
                    <span>Tasks: <strong>{lastSyncResult.tasks?.length || 0}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Target: <strong className="font-mono text-[var(--text-primary)]">{currentTarget.fullUrl}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save size={14} />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

      </div>

      {/* Diagnostics & Payload Overlay */}
      {showDiagnosticsOverlay && (
        <AdoSyncDiagnosticOverlay
          isOpen={showDiagnosticsOverlay}
          onClose={() => setShowDiagnosticsOverlay(false)}
          diagnosticHistory={diagnosticHistory}
          onClearHistory={() => {
            adoService.clearDiagnostics();
            setDiagnosticHistory([]);
          }}
          onTriggerSync={() => handleExecuteLiveSync()}
          isSyncing={isSyncing}
        />
      )}
    </div>
  );
};
