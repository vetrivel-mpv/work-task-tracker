import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Code, 
  Sparkles, 
  Clock, 
  Check, 
  Copy, 
  Play, 
  FileCode, 
  ShieldCheck, 
  Database, 
  Sliders, 
  RotateCw, 
  ArrowRight,
  Info,
  Layers,
  Zap,
  Key
} from 'lucide-react';
import { 
  ApiFlowStep, 
  ApiRequestItem, 
  HttpMethod, 
  AuthType,
  ApiHeader, 
  ApiParam, 
  ApiAssertion, 
  ApiVariableExtractor,
  FlowStepCondition,
  ApiEnvironment
} from '../../types/apiAutomation';
import { generateId } from '../../utils/date';
import { generateBruFile } from '../../utils/brunoEngine';
import { extractVariableNames } from '../../utils/flowDependencyEngine';

interface FlowStepConfigDrawerProps {
  step: ApiFlowStep | null;
  allSteps: ApiFlowStep[];
  availableVariables: string[];
  activeEnvironment?: ApiEnvironment;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStep: ApiFlowStep) => void;
  onDelete?: (stepId: string) => void;
}

export const FlowStepConfigDrawer: React.FC<FlowStepConfigDrawerProps> = ({
  step,
  allSteps,
  availableVariables,
  activeEnvironment,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'request' | 'variables' | 'conditions' | 'scripts_asserts' | 'bru_dsl'>('request');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form local state
  const [stepName, setStepName] = useState('');
  const [stepDesc, setStepDesc] = useState('');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<ApiHeader[]>([]);
  const [params, setParams] = useState<ApiParam[]>([]);
  const [bodyType, setBodyType] = useState<'none' | 'json' | 'raw' | 'form'>('none');
  const [bodyContent, setBodyContent] = useState('');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');

  // Gating & Condition state
  const [condition, setCondition] = useState<FlowStepCondition>('only_if_prev_passed');
  const [customCondition, setCustomCondition] = useState('');
  const [delayBeforeStepMs, setDelayBeforeStepMs] = useState<number>(0);
  const [stopFlowOnFailure, setStopFlowOnFailure] = useState<boolean>(true);
  const [retryEnabled, setRetryEnabled] = useState<boolean>(false);
  const [maxRetries, setMaxRetries] = useState<number>(2);
  const [retryDelayMs, setRetryDelayMs] = useState<number>(500);

  // Extractors & Scripts
  const [extractors, setExtractors] = useState<ApiVariableExtractor[]>([]);
  const [assertions, setAssertions] = useState<ApiAssertion[]>([]);
  const [brunoPreScript, setBrunoPreScript] = useState('');
  const [brunoPostScript, setBrunoPostScript] = useState('');

  useEffect(() => {
    if (step) {
      setStepName(step.name || '');
      setStepDesc(step.description || '');
      setMethod(step.request?.method || 'GET');
      setUrl(step.request?.url || '');
      setHeaders(step.request?.headers ? JSON.parse(JSON.stringify(step.request.headers)) : []);
      setParams(step.request?.params ? JSON.parse(JSON.stringify(step.request.params)) : []);
      setBodyType(step.request?.bodyType || 'none');
      setBodyContent(step.request?.bodyContent || '');
      setAuthType(step.request?.auth?.type || 'none');
      setBearerToken(step.request?.auth?.bearerToken || '');
      setBasicUser(step.request?.auth?.basicUsername || '');
      setBasicPass(step.request?.auth?.basicPassword || '');

      setCondition(step.condition || 'only_if_prev_passed');
      setCustomCondition(step.customCondition || '');
      setDelayBeforeStepMs(step.delayBeforeStepMs || 0);
      setStopFlowOnFailure(step.stopFlowOnFailure !== false);
      setRetryEnabled(step.retryOnFailure?.enabled || false);
      setMaxRetries(step.retryOnFailure?.maxRetries || 2);
      setRetryDelayMs(step.retryOnFailure?.retryDelayMs || 500);

      setExtractors(step.extractors ? JSON.parse(JSON.stringify(step.extractors)) : []);
      setAssertions(step.assertions ? JSON.parse(JSON.stringify(step.assertions)) : (step.request?.assertions || []));
      setBrunoPreScript(step.brunoPreScript || '');
      setBrunoPostScript(step.brunoPostScript || '');
    }
  }, [step]);

  if (!isOpen || !step) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInsertVariable = (varName: string, target: 'url' | 'body' | 'header' | 'bearer') => {
    const token = `{{${varName}}}`;
    if (target === 'url') {
      setUrl(prev => prev + token);
    } else if (target === 'body') {
      setBodyContent(prev => prev + token);
    } else if (target === 'bearer') {
      setBearerToken(token);
      setAuthType('bearer');
    }
  };

  // Prettify JSON Body
  const handleFormatJsonBody = () => {
    try {
      const parsed = JSON.parse(bodyContent);
      setBodyContent(JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore if malformed JSON with template tokens
    }
  };

  // Add Extractor
  const handleAddExtractor = () => {
    const newExt: ApiVariableExtractor = {
      id: generateId('ext'),
      source: 'json_body',
      path: 'token',
      variableName: 'authToken',
      targetVariable: 'authToken',
      defaultValue: '',
      enabled: true
    };
    const updated = [...extractors, newExt];
    setExtractors(updated);

    // Also sync to brunoPostScript
    const scriptLine = `\nif (res.body && res.body.token) {\n  bru.setVar('authToken', res.body.token);\n}`;
    if (!brunoPostScript.includes('bru.setVar')) {
      setBrunoPostScript(prev => (prev ? `${prev}\n${scriptLine}` : scriptLine));
    }
  };

  // Add Assertion
  const handleAddAssertion = () => {
    const newAs: ApiAssertion = {
      id: generateId('as'),
      type: 'status_code',
      operator: 'equals',
      expectedValue: '200',
      description: 'Status is 200 OK',
      enabled: true
    };
    setAssertions([...assertions, newAs]);
  };

  // Add Header
  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }]);
  };

  // Add Param
  const handleAddParam = () => {
    setParams([...params, { key: '', value: '', enabled: true }]);
  };

  // Save Step
  const handleSaveStep = () => {
    const updatedReq: ApiRequestItem = {
      ...step.request,
      id: step.request?.id || generateId('req'),
      name: stepName,
      method,
      url,
      headers,
      params,
      bodyType,
      bodyContent: bodyType !== 'none' ? bodyContent : undefined,
      auth: {
        type: authType,
        bearerToken: authType === 'bearer' ? bearerToken : undefined,
        basicUsername: authType === 'basic' ? basicUser : undefined,
        basicPassword: authType === 'basic' ? basicPass : undefined
      },
      assertions,
      extractVariables: extractors,
      enabled: true
    };

    const updatedStep: ApiFlowStep = {
      ...step,
      name: stepName,
      description: stepDesc,
      request: updatedReq,
      condition,
      customCondition: condition === 'custom_expression' ? customCondition : undefined,
      delayBeforeStepMs,
      stopFlowOnFailure,
      retryOnFailure: {
        enabled: retryEnabled,
        maxRetries,
        retryDelayMs
      },
      extractors,
      assertions,
      brunoPreScript,
      brunoPostScript
    };

    onSave(updatedStep);
    onClose();
  };

  // Generate live .bru preview
  const previewBru = generateBruFile({
    ...step.request,
    name: stepName || 'Test Step',
    method,
    url,
    headers,
    params,
    bodyType,
    bodyContent,
    auth: {
      type: authType,
      bearerToken,
      basicUsername: basicUser,
      basicPassword: basicPass
    },
    assertions
  }, step.stepNumber);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end animate-fadeIn">
      <div className="w-full max-w-3xl h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 bg-[var(--bg-subtle)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-purple-600 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
              #{step.stepNumber}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                  method === 'GET' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                  method === 'POST' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                  method === 'PUT' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  'bg-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {method}
                </span>
                <input
                  type="text"
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  placeholder="Step Name..."
                  className="font-bold text-sm text-[var(--text-primary)] bg-transparent border-b border-dashed border-transparent hover:border-[var(--border)] focus:border-purple-500 focus:outline-none px-1"
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                Configure HTTP endpoint, variable bindings, extraction rules & flow conditions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Delete this test step from the flow?')) {
                    onDelete(step.id);
                    onClose();
                  }
                }}
                className="p-2 text-[var(--text-muted)] hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Delete Step"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              onClick={handleSaveStep}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('request')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'request'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers size={14} />
            <span>1. Request & Payload</span>
          </button>

          <button
            onClick={() => setActiveTab('variables')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'variables'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Zap size={14} />
            <span>2. Variables & Extraction</span>
            {extractors.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-600 text-white font-bold">
                {extractors.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('conditions')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'conditions'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders size={14} />
            <span>3. Flow Gating & Retries</span>
          </button>

          <button
            onClick={() => setActiveTab('scripts_asserts')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'scripts_asserts'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck size={14} />
            <span>4. Assertions & Scripts</span>
            {assertions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-bold">
                {assertions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bru_dsl')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'bru_dsl'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileCode size={14} />
            <span>5. Bruno (.bru) DSL</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: Request & Payload */}
          {activeTab === 'request' && (
            <div className="space-y-5">
              {/* URL & Method Bar */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                  <span>Endpoint Target URL:</span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">Supports `{'{{var}}'}` template syntax</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as HttpMethod)}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:ring-1 focus:ring-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="OPTIONS">OPTIONS</option>
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="{{baseUrl}}/api/v1/resource/{{resourceId}}"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Variable Token Inserters */}
                {availableVariables.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">Insert Var:</span>
                    {availableVariables.slice(0, 6).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v, 'url')}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 cursor-pointer"
                      >
                        + {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-primary)]">
                  Step Description / Functional Objective:
                </label>
                <input
                  type="text"
                  value={stepDesc}
                  onChange={(e) => setStepDesc(e.target.value)}
                  placeholder="e.g. Fetches the authenticated user profile using token from Step 1"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Auth Settings */}
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Key size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Authentication:</span>
                  </label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as any)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="none">No Auth (Public)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="apikey">API Key Header</option>
                  </select>
                </div>

                {authType === 'bearer' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">
                      Bearer Token Value:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        placeholder="{{authToken}}"
                        className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      />
                      {availableVariables.includes('authToken') && (
                        <button
                          type="button"
                          onClick={() => setBearerToken('{{authToken}}')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 cursor-pointer"
                        >
                          Use {'{{authToken}}'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Headers Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    HTTP Request Headers ({headers.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Header</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {headers.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[idx].enabled = e.target.checked;
                          setHeaders(updated);
                        }}
                        className="rounded text-purple-600 focus:ring-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[idx].key = e.target.value;
                          setHeaders(updated);
                        }}
                        placeholder="Header Name (e.g. Accept)"
                        className="w-1/3 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={h.value}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[idx].value = e.target.value;
                          setHeaders(updated);
                        }}
                        placeholder="Value (e.g. application/json)"
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                        className="p-1 text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Body (For POST/PUT/PATCH) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      Request Payload (Body):
                    </label>
                    <select
                      value={bodyType}
                      onChange={(e) => setBodyType(e.target.value as any)}
                      className="px-2 py-1 text-xs rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none cursor-pointer"
                    >
                      <option value="none">none</option>
                      <option value="json">JSON</option>
                      <option value="raw">Raw Text</option>
                    </select>
                  </div>

                  {bodyType === 'json' && (
                    <button
                      type="button"
                      onClick={handleFormatJsonBody}
                      className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      Prettify JSON
                    </button>
                  )}
                </div>

                {bodyType !== 'none' && (
                  <div className="space-y-2">
                    <textarea
                      rows={6}
                      value={bodyContent}
                      onChange={(e) => setBodyContent(e.target.value)}
                      placeholder='{\n  "email": "user@example.com",\n  "userId": "{{userId}}"\n}'
                      className="w-full p-3 font-mono text-xs rounded-xl bg-slate-950 text-slate-100 border border-slate-800 focus:ring-1 focus:ring-purple-500 focus:outline-none leading-relaxed"
                    />

                    {/* Quick tokens */}
                    {availableVariables.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">Insert into Body:</span>
                        {availableVariables.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => handleInsertVariable(v, 'body')}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 cursor-pointer"
                          >
                            {`{{${v}}}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Variable Passing & Extraction */}
          {activeTab === 'variables' && (
            <div className="space-y-6">
              
              {/* Upstream Dependencies Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/15 to-[var(--bg-subtle)] border border-blue-500/30 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold">
                  <Database size={15} />
                  <span>Variables Available from Prior Steps & Environments:</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  These dynamic variables are exported by earlier steps in the flow and can be used in this step with <code className="px-1 py-0.2 rounded bg-blue-500/10 font-mono text-blue-600 dark:text-blue-400">{'{{varName}}'}</code>.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {availableVariables.length === 0 ? (
                    <span className="text-xs text-[var(--text-muted)] italic">
                      No upstream variables exported yet. Add variable extractors below or in prior steps.
                    </span>
                  ) : (
                    availableVariables.map(v => (
                      <div
                        key={v}
                        className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2 shadow-2xs"
                      >
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {`{{${v}}}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`{{${v}}}`, `var_tag_${v}`)}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          title="Copy token"
                        >
                          {copiedKey === `var_tag_${v}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Variable Extractors Builder (Outputs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                      <span>Response Variable Extractors (Exports)</span>
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Extract data from this HTTP response and store into variables for downstream steps.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExtractor}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add Extractor</span>
                  </button>
                </div>

                {extractors.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-[var(--border)] text-center space-y-2 bg-[var(--bg-subtle)]">
                    <Database size={24} className="mx-auto text-[var(--text-muted)]" />
                    <p className="text-xs text-[var(--text-secondary)] font-medium">
                      No response extractors configured for this step.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Extract JWT auth tokens, user IDs, or order references to pass them to subsequent requests.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddExtractor}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-purple-600 dark:text-purple-400 cursor-pointer"
                    >
                      + Extract New Variable
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {extractors.map((ext, idx) => (
                      <div key={ext.id || idx} className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-purple-600 text-white text-[10px] font-mono flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span>Extractor Rule #{idx + 1}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setExtractors(extractors.filter((_, i) => i !== idx))}
                            className="p-1 text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] block mb-1">
                              Source Type:
                            </label>
                            <select
                              value={ext.source}
                              onChange={(e) => {
                                const updated = [...extractors];
                                updated[idx].source = e.target.value as any;
                                setExtractors(updated);
                              }}
                              className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                            >
                              <option value="json_body">JSON Body Field</option>
                              <option value="header">Response Header</option>
                              <option value="status_code">Status Code</option>
                              <option value="regex">Regex Match</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] block mb-1">
                              JSONPath / Header Key:
                            </label>
                            <input
                              type="text"
                              value={ext.path}
                              onChange={(e) => {
                                const updated = [...extractors];
                                updated[idx].path = e.target.value;
                                setExtractors(updated);
                              }}
                              placeholder="e.g. data.token or token"
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] block mb-1">
                              Target Variable Name:
                            </label>
                            <input
                              type="text"
                              value={ext.variableName || ext.targetVariable || ''}
                              onChange={(e) => {
                                const updated = [...extractors];
                                updated[idx].variableName = e.target.value;
                                updated[idx].targetVariable = e.target.value;
                                setExtractors(updated);
                              }}
                              placeholder="e.g. authToken"
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-purple-600 dark:text-purple-400 rounded-lg bg-[var(--surface)] border border-[var(--border)] focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Visual output indicator */}
                        <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                          <ArrowRight size={12} className="text-purple-500" />
                          <span>Stores into runtime variable:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">
                            {`{{${ext.variableName || ext.targetVariable || 'varName'}}}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Control Flow & Conditions */}
          {activeTab === 'conditions' && (
            <div className="space-y-5">
              {/* Execution Gating Condition */}
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-3">
                <label className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                  <span>Step Execution Condition (Gating):</span>
                </label>

                <div className="space-y-2">
                  {[
                    { id: 'always', title: 'Always Run', desc: 'Executes unconditionally regardless of previous steps status' },
                    { id: 'only_if_prev_passed', title: 'Only If Previous Step Passed', desc: 'Standard pipeline behavior; skips if any preceding dependency failed' },
                    { id: 'skip_if_token_missing', title: 'Skip If Auth Token Is Missing', desc: 'Skips execution automatically if {{authToken}} is undefined' },
                    { id: 'custom_expression', title: 'Custom JavaScript Logic', desc: 'Evaluate a custom JS boolean condition expression' }
                  ].map(opt => (
                    <label
                      key={opt.id}
                      onClick={() => setCondition(opt.id as any)}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        condition === opt.id
                          ? 'bg-purple-600/10 border-purple-500 text-[var(--text-primary)]'
                          : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="flowCondition"
                        checked={condition === opt.id}
                        onChange={() => setCondition(opt.id as any)}
                        className="mt-0.5 text-purple-600 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{opt.title}</div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {condition === 'custom_expression' && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      JavaScript Condition Expression:
                    </label>
                    <input
                      type="text"
                      value={customCondition}
                      onChange={(e) => setCustomCondition(e.target.value)}
                      placeholder="vars.authToken && vars.status === 'active'"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-950 text-slate-100 border border-slate-800 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Timing & Delay */}
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-3">
                <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Clock size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>Execution Delay Before Step:</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={5000}
                    step={100}
                    value={delayBeforeStepMs}
                    onChange={(e) => setDelayBeforeStepMs(Number(e.target.value))}
                    className="flex-1 accent-purple-600 cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)] w-16 text-right">
                    {delayBeforeStepMs} ms
                  </span>
                </div>
              </div>

              {/* Stop on Failure & Retries */}
              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">Stop Flow On Step Failure (Fail-Fast)</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">If this step fails assertions or returns an HTTP error, stop pipeline execution</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={stopFlowOnFailure}
                    onChange={(e) => setStopFlowOnFailure(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">Auto-Retry on Transient Failures</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">Automatically re-attempt request if HTTP 5xx or network timeout occurs</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={retryEnabled}
                    onChange={(e) => setRetryEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                {retryEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] block mb-1">Max Retries:</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] block mb-1">Retry Delay (ms):</label>
                      <input
                        type="number"
                        min={100}
                        max={5000}
                        step={100}
                        value={retryDelayMs}
                        onChange={(e) => setRetryDelayMs(Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Assertions & Bruno Scripts */}
          {activeTab === 'scripts_asserts' && (
            <div className="space-y-6">
              
              {/* Assertions Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      <span>Response Assertions ({assertions.length})</span>
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Automated validation checks evaluated against this step's HTTP response.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAssertion}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add Assertion</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {assertions.map((as, idx) => (
                    <div key={as.id || idx} className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={as.enabled}
                        onChange={(e) => {
                          const updated = [...assertions];
                          updated[idx].enabled = e.target.checked;
                          setAssertions(updated);
                        }}
                        className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                      />

                      <select
                        value={as.type}
                        onChange={(e) => {
                          const updated = [...assertions];
                          updated[idx].type = e.target.value as any;
                          setAssertions(updated);
                        }}
                        className="px-2 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value="status_code">Status Code</option>
                        <option value="response_time">Response Time (ms)</option>
                        <option value="json_path_value">JSON Body Property</option>
                        <option value="header_exists">Header Exists</option>
                      </select>

                      <select
                        value={as.operator}
                        onChange={(e) => {
                          const updated = [...assertions];
                          updated[idx].operator = e.target.value as any;
                          setAssertions(updated);
                        }}
                        className="px-2 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="less_than">less than</option>
                        <option value="contains">contains</option>
                        <option value="exists">exists</option>
                      </select>

                      <input
                        type="text"
                        value={as.expectedValue}
                        onChange={(e) => {
                          const updated = [...assertions];
                          updated[idx].expectedValue = e.target.value;
                          setAssertions(updated);
                        }}
                        placeholder="Expected Value (e.g. 200)"
                        className="flex-1 px-2.5 py-1 text-xs font-mono rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => setAssertions(assertions.filter((_, i) => i !== idx))}
                        className="p-1 text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bruno Post-Response Script */}
              <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Code size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Bruno Post-Response JavaScript Sandbox:</span>
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    bru.setVar('var', res.body.prop)
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={brunoPostScript}
                  onChange={(e) => setBrunoPostScript(e.target.value)}
                  placeholder={`// Post-response script executed after step completion\nif (res.status === 200 && res.body.token) {\n  bru.setVar('authToken', res.body.token);\n}`}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-slate-950 text-emerald-400 border border-slate-800 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Bruno Pre-Request Script */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Code size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Bruno Pre-Request JavaScript Sandbox:</span>
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    req.setHeader('X-Trace', 'trace_' + Date.now())
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={brunoPreScript}
                  onChange={(e) => setBrunoPreScript(e.target.value)}
                  placeholder={`// Pre-request script executed before step dispatch\nreq.setHeader('X-Step-Time', Date.now().toString());`}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-slate-950 text-emerald-400 border border-slate-800 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 5: Bruno DSL Preview */}
          {activeTab === 'bru_dsl' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    <FileCode size={16} className="text-purple-600 dark:text-purple-400" />
                    <span>Generated Bruno (.bru) DSL Code</span>
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Plaintext representation saved in Git and executed natively by Bruno CLI.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(previewBru, 'drawer_bru')}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold cursor-pointer"
                >
                  {copiedKey === 'drawer_bru' ? <Check size={12} className="inline mr-1" /> : <Copy size={12} className="inline mr-1" />}
                  <span>{copiedKey === 'drawer_bru' ? 'Copied' : 'Copy .bru'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-2xl overflow-x-auto border border-slate-800 leading-relaxed max-h-96">
                {previewBru}
              </pre>
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSaveStep}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Save size={14} />
            <span>Save Step Configuration</span>
          </button>
        </div>

      </div>
    </div>
  );
};
