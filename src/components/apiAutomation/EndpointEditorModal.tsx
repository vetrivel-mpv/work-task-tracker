import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Code, 
  Layers, 
  Key, 
  ShieldCheck, 
  Sparkles, 
  RotateCw,
  Copy,
  Check
} from 'lucide-react';
import { 
  ApiRequestItem, 
  HttpMethod, 
  ApiHeader, 
  ApiParam, 
  ApiAuth, 
  ApiAssertion, 
  ApiVariableExtractor,
  ApiEnvironment
} from '../../types/apiAutomation';
import { generateId } from '../../utils/date';
import { executeSingleApiRequest, generateCurlCommand } from '../../utils/apiAutomationEngine';

interface EndpointEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestItem: ApiRequestItem | null;
  onSave: (saved: ApiRequestItem) => void;
  environment?: ApiEnvironment | null;
  collectionVariables?: Record<string, string>;
}

export const EndpointEditorModal: React.FC<EndpointEditorModalProps> = ({
  isOpen,
  onClose,
  requestItem,
  onSave,
  environment,
  collectionVariables = {}
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'assertions' | 'extract' | 'curl'>('params');

  // Form State
  const [name, setName] = useState<string>(requestItem?.name || 'New Request Step');
  const [method, setMethod] = useState<HttpMethod>(requestItem?.method || 'GET');
  const [url, setUrl] = useState<string>(requestItem?.url || '{{baseUrl}}/api/resource');
  const [description, setDescription] = useState<string>(requestItem?.description || '');
  const [headers, setHeaders] = useState<ApiHeader[]>(requestItem?.headers || []);
  const [params, setParams] = useState<ApiParam[]>(requestItem?.params || []);
  const [auth, setAuth] = useState<ApiAuth>(requestItem?.auth || { type: 'inherit' });
  const [bodyType, setBodyType] = useState<'none' | 'json' | 'form' | 'raw'>(requestItem?.bodyType || 'none');
  const [bodyContent, setBodyContent] = useState<string>(requestItem?.bodyContent || '{\n  "key": "value"\n}');
  const [assertions, setAssertions] = useState<ApiAssertion[]>(requestItem?.assertions || [
    {
      id: generateId('as'),
      type: 'status_code',
      operator: 'equals',
      expectedValue: '200',
      description: 'Status code is 200 OK',
      enabled: true
    }
  ]);
  const [extractVariables, setExtractVariables] = useState<ApiVariableExtractor[]>(requestItem?.extractVariables || []);
  const [timeoutMs, setTimeoutMs] = useState<number>(requestItem?.timeoutMs || 3000);

  // Single test run preview state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItemDraft: ApiRequestItem = {
    id: requestItem?.id || generateId('req'),
    name,
    method,
    url,
    description,
    headers,
    params,
    auth,
    bodyType,
    bodyContent,
    assertions,
    extractVariables,
    enabled: requestItem ? requestItem.enabled : true,
    timeoutMs
  };

  const handleSave = () => {
    onSave(currentItemDraft);
    onClose();
  };

  const handleTestSingle = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await executeSingleApiRequest(
        currentItemDraft,
        environment,
        collectionVariables
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: 'failed',
        error: err.message || 'Execution error'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Header helpers
  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }]);
  };
  const updateHeader = (index: number, updates: Partial<ApiHeader>) => {
    setHeaders(headers.map((h, i) => i === index ? { ...h, ...updates } : h));
  };
  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  // Param helpers
  const addParam = () => {
    setParams([...params, { key: '', value: '', enabled: true }]);
  };
  const updateParam = (index: number, updates: Partial<ApiParam>) => {
    setParams(params.map((p, i) => i === index ? { ...p, ...updates } : p));
  };
  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index));
  };

  // Assertion helpers
  const addAssertion = () => {
    setAssertions([
      ...assertions,
      {
        id: generateId('as'),
        type: 'status_code',
        operator: 'equals',
        expectedValue: '200',
        description: 'Status code is 200 OK',
        enabled: true
      }
    ]);
  };
  const updateAssertion = (index: number, updates: Partial<ApiAssertion>) => {
    setAssertions(assertions.map((a, i) => i === index ? { ...a, ...updates } : a));
  };
  const removeAssertion = (index: number) => {
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  // Extractor helpers
  const addExtractor = () => {
    setExtractVariables([
      ...extractVariables,
      {
        id: generateId('ex'),
        source: 'json_body',
        path: 'token',
        variableName: 'jwtToken',
        enabled: true,
        description: 'Extracts token for subsequent steps'
      }
    ]);
  };
  const updateExtractor = (index: number, updates: Partial<ApiVariableExtractor>) => {
    setExtractVariables(extractVariables.map((ex, i) => i === index ? { ...ex, ...updates } : ex));
  };
  const removeExtractor = (index: number) => {
    setExtractVariables(extractVariables.filter((_, i) => i !== index));
  };

  const curlString = generateCurlCommand(currentItemDraft, environment, collectionVariables);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
              {requestItem ? 'Edit API Request Step' : 'New API Request Step'}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Configure HTTP method, URL, headers, payloads, assertions, and variable chaining
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Control Bar: Method & URL */}
        <div className="p-6 pb-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Step Name (e.g. 1. Acquire Auth Token)"
              className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-black text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-hidden cursor-pointer"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="{{baseUrl}}/api/resource"
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-hidden"
            />

            <button
              onClick={handleTestSingle}
              disabled={isTesting}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isTesting ? <RotateCw className="animate-spin" size={13} /> : <Play size={13} fill="currentColor" />}
              <span>{isTesting ? 'Sending...' : 'Test Request'}</span>
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="px-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 overflow-x-auto shrink-0 py-2">
          {[
            { id: 'params', label: `Params (${params.length})` },
            { id: 'headers', label: `Headers (${headers.length})` },
            { id: 'auth', label: 'Authorization' },
            { id: 'body', label: `Body (${bodyType})` },
            { id: 'assertions', label: `Assertions (${assertions.length})` },
            { id: 'extract', label: `Variables (${extractVariables.length})` },
            { id: 'curl', label: 'cURL Snippet' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body & Live Preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Main Config Form (7 cols) */}
          <div className="md:col-span-7 p-6 overflow-y-auto space-y-4 border-r border-[var(--border)]">
            {activeTab === 'params' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Query Parameters</span>
                  <button
                    onClick={addParam}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Parameter</span>
                  </button>
                </div>

                {params.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic">No query parameters. Click Add Parameter to append.</p>
                ) : (
                  <div className="space-y-2">
                    {params.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => updateParam(idx, { enabled: e.target.checked })}
                          className="rounded border-[var(--border)] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={p.key}
                          onChange={(e) => updateParam(idx, { key: e.target.value })}
                          placeholder="Key"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={p.value}
                          onChange={(e) => updateParam(idx, { value: e.target.value })}
                          placeholder="Value"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                        />
                        <button
                          onClick={() => removeParam(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'headers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">HTTP Request Headers</span>
                  <button
                    onClick={addHeader}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Header</span>
                  </button>
                </div>

                {headers.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic">No custom headers. Defaults like application/json are injected automatically.</p>
                ) : (
                  <div className="space-y-2">
                    {headers.map((h, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => updateHeader(idx, { enabled: e.target.checked })}
                          className="rounded border-[var(--border)] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) => updateHeader(idx, { key: e.target.value })}
                          placeholder="Header Name"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) => updateHeader(idx, { value: e.target.value })}
                          placeholder="Value (e.g. {{jwtToken}})"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                        />
                        <button
                          onClick={() => removeHeader(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'auth' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-muted)]">Auth Type</label>
                  <select
                    value={auth.type}
                    onChange={(e) => setAuth({ ...auth, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)]"
                  >
                    <option value="inherit">Inherit from Collection / Environment</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="apikey">API Key</option>
                    <option value="none">No Auth</option>
                  </select>
                </div>

                {auth.type === 'bearer' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-muted)]">Bearer Token</label>
                    <input
                      type="text"
                      value={auth.bearerToken || ''}
                      onChange={(e) => setAuth({ ...auth, bearerToken: e.target.value })}
                      placeholder="{{jwtToken}}"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                    />
                  </div>
                )}

                {auth.type === 'basic' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-muted)]">Username</label>
                      <input
                        type="text"
                        value={auth.basicUsername || ''}
                        onChange={(e) => setAuth({ ...auth, basicUsername: e.target.value })}
                        placeholder="admin"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-muted)]">Password</label>
                      <input
                        type="password"
                        value={auth.basicPassword || ''}
                        onChange={(e) => setAuth({ ...auth, basicPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'body' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {(['none', 'json', 'raw'] as const).map(bt => (
                    <label key={bt} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="bodyType"
                        checked={bodyType === bt}
                        onChange={() => setBodyType(bt)}
                        className="cursor-pointer"
                      />
                      <span className="capitalize">{bt}</span>
                    </label>
                  ))}
                </div>

                {bodyType !== 'none' && (
                  <div className="space-y-1.5">
                    <textarea
                      value={bodyContent}
                      onChange={(e) => setBodyContent(e.target.value)}
                      rows={9}
                      placeholder={'{\n  "userId": "{{userId}}"\n}'}
                      className="w-full p-3 rounded-xl border border-[var(--border)] bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'assertions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Validation Assertions</span>
                  <button
                    onClick={addAssertion}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Assertion</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {assertions.map((as, idx) => (
                    <div key={as.id || idx} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={as.description || ''}
                          onChange={(e) => updateAssertion(idx, { description: e.target.value })}
                          placeholder="Assertion Description"
                          className="flex-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold"
                        />
                        <button
                          onClick={() => removeAssertion(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={as.type}
                          onChange={(e) => updateAssertion(idx, { type: e.target.value as any })}
                          className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold"
                        >
                          <option value="status_code">Status Code</option>
                          <option value="response_time">Response Latency (ms)</option>
                          <option value="json_path_value">JSON Path Value</option>
                          <option value="json_body_contains">Body Contains</option>
                          <option value="header_exists">Header Exists</option>
                        </select>

                        {as.type === 'json_path_value' && (
                          <input
                            type="text"
                            value={as.target || ''}
                            onChange={(e) => updateAssertion(idx, { target: e.target.value })}
                            placeholder="Target Path (e.g. data.id)"
                            className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                          />
                        )}

                        <select
                          value={as.operator}
                          onChange={(e) => updateAssertion(idx, { operator: e.target.value as any })}
                          className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="less_than">less than (&lt;)</option>
                          <option value="greater_than">greater than (&gt;)</option>
                          <option value="exists">exists</option>
                          <option value="contains">contains</option>
                        </select>

                        <input
                          type="text"
                          value={as.expectedValue}
                          onChange={(e) => updateAssertion(idx, { expectedValue: e.target.value })}
                          placeholder="Expected Value"
                          className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'extract' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Variable Chaining Extractors</span>
                  <button
                    onClick={addExtractor}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Extractor</span>
                  </button>
                </div>

                {extractVariables.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic">No variables extracted. Use this to capture session tokens or created IDs to pass to subsequent requests.</p>
                ) : (
                  <div className="space-y-2.5">
                    {extractVariables.map((ex, idx) => (
                      <div key={ex.id || idx} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={ex.variableName}
                            onChange={(e) => updateExtractor(idx, { variableName: e.target.value })}
                            placeholder="Variable Name (e.g. authToken)"
                            className="flex-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold font-mono text-[var(--primary)]"
                          />
                          <button
                            onClick={() => removeExtractor(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={ex.source}
                            onChange={(e) => updateExtractor(idx, { source: e.target.value as any })}
                            className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold"
                          >
                            <option value="json_body">JSON Body Path</option>
                            <option value="header">Response Header</option>
                            <option value="status_code">Status Code</option>
                          </select>

                          <input
                            type="text"
                            value={ex.path}
                            onChange={(e) => updateExtractor(idx, { path: e.target.value })}
                            placeholder="Path (e.g. token or data.id)"
                            className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'curl' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Generated cURL Command</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(curlString);
                      setCopiedKey('curl');
                      setTimeout(() => setCopiedKey(null), 2000);
                    }}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'curl' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'curl' ? 'Copied' : 'Copy cURL'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800">
                  {curlString}
                </pre>
              </div>
            )}
          </div>

          {/* Live Response Panel (5 cols) */}
          <div className="md:col-span-5 p-5 bg-[var(--bg-subtle)]/60 flex flex-col overflow-hidden">
            <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center justify-between">
              <span>Live Test Execution Result</span>
              {testResult && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  testResult.status === 'passed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {testResult.httpStatus || 'ERR'} ({testResult.durationMs}ms)
                </span>
              )}
            </h4>

            {testResult ? (
              <div className="flex-1 overflow-y-auto space-y-3">
                {/* Assertion Badges */}
                {testResult.assertionResults && testResult.assertionResults.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-[var(--text-primary)]">Assertions:</div>
                    {testResult.assertionResults.map((a: any, idx: number) => (
                      <div key={idx} className={`p-2 rounded-lg border text-xs flex items-start gap-1.5 ${
                        a.passed ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}>
                        {a.passed ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <XCircle size={13} className="shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <div>{a.description}</div>
                          {a.errorMessage && <div className="text-[10px] text-rose-500 font-mono mt-0.5">{a.errorMessage}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Response Body */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[var(--text-primary)]">Response Payload:</div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 border border-slate-800">
                    {typeof testResult.responseBody === 'object'
                      ? JSON.stringify(testResult.responseBody, null, 2)
                      : String(testResult.responseBody || testResult.error || 'No body')}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)] space-y-2">
                <Play size={24} className="opacity-30" />
                <p className="text-xs font-medium">Click "Test Request" above to execute this endpoint live.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Save Request Step
          </button>
        </div>
      </div>
    </div>
  );
};
