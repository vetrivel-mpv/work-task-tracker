import React, { useState, useMemo } from 'react';
import { 
  Cpu, 
  Layers, 
  Zap, 
  Terminal, 
  Copy, 
  Check, 
  Play, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Code2, 
  SlidersHorizontal, 
  TrendingUp, 
  Sparkles, 
  Boxes, 
  GitBranch, 
  ShieldCheck, 
  Server,
  DollarSign,
  Flame,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  LineChart,
  Line
} from 'recharts';

interface QaTechStackSimulatorProps {
  totalTestCases?: number;
  automatedCount?: number;
  releaseName?: string;
}

export const QaTechStackSimulator: React.FC<QaTechStackSimulatorProps> = ({
  totalTestCases = 85,
  automatedCount = 64,
  releaseName = 'D5-R2609'
}) => {
  // Simulator Controls
  const [selectedFramework, setSelectedFramework] = useState<'playwright' | 'bruno' | 'newman' | 'vitest'>('playwright');
  const [testCount, setTestCount] = useState<number>(totalTestCases || 120);
  const [workersCount, setWorkersCount] = useState<number>(4);
  const [environmentProfile, setEnvironmentProfile] = useState<'mock' | 'staging' | 'distributed'>('staging');
  const [activeCodeTab, setActiveCodeTab] = useState<'playwright_config' | 'azure_devops_yaml' | 'github_actions_yaml' | 'bruno_flow' | 'quality_gate_sla'>('playwright_config');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Modern Framework Profiles
  const frameworks = [
    {
      id: 'playwright',
      name: 'Playwright Test v1.44+',
      tagline: 'Native TypeScript SDET Engine',
      category: 'Unified UI + API',
      badge: 'Gold Standard for Modern SDET',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      baseDurationPerTestSec: 1.8,
      overheadSec: 6.0,
      memoryPerWorkerMb: 180,
      flakinessRisk: '0.4% (Built-in Web-First Retries)',
      features: [
        'Multi-worker parallel sharding (--workers=4, fullyParallel: true)',
        'Built-in APIRequestContext for sub-second REST/GraphQL contract tests',
        'Auto-retry, trace viewer, network HAR replay, and video recording',
        'Native TypeScript with strict Zod schema payload validation'
      ]
    },
    {
      id: 'bruno',
      name: 'Bruno CLI v1.34+',
      tagline: 'Git-Versioned API Journeys',
      category: 'API Automation',
      badge: 'Best for 100% Offline Git Repos',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      baseDurationPerTestSec: 0.9,
      overheadSec: 3.0,
      memoryPerWorkerMb: 90,
      flakinessRisk: '0.2% (Deterministic HTTP)',
      features: [
        'Declarative plaintext .bru DSL committed directly to Git',
        'Dynamic JavaScript variable chaining with bru.setVar() and assertions',
        'Zero cloud dependency, 100% telemetry-free offline execution',
        'Lightweight @usebruno/cli runner for sub-minute PR quality gates'
      ]
    },
    {
      id: 'newman',
      name: 'Newman (Postman CLI v2.1)',
      tagline: 'Industry Collection Runner',
      category: 'Postman Collections',
      badge: 'Standard for Postman QA Suites',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      baseDurationPerTestSec: 1.2,
      overheadSec: 4.5,
      memoryPerWorkerMb: 120,
      flakinessRisk: '0.6% (Sandbox dependent)',
      features: [
        'Direct 1:1 execution of Postman Collections v2.1 & Environments',
        'Rich HTML and JUnit XML test reporters (newman-reporter-htmlextra)',
        'Azure DevOps native tasks and GitHub Actions runner support',
        'Environment variable interpolation and pre-request scripting'
      ]
    },
    {
      id: 'vitest',
      name: 'Vitest + Zod Contract Suite',
      tagline: 'Sub-Second In-Memory Testing',
      category: 'Contract & Unit',
      badge: 'Blazing Fast In-Memory Gating',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      baseDurationPerTestSec: 0.25,
      overheadSec: 1.5,
      memoryPerWorkerMb: 65,
      flakinessRisk: '0.05% (In-Memory Isolation)',
      features: [
        'Instant TypeScript compilation with Vite transform pipeline',
        'Strict schema drift verification against OpenAPI / JSON schemas',
        'Instant watch mode and high-concurrency Node.js worker pools',
        'Ideal for shift-left pre-commit & pre-push local developer gates'
      ]
    }
  ];

  const currentFramework = frameworks.find(f => f.id === selectedFramework) || frameworks[0];

  // Environment multiplier
  const envMultiplier = useMemo(() => {
    switch (environmentProfile) {
      case 'mock': return 0.65;
      case 'staging': return 1.0;
      case 'distributed': return 1.45;
      default: return 1.0;
    }
  }, [environmentProfile]);

  // Simulation Calculations
  const simulation = useMemo(() => {
    const rawSingleWorkerSeconds = (testCount * currentFramework.baseDurationPerTestSec * envMultiplier) + currentFramework.overheadSec;
    const parallelSeconds = (rawSingleWorkerSeconds / workersCount) + (currentFramework.overheadSec * 0.4);
    
    const singleWorkerMins = (rawSingleWorkerSeconds / 60).toFixed(1);
    const parallelMins = (parallelSeconds / 60).toFixed(1);
    const speedup = (rawSingleWorkerSeconds / parallelSeconds).toFixed(1);
    const timeSavedMins = Math.max(0, (rawSingleWorkerSeconds - parallelSeconds) / 60).toFixed(1);

    // Monthly cost calculation based on 25 PR builds/day, 22 work days, $0.008/CI minute
    const monthlyBuilds = 25 * 22;
    const monthlySavedMinutes = Number(timeSavedMins) * monthlyBuilds;
    const monthlyCostSaved = (monthlySavedMinutes * 0.008).toFixed(0);

    const throughput = (testCount / Math.max(1, parallelSeconds)).toFixed(1);

    return {
      rawSingleWorkerSeconds,
      parallelSeconds,
      singleWorkerMins,
      parallelMins,
      speedup,
      timeSavedMins,
      monthlyCostSaved,
      throughput
    };
  }, [testCount, workersCount, currentFramework, envMultiplier]);

  // Chart data comparing workers scaling
  const workerScalingData = [1, 2, 4, 8, 16].map(w => {
    const raw = (testCount * currentFramework.baseDurationPerTestSec * envMultiplier) + currentFramework.overheadSec;
    const duration = ((raw / w) + (currentFramework.overheadSec * 0.4)) / 60;
    return {
      workers: `${w}x Worker${w > 1 ? 's' : ''}`,
      durationMins: Number(duration.toFixed(1)),
      isSelected: w === workersCount
    };
  });

  // Code Templates
  const codeSnippets = {
    playwright_config: `// playwright.config.ts - Modern High-Velocity SDET Configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,                     // Run tests in parallel across files
  workers: process.env.CI ? ${workersCount} : undefined, // Dynamic CI worker sharding
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,         // Auto-retry flaky tests in CI
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'results/test-results.xml' }],
    ['list']
  ],

  use: {
    baseURL: process.env.STAGING_API_URL || 'https://staging.northstar.internal/api',
    trace: 'on-first-retry',               // Record full DOM & network trace on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'X-QA-Automation-Run': '${releaseName}'
    }
  },

  projects: [
    {
      name: 'API Contract & Integration',
      testMatch: /.*\\.api\\.spec\\.ts/,
      use: { headless: true }
    },
    {
      name: 'E2E Core Journeys (Chromium)',
      testMatch: /.*\\.e2e\\.spec\\.ts/,
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});`,

    azure_devops_yaml: `# azure-pipelines-qa-velocity.yml
# Sharded High-Speed QA Automation Pipeline for ${releaseName}
trigger:
  branches:
    include:
      - main
      - release/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  CI: 'true'
  RELEASE_NAME: '${releaseName}'

jobs:
  - job: ShardedPlaywrightRegression
    displayName: 'Playwright Sharded Regression Suite'
    strategy:
      matrix:
        Shard_1:
          SHARD_INDEX: 1
          SHARD_TOTAL: ${workersCount}
        Shard_2:
          SHARD_INDEX: 2
          SHARD_TOTAL: ${workersCount}
        Shard_3:
          SHARD_INDEX: 3
          SHARD_TOTAL: ${workersCount}
        Shard_4:
          SHARD_INDEX: 4
          SHARD_TOTAL: ${workersCount}
    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '20.x'
        displayName: 'Install Node.js 20'

      - script: npm ci
        displayName: 'Install Dependencies'

      - script: npx playwright install --with-deps chromium
        displayName: 'Install Playwright Browsers'

      - script: npx playwright test --shard=$(SHARD_INDEX)/$(SHARD_TOTAL) --reporter=junit,html
        displayName: 'Execute Shard $(SHARD_INDEX) of $(SHARD_TOTAL)'
        env:
          STAGING_API_URL: $(STAGING_API_URL)

      - task: PublishTestResults@2
        condition: always()
        inputs:
          testResultsFormat: 'JUnit'
          testResultsFiles: '**/test-results.xml'
          failTaskOnFailedTests: true
          testRunTitle: 'Playwright Shard $(SHARD_INDEX)'`,

    github_actions_yaml: `# .github/workflows/qa-velocity-gate.yml
name: QA Delivery Velocity & Quality Gate

on:
  pull_request:
    branches: [main, release/**]
  workflow_dispatch:

jobs:
  parallel-regression:
    name: Playwright Shard (\${{ matrix.shard }}/${workersCount})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [${Array.from({ length: workersCount }, (_, i) => i + 1).join(', ')}]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run Sharded Tests
        run: npx playwright test --shard=\${{ matrix.shard }}/${workersCount}
        env:
          CI: true

      - name: Upload Test Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-shard-\${{ matrix.shard }}
          path: playwright-report/
          retention-days: 14`,

    bruno_flow: `# run-bruno-qa-gate.sh
#!/usr/bin/env bash
# High-Speed Offline Bruno CLI Test Runner for ${releaseName}
set -euo pipefail

echo "⚡ Launching Bruno CLI QA Integration Suite..."

# 1. Install or verify Bruno CLI
if ! command -v bru &> /dev/null; then
    npm install -g @usebruno/cli
fi

# 2. Execute Staging Environment Collection
bru run ./bruno-collections/acm-core \\
    --env Staging \\
    --env-var RELEASE_TARGET="${releaseName}" \\
    --reporter-json ./results/bruno-report.json \\
    --reporter-junit ./results/bruno-junit.xml

# 3. Assert Zero Failures
echo "✅ Bruno CLI Suite Passed with 100% Contract Integrity!"`,

    quality_gate_sla: `// scripts/verify-quality-gate.ts
// Automated Release Go/No-Go Decision Gate Validator
import fs from 'fs';

interface QualityGateConfig {
  maxCriticalDefects: number; // Must be 0
  minAutomationPassRate: number; // >= 95.0%
  maxMttrDays: number; // <= 2.0 days
  maxEscapeRatePct: number; // <= 5.0%
}

const GATE_CRITERIA: QualityGateConfig = {
  maxCriticalDefects: 0,
  minAutomationPassRate: 95.0,
  maxMttrDays: 2.0,
  maxEscapeRatePct: 5.0
};

export function evaluateReleaseQuality(metrics: any) {
  const violations: string[] = [];

  if (metrics.criticalDefects > GATE_CRITERIA.maxCriticalDefects) {
    violations.push(\`[BLOCKER] Found \${metrics.criticalDefects} active Critical/S1 defects (Max allowed: 0)\`);
  }
  if (metrics.passRate < GATE_CRITERIA.minAutomationPassRate) {
    violations.push(\`[FAIL] Test pass rate is \${metrics.passRate}% (Threshold: >=\${GATE_CRITERIA.minAutomationPassRate}%)\`);
  }
  if (metrics.mttrDays > GATE_CRITERIA.maxMttrDays) {
    violations.push(\`[WARN] MTTR is \${metrics.mttrDays}d (Target: <=\${GATE_CRITERIA.maxMttrDays}d)\`);
  }

  const isApproved = violations.length === 0;
  console.log(isApproved ? '🟢 RELEASE GATE: APPROVED' : '🔴 RELEASE GATE: REJECTED');
  return { approved: isApproved, violations };
}`
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Cpu size={18} />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Latest QE Tech Stack & Parallel Velocity Simulator
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              SDET 2026 Ready
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
            Simulate multi-worker sharded test runs, CI execution durations, and copy enterprise pipeline configurations
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] flex items-center gap-1.5">
            <Flame size={13} className="text-amber-500" />
            <span>Target: {releaseName}</span>
          </div>
        </div>
      </div>

      {/* Modern Tech Stack Framework Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {frameworks.map((fw) => {
          const isSelected = selectedFramework === fw.id;
          return (
            <div
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id as any)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                isSelected 
                  ? 'border-blue-500 bg-blue-500/5 shadow-md ring-2 ring-blue-500/20' 
                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:shadow-xs'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                  <Check size={12} />
                </div>
              )}
              <div>
                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border mb-2 ${fw.badgeColor}`}>
                  {fw.category}
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{fw.name}</h3>
                <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">{fw.tagline}</p>
                <div className="mt-3 space-y-1">
                  <div className="text-[11px] text-[var(--text-secondary)] flex justify-between">
                    <span>Base Speed:</span>
                    <span className="font-bold text-[var(--text-primary)]">{fw.baseDurationPerTestSec}s / test</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] flex justify-between">
                    <span>Flakiness Risk:</span>
                    <span className="font-bold text-emerald-600">{fw.flakinessRisk}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                {fw.badge}
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator Interactive Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal size={14} className="text-[var(--primary)]" />
              <span>Simulation Controls</span>
            </h3>
            <span className="text-[11px] text-blue-600 font-semibold">{currentFramework.name}</span>
          </div>

          {/* Slider: Test Suite Size */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
              <span>Test Suite Scope:</span>
              <span className="text-blue-600 font-mono">{testCount} Tests</span>
            </div>
            <input 
              type="range"
              min="20"
              max="600"
              step="10"
              value={testCount}
              onChange={(e) => setTestCount(Number(e.target.value))}
              className="w-full h-2 bg-[var(--surface-hover)] rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>20 (Smoke)</span>
              <span>150 (Core API)</span>
              <span>600 (Full E2E)</span>
            </div>
          </div>

          {/* Slider: Parallel Workers / Shards */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
              <span>Parallel Workers / Shards:</span>
              <span className="text-indigo-600 font-mono font-black text-sm">{workersCount}x Workers</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 4, 8, 16].map(w => (
                <button
                  key={w}
                  onClick={() => setWorkersCount(w)}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    workersCount === w 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {w}x
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              Sharding distributes specs across independent parallel CI runner nodes
            </p>
          </div>

          {/* Environment Target Radio */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-primary)] block">Target Cluster Profile:</label>
            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
              <button
                onClick={() => setEnvironmentProfile('mock')}
                className={`p-2 rounded-lg border text-center transition-all ${
                  environmentProfile === 'mock' 
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold' 
                    : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border)]'
                }`}
              >
                In-Memory
              </button>
              <button
                onClick={() => setEnvironmentProfile('staging')}
                className={`p-2 rounded-lg border text-center transition-all ${
                  environmentProfile === 'staging' 
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 font-bold' 
                    : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border)]'
                }`}
              >
                Staging API
              </button>
              <button
                onClick={() => setEnvironmentProfile('distributed')}
                className={`p-2 rounded-lg border text-center transition-all ${
                  environmentProfile === 'distributed' 
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-bold' 
                    : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border)]'
                }`}
              >
                Multi-Region
              </button>
            </div>
          </div>
        </div>

        {/* Calculated Simulation Telemetry & Speedup */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Simulated CI Lead Time</span>
              <Clock size={16} className="text-indigo-500" />
            </div>
            
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {simulation.parallelMins}m
              </span>
              <span className="text-xs font-bold text-[var(--text-muted)]">
                (down from {simulation.singleWorkerMins}m sequential)
              </span>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={14} />
                  <span>Velocity Acceleration Factor:</span>
                </span>
                <span className="text-sm font-black">{simulation.speedup}x Faster</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                Saves {simulation.timeSavedMins} minutes per PR build on every commit.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
            <div className="p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Throughput</div>
              <div className="text-base font-black text-[var(--text-primary)] mt-0.5">{simulation.throughput} tests/sec</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Est. Monthly Savings</div>
              <div className="text-base font-black text-emerald-600 mt-0.5">${simulation.monthlyCostSaved} / mo</div>
            </div>
          </div>
        </div>

        {/* Workers Scaling Comparison Chart */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2">
              Execution Duration vs. Worker Shards (Minutes)
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerScalingData}>
                  <XAxis dataKey="workers" fontSize={10} stroke="var(--text-muted)" />
                  <YAxis fontSize={10} stroke="var(--text-muted)" allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '10px',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="durationMins" radius={[4, 4, 0, 0]}>
                    {workerScalingData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isSelected ? '#4F46E5' : 'var(--border-strong)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] text-center">
            Optimal balance: 4x–8x shards yields 90% of maximum parallel acceleration.
          </div>
        </div>
      </div>

      {/* Production Pipeline Blueprint Generator & Code Viewer */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-hover)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-indigo-500" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Production CI/CD Pipeline Blueprint & Config
            </h3>
          </div>

          {/* Code Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCodeTab('playwright_config')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeCodeTab === 'playwright_config' 
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              playwright.config.ts
            </button>
            <button
              onClick={() => setActiveCodeTab('azure_devops_yaml')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeCodeTab === 'azure_devops_yaml' 
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Azure DevOps Shards YAML
            </button>
            <button
              onClick={() => setActiveCodeTab('github_actions_yaml')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeCodeTab === 'github_actions_yaml' 
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              GitHub Actions Matrix
            </button>
            <button
              onClick={() => setActiveCodeTab('bruno_flow')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeCodeTab === 'bruno_flow' 
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Bruno CLI Runner
            </button>
            <button
              onClick={() => setActiveCodeTab('quality_gate_sla')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeCodeTab === 'quality_gate_sla' 
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Quality Gate SLA Script
            </button>
          </div>

          <button
            onClick={() => handleCopy(codeSnippets[activeCodeTab], activeCodeTab)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
          >
            {copiedKey === activeCodeTab ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedKey === activeCodeTab ? 'Copied to Clipboard!' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-96">
          <pre>{codeSnippets[activeCodeTab]}</pre>
        </div>
      </div>
    </div>
  );
};
