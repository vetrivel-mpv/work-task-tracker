import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  Zap, 
  Copy, 
  Check, 
  ArrowRight, 
  FileCode, 
  GitBranch, 
  ShieldCheck, 
  ExternalLink,
  BookOpen,
  Sparkles,
  Server,
  Play,
  RotateCw,
  Code,
  Download,
  FolderDown,
  Cpu,
  Clock,
  Eye,
  Database,
  Link,
  Boxes
} from 'lucide-react';
import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiTestFlow,
  ApiRequestExecutionResult
} from '../../types/apiAutomation';
import { 
  generatePlaywrightSpecFromCollection, 
  generatePlaywrightSpecFromFlow, 
  generatePlaywrightConfigTs, 
  generatePlaywrightPackageJson, 
  generatePlaywrightFixturesFile, 
  generatePlaywrightZodSchemaSpec, 
  generatePlaywrightAzureDevOpsYaml, 
  generatePlaywrightGitHubActionsYaml, 
  generatePlaywrightCliCommands,
  downloadPlaywrightProjectZip
} from '../../utils/playwrightApiEngine';
import { runFullCollection } from '../../utils/apiAutomationEngine';

interface PlaywrightStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection?: ApiAutomationCollection;
  flow?: ApiTestFlow;
  activeEnvironment?: ApiEnvironment;
}

export const PlaywrightStudioModal: React.FC<PlaywrightStudioModalProps> = ({
  isOpen,
  onClose,
  collection,
  flow,
  activeEnvironment
}) => {
  const [activeTab, setActiveTab] = useState<'spec' | 'workspace' | 'runner' | 'cicd' | 'guide'>('spec');
  const [selectedFile, setSelectedFile] = useState<'test_spec' | 'flow_spec' | 'zod_schema' | 'config' | 'fixtures' | 'package_json'>('test_spec');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Runner execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runLogs, setRunLogs] = useState<ApiRequestExecutionResult[]>([]);
  const [runStats, setRunStats] = useState<{ total: number; passed: number; failed: number; durationMs: number } | null>(null);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const targetName = flow ? flow.name : (collection ? collection.name : 'Core API Automation Suite');

  // Generated code strings
  const collectionSpecCode = collection 
    ? generatePlaywrightSpecFromCollection(collection, activeEnvironment)
    : '// No collection loaded';

  const flowSpecCode = flow 
    ? generatePlaywrightSpecFromFlow(flow, activeEnvironment)
    : '// No flow loaded';

  const configCode = generatePlaywrightConfigTs(activeEnvironment?.baseUrl || 'http://localhost:3000');
  const packageJsonCode = generatePlaywrightPackageJson(targetName);
  const fixturesCode = generatePlaywrightFixturesFile();
  const zodSchemaCode = generatePlaywrightZodSchemaSpec(targetName);
  const githubActionsCode = generatePlaywrightGitHubActionsYaml(targetName);
  const azureDevOpsCode = generatePlaywrightAzureDevOpsYaml(targetName);
  const cliCommandsCode = generatePlaywrightCliCommands(flow ? 'flow.spec.ts' : 'collection.spec.ts');

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Download entire Playwright test project as zip
  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      const target = flow || collection;
      if (!target) return;

      const blob = await downloadPlaywrightProjectZip(target, activeEnvironment, !!flow);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playwright-${target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-suite.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading Playwright project zip:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Run in-browser test execution simulation
  const handleRunPlaywrightSim = async () => {
    if (!collection && !flow) return;
    setIsRunning(true);
    setRunLogs([]);
    setRunStats(null);
    setSelectedLogIndex(null);

    const startTime = performance.now();

    if (collection) {
      const results: ApiRequestExecutionResult[] = [];
      const runRes = await runFullCollection(collection, activeEnvironment, (idx, res) => {
        results.push(res);
        setRunLogs([...results]);
      });

      const totalDuration = Math.round(performance.now() - startTime);
      setRunStats({
        total: runRes.totalRequests,
        passed: runRes.passedRequests,
        failed: runRes.failedRequests,
        durationMs: totalDuration
      });
    }

    setIsRunning(false);
  };

  // Get current active file code
  let currentFileCode = collectionSpecCode;
  let currentFileName = 'tests/api/api-suite.spec.ts';

  if (selectedFile === 'flow_spec') {
    currentFileCode = flowSpecCode;
    currentFileName = 'tests/api/api-flow.spec.ts';
  } else if (selectedFile === 'zod_schema') {
    currentFileCode = zodSchemaCode;
    currentFileName = 'tests/api/schema-validation.spec.ts';
  } else if (selectedFile === 'config') {
    currentFileCode = configCode;
    currentFileName = 'playwright.config.ts';
  } else if (selectedFile === 'fixtures') {
    currentFileCode = fixturesCode;
    currentFileName = 'fixtures/api-fixtures.ts';
  } else if (selectedFile === 'package_json') {
    currentFileCode = packageJsonCode;
    currentFileName = 'package.json';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
              <Boxes size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-[var(--text-primary)] truncate">
                  Playwright API Testing Studio
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                  @playwright/test
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  TypeScript Native
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                Target: <span className="font-semibold text-[var(--text-primary)]">{targetName}</span> • Base URL: <span className="font-mono text-blue-500">{activeEnvironment?.baseUrl || 'http://localhost:3000'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Download entire ready-to-run repository as .zip"
            >
              {isDownloading ? <RotateCw size={13} className="animate-spin" /> : <FolderDown size={14} />}
              <span>Download Project ZIP</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-2 bg-[var(--surface)] shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('spec')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'spec'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <FileCode size={14} />
              <span>Playwright Spec Code (.spec.ts)</span>
            </button>

            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'workspace'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Layers size={14} />
              <span>Project Structure & Config</span>
            </button>

            <button
              onClick={() => setActiveTab('runner')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'runner'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Play size={14} className="fill-current" />
              <span>Test Runner Simulator</span>
              {runStats && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  runStats.failed === 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {runStats.passed}/{runStats.total}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cicd')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'cicd'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <GitBranch size={14} />
              <span>CI/CD Pipelines (ADO & GitHub)</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <BookOpen size={14} />
              <span>Playwright API Guide</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] font-mono font-bold hidden md:inline">
              Playwright v1.50+ • APIRequestContext
            </span>
          </div>
        </div>

        {/* Modal Viewport Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: SPEC VIEWER */}
          {activeTab === 'spec' && (
            <div className="space-y-4">
              
              {/* File Selector Pills & Copy/Download */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border)]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {collection && (
                    <button
                      onClick={() => setSelectedFile('test_spec')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        selectedFile === 'test_spec'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                      }`}
                    >
                      tests/api/{collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.spec.ts
                    </button>
                  )}

                  {flow && (
                    <button
                      onClick={() => setSelectedFile('flow_spec')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        selectedFile === 'flow_spec'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                      }`}
                    >
                      tests/api/flow-journey.spec.ts
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedFile('zod_schema')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      selectedFile === 'zod_schema'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                    }`}
                  >
                    tests/api/schema-validation.spec.ts (Zod)
                  </button>

                  <button
                    onClick={() => setSelectedFile('fixtures')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      selectedFile === 'fixtures'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                    }`}
                  >
                    fixtures/api-fixtures.ts
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(currentFileCode, `file_${selectedFile}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
                  >
                    {copiedKey === `file_${selectedFile}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedKey === `file_${selectedFile}` ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>

              {/* Code Display */}
              <div className="relative">
                <div className="absolute top-3 right-3 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 pointer-events-none">
                  {currentFileName}
                </div>
                <pre className="p-4 sm:p-5 bg-slate-950 text-slate-100 font-mono text-xs rounded-2xl overflow-x-auto border border-slate-800 shadow-inner max-h-[550px] leading-relaxed">
                  <code>{currentFileCode}</code>
                </pre>
              </div>

            </div>
          )}

          {/* TAB 2: WORKSPACE STRUCTURE & CONFIG */}
          {activeTab === 'workspace' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* File Tree Explorer */}
                <div className="lg:col-span-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-500" />
                    <span>Playwright Project Tree</span>
                  </h4>

                  <div className="space-y-1 font-mono text-xs">
                    <div 
                      onClick={() => setSelectedFile('config')}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                        selectedFile === 'config' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-[var(--surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      <FileCode size={14} />
                      <span>playwright.config.ts</span>
                    </div>

                    <div 
                      onClick={() => setSelectedFile('package_json')}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                        selectedFile === 'package_json' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-[var(--surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      <FileCode size={14} />
                      <span>package.json</span>
                    </div>

                    <div 
                      onClick={() => setSelectedFile('fixtures')}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                        selectedFile === 'fixtures' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-[var(--surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      <FileCode size={14} />
                      <span>fixtures/api-fixtures.ts</span>
                    </div>

                    <div 
                      onClick={() => setSelectedFile('test_spec')}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                        selectedFile === 'test_spec' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-[var(--surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      <FileCode size={14} />
                      <span>tests/api/api-suite.spec.ts</span>
                    </div>

                    <div 
                      onClick={() => setSelectedFile('zod_schema')}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                        selectedFile === 'zod_schema' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-[var(--surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      <FileCode size={14} />
                      <span>tests/api/schema-validation.spec.ts</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border)]">
                    <button
                      onClick={handleDownloadZip}
                      className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <FolderDown size={14} />
                      <span>Download All Files (.zip)</span>
                    </button>
                  </div>
                </div>

                {/* File Content Preview */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {currentFileName}
                    </span>
                    <button
                      onClick={() => handleCopy(currentFileCode, 'ws_copy')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer"
                    >
                      {copiedKey === 'ws_copy' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-2xl overflow-x-auto border border-slate-800 max-h-[460px] leading-relaxed">
                    <code>{currentFileCode}</code>
                  </pre>
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: TEST RUNNER SIMULATOR */}
          {activeTab === 'runner' && (
            <div className="space-y-6">
              
              {/* Runner Action Banner */}
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold shadow-sm">
                    <Play size={18} className="fill-current" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-blue-950 dark:text-blue-100">
                      Playwright Live Test Execution Simulator
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Executes requests via Playwright APIRequestContext proxy, evaluating assertions & response times in real-time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunPlaywrightSim}
                    disabled={isRunning}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isRunning ? <RotateCw size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
                    <span>{isRunning ? 'Running Tests...' : 'Execute Playwright Suite'}</span>
                  </button>
                </div>
              </div>

              {/* Stats & Results */}
              {runStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-secondary)]">Suite Status</div>
                    <div className={`text-base font-black mt-0.5 ${
                      runStats.failed === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {runStats.failed === 0 ? 'ALL PASSED' : `${runStats.failed} FAILED`}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-secondary)]">Tests Executed</div>
                    <div className="text-base font-black text-[var(--text-primary)] mt-0.5">
                      {runStats.passed} / {runStats.total} Passed
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-secondary)]">Total Elapsed</div>
                    <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                      {runStats.durationMs} ms
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-secondary)]">Success Rate</div>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {Math.round((runStats.passed / Math.max(1, runStats.total)) * 100)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Step Logs / Inspector */}
              {runLogs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Test List */}
                  <div className="lg:col-span-6 space-y-2.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                      Executed Playwright Test Cases ({runLogs.length})
                    </h4>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {runLogs.map((log, idx) => {
                        const isSelected = selectedLogIndex === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedLogIndex(idx)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-500/10 border-blue-500 shadow-xs'
                                : 'bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {log.status === 'passed' ? (
                                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                                ) : (
                                  <XCircle size={15} className="text-red-500 shrink-0" />
                                )}
                                <span className="font-bold text-xs text-[var(--text-primary)] truncate">
                                  {log.requestName}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                                <span className={`px-2 py-0.5 rounded font-bold ${
                                  log.httpStatus && log.httpStatus < 400 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                                }`}>
                                  {log.httpStatus || 200}
                                </span>
                                <span className="text-[var(--text-muted)]">{log.durationMs}ms</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Test Trace & Response Inspector */}
                  <div className="lg:col-span-6 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Eye size={14} className="text-blue-500" />
                      <span>Playwright Step Inspector & Assertions</span>
                    </h4>

                    {selectedLogIndex !== null && runLogs[selectedLogIndex] ? (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Request Target</div>
                          <div className="font-bold text-[var(--text-primary)] break-all">
                            {runLogs[selectedLogIndex].method} {runLogs[selectedLogIndex].url}
                          </div>
                        </div>

                        {/* Assertion Results */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Expectation Results</div>
                          {(runLogs[selectedLogIndex].assertionResults || []).map((as, aIdx) => (
                            <div key={aIdx} className="p-2 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2 text-[11px]">
                              {as.passed ? <Check size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-red-500" />}
                              <span className="text-[var(--text-primary)] font-sans">{as.description}</span>
                            </div>
                          ))}
                        </div>

                        {/* Response Body */}
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Response JSON Payload</div>
                          <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-200 text-[11px] max-h-48 overflow-y-auto border border-slate-800">
                            {JSON.stringify(runLogs[selectedLogIndex].responseBody, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 text-xs text-[var(--text-muted)]">
                        Select an executed test from the left panel to inspect its Playwright assertions, payload, and headers.
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <Cpu size={32} className="mx-auto text-[var(--text-muted)]" />
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">Ready to Execute Tests</h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Click "Execute Playwright Suite" to trigger parallel test execution in the browser.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: CI/CD PIPELINES */}
          {activeTab === 'cicd' && (
            <div className="space-y-6">
              
              {/* GitHub Actions Workflow */}
              <div className="space-y-3 bg-[var(--bg-subtle)] p-5 rounded-2xl border border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch size={16} className="text-blue-500" />
                    <h4 className="text-xs font-extrabold text-[var(--text-primary)]">
                      GitHub Actions Workflow: .github/workflows/playwright-api.yml
                    </h4>
                  </div>

                  <button
                    onClick={() => handleCopy(githubActionsCode, 'gh_code')}
                    className="px-3 py-1 text-xs rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-bold text-[var(--text-primary)] cursor-pointer"
                  >
                    {copiedKey === 'gh_code' ? 'Copied' : 'Copy Workflow YAML'}
                  </button>
                </div>

                <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 max-h-60 leading-relaxed">
                  <code>{githubActionsCode}</code>
                </pre>
              </div>

              {/* Azure DevOps Pipeline */}
              <div className="space-y-3 bg-[var(--bg-subtle)] p-5 rounded-2xl border border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-blue-500" />
                    <h4 className="text-xs font-extrabold text-[var(--text-primary)]">
                      Azure DevOps Pipeline: azure-pipelines.yml
                    </h4>
                  </div>

                  <button
                    onClick={() => handleCopy(azureDevOpsCode, 'ado_code')}
                    className="px-3 py-1 text-xs rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-bold text-[var(--text-primary)] cursor-pointer"
                  >
                    {copiedKey === 'ado_code' ? 'Copied' : 'Copy Pipeline YAML'}
                  </button>
                </div>

                <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 max-h-60 leading-relaxed">
                  <code>{azureDevOpsCode}</code>
                </pre>
              </div>

            </div>
          )}

          {/* TAB 5: PLAYWRIGHT API ARCHITECTURE GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-6">
              
              {/* Architecture Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    1
                  </div>
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">
                    Native APIRequestContext Fixture
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Playwright provides a lightweight, browser-independent HTTP client (`APIRequestContext`). It supports `request.get()`, `request.post()`, `request.put()`, and automatically maintains session cookies and headers without overhead.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    2
                  </div>
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">
                    Runtime Schema Contracts with Zod
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Combine `@playwright/test` with `zod` for strict API contract validation. Validate object structures, optional fields, UUIDs, and email types with `UserSchema.safeParse(json)`.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                    3
                  </div>
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">
                    Serialized Chained Flow Journeys
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Use `test.describe.serial()` to run sequential user journeys where Step 1 logs in and extracts `authToken`, Step 2 creates a resource, and Step 3 queries that entity by ID.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    4
                  </div>
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">
                    HTML Extra & JUnit Reporting
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Playwright generates interactive HTML reports (`npx playwright show-report`) and standard JUnit XML files natively consumed by Azure DevOps (`PublishTestResults@2`) and GitHub Actions.
                  </p>
                </div>

              </div>

              {/* CLI Cheatsheet */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-blue-400 flex items-center gap-1.5">
                    <Terminal size={14} />
                    <span>Playwright CLI Cheatsheet</span>
                  </h4>
                  <button
                    onClick={() => handleCopy(cliCommandsCode, 'cli_copy')}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer"
                  >
                    {copiedKey === 'cli_copy' ? 'Copied' : 'Copy Commands'}
                  </button>
                </div>

                <pre className="font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
                  <code>{cliCommandsCode}</code>
                </pre>
              </div>

            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <ShieldCheck size={14} className="text-blue-500" />
            <span>Ready for CI/CD Quality Gates & Local Developer Execution</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <Download size={13} />
              <span>Export Playwright Project (.zip)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
