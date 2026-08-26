import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiRequestItem, 
  ApiTestFlow, 
  ApiFlowStep, 
  ApiFlowExecutionRun, 
  ApiFlowStepExecutionResult, 
  ApiAssertionResult,
  BrunoFileRepresentation,
  HttpMethod,
  ApiHeader,
  ApiParam,
  ApiAssertion,
  ApiVariableExtractor
} from '../types/apiAutomation';
import { generateId } from './date';
import { interpolateVariables, evaluateAssertion, extractVariablesFromResponse } from './apiAutomationEngine';

// ============================================================================
// BRUNO (.bru) DSL SERIALIZER & PARSER
// ============================================================================

/**
 * Generates standard Bruno (.bru) DSL file content from an ApiRequestItem
 */
export function generateBruFile(request: ApiRequestItem, seq: number = 1): string {
  const method = request.method.toLowerCase();
  const lines: string[] = [];

  // Meta block
  lines.push('meta {');
  lines.push(`  name: ${request.name}`);
  lines.push('  type: http');
  lines.push(`  seq: ${seq}`);
  lines.push('}');
  lines.push('');

  // Method block (e.g. get / post / put / delete)
  const bodyKeyword = request.bodyType === 'json' ? 'json' : request.bodyType === 'raw' ? 'text' : 'none';
  const authKeyword = request.auth?.type === 'bearer' ? 'bearer' : request.auth?.type === 'basic' ? 'basic' : request.auth?.type === 'apikey' ? 'apikey' : 'none';

  lines.push(`${method} {`);
  lines.push(`  url: ${request.url}`);
  lines.push(`  body: ${bodyKeyword}`);
  lines.push(`  auth: ${authKeyword}`);
  lines.push('}');
  lines.push('');

  // Query Params block
  const enabledParams = (request.params || []).filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    lines.push('params:query {');
    enabledParams.forEach(p => {
      lines.push(`  ${p.key}: ${p.value}`);
    });
    lines.push('}');
    lines.push('');
  }

  // Headers block
  const enabledHeaders = (request.headers || []).filter(h => h.enabled && h.key);
  if (enabledHeaders.length > 0) {
    lines.push('headers {');
    enabledHeaders.forEach(h => {
      lines.push(`  ${h.key}: ${h.value}`);
    });
    lines.push('}');
    lines.push('');
  }

  // Auth block
  if (request.auth?.type === 'bearer' && request.auth.bearerToken) {
    lines.push('auth:bearer {');
    lines.push(`  token: ${request.auth.bearerToken}`);
    lines.push('}');
    lines.push('');
  } else if (request.auth?.type === 'basic') {
    lines.push('auth:basic {');
    lines.push(`  username: ${request.auth.basicUsername || ''}`);
    lines.push(`  password: ${request.auth.basicPassword || ''}`);
    lines.push('}');
    lines.push('');
  }

  // Body block
  if (request.bodyType === 'json' && request.bodyContent) {
    lines.push('body:json {');
    // Indent body lines
    const formatted = request.bodyContent.split('\n').map(l => `  ${l}`).join('\n');
    lines.push(formatted);
    lines.push('}');
    lines.push('');
  }

  // Assertions block (Bruno syntax)
  if (request.assertions && request.assertions.length > 0) {
    lines.push('assert {');
    request.assertions.forEach(as => {
      if (!as.enabled) return;
      if (as.type === 'status_code') {
        const op = as.operator === 'equals' ? 'eq' : as.operator === 'not_equals' ? 'neq' : as.operator === 'less_than' ? 'lt' : 'gt';
        lines.push(`  res.status: ${op} ${as.expectedValue}`);
      } else if (as.type === 'response_time') {
        lines.push(`  res.responseTime: lte ${as.expectedValue}`);
      } else if (as.type === 'json_path_value' && as.target) {
        const op = as.operator === 'equals' ? 'eq' : as.operator === 'exists' ? 'isDefined' : as.operator === 'contains' ? 'contains' : 'eq';
        if (op === 'isDefined') {
          lines.push(`  res.body.${as.target}: isDefined`);
        } else {
          lines.push(`  res.body.${as.target}: ${op} ${as.expectedValue}`);
        }
      } else if (as.type === 'header_exists' && as.target) {
        lines.push(`  res.headers['${as.target.toLowerCase()}']: isDefined`);
      }
    });
    lines.push('}');
    lines.push('');
  }

  // Post-response Script block (Bruno variable extraction)
  const extractors = request.extractVariables || [];
  if (extractors.length > 0) {
    lines.push('script:post-response {');
    lines.push('  // Extracted variables for downstream Bruno flow chaining');
    extractors.forEach(ex => {
      if (!ex.enabled || !ex.variableName) return;
      if (ex.source === 'json_body') {
        lines.push(`  if (res.body && res.body.${ex.path} !== undefined) {`);
        lines.push(`    bru.setVar('${ex.variableName}', res.body.${ex.path});`);
        lines.push('  }');
      } else if (ex.source === 'header') {
        lines.push(`  if (res.headers['${ex.path.toLowerCase()}']) {`);
        lines.push(`    bru.setVar('${ex.variableName}', res.headers['${ex.path.toLowerCase()}']);`);
        lines.push('  }');
      } else if (ex.source === 'status_code') {
        lines.push(`  bru.setVar('${ex.variableName}', res.status);`);
      }
    });
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Parses Bruno (.bru) DSL text into a partial ApiRequestItem
 */
export function parseBruFile(bruContent: string): Partial<ApiRequestItem> {
  const req: Partial<ApiRequestItem> = {
    id: generateId('req_bru'),
    name: 'Imported Bruno Request',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    assertions: [],
    extractVariables: [],
    bodyType: 'none',
    bodyContent: '',
    enabled: true
  };

  if (!bruContent || typeof bruContent !== 'string') return req;

  // Extract meta block
  const metaMatch = bruContent.match(/meta\s*\{([\s\S]*?)\}/);
  if (metaMatch) {
    const metaBlock = metaMatch[1];
    const nameMatch = metaBlock.match(/name:\s*(.+)/);
    if (nameMatch) {
      req.name = nameMatch[1].trim();
    }
  }

  // Extract HTTP method & URL block e.g. get { url: ... }
  const methodMatch = bruContent.match(/(get|post|put|patch|delete|head|options)\s*\{([\s\S]*?)\}/i);
  if (methodMatch) {
    req.method = methodMatch[1].toUpperCase() as HttpMethod;
    const bodyText = methodMatch[2];
    const urlMatch = bodyText.match(/url:\s*(.+)/);
    if (urlMatch) {
      req.url = urlMatch[1].trim();
    }
  }

  // Extract headers block
  const headersMatch = bruContent.match(/headers\s*\{([\s\S]*?)\}/);
  if (headersMatch) {
    const headerLines = headersMatch[1].split('\n');
    const headers: ApiHeader[] = [];
    headerLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        headers.push({ key, value, enabled: true });
      }
    });
    req.headers = headers;
  }

  // Extract params:query block
  const paramsMatch = bruContent.match(/params:query\s*\{([\s\S]*?)\}/);
  if (paramsMatch) {
    const paramLines = paramsMatch[1].split('\n');
    const params: ApiParam[] = [];
    paramLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        params.push({ key, value, enabled: true });
      }
    });
    req.params = params;
  }

  // Extract auth:bearer block
  const bearerMatch = bruContent.match(/auth:bearer\s*\{([\s\S]*?)\}/);
  if (bearerMatch) {
    const tokenMatch = bearerMatch[1].match(/token:\s*(.+)/);
    if (tokenMatch) {
      req.auth = {
        type: 'bearer',
        bearerToken: tokenMatch[1].trim()
      };
    }
  }

  // Extract body:json block
  const jsonBodyMatch = bruContent.match(/body:json\s*\{([\s\S]*?)\}/);
  if (jsonBodyMatch) {
    req.bodyType = 'json';
    req.bodyContent = jsonBodyMatch[1].trim();
  }

  // Extract assert block
  const assertMatch = bruContent.match(/assert\s*\{([\s\S]*?)\}/);
  if (assertMatch) {
    const assertLines = assertMatch[1].split('\n');
    const assertions: ApiAssertion[] = [];

    assertLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

      if (trimmed.includes('res.status')) {
        const parts = trimmed.split(':');
        if (parts[1]) {
          const valParts = parts[1].trim().split(/\s+/);
          const op = valParts[0] === 'neq' ? 'not_equals' : valParts[0] === 'lt' ? 'less_than' : 'equals';
          const code = valParts[1] || '200';
          assertions.push({
            id: generateId('as_bru'),
            type: 'status_code',
            operator: op,
            expectedValue: code,
            description: `HTTP Status is ${code}`,
            enabled: true
          });
        }
      } else if (trimmed.includes('res.responseTime')) {
        const parts = trimmed.split(':');
        if (parts[1]) {
          const valParts = parts[1].trim().split(/\s+/);
          const ms = valParts[1] || '1500';
          assertions.push({
            id: generateId('as_bru'),
            type: 'response_time',
            operator: 'less_than',
            expectedValue: ms,
            description: `Response latency <= ${ms}ms`,
            enabled: true
          });
        }
      } else if (trimmed.includes('res.body.')) {
        const parts = trimmed.split(':');
        const pathPart = parts[0].replace('res.body.', '').trim();
        const valuePart = (parts[1] || '').trim();
        const valTokens = valuePart.split(/\s+/);
        const op = valTokens[0] === 'isDefined' ? 'exists' : valTokens[0] === 'contains' ? 'contains' : 'equals';
        const expected = valTokens[1] || '';

        assertions.push({
          id: generateId('as_bru'),
          type: 'json_path_value',
          target: pathPart,
          operator: op,
          expectedValue: expected,
          description: `Assert body ${pathPart} ${op} ${expected}`,
          enabled: true
        });
      }
    });

    if (assertions.length > 0) {
      req.assertions = assertions;
    }
  }

  // Extract post-response script (bru.setVar)
  const postScriptMatch = bruContent.match(/script:post-response\s*\{([\s\S]*?)\}/);
  if (postScriptMatch) {
    const scriptContent = postScriptMatch[1];
    const extractors: ApiVariableExtractor[] = [];
    const setVarRegex = /bru\.setVar\(\s*['"]([^'"]+)['"]\s*,\s*res\.body\.([a-zA-Z0-9_\.]+)\s*\)/g;
    let match;
    while ((match = setVarRegex.exec(scriptContent)) !== null) {
      extractors.push({
        id: generateId('ex_bru'),
        variableName: match[1],
        path: match[2],
        source: 'json_body',
        description: `Bruno script extracted ${match[1]}`,
        enabled: true
      });
    }
    if (extractors.length > 0) {
      req.extractVariables = extractors;
    }
  }

  return req;
}

/**
 * Generates Bruno collection manifest JSON (bruno.json)
 */
export function generateBrunoCollectionJson(collection: ApiAutomationCollection): string {
  return JSON.stringify({
    version: '1',
    name: collection.name,
    type: 'collection',
    ignore: ['node_modules', '.git']
  }, null, 2);
}

/**
 * Generates Bruno environment .bru file (e.g. environments/staging.bru)
 */
export function generateBrunoEnvironmentBru(environment: ApiEnvironment): string {
  const lines: string[] = [];
  lines.push('vars {');
  lines.push(`  baseUrl: ${environment.baseUrl}`);
  Object.entries(environment.variables || {}).forEach(([key, val]) => {
    if (key !== 'baseUrl') {
      lines.push(`  ${key}: ${val}`);
    }
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

/**
 * Generates copyable Bruno CLI command string
 */
export function generateBrunoCliCommand(
  collectionName: string, 
  environmentName: string = 'staging'
): string {
  const slug = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `# Run Bruno Collection via @usebruno/cli
npx @usebruno/cli run ./collections/${slug} \\
  --env ${environmentName.toLowerCase().replace(/\s+/g, '-')} \\
  --reporter-junit ./reports/bruno-junit.xml \\
  --reporter-html ./reports/bruno-report.html \\
  --bail`;
}

/**
 * Generates copyable Azure DevOps Pipeline YAML for Bruno CLI
 */
export function generateBrunoAzureDevOpsYaml(collection: ApiAutomationCollection | ApiTestFlow | string): string {
  const collectionName = typeof collection === 'string' ? collection : collection?.name || 'ACM Test Suite';
  const slug = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `trigger:
  branches:
    include:
      - main
      - release/*
  paths:
    include:
      - 'src/api/**'
      - 'collections/${slug}/**'

pool:
  vmImage: 'ubuntu-latest'

variables:
  - name: BRUNO_ENV
    value: 'staging'
  - group: acm-delivery-secrets

stages:
  - stage: BrunoApiQualityGates
    displayName: 'Bruno Automated API Flow Quality Gates'
    jobs:
      - job: ExecuteBrunoCollection
        displayName: 'Execute ${collectionName} with Bruno CLI'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js 20.x'

          - script: |
              npm install -g @usebruno/cli
            displayName: 'Install @usebruno/cli Globally'

          - script: |
              bru run ./collections/${slug} \\
                --env $(BRUNO_ENV) \\
                --env-var "baseUrl=$(API_BASE_URL)" \\
                --env-var "apiKey=$(API_KEY)" \\
                --reporter-junit $(Build.ArtifactStagingDirectory)/bruno/junit-results.xml \\
                --reporter-html $(Build.ArtifactStagingDirectory)/bruno/report.html
            displayName: 'Run Bruno Test Suite'
            env:
              API_BASE_URL: $(API_BASE_URL)
              API_KEY: $(API_KEY)

          - task: PublishTestResults@2
            displayName: 'Publish Bruno Quality Gate Test Results'
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '$(Build.ArtifactStagingDirectory)/bruno/junit-results.xml'
              failTaskOnFailedTests: true

          - task: PublishBuildArtifacts@1
            displayName: 'Publish Bruno HTML Execution Artifact'
            inputs:
              PathtoPublish: '$(Build.ArtifactStagingDirectory)/bruno/report.html'
              ArtifactName: 'bruno-execution-report'
`;
}

/**
 * Generates copyable GitHub Actions workflow YAML for Bruno CLI
 */
export function generateBrunoGitHubActionsYaml(collection: ApiAutomationCollection | ApiTestFlow | string): string {
  const collectionName = typeof collection === 'string' ? collection : collection?.name || 'ACM Test Suite';
  const slug = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `name: Bruno API Automation Quality Gates

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  bruno-api-suite:
    name: Run ${collectionName} with Bruno CLI
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code Repository
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Bruno CLI Runner
        run: npm install -g @usebruno/cli

      - name: Execute Bruno Collection Suite
        run: |
          bru run ./collections/${slug} \\
            --env staging \\
            --env-var "baseUrl=\${{ secrets.API_BASE_URL }}" \\
            --env-var "apiKey=\${{ secrets.API_KEY }}" \\
            --reporter-junit ./test-results/bruno-junit.xml \\
            --reporter-html ./test-results/bruno-report.html

      - name: Upload Bruno Execution Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: bruno-test-report
          path: ./test-results/
`;
}

// ============================================================================
// BRUNO FLOW SCRIPT EXECUTION SANDBOX
// ============================================================================

/**
 * Executes a Bruno pre-request or post-response script in an isolated sandbox context
 */
export function executeBrunoScriptSandbox(
  scriptCode: string,
  context: {
    req?: any;
    res?: any;
    vars: Record<string, any>;
    env?: Record<string, any>;
  }
): {
  updatedVars: Record<string, any>;
  updatedHeaders?: Record<string, string>;
  logs: string[];
  error?: string;
} {
  const logs: string[] = [];
  const updatedVars: Record<string, any> = { ...context.vars };
  const updatedHeaders: Record<string, string> = {};

  if (!scriptCode || !scriptCode.trim()) {
    return { updatedVars, logs };
  }

  // Construct bru sandbox helper object
  const bru = {
    setVar: (name: string, val: any) => {
      updatedVars[name] = val;
      logs.push(`[bru.setVar] ${name} = ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
    },
    getVar: (name: string) => {
      return updatedVars[name];
    },
    setEnvVar: (name: string, val: any) => {
      updatedVars[name] = val;
      logs.push(`[bru.setEnvVar] ${name} = ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
    },
    getEnvVar: (name: string) => {
      return (context.env && context.env[name]) || updatedVars[name];
    }
  };

  // Construct req helper
  const req = {
    setHeader: (key: string, value: string) => {
      updatedHeaders[key] = value;
      logs.push(`[req.setHeader] ${key} = ${value}`);
    },
    getHeader: (key: string) => {
      return (context.req?.headers && context.req.headers[key]) || updatedHeaders[key];
    },
    getUrl: () => context.req?.url || '',
    getMethod: () => context.req?.method || 'GET'
  };

  // Construct res helper
  const res = context.res || {
    status: 200,
    headers: {},
    body: {}
  };

  try {
    // Evaluates script with safe arguments
    const sandboxFn = new Function('bru', 'req', 'res', 'vars', 'console', scriptCode);
    const mockConsole = {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' '))
    };

    sandboxFn(bru, req, res, updatedVars, mockConsole);
  } catch (err: any) {
    logs.push(`[Script Error] ${err.message || String(err)}`);
    return { updatedVars, logs, error: err.message || String(err) };
  }

  return { updatedVars, updatedHeaders, logs };
}

// ============================================================================
// API FLOW EXECUTION ENGINE (MULTI-STEP CHAINING & RUNNER)
// ============================================================================

/**
 * Executes a single Step in an API Flow
 */
export async function executeSingleFlowStep(
  step: ApiFlowStep,
  runtimeVariables: Record<string, any>,
  environment?: ApiEnvironment | null
): Promise<ApiFlowStepExecutionResult> {
  const startTime = performance.now();
  const initialVarsSnapshot = { ...runtimeVariables };

  // 1. Evaluate Condition Gate
  if (step.condition === 'skip_if_token_missing') {
    if (!runtimeVariables.authToken && !runtimeVariables.token && !runtimeVariables.accessToken) {
      return {
        stepId: step.id,
        stepNumber: step.stepNumber,
        stepName: step.name,
        method: step.request.method,
        url: step.request.url,
        status: 'skipped',
        durationMs: 0,
        assertionResults: [],
        extractedVariables: {},
        variablesSnapshotBefore: initialVarsSnapshot,
        variablesSnapshotAfter: initialVarsSnapshot,
        error: 'Step skipped: Required authentication token was not present in flow variable state.'
      };
    }
  }

  // 2. Delay before step execution if configured
  if (step.delayBeforeStepMs && step.delayBeforeStepMs > 0) {
    await new Promise(r => setTimeout(r, Math.min(step.delayBeforeStepMs!, 5000)));
  }

  // 3. Run Pre-request Script (Bruno)
  let workingVars = { ...runtimeVariables };
  let customHeaders: Record<string, string> = {};
  if (step.brunoPreScript) {
    const preResult = executeBrunoScriptSandbox(step.brunoPreScript, {
      req: { url: step.request.url, method: step.request.method },
      vars: workingVars,
      env: environment?.variables
    });
    workingVars = preResult.updatedVars;
    if (preResult.updatedHeaders) {
      customHeaders = preResult.updatedHeaders;
    }
  }

  // 4. Prepare and interpolate request
  const mergedVars: Record<string, string> = {
    baseUrl: environment?.baseUrl || window.location.origin || 'http://localhost:3000',
    ...(environment?.variables || {}),
    ...workingVars
  };

  let resolvedUrl = interpolateVariables(step.request.url, mergedVars);
  if (resolvedUrl.startsWith('/')) {
    const base = mergedVars.baseUrl || window.location.origin || 'http://localhost:3000';
    resolvedUrl = `${base.replace(/\/$/, '')}${resolvedUrl}`;
  }

  // Query Params
  const queryParams = (step.request.params || []).filter(p => p.enabled && p.key);
  if (queryParams.length > 0) {
    try {
      const urlObj = new URL(resolvedUrl, window.location.origin);
      for (const p of queryParams) {
        urlObj.searchParams.set(interpolateVariables(p.key, mergedVars), interpolateVariables(p.value, mergedVars));
      }
      resolvedUrl = urlObj.toString();
    } catch {}
  }

  // Headers
  const resolvedHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...customHeaders
  };

  (step.request.headers || []).filter(h => h.enabled && h.key).forEach(h => {
    resolvedHeaders[h.key] = interpolateVariables(h.value, mergedVars);
  });

  // Auth Header
  if (step.request.auth?.type === 'bearer') {
    const tokenVal = interpolateVariables(step.request.auth.bearerToken || '{{authToken}}', mergedVars);
    if (tokenVal) resolvedHeaders['Authorization'] = `Bearer ${tokenVal}`;
  } else if (workingVars.authToken && !resolvedHeaders['Authorization']) {
    resolvedHeaders['Authorization'] = `Bearer ${workingVars.authToken}`;
  }

  // Request Body
  let resolvedBody: string | undefined = undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(step.request.method)) {
    if (step.request.bodyType === 'json' && step.request.bodyContent) {
      resolvedHeaders['Content-Type'] = 'application/json';
      resolvedBody = interpolateVariables(step.request.bodyContent, mergedVars);
    }
  }

  // 5. Execute HTTP Request via Backend Proxy with Retry support
  const maxRetries = step.retryOnFailure?.enabled ? (step.retryOnFailure.maxRetries || 1) : 0;
  const retryDelay = step.retryOnFailure?.retryDelayMs || 500;
  let attempts = 0;
  let responseData: any = null;
  let lastError: string | undefined = undefined;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const proxyRes = await fetch('/api/automation/execute-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: resolvedUrl,
          method: step.request.method,
          headers: resolvedHeaders,
          body: resolvedBody,
          timeoutMs: step.request.timeoutMs || 10000
        })
      });

      if (!proxyRes.ok) {
        throw new Error(`Server returned ${proxyRes.status} ${proxyRes.statusText}`);
      }

      responseData = await proxyRes.json();
      break; // Success, exit retry loop
    } catch (err: any) {
      lastError = err.message || String(err);
      if (attempts <= maxRetries) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
  }

  const durationMs = Math.round(performance.now() - startTime);

  if (!responseData) {
    return {
      stepId: step.id,
      stepNumber: step.stepNumber,
      stepName: step.name,
      method: step.request.method,
      url: resolvedUrl,
      status: 'failed',
      durationMs,
      requestHeaders: resolvedHeaders,
      requestBody: resolvedBody,
      assertionResults: [],
      extractedVariables: {},
      variablesSnapshotBefore: initialVarsSnapshot,
      variablesSnapshotAfter: initialVarsSnapshot,
      retriesAttempted: attempts - 1,
      error: `Network failure after ${attempts} attempt(s): ${lastError}`
    };
  }

  // 6. Evaluate Assertions
  const assertionResults: ApiAssertionResult[] = (step.assertions || []).map(as => {
    return evaluateAssertion(as, {
      status: responseData.status,
      statusText: responseData.statusText,
      durationMs: responseData.durationMs || durationMs,
      headers: responseData.headers || {},
      body: responseData.body
    }, mergedVars);
  });

  const allAssertionsPassed = assertionResults.every(a => a.passed);

  // 7. Extract Variables (Standard Extractors)
  const standardExtracted = extractVariablesFromResponse(step.extractors || [], {
    status: responseData.status,
    headers: responseData.headers || {},
    body: responseData.body
  });

  Object.assign(workingVars, standardExtracted);

  // 8. Run Bruno Post-Response Script (e.g. bru.setVar)
  if (step.brunoPostScript) {
    const postResult = executeBrunoScriptSandbox(step.brunoPostScript, {
      req: { url: resolvedUrl, method: step.request.method, headers: resolvedHeaders },
      res: {
        status: responseData.status,
        headers: responseData.headers || {},
        body: responseData.body
      },
      vars: workingVars,
      env: environment?.variables
    });
    workingVars = postResult.updatedVars;
  }

  const finalVarsSnapshot = { ...workingVars };
  const stepStatus = (responseData.status < 400 && allAssertionsPassed) ? 'passed' : 'failed';

  return {
    stepId: step.id,
    stepNumber: step.stepNumber,
    stepName: step.name,
    method: step.request.method,
    url: resolvedUrl,
    status: stepStatus,
    httpStatus: responseData.status,
    httpStatusText: responseData.statusText,
    durationMs,
    requestHeaders: resolvedHeaders,
    requestBody: resolvedBody,
    responseHeaders: responseData.headers || {},
    responseBody: responseData.body,
    assertionResults,
    extractedVariables: standardExtracted,
    variablesSnapshotBefore: initialVarsSnapshot,
    variablesSnapshotAfter: finalVarsSnapshot,
    retriesAttempted: attempts - 1,
    error: stepStatus === 'failed' && !allAssertionsPassed
      ? assertionResults.find(a => !a.passed)?.errorMessage
      : undefined
  };
}

/**
 * Runs an entire Multi-Step API Flow sequentially with variable propagation
 */
export async function executeFullApiFlow(
  flow: ApiTestFlow,
  environment?: ApiEnvironment | null,
  onStepProgress?: (stepIdx: number, result: ApiFlowStepExecutionResult, currentVars: Record<string, any>) => void
): Promise<ApiFlowExecutionRun> {
  const startedAt = new Date().toISOString();
  const startTime = performance.now();

  const stepResults: ApiFlowStepExecutionResult[] = [];
  let runtimeVars: Record<string, any> = {
    ...(flow.globalVariables || {}),
    ...(environment?.variables || {})
  };

  const initialVars = { ...runtimeVars };
  let passedSteps = 0;
  let failedSteps = 0;
  let skippedSteps = 0;

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];

    // Check if flow should stop on prior failure
    const prevStepResult = stepResults[stepResults.length - 1];
    if (prevStepResult && prevStepResult.status === 'failed' && (step.condition === 'only_if_prev_passed' || prevStepResult.stepNumber === step.stepNumber - 1 && step.stopFlowOnFailure)) {
      const skippedRes: ApiFlowStepExecutionResult = {
        stepId: step.id,
        stepNumber: step.stepNumber,
        stepName: step.name,
        method: step.request.method,
        url: step.request.url,
        status: 'skipped',
        durationMs: 0,
        assertionResults: [],
        extractedVariables: {},
        variablesSnapshotBefore: runtimeVars,
        variablesSnapshotAfter: runtimeVars,
        error: `Skipped: Prior step (${prevStepResult.stepName}) failed.`
      };
      stepResults.push(skippedRes);
      skippedSteps++;
      if (onStepProgress) onStepProgress(i, skippedRes, runtimeVars);
      continue;
    }

    // Execute step
    const result = await executeSingleFlowStep(step, runtimeVars, environment);
    runtimeVars = { ...result.variablesSnapshotAfter };
    stepResults.push(result);

    if (result.status === 'passed') passedSteps++;
    else if (result.status === 'failed') failedSteps++;
    else skippedSteps++;

    if (onStepProgress) {
      onStepProgress(i, result, runtimeVars);
    }

    // Abort flow if critical failure
    if (result.status === 'failed' && step.stopFlowOnFailure) {
      break;
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  const completedAt = new Date().toISOString();
  const overallStatus = failedSteps === 0 ? 'passed' : 'failed';

  return {
    id: generateId('flowrun'),
    flowId: flow.id,
    flowName: flow.name,
    environmentName: environment?.name || 'Default Environment',
    status: overallStatus,
    startedAt,
    completedAt,
    totalSteps: flow.steps.length,
    passedSteps,
    failedSteps,
    skippedSteps,
    durationMs,
    stepResults,
    initialVariables: initialVars,
    finalVariables: runtimeVars,
    triggeredBy: 'manual_portal'
  };
}

// ============================================================================
// PRE-SEEDED BRUNO API FLOWS FOR AT&T ACM DELIVERY
// ============================================================================

export function getSampleBrunoFlows(): ApiTestFlow[] {
  return [
    {
      id: 'flow_att_auth_handshake',
      name: 'AT&T ACM OAuth & Session Handshake Flow',
      description: 'End-to-end authentication flow: logs in client device, stores JWT in Bruno vars, validates session heartbeat, and exchanges refresh token.',
      category: 'auth_lifecycle',
      globalVariables: {
        clientAppVersion: '2.4.1',
        deviceOs: 'Windows 11 Enterprise'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRunStatus: 'passed',
      lastRunAt: new Date(Date.now() - 3600000).toISOString(),
      lastRunSummary: {
        totalSteps: 4,
        passedSteps: 4,
        failedSteps: 0,
        durationMs: 420,
        passRate: 100
      },
      steps: [
        {
          id: 'step_1_auth',
          stepNumber: 1,
          name: '1. Device Handshake & Token Issue',
          description: 'Authenticates ACM client credentials and extracts JWT authToken and refreshToken.',
          condition: 'always',
          stopFlowOnFailure: true,
          brunoPostScript: `// Bruno Post-response Script
if (res.body && res.body.token) {
  bru.setVar('authToken', res.body.token);
  bru.setVar('sessionId', 'sess_' + Date.now());
  console.log('Stored authToken & sessionId in Bruno state');
}`,
          request: {
            id: 'req_auth_login',
            name: 'Device Auth & Token Exchange',
            method: 'POST',
            url: '{{baseUrl}}/api/auth/login',
            headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
            params: [],
            bodyType: 'json',
            bodyContent: JSON.stringify({
              email: 'delivery.lead@att.com',
              role: 'delivery_lead'
            }, null, 2),
            assertions: [
              {
                id: 'as_auth_status',
                type: 'status_code',
                operator: 'equals',
                expectedValue: '200',
                description: 'Returns HTTP 200 OK',
                enabled: true
              },
              {
                id: 'as_auth_jwt',
                type: 'json_path_value',
                target: 'token',
                operator: 'exists',
                expectedValue: '',
                description: 'JWT bearer token is present in payload',
                enabled: true
              }
            ],
            extractVariables: [
              {
                id: 'ex_token',
                variableName: 'authToken',
                path: 'token',
                source: 'json_body',
                enabled: true
              },
              {
                id: 'ex_role',
                variableName: 'userRole',
                path: 'user.role',
                source: 'json_body',
                enabled: true
              }
            ],
            enabled: true
          },
          extractors: [
            {
              id: 'ex_token',
              variableName: 'authToken',
              path: 'token',
              source: 'json_body',
              enabled: true
            }
          ],
          assertions: [
            {
              id: 'as_auth_status',
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Returns HTTP 200 OK',
              enabled: true
            }
          ]
        },
        {
          id: 'step_2_verify',
          stepNumber: 2,
          name: '2. Verify Session Identity & Scopes',
          description: 'Calls protected identity endpoint passing {{authToken}} in Bearer header.',
          condition: 'only_if_prev_passed',
          delayBeforeStepMs: 150,
          brunoPreScript: `// Bruno Pre-request Script
req.setHeader('X-Trace-Id', 'trace_' + Date.now());
console.log('Sending trace ID with verified token');`,
          brunoPostScript: `// Bruno Post-response
if (res.body && res.body.user) {
  bru.setVar('userEmail', res.body.user.email);
}`,
          request: {
            id: 'req_auth_me',
            name: 'Verify Current Session (/api/auth/me)',
            method: 'GET',
            url: '{{baseUrl}}/api/auth/me',
            headers: [
              { key: 'Accept', value: 'application/json', enabled: true },
              { key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true }
            ],
            params: [],
            bodyType: 'none',
            assertions: [
              {
                id: 'as_me_status',
                type: 'status_code',
                operator: 'equals',
                expectedValue: '200',
                description: 'Session is valid (200 OK)',
                enabled: true
              },
              {
                id: 'as_me_user',
                type: 'json_path_value',
                target: 'user.email',
                operator: 'contains',
                expectedValue: 'att.com',
                description: 'User email matches AT&T domain',
                enabled: true
              }
            ],
            extractVariables: [
              {
                id: 'ex_uid',
                variableName: 'userId',
                path: 'user.id',
                source: 'json_body',
                enabled: true
              }
            ],
            enabled: true
          },
          extractors: [],
          assertions: [
            {
              id: 'as_me_status',
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Session is valid (200 OK)',
              enabled: true
            }
          ]
        },
        {
          id: 'step_3_sync_status',
          stepNumber: 3,
          name: '3. Query Live ADO Sync State',
          description: 'Checks Azure DevOps synchronization engine health using authenticated session.',
          condition: 'only_if_prev_passed',
          request: {
            id: 'req_ado_state',
            name: 'Query ADO Sync Engine State',
            method: 'GET',
            url: '{{baseUrl}}/api/ado/status',
            headers: [
              { key: 'Accept', value: 'application/json', enabled: true },
              { key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true }
            ],
            params: [],
            bodyType: 'none',
            assertions: [
              {
                id: 'as_ado_status',
                type: 'status_code',
                operator: 'equals',
                expectedValue: '200',
                description: 'ADO engine is responsive',
                enabled: true
              }
            ],
            extractVariables: [],
            enabled: true
          },
          extractors: [],
          assertions: [
            {
              id: 'as_ado_status',
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'ADO engine is responsive',
              enabled: true
            }
          ]
        },
        {
          id: 'step_4_health',
          stepNumber: 4,
          name: '4. Service Heartbeat Check',
          description: 'Validates overall application health and AI readiness.',
          condition: 'always',
          request: {
            id: 'req_health_check',
            name: 'System Health Check',
            method: 'GET',
            url: '{{baseUrl}}/api/health',
            headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
            params: [],
            bodyType: 'none',
            assertions: [
              {
                id: 'as_health_status',
                type: 'status_code',
                operator: 'equals',
                expectedValue: '200',
                description: 'Service status is OK',
                enabled: true
              },
              {
                id: 'as_health_time',
                type: 'response_time',
                operator: 'less_than',
                expectedValue: '800',
                description: 'Health response latency <= 800ms',
                enabled: true
              }
            ],
            extractVariables: [],
            enabled: true
          },
          extractors: [],
          assertions: [
            {
              id: 'as_health_status',
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Service status is OK',
              enabled: true
            }
          ]
        }
      ]
    },
    {
      id: 'flow_acm_telemetry_diagnostics',
      name: 'ACM Client Network Diagnostics & Telemetry Flow',
      description: 'Simulates AT&T Connection Manager client lifecycle: registers device gateway, pushes speed test metrics, and asserts SLA latency.',
      category: 'telemetry',
      globalVariables: {
        carrier: 'AT&T Mobility 5G+',
        clientProfile: 'Enterprise_VPN_Profile_1'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRunStatus: 'passed',
      lastRunAt: new Date(Date.now() - 7200000).toISOString(),
      lastRunSummary: {
        totalSteps: 3,
        passedSteps: 3,
        failedSteps: 0,
        durationMs: 310,
        passRate: 100
      },
      steps: [
        {
          id: 'step_tel_1',
          stepNumber: 1,
          name: '1. Gateway Handshake & Discovery',
          description: 'Pings gateway health endpoint to verify connectivity and obtain target node ID.',
          condition: 'always',
          brunoPostScript: `// Bruno Post-response
bru.setVar('gatewayNode', 'node-us-east-att-1');
bru.setVar('simulatedBandwidthMbps', 185);`,
          request: {
            id: 'req_gw_ping',
            name: 'Ping ACM Gateway Node',
            method: 'GET',
            url: '{{baseUrl}}/api/health',
            headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
            params: [],
            bodyType: 'none',
            assertions: [
              {
                id: 'as_gw_200',
                type: 'status_code',
                operator: 'equals',
                expectedValue: '200',
                description: 'Gateway responds with 200 OK',
                enabled: true
              }
            ],
            extractVariables: [],
            enabled: true
          },
          extractors: [],
          assertions: [
            {
              id: 'as_gw_200',
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Gateway responds with 200 OK',
              enabled: true
            }
          ]
        },
        {
          id: 'step_tel_2',
          stepNumber: 2,
          name: '2. Register Client Session UUID',
          description: 'Registers client device identifier and session nonce in Bruno flow memory.',
          condition: 'only_if_prev_passed',
          delayBeforeStepMs: 100,
          brunoPreScript: `// Bruno Pre-request
const deviceUuid = 'acm_dev_' + Math.random().toString(36).substring(2, 9);
bru.setVar('deviceUuid', deviceUuid);
console.log('Registered deviceUuid:', deviceUuid);`,
          request: {
            id: 'req_client_auth',
            name: 'Client Device Authenticate',
            method: 'POST',
            url: '{{baseUrl}}/api/auth/login',
            headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
            params: [],
            bodyType: 'json',
            bodyContent: JSON.stringify({
              email: 'telemetry.device@att.com',
              role: 'developer'
            }, null, 2),
            assertions: [
              {
                id: 'as_tel_token',
                type: 'json_path_value',
                target: 'token',
                operator: 'exists',
                expectedValue: '',
                description: 'Auth token generated for telemetry',
                enabled: true
              }
            ],
            extractVariables: [
              {
                id: 'ex_tel_tok',
                variableName: 'telemetryToken',
                path: 'token',
                source: 'json_body',
                enabled: true
              }
            ],
            enabled: true
          },
          extractors: [],
          assertions: [
            {
              id: 'as_tel_token',
              type: 'json_path_value',
              target: 'token',
              operator: 'exists',
              expectedValue: '',
              description: 'Auth token generated for telemetry',
              enabled: true
            }
          ]
        },
        {
          id: 'step_tel_3',
          stepNumber: 3,
          name: '3. Verify Session Health & SLA Latency',
          description: 'Performs round-trip verification ensuring total latency stays under 1000ms.',
          condition: 'only_if_prev_passed',
          request: {
            id: 'req_sla_check',
            name: 'SLA Latency Verification',
            method: 'GET',
            url: '{{baseUrl}}/api/auth/me',
            headers: [
              { key: 'Accept', value: 'application/json', enabled: true },
              { key: 'Authorization', value: 'Bearer {{telemetryToken}}', enabled: true }
            ],
            params: [],
            bodyType: 'none',
            assertions: [
              {
                id: 'as_sla_status',
                type: 'status_code',
                operator: 'equals',
                expectedValue: '200',
                description: 'SLA verification passed 200 OK',
                enabled: true
              },
              {
                id: 'as_sla_time',
                type: 'response_time',
                operator: 'less_than',
                expectedValue: '1000',
                description: 'Latency within SLA limit (<= 1000ms)',
                enabled: true
              }
            ],
            extractVariables: [],
            enabled: true
          },
          extractors: [],
          assertions: [
            {
              id: 'as_sla_status',
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'SLA verification passed 200 OK',
              enabled: true
            }
          ]
        }
      ]
    }
  ];
}
