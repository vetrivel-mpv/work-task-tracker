import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  FileText, 
  Code, 
  Copy, 
  Check, 
  Download, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  Activity,
  Filter
} from 'lucide-react';
import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiTestExecutionRun, 
  ApiRequestExecutionResult 
} from '../../types/apiAutomation';
import { runFullCollection, executeSingleApiRequest } from '../../utils/apiAutomationEngine';

interface CollectionRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: ApiAutomationCollection;
  environment: ApiEnvironment;
  onSaveExecutionRun?: (run: ApiTestExecutionRun) => void;
}

export const CollectionRunnerModal: React.FC<CollectionRunnerModalProps> = ({
  isOpen,
  onClose,
  collection,
  environment,
  onSaveExecutionRun
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [executionRun, setExecutionRun] = useState<ApiTestExecutionRun | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'failed' | 'passed'>('all');

  // Trigger test run automatically on open
  useEffect(() => {
    if (isOpen && !executionRun && !isRunning) {
      handleStartExecution();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartExecution = async () => {
    setIsRunning(true);
    setCurrentStepIndex(0);
    setExecutionRun(null);
    setSelectedResultId(null);

    try {
      const runResult = await runFullCollection(
        collection,
        environment,
        (stepIndex, stepResult) => {
          setCurrentStepIndex(stepIndex + 1);
        }
      );

      setExecutionRun(runResult);
      if (runResult.results.length > 0) {
        setSelectedResultId(runResult.results[0].requestId);
      }
      if (onSaveExecutionRun) {
        onSaveExecutionRun(runResult);
      }
    } catch (err) {
      console.error('[CollectionRunner] Execution failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleStepExpand = (reqId: string) => {
    setExpandedSteps(prev => ({ ...prev, [reqId]: !prev[reqId] }));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedResult = executionRun?.results.find(r => r.requestId === selectedResultId) || executionRun?.results[0];

  const totalRequests = collection.requests.filter(r => r.enabled).length;
  const progressPercent = totalRequests > 0 
    ? Math.round(((executionRun?.results.length || currentStepIndex) / totalRequests) * 100)
    : 0;

  const filteredResults = (executionRun?.results || []).filter(r => {
    if (resultFilter === 'failed') return r.status === 'failed';
    if (resultFilter === 'passed') return r.status === 'passed';
    return true;
  });

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'PUT': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'PATCH': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'DELETE': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  const handleExportMarkdown = () => {
    if (!executionRun) return;
    const lines = [
      `# API Automation Quality Gate Report`,
      `**Collection:** ${executionRun.collectionName}`,
      `**Environment:** ${executionRun.environmentName}`,
      `**Status:** ${executionRun.status.toUpperCase()}`,
      `**Duration:** ${executionRun.durationMs}ms`,
      `**Passed Requests:** ${executionRun.passedRequests} / ${executionRun.totalRequests}`,
      `**Passed Assertions:** ${executionRun.passedAssertions} / ${executionRun.totalAssertions}`,
      `**Timestamp:** ${new Date(executionRun.startedAt).toLocaleString()}`,
      '',
      `## Step Results`,
      ''
    ];

    executionRun.results.forEach((r, idx) => {
      lines.push(`### ${idx + 1}. [${r.method}] ${r.requestName} - ${r.status.toUpperCase()} (${r.httpStatus || 'ERR'}, ${r.durationMs}ms)`);
      lines.push(`- **URL:** \`${r.url}\``);
      if (r.assertionResults.length > 0) {
        lines.push(`- **Assertions:**`);
        r.assertionResults.forEach(a => {
          lines.push(`  - [${a.passed ? 'x' : ' '}] ${a.description} ${a.errorMessage ? `*(Error: ${a.errorMessage})*` : ''}`);
        });
      }
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-report-${collection.id}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${
              isRunning ? 'bg-blue-600 animate-pulse' :
              executionRun?.status === 'passed' ? 'bg-emerald-600' :
              executionRun?.status === 'failed' ? 'bg-rose-600' : 'bg-[var(--primary)]'
            }`}>
              {isRunning ? <RotateCw className="animate-spin" size={18} /> : <Zap size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Live Test Runner: {collection.name}
                </h2>
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                  {environment.name}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {isRunning ? `Executing step ${currentStepIndex} of ${totalRequests}...` : 
                 executionRun ? `Completed in ${executionRun.durationMs}ms with ${executionRun.passedAssertions}/${executionRun.totalAssertions} assertions passed.` : 'Ready to execute'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isRunning && executionRun && (
              <>
                <button
                  onClick={handleExportMarkdown}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Export Markdown Report"
                >
                  <Download size={13} />
                  <span>Report</span>
                </button>

                <button
                  onClick={handleStartExecution}
                  className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Re-run Suite</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar & Telemetry Strip */}
        <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[var(--text-muted)]">Execution Progress</span>
              <span className="text-[var(--text-primary)]">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden border border-[var(--border)]">
              <div 
                className={`h-full transition-all duration-300 ${
                  executionRun?.status === 'failed' ? 'bg-rose-500' : 'bg-[var(--primary)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span className="font-extrabold text-[var(--text-primary)]">{executionRun?.passedRequests || 0}</span>
              <span className="text-[var(--text-muted)]">Passed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle size={15} className="text-rose-500" />
              <span className="font-extrabold text-[var(--text-primary)]">{executionRun?.failedRequests || 0}</span>
              <span className="text-[var(--text-muted)]">Failed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-[var(--text-muted)]" />
              <span className="font-extrabold text-[var(--text-primary)]">{executionRun?.durationMs || 0}ms</span>
            </div>
          </div>
        </div>

        {/* Master-Detail Execution View */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Step List (5 cols) */}
          <div className="md:col-span-5 border-r border-[var(--border)] flex flex-col overflow-hidden bg-[var(--bg-subtle)]/50">
            {/* Filter pills */}
            <div className="p-3 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0 bg-[var(--surface)]">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                Steps ({filteredResults.length})
              </span>
              <div className="flex items-center gap-1">
                {(['all', 'failed', 'passed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setResultFilter(f)}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold capitalize transition-all cursor-pointer ${
                      resultFilter === f 
                        ? 'bg-[var(--primary)] text-white' 
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* List of steps */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredResults.map((result, idx) => {
                const isSelected = selectedResult?.requestId === result.requestId;
                return (
                  <div
                    key={result.requestId}
                    onClick={() => setSelectedResultId(result.requestId)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected 
                        ? 'bg-[var(--surface)] border-[var(--primary)] shadow-sm' 
                        : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md border ${getMethodBadgeClass(result.method)}`}>
                          {result.method}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {result.requestName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {result.status === 'passed' ? (
                          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            <span>{result.httpStatus || 200}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <XCircle size={11} />
                            <span>{result.httpStatus || 'ERR'}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {result.durationMs}ms
                        </span>
                      </div>
                    </div>

                    {/* Assertion summary pills */}
                    {result.assertionResults.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {result.assertionResults.map((as, aIdx) => (
                          <span
                            key={aIdx}
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-1 ${
                              as.passed 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                            title={as.description + (as.errorMessage ? ` (${as.errorMessage})` : '')}
                          >
                            {as.passed ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            <span className="truncate max-w-[140px]">{as.description}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isRunning && (
                <div className="p-4 rounded-xl border border-dashed border-[var(--primary)]/40 bg-[var(--primary-light)]/20 flex items-center justify-center gap-2 text-xs font-bold text-[var(--primary)]">
                  <RotateCw size={14} className="animate-spin" />
                  <span>Executing live request step...</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Step Detail, Assertions, Payloads & Headers (7 cols) */}
          <div className="md:col-span-7 flex flex-col overflow-hidden bg-[var(--surface)]">
            {selectedResult ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Step Header */}
                <div className="space-y-2 pb-4 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${getMethodBadgeClass(selectedResult.method)}`}>
                        {selectedResult.method}
                      </span>
                      <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                        {selectedResult.requestName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg border ${
                        selectedResult.status === 'passed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}>
                        {selectedResult.status.toUpperCase()} ({selectedResult.httpStatus || 'ERR'} {selectedResult.httpStatusText || ''})
                      </span>
                      <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-lg">
                        {selectedResult.durationMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] break-all border border-slate-800">
                    {selectedResult.url}
                  </div>
                </div>

                {/* Assertions Evaluation Section */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                    <span>Assertions ({selectedResult.assertionResults.length})</span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedResult.assertionResults.filter(a => a.passed).length} / {selectedResult.assertionResults.length} Passed
                    </span>
                  </h4>

                  {selectedResult.assertionResults.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)]/40 text-xs text-[var(--text-muted)]">
                      No explicit assertions defined for this step.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedResult.assertionResults.map((as, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl border space-y-1.5 ${
                            as.passed
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-rose-500/5 border-rose-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold">
                              {as.passed ? (
                                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                              ) : (
                                <XCircle size={15} className="text-rose-500 shrink-0" />
                              )}
                              <span className={as.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {as.description}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">
                              Expected: {as.expected}
                            </span>
                          </div>

                          {!as.passed && as.errorMessage && (
                            <div className="text-[11px] text-rose-500 bg-rose-500/10 p-2 rounded-lg font-mono">
                              {as.errorMessage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chained Variables Extracted */}
                {selectedResult.extractedVariables && Object.keys(selectedResult.extractedVariables).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-500" />
                      <span>Variables Extracted for Subsequent Steps</span>
                    </h4>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)]/40 border border-[var(--border)] space-y-1.5">
                      {Object.entries(selectedResult.extractedVariables).map(([varName, varVal]) => (
                        <div key={varName} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[var(--primary)] font-bold">{`{{${varName}}}`}</span>
                          <span className="text-[var(--text-muted)] truncate max-w-[300px]">{String(varVal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Payload Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                      Response Body
                    </h4>
                    {selectedResult.responseBody && (
                      <button
                        onClick={() => handleCopy(
                          typeof selectedResult.responseBody === 'object' 
                            ? JSON.stringify(selectedResult.responseBody, null, 2) 
                            : String(selectedResult.responseBody),
                          'body'
                        )}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'body' ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedKey === 'body' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-64 border border-slate-800 shadow-inner">
                    {selectedResult.responseBody 
                      ? (typeof selectedResult.responseBody === 'object' 
                          ? JSON.stringify(selectedResult.responseBody, null, 2) 
                          : String(selectedResult.responseBody))
                      : 'No response body returned.'}
                  </pre>
                </div>

                {/* Response Headers Viewer */}
                {selectedResult.responseHeaders && Object.keys(selectedResult.responseHeaders).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                      Response Headers
                    </h4>
                    <div className="p-3 rounded-xl bg-[var(--surface-hover)]/40 border border-[var(--border)] space-y-1 max-h-36 overflow-y-auto">
                      {Object.entries(selectedResult.responseHeaders).map(([hKey, hVal]) => (
                        <div key={hKey} className="text-[11px] font-mono flex items-start gap-2">
                          <span className="text-[var(--text-primary)] font-bold shrink-0">{hKey}:</span>
                          <span className="text-[var(--text-muted)] break-all">{hVal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)] space-y-2">
                <Activity size={32} className="opacity-40 animate-pulse" />
                <p className="text-xs font-medium">Select a step from the list to inspect execution payload and assertions.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-bold">Execution ID:</span>
            <span className="font-mono">{executionRun?.id || 'idle'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
          >
            Close Runner
          </button>
        </div>
      </div>
    </div>
  );
};
