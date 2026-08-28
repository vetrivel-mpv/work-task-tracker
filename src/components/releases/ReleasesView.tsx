import React, { useState, useEffect } from 'react';
import { Release, ReleaseStatus, UserStory, Defect, Task, TestCase, DualAdoConfig, AdoConfig } from '../../types';
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
  Filter,
  RefreshCw,
  ArrowDownToLine,
  CheckSquare,
  Bug,
  ListTodo,
  ExternalLink,
  Info,
  X,
  Database,
  Search,
  LayoutGrid,
  LayoutList,
  ChevronRight,
  Flame,
  HelpCircle,
  Mail
} from 'lucide-react';
import { generateReleaseNotes } from '../../services/aiService';
import { generateId, toDateStr, formatDisplayDate } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea, extractReleaseNumber, parseAdoTarget, matchesReleaseOrIteration } from '../../utils/adoPaths';
import { SearchableSelect } from '../common/SearchableSelect';
import { adoService, AdoSyncResponse, AdoIterationDto, AdoAreaDto } from '../../services/adoService';
import { isTestCaseItem, isDefectItem, convertStoryToTestCase } from '../../utils/itemClassification';
import { ReleaseDetailModal } from './ReleaseDetailModal';

export interface ReleaseFetchResult {
  releaseId: string;
  releaseName: string;
  timestamp: string;
  dateStr: string;
  durationMs: number;
  status: 'success' | 'error' | 'warning';
  storiesCount: number;
  bugsCount: number;
  tasksCount: number;
  testCasesCount: number;
  totalCount: number;
  source?: string;
  error?: string;
  itemsSummary?: {
    stories: Array<{ id: string; adoId?: number; title: string; status: string }>;
    bugs: Array<{ id: string; adoId?: number; title: string; severity?: string; status: string }>;
    tasks: Array<{ id: string; adoId?: number; title: string; status: string }>;
    testCases: Array<{ id: string; adoId?: number; title: string; status: string }>;
  };
}

interface ReleasesViewProps {
  releases: Release[];
  userStories: UserStory[];
  defects: Defect[];
  tasks: Task[];
  testCases?: TestCase[];
  dualAdoConfig?: DualAdoConfig;
  adoConfig?: AdoConfig;
  geminiApiKey?: string;
  onAddRelease: (release: Release) => void;
  onUpdateRelease: (release: Release) => void;
  onDeleteRelease: (releaseId: string) => void;
  onSyncData?: (synced: {
    stories: UserStory[];
    testCases?: TestCase[];
    defects: Defect[];
    releases?: Release[];
    teamMembers?: Array<{ name: string; role?: string }>;
    tasks?: Task[];
    selectedReleaseId?: string;
  }) => void;
  onOpenAdoModal?: () => void;
  onOpenEmailModal?: (template?: string, defectId?: string, releaseId?: string) => void;
}

const STATUS_CONFIG: { [key in ReleaseStatus]: { label: string; bg: string; text: string } } = {
  Planning: { label: 'Planning', bg: 'bg-[#F3F6F4]', text: 'text-[#5A675F]' },
  'Active QA': { label: 'Active QA', bg: 'bg-[#F4EBFF]', text: 'text-[#7C3AED]' },
  Staging: { label: 'Staging', bg: 'bg-[#E0F2FE]', text: 'text-[#0284C7]' },
  Deployed: { label: 'Deployed', bg: 'bg-[#E8F3F0]', text: 'text-[#0C6E5E]' },
  Archived: { label: 'Archived', bg: 'bg-[#F3F6F4]', text: 'text-[#84918A]' }
};

const STORAGE_FETCH_KEY = 'northstar_release_fetch_history_v2';

function mapToUserStory(item: any, releaseId: string): UserStory {
  const today = toDateStr(new Date());
  return {
    id: item.id || `us-${item.adoId || generateId('us')}`,
    title: item.title || 'Untitled Story',
    description: item.description || '',
    acceptanceCriteria: Array.isArray(item.acceptanceCriteria) ? item.acceptanceCriteria : (item.acceptanceCriteria ? [String(item.acceptanceCriteria)] : []),
    status: item.status || 'Dev In Progress',
    releaseId: releaseId,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    assigneeName: item.assigneeName,
    createdByName: item.createdByName,
    storyPoints: item.storyPoints || 5,
    tags: Array.isArray(item.tags) ? item.tags : [],
    sourceInstance: item.sourceInstance || 'internal',
    adoId: item.adoId,
    adoUrl: item.adoUrl,
    createdAt: item.createdAt || today,
    updatedAt: item.updatedAt || today,
  };
}

function mapToDefect(item: any, releaseId: string): Defect {
  const today = toDateStr(new Date());
  return {
    id: item.id || `def-${item.adoId || generateId('def')}`,
    title: item.title || 'Untitled Defect',
    description: item.description || '',
    severity: item.severity || 'medium',
    status: item.status || 'Active',
    releaseId: releaseId,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    adoId: item.adoId,
    adoUrl: item.adoUrl,
    createdAt: item.createdAt || today,
    updatedAt: item.updatedAt || today,
  };
}

function mapToTask(item: any, releaseId: string): Task {
  const today = toDateStr(new Date());
  const rawStatus = (item.status || item.rawStatus || '').toLowerCase();
  let taskStatus: 'pending' | 'partial' | 'complete' = 'pending';
  if (rawStatus.includes('closed') || rawStatus.includes('done') || rawStatus.includes('completed') || rawStatus.includes('resolved')) {
    taskStatus = 'complete';
  } else if (rawStatus.includes('active') || rawStatus.includes('in progress') || rawStatus.includes('doing') || rawStatus.includes('committed')) {
    taskStatus = 'partial';
  }

  return {
    id: item.id || `task-${item.adoId || generateId('task')}`,
    title: item.title || 'Untitled Task',
    status: taskStatus,
    priority: item.priority || 'medium',
    dateStr: item.dateStr || today,
    assigneeIds: Array.isArray(item.assigneeIds) ? item.assigneeIds : [],
    groupIds: Array.isArray(item.groupIds) ? item.groupIds : [],
    releaseId: releaseId,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    adoId: item.adoId,
    adoWorkItemType: item.workItemType || 'Task',
    adoUrl: item.adoUrl,
    sourceInstance: item.sourceInstance || 'internal',
    ticketType: 'dev_activity',
    createdAt: item.createdAt || today,
  };
}

function mapToTestCase(item: any, releaseId: string): TestCase {
  const today = toDateStr(new Date());
  return {
    id: item.id || `tc-${item.adoId || generateId('tc')}`,
    title: item.title || 'Untitled Test Case',
    description: item.description || '',
    status: item.status || 'Ready',
    releaseId: releaseId,
    areaPath: item.areaPath,
    iterationPath: item.iterationPath,
    adoId: item.adoId,
    adoUrl: item.adoUrl,
    createdAt: item.createdAt || today,
    updatedAt: item.updatedAt || today,
  };
}

export const ReleasesView: React.FC<ReleasesViewProps> = ({
  releases,
  userStories,
  defects,
  tasks,
  testCases = [],
  dualAdoConfig,
  adoConfig,
  geminiApiKey,
  onAddRelease,
  onUpdateRelease,
  onDeleteRelease,
  onSyncData,
  onOpenAdoModal,
  onOpenEmailModal
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);

  // Per-release sync states
  const [syncingReleaseId, setSyncingReleaseId] = useState<string | null>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'grid'>('compact');
  const [selectedDetailRelease, setSelectedDetailRelease] = useState<Release | null>(null);
  
  // Persisted fetch history per release
  const [fetchHistory, setFetchHistory] = useState<Record<string, ReleaseFetchResult>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_FETCH_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Modal for detailed breakdown of returned items
  const [inspectModalData, setInspectModalData] = useState<{
    release: Release;
    result: ReleaseFetchResult;
    activeTab: 'all' | 'stories' | 'bugs' | 'tasks' | 'testCases';
  } | null>(null);
  const [inspectSearchQuery, setInspectSearchQuery] = useState('');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
    stats?: { stories: number; bugs: number; tasks: number; testCases: number };
  } | null>(null);

  // ADO Live Metadata (Iterations and Areas)
  const [adoIterations, setAdoIterations] = useState<AdoIterationDto[]>([]);
  const [adoAreas, setAdoAreas] = useState<AdoAreaDto[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Prefetch ADO Iterations and Areas for accurate matching
  useEffect(() => {
    let isMounted = true;
    const loadAdoMetadata = async () => {
      try {
        setIsLoadingMetadata(true);
        const { org, project, pat } = getEffectiveAdoTarget();
        const [iterRes, areaRes] = await Promise.all([
          adoService.fetchIterations({ org, project, pat }),
          adoService.fetchAreas({ org, project, pat })
        ]);
        if (isMounted) {
          if (iterRes?.iterations && Array.isArray(iterRes.iterations)) {
            setAdoIterations(iterRes.iterations);
          }
          if (areaRes?.areas && Array.isArray(areaRes.areas)) {
            setAdoAreas(areaRes.areas);
          }
        }
      } catch (err) {
        console.warn('Could not prefetch ADO metadata:', err);
      } finally {
        if (isMounted) setIsLoadingMetadata(false);
      }
    };
    loadAdoMetadata();
    return () => { isMounted = false; };
  }, [dualAdoConfig, adoConfig]);

  // Form state
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [iterationPath, setIterationPath] = useState('');
  const [areaPath, setAreaPath] = useState('ACM');
  const [releaseNumber, setReleaseNumber] = useState('');
  const [status, setStatus] = useState<ReleaseStatus>('Active QA');
  const [description, setDescription] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Check for duplicate releases
  useEffect(() => {
    if (!name.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const trimmedName = name.trim().toLowerCase();
    const trimmedNum = releaseNumber.trim().toLowerCase();
    const trimmedIter = iterationPath.trim().toLowerCase();

    const duplicate = releases.find(r => {
      if (editingRelease && r.id === editingRelease.id) return false;
      const rName = r.name.toLowerCase();
      const rNum = (r.releaseNumber || '').toLowerCase();
      const rIter = (r.iterationPath || '').toLowerCase();

      // Exact name match
      if (rName === trimmedName) return true;
      // Exact release number match if provided
      if (trimmedNum && rNum && trimmedNum === rNum) return true;
      // Same iteration path match if provided
      if (trimmedIter && rIter && trimmedIter === rIter) return true;
      return false;
    });

    if (duplicate) {
      setDuplicateWarning(`A release named "${duplicate.name}" (${duplicate.status}, target: ${duplicate.targetDate}) already exists with matching name/iteration. Duplicate creation is blocked.`);
    } else {
      setDuplicateWarning(null);
    }
  }, [name, releaseNumber, iterationPath, editingRelease, releases]);

  // AI Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotesResult, setAiNotesResult] = useState('');
  const [selectedAiRelease, setSelectedAiRelease] = useState<Release | null>(null);

  // Save fetch history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FETCH_KEY, JSON.stringify(fetchHistory));
    } catch (e) {
      console.warn('Failed to save fetch history to localStorage:', e);
    }
  }, [fetchHistory]);

  // Clear toast after 6 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const filteredReleases = releases;

  // Resolve effective ADO target credentials
  const getEffectiveAdoTarget = () => {
    const internal = dualAdoConfig?.internal;
    const legacy = adoConfig;
    const rawOrg = internal?.organization || legacy?.organization || 'simetricwdh';
    const rawProject = internal?.project || legacy?.project || 'ACM';
    const target = parseAdoTarget(rawOrg, rawProject);
    const pat = internal?.pat || legacy?.pat || '';
    return {
      org: target.cleanOrg || 'simetricwdh',
      project: target.cleanProject || 'ACM',
      pat
    };
  };

  /**
   * Fetch Latest Data for a specific release
   */
  const handleFetchReleaseData = async (rel: Release) => {
    if (syncingReleaseId) return; // already syncing
    setSyncingReleaseId(rel.id);

    const { org, project, pat } = getEffectiveAdoTarget();

    try {
      // Query ADO for work items belonging to this release's iteration / area
      const syncResult: AdoSyncResponse = await adoService.syncWorkItems({
        org,
        project,
        pat,
        areaPath: rel.areaPath,
        iterationPath: rel.iterationPath
      });

      if (!syncResult.ok) {
        const errorResult: ReleaseFetchResult = {
          releaseId: rel.id,
          releaseName: rel.name,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dateStr: new Date().toLocaleDateString(),
          durationMs: syncResult.durationMs || 0,
          status: 'error',
          storiesCount: 0,
          bugsCount: 0,
          tasksCount: 0,
          testCasesCount: 0,
          totalCount: 0,
          source: syncResult.source || 'error',
          error: syncResult.error || 'Failed to query Azure DevOps'
        };

        setFetchHistory(prev => ({ ...prev, [rel.id]: errorResult }));
        setToastMessage({
          title: `Fetch Failed for ${rel.name}`,
          description: syncResult.error || 'Could not retrieve data from Azure DevOps. Check connection settings.',
          type: 'error'
        });
        return;
      }

      // Process and classify returned items
      const rawStories = syncResult.stories || [];
      const storiesList: UserStory[] = [];
      const testCasesList: TestCase[] = (syncResult.testCases || []).map(tc => mapToTestCase(tc, rel.id));
      const defectsList: Defect[] = (syncResult.defects || []).map(d => mapToDefect(d, rel.id));
      const tasksList: Task[] = (syncResult.tasks || []).map(t => mapToTask(t, rel.id));

      rawStories.forEach((s: any) => {
        if (isTestCaseItem(s)) {
          const converted = convertStoryToTestCase(s);
          const exists = testCasesList.some(tc => tc.id === converted.id || (converted.adoId && tc.adoId === converted.adoId));
          if (!exists) {
            testCasesList.push(mapToTestCase(converted, rel.id));
          }
        } else if (isDefectItem(s)) {
          const exists = defectsList.some(d => d.id === s.id || (s.adoId && d.adoId === s.adoId));
          if (!exists) {
            defectsList.push(mapToDefect(s, rel.id));
          }
        } else {
          storiesList.push(mapToUserStory(s, rel.id));
        }
      });

      const storiesCount = storiesList.length;
      const bugsCount = defectsList.length;
      const tasksCount = tasksList.length;
      const testCasesCount = testCasesList.length;
      const totalCount = storiesCount + bugsCount + tasksCount + testCasesCount;

      const fetchResult: ReleaseFetchResult = {
        releaseId: rel.id,
        releaseName: rel.name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        dateStr: new Date().toLocaleDateString(),
        durationMs: syncResult.durationMs || 0,
        status: 'success',
        storiesCount,
        bugsCount,
        tasksCount,
        testCasesCount,
        totalCount,
        source: syncResult.source || 'live_ado_wiql',
        itemsSummary: {
          stories: storiesList.map(s => ({ id: s.id, adoId: s.adoId, title: s.title, status: s.status })),
          bugs: defectsList.map(d => ({ id: d.id, adoId: d.adoId, title: d.title, severity: d.severity, status: d.status })),
          tasks: tasksList.map(t => ({ id: t.id, adoId: t.adoId, title: t.title, status: t.status })),
          testCases: testCasesList.map(tc => ({ id: tc.id, adoId: tc.adoId, title: tc.title, status: tc.status }))
        }
      };

      // Store in fetch history
      setFetchHistory(prev => ({
        ...prev,
        [rel.id]: fetchResult
      }));

      // Ingest into global app state so views update instantly
      if (onSyncData) {
        onSyncData({
          stories: storiesList,
          defects: defectsList,
          tasks: tasksList,
          testCases: testCasesList,
          selectedReleaseId: rel.id
        });
      }

      // Show toast notification
      setToastMessage({
        title: `Latest Data Fetched: ${rel.name}`,
        description: `Successfully fetched and updated live data (${fetchResult.durationMs}ms).`,
        type: 'success',
        stats: {
          stories: storiesCount,
          bugs: bugsCount,
          tasks: tasksCount,
          testCases: testCasesCount
        }
      });

    } catch (err: any) {
      console.error(`Fetch error for release ${rel.name}:`, err);
      const errorResult: ReleaseFetchResult = {
        releaseId: rel.id,
        releaseName: rel.name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        dateStr: new Date().toLocaleDateString(),
        durationMs: 0,
        status: 'error',
        storiesCount: 0,
        bugsCount: 0,
        tasksCount: 0,
        testCasesCount: 0,
        totalCount: 0,
        error: err.message || 'Network error while fetching release data'
      };
      setFetchHistory(prev => ({ ...prev, [rel.id]: errorResult }));
      setToastMessage({
        title: `Fetch Failed for ${rel.name}`,
        description: err.message || 'Unexpected network error.',
        type: 'error'
      });
    } finally {
      setSyncingReleaseId(null);
    }
  };

  /**
   * Fetch data for all visible releases
   */
  const handleFetchAllReleases = async () => {
    if (isFetchingAll || filteredReleases.length === 0) return;
    setIsFetchingAll(true);

    let totalStories = 0;
    let totalBugs = 0;
    let totalTasks = 0;
    let totalTests = 0;

    for (const rel of filteredReleases) {
      setSyncingReleaseId(rel.id);
      try {
        const { org, project, pat } = getEffectiveAdoTarget();
        const syncResult = await adoService.syncWorkItems({
          org,
          project,
          pat,
          areaPath: rel.areaPath,
          iterationPath: rel.iterationPath
        });

        if (syncResult.ok) {
          const rawStories = syncResult.stories || [];
          const storiesList: UserStory[] = [];
          const testCasesList: TestCase[] = (syncResult.testCases || []).map(tc => mapToTestCase(tc, rel.id));
          const defectsList: Defect[] = (syncResult.defects || []).map(d => mapToDefect(d, rel.id));
          const tasksList: Task[] = (syncResult.tasks || []).map(t => mapToTask(t, rel.id));

          rawStories.forEach((s: any) => {
            if (isTestCaseItem(s)) {
              testCasesList.push(mapToTestCase(convertStoryToTestCase(s), rel.id));
            } else if (isDefectItem(s)) {
              defectsList.push(mapToDefect(s, rel.id));
            } else {
              storiesList.push(mapToUserStory(s, rel.id));
            }
          });

          const storiesCount = storiesList.length;
          const bugsCount = defectsList.length;
          const tasksCount = tasksList.length;
          const testCasesCount = testCasesList.length;

          totalStories += storiesCount;
          totalBugs += bugsCount;
          totalTasks += tasksCount;
          totalTests += testCasesCount;

          const fetchResult: ReleaseFetchResult = {
            releaseId: rel.id,
            releaseName: rel.name,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            dateStr: new Date().toLocaleDateString(),
            durationMs: syncResult.durationMs || 0,
            status: 'success',
            storiesCount,
            bugsCount,
            tasksCount,
            testCasesCount,
            totalCount: storiesCount + bugsCount + tasksCount + testCasesCount,
            source: syncResult.source || 'live_ado_wiql',
            itemsSummary: {
              stories: storiesList.map(s => ({ id: s.id, adoId: s.adoId, title: s.title, status: s.status })),
              bugs: defectsList.map(d => ({ id: d.id, adoId: d.adoId, title: d.title, severity: d.severity, status: d.status })),
              tasks: tasksList.map(t => ({ id: t.id, adoId: t.adoId, title: t.title, status: t.status })),
              testCases: testCasesList.map(tc => ({ id: tc.id, adoId: tc.adoId, title: tc.title, status: tc.status }))
            }
          };

          setFetchHistory(prev => ({ ...prev, [rel.id]: fetchResult }));

          if (onSyncData) {
            onSyncData({
              stories: storiesList,
              defects: defectsList,
              tasks: tasksList,
              testCases: testCasesList,
              selectedReleaseId: rel.id
            });
          }
        }
      } catch (err) {
        console.error(`Failed to fetch release ${rel.name}:`, err);
      }
    }

    setSyncingReleaseId(null);
    setIsFetchingAll(false);

    setToastMessage({
      title: `All Releases Synchronized`,
      description: `Fetched live data across ${filteredReleases.length} releases.`,
      type: 'success',
      stats: {
        stories: totalStories,
        bugs: totalBugs,
        tasks: totalTasks,
        testCases: totalTests
      }
    });
  };

  // Helper to auto-match iteration path from ADO iterations
  const autoMatchIterationForRelease = (relName: string, relNum?: string) => {
    if (adoIterations.length === 0) return '';
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameNorm = norm(relName);
    const numNorm = norm(relNum || '');
    
    const found = adoIterations.find(it => {
      const itPathNorm = norm(it.path);
      const itNameNorm = norm(it.name);
      if (numNorm && numNorm.length >= 2 && (itPathNorm.includes(numNorm) || itNameNorm.includes(numNorm))) return true;
      if (nameNorm && nameNorm.length >= 3 && (itPathNorm.includes(nameNorm) || itNameNorm.includes(nameNorm) || nameNorm.includes(itNameNorm) || nameNorm.includes(itPathNorm))) return true;
      return false;
    });

    return found ? found.path : '';
  };

  const openAddModal = () => {
    setEditingRelease(null);
    setName('');
    setTargetDate(toDateStr(new Date()));
    setIterationPath('');
    setAreaPath('ACM');
    setReleaseNumber('');
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
    setAreaPath(rel.areaPath || 'ACM');
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
      {/* Toast Banner */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border shadow-lg flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
            : toastMessage.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
        }`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 p-1 rounded-lg bg-white/80 dark:bg-black/40 flex-shrink-0">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
              ) : toastMessage.type === 'error' ? (
                <AlertCircle size={18} className="text-rose-600 dark:text-rose-400" />
              ) : (
                <Info size={18} className="text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold leading-tight">{toastMessage.title}</h4>
              <p className="text-xs opacity-90 mt-0.5">{toastMessage.description}</p>
              
              {toastMessage.stats && (
                <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/50 flex items-center gap-1.5">
                    <CheckSquare size={13} />
                    <span>{toastMessage.stats.stories} User Stories</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300/50 flex items-center gap-1.5">
                    <Bug size={13} />
                    <span>{toastMessage.stats.bugs} Bugs</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-300/50 flex items-center gap-1.5">
                    <ListTodo size={13} />
                    <span>{toastMessage.stats.tasks} Tasks</span>
                  </span>
                  {toastMessage.stats.testCases > 0 && (
                    <span className="px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300/50 flex items-center gap-1.5">
                      <ShieldCheck size={13} />
                      <span>{toastMessage.stats.testCases} Test Cases</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header & Controls Toolbar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Releases & Scope Planner</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border)]">
              {filteredReleases.length} {filteredReleases.length === 1 ? 'Release' : 'Releases'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Milestones, verification gates, live Azure DevOps synchronization, and full scope detail drill-down
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle: Compact vs Grid */}
          <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border)] p-1 rounded-xl gap-1">
            <button
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
              title="Compact card view with click-to-open detail popup"
            >
              <LayoutList size={13} />
              <span>Compact View</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
              title="Expanded grid view"
            >
              <LayoutGrid size={13} />
              <span>Grid View</span>
            </button>
          </div>

          {/* Fetch All Releases Data Button */}
          <button
            onClick={handleFetchAllReleases}
            disabled={isFetchingAll || Boolean(syncingReleaseId)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white border border-[var(--primary)]/30 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fetch and update latest Azure DevOps work items for all releases"
          >
            <RefreshCw size={14} className={isFetchingAll ? 'animate-spin' : ''} />
            <span>{isFetchingAll ? 'Fetching All...' : 'Fetch All Releases Data'}</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} />
            <span>New Release</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPACT VIEW OF RELEASES */}
      {/* ========================================================================= */}
      {viewMode === 'compact' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReleases.map(rel => {
            const st = STATUS_CONFIG[rel.status] || STATUS_CONFIG['Planning'];
            const relStories = userStories.filter(s => matchesReleaseOrIteration(s, rel.id, releases));
            const relDefects = defects.filter(d => matchesReleaseOrIteration(d, rel.id, releases));
            const relTasks = tasks.filter(t => matchesReleaseOrIteration(t, rel.id, releases));
            
            const lastFetch = fetchHistory[rel.id];
            const totalStories = lastFetch && lastFetch.status === 'success' && lastFetch.storiesCount !== undefined
              ? Math.max(lastFetch.storiesCount, relStories.length)
              : relStories.length;

            const passedStories = relStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
            const storyProgress = totalStories > 0 ? Math.round((passedStories / totalStories) * 100) : 0;
            
            const openDefectsList = relDefects.filter(d => d.status !== 'Closed');
            const openDefects = lastFetch && lastFetch.status === 'success' && lastFetch.bugsCount !== undefined
              ? Math.max(lastFetch.bugsCount, openDefectsList.length)
              : openDefectsList.length;

            const criticalDefects = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
            
            const totalTasks = lastFetch && lastFetch.status === 'success' && lastFetch.tasksCount !== undefined
              ? Math.max(lastFetch.tasksCount, relTasks.length)
              : relTasks.length;

            const completedTasks = relTasks.filter(t => t.status === 'complete').length;
            const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const relNum = rel.releaseNumber || extractReleaseNumber(rel.name);
            const isThisSyncing = syncingReleaseId === rel.id;

            return (
              <div
                key={rel.id}
                onClick={() => setSelectedDetailRelease(rel)}
                className={`bg-[var(--surface)] border ${
                  isThisSyncing ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : 'border-[var(--border)]'
                } rounded-2xl p-4.5 shadow-xs flex flex-col justify-between hover:border-[var(--primary)] hover:shadow-md transition-all relative overflow-hidden group cursor-pointer`}
              >
                {/* Syncing Progress Line */}
                {isThisSyncing && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--primary-light)] overflow-hidden">
                    <div className="w-1/2 h-full bg-[var(--primary)] animate-pulse"></div>
                  </div>
                )}

                <div>
                  {/* Card Top Row: Badges & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-md border border-[var(--border)]">
                        {relNum}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-semibold flex items-center gap-1">
                        <Calendar size={11} className="text-[var(--primary)]" />
                        <span>{formatDisplayDate(rel.targetDate)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 text-[var(--text-muted)] shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(rel)}
                        className="p-1 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-colors"
                        title="Edit Release Properties"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteRelease(rel.id)}
                        className="p-1 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg cursor-pointer transition-colors"
                        title="Delete Release"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Release Title */}
                  <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug break-words group-hover:text-[var(--primary)] transition-colors">
                    {rel.name}
                  </h3>

                  {rel.description && (
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-1">
                      {rel.description}
                    </p>
                  )}

                  {/* Path Tags */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-[10.5px] font-mono">
                    {rel.iterationPath && (
                      <div className="flex items-center gap-1 text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded border border-[var(--primary)]/20 truncate max-w-full">
                        <FolderGit2 size={11} className="shrink-0" />
                        <span className="truncate">{rel.iterationPath}</span>
                      </div>
                    )}
                  </div>

                  {/* ========================================================================= */}
                  {/* 3 CLARIFIED COMPACT SCOPE METRICS WITH DESCRIPTIONS */}
                  {/* ========================================================================= */}
                  <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-[var(--border)]">
                    
                    {/* 1. Stories Metric */}
                    <div 
                      className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-2 text-center flex flex-col justify-between"
                      title={`${passedStories} of ${totalStories} User Stories are QA Passed or Done (${storyProgress}% completed). Click for story breakdown.`}
                    >
                      <div>
                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {passedStories}/{totalStories}
                        </div>
                        <div className="text-[9.5px] font-bold text-[var(--text-muted)] uppercase tracking-tight">Stories</div>
                      </div>
                      <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${storyProgress}%` }} />
                      </div>
                      <div className="text-[8.5px] text-emerald-700 dark:text-emerald-300 font-semibold mt-1 truncate">
                        {storyProgress}% Passed
                      </div>
                    </div>

                    {/* 2. Bugs Metric */}
                    <div 
                      className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-2 text-center flex flex-col justify-between"
                      title={`${openDefects} Active Bugs. ${criticalDefects > 0 ? `${criticalDefects} Critical Blocker (1C) requires resolution before sign-off.` : 'No critical blockers.'} Click for defect breakdown.`}
                    >
                      <div>
                        <div className={`text-xs font-black font-mono flex items-center justify-center gap-0.5 ${criticalDefects > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>
                          <span>{openDefects}</span>
                          {criticalDefects > 0 && (
                            <span className="text-[10px] font-bold text-rose-500">({criticalDefects}C)</span>
                          )}
                        </div>
                        <div className="text-[9.5px] font-bold text-[var(--text-muted)] uppercase tracking-tight">Bugs</div>
                      </div>
                      {criticalDefects > 0 ? (
                        <div className="text-[8.5px] font-bold text-rose-600 dark:text-rose-400 mt-1 bg-rose-500/10 rounded py-0.5 px-1 truncate">
                          {criticalDefects} Critical
                        </div>
                      ) : (
                        <div className="text-[8.5px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 truncate">
                          0 Critical
                        </div>
                      )}
                    </div>

                    {/* 3. Tasks Metric */}
                    <div 
                      className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-2 text-center flex flex-col justify-between"
                      title={`${completedTasks} of ${totalTasks} Sprint Tasks are Closed (${taskProgress}% completed). Click for task breakdown.`}
                    >
                      <div>
                        <div className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                          {completedTasks}/{totalTasks}
                        </div>
                        <div className="text-[9.5px] font-bold text-[var(--text-muted)] uppercase tracking-tight">Tasks</div>
                      </div>
                      <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${taskProgress}%` }} />
                      </div>
                      <div className="text-[8.5px] text-blue-700 dark:text-blue-300 font-semibold mt-1 truncate">
                        {taskProgress}% Closed
                      </div>
                    </div>

                  </div>
                </div>

                {/* Card Bottom: Quick Actions and View Scope Trigger */}
                <div className="mt-3.5 pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedDetailRelease(rel)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white text-[var(--primary)] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    <span>View Full Details</span>
                    <ChevronRight size={13} />
                  </button>

                  <button
                    onClick={() => handleFetchReleaseData(rel)}
                    disabled={isThisSyncing || isFetchingAll}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors cursor-pointer disabled:opacity-50"
                    title={`Sync live Azure DevOps items for ${rel.name}`}
                  >
                    <RefreshCw size={13} className={isThisSyncing ? 'animate-spin text-[var(--primary)]' : ''} />
                  </button>

                  <button
                    onClick={() => handleGenerateAiNotes(rel)}
                    className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-amber-500 hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors cursor-pointer"
                    title="Generate Gemini AI Release Risk Notes"
                  >
                    <Sparkles size={13} />
                  </button>

                  {onOpenEmailModal && (
                    <button
                      onClick={() => onOpenEmailModal('system_testing_daily', undefined, rel.id)}
                      className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-500/10 border border-[var(--border)] transition-colors cursor-pointer"
                      title={`Draft AI System Testing Daily Report for ${rel.name}`}
                    >
                      <Mail size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED GRID VIEW OF RELEASES */}
      {/* ========================================================================= */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReleases.map(rel => {
            const st = STATUS_CONFIG[rel.status] || STATUS_CONFIG['Planning'];
            const relStories = userStories.filter(s => matchesReleaseOrIteration(s, rel.id, releases));
            const relDefects = defects.filter(d => matchesReleaseOrIteration(d, rel.id, releases));
            const relTasks = tasks.filter(t => matchesReleaseOrIteration(t, rel.id, releases));
            
            const lastFetch = fetchHistory[rel.id];
            const totalStories = lastFetch && lastFetch.status === 'success' && lastFetch.storiesCount !== undefined
              ? Math.max(lastFetch.storiesCount, relStories.length)
              : relStories.length;

            const passedStories = relStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
            const storyProgress = totalStories > 0 ? Math.round((passedStories / totalStories) * 100) : 0;
            
            const openDefectsList = relDefects.filter(d => d.status !== 'Closed');
            const openDefects = lastFetch && lastFetch.status === 'success' && lastFetch.bugsCount !== undefined
              ? Math.max(lastFetch.bugsCount, openDefectsList.length)
              : openDefectsList.length;

            const criticalDefects = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
            
            const totalTasks = lastFetch && lastFetch.status === 'success' && lastFetch.tasksCount !== undefined
              ? Math.max(lastFetch.tasksCount, relTasks.length)
              : relTasks.length;

            const completedTasks = relTasks.filter(t => t.status === 'complete').length;
            const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const relNum = rel.releaseNumber || extractReleaseNumber(rel.name);
            const isThisSyncing = syncingReleaseId === rel.id;

            return (
              <div
                key={rel.id}
                className={`bg-[var(--surface)] border ${
                  isThisSyncing ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : 'border-[var(--border)]'
                } rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[var(--primary)] transition-all relative overflow-hidden`}
              >
                {/* Syncing Progress Line */}
                {isThisSyncing && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--primary-light)] overflow-hidden">
                    <div className="w-1/2 h-full bg-[var(--primary)] animate-pulse"></div>
                  </div>
                )}

                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-md border border-[var(--border)]">
                        {relNum}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[var(--text-muted)] shrink-0">
                      <button
                        onClick={() => openEditModal(rel)}
                        className="p-1.5 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-colors"
                        title="Edit Release Properties"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteRelease(rel.id)}
                        className="p-1.5 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg cursor-pointer transition-colors"
                        title="Delete Release"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 
                    onClick={() => setSelectedDetailRelease(rel)}
                    className="text-base font-bold text-[var(--text-primary)] leading-snug break-words hover:text-[var(--primary)] cursor-pointer transition-colors"
                  >
                    {rel.name}
                  </h3>
                  
                  {rel.description && (
                    <p className="text-xs text-[var(--text-secondary)] font-medium mt-1.5 leading-relaxed">
                      {rel.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] mt-3">
                    <Calendar size={13} className="text-[var(--primary)] shrink-0" />
                    <span>Target: {formatDisplayDate(rel.targetDate)}</span>
                  </div>

                  {rel.areaPath && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-1.5 font-mono min-w-0">
                      <Layers size={13} className="text-[var(--text-muted)] shrink-0" />
                      <span className="text-[11px] font-semibold truncate" title={rel.areaPath}>Area: {rel.areaPath}</span>
                    </div>
                  )}

                  {rel.iterationPath && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--primary)] mt-1 font-mono min-w-0">
                      <FolderGit2 size={13} className="shrink-0" />
                      <span className="text-[11px] font-bold truncate" title={rel.iterationPath}>{rel.iterationPath}</span>
                    </div>
                  )}

                  {/* Scope & QA Metrics Container */}
                  <div 
                    onClick={() => setSelectedDetailRelease(rel)}
                    className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[var(--border)] cursor-pointer group/metrics"
                  >
                    <div className="bg-[var(--surface-hover)] group-hover/metrics:border-emerald-500/50 border border-[var(--border)] rounded-xl p-2 text-center transition-colors">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {passedStories}/{totalStories}
                      </div>
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Stories</div>
                      <div className="text-[8.5px] text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">{storyProgress}% Passed</div>
                    </div>

                    <div className="bg-[var(--surface-hover)] group-hover/metrics:border-rose-500/50 border border-[var(--border)] rounded-xl p-2 text-center transition-colors">
                      <div className={`text-xs font-black font-mono ${criticalDefects > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>
                        {openDefects} {criticalDefects > 0 && `(${criticalDefects}C)`}
                      </div>
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Bugs</div>
                      <div className={`text-[8.5px] font-semibold mt-0.5 ${criticalDefects > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'}`}>
                        {criticalDefects > 0 ? `${criticalDefects} Critical` : '0 Critical'}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-hover)] group-hover/metrics:border-blue-500/50 border border-[var(--border)] rounded-xl p-2 text-center transition-colors">
                      <div className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                        {completedTasks}/{totalTasks}
                      </div>
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Tasks</div>
                      <div className="text-[8.5px] text-blue-700 dark:text-blue-300 font-semibold mt-0.5">{taskProgress}% Closed</div>
                    </div>
                  </div>

                  {/* Detailed ADO Fetch Info */}
                  <div className="mt-3.5 p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)]">
                        <Database size={13} className="text-[var(--primary)]" />
                        <span>Latest ADO Fetch Info</span>
                      </div>
                      {lastFetch && (
                        <span className="text-[10px] text-[var(--text-muted)] font-medium flex items-center gap-1">
                          <Clock size={11} />
                          <span>{lastFetch.timestamp}</span>
                        </span>
                      )}
                    </div>

                    {lastFetch ? (
                      lastFetch.status === 'error' ? (
                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-[11px] text-rose-700 dark:text-rose-300">
                          <span className="font-bold">Fetch Error: </span>
                          <span className="line-clamp-2">{lastFetch.error || 'Query failed'}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {lastFetch.storiesCount}
                              </div>
                              <div className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300">
                                User Story
                              </div>
                            </div>

                            <div className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                              <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                                {lastFetch.bugsCount}
                              </div>
                              <div className="text-[9.5px] font-bold text-rose-700 dark:text-rose-300">
                                Bug
                              </div>
                            </div>

                            <div className="px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <div className="text-xs font-black text-blue-600 dark:text-blue-400">
                                {lastFetch.tasksCount}
                              </div>
                              <div className="text-[9.5px] font-bold text-blue-700 dark:text-blue-300">
                                Task
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]/50">
                            <span>
                              Total: <strong className="text-[var(--text-primary)]">{lastFetch.totalCount} returned</strong> ({lastFetch.durationMs}ms)
                            </span>
                            <button
                              onClick={() => setSelectedDetailRelease(rel)}
                              className="font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Full Scope Popup</span>
                              <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="py-2 text-center text-[11px] text-[var(--text-muted)]">
                        <span>No ADO fetch recorded yet for this release.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFetchReleaseData(rel)}
                      disabled={isThisSyncing || isFetchingAll}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-98 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      title={`Fetch latest User Stories, Bugs, and Tasks for ${rel.name} from Azure DevOps`}
                    >
                      <RefreshCw size={14} className={isThisSyncing ? 'animate-spin' : ''} />
                      <span>
                        {isThisSyncing ? 'Fetching Live...' : 'Fetch Latest Data'}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedDetailRelease(rel)}
                      className="py-2 px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                    >
                      <span>Scope Details</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateAiNotes(rel)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[var(--primary-light)] hover:bg-[var(--primary)] hover:text-white text-[var(--primary)] text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>AI Notes</span>
                    </button>

                    {onOpenEmailModal && (
                      <button
                        onClick={() => onOpenEmailModal('release_signoff', undefined, rel.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl transition-all border border-emerald-500/20 cursor-pointer"
                        title="Generate and Send Release Go/No-Go Sign-Off Email"
                      >
                        <Mail size={13} />
                        <span>Sign-Off Email</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FULL RELEASE DETAILS POPUP MODAL */}
      {/* ========================================================================= */}
      {selectedDetailRelease && (
        <ReleaseDetailModal
          release={selectedDetailRelease}
          isOpen={Boolean(selectedDetailRelease)}
          onClose={() => setSelectedDetailRelease(null)}
          userStories={userStories.filter(s => matchesReleaseOrIteration(s, selectedDetailRelease.id, releases))}
          defects={defects.filter(d => matchesReleaseOrIteration(d, selectedDetailRelease.id, releases))}
          tasks={tasks.filter(t => matchesReleaseOrIteration(t, selectedDetailRelease.id, releases))}
          testCases={testCases.filter(tc => matchesReleaseOrIteration(tc, selectedDetailRelease.id, releases))}
          lastFetch={fetchHistory[selectedDetailRelease.id]}
          isSyncing={syncingReleaseId === selectedDetailRelease.id}
          onFetchReleaseData={handleFetchReleaseData}
          onGenerateAiNotes={handleGenerateAiNotes}
          onEditRelease={openEditModal}
        />
      )}

      {/* ========================================================================= */}
      {/* INSPECT RETURNED ITEMS MODAL */}
      {/* ========================================================================= */}
      {inspectModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-hover)] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
                  <Database size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">
                    Returned Work Items & Scope Breakdown
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {inspectModalData.release.name} &bull; Fetched at {inspectModalData.result.timestamp} ({inspectModalData.result.durationMs}ms)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectModalData(null)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Counts Ribbon */}
            <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setInspectModalData(prev => prev ? { ...prev, activeTab: 'all' } : null)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    inspectModalData.activeTab === 'all'
                      ? 'bg-[var(--text-primary)] text-[var(--bg)] shadow-xs'
                      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  All Items ({inspectModalData.result.totalCount})
                </button>
                <button
                  onClick={() => setInspectModalData(prev => prev ? { ...prev, activeTab: 'stories' } : null)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectModalData.activeTab === 'stories'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                >
                  <CheckSquare size={13} />
                  <span>User Story ({inspectModalData.result.storiesCount})</span>
                </button>
                <button
                  onClick={() => setInspectModalData(prev => prev ? { ...prev, activeTab: 'bugs' } : null)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectModalData.activeTab === 'bugs'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
                  }`}
                >
                  <Bug size={13} />
                  <span>Bug ({inspectModalData.result.bugsCount})</span>
                </button>
                <button
                  onClick={() => setInspectModalData(prev => prev ? { ...prev, activeTab: 'tasks' } : null)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectModalData.activeTab === 'tasks'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
                  }`}
                >
                  <ListTodo size={13} />
                  <span>Task ({inspectModalData.result.tasksCount})</span>
                </button>
                {inspectModalData.result.testCasesCount > 0 && (
                  <button
                    onClick={() => setInspectModalData(prev => prev ? { ...prev, activeTab: 'testCases' } : null)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      inspectModalData.activeTab === 'testCases'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                    }`}
                  >
                    <ShieldCheck size={13} />
                    <span>Test Cases ({inspectModalData.result.testCasesCount})</span>
                  </button>
                )}
              </div>

              {/* Search Filter */}
              <div className="relative min-w-[200px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter returned items..."
                  value={inspectSearchQuery}
                  onChange={e => setInspectSearchQuery(e.target.value)}
                  className="w-full text-xs pl-7 pr-3 py-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>
            </div>

            {/* List Body */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 divide-y divide-[var(--border)]">
              {(() => {
                const summary = inspectModalData.result.itemsSummary || { stories: [], bugs: [], tasks: [], testCases: [] };
                
                let displayedItems: Array<{ type: 'User Story' | 'Bug' | 'Task' | 'Test Case'; id: string; adoId?: number; title: string; status: string; severity?: string }> = [];

                if (inspectModalData.activeTab === 'all' || inspectModalData.activeTab === 'stories') {
                  displayedItems.push(...summary.stories.map(s => ({ ...s, type: 'User Story' as const })));
                }
                if (inspectModalData.activeTab === 'all' || inspectModalData.activeTab === 'bugs') {
                  displayedItems.push(...summary.bugs.map(b => ({ ...b, type: 'Bug' as const })));
                }
                if (inspectModalData.activeTab === 'all' || inspectModalData.activeTab === 'tasks') {
                  displayedItems.push(...summary.tasks.map(t => ({ ...t, type: 'Task' as const })));
                }
                if (inspectModalData.activeTab === 'all' || inspectModalData.activeTab === 'testCases') {
                  displayedItems.push(...summary.testCases.map(tc => ({ ...tc, type: 'Test Case' as const })));
                }

                if (inspectSearchQuery.trim()) {
                  const q = inspectSearchQuery.toLowerCase();
                  displayedItems = displayedItems.filter(i => 
                    i.title.toLowerCase().includes(q) || 
                    String(i.adoId || '').includes(q) ||
                    i.status.toLowerCase().includes(q) ||
                    i.type.toLowerCase().includes(q)
                  );
                }

                if (displayedItems.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                      <Info size={24} className="mx-auto mb-2 opacity-50" />
                      <span>No items found matching the selected filter.</span>
                    </div>
                  );
                }

                return displayedItems.map(item => (
                  <div key={`${item.type}-${item.id}`} className="py-3 flex items-center justify-between gap-3 hover:bg-[var(--surface-hover)] px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Type Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1 ${
                        item.type === 'User Story'
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/40'
                          : item.type === 'Bug'
                          ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300/40'
                          : item.type === 'Task'
                          ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-300/40'
                          : 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300/40'
                      }`}>
                        {item.type === 'User Story' && <CheckSquare size={11} />}
                        {item.type === 'Bug' && <Bug size={11} />}
                        {item.type === 'Task' && <ListTodo size={11} />}
                        {item.type === 'Test Case' && <ShieldCheck size={11} />}
                        <span>{item.type}</span>
                      </span>

                      {/* ADO ID */}
                      {item.adoId && (
                        <span className="text-[11px] font-mono font-bold text-[var(--text-muted)] flex-shrink-0">
                          #{item.adoId}
                        </span>
                      )}

                      {/* Title */}
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate" title={item.title}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.severity && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.severity === 'critical' 
                            ? 'bg-rose-500 text-white' 
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}>
                          {item.severity}
                        </span>
                      )}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] font-medium">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-hover)] flex-shrink-0">
              <span className="text-xs text-[var(--text-muted)]">
                Synchronized with internal Azure DevOps service.
              </span>
              <button
                onClick={() => setInspectModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                  placeholder="e.g. D5-R2609 - September 2026"
                  value={name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setName(newName);
                    if (!releaseNumber || releaseNumber === 'v4.2.0') {
                      setReleaseNumber(extractReleaseNumber(newName));
                    }
                    // If iteration path is empty, try to auto-match
                    if (!iterationPath) {
                      const matched = autoMatchIterationForRelease(newName, releaseNumber);
                      if (matched) setIterationPath(matched);
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
                    placeholder="e.g. v2026.09"
                    value={releaseNumber}
                    onChange={(e) => {
                      const newNum = e.target.value;
                      setReleaseNumber(newNum);
                      if (!iterationPath) {
                        const matched = autoMatchIterationForRelease(name, newNum);
                        if (matched) setIterationPath(matched);
                      }
                    }}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">Area Path (ADO)</label>
                    {adoAreas.length > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] font-medium">
                        {adoAreas.length} in ADO
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    list="ado-areas-datalist"
                    placeholder="e.g. ACM or Project\Area"
                    value={areaPath}
                    onChange={(e) => setAreaPath(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] font-mono focus:border-[var(--primary)]"
                  />
                  <datalist id="ado-areas-datalist">
                    {adoAreas.map(a => (
                      <option key={a.id || a.path} value={a.path}>{a.name}</option>
                    ))}
                  </datalist>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Iteration Path (ADO Sync)
                  </label>
                  <div className="flex items-center gap-2">
                    {adoIterations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const matched = autoMatchIterationForRelease(name, releaseNumber);
                          if (matched) {
                            setIterationPath(matched);
                          } else if (adoIterations.length > 0) {
                            setIterationPath(adoIterations[0].path);
                          }
                        }}
                        className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Auto-detect closest ADO Iteration path based on Release title / version"
                      >
                        <Sparkles size={10} />
                        <span>Auto-match Iteration</span>
                      </button>
                    )}
                    {adoIterations.length > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        ({adoIterations.length} live)
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  list="ado-iterations-datalist"
                  placeholder="e.g. ACM\D5 R 2026.09 or Sprint 24"
                  value={iterationPath}
                  onChange={(e) => setIterationPath(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] font-mono focus:border-[var(--primary)]"
                />
                <datalist id="ado-iterations-datalist">
                  {adoIterations.map(it => (
                    <option key={it.id || it.path} value={it.path}>{it.name} {it.isCurrent ? '(Current)' : ''}</option>
                  ))}
                </datalist>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Exact Azure DevOps Iteration path used by WIQL to retrieve User Stories, Bugs, and Tasks.
                </p>
              </div>

              {/* Duplicate Release Prevention Banner */}
              {duplicateWarning && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Duplicate Release Prevented:</span>
                    <p className="mt-0.5 opacity-90">{duplicateWarning}</p>
                  </div>
                </div>
              )}

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
                  disabled={Boolean(duplicateWarning && !editingRelease)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
