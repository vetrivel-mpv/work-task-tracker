import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileCode, 
  Copy, 
  Check, 
  AlertTriangle, 
  Layers, 
  Terminal,
  Code,
  Sparkles,
  Zap,
  CheckCircle2,
  GitBranch,
  BookOpen,
  ArrowRight,
  Play
} from 'lucide-react';
import { ApiAutomationCollection, ApiTestFlow, ApiEnvironment, ApiRequestItem } from '../../types/apiAutomation';
import { 
  generateBruFile, 
  parseBruFile, 
  generateBrunoCollectionJson, 
  generateBrunoEnvironmentBru, 
  generateBrunoCliCommand, 
  generateBrunoAzureDevOpsYaml, 
  generateBrunoGitHubActionsYaml 
} from '../../utils/brunoEngine';
import { generateId } from '../../utils/date';

interface BrunoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollection?: ApiAutomationCollection;
  activeFlow?: ApiTestFlow;
  activeEnvironment?: ApiEnvironment;
  onImportCollection?: (collection: ApiAutomationCollection) => void;
  onImportFlow?: (flow: ApiTestFlow) => void;
}

export const BrunoStudioModal: React.FC<BrunoStudioModalProps> = ({
  isOpen,
  onClose,
  activeCollection,
  activeFlow,
  activeEnvironment,
  onImportCollection,
  onImportFlow
}) => {
  const [activeTab, setActiveTab] = useState<'export_bru' | 'import_bru' | 'cli_pipeline' | 'cheat_sheet'>('export_bru');
  const [importBruContent, setImportBruContent] = useState<string>('');
  const [importFlowName, setImportFlowName] = useState<string>('Imported Bruno Flow');
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedRequestIdx, setSelectedRequestIdx] = useState<number>(0);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportBruContent(content);
      if (file.name) {
        setImportFlowName(file.name.replace(/\.bru$/, ''));
      }
    };
    reader.readAsText(file);
  };

  const handleImportBru = () => {
    setError(null);
    try {
      if (!importBruContent.trim()) {
        throw new Error('Please paste .bru file DSL content or upload a .bru file.');
      }

      const parsedRequest = parseBruFile(importBruContent);
      if (!parsedRequest.url) {
        throw new Error('Could not find a valid HTTP method & target URL in the .bru content.');
      }

      const fullRequest: ApiRequestItem = {
        id: parsedRequest.id || generateId('req_bru'),
        name: parsedRequest.name || 'Imported Bruno Step',
        method: parsedRequest.method || 'GET',
        url: parsedRequest.url,
        headers: parsedRequest.headers || [],
        params: parsedRequest.params || [],
        bodyType: parsedRequest.bodyType || 'none',
        bodyContent: parsedRequest.bodyContent || '',
        assertions: parsedRequest.assertions || [
          {
            id: generateId('as'),
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP 200 OK',
            enabled: true
          }
        ],
        extractVariables: parsedRequest.extractVariables || [],
        enabled: true
      };

      // Create new collection
      if (onImportCollection) {
        const newCol: ApiAutomationCollection = {
          id: generateId('col_bru'),
          name: importFlowName || parsedRequest.name || 'Imported Bruno Collection',
          description: 'Imported from Bruno (.bru) format',
          category: 'integration',
          baseUrl: '{{baseUrl}}',
          variables: { baseUrl: 'http://localhost:3000' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          requests: [fullRequest]
        };
        onImportCollection(newCol);
      }

      // Create new flow if onImportFlow available
      if (onImportFlow) {
        const newFlow: ApiTestFlow = {
          id: generateId('flow_bru'),
          name: importFlowName || 'Imported Bruno Flow',
          description: 'Flow created from imported .bru DSL request',
          category: 'e2e_journey',
          globalVariables: { baseUrl: 'http://localhost:3000' },
          steps: [
            {
              id: generateId('step_bru'),
              stepNumber: 1,
              name: fullRequest.name,
              request: fullRequest,
              condition: 'always',
              extractors: fullRequest.extractVariables,
              assertions: fullRequest.assertions
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        onImportFlow(newFlow);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to parse Bruno .bru format.');
    }
  };

  // Get active requests list (from collection or active flow)
  const currentRequests: ApiRequestItem[] = activeCollection?.requests || 
    (activeFlow?.steps.map(s => s.request) || []);

  const selectedRequest = currentRequests[selectedRequestIdx] || currentRequests[0];
  const exportedBru = selectedRequest ? generateBruFile(selectedRequest, selectedRequestIdx + 1) : '';
  const exportedManifest = activeCollection ? generateBrunoCollectionJson(activeCollection) : '';
  const exportedEnv = activeEnvironment ? generateBrunoEnvironmentBru(activeEnvironment) : '';
  const cliCommand = generateBrunoCliCommand(activeCollection?.name || activeFlow?.name || 'acm-suite', activeEnvironment?.name || 'staging');
  const adoPipelineYaml = generateBrunoAzureDevOpsYaml(activeCollection || activeFlow || { name: 'ACM Delivery Suite' } as any);
  const githubWorkflowYaml = generateBrunoGitHubActionsYaml(activeCollection || activeFlow || { name: 'ACM Delivery Suite' } as any);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Zap size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  Bruno API Testing & Flow Studio
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  Open Source .bru Engine
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Git-friendly .bru collection files, variable chaining, CLI runners, and CI/CD pipelines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]/50">
          <button
            onClick={() => setActiveTab('export_bru')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'export_bru'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileCode size={14} />
            <span>Export Bruno (.bru) DSL</span>
          </button>
          <button
            onClick={() => setActiveTab('import_bru')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'import_bru'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Upload size={14} />
            <span>Import .bru File / Flow</span>
          </button>
          <button
            onClick={() => setActiveTab('cli_pipeline')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cli_pipeline'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Terminal size={14} />
            <span>Bruno CLI & CI/CD Pipelines</span>
          </button>
          <button
            onClick={() => setActiveTab('cheat_sheet')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cheat_sheet'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-[var(--surface)] rounded-t-lg'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BookOpen size={14} />
            <span>Bruno Scripting & Variables</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: EXPORT BRUNO (.bru) */}
          {activeTab === 'export_bru' && (
            <div className="space-y-5">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3.5 flex items-start gap-3">
                <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-bold text-[var(--text-primary)]">Native Bruno Format: </span>
                  Bruno saves each request as an individual plain-text <code className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[11px] text-purple-600 dark:text-purple-400">.bru</code> file.
                  These files can be stored directly inside your Git repository without cloud lock-in.
                </div>
              </div>

              {/* Step selector if multiple requests exist */}
              {currentRequests.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-2">
                    Select Request / Step to View (.bru DSL):
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {currentRequests.map((req, idx) => (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => setSelectedRequestIdx(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                          selectedRequestIdx === idx
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)]'
                        }`}
                      >
                        <span className="opacity-80 font-mono text-[10px]">#{idx + 1}</span>
                        <span className="truncate max-w-[140px]">{req.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main .bru File Content Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <FileCode size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>{selectedRequest?.name ? `${selectedRequest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.bru` : 'request.bru'}</span>
                  </span>
                  <button
                    onClick={() => handleCopy(exportedBru, 'bru_code')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {copiedKey === 'bru_code' ? (
                      <>
                        <Check size={13} className="text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied .bru</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy .bru Code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl font-mono text-xs text-[var(--text-primary)] overflow-x-auto max-h-72 leading-relaxed selection:bg-purple-500/30">
                  {exportedBru || '// No request selected'}
                </pre>
              </div>

              {/* bruno.json manifest & environments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Collection Manifest (bruno.json)</span>
                    <button
                      onClick={() => handleCopy(exportedManifest, 'bruno_json')}
                      className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'bruno_json' ? <Check size={11} /> : <Copy size={11} />}
                      {copiedKey === 'bruno_json' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl font-mono text-[11px] text-[var(--text-secondary)] overflow-x-auto max-h-36">
                    {exportedManifest}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Environment (environments/staging.bru)</span>
                    <button
                      onClick={() => handleCopy(exportedEnv, 'staging_bru')}
                      className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'staging_bru' ? <Check size={11} /> : <Copy size={11} />}
                      {copiedKey === 'staging_bru' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl font-mono text-[11px] text-[var(--text-secondary)] overflow-x-auto max-h-36">
                    {exportedEnv || 'vars {\n  baseUrl: http://localhost:3000\n}'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT BRUNO (.bru) */}
          {activeTab === 'import_bru' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4">
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Upload .bru File or Paste .bru DSL
                </label>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  Paste the contents of any Bruno (.bru) file to import it into your workspace as an executable test step or flow.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Target Flow / Collection Name
                    </label>
                    <input
                      type="text"
                      value={importFlowName}
                      onChange={(e) => setImportFlowName(e.target.value)}
                      placeholder="e.g. ACM Device Auth Flow"
                      className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Choose .bru File from Disk
                    </label>
                    <input
                      type="file"
                      accept=".bru,.txt,.json"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-[var(--text-secondary)] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600/10 file:text-purple-600 dark:file:text-purple-400 hover:file:bg-purple-600/20 cursor-pointer"
                    />
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={importBruContent}
                  onChange={(e) => setImportBruContent(e.target.value)}
                  placeholder={`meta {
  name: Get User Details
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/users/me
  body: none
  auth: bearer
}

auth:bearer {
  token: {{authToken}}
}

assert {
  res.status: eq 200
  res.body.email: isDefined
}`}
                  className="w-full p-3 font-mono text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none"
                />

                {error && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportBru}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold bg-purple-600 text-white hover:bg-purple-500 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                >
                  <Upload size={14} />
                  <span>Import into Workspace</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CLI & CI/CD PIPELINES */}
          {activeTab === 'cli_pipeline' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Terminal size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Bruno CLI Command (@usebruno/cli)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(cliCommand, 'cli_cmd')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer"
                  >
                    {copiedKey === 'cli_cmd' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedKey === 'cli_cmd' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-zinc-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto border border-zinc-800 leading-relaxed">
                  {cliCommand}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <GitBranch size={14} className="text-blue-500" />
                    <span>Azure DevOps Pipeline (azure-pipelines.yml)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(adoPipelineYaml, 'ado_yaml')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer"
                  >
                    {copiedKey === 'ado_yaml' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedKey === 'ado_yaml' ? 'Copied' : 'Copy Azure YAML'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-[var(--bg-subtle)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] rounded-xl overflow-x-auto max-h-56">
                  {adoPipelineYaml}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Zap size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>GitHub Actions Workflow (.github/workflows/bruno.yml)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(githubWorkflowYaml, 'gh_yaml')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer"
                  >
                    {copiedKey === 'gh_yaml' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedKey === 'gh_yaml' ? 'Copied' : 'Copy GitHub YAML'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-[var(--bg-subtle)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] rounded-xl overflow-x-auto max-h-56">
                  {githubWorkflowYaml}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: CHEAT SHEET & SCRIPTING */}
          {activeTab === 'cheat_sheet' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl space-y-2">
                  <div className="text-xs font-extrabold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Code size={14} />
                    <span>Variable Chaining (bru.setVar)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Use post-response scripts to capture dynamic tokens, IDs, or session states for downstream steps:
                  </p>
                  <pre className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-[11px] text-[var(--text-primary)]">
{`script:post-response {
  // Store token in Bruno state
  if (res.body.token) {
    bru.setVar('authToken', res.body.token);
  }
  // Store extracted user ID
  if (res.body.user) {
    bru.setVar('userId', res.body.user.id);
  }
}`}
                  </pre>
                </div>

                <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl space-y-2">
                  <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Bruno Assertions (assert block)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Define human-readable assertions evaluated on every run:
                  </p>
                  <pre className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-[11px] text-[var(--text-primary)]">
{`assert {
  res.status: eq 200
  res.responseTime: lte 1200
  res.body.success: eq true
  res.body.data.items: isDefined
  res.headers['content-type']: contains json
}`}
                  </pre>
                </div>

                <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl space-y-2">
                  <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Zap size={14} />
                    <span>Pre-Request Scripting (req.setHeader)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Dynamically inject headers, timestamps, or HMAC hashes prior to sending:
                  </p>
                  <pre className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-[11px] text-[var(--text-primary)]">
{`script:pre-request {
  const traceId = 'req_' + Date.now();
  req.setHeader('X-Trace-Id', traceId);
  console.log('Dispatching request with trace ID:', traceId);
}`}
                  </pre>
                </div>

                <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl space-y-2">
                  <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Layers size={14} />
                    <span>Consuming Variables in URLs & Headers</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Use double curly brace syntax everywhere in URLs, Headers, and JSON payloads:
                  </p>
                  <pre className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-[11px] text-[var(--text-primary)]">
{`get {
  url: {{baseUrl}}/api/v1/orders/{{orderId}}
}

headers {
  Authorization: Bearer {{authToken}}
  X-Device-Id: {{deviceUuid}}
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>100% Offline, Git-Friendly & Compatible with Bruno Desktop & CLI</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
