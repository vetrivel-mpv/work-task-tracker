import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  ShieldCheck, 
  GitPullRequest, 
  Terminal, 
  Activity, 
  Layers, 
  Sparkles, 
  FileText, 
  ChevronRight, 
  AlertTriangle,
  Play,
  Gauge,
  Workflow,
  Cpu,
  Target,
  Search,
  ExternalLink,
  Code2,
  Bug,
  Clock
} from 'lucide-react';

interface PlaybookSection {
  id: string;
  title: string;
  category: 'process' | 'standards' | 'tooling' | 'playwright_allure';
  icon: React.ReactNode;
  summary: string;
  badge?: string;
  content: {
    overview: string;
    keyPoints: string[];
    checklist?: string[];
    bestPractices?: string[];
    sampleSnippet?: {
      title: string;
      language: string;
      code: string;
    };
    toolsOrArtifacts?: { name: string; role: string; commandOrUrl?: string }[];
  };
}

const PLAYBOOK_SECTIONS: PlaybookSection[] = [
  {
    id: 'shift_left',
    title: 'Shift-Left & 3-Amigos Refinement',
    category: 'process',
    icon: <Workflow className="text-indigo-500" size={18} />,
    summary: 'Proactive quality engineering during requirements design and sprint refinement before code commit.',
    badge: 'Core Process',
    content: {
      overview: 'Quality begins during requirements elaboration, not after code completion. The 3-Amigos collaboration (Product Owner, Lead Developer, QA Engineer) ensures Acceptance Criteria are testable, edge cases are trapped, and test automation design begins in Sprint Planning.',
      keyPoints: [
        'Validate User Stories meet the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable).',
        'Frame acceptance criteria using BDD Given-When-Then syntax directly in Azure DevOps / Jira.',
        'Define explicit Definition of Ready (DoR) and Definition of Done (DoD) before stories move to Dev In Progress.',
        'Identify test data dependencies, mock services, and contract test requirements upfront.'
      ],
      checklist: [
        'User story has minimum 3 concrete Given-When-Then scenarios',
        'Negative and permission boundary conditions identified',
        'Performance & security non-functional requirements (NFRs) specified',
        'Target automated test tier assigned (Unit vs API vs UI E2E)'
      ],
      sampleSnippet: {
        title: 'Gherkin BDD Feature Specification',
        language: 'gherkin',
        code: `Feature: Release Scope Sign-off
  As a Delivery & QA Manager
  I want to verify zero S1/P1 release blocker defects
  So that the production deployment gate can be unlocked

  @critical @smoke @regression
  Scenario: Gate passes with zero blockers and >95% automated test pass rate
    Given the target release "D5-R2609" is in "Active QA"
    When the QA test suite execution finishes
    Then the automated test pass rate must be >= 95.0%
    And zero defects with severity "critical" and status "Active" must exist
    And the QA Sign-off report is automatically generated`
      }
    }
  },
  {
    id: 'test_pyramid',
    title: 'Test Automation Pyramid & Tiering',
    category: 'standards',
    icon: <Layers className="text-emerald-500" size={18} />,
    summary: 'Mathematical layer distribution ensuring fast feedback, high reliability, and low test maintenance cost.',
    badge: 'Architecture',
    content: {
      overview: 'Maintain a healthy 70-20-10 distribution across the testing pyramid. UI E2E tests are expensive to run and maintain; push assertions down to API and Unit layers wherever feasible.',
      keyPoints: [
        'Unit Layer (70%): Pure functions, business logic, component isolation. Execution time < 2 mins in CI.',
        'Integration & API Layer (20%): REST endpoints, schema validation, auth flow, DB repositories. Fast, robust, deterministic.',
        'End-to-End & UI Layer (10%): High-value user journey happy paths and multi-tier workflows using Playwright / Cypress.',
        'Zero Flakiness Policy: Quarantining and fixing tests with >1% flake rate immediately.'
      ],
      checklist: [
        'API tests cover all CRUD endpoints and error response codes (400, 401, 403, 404, 500)',
        'Contract tests (Pact) in place between frontend consumer and backend services',
        'E2E tests isolated with unique test tenant or database seed per run',
        'Nightly full regression runs decoupled from fast PR commit gates'
      ],
      toolsOrArtifacts: [
        { name: 'Playwright', role: 'Modern E2E Web & Mobile Browser Automation', commandOrUrl: 'npx playwright test --workers=4' },
        { name: 'Postman / Newman', role: 'API Contract & Smoke Test Orchestration', commandOrUrl: 'newman run collection.json -e env.json' },
        { name: 'k6 by Grafana', role: 'API Performance & Load Threshold Verification', commandOrUrl: 'k6 run --vus 50 --duration 5m load-test.js' }
      ]
    }
  },
  {
    id: 'playwright_allure_cicd',
    title: 'Playwright + Allure CI/CD Standards',
    category: 'playwright_allure',
    icon: <Terminal className="text-cyan-500" size={18} />,
    summary: 'Production-ready browser automation framework with Allure telemetry and Azure Pipelines / GitHub Actions.',
    badge: 'Automation Stack',
    content: {
      overview: 'Standardizing our automation engine on Playwright with TypeScript and Allure reporting. Every test run produces actionable step logs, auto-captured DOM traces on failure, network HAR recordings, and rich trend visualizations.',
      keyPoints: [
        'Page Object Model (POM) architecture with strong TypeScript typing and resilient web locators (role, test-id).',
        'Auto-retry mechanisms: 1 retry in CI, zero retries in local runs to isolate flaky network/DOM calls.',
        'Automated video/trace capture strictly on failure to preserve CI storage bandwidth.',
        'Allure step annotations (`allure.step`, `allure.severity`, `allure.epic`) for executive test traceability.'
      ],
      bestPractices: [
        'Prefer user-facing locators: getByRole(), getByText(), getByTestId() over brittle XPath/CSS.',
        'Use web assertions: await expect(locator).toBeVisible() with auto-waiting.',
        'Parallelize shard execution in CI across 4+ agents for sub-10 minute test cycles.',
        'Integrate Allure history trend reporting with Azure DevOps Build Summary.'
      ],
      sampleSnippet: {
        title: 'Playwright Page Object with Allure Step Instrumentation',
        language: 'typescript',
        code: `import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

test.describe('Release Gate Verification @smoke @releases', () => {
  test('Verify zero S1 release blocker defects before gate pass', async ({ page }) => {
    await allure.epic('Release Governance');
    await allure.feature('QA Analytics & Gates');
    await allure.severity('critical');
    
    await allure.step('1. Navigate to QA Analytics Dashboard', async () => {
      await page.goto('/qa_dashboard');
      await expect(page.getByRole('heading', { name: /QA Health & Defects Analytics/i })).toBeVisible();
    });

    await allure.step('2. Filter by Current Active Release', async () => {
      const releaseFilter = page.getByRole('combobox', { name: /Release/i });
      await releaseFilter.selectOption({ label: /D5-R2609/i });
    });

    await allure.step('3. Assert zero S1 Critical Active Defects in Matrix', async () => {
      const blockerBadge = page.getByTestId('kpi-critical-blockers');
      await expect(blockerBadge).toHaveText('0');
    });
  });
});`
      }
    }
  },
  {
    id: 'defect_triage_sla',
    title: 'Defect Triage & SLA Matrix (S1–S4 / P1–P4)',
    category: 'standards',
    icon: <AlertTriangle className="text-rose-500" size={18} />,
    summary: 'Standardized severity definitions, triage cadence, and resolution turnaround time SLAs.',
    badge: 'Governance',
    content: {
      overview: 'Defects must be classified by functional Severity (impact on system) and business Priority (urgency to resolve). Daily triage meetings align QA, Engineering Leads, and Product Managers on root cause analysis and resolution ownership.',
      keyPoints: [
        'S1 - Critical: System down, core transaction failed, data corruption, security breach. SLA: < 4 hours.',
        'S2 - High: Major feature broken with no feasible workaround. SLA: < 24 hours.',
        'S3 - Medium: Functional bug with viable workaround or non-critical path error. SLA: < 5 business days (within sprint).',
        'S4 - Low: Cosmetic, minor UX inconsistency, or trivial typo. SLA: Next minor backlog release.'
      ],
      checklist: [
        'Every defect includes: Environment, Build #, exact Steps to Reproduce, Expected vs Actual result, and screenshot/log',
        'Defects linked to parent User Story ID and ADO Work Item ID',
        'Root cause categorization logged upon closure (Code Defect, Requirement Gap, Data Issue, Environment Outage)',
        'Zero S1/S2 open bugs allowed for Staging-to-Production promote gates'
      ],
      toolsOrArtifacts: [
        { name: 'Azure DevOps Boards', role: 'Defect & Bug Tracking ALM', commandOrUrl: 'https://dev.azure.com/simetricwdh' },
        { name: 'Technical Debt Impact Matrix', role: '2D Visual Risk Density in Portal', commandOrUrl: 'Integrated in QA Analytics' }
      ]
    }
  },
  {
    id: 'release_quality_gates',
    title: 'Release Qualification & Sign-Off Criteria',
    category: 'process',
    icon: <ShieldCheck className="text-emerald-500" size={18} />,
    summary: 'Formal readiness gates required for promoting builds across Dev -> QA -> Staging -> Production.',
    badge: 'Audit Gate',
    content: {
      overview: 'To eliminate subjective release decisions, automated quality gates evaluate real-time telemetry from Azure DevOps, automated test execution results, and vulnerability scanners.',
      keyPoints: [
        'Gate 1 (Dev -> QA): 100% Unit test pass, PR peer review approval, zero high SonarQube static analysis vulnerabilities.',
        'Gate 2 (QA -> Staging): 100% Automated regression pass, all Sprint User Stories in "QA Passed", zero S1/S2 open bugs.',
        'Gate 3 (Staging -> Prod): Performance benchmark within SLA threshold, Staging sanity executed, Product Owner and QA Lead formal sign-off.'
      ],
      checklist: [
        'Automated E2E Playwright regression pass rate >= 95%',
        'Test execution coverage >= 80% across sprint acceptance criteria',
        'No active release blockers (S1/P1 = 0, S2/P2 = 0)',
        'Automated QA status report emailed to leadership stakeholders'
      ],
      toolsOrArtifacts: [
        { name: 'QA Executive Status Report', role: 'Email generator for stakeholders', commandOrUrl: 'Available via "QA Status Report" button' },
        { name: 'SonarQube Quality Gate', role: 'Static analysis and security gate', commandOrUrl: 'sonar-scanner -Dsonar.qualitygate.wait=true' }
      ]
    }
  }
];

export const QeProcessPlaybook: React.FC = () => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('shift_left');
  const [activeTab, setActiveTab] = useState<'all' | 'process' | 'standards' | 'playwright_allure'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredSections = PLAYBOOK_SECTIONS.filter(sec => {
    const matchesTab = activeTab === 'all' || sec.category === activeTab;
    const matchesQuery = 
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const activeSection = PLAYBOOK_SECTIONS.find(s => s.id === selectedSectionId) || PLAYBOOK_SECTIONS[0];

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
      {/* Header Banner */}
      <div className="p-5 border-b border-[var(--border)] bg-gradient-to-r from-[var(--surface-hover)] to-[var(--surface)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                QE Process & Standards Playbook
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Enterprise quality engineering operating model, automation conventions, SLA gates, and Playwright standards
              </p>
            </div>
          </div>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${activeTab === 'all' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            All Guides ({PLAYBOOK_SECTIONS.length})
          </button>
          <button
            onClick={() => setActiveTab('process')}
            className={`px-3 py-1 rounded-lg transition-colors ${activeTab === 'process' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            Process & Shift-Left
          </button>
          <button
            onClick={() => setActiveTab('standards')}
            className={`px-3 py-1 rounded-lg transition-colors ${activeTab === 'standards' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            Standards & SLAs
          </button>
          <button
            onClick={() => setActiveTab('playwright_allure')}
            className={`px-3 py-1 rounded-lg transition-colors ${activeTab === 'playwright_allure' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            Playwright / CI/CD
          </button>
        </div>
      </div>

      {/* Main Playbook Split View */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
        {/* Left List Navigation */}
        <div className="md:col-span-4 border-r border-[var(--border)] p-3 space-y-2 bg-[var(--surface)]">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search standards, BDD, SLAs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredSections.map(sec => {
              const isSelected = sec.id === selectedSectionId;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected 
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--text-primary)] shadow-xs' 
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{sec.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate">{sec.title}</span>
                      {sec.badge && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] shrink-0">
                          {sec.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {sec.summary}
                    </p>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 self-center ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail Content View */}
        <div className="md:col-span-8 p-6 bg-[var(--surface)] overflow-y-auto max-h-[580px]">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border)]">
                {activeSection.icon}
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">{activeSection.title}</h3>
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  Category: {activeSection.category.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Section Overview */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Process Summary</h4>
            <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--surface-hover)]/60 border border-[var(--border)] p-3.5 rounded-xl font-medium">
              {activeSection.content.overview}
            </p>
          </div>

          {/* Key Principles */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Core Principles & Rules</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeSection.content.keyPoints.map((pt, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Checklist if present */}
          {activeSection.content.checklist && (
            <div className="mb-6">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">QA Gate Verification Checklist</h4>
              <div className="space-y-2">
                {activeSection.content.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best Practices if present */}
          {activeSection.content.bestPractices && (
            <div className="mb-6">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Engineering Best Practices</h4>
              <div className="space-y-2">
                {activeSection.content.bestPractices.map((bp, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                    <Sparkles size={14} className="text-indigo-500 shrink-0" />
                    <span>{bp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code Snippet Example */}
          {activeSection.content.sampleSnippet && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {activeSection.content.sampleSnippet.title}
                </h4>
                <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase">
                  {activeSection.content.sampleSnippet.language}
                </span>
              </div>
              <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800 shadow-inner">
                <pre>{activeSection.content.sampleSnippet.code}</pre>
              </div>
            </div>
          )}

          {/* Tools & Ecosystem Integration */}
          {activeSection.content.toolsOrArtifacts && (
            <div>
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Tooling & Ecosystem Integrations</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeSection.content.toolsOrArtifacts.map((tool, i) => (
                  <div key={i} className="p-3 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{tool.name}</span>
                      <ExternalLink size={12} className="text-[var(--text-muted)]" />
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-1.5">{tool.role}</p>
                    {tool.commandOrUrl && (
                      <code className="text-[10px] block bg-[var(--surface)] text-[var(--primary)] px-2 py-1 rounded-md font-mono border border-[var(--border)] truncate">
                        {tool.commandOrUrl}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
