import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiRequestItem, 
  ApiTestExecutionRun, 
  ApiRequestExecutionResult, 
  ApiAssertionResult,
  HttpMethod,
  ApiHeader,
  ApiParam
} from '../types/apiAutomation';
import { generateId } from './date';

/**
 * Replaces all {{variableName}} placeholders using the provided variable map
 */
export function interpolateVariables(
  text: string, 
  variables: Record<string, string> = {}
): string {
  if (!text) return '';
  return text.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (match, key) => {
    if (variables[key] !== undefined && variables[key] !== null) {
      return String(variables[key]);
    }
    return match;
  });
}

/**
 * Safely extracts a value from a nested JSON object given a dot/bracket path (e.g. "data.users[0].id")
 */
export function getJsonPathValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  
  // Normalize bracket notation e.g. users[0] -> users.0
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.').filter(Boolean);
  
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Evaluates a single assertion against response data
 */
export function evaluateAssertion(
  assertion: ApiRequestItem['assertions'][0],
  response: {
    status: number;
    statusText: string;
    durationMs: number;
    headers: Record<string, string>;
    body: any;
  },
  runtimeVariables: Record<string, string> = {}
): ApiAssertionResult {
  const expectedValueInterpolated = interpolateVariables(assertion.expectedValue, runtimeVariables);
  let actualValue: any = undefined;
  let passed = false;
  let errorMessage = '';

  try {
    switch (assertion.type) {
      case 'status_code': {
        actualValue = response.status;
        const expectedCode = parseInt(expectedValueInterpolated, 10);
        if (assertion.operator === 'equals') {
          passed = response.status === expectedCode;
        } else if (assertion.operator === 'not_equals') {
          passed = response.status !== expectedCode;
        } else if (assertion.operator === 'less_than') {
          passed = response.status < expectedCode;
        } else if (assertion.operator === 'greater_than') {
          passed = response.status > expectedCode;
        }
        if (!passed) {
          errorMessage = `Expected HTTP status ${assertion.operator} ${expectedValueInterpolated}, but received ${response.status} (${response.statusText})`;
        }
        break;
      }

      case 'response_time': {
        actualValue = response.durationMs;
        const expectedTime = parseFloat(expectedValueInterpolated);
        if (assertion.operator === 'less_than') {
          passed = response.durationMs <= expectedTime;
        } else if (assertion.operator === 'greater_than') {
          passed = response.durationMs >= expectedTime;
        } else {
          passed = response.durationMs <= expectedTime;
        }
        if (!passed) {
          errorMessage = `Response time of ${response.durationMs}ms exceeded threshold of ${expectedValueInterpolated}ms`;
        }
        break;
      }

      case 'header_exists': {
        const headerKey = (assertion.target || '').toLowerCase();
        const found = Object.keys(response.headers).some(k => k.toLowerCase() === headerKey);
        actualValue = found ? 'present' : 'missing';
        passed = assertion.operator === 'exists' ? found : !found;
        if (!passed) {
          errorMessage = `Header "${assertion.target}" was expected to ${assertion.operator === 'exists' ? 'exist' : 'not exist'}, but was ${actualValue}`;
        }
        break;
      }

      case 'header_equals': {
        const headerKey = (assertion.target || '').toLowerCase();
        const headerEntry = Object.entries(response.headers).find(([k]) => k.toLowerCase() === headerKey);
        actualValue = headerEntry ? headerEntry[1] : undefined;
        if (assertion.operator === 'equals') {
          passed = String(actualValue).toLowerCase() === expectedValueInterpolated.toLowerCase();
        } else if (assertion.operator === 'contains') {
          passed = String(actualValue).toLowerCase().includes(expectedValueInterpolated.toLowerCase());
        }
        if (!passed) {
          errorMessage = `Header "${assertion.target}" value "${actualValue}" did not match expected "${expectedValueInterpolated}"`;
        }
        break;
      }

      case 'json_body_contains': {
        const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
        actualValue = bodyStr;
        passed = bodyStr.includes(expectedValueInterpolated);
        if (!passed) {
          errorMessage = `Response body does not contain expected substring: "${expectedValueInterpolated}"`;
        }
        break;
      }

      case 'json_path_value': {
        if (!assertion.target) {
          passed = false;
          errorMessage = 'JSON path target was not specified in assertion';
          break;
        }
        actualValue = getJsonPathValue(response.body, assertion.target);

        if (assertion.operator === 'exists') {
          passed = actualValue !== undefined && actualValue !== null;
        } else if (assertion.operator === 'is_null') {
          passed = actualValue === null || actualValue === undefined;
        } else if (assertion.operator === 'equals') {
          passed = String(actualValue) === expectedValueInterpolated;
        } else if (assertion.operator === 'not_equals') {
          passed = String(actualValue) !== expectedValueInterpolated;
        } else if (assertion.operator === 'contains') {
          passed = String(actualValue).includes(expectedValueInterpolated);
        } else if (assertion.operator === 'greater_than') {
          passed = parseFloat(actualValue) > parseFloat(expectedValueInterpolated);
        } else if (assertion.operator === 'less_than') {
          passed = parseFloat(actualValue) < parseFloat(expectedValueInterpolated);
        } else if (assertion.operator === 'regex') {
          const re = new RegExp(expectedValueInterpolated);
          passed = re.test(String(actualValue));
        }

        if (!passed) {
          errorMessage = `JSON path "${assertion.target}" value (${JSON.stringify(actualValue)}) did not satisfy ${assertion.operator} "${expectedValueInterpolated}"`;
        }
        break;
      }

      default: {
        passed = true;
      }
    }
  } catch (err: any) {
    passed = false;
    errorMessage = `Assertion evaluation error: ${err.message || String(err)}`;
  }

  return {
    assertionId: assertion.id,
    description: assertion.description || `${assertion.type} ${assertion.operator} ${assertion.expectedValue}`,
    passed,
    actual: actualValue,
    expected: expectedValueInterpolated,
    errorMessage: passed ? undefined : errorMessage
  };
}

/**
 * Extracts variables from response body, headers, or status
 */
export function extractVariablesFromResponse(
  extractors: ApiRequestItem['extractVariables'],
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  }
): Record<string, any> {
  const extracted: Record<string, any> = {};
  if (!extractors || extractors.length === 0) return extracted;

  for (const extractor of extractors) {
    if (!extractor.enabled || !extractor.variableName) continue;

    try {
      if (extractor.source === 'json_body') {
        const val = getJsonPathValue(response.body, extractor.path);
        if (val !== undefined) {
          extracted[extractor.variableName] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      } else if (extractor.source === 'header') {
        const targetHeader = extractor.path.toLowerCase();
        const entry = Object.entries(response.headers).find(([k]) => k.toLowerCase() === targetHeader);
        if (entry) {
          extracted[extractor.variableName] = entry[1];
        }
      } else if (extractor.source === 'status_code') {
        extracted[extractor.variableName] = String(response.status);
      }
    } catch (err) {
      console.warn(`[ApiEngine] Failed to extract variable ${extractor.variableName}:`, err);
    }
  }

  return extracted;
}

/**
 * Executes a single API request item through the backend proxy route with timeout and metrics
 */
export async function executeSingleApiRequest(
  request: ApiRequestItem,
  environment?: ApiEnvironment | null,
  collectionVariables: Record<string, string> = {},
  runtimeVariables: Record<string, string> = {}
): Promise<ApiRequestExecutionResult> {
  // Consolidate variable map
  const mergedVariables: Record<string, string> = {
    baseUrl: environment?.baseUrl || window.location.origin || 'http://localhost:3000',
    ...(environment?.variables || {}),
    ...collectionVariables,
    ...runtimeVariables
  };

  // Interpolate URL
  let resolvedUrl = interpolateVariables(request.url, mergedVariables);
  
  // If URL is relative, prepend baseUrl
  if (resolvedUrl.startsWith('/')) {
    const base = mergedVariables.baseUrl || window.location.origin || 'http://localhost:3000';
    resolvedUrl = `${base.replace(/\/$/, '')}${resolvedUrl}`;
  }

  // Construct query parameters
  const queryParams = (request.params || []).filter(p => p.enabled && p.key);
  if (queryParams.length > 0) {
    const urlObj = new URL(resolvedUrl, window.location.origin);
    for (const p of queryParams) {
      const pKey = interpolateVariables(p.key, mergedVariables);
      const pVal = interpolateVariables(p.value, mergedVariables);
      urlObj.searchParams.set(pKey, pVal);
    }
    resolvedUrl = urlObj.toString();
  }

  // Construct headers
  const resolvedHeaders: Record<string, string> = {};
  
  // Environment headers
  (environment?.headers || []).filter(h => h.enabled && h.key).forEach(h => {
    resolvedHeaders[h.key] = interpolateVariables(h.value, mergedVariables);
  });

  // Request headers
  (request.headers || []).filter(h => h.enabled && h.key).forEach(h => {
    resolvedHeaders[h.key] = interpolateVariables(h.value, mergedVariables);
  });

  // Auth headers
  if (request.auth) {
    if (request.auth.type === 'bearer' && request.auth.bearerToken) {
      const token = interpolateVariables(request.auth.bearerToken, mergedVariables);
      resolvedHeaders['Authorization'] = `Bearer ${token}`;
    } else if (request.auth.type === 'basic') {
      const user = interpolateVariables(request.auth.basicUsername || '', mergedVariables);
      const pass = interpolateVariables(request.auth.basicPassword || '', mergedVariables);
      const encoded = btoa(`${user}:${pass}`);
      resolvedHeaders['Authorization'] = `Basic ${encoded}`;
    } else if (request.auth.type === 'apikey' && request.auth.apiKeyName && request.auth.apiKeyValue) {
      const keyName = interpolateVariables(request.auth.apiKeyName, mergedVariables);
      const keyVal = interpolateVariables(request.auth.apiKeyValue, mergedVariables);
      if (request.auth.apiKeyIn === 'query') {
        const urlObj = new URL(resolvedUrl, window.location.origin);
        urlObj.searchParams.set(keyName, keyVal);
        resolvedUrl = urlObj.toString();
      } else {
        resolvedHeaders[keyName] = keyVal;
      }
    }
  }

  // Resolve body content
  let resolvedBody: any = undefined;
  if (request.bodyType === 'json' && request.bodyContent) {
    if (!resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
      resolvedHeaders['Content-Type'] = 'application/json';
    }
    resolvedBody = interpolateVariables(request.bodyContent, mergedVariables);
  } else if (request.bodyType === 'raw' && request.bodyContent) {
    resolvedBody = interpolateVariables(request.bodyContent, mergedVariables);
  }

  const startTime = performance.now();

  try {
    // Send via backend proxy endpoint to prevent CORS & network limitations
    const proxyPayload = {
      method: request.method,
      url: resolvedUrl,
      headers: resolvedHeaders,
      body: resolvedBody,
      timeoutMs: request.timeoutMs || 10000
    };

    const proxyResponse = await fetch('/api/automation/execute-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(proxyPayload)
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (proxyResponse.ok) {
      const proxyResult = await proxyResponse.json();
      
      const responseStatus = proxyResult.status || 200;
      const responseStatusText = proxyResult.statusText || 'OK';
      const responseDuration = proxyResult.durationMs || elapsed;
      const responseHeaders = proxyResult.headers || {};
      const responseBody = proxyResult.body;

      // Evaluate Assertions
      const assertionResults: ApiAssertionResult[] = (request.assertions || [])
        .filter(a => a.enabled)
        .map(a => evaluateAssertion(a, {
          status: responseStatus,
          statusText: responseStatusText,
          durationMs: responseDuration,
          headers: responseHeaders,
          body: responseBody
        }, mergedVariables));

      const allAssertionsPassed = assertionResults.every(a => a.passed);
      const isSuccess = responseStatus >= 200 && responseStatus < 400 && allAssertionsPassed;

      // Extract variables
      const extractedVariables = extractVariablesFromResponse(request.extractVariables, {
        status: responseStatus,
        headers: responseHeaders,
        body: responseBody
      });

      return {
        requestId: request.id,
        requestName: request.name,
        method: request.method,
        url: resolvedUrl,
        status: isSuccess ? 'passed' : 'failed',
        httpStatus: responseStatus,
        httpStatusText: responseStatusText,
        durationMs: responseDuration,
        requestHeaders: resolvedHeaders,
        requestBody: resolvedBody,
        responseHeaders,
        responseBody,
        assertionResults,
        extractedVariables
      };
    } else {
      // Direct fallback if proxy is in minimal mode or mock
      const errorJson = await proxyResponse.json().catch(() => ({}));
      return {
        requestId: request.id,
        requestName: request.name,
        method: request.method,
        url: resolvedUrl,
        status: 'failed',
        httpStatus: proxyResponse.status,
        httpStatusText: proxyResponse.statusText,
        durationMs: elapsed,
        requestHeaders: resolvedHeaders,
        requestBody: resolvedBody,
        assertionResults: [],
        error: errorJson.error || `Proxy error: HTTP ${proxyResponse.status}`
      };
    }
  } catch (netErr: any) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url: resolvedUrl,
      status: 'failed',
      durationMs: elapsed,
      requestHeaders: resolvedHeaders,
      requestBody: resolvedBody,
      assertionResults: [],
      error: `Network / Gateway execution error: ${netErr.message || String(netErr)}`
    };
  }
}

/**
 * Runs an entire collection sequentially, chaining variables from step to step
 */
export async function runFullCollection(
  collection: ApiAutomationCollection,
  environment?: ApiEnvironment | null,
  onStepProgress?: (stepIndex: number, result: ApiRequestExecutionResult) => void
): Promise<ApiTestExecutionRun> {
  const startedAt = new Date().toISOString();
  const startTime = performance.now();

  const enabledRequests = collection.requests.filter(r => r.enabled);
  const runtimeVariables: Record<string, string> = {
    ...(collection.variables || {})
  };

  const results: ApiRequestExecutionResult[] = [];
  let passedRequests = 0;
  let failedRequests = 0;
  let totalAssertions = 0;
  let passedAssertions = 0;
  let failedAssertions = 0;

  for (let i = 0; i < enabledRequests.length; i++) {
    const request = enabledRequests[i];
    
    // Execute single request
    const stepResult = await executeSingleApiRequest(
      request,
      environment,
      collection.variables,
      runtimeVariables
    );

    // Merge newly extracted variables into runtime map for subsequent requests
    if (stepResult.extractedVariables) {
      Object.assign(runtimeVariables, stepResult.extractedVariables);
    }

    if (stepResult.status === 'passed') {
      passedRequests++;
    } else {
      failedRequests++;
    }

    stepResult.assertionResults.forEach(a => {
      totalAssertions++;
      if (a.passed) passedAssertions++;
      else failedAssertions++;
    });

    results.push(stepResult);

    if (onStepProgress) {
      onStepProgress(i, stepResult);
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  const completedAt = new Date().toISOString();
  const runStatus = failedRequests === 0 ? 'passed' : 'failed';

  return {
    id: generateId('run'),
    collectionId: collection.id,
    collectionName: collection.name,
    environmentName: environment?.name || 'Default Environment',
    startedAt,
    completedAt,
    status: runStatus,
    totalRequests: enabledRequests.length,
    passedRequests,
    failedRequests,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    durationMs,
    triggeredBy: 'manual_portal',
    results
  };
}

/**
 * Generates copyable Newman CLI command string
 */
export function generateNewmanCliCommand(
  collectionName: string, 
  environmentName: string = 'Development'
): string {
  const slug = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `# Run API Collection in CI/CD via Newman (Postman CLI Engine)
npx newman run ./collections/${slug}.postman_collection.json \\
  --environment ./environments/${environmentName.toLowerCase().replace(/\s+/g, '-')}.postman_environment.json \\
  --reporters cli,junit,html \\
  --reporter-junit-export ./reports/junit-report.xml \\
  --reporter-html-export ./reports/api-test-report.html \\
  --bail`;
}

/**
 * Generates copyable Azure DevOps Pipeline YAML definition
 */
export function generateAzureDevOpsPipelineYaml(collection: ApiAutomationCollection): string {
  const slug = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `trigger:
  branches:
    include:
      - main
      - release/*
  paths:
    include:
      - 'src/api/**'
      - 'collections/**'

pool:
  vmImage: 'ubuntu-latest'

variables:
  - name: API_ENVIRONMENT
    value: 'staging'
  - group: acm-delivery-secrets

stages:
  - stage: ApiAutomation
    displayName: 'Automated API Collection Quality Gates'
    jobs:
      - job: ExecuteNewmanSuite
        displayName: 'Run ${collection.name}'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js'

          - script: |
              npm install -g newman newman-reporter-htmlextra
            displayName: 'Install Newman CLI & HTML Reporter'

          - script: |
              newman run ./collections/${slug}.postman_collection.json \\
                --env-var "baseUrl=$(API_BASE_URL)" \\
                --env-var "apiKey=$(API_KEY)" \\
                --reporters cli,junit,htmlextra \\
                --reporter-junit-export $(Build.ArtifactStagingDirectory)/newman/junit-results.xml \\
                --reporter-htmlextra-export $(Build.ArtifactStagingDirectory)/newman/report.html
            displayName: 'Execute API Collection Suite'
            env:
              API_BASE_URL: $(API_BASE_URL)
              API_KEY: $(API_KEY)

          - task: PublishTestResults@2
            displayName: 'Publish Quality Gate Test Results'
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '$(Build.ArtifactStagingDirectory)/newman/junit-results.xml'
              failTaskOnFailedTests: true

          - task: PublishBuildArtifacts@1
            displayName: 'Publish HTML Test Summary'
            inputs:
              PathtoPublish: '$(Build.ArtifactStagingDirectory)/newman/report.html'
              ArtifactName: 'api-automation-report'
`;
}

/**
 * Generates copyable GitHub Actions workflow YAML
 */
export function generateGitHubActionsWorkflowYaml(collection: ApiAutomationCollection): string {
  const slug = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `name: API Automation Quality Gates

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 4 * * 1-5' # Daily 4 AM Smoke Suite
  workflow_dispatch:

jobs:
  api-collection-tests:
    name: Run ${collection.name}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Newman & Reporters
        run: npm install -g newman newman-reporter-htmlextra

      - name: Execute API Collection Suite
        run: |
          newman run ./collections/${slug}.postman_collection.json \\
            --env-var "baseUrl=\${{ secrets.API_BASE_URL }}" \\
            --reporters cli,junit,htmlextra \\
            --reporter-junit-export ./test-results/junit.xml \\
            --reporter-htmlextra-export ./test-results/index.html

      - name: Upload Test Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-test-report
          path: ./test-results/
`;
}

/**
 * Generates cURL command string for a single request
 */
export function generateCurlCommand(
  request: ApiRequestItem,
  environment?: ApiEnvironment | null,
  collectionVariables: Record<string, string> = {}
): string {
  const merged = {
    baseUrl: environment?.baseUrl || window.location.origin || 'http://localhost:3000',
    ...(environment?.variables || {}),
    ...collectionVariables
  };

  const url = interpolateVariables(request.url, merged);
  const parts: string[] = [`curl -X ${request.method} "${url}"`];

  // Headers
  (request.headers || []).filter(h => h.enabled && h.key).forEach(h => {
    parts.push(`  -H "${h.key}: ${interpolateVariables(h.value, merged)}"`);
  });

  // Body
  if (request.bodyType === 'json' && request.bodyContent) {
    parts.push(`  -H "Content-Type: application/json"`);
    const escaped = interpolateVariables(request.bodyContent, merged).replace(/"/g, '\\"');
    parts.push(`  -d "${escaped}"`);
  }

  return parts.join(' \\\n');
}

/**
 * Parses Postman Collection v2.0 / v2.1 JSON into ApiAutomationCollection
 */
export function parsePostmanCollection(jsonStr: string): Partial<ApiAutomationCollection> {
  const parsed = JSON.parse(jsonStr);
  const collectionName = parsed.info?.name || 'Imported Postman Collection';
  const collectionDescription = parsed.info?.description || 'Imported from Postman Collection JSON';

  const requests: ApiRequestItem[] = [];

  function processItems(items: any[], folderName?: string) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.item && Array.isArray(item.item)) {
        // Folder
        processItems(item.item, item.name || folderName);
      } else if (item.request) {
        const req = item.request;
        const method: HttpMethod = (req.method || 'GET').toUpperCase() as HttpMethod;
        
        let urlStr = '';
        if (typeof req.url === 'string') {
          urlStr = req.url;
        } else if (req.url && req.url.raw) {
          urlStr = req.url.raw;
        }

        const headers: ApiHeader[] = Array.isArray(req.header)
          ? req.header.map((h: any) => ({
              key: h.key || '',
              value: h.value || '',
              enabled: h.disabled ? false : true,
              description: h.description
            }))
          : [];

        let bodyType: 'none' | 'json' | 'form' | 'raw' = 'none';
        let bodyContent = '';

        if (req.body) {
          if (req.body.mode === 'raw') {
            bodyContent = req.body.raw || '';
            bodyType = bodyContent.trim().startsWith('{') ? 'json' : 'raw';
          }
        }

        requests.push({
          id: generateId('req'),
          name: item.name || `${method} ${urlStr}`,
          method,
          url: urlStr,
          description: req.description || '',
          headers,
          params: [],
          bodyType,
          bodyContent,
          assertions: [
            {
              id: generateId('as'),
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Status code is 200 OK',
              enabled: true
            }
          ],
          extractVariables: [],
          enabled: true,
          folder: folderName
        });
      }
    }
  }

  if (Array.isArray(parsed.item)) {
    processItems(parsed.item);
  }

  return {
    id: generateId('col'),
    name: collectionName,
    description: collectionDescription,
    category: 'integration',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requests
  };
}
