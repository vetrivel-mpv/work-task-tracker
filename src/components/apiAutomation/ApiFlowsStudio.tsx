import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  Sparkles, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  ArrowDown, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check, 
  RotateCw, 
  Layers, 
  Zap, 
  FileCode, 
  Terminal, 
  AlertTriangle, 
  Code, 
  Eye, 
  ShieldCheck, 
  ExternalLink,
  Sliders, 
  Pause, 
  SkipForward, 
  Info, 
  Database,
  Link,
  FolderPlus,
  Boxes
} from 'lucide-react';
import { 
  ApiTestFlow, 
  ApiFlowStep, 
  ApiEnvironment, 
  ApiFlowExecutionRun, 
  ApiFlowStepExecutionResult,
  ApiRequestItem 
} from '../../types/apiAutomation';
import { executeFullApiFlow, executeSingleFlowStep, generateBruFile, generateBrunoCliCommand } from '../../utils/brunoEngine';
import { generatePlaywrightSpecFromFlow } from '../../utils/playwrightApiEngine';
import { generateId } from '../../utils/date';
import { analyzeFlowDependencies } from '../../utils/flowDependencyEngine';
import { FlowVisualCanvas } from './FlowVisualCanvas';
import { FlowStepConfigDrawer } from './FlowStepConfigDrawer';
import { FlowDependencyMatrix } from './FlowDependencyMatrix';

interface ApiFlowsStudioProps {
  flows: ApiTestFlow[];
  activeEnvironment?: ApiEnvironment;
  onUpdateFlows: (flows: ApiTestFlow[]) => void;
  onOpenBrunoModal?: (flow: ApiTestFlow) => void;
  onOpenPlaywrightModal?: (flow: ApiTestFlow) => void;
}

export const ApiFlowsStudio: React.FC<ApiFlowsStudioProps> = ({
  flows,
  activeEnvironment,
  onUpdateFlows,
  onOpenBrunoModal,
  onOpenPlaywrightModal
}) => {
  const [selectedFlowId, setSelectedFlowId] = useState<string>(flows[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'visual_canvas' | 'dependency_matrix' | 'step_debugger' | 'results' | 'bruno_dsl' | 'playwright_spec'>('visual_canvas');
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  
  // Execution & Debugger State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeStepIndexRunning, setActiveStepIndexRunning] = useState<number | null>(null);
  const [latestExecutionRun, setLatestExecutionRun] = useState<ApiFlowExecutionRun | null>(null);
  const [runtimeVariables, setRuntimeVariables] = useState<Record<string, any>>({});
  const [debugStepIndex, setDebugStepIndex] = useState<number>(0);
  
  // Modal / Drawer State
  const [editingStep, setEditingStep] = useState<ApiFlowStep | null>(null);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeFlow = flows.find(f => f.id === selectedFlowId) || flows[0];

  useEffect(() => {
    if (activeFlow && !activeStepId) {
      setActiveStepId(activeFlow.steps[0]?.id || null);
    }
    if (activeFlow) {
      setRuntimeVariables({
        ...(activeFlow.globalVariables || {}),
        ...(activeEnvironment?.variables || {})
      });
    }
  }, [activeFlow, activeEnvironment]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Run Entire Flow Sequentially
  const handleRunFullFlow = async () => {
    if (!activeFlow || isRunning) return;
    setIsRunning(true);
    setLatestExecutionRun(null);

    const initialVars = {
      ...(activeFlow.globalVariables || {}),
      ...(activeEnvironment?.variables || {})
    };
    setRuntimeVariables(initialVars);

    try {
      const runResult = await executeFullApiFlow(
        activeFlow,
        activeEnvironment,
        (stepIdx, stepRes, currentVars) => {
          setActiveStepIndexRunning(stepIdx);
          setRuntimeVariables({ ...currentVars });
        }
      );

      setLatestExecutionRun(runResult);

      // Update flow summary status
      const updatedFlows: ApiTestFlow[] = flows.map(f => {
        if (f.id === activeFlow.id) {
          return {
            ...f,
            lastRunStatus: runResult.status,
            lastRunAt: runResult.completedAt,
            lastRunSummary: {
              totalSteps: runResult.totalSteps,
              passedSteps: runResult.passedSteps,
              failedSteps: runResult.failedSteps,
              durationMs: runResult.durationMs,
              passRate: Math.round((runResult.passedSteps / Math.max(1, runResult.totalSteps)) * 100)
            }
          };
        }
        return f;
      });
      onUpdateFlows(updatedFlows);
    } catch (err) {
      console.error('[FlowRunner] Error executing flow:', err);
    } finally {
      setIsRunning(false);
      setActiveStepIndexRunning(null);
    }
  };

  // Run Single Step individually
  const handleRunSingleStep = async (step: ApiFlowStep) => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const stepRes = await executeSingleFlowStep(step, runtimeVariables, activeEnvironment);
      const newVars = { ...runtimeVariables, ...stepRes.variablesSnapshotAfter };
      setRuntimeVariables(newVars);

      setLatestExecutionRun(prev => {
        const existingResults = prev?.stepResults ? prev.stepResults.filter(r => r.stepId !== step.id) : [];
        existingResults.push(stepRes);
        return {
          id: prev?.id || generateId('run_single'),
          flowId: activeFlow.id,
          flowName: activeFlow.name,
          environmentName: activeEnvironment?.name || 'Local',
          status: stepRes.status === 'failed' ? 'failed' : 'passed',
          startedAt: prev?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalSteps: activeFlow.steps.length,
          passedSteps: existingResults.filter(r => r.status === 'passed').length,
          failedSteps: existingResults.filter(r => r.status === 'failed').length,
          skippedSteps: 0,
          durationMs: (prev?.durationMs || 0) + stepRes.durationMs,
          stepResults: existingResults,
          initialVariables: runtimeVariables,
          finalVariables: newVars,
          triggeredBy: 'manual_portal'
        };
      });
    } catch (err) {
      console.error('[SingleStepRunner] Error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Step Debugger Controls
  const handleStartDebugger = () => {
    setActiveTab('step_debugger');
    setDebugStepIndex(0);
    setLatestExecutionRun(null);
    setRuntimeVariables({
      ...(activeFlow?.globalVariables || {}),
      ...(activeEnvironment?.variables || {})
    });
  };

  const handleExecuteNextDebugStep = async () => {
    if (!activeFlow || debugStepIndex >= activeFlow.steps.length || isRunning) return;
    setIsRunning(true);
    const step = activeFlow.steps[debugStepIndex];

    try {
      const stepRes = await executeSingleFlowStep(step, runtimeVariables, activeEnvironment);
      const newVars = { ...runtimeVariables, ...stepRes.variablesSnapshotAfter };
      setRuntimeVariables(newVars);

      setLatestExecutionRun(prev => {
        const existingResults = prev?.stepResults ? [...prev.stepResults] : [];
        existingResults.push(stepRes);
        const passedCount = existingResults.filter(r => r.status === 'passed').length;
        const failedCount = existingResults.filter(r => r.status === 'failed').length;

        return {
          id: prev?.id || generateId('run_debug'),
          flowId: activeFlow.id,
          flowName: activeFlow.name,
          environmentName: activeEnvironment?.name || 'Local',
          status: failedCount > 0 ? 'failed' : 'passed',
          startedAt: prev?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalSteps: activeFlow.steps.length,
          passedSteps: passedCount,
          failedSteps: failedCount,
          skippedSteps: 0,
          durationMs: (prev?.durationMs || 0) + stepRes.durationMs,
          stepResults: existingResults,
          initialVariables: prev?.initialVariables || runtimeVariables,
          finalVariables: newVars,
          triggeredBy: 'flow_debugger'
        };
      });

      setDebugStepIndex(prev => prev + 1);
    } catch (err) {
      console.error('[FlowDebugger] Step error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Create New Flow
  const handleCreateNewFlow = () => {
    const newFlow: ApiTestFlow = {
      id: generateId('flow'),
      name: 'Custom Multi-Step API Workflow',
      description: 'Chained API test flow with dynamic variable dependency passing',
      category: 'e2e_journey',
      globalVariables: {
        baseUrl: activeEnvironment?.baseUrl || 'http://localhost:3000'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          id: generateId('step'),
          stepNumber: 1,
          name: '1. Health & Status Handshake',
          description: 'Validates target service availability and initializes flow state',
          condition: 'always',
          brunoPostScript: `// Bruno post-response\nbru.setVar('flowStartedAt', Date.now());`,
          extractors: [],
          assertions: [
            {
              id: generateId('as'),
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Service returns 200 OK',
              enabled: true
            }
          ],
          request: {
            id: generateId('req'),
            name: 'Health Check',
            method: 'GET',
            url: '{{baseUrl}}/api/health',
            headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
            params: [],
            bodyType: 'none',
            assertions: [],
            extractVariables: [],
            enabled: true
          }
        }
      ]
    };

    onUpdateFlows([newFlow, ...flows]);
    setSelectedFlowId(newFlow.id);
    setActiveStepId(newFlow.steps[0].id);
  };

  // Update Active Flow
  const handleUpdateActiveFlow = (updated: ApiTestFlow) => {
    const updatedFlows = flows.map(f => f.id === updated.id ? updated : f);
    onUpdateFlows(updatedFlows);
  };

  // Open Drawer for Step
  const handleOpenConfigDrawer = (step: ApiFlowStep) => {
    setEditingStep(step);
    setIsConfigDrawerOpen(true);
  };

  // Compute available variables in flow
  const depGraph = analyzeFlowDependencies(
    activeFlow,
    activeFlow?.globalVariables,
    activeEnvironment?.variables
  );
  const availableVariableNames = Array.from(depGraph.allProducedVariables);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Flow Switcher */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left info & flow selector */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-2xs">
              <Zap size={22} className="animate-pulse" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedFlowId}
                  onChange={(e) => {
                    setSelectedFlowId(e.target.value);
                    const target = flows.find(f => f.id === e.target.value);
                    if (target) setActiveStepId(target.steps[0]?.id || null);
                    setLatestExecutionRun(null);
                  }}
                  className="font-extrabold text-base text-[var(--text-primary)] bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-3 py-1 focus:ring-1 focus:ring-purple-500 focus:outline-none cursor-pointer max-w-sm truncate"
                >
                  {flows.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.steps.length} steps)
                    </option>
                  ))}
                </select>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeFlow.lastRunStatus === 'passed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                  activeFlow.lastRunStatus === 'failed' ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' :
                  'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
                }`}>
                  {activeFlow.lastRunStatus ? activeFlow.lastRunStatus.toUpperCase() : 'NOT RUN'}
                </span>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {activeFlow.steps.length} Steps Chained
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                {activeFlow.description || 'Visual API flow sequencing with drag-and-drop ordering and dynamic variable passing'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => onOpenPlaywrightModal && onOpenPlaywrightModal(activeFlow)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 transition-all cursor-pointer shadow-2xs"
              title="Open Playwright (@playwright/test) Studio"
            >
              <Boxes size={14} />
              <span>Playwright (@playwright/test)</span>
            </button>

            <button
              onClick={() => onOpenBrunoModal && onOpenBrunoModal(activeFlow)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-all cursor-pointer shadow-2xs"
              title="Open Bruno (.bru) DSL Hub"
            >
              <FileCode size={14} className="text-purple-600 dark:text-purple-400" />
              <span>Bruno (.bru) Hub</span>
            </button>

            <button
              onClick={handleCreateNewFlow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={14} className="text-purple-600 dark:text-purple-400" />
              <span>New Flow</span>
            </button>

            <button
              onClick={handleStartDebugger}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sliders size={14} />
              <span>Step Debugger</span>
            </button>

            <button
              onClick={handleRunFullFlow}
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-extrabold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RotateCw size={14} className="animate-spin" />
                  <span>Executing ({activeStepIndexRunning !== null ? activeStepIndexRunning + 1 : '...'} / {activeFlow.steps.length})</span>
                </>
              ) : (
                <>
                  <Play size={14} className="fill-current" />
                  <span>Run Entire Flow</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Main Studio Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] rounded-2xl p-1 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('visual_canvas')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'visual_canvas'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Layers size={14} />
            <span>Visual Flow Sequencer (Drag & Drop)</span>
          </button>

          <button
            onClick={() => setActiveTab('dependency_matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'dependency_matrix'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Link size={14} />
            <span>Variable Passing Matrix</span>
            {depGraph.hasBrokenDependencies ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {depGraph.missingVariables.length}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {depGraph.dependencyLinks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('step_debugger')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'step_debugger'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Sliders size={14} />
            <span>Interactive Debugger</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'results'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Execution Timeline</span>
            {latestExecutionRun && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                latestExecutionRun.status === 'passed' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {latestExecutionRun.passedSteps}/{latestExecutionRun.totalSteps}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bruno_dsl')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'bruno_dsl'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <FileCode size={14} />
            <span>Bruno (.bru) Export</span>
          </button>
        </div>

        {/* Global Runtime Vars Counter */}
        <div className="flex items-center gap-2 px-3 text-xs font-mono text-purple-600 dark:text-purple-400 font-bold shrink-0">
          <Database size={13} />
          <span>{Object.keys(runtimeVariables).length} Active State Variables</span>
        </div>
      </div>

      {/* Main Studio Viewport */}
      {activeTab === 'visual_canvas' && (
        <FlowVisualCanvas
          flow={activeFlow}
          activeEnvironment={activeEnvironment}
          activeStepId={activeStepId}
          stepResults={latestExecutionRun?.stepResults || []}
          isRunning={isRunning}
          activeRunningStepIndex={activeStepIndexRunning}
          onSelectStep={(stepId) => setActiveStepId(stepId)}
          onConfigureStep={(step) => handleOpenConfigDrawer(step)}
          onUpdateFlow={handleUpdateActiveFlow}
          onRunSingleStep={handleRunSingleStep}
        />
      )}

      {activeTab === 'dependency_matrix' && (
        <FlowDependencyMatrix
          flow={activeFlow}
          activeEnvironment={activeEnvironment}
          onUpdateFlow={handleUpdateActiveFlow}
          onSelectStep={(stepId) => {
            setActiveStepId(stepId);
            const targetStep = activeFlow.steps.find(s => s.id === stepId);
            if (targetStep) handleOpenConfigDrawer(targetStep);
          }}
        />
      )}

      {activeTab === 'step_debugger' && (
        <div className="space-y-6">
          {/* Debugger Controller Bar */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-extrabold text-sm">
                #{debugStepIndex + 1}
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                  {debugStepIndex < activeFlow.steps.length
                    ? `Ready to execute Step ${debugStepIndex + 1}: ${activeFlow.steps[debugStepIndex]?.name}`
                    : 'Flow Debugger Completed all steps!'}
                </h4>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Inspect and mutate runtime state variables at every point in the flow pipeline.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDebugStepIndex(0)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer"
              >
                Reset to Step 1
              </button>

              <button
                type="button"
                disabled={isRunning || debugStepIndex >= activeFlow.steps.length}
                onClick={handleExecuteNextDebugStep}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isRunning ? <RotateCw size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                <span>Execute Step #{debugStepIndex + 1}</span>
              </button>
            </div>
          </div>

          {/* Live State Variable Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>Live Variables State</span>
                </h4>
                <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                  {Object.keys(runtimeVariables).length} active
                </span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
                {Object.entries(runtimeVariables).map(([k, v]) => (
                  <div key={k} className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-purple-600 dark:text-purple-400">{`{{${k}}}`}</span>
                      <button
                        onClick={() => handleCopy(String(v), `deb_${k}`)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {copiedKey === `deb_${k}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--text-primary)] truncate font-sans">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Logs / Timeline */}
            <div className="lg:col-span-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-2xs space-y-4">
              <h4 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
                Step-by-Step Execution Log
              </h4>

              {latestExecutionRun?.stepResults && latestExecutionRun.stepResults.length > 0 ? (
                <div className="space-y-3">
                  {latestExecutionRun.stepResults.map((res, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white ${
                            res.status === 'passed' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="font-bold text-xs text-[var(--text-primary)]">
                            {res.stepName}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {res.httpStatus || 200} ({res.durationMs}ms)
                        </span>
                      </div>

                      {Object.keys(res.extractedVariables).length > 0 && (
                        <div className="pt-1.5 border-t border-[var(--border)] flex items-center gap-1.5 text-[11px] font-mono text-purple-600 dark:text-purple-400">
                          <Sparkles size={12} />
                          <span>Extracted: {Object.keys(res.extractedVariables).map(k => `${k}=${JSON.stringify(res.extractedVariables[k])}`).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-[var(--text-muted)]">
                  Click "Execute Step #1" to begin interactive debugging.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xs space-y-6">
          {latestExecutionRun ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                  <div className="text-[11px] font-bold text-[var(--text-secondary)]">Status</div>
                  <div className={`text-lg font-black mt-1 ${
                    latestExecutionRun.status === 'passed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {latestExecutionRun.status.toUpperCase()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                  <div className="text-[11px] font-bold text-[var(--text-secondary)]">Steps Passed</div>
                  <div className="text-lg font-black text-[var(--text-primary)] mt-1">
                    {latestExecutionRun.passedSteps} / {latestExecutionRun.totalSteps}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                  <div className="text-[11px] font-bold text-[var(--text-secondary)]">Total Duration</div>
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
                    {latestExecutionRun.durationMs} ms
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                  <div className="text-[11px] font-bold text-[var(--text-secondary)]">Variables Propagated</div>
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                    {Object.keys(latestExecutionRun.finalVariables || {}).length}
                  </div>
                </div>
              </div>

              {/* Detailed Step Results List */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
                  Individual Step Results & Payloads
                </h4>

                {latestExecutionRun.stepResults.map((sr, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                          sr.status === 'passed' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <h5 className="text-xs font-bold text-[var(--text-primary)]">{sr.stepName}</h5>
                          <p className="text-[11px] font-mono text-[var(--text-secondary)]">{sr.url}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)]">
                          {sr.httpStatus || 200}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {sr.durationMs}ms
                        </span>
                      </div>
                    </div>

                    {/* Assertion checklist */}
                    {sr.assertionResults && sr.assertionResults.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-[var(--border)]">
                        {sr.assertionResults.map((ar, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2 text-[11px]">
                            {ar.passed ? (
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle size={13} className="text-red-500 shrink-0" />
                            )}
                            <span className="text-[var(--text-primary)]">{ar.description || (ar.expected !== undefined ? `Expected: ${ar.expected}` : 'Assertion passed')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Extracted variables */}
                    {Object.keys(sr.extractedVariables).length > 0 && (
                      <div className="p-2.5 rounded-lg bg-purple-600/10 border border-purple-500/20 text-xs font-mono text-purple-600 dark:text-purple-400 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>Extracted Variables Passed to Subsequent Steps:</span>
                        </div>
                        {Object.entries(sr.extractedVariables).map(([k, v]) => (
                          <div key={k} className="pl-4 text-[11px]">
                            <span className="font-bold">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 space-y-3">
              <Clock size={32} className="mx-auto text-[var(--text-muted)]" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">No Execution Runs Yet</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Click "Run Entire Flow" to execute this multi-step sequence and inspect output payloads.
              </p>
              <button
                type="button"
                onClick={handleRunFullFlow}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
              >
                Execute Flow Now
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bruno_dsl' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <FileCode size={16} className="text-purple-600 dark:text-purple-400" />
                <span>Bruno Plaintext Collection Files (.bru)</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Every step in this flow is stored as a standard Git-versioned .bru file executed by @usebruno/cli.
              </p>
            </div>

            <button
              onClick={() => onOpenBrunoModal && onOpenBrunoModal(activeFlow)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold cursor-pointer"
            >
              Open Bruno Hub
            </button>
          </div>

          <div className="space-y-4">
            {activeFlow.steps.map((step, idx) => {
              const bruCode = generateBruFile(step.request, idx + 1);
              return (
                <div key={step.id} className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                      step-{idx + 1}-{step.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.bru
                    </span>
                    <button
                      onClick={() => handleCopy(bruCode, `bru_${step.id}`)}
                      className="px-2.5 py-1 rounded bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium cursor-pointer"
                    >
                      {copiedKey === `bru_${step.id}` ? 'Copied' : 'Copy .bru'}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800 max-h-48">
                    {bruCode}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP CONFIGURATION & VARIABLE DEPENDENCY DRAWER */}
      {isConfigDrawerOpen && editingStep && (
        <FlowStepConfigDrawer
          step={editingStep}
          allSteps={activeFlow.steps}
          availableVariables={availableVariableNames}
          activeEnvironment={activeEnvironment}
          isOpen={isConfigDrawerOpen}
          onClose={() => {
            setIsConfigDrawerOpen(false);
            setEditingStep(null);
          }}
          onSave={(updatedStep) => {
            const updatedSteps = activeFlow.steps.map(s => s.id === updatedStep.id ? updatedStep : s);
            handleUpdateActiveFlow({
              ...activeFlow,
              steps: updatedSteps,
              updatedAt: new Date().toISOString()
            });
          }}
          onDelete={(stepId) => {
            const filtered = activeFlow.steps.filter(s => s.id !== stepId);
            const reindexed = filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
            handleUpdateActiveFlow({
              ...activeFlow,
              steps: reindexed,
              updatedAt: new Date().toISOString()
            });
          }}
        />
      )}

    </div>
  );
};
