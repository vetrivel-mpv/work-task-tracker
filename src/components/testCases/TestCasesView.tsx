import React, { useState, useMemo } from 'react';
import { 
  TestCase, 
  TestCaseStatus, 
  TestExecutionStatus, 
  TestCaseType, 
  TestStep,
  UserStory, 
  Defect, 
  Release, 
  TeamMember, 
  TeamGroup, 
  Priority 
} from '../../types';
import { 
  Plus, 
  FileCheck2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Play, 
  Edit3, 
  Trash2, 
  Filter, 
  Search, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Tag, 
  FolderGit2, 
  Building2, 
  Sparkles, 
  CheckSquare, 
  Layers, 
  Zap, 
  BookOpen, 
  Bug, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Copy
} from 'lucide-react';
import { generateId, toDateStr } from '../../utils/date';
import { getAllAreaPaths, getIterationPathsForArea } from '../../utils/adoPaths';

interface TestCasesViewProps {
  testCases: TestCase[];
  userStories: UserStory[];
  defects: Defect[];
  releases: Release[];
  team: TeamMember[];
  groups: TeamGroup[];
  selectedReleaseId: string | null;
  onAddTestCase: (testCase: TestCase) => void;
  onUpdateTestCase: (testCase: TestCase) => void;
  onDeleteTestCase: (testCaseId: string) => void;
}

const STATUS_OPTIONS: { value: TestCaseStatus; label: string; desc: string; color: string }[] = [
  { value: 'Design', label: 'Design (Drafting)', desc: 'Test case is being authored or reviewed', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  { value: 'Ready', label: 'Ready for Test', desc: 'Approved and ready for manual/automation execution', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { value: 'In Progress', label: 'In Progress', desc: 'Currently being executed or verified', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
  { value: 'Automated', label: 'Automated Suite', desc: 'Covered by CI/CD automated test pipeline', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { value: 'Closed', label: 'Closed / Deprecated', desc: 'Archived or completed verification', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30' }
];

const EXECUTION_OPTIONS: { value: TestExecutionStatus; label: string; icon: any; color: string }[] = [
  { value: 'Not Run', label: 'Not Run', icon: Clock, color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/30' },
  { value: 'Passed', label: 'Passed', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { value: 'Failed', label: 'Failed', icon: XCircle, color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  { value: 'Blocked', label: 'Blocked', icon: AlertTriangle, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { value: 'In Progress', label: 'Executing', icon: Play, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' }
];

const TYPE_OPTIONS: TestCaseType[] = [
  'Manual',
  'Automated',
  'Regression',
  'Smoke',
  'Integration',
  'E2E',
  'Performance',
  'Security'
];

export const TestCasesView: React.FC<TestCasesViewProps> = ({
  testCases = [],
  userStories = [],
  defects = [],
  releases = [],
  team = [],
  groups = [],
  selectedReleaseId,
  onAddTestCase,
  onUpdateTestCase,
  onDeleteTestCase
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterExecution, setFilterExecution] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterRelease, setFilterRelease] = useState<string>(selectedReleaseId || '');
  const [filterAreaPath, setFilterAreaPath] = useState<string>('');
  const [filterStoryId, setFilterStoryId] = useState<string>('');

  // Expand test steps tracking
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);

  // Runner Modal State
  const [runnerTestCase, setRunnerTestCase] = useState<TestCase | null>(null);
  const [activeStepResults, setActiveStepResults] = useState<Record<string, { status: TestExecutionStatus; notes: string }>>({});

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TestCaseStatus>('Design');
  const [executionStatus, setExecutionStatus] = useState<TestExecutionStatus>('Not Run');
  const [testType, setTestType] = useState<TestCaseType>('Manual');
  const [priority, setPriority] = useState<Priority>('high');
  const [preconditions, setPreconditions] = useState('');
  const [userStoryId, setUserStoryId] = useState<string>('');
  const [defectId, setDefectId] = useState<string>('');
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || releases[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [areaPath, setAreaPath] = useState<string>('CareFlow-Core\\Clinical-Portal');
  const [iterationPath, setIterationPath] = useState<string>('CareFlow-Core\\Sprint 24');
  const [steps, setSteps] = useState<{ id: string; stepNumber: number; action: string; expectedResult: string }[]>([
    { id: 'st-1', stepNumber: 1, action: '', expectedResult: '' }
  ]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Path helpers
  const availableAreaPaths = getAllAreaPaths(releases, userStories, defects, []);
  const returnedIterationPaths = getIterationPathsForArea(filterAreaPath, releases, userStories, defects);
  const modalReturnedIterations = getIterationPathsForArea(areaPath, releases, userStories, defects);

  // Filtered Test Cases
  const filteredTestCases = useMemo(() => {
    return testCases.filter(tc => {
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = tc.title.toLowerCase().includes(q);
        const matchesDesc = (tc.description || '').toLowerCase().includes(q);
        const matchesAdo = tc.adoId ? String(tc.adoId).includes(q) : false;
        const matchesPre = (tc.preconditions || '').toLowerCase().includes(q);
        const matchesSteps = (tc.steps || []).some(s => 
          s.action.toLowerCase().includes(q) || s.expectedResult.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesDesc && !matchesAdo && !matchesPre && !matchesSteps) {
          return false;
        }
      }

      if (filterStatus && tc.status !== filterStatus) return false;
      if (filterExecution && tc.executionStatus !== filterExecution) return false;
      if (filterType && tc.testType !== filterType) return false;
      if (filterRelease && tc.releaseId !== filterRelease) return false;
      if (filterAreaPath && tc.areaPath !== filterAreaPath) return false;
      if (filterStoryId && tc.userStoryId !== filterStoryId) return false;

      return true;
    });
  }, [testCases, search, filterStatus, filterExecution, filterType, filterRelease, filterAreaPath, filterStoryId]);

  // Rollup Metrics
  const totalCount = testCases.length;
  const designCount = testCases.filter(tc => tc.status === 'Design').length;
  const readyCount = testCases.filter(tc => tc.status === 'Ready').length;
  const automatedCount = testCases.filter(tc => tc.status === 'Automated').length;
  const passedCount = testCases.filter(tc => tc.executionStatus === 'Passed').length;
  const failedCount = testCases.filter(tc => tc.executionStatus === 'Failed').length;
  const blockedCount = testCases.filter(tc => tc.executionStatus === 'Blocked').length;
  const notRunCount = testCases.filter(tc => tc.executionStatus === 'Not Run').length;
  const executedCount = totalCount - notRunCount;
  const passRate = executedCount > 0 ? Math.round((passedCount / executedCount) * 100) : 0;

  // Toggle step collapse
  const toggleSteps = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open Add Modal
  const openAddModal = (prefillStoryId?: string) => {
    setEditingTestCase(null);
    setTitle('');
    setDescription('');
    setStatus('Design');
    setExecutionStatus('Not Run');
    setTestType('Manual');
    setPriority('high');
    setPreconditions('');
    
    const targetStory = userStories.find(s => s.id === prefillStoryId);
    setUserStoryId(prefillStoryId || '');
    setDefectId('');
    
    const defaultRel = targetStory?.releaseId || selectedReleaseId || releases[0]?.id || '';
    setReleaseId(defaultRel);
    
    const defaultArea = targetStory?.areaPath || filterAreaPath || 'CareFlow-Core\\Clinical-Portal';
    setAreaPath(defaultArea);
    
    const iters = getIterationPathsForArea(defaultArea, releases, userStories, defects);
    setIterationPath(targetStory?.iterationPath || iters[0]?.iterationPath || 'CareFlow-Core\\Sprint 24');
    setAssigneeId(team[1]?.id || team[0]?.id || '');
    
    setSteps([
      { id: 'st-1', stepNumber: 1, action: '', expectedResult: '' },
      { id: 'st-2', stepNumber: 2, action: '', expectedResult: '' }
    ]);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (tc: TestCase) => {
    setEditingTestCase(tc);
    setTitle(tc.title);
    setDescription(tc.description || '');
    setStatus(tc.status);
    setExecutionStatus(tc.executionStatus);
    setTestType(tc.testType);
    setPriority(tc.priority);
    setPreconditions(tc.preconditions || '');
    setUserStoryId(tc.userStoryId || '');
    setDefectId(tc.defectId || '');
    setReleaseId(tc.releaseId || '');
    setAssigneeId(tc.assigneeId || '');
    setAreaPath(tc.areaPath || 'CareFlow-Core\\Clinical-Portal');
    setIterationPath(tc.iterationPath || 'CareFlow-Core\\Sprint 24');
    
    if (tc.steps && tc.steps.length > 0) {
      setSteps(tc.steps.map((s, idx) => ({
        id: s.id || `st-${idx + 1}`,
        stepNumber: s.stepNumber || idx + 1,
        action: s.action,
        expectedResult: s.expectedResult
      })));
    } else {
      setSteps([{ id: 'st-1', stepNumber: 1, action: '', expectedResult: '' }]);
    }

    setModalOpen(true);
  };

  // Step Management in Form
  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      { id: generateId(), stepNumber: prev.length + 1, action: '', expectedResult: '' }
    ]);
  };

  const handleUpdateStep = (index: number, field: 'action' | 'expectedResult', val: string) => {
    setSteps(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  // AI Test Step Generator
  const handleAiGenerateSteps = async () => {
    const linkedStory = userStories.find(s => s.id === userStoryId);
    if (!title && !linkedStory) {
      alert('Please enter a Test Case Title or select a Linked User Story first to generate test steps.');
      return;
    }

    setIsAiGenerating(true);
    try {
      const prompt = `You are a Principal QA Automation Lead.
Generate 3 to 4 concrete, sequential QA test steps with specific Actions and Expected Results for:
TEST CASE: ${title || 'Verification of User Story'}
LINKED STORY: ${linkedStory?.title || 'N/A'}
ACCEPTANCE CRITERIA: ${(linkedStory?.acceptanceCriteria || []).join('; ') || 'N/A'}

Respond with practical steps.`;

      // Mock synthesis / fallback for immediate responsiveness
      setTimeout(() => {
        const generatedSteps = [
          {
            id: generateId(),
            stepNumber: 1,
            action: `Navigate to target module and verify initial UI state and permissions for ${linkedStory?.title?.slice(0, 30) || title.slice(0, 30)}.`,
            expectedResult: 'View loads with 200 OK and all initial form controls enabled.'
          },
          {
            id: generateId(),
            stepNumber: 2,
            action: 'Submit standard input data satisfying core acceptance criteria and trigger execution.',
            expectedResult: 'System processes data successfully, updates status badge, and emits telemetry confirmation.'
          },
          {
            id: generateId(),
            stepNumber: 3,
            action: 'Attempt concurrent or edge-case input (e.g. rapid double-submit or boundary values).',
            expectedResult: 'System gracefully prevents collision, returns appropriate validation toast, and maintains data integrity.'
          }
        ];
        setSteps(generatedSteps);
        setIsAiGenerating(false);
      }, 700);
    } catch {
      setIsAiGenerating(false);
    }
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validSteps: TestStep[] = steps
      .filter(s => s.action.trim() || s.expectedResult.trim())
      .map((s, idx) => ({
        id: s.id,
        stepNumber: idx + 1,
        action: s.action.trim() || 'Execute verification',
        expectedResult: s.expectedResult.trim() || 'Expected behavior matches requirements.',
        status: editingTestCase?.steps?.find(orig => orig.id === s.id)?.status || 'Not Run'
      }));

    const now = toDateStr(new Date());

    if (editingTestCase) {
      onUpdateTestCase({
        ...editingTestCase,
        title: title.trim(),
        description: description.trim(),
        status,
        executionStatus,
        testType,
        priority,
        preconditions: preconditions.trim(),
        userStoryId: userStoryId || null,
        defectId: defectId || null,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        areaPath: areaPath.trim(),
        iterationPath: iterationPath.trim(),
        steps: validSteps,
        updatedAt: now
      });
    } else {
      const newTc: TestCase = {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        status,
        executionStatus,
        testType,
        priority,
        preconditions: preconditions.trim(),
        userStoryId: userStoryId || null,
        defectId: defectId || null,
        releaseId: releaseId || null,
        assigneeId: assigneeId || null,
        areaPath: areaPath.trim(),
        iterationPath: iterationPath.trim(),
        steps: validSteps,
        adoId: Math.floor(44900 + Math.random() * 900),
        adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems',
        adoWorkItemType: 'Test Case',
        sourceInstance: 'internal',
        createdAt: now,
        updatedAt: now
      };
      onAddTestCase(newTc);
    }

    setModalOpen(false);
  };

  // Quick 1-Click Execution Status Update
  const handleQuickStatus = (tc: TestCase, newExec: TestExecutionStatus) => {
    const updatedSteps = (tc.steps || []).map(s => ({
      ...s,
      status: newExec
    }));

    onUpdateTestCase({
      ...tc,
      executionStatus: newExec,
      steps: updatedSteps,
      lastRunAt: `${toDateStr(new Date())} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: toDateStr(new Date())
    });
  };

  // Open Runner Modal
  const openRunnerModal = (tc: TestCase) => {
    setRunnerTestCase(tc);
    const initialMap: Record<string, { status: TestExecutionStatus; notes: string }> = {};
    (tc.steps || []).forEach(s => {
      initialMap[s.id] = {
        status: s.status || 'Not Run',
        notes: s.actualResult || ''
      };
    });
    setActiveStepResults(initialMap);
  };

  // Save Runner Results
  const handleSaveRunner = (overallStatus: TestExecutionStatus) => {
    if (!runnerTestCase) return;

    const updatedSteps: TestStep[] = (runnerTestCase.steps || []).map(s => {
      const res = activeStepResults[s.id];
      return {
        ...s,
        status: res?.status || 'Not Run',
        actualResult: res?.notes || s.actualResult
      };
    });

    onUpdateTestCase({
      ...runnerTestCase,
      executionStatus: overallStatus,
      steps: updatedSteps,
      lastRunAt: `${toDateStr(new Date())} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: toDateStr(new Date())
    });

    setRunnerTestCase(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)] overflow-y-auto">
      {/* Top Header Banner */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                [Type: Test Case] Quality Engineering
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                ADO Test Management & Traceability
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
              <FileCheck2 className="text-[var(--primary)]" size={24} />
              Test Cases & Verification Hub
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Dedicated test case lifecycle tracking (Design, Ready, Automated, Closed) with step-by-step verification and User Story traceability.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              New Test Case
            </button>
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Test Cases</div>
            <div className="text-xl font-extrabold text-[var(--text-primary)] mt-1">{totalCount}</div>
            <div className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">Across all suites</div>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center justify-between">
              <span>[Status: Design]</span>
              <Edit3 size={12} />
            </div>
            <div className="text-xl font-extrabold text-purple-700 dark:text-purple-300 mt-1">{designCount}</div>
            <div className="text-[10.5px] text-purple-600/80 dark:text-purple-400/80 mt-0.5">Authoring & Drafting</div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center justify-between">
              <span>Ready for Test</span>
              <CheckSquare size={12} />
            </div>
            <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300 mt-1">{readyCount}</div>
            <div className="text-[10.5px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">Approved for run</div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-between">
              <span>Automated</span>
              <Zap size={12} />
            </div>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">{automatedCount}</div>
            <div className="text-[10.5px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">CI/CD Pipeline</div>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Pass Rate</span>
              <ShieldCheck size={12} className="text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{passRate}%</div>
            <div className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">{passedCount} Passed / {executedCount} Run</div>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Flaws & Blockers</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-extrabold text-rose-600">{failedCount} Failed</span>
              <span className="text-xs text-[var(--text-muted)]">•</span>
              <span className="text-base font-extrabold text-amber-600">{blockedCount} Blocked</span>
            </div>
            <div className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">{notRunCount} awaiting run</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-8 space-y-5 flex-1">
        {/* Filters Toolbar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search test case title, TC ID (#44901), preconditions, steps..."
              className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="">All Statuses (Design, Ready, Automated...)</option>
              <option value="Design">Status: Design (Drafting)</option>
              <option value="Ready">Status: Ready for Test</option>
              <option value="In Progress">Status: In Progress</option>
              <option value="Automated">Status: Automated</option>
              <option value="Closed">Status: Closed</option>
            </select>

            {/* Execution Result Filter */}
            <select
              value={filterExecution}
              onChange={e => setFilterExecution(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="">All Outcomes (Passed, Failed...)</option>
              <option value="Passed">Outcome: Passed</option>
              <option value="Failed">Outcome: Failed</option>
              <option value="Blocked">Outcome: Blocked</option>
              <option value="Not Run">Outcome: Not Run</option>
            </select>

            {/* Test Type Filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="">All Types (Manual, Automated...)</option>
              {TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Linked User Story Filter */}
            <select
              value={filterStoryId}
              onChange={e => setFilterStoryId(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="">All User Stories</option>
              {userStories.map(s => (
                <option key={s.id} value={s.id}>
                  {s.adoId ? `US-${s.adoId}: ` : ''}{s.title}
                </option>
              ))}
            </select>

            {/* Clear Filters Button */}
            {(search || filterStatus || filterExecution || filterType || filterStoryId) && (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterStatus('');
                  setFilterExecution('');
                  setFilterType('');
                  setFilterStoryId('');
                }}
                className="text-xs text-[var(--primary)] hover:underline font-bold px-2 py-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Test Cases List */}
        {filteredTestCases.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-3">
              <FileCheck2 size={28} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">No Test Cases Found</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mt-1 mb-4">
              {search || filterStatus || filterExecution || filterStoryId
                ? 'No test cases matched your filter criteria. Try resetting your search filters.'
                : 'No test cases have been created yet. Create a test case in Design state or import from Azure DevOps.'}
            </p>
            <button
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-2 bg-[var(--primary)] text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Plus size={14} />
              Create First Test Case
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredTestCases.map(tc => {
              const statusCfg = STATUS_OPTIONS.find(s => s.value === tc.status) || STATUS_OPTIONS[0];
              const execCfg = EXECUTION_OPTIONS.find(e => e.value === tc.executionStatus) || EXECUTION_OPTIONS[0];
              const ExecIcon = execCfg.icon;
              const linkedStory = userStories.find(s => s.id === tc.userStoryId);
              const linkedDefect = defects.find(d => d.id === tc.defectId);
              const linkedRelease = releases.find(r => r.id === tc.releaseId);
              const assignee = team.find(t => t.id === tc.assigneeId);
              const isExpanded = expandedSteps.has(tc.id);

              return (
                <div
                  key={tc.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all"
                >
                  {/* Top Meta Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Work Item Type Chip */}
                      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 flex items-center gap-1">
                        <FileCheck2 size={11} className="text-purple-600 dark:text-purple-400" />
                        [Type: Test Case]
                      </span>

                      {/* ADO ID / Link */}
                      {tc.adoId && (
                        <a
                          href={tc.adoUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-[var(--bg-subtle)] text-[var(--primary)] hover:underline border border-[var(--border)] flex items-center gap-1"
                          title="Open in Azure DevOps"
                        >
                          #{tc.adoId}
                          <ExternalLink size={10} />
                        </a>
                      )}

                      {/* Lifecycle Status Pill (Design / Ready / Automated) */}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusCfg.color} flex items-center gap-1`}>
                        {tc.status === 'Design' && <Edit3 size={11} />}
                        {tc.status === 'Automated' && <Zap size={11} />}
                        {tc.status === 'Ready' && <CheckSquare size={11} />}
                        Status: {tc.status}
                      </span>

                      {/* Execution Outcome Pill */}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${execCfg.color} flex items-center gap-1`}>
                        <ExecIcon size={12} />
                        Result: {tc.executionStatus}
                      </span>

                      {/* Test Type */}
                      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)]">
                        {tc.testType}
                      </span>

                      {/* Priority */}
                      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase ${
                        tc.priority === 'critical'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          : tc.priority === 'high'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20'
                      }`}>
                        {tc.priority}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Fast 1-Click Pass / Fail buttons */}
                      <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg p-0.5 mr-1">
                        <button
                          onClick={() => handleQuickStatus(tc, 'Passed')}
                          className={`p-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            tc.executionStatus === 'Passed'
                              ? 'bg-emerald-500 text-white shadow-2xs'
                              : 'text-[var(--text-muted)] hover:text-emerald-600 hover:bg-[var(--surface)]'
                          }`}
                          title="Mark Test as Passed"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickStatus(tc, 'Failed')}
                          className={`p-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            tc.executionStatus === 'Failed'
                              ? 'bg-rose-500 text-white shadow-2xs'
                              : 'text-[var(--text-muted)] hover:text-rose-600 hover:bg-[var(--surface)]'
                          }`}
                          title="Mark Test as Failed"
                        >
                          <XCircle size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickStatus(tc, 'Blocked')}
                          className={`p-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            tc.executionStatus === 'Blocked'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'text-[var(--text-muted)] hover:text-amber-600 hover:bg-[var(--surface)]'
                          }`}
                          title="Mark Test as Blocked"
                        >
                          <AlertTriangle size={13} />
                        </button>
                      </div>

                      {/* Run Step-by-Step Modal */}
                      <button
                        onClick={() => openRunnerModal(tc)}
                        className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all"
                        title="Step-by-step Execution Runner"
                      >
                        <Play size={12} />
                        Run Steps
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => openEditModal(tc)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                        title="Edit Test Case"
                      >
                        <Edit3 size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => {
                          if (confirm(`Delete test case "${tc.title}"?`)) {
                            onDeleteTestCase(tc.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete Test Case"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="py-3">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight">
                      {tc.title}
                    </h3>
                    {tc.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {tc.description}
                      </p>
                    )}
                  </div>

                  {/* Preconditions (if any) */}
                  {tc.preconditions && (
                    <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs mb-3">
                      <span className="font-bold text-[var(--text-secondary)]">Preconditions: </span>
                      <span className="text-[var(--text-primary)]">{tc.preconditions}</span>
                    </div>
                  )}

                  {/* Traceability & Links Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                    {/* Linked User Story */}
                    {linkedStory && (
                      <div className="flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 px-2.5 py-1 rounded-lg text-xs">
                        <BookOpen size={12} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          Story: {linkedStory.adoId ? `US-${linkedStory.adoId}` : ''} {linkedStory.title}
                        </span>
                      </div>
                    )}

                    {/* Linked Defect */}
                    {linkedDefect && (
                      <div className="flex items-center gap-1.5 bg-rose-500/5 border border-rose-500/20 px-2.5 py-1 rounded-lg text-xs">
                        <Bug size={12} className="text-rose-600 dark:text-rose-400" />
                        <span className="font-bold text-rose-700 dark:text-rose-300">
                          Defect: {linkedDefect.adoId ? `#${linkedDefect.adoId}` : ''} {linkedDefect.title}
                        </span>
                      </div>
                    )}

                    {/* Release & Area Path */}
                    {tc.areaPath && (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-subtle)] border border-[var(--border)] px-2 py-0.5 rounded-md">
                        <FolderGit2 size={11} />
                        <span>{tc.areaPath}</span>
                      </div>
                    )}

                    {/* Iteration */}
                    {tc.iterationPath && (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-subtle)] border border-[var(--border)] px-2 py-0.5 rounded-md">
                        <Tag size={11} />
                        <span>{tc.iterationPath}</span>
                      </div>
                    )}

                    {/* Assignee */}
                    {assignee && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ml-auto">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: assignee.avatarColor || '#4F46E5' }}
                        >
                          {assignee.name.charAt(0)}
                        </div>
                        <span className="font-medium">{assignee.name}</span>
                      </div>
                    )}

                    {tc.lastRunAt && (
                      <div className="text-[10.5px] text-[var(--text-muted)] font-mono ml-2">
                        Last Run: {tc.lastRunAt}
                      </div>
                    )}
                  </div>

                  {/* Collapsible Test Steps */}
                  {tc.steps && tc.steps.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                      <button
                        onClick={() => toggleSteps(tc.id)}
                        className="flex items-center justify-between w-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <CheckSquare size={13} className="text-[var(--primary)]" />
                          Test Steps ({tc.steps.length})
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <span>{isExpanded ? 'Collapse' : 'Expand Steps'}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          {tc.steps.map((step, sIdx) => {
                            const stepExecCfg = EXECUTION_OPTIONS.find(e => e.value === step.status) || EXECUTION_OPTIONS[0];
                            const StepIcon = stepExecCfg.icon;

                            return (
                              <div
                                key={step.id || sIdx}
                                className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 text-xs flex items-start gap-3"
                              >
                                <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5">
                                  {step.stepNumber || sIdx + 1}
                                </div>
                                
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div>
                                    <span className="font-bold text-[var(--text-primary)]">Action: </span>
                                    <span className="text-[var(--text-secondary)]">{step.action}</span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300">Expected: </span>
                                    <span className="text-[var(--text-secondary)]">{step.expectedResult}</span>
                                  </div>
                                  {step.actualResult && (
                                    <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/20 mt-1">
                                      <span className="font-bold">Actual Observation: </span>
                                      <span>{step.actualResult}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${stepExecCfg.color} flex items-center gap-1`}>
                                    <StepIcon size={11} />
                                    {step.status || 'Not Run'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New / Edit Test Case Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileCheck2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {editingTestCase ? 'Edit Test Case' : 'New [Type: Test Case]'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Configure test case details, status lifecycle (Design / Ready / Automated), and steps.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Test Case Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. TC-44901: Concurrent Provider Schedule Slot Booking Lock Verification"
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Status & Execution Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Lifecycle Status *
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as TestCaseStatus)}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="Design">[Status: Design] (Drafting)</option>
                    <option value="Ready">[Status: Ready] (Approved)</option>
                    <option value="In Progress">[Status: In Progress]</option>
                    <option value="Automated">[Status: Automated]</option>
                    <option value="Closed">[Status: Closed]</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Execution Outcome
                  </label>
                  <select
                    value={executionStatus}
                    onChange={e => setExecutionStatus(e.target.value as TestExecutionStatus)}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="Not Run">Not Run</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Blocked">Blocked</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Test Type
                  </label>
                  <select
                    value={testType}
                    onChange={e => setTestType(e.target.value as TestCaseType)}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority & Assignee & Linked Story */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Linked User Story
                  </label>
                  <select
                    value={userStoryId}
                    onChange={e => {
                      setUserStoryId(e.target.value);
                      const st = userStories.find(s => s.id === e.target.value);
                      if (st?.releaseId) setReleaseId(st.releaseId);
                      if (st?.areaPath) setAreaPath(st.areaPath);
                    }}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none cursor-pointer truncate"
                  >
                    <option value="">None / Standalone</option>
                    {userStories.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.adoId ? `US-${s.adoId}: ` : ''}{s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    QA Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {team.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Area Path & Iteration Path */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Area Path (ADO Filter)
                  </label>
                  <select
                    value={areaPath}
                    onChange={e => {
                      setAreaPath(e.target.value);
                      const iters = getIterationPathsForArea(e.target.value, releases, userStories, defects);
                      if (iters[0]) setIterationPath(iters[0].iterationPath);
                    }}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    {availableAreaPaths.map(ap => (
                      <option key={ap} value={ap}>{ap}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Iteration Path
                  </label>
                  <select
                    value={iterationPath}
                    onChange={e => setIterationPath(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    {modalReturnedIterations.map(i => (
                      <option key={i.iterationPath} value={i.iterationPath}>
                        {i.iterationPath} ({i.releaseName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preconditions */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Preconditions & Test Setup
                </label>
                <input
                  type="text"
                  value={preconditions}
                  onChange={e => setPreconditions(e.target.value)}
                  placeholder="e.g. Care coordinator account logged in, appointment calendar loaded."
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Test Steps Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <CheckSquare size={13} className="text-[var(--primary)]" />
                    Step-by-Step Test Procedure
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAiGenerateSteps}
                      disabled={isAiGenerating}
                      className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                    >
                      <Sparkles size={11} className={isAiGenerating ? 'animate-spin' : ''} />
                      {isAiGenerating ? 'Synthesizing...' : 'AI Generate Steps'}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                    >
                      <Plus size={11} />
                      Add Step
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {steps.map((st, sIdx) => (
                    <div
                      key={st.id}
                      className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-2.5 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
                        <span>Step #{sIdx + 1}</span>
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(sIdx)}
                            className="text-rose-500 hover:text-rose-600 text-[10.5px] cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={st.action}
                          onChange={e => handleUpdateStep(sIdx, 'action', e.target.value)}
                          placeholder="Action: What the tester or script executes"
                          className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none"
                        />
                        <input
                          type="text"
                          value={st.expectedResult}
                          onChange={e => handleUpdateStep(sIdx, 'expectedResult', e.target.value)}
                          placeholder="Expected Result: Verified behavior"
                          className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-xs cursor-pointer"
                >
                  {editingTestCase ? 'Save Changes' : 'Create Test Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step-by-Step Test Runner Modal */}
      {runnerTestCase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Play size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Execute Test Case: #{runnerTestCase.adoId || ''} {runnerTestCase.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Verify each step, record observations, and mark the final execution outcome.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRunnerTestCase(null)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {runnerTestCase.preconditions && (
              <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs mb-4">
                <span className="font-bold text-[var(--text-secondary)]">Setup: </span>
                <span className="text-[var(--text-primary)]">{runnerTestCase.preconditions}</span>
              </div>
            )}

            {/* Steps execution */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 mb-5">
              {(runnerTestCase.steps || []).map((step, sIdx) => {
                const currentRes = activeStepResults[step.id] || { status: 'Not Run', notes: '' };

                return (
                  <div
                    key={step.id}
                    className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10.5px] flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <span>Step #{sIdx + 1}</span>
                      </div>

                      {/* Step Result Toggle */}
                      <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveStepResults(prev => ({
                            ...prev,
                            [step.id]: { ...currentRes, status: 'Passed' }
                          }))}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                            currentRes.status === 'Passed'
                              ? 'bg-emerald-500 text-white'
                              : 'text-[var(--text-muted)] hover:text-emerald-600'
                          }`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveStepResults(prev => ({
                            ...prev,
                            [step.id]: { ...currentRes, status: 'Failed' }
                          }))}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                            currentRes.status === 'Failed'
                              ? 'bg-rose-500 text-white'
                              : 'text-[var(--text-muted)] hover:text-rose-600'
                          }`}
                        >
                          Fail
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveStepResults(prev => ({
                            ...prev,
                            [step.id]: { ...currentRes, status: 'Blocked' }
                          }))}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                            currentRes.status === 'Blocked'
                              ? 'bg-amber-500 text-white'
                              : 'text-[var(--text-muted)] hover:text-amber-600'
                          }`}
                        >
                          Block
                        </button>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <div>
                        <span className="font-bold text-[var(--text-primary)]">Action: </span>
                        <span className="text-[var(--text-secondary)]">{step.action}</span>
                      </div>
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Expected: </span>
                        <span className="text-[var(--text-secondary)]">{step.expectedResult}</span>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={currentRes.notes}
                      onChange={e => setActiveStepResults(prev => ({
                        ...prev,
                        [step.id]: { ...currentRes, notes: e.target.value }
                      }))}
                      placeholder="Actual observation / error logs (optional)..."
                      className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                );
              })}
            </div>

            {/* Complete Execution Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRunnerTestCase(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveRunner('Blocked')}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 cursor-pointer"
                >
                  Mark Blocked
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRunner('Failed')}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                >
                  Mark Failed
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRunner('Passed')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  Mark Passed & Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
