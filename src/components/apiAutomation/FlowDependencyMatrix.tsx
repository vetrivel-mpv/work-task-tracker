import React, { useState } from 'react';
import { 
  GitBranch, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Copy, 
  Check, 
  Code, 
  Database, 
  Zap, 
  Link, 
  Search,
  Sparkles,
  Sliders
} from 'lucide-react';
import { ApiTestFlow, ApiEnvironment } from '../../types/apiAutomation';
import { analyzeFlowDependencies, FlowDependencyGraph } from '../../utils/flowDependencyEngine';

interface FlowDependencyMatrixProps {
  flow: ApiTestFlow;
  activeEnvironment?: ApiEnvironment;
  onUpdateFlow: (updated: ApiTestFlow) => void;
  onSelectStep: (stepId: string) => void;
}

export const FlowDependencyMatrix: React.FC<FlowDependencyMatrixProps> = ({
  flow,
  activeEnvironment,
  onUpdateFlow,
  onSelectStep
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const depGraph: FlowDependencyGraph = analyzeFlowDependencies(
    flow,
    flow.globalVariables,
    activeEnvironment?.variables
  );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Add missing variable to global variables
  const handleAddGlobalVariable = (varName: string, defaultValue: string = '') => {
    const updatedFlow: ApiTestFlow = {
      ...flow,
      globalVariables: {
        ...(flow.globalVariables || {}),
        [varName]: defaultValue || 'value_placeholder'
      },
      updatedAt: new Date().toISOString()
    };
    onUpdateFlow(updatedFlow);
  };

  // Auto-wire variable extractor on the first step
  const handleAutoWireExtractor = (stepId: string, varName: string) => {
    const updatedSteps = flow.steps.map(s => {
      if (s.id === stepId) {
        const existingExtractors = s.extractors || [];
        const alreadyExists = existingExtractors.some(e => (e.variableName === varName || e.targetVariable === varName));
        if (alreadyExists) return s;

        const newExtractor = {
          id: `ext_${Date.now()}`,
          source: 'json_body' as const,
          path: varName,
          variableName: varName,
          targetVariable: varName,
          defaultValue: '',
          enabled: true
        };

        const postScript = s.brunoPostScript 
          ? `${s.brunoPostScript}\n\n// Auto-wired extractor for ${varName}\nif (res.body && res.body.${varName}) {\n  bru.setVar('${varName}', res.body.${varName});\n}`
          : `// Auto-wired extractor for ${varName}\nif (res.body && res.body.${varName}) {\n  bru.setVar('${varName}', res.body.${varName});\n}`;

        return {
          ...s,
          extractors: [...existingExtractors, newExtractor],
          brunoPostScript: postScript
        };
      }
      return s;
    });

    onUpdateFlow({
      ...flow,
      steps: updatedSteps,
      updatedAt: new Date().toISOString()
    });
  };

  const filteredLinks = depGraph.dependencyLinks.filter(link => 
    link.variableName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    link.consumerStepName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (link.producerStepName && link.producerStepName.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Dependency Health Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
        depGraph.hasBrokenDependencies 
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            depGraph.hasBrokenDependencies 
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' 
              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {depGraph.hasBrokenDependencies ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <h4 className="text-sm font-extrabold">
              {depGraph.hasBrokenDependencies 
                ? `${depGraph.missingVariables.length} Unresolved Variable Dependencies Detected` 
                : 'All Variable Dependencies Verified & Chained'}
            </h4>
            <p className="text-xs opacity-85 mt-0.5">
              {depGraph.hasBrokenDependencies
                ? 'Some steps consume variables not exported by any previous step. Auto-wire them or define them in Global Variables.'
                : `${depGraph.dependencyLinks.length} dynamic variable links across ${flow.steps.length} test steps.`}
            </p>
          </div>
        </div>

        {depGraph.missingVariables.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                depGraph.missingVariables.forEach(v => handleAddGlobalVariable(v, 'mock_val'));
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>Auto-Add {depGraph.missingVariables.length} to Globals</span>
            </button>
          </div>
        )}
      </div>

      {/* Unresolved Variables Card (If any) */}
      {depGraph.missingVariables.length > 0 && (
        <div className="bg-[var(--surface)] border border-amber-500/40 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle size={14} />
            <span>Missing / Unbound Variable References:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {depGraph.missingVariables.map(missingVar => {
              const consumerLinks = depGraph.dependencyLinks.filter(l => l.variableName === missingVar);
              return (
                <div key={missingVar} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                      {`{{${missingVar}}}`}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                      Required by {consumerLinks.length} step{consumerLinks.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Used in: {consumerLinks.map(c => `Step ${c.consumerStepIndex + 1} (${c.location})`).join(', ')}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleAddGlobalVariable(missingVar)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer"
                    >
                      + Global Variable
                    </button>
                    {flow.steps[0] && (
                      <button
                        onClick={() => handleAutoWireExtractor(flow.steps[0].id, missingVar)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 cursor-pointer"
                      >
                        Extract from Step 1
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Dependency Lineage & Link Matrix */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Link size={16} className="text-purple-600 dark:text-purple-400" />
              <span>Variable Passing Pipeline Matrix</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Live lineage mapping: which step extracts data and which step consumes it.
            </p>
          </div>

          <div className="relative min-w-[220px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search variables or steps..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Links Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] font-bold">
                <th className="py-2.5 px-3">Variable</th>
                <th className="py-2.5 px-3">Producer (Source)</th>
                <th className="py-2.5 px-3 text-center">Data Flow</th>
                <th className="py-2.5 px-3">Consumer (Target)</th>
                <th className="py-2.5 px-3">Injection Slot</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-medium">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[var(--text-muted)]">
                    No matching variable dependencies found.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link, idx) => (
                  <tr key={`${link.variableName}_${idx}`} className="hover:bg-[var(--bg-subtle)] transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-1 rounded-md font-mono text-xs font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {`{{${link.variableName}}}`}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      {link.producerStepName ? (
                        <div 
                          onClick={() => link.producerStepId && onSelectStep(link.producerStepId)}
                          className="flex items-center gap-1.5 cursor-pointer group text-[var(--text-primary)] hover:text-purple-600"
                        >
                          <span className="w-5 h-5 rounded flex items-center justify-center bg-purple-600 text-white font-mono text-[10px] font-bold">
                            {(link.producerStepIndex || 0) + 1}
                          </span>
                          <span className="font-semibold truncate max-w-[150px] group-hover:underline">
                            {link.producerStepName}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-500/10 text-slate-600 dark:text-slate-400 font-mono">
                          Flow Globals / Env
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <ArrowRight size={14} className="inline text-purple-500" />
                    </td>

                    <td className="py-2.5 px-3">
                      <div 
                        onClick={() => onSelectStep(link.consumerStepId)}
                        className="flex items-center gap-1.5 cursor-pointer group text-[var(--text-primary)] hover:text-purple-600"
                      >
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-blue-600 text-white font-mono text-[10px] font-bold">
                          {link.consumerStepIndex + 1}
                        </span>
                        <span className="font-semibold truncate max-w-[150px] group-hover:underline">
                          {link.consumerStepName}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        link.location === 'url' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        link.location === 'header' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                        link.location === 'body' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        link.location === 'auth' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                        'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {link.location}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      {link.isResolved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 size={13} />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                          <AlertTriangle size={13} />
                          <span>Unbound</span>
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleCopy(`{{${link.variableName}}}`, `copy_${idx}`)}
                        className="px-2 py-1 rounded bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        title="Copy variable tag"
                      >
                        {copiedKey === `copy_${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Step Dependency Summary Cards */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
          <Database size={16} className="text-purple-600 dark:text-purple-400" />
          <span>Step Input/Output Data Registry</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {depGraph.stepSummaries.map((summary) => (
            <div key={summary.stepId} className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between">
                <div 
                  onClick={() => onSelectStep(summary.stepId)}
                  className="flex items-center gap-2 cursor-pointer hover:text-purple-600"
                >
                  <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-mono text-xs font-bold flex items-center justify-center">
                    {summary.stepNumber}
                  </span>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {summary.stepName}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)]">
                    Step #{summary.stepNumber}
                  </span>
                </div>
              </div>

              {/* Input Variables required */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Inputs Required (Consumes):</span>
                  <span>{summary.consumedVariables.length} vars</span>
                </div>
                {summary.consumedVariables.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic">No upstream variables required</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.consumedVariables.map((c, cIdx) => (
                      <span
                        key={cIdx}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                          c.isMissing
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {`{{${c.variableName}}}`}
                        <span className="text-[9px] opacity-75 font-sans">({c.location})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Output Variables exported */}
              <div className="space-y-1 pt-1 border-t border-[var(--border)]">
                <div className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Outputs Exported (Produces):</span>
                  <span>{summary.producedVariables.length} vars</span>
                </div>
                {summary.producedVariables.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic">No variables extracted from response</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.producedVariables.map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                      >
                        <Sparkles size={10} />
                        <span>{p}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
