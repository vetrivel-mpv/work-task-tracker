import React, { useState } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowDown, 
  ChevronRight, 
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
  Sliders, 
  GripVertical,
  ArrowRight,
  Sparkles,
  Link,
  PlusCircle,
  Database
} from 'lucide-react';
import { 
  ApiTestFlow, 
  ApiFlowStep, 
  ApiEnvironment, 
  ApiFlowStepExecutionResult,
  ApiRequestItem 
} from '../../types/apiAutomation';
import { generateId } from '../../utils/date';
import { 
  analyzeFlowDependencies, 
  extractProducedVariables, 
  extractConsumedVariables 
} from '../../utils/flowDependencyEngine';

interface FlowVisualCanvasProps {
  flow: ApiTestFlow;
  activeEnvironment?: ApiEnvironment;
  activeStepId: string | null;
  stepResults?: ApiFlowStepExecutionResult[];
  isRunning: boolean;
  activeRunningStepIndex: number | null;
  onSelectStep: (stepId: string) => void;
  onConfigureStep: (step: ApiFlowStep) => void;
  onUpdateFlow: (flow: ApiTestFlow) => void;
  onRunSingleStep: (step: ApiFlowStep) => void;
}

export const FlowVisualCanvas: React.FC<FlowVisualCanvasProps> = ({
  flow,
  activeEnvironment,
  activeStepId,
  stepResults = [],
  isRunning,
  activeRunningStepIndex,
  onSelectStep,
  onConfigureStep,
  onUpdateFlow,
  onRunSingleStep
}) => {
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const depGraph = analyzeFlowDependencies(
    flow,
    flow.globalVariables,
    activeEnvironment?.variables
  );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Drag-and-Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedStepIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedStepIndex === null || draggedStepIndex === dropIndex) {
      setDraggedStepIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSteps = [...flow.steps];
    const [movedStep] = newSteps.splice(draggedStepIndex, 1);
    newSteps.splice(dropIndex, 0, movedStep);

    // Re-index step numbers
    const reindexed = newSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    onUpdateFlow({
      ...flow,
      steps: reindexed,
      updatedAt: new Date().toISOString()
    });

    setDraggedStepIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedStepIndex(null);
    setDragOverIndex(null);
  };

  // Step Move Up/Down
  const handleMoveStep = (stepIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? stepIdx - 1 : stepIdx + 1;
    if (targetIdx < 0 || targetIdx >= flow.steps.length) return;

    const newSteps = [...flow.steps];
    const [moved] = newSteps.splice(stepIdx, 1);
    newSteps.splice(targetIdx, 0, moved);

    const reindexed = newSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    onUpdateFlow({
      ...flow,
      steps: reindexed,
      updatedAt: new Date().toISOString()
    });
  };

  // Duplicate Step
  const handleDuplicateStep = (step: ApiFlowStep, index: number) => {
    const clonedStep: ApiFlowStep = {
      ...JSON.parse(JSON.stringify(step)),
      id: generateId('step'),
      stepNumber: index + 2,
      name: `${step.name} (Copy)`
    };

    const newSteps = [...flow.steps];
    newSteps.splice(index + 1, 0, clonedStep);
    const reindexed = newSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    onUpdateFlow({
      ...flow,
      steps: reindexed,
      updatedAt: new Date().toISOString()
    });
  };

  // Delete Step
  const handleDeleteStep = (stepId: string) => {
    if (flow.steps.length <= 1) {
      alert('A flow must have at least 1 step.');
      return;
    }
    const filtered = flow.steps.filter(s => s.id !== stepId);
    const reindexed = filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    onUpdateFlow({
      ...flow,
      steps: reindexed,
      updatedAt: new Date().toISOString()
    });
  };

  // Insert Step at Specific Index
  const handleInsertStepAt = (index: number, templateType: 'blank' | 'auth' | 'get_by_id' | 'create_entity') => {
    let newStep: ApiFlowStep;

    if (templateType === 'auth') {
      newStep = {
        id: generateId('step'),
        stepNumber: index + 1,
        name: 'Authentication Login Handshake',
        description: 'Obtains Bearer JWT and sets authToken in Bruno state',
        condition: 'always',
        brunoPostScript: `// Bruno post-response extractor\nif (res.body && res.body.token) {\n  bru.setVar('authToken', res.body.token);\n}`,
        extractors: [
          {
            id: generateId('ext'),
            source: 'json_body',
            path: 'token',
            variableName: 'authToken',
            targetVariable: 'authToken',
            defaultValue: '',
            enabled: true
          }
        ],
        assertions: [
          {
            id: generateId('as'),
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'Login successful',
            enabled: true
          }
        ],
        request: {
          id: generateId('req'),
          name: 'Auth Token Login',
          method: 'POST',
          url: '{{baseUrl}}/api/auth/login',
          headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
          params: [],
          bodyType: 'json',
          bodyContent: '{\n  "username": "qa_tester",\n  "password": "Password123!"\n}',
          assertions: [],
          extractVariables: [],
          enabled: true
        }
      };
    } else if (templateType === 'get_by_id') {
      newStep = {
        id: generateId('step'),
        stepNumber: index + 1,
        name: 'Get Entity Details by ID',
        description: 'Queries resource using variable passed from earlier step',
        condition: 'only_if_prev_passed',
        extractors: [],
        assertions: [
          {
            id: generateId('as'),
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'Entity retrieved',
            enabled: true
          }
        ],
        request: {
          id: generateId('req'),
          name: 'Fetch Resource',
          method: 'GET',
          url: '{{baseUrl}}/api/v1/entities/{{entityId}}',
          headers: [
            { key: 'Accept', value: 'application/json', enabled: true },
            { key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true }
          ],
          params: [],
          bodyType: 'none',
          assertions: [],
          extractVariables: [],
          enabled: true
        }
      };
    } else {
      newStep = {
        id: generateId('step'),
        stepNumber: index + 1,
        name: `Custom API Step ${index + 1}`,
        description: 'Chained HTTP request with variable parameterization',
        condition: 'only_if_prev_passed',
        extractors: [],
        assertions: [
          {
            id: generateId('as'),
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'Returns HTTP 200',
            enabled: true
          }
        ],
        request: {
          id: generateId('req'),
          name: 'API Request',
          method: 'GET',
          url: '{{baseUrl}}/api/v1/resource',
          headers: [
            { key: 'Accept', value: 'application/json', enabled: true },
            { key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true }
          ],
          params: [],
          bodyType: 'none',
          assertions: [],
          extractVariables: [],
          enabled: true
        }
      };
    }

    const newSteps = [...flow.steps];
    newSteps.splice(index, 0, newStep);
    const reindexed = newSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    onUpdateFlow({
      ...flow,
      steps: reindexed,
      updatedAt: new Date().toISOString()
    });

    onSelectStep(newStep.id);
  };

  return (
    <div className="space-y-4">
      
      {/* Flow Canvas Action Toolbar */}
      <div className="flex items-center justify-between gap-3 bg-[var(--surface)] p-3.5 rounded-2xl border border-[var(--border)] shadow-2xs flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
            <Layers size={15} className="text-purple-600 dark:text-purple-400" />
            <span>Flow Sequence & Variable Pipeline</span>
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            {flow.steps.length} Sequenced Steps
          </span>
          {depGraph.hasBrokenDependencies && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle size={11} />
              <span>{depGraph.missingVariables.length} Unbound Var{depGraph.missingVariables.length > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleInsertStepAt(flow.steps.length, 'blank')}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={13} />
            <span>Add Step to End</span>
          </button>
        </div>
      </div>

      {/* Visual Step Pipeline (Draggable Nodes) */}
      <div className="space-y-4 relative">
        
        {flow.steps.map((step, idx) => {
          const isSelected = step.id === activeStepId;
          const isCurrentRunning = isRunning && activeRunningStepIndex === idx;
          const execResult = stepResults.find(r => r.stepId === step.id);
          const producedVars = extractProducedVariables(step);
          const consumedVars = extractConsumedVariables(step);
          const isBeingDragged = draggedStepIndex === idx;
          const isDragTarget = dragOverIndex === idx;

          // Compute variables passed from THIS step to the NEXT step
          const nextStep = flow.steps[idx + 1];
          const passedToNext = nextStep 
            ? extractConsumedVariables(nextStep).filter(c => producedVars.includes(c.variableName)).map(c => c.variableName)
            : [];

          return (
            <React.Fragment key={step.id}>
              
              {/* Between-Step Quick Inserter Line (Top Divider) */}
              <div 
                className="relative py-1 flex items-center justify-center group/insert"
                onMouseEnter={() => setHoveredInsertIndex(idx)}
                onMouseLeave={() => setHoveredInsertIndex(null)}
              >
                <div className="w-full border-t border-dashed border-[var(--border)] group-hover/insert:border-purple-500/60 transition-colors" />
                <div className="absolute opacity-0 group-hover/insert:opacity-100 transition-all transform scale-95 group-hover/insert:scale-100 flex items-center gap-1.5 bg-[var(--surface)] px-2.5 py-1 rounded-full border border-purple-500/40 shadow-xs z-20">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">Insert Step:</span>
                  <button
                    type="button"
                    onClick={() => handleInsertStepAt(idx, 'blank')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/10 hover:bg-purple-600 text-purple-600 hover:text-white transition-colors cursor-pointer"
                  >
                    + Blank Request
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertStepAt(idx, 'auth')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 hover:bg-blue-600 text-blue-600 hover:text-white transition-colors cursor-pointer"
                  >
                    + Auth Login
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertStepAt(idx, 'get_by_id')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-colors cursor-pointer"
                  >
                    + Query by ID
                  </button>
                </div>
              </div>

              {/* STEP NODE CARD (Draggable) */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectStep(step.id)}
                className={`group relative rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/5 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] shadow-2xs'
                } ${isBeingDragged ? 'opacity-40 scale-98 border-dashed border-purple-500' : ''} ${
                  isDragTarget ? 'border-t-4 border-t-purple-600' : ''
                } ${isCurrentRunning ? 'ring-2 ring-purple-500 ring-offset-2 animate-pulse' : ''}`}
              >
                <div className="p-4 sm:p-5 space-y-3">
                  
                  {/* Top Bar: Drag Handle + Step Sequence + Method + Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      
                      {/* Drag Handle */}
                      <div 
                        className="cursor-grab active:cursor-grabbing p-1 text-[var(--text-muted)] hover:text-purple-600 rounded transition-colors"
                        title="Drag to reorder step"
                      >
                        <GripVertical size={16} />
                      </div>

                      {/* Step Number & Status Badge */}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono text-xs font-extrabold shrink-0 shadow-2xs ${
                        execResult?.status === 'passed' ? 'bg-emerald-500 text-white' :
                        execResult?.status === 'failed' ? 'bg-red-500 text-white' :
                        execResult?.status === 'skipped' ? 'bg-zinc-400 text-white' :
                        isSelected ? 'bg-purple-600 text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)]'
                      }`}>
                        {execResult?.status === 'passed' ? <Check size={14} /> :
                         execResult?.status === 'failed' ? <XCircle size={14} /> :
                         step.stepNumber}
                      </div>

                      {/* HTTP Method Badge */}
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-black ${
                        step.request.method === 'GET' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                        step.request.method === 'POST' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
                        step.request.method === 'PUT' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                        'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                      }`}>
                        {step.request.method}
                      </span>

                      {/* Step Title */}
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                          {step.name}
                        </h4>
                      </div>
                    </div>

                    {/* Step Controls Bar */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {execResult && (
                        <span className={`text-[11px] font-mono font-bold mr-2 ${
                          execResult.status === 'passed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {execResult.httpStatus || 200} ({execResult.durationMs}ms)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onRunSingleStep(step)}
                        disabled={isRunning}
                        className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-[var(--border)] hover:border-purple-500/30 cursor-pointer disabled:opacity-40"
                        title="Run this step individually"
                      >
                        <Play size={13} className="fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onConfigureStep(step)}
                        className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
                        title="Configure step & variables"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateStep(step, idx)}
                        className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
                        title="Clone this step"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, 'up')}
                        className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] disabled:opacity-25 border border-[var(--border)] cursor-pointer"
                        title="Shift Up"
                      >
                        ▲
                      </button>

                      <button
                        type="button"
                        disabled={idx === flow.steps.length - 1}
                        onClick={() => handleMoveStep(idx, 'down')}
                        className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] disabled:opacity-25 border border-[var(--border)] cursor-pointer"
                        title="Shift Down"
                      >
                        ▼
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border)] cursor-pointer"
                        title="Delete step"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* URL Display with highlighted dynamic variables */}
                  <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] flex items-center justify-between gap-2 overflow-x-auto">
                    <span className="truncate">{step.request.url}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(step.request.url, `url_${step.id}`);
                      }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer"
                    >
                      {copiedKey === `url_${step.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {/* Variables & Dependency Lineage Chips */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                    
                    {/* Consumed Variables (Inputs) */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                        <Link size={11} className="text-blue-500" />
                        <span>Inputs Required ({consumedVars.length})</span>
                      </div>
                      {consumedVars.length === 0 ? (
                        <span className="text-[11px] text-[var(--text-muted)] italic">No upstream inputs</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {consumedVars.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            >
                              {`{{${c.variableName}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Produced Variables (Outputs) */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                        <Sparkles size={11} className="text-purple-600 dark:text-purple-400" />
                        <span>Outputs Exported ({producedVars.length})</span>
                      </div>
                      {producedVars.length === 0 ? (
                        <span className="text-[11px] text-[var(--text-muted)] italic">No response outputs</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {producedVars.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            >
                              {`➜ ${p}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips: Conditions, Delay, Assertions */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[var(--border)]/60 text-[10px] text-[var(--text-secondary)] font-medium">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border)]">
                      Gating: {step.condition === 'always' ? 'Always' : step.condition === 'only_if_prev_passed' ? 'If Prev Passed' : step.condition}
                    </span>

                    {step.delayBeforeStepMs && step.delayBeforeStepMs > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                        <Clock size={10} />
                        <span>+{step.delayBeforeStepMs}ms delay</span>
                      </span>
                    ) : null}

                    {step.retryOnFailure?.enabled && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {step.retryOnFailure.maxRetries} Retries
                      </span>
                    )}

                    {step.assertions && step.assertions.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck size={10} />
                        <span>{step.assertions.length} Assertion{step.assertions.length > 1 ? 's' : ''}</span>
                      </span>
                    )}

                    {step.brunoPostScript && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1 font-mono">
                        <Code size={10} />
                        <span>Bruno Script</span>
                      </span>
                    )}
                  </div>

                </div>
              </div>

              {/* Data Flow Bridge Badge between Step N and Step N+1 */}
              {passedToNext.length > 0 && (
                <div className="flex items-center justify-center">
                  <div className="px-3 py-1 rounded-full bg-purple-600/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-2xs">
                    <ArrowDown size={11} />
                    <span>Passing to Step #{idx + 2}: {passedToNext.map(v => `{{${v}}}`).join(', ')}</span>
                  </div>
                </div>
              )}

            </React.Fragment>
          );
        })}

        {/* End of Flow Inserter Bar */}
        <div className="pt-2 flex items-center justify-center">
          <button
            type="button"
            onClick={() => handleInsertStepAt(flow.steps.length, 'blank')}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-dashed border-[var(--border)] hover:border-purple-500 text-xs font-bold text-purple-600 dark:text-purple-400 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <PlusCircle size={15} />
            <span>Append New Request Step</span>
          </button>
        </div>

      </div>

    </div>
  );
};
