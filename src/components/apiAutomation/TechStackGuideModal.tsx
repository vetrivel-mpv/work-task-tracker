import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Terminal, 
  CheckCircle2, 
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
  Code,
  Boxes
} from 'lucide-react';
import { generateAzureDevOpsPipelineYaml, generateGitHubActionsWorkflowYaml, generateNewmanCliCommand } from '../../utils/apiAutomationEngine';
import { generateBrunoCliCommand, generateBrunoAzureDevOpsYaml } from '../../utils/brunoEngine';
import { 
  generatePlaywrightSpecFromCollection, 
  generatePlaywrightConfigTs, 
  generatePlaywrightCliCommands, 
  generatePlaywrightAzureDevOpsYaml 
} from '../../utils/playwrightApiEngine';
import { ApiAutomationCollection } from '../../types/apiAutomation';

interface TechStackGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleCollection?: ApiAutomationCollection;
}

export const TechStackGuideModal: React.FC<TechStackGuideModalProps> = ({
  isOpen,
  onClose,
  sampleCollection
}) => {
  const [activeTab, setActiveTab] = useState<'recommendation' | 'playwright_guide' | 'bruno_guide' | 'comparison' | 'azure_devops' | 'github_actions' | 'newman_cli'>('playwright_guide');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const defaultCollection: ApiAutomationCollection = sampleCollection || {
    id: 'demo-col',
    name: 'ACM Core Delivery API Suite',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requests: []
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const techStacks = [
    {
      name: 'Playwright API Testing (@playwright/test)',
      category: 'Modern TypeScript SDET Framework',
      badge: 'Recommended for Modern TypeScript & Unified Suites',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      rating: '5 / 5',
      pros: [
        'Blazing fast parallel execution in native TypeScript / JavaScript via APIRequestContext',
        'Built-in request context, session cookie persistence, and auth state reuse across steps',
        'Unifies UI and API test automation under a single runner, trace viewer, and HTML reporter',
        'Full npm ecosystem access: Zod schema contract validation, Lodash, Faker, Crypto'
      ],
      cons: [
        'Requires writing TypeScript/JavaScript code files instead of GUI collection JSON'
      ],
      idealFor: 'Software Development Engineers in Test (SDETs) wanting full code control, schema validation, and parallel speed.'
    },
    {
      name: 'Bruno CLI (@usebruno/cli)',
      category: 'Open Source / Git-Friendly API Testing',
      badge: 'Recommended for Git-Versioned API Suites & Flows',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      rating: '5 / 5',
      pros: [
        'Plaintext .bru DSL files stored directly in Git repositories without proprietary cloud locks',
        'Direct support for pre-request / post-response JavaScript scripting via bru.setVar()',
        'Multi-step chained API Flows with dynamic variable propagation and assertions',
        'Zero external telemetry and 100% offline desktop + CLI execution (@usebruno/cli)',
        'Seamless export and import between Northstar Portal and Bruno workspaces'
      ],
      cons: [
        'Requires npm @usebruno/cli package in CI agent pipelines'
      ],
      idealFor: 'Engineering teams demanding 100% offline Git-versioned collections, fast PR test gates, and chained test journeys.'
    },
    {
      name: 'Newman (Postman CLI Engine)',
      category: 'Industry Standard for Collections',
      badge: 'Recommended for Postman Collections',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      rating: '5 / 5',
      pros: [
        'Direct 1:1 compatibility with Postman Collections & Environments',
        'Rich HTML and JUnit XML reporters (newman-reporter-htmlextra)',
        'Native Azure DevOps tasks (NewmanPostman@4) and GitHub Actions',
        'Variable chaining, pre-request scripts, and test sandbox scripts',
        'Zero setup needed for QA teams already using Postman'
      ],
      cons: [
        'JavaScript-only sandbox; cannot import arbitrary external npm packages in pre-scripts'
      ],
      idealFor: 'Teams with existing Postman collections who want automated CI/CD gating with zero migration friction.'
    },
    {
      name: 'k6 / Artillery',
      category: 'Performance & Load Automation',
      badge: 'Best for API Load & Stress Gates',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      rating: '4.5 / 5',
      pros: [
        'Converts functional API collections into high-concurrency load tests',
        'Sub-millisecond latency distribution metrics (p95, p99) and threshold gates'
      ],
      cons: [
        'Focused primarily on load/performance rather than complex business assertion workflows'
      ],
      idealFor: 'Validating SLA latencies under concurrent user load.'
    }
  ];

  const playwrightSpecSample = generatePlaywrightSpecFromCollection(defaultCollection);
  const playwrightConfigSample = generatePlaywrightConfigTs();
  const playwrightCli = generatePlaywrightCliCommands();
  const playwrightAdoYaml = generatePlaywrightAzureDevOpsYaml(defaultCollection.name);
  const brunoCli = generateBrunoCliCommand(defaultCollection.name, 'staging');
  const brunoAdoYaml = generateBrunoAzureDevOpsYaml(defaultCollection);
  const newmanCommand = generateNewmanCliCommand(defaultCollection.name);
  const azureYaml = generateAzureDevOpsPipelineYaml(defaultCollection);
  const githubYaml = generateGitHubActionsWorkflowYaml(defaultCollection);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Boxes size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                API Automation Architecture: @playwright/test & Framework Guide
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Production patterns for Playwright API testing, Bruno DSL, and CI/CD quality gates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 overflow-x-auto shrink-0 py-2">
          <button
            onClick={() => setActiveTab('playwright_guide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'playwright_guide'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Boxes size={13} />
            <span>Playwright API Testing Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('recommendation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'recommendation'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Sparkles size={13} />
            <span>Architecture Strategy</span>
          </button>
          <button
            onClick={() => setActiveTab('bruno_guide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'bruno_guide'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Zap size={13} />
            <span>Bruno CLI & CI/CD</span>
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'comparison'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Layers size={13} />
            <span>Framework Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('azure_devops')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'azure_devops'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <GitBranch size={13} />
            <span>Azure DevOps YAML</span>
          </button>
          <button
            onClick={() => setActiveTab('github_actions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'github_actions'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <FileCode size={13} />
            <span>GitHub Actions YAML</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-[var(--text-primary)]">
          
          {/* TAB: PLAYWRIGHT API TESTING */}
          {activeTab === 'playwright_guide' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/25 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-extrabold text-sm uppercase tracking-wider">
                  <Boxes size={16} />
                  <span>Playwright API Testing (@playwright/test)</span>
                </div>
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  Native TypeScript API Testing with High Performance & Schema Validation
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Playwright provides an isolated, lightweight <code className="font-mono bg-blue-500/20 px-1 py-0.5 rounded text-blue-600 dark:text-blue-300">APIRequestContext</code> that does not launch a browser window. It executes HTTP calls concurrently at maximum network speed, integrates seamless assertion matchers (<code className="font-mono text-blue-500">expect(response.status()).toBe(200)</code>), handles auth caching, and produces beautiful HTML & JUnit trace reports.
                </p>
              </div>

              {/* Sample Code Spec */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    tests/api/collection.spec.ts
                  </span>
                  <button
                    onClick={() => handleCopy(playwrightSpecSample, 'pw_spec')}
                    className="px-2.5 py-1 text-xs rounded bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-bold cursor-pointer"
                  >
                    {copiedKey === 'pw_spec' ? 'Copied' : 'Copy Spec'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 max-h-56 leading-relaxed">
                  <code>{playwrightSpecSample}</code>
                </pre>
              </div>

              {/* Playwright Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    playwright.config.ts (API Configuration)
                  </span>
                  <button
                    onClick={() => handleCopy(playwrightConfigSample, 'pw_config')}
                    className="px-2.5 py-1 text-xs rounded bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-bold cursor-pointer"
                  >
                    {copiedKey === 'pw_config' ? 'Copied' : 'Copy Config'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 max-h-48 leading-relaxed">
                  <code>{playwrightConfigSample}</code>
                </pre>
              </div>

              {/* Azure DevOps for Playwright */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    Azure DevOps Quality Gate: azure-pipelines.yml
                  </span>
                  <button
                    onClick={() => handleCopy(playwrightAdoYaml, 'pw_ado')}
                    className="px-2.5 py-1 text-xs rounded bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-bold cursor-pointer"
                  >
                    {copiedKey === 'pw_ado' ? 'Copied' : 'Copy ADO YAML'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 max-h-48 leading-relaxed">
                  <code>{playwrightAdoYaml}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'recommendation' && (
            <div className="space-y-6">
              {/* Executive Recommendation Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--primary-light)]/60 to-[var(--surface)] border border-[var(--primary)]/30 space-y-4">
                <div className="flex items-center gap-2 text-[var(--primary)] font-extrabold text-sm uppercase tracking-wider">
                  <Zap size={16} />
                  <span>The Recommended Industry Architecture</span>
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)] leading-snug">
                  Hybrid Portal Trigger + Newman (Postman CLI) & Playwright Test in CI/CD
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  For automated API collection validation, the gold standard used by world-class engineering organizations combines:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                      <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-[10px]">1</div>
                      <span>In-Portal Live Trigger</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                      QA engineers and release leads trigger and debug collections directly from this portal with real-time assertion feedback and variable chaining.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                      <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[10px]">2</div>
                      <span>Newman CLI Engine</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                      Executes Postman collection JSON files headless in automated build pipelines, publishing JUnit XML test results and rich HTML reports.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                      <div className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-[10px]">3</div>
                      <span>CI/CD Quality Gates</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                      Azure DevOps pipelines or GitHub Actions automatically gate PR merges and deployment stages based on pass rates (e.g. 100% smoke pass).
                    </p>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Workflow Blueprint */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                  End-to-End Automation Workflow Blueprint
                </h4>
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)] flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Step 1: Define & Structure Collections
                      </div>
                      <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                        Create suites with method, endpoints, headers, auth tokens, JSON payloads, assertions (status code, latency, json path), and variable extractors to pass session tokens from login to subsequent endpoints.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)] flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Step 2: Live Validation & One-Click Trigger from Portal
                      </div>
                      <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                        Run full test suites across Development, Staging, and Production environments directly within this portal. Inspect response headers, payloads, and assertion diffs in real time.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)] flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Step 3: Export or Trigger via CI/CD Webhooks
                      </div>
                      <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                        Export as standard Postman collection JSON or trigger executions remotely via webhook token from Azure DevOps, GitHub Actions, or scheduled cron jobs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bruno_guide' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-900/20 via-[var(--surface)] to-[var(--surface)] border border-purple-500/30 space-y-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold text-sm uppercase tracking-wider">
                  <Zap size={16} />
                  <span>Bruno API Automation Architecture</span>
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)] leading-snug">
                  Git-Friendly Plaintext .bru Files, Step Chaining & @usebruno/cli
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Bruno is an open-source, Git-native API testing tool. Rather than storing collections in bulky, conflict-prone JSON blobs, Bruno stores each API request as a readable <code className="px-1.5 py-0.5 rounded bg-purple-500/10 font-mono text-purple-600 dark:text-purple-400">.bru</code> text file in your Git repository.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                      <Terminal size={14} className="text-purple-600 dark:text-purple-400" />
                      <span>1. Bruno CLI Execution</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Run test collections and flows headless in terminal or Docker with <code className="font-mono">npx @usebruno/cli run</code>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black text-[var(--text-primary)]">
                      <Code size={14} className="text-purple-600 dark:text-purple-400" />
                      <span>2. Chained Flow Variables</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Propagate auth tokens & entity IDs using <code className="font-mono text-purple-600 dark:text-purple-400">bru.setVar('token', res.body.token)</code>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bruno CLI Command Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Terminal size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Bruno CLI Command (@usebruno/cli)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(brunoCli, 'bruno_cli')}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 cursor-pointer"
                  >
                    {copiedKey === 'bruno_cli' ? <Check size={12} className="inline mr-1" /> : <Copy size={12} className="inline mr-1" />}
                    <span>{copiedKey === 'bruno_cli' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                  {brunoCli}
                </pre>
              </div>

              {/* Bruno Azure DevOps Pipeline Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <GitBranch size={14} className="text-blue-500" />
                    <span>Bruno in Azure DevOps Pipeline (azure-pipelines-bruno.yml)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(brunoAdoYaml, 'bruno_ado')}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 cursor-pointer"
                  >
                    {copiedKey === 'bruno_ado' ? <Check size={12} className="inline mr-1" /> : <Copy size={12} className="inline mr-1" />}
                    <span>{copiedKey === 'bruno_ado' ? 'Copied' : 'Copy Azure YAML'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto max-h-56 border border-slate-800">
                  {brunoAdoYaml}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Detailed side-by-side comparison of the top API automation tech stacks:
              </p>
              <div className="space-y-4">
                {techStacks.map((stack) => (
                  <div key={stack.name} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-sm text-[var(--text-primary)]">{stack.name}</span>
                        <span className="text-[10.5px] text-[var(--text-muted)] font-medium">({stack.category})</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${stack.badgeColor}`}>
                        {stack.badge}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] mb-1">Strengths:</div>
                        <ul className="space-y-1">
                          {stack.pros.map((p, idx) => (
                            <li key={idx} className="text-[11.5px] text-[var(--text-secondary)] flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold">•</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="font-bold text-amber-600 dark:text-amber-400 text-[11px] mb-1">Considerations:</div>
                        <ul className="space-y-1">
                          {stack.cons.map((c, idx) => (
                            <li key={idx} className="text-[11.5px] text-[var(--text-muted)] flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                      <strong className="text-[var(--text-primary)]">Ideal for:</strong> {stack.idealFor}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'azure_devops' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Azure DevOps Pipeline Definition (azure-pipelines.yml)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Executes Newman collection runner with JUnit test reporting on every PR and scheduled nightly smoke run
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(azureYaml, 'azure')}
                  className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer"
                >
                  {copiedKey === 'azure' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'azure' ? 'Copied!' : 'Copy YAML'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11.5px] leading-relaxed overflow-x-auto border border-slate-800 shadow-inner">
                {azureYaml}
              </pre>
            </div>
          )}

          {activeTab === 'github_actions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    GitHub Actions Workflow (.github/workflows/api-automation.yml)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Automated quality gates on push, pull requests, and scheduled cron triggers
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(githubYaml, 'github')}
                  className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer"
                >
                  {copiedKey === 'github' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'github' ? 'Copied!' : 'Copy Workflow'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11.5px] leading-relaxed overflow-x-auto border border-slate-800 shadow-inner">
                {githubYaml}
              </pre>
            </div>
          )}

          {activeTab === 'newman_cli' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Newman CLI Command (Terminal / Script)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Run collection locally or in Docker container with multi-format reporters
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(newmanCommand, 'newman')}
                  className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer"
                >
                  {copiedKey === 'newman' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'newman' ? 'Copied!' : 'Copy Command'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11.5px] leading-relaxed overflow-x-auto border border-slate-800 shadow-inner">
                {newmanCommand}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-between shrink-0">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Live collection runs can be triggered directly from the portal's Automation Hub.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
