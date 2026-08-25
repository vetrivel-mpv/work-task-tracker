import JSZip from 'jszip';
import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiRequestItem, 
  ApiTestFlow, 
  ApiFlowStep 
} from '../types/apiAutomation';
import { interpolateVariables } from './apiAutomationEngine';

/**
 * Normalizes string to safe variable or function name
 */
function toSafeIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

/**
 * Sanitizes test name for Playwright test blocks
 */
function sanitizeTestName(str: string): string {
  return str.replace(/['"\\]/g, '').trim();
}

/**
 * Generates a full TypeScript Playwright API test spec (.spec.ts) from an ApiAutomationCollection
 */
export function generatePlaywrightSpecFromCollection(
  collection: ApiAutomationCollection,
  environment?: ApiEnvironment | null
): string {
  const mergedVariables = {
    baseUrl: environment?.baseUrl || collection.baseUrl || 'http://localhost:3000',
    ...(environment?.variables || {}),
    ...(collection.variables || {})
  };

  const suiteTitle = sanitizeTestName(collection.name || 'API Automation Suite');
  const collectionDesc = collection.description ? `// ${collection.description}\n` : '';

  const requestTests = collection.requests
    .filter(r => r.enabled)
    .map((req, index) => {
      const testName = sanitizeTestName(req.name || `Request #${index + 1}`);
      const method = req.method.toLowerCase();
      let resolvedUrl = interpolateVariables(req.url, mergedVariables);
      
      // If URL has path parameters or placeholders, show dynamic interpolation
      const hasPlaceholders = /\{\{[^}]+\}\}/.test(req.url);

      // Headers construction
      const headerEntries: string[] = [];
      
      // Auth header
      if (req.auth) {
        if (req.auth.type === 'bearer' && req.auth.bearerToken) {
          const token = interpolateVariables(req.auth.bearerToken, mergedVariables);
          headerEntries.push(`      'Authorization': 'Bearer ${token}'`);
        } else if (req.auth.type === 'basic') {
          const u = interpolateVariables(req.auth.basicUsername || '', mergedVariables);
          const p = interpolateVariables(req.auth.basicPassword || '', mergedVariables);
          const b64 = Buffer.from(`${u}:${p}`).toString('base64');
          headerEntries.push(`      'Authorization': 'Basic ${b64}'`);
        } else if (req.auth.type === 'apikey' && req.auth.apiKeyName && req.auth.apiKeyValue && req.auth.apiKeyIn !== 'query') {
          const k = interpolateVariables(req.auth.apiKeyName, mergedVariables);
          const v = interpolateVariables(req.auth.apiKeyValue, mergedVariables);
          headerEntries.push(`      '${k}': '${v}'`);
        }
      }

      (req.headers || []).filter(h => h.enabled && h.key).forEach(h => {
        const val = interpolateVariables(h.value, mergedVariables);
        headerEntries.push(`      '${h.key}': '${val}'`);
      });

      // Query params
      const queryParams = (req.params || []).filter(p => p.enabled && p.key);
      const paramsObjEntries: string[] = queryParams.map(p => {
        const pKey = interpolateVariables(p.key, mergedVariables);
        const pVal = interpolateVariables(p.value, mergedVariables);
        return `      '${pKey}': '${pVal}'`;
      });

      // Body options
      let bodyOption = '';
      if (req.bodyType === 'json' && req.bodyContent) {
        try {
          const parsed = JSON.parse(interpolateVariables(req.bodyContent, mergedVariables));
          bodyOption = `      data: ${JSON.stringify(parsed, null, 8).trimStart()},\n`;
        } catch {
          bodyOption = `      data: ${JSON.stringify(interpolateVariables(req.bodyContent, mergedVariables))},\n`;
        }
      } else if (req.bodyType === 'raw' && req.bodyContent) {
        bodyOption = `      data: ${JSON.stringify(interpolateVariables(req.bodyContent, mergedVariables))},\n`;
      }

      // Assertions translation to Playwright expect(...)
      const assertionLines: string[] = [];
      const hasJsonAssertions = req.assertions.some(a => a.type === 'json_path_value' || a.type === 'json_body_contains');

      (req.assertions || []).filter(a => a.enabled).forEach(a => {
        const expectedVal = interpolateVariables(a.expectedValue, mergedVariables);

        if (a.type === 'status_code') {
          const code = parseInt(expectedVal, 10) || 200;
          if (a.operator === 'equals') {
            assertionLines.push(`    // Validate HTTP Status code\n    expect(response.status()).toBe(${code});`);
          } else if (a.operator === 'less_than') {
            assertionLines.push(`    expect(response.status()).toBeLessThan(${code});`);
          } else if (a.operator === 'greater_than') {
            assertionLines.push(`    expect(response.status()).toBeGreaterThan(${code});`);
          } else if (a.operator === 'not_equals') {
            assertionLines.push(`    expect(response.status()).not.toBe(${code});`);
          }
        } else if (a.type === 'response_time') {
          const maxMs = parseFloat(expectedVal) || 1000;
          assertionLines.push(`    // Validate SLA Response Time\n    expect(durationMs).toBeLessThanOrEqual(${maxMs});`);
        } else if (a.type === 'header_exists' && a.target) {
          assertionLines.push(`    // Validate Header Existence\n    expect(response.headers()['${a.target.toLowerCase()}']).toBeDefined();`);
        } else if (a.type === 'header_equals' && a.target) {
          assertionLines.push(`    // Validate Header Value\n    expect(response.headers()['${a.target.toLowerCase()}']).toContain('${expectedVal}');`);
        } else if (a.type === 'json_body_contains') {
          assertionLines.push(`    // Validate Body Content Substring\n    expect(await response.text()).toContain('${expectedVal}');`);
        } else if (a.type === 'json_path_value' && a.target) {
          const pathAccess = a.target.startsWith('$') ? a.target.replace(/^\$\.?/, '') : a.target;
          if (a.operator === 'equals') {
            const isNum = !isNaN(Number(expectedVal)) && expectedVal.trim() !== '';
            const valExpr = isNum ? expectedVal : `'${expectedVal}'`;
            assertionLines.push(`    expect(jsonBody.${pathAccess}).toBe(${valExpr});`);
          } else if (a.operator === 'exists') {
            assertionLines.push(`    expect(jsonBody.${pathAccess}).toBeDefined();`);
          } else if (a.operator === 'contains') {
            assertionLines.push(`    expect(String(jsonBody.${pathAccess})).toContain('${expectedVal}');`);
          } else if (a.operator === 'not_equals') {
            assertionLines.push(`    expect(jsonBody.${pathAccess}).not.toBe('${expectedVal}');`);
          } else if (a.operator === 'regex') {
            assertionLines.push(`    expect(String(jsonBody.${pathAccess})).toMatch(new RegExp('${expectedVal}'));`);
          }
        }
      });

      // Default assertion if none present
      if (assertionLines.length === 0) {
        assertionLines.push('    expect(response.ok()).toBeTruthy();');
      }

      // Variable extraction comments
      const extractionLines: string[] = [];
      (req.extractVariables || []).filter(e => e.enabled).forEach(e => {
        const varName = e.variableName || e.targetVariable || 'extractedVal';
        if (e.source === 'json_body') {
          extractionLines.push(`    const ${toSafeIdentifier(varName)} = jsonBody.${e.path};`);
        } else if (e.source === 'header') {
          extractionLines.push(`    const ${toSafeIdentifier(varName)} = response.headers()['${e.path.toLowerCase()}'];`);
        }
      });

      const optionsContent: string[] = [];
      if (headerEntries.length > 0) {
        optionsContent.push(`      headers: {\n${headerEntries.join(',\n')}\n      }`);
      }
      if (paramsObjEntries.length > 0) {
        optionsContent.push(`      params: {\n${paramsObjEntries.join(',\n')}\n      }`);
      }
      if (bodyOption) {
        optionsContent.push(bodyOption.trimEnd());
      }

      const optionsBlock = optionsContent.length > 0 
        ? `,\n    {\n${optionsContent.join(',\n')}\n    }`
        : '';

      return `  test('${testName}', async ({ request }) => {
    const startTime = Date.now();

    // Send HTTP ${req.method} Request via Playwright APIRequestContext
    const response = await request.${method}('${resolvedUrl}'${optionsBlock});
    const durationMs = Date.now() - startTime;

${hasJsonAssertions || extractionLines.length > 0 ? `    // Parse JSON Response\n    const jsonBody = await response.json().catch(() => ({}));\n\n` : ''}${assertionLines.join('\n\n')}${extractionLines.length > 0 ? `\n\n    // Variable Extractors\n${extractionLines.join('\n')}` : ''}
  });`;
    }).join('\n\n');

  return `import { test, expect } from '@playwright/test';

/**
 * Playwright API Automation Suite
 * Suite: ${suiteTitle}
 * Framework: @playwright/test (Native TypeScript API Testing)
 * Generated by Northstar Delivery Platform
 */
${collectionDesc}test.describe('${suiteTitle}', () => {

${requestTests}

});
`;
}

/**
 * Generates an end-to-end serialized Playwright API test (.spec.ts) from an ApiTestFlow
 * Chaining runtime variables across steps (auth tokens, entity IDs, timestamps)
 */
export function generatePlaywrightSpecFromFlow(
  flow: ApiTestFlow,
  environment?: ApiEnvironment | null
): string {
  const mergedVariables = {
    baseUrl: environment?.baseUrl || flow.globalVariables?.baseUrl || 'http://localhost:3000',
    ...(environment?.variables || {}),
    ...(flow.globalVariables || {})
  };

  const flowTitle = sanitizeTestName(flow.name || 'API End-to-End Test Journey');

  // Collect all extracted variable names to declare at top of describe block
  const stateVariables = new Set<string>();
  flow.steps.forEach(s => {
    (s.extractors || []).forEach(e => {
      const name = e.variableName || e.targetVariable;
      if (name) stateVariables.add(name);
    });
    (s.request?.extractVariables || []).forEach(e => {
      const name = e.variableName || e.targetVariable;
      if (name) stateVariables.add(name);
    });
  });

  const stateDeclarations = Array.from(stateVariables)
    .map(v => `  let ${toSafeIdentifier(v)}: any = undefined;`)
    .join('\n');

  const stepTests = flow.steps.map((step, idx) => {
    const stepNum = idx + 1;
    const testName = `Step ${stepNum}: ${sanitizeTestName(step.name)}`;
    const method = step.request.method.toLowerCase();
    const rawUrl = step.request.url;

    // Convert {{variableName}} into ${variableName} or template literal string
    const dynamicUrl = rawUrl.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (_, key) => {
      if (stateVariables.has(key)) {
        return `\${${toSafeIdentifier(key)}}`;
      }
      if (mergedVariables[key]) {
        return mergedVariables[key];
      }
      return `\${${toSafeIdentifier(key)}}`;
    });

    const isTemplateUrl = dynamicUrl.includes('${');
    const formattedUrl = isTemplateUrl ? `\`${dynamicUrl}\`` : `'${dynamicUrl}'`;

    // Headers with dynamic variables
    const headerEntries: string[] = [];
    (step.request.headers || []).filter(h => h.enabled && h.key).forEach(h => {
      let val = h.value.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (_, key) => {
        if (stateVariables.has(key)) return `\${${toSafeIdentifier(key)}}`;
        return mergedVariables[key] || `\${${toSafeIdentifier(key)}}`;
      });
      if (val.includes('${')) {
        headerEntries.push(`      '${h.key}': \`${val}\``);
      } else {
        headerEntries.push(`      '${h.key}': '${val}'`);
      }
    });

    // Body
    let bodyOption = '';
    if (step.request.bodyType === 'json' && step.request.bodyContent) {
      bodyOption = `      data: ${step.request.bodyContent},\n`;
    }

    // Assertions
    const assertionLines: string[] = [];
    (step.assertions || []).filter(a => a.enabled).forEach(a => {
      if (a.type === 'status_code') {
        const code = parseInt(a.expectedValue, 10) || 200;
        assertionLines.push(`    // Assert HTTP Status Code\n    expect(response.status()).toBe(${code});`);
      } else if (a.type === 'response_time') {
        const maxMs = parseFloat(a.expectedValue) || 1500;
        assertionLines.push(`    expect(durationMs).toBeLessThanOrEqual(${maxMs});`);
      } else if (a.type === 'json_path_value' && a.target) {
        assertionLines.push(`    expect(jsonBody.${a.target}).toBe(${JSON.stringify(a.expectedValue)});`);
      }
    });

    if (assertionLines.length === 0) {
      assertionLines.push('    expect(response.ok()).toBeTruthy();');
    }

    // Extractors (save into module-scoped state variables)
    const extractionLines: string[] = [];
    (step.extractors || []).forEach(e => {
      const varName = e.variableName || e.targetVariable;
      if (varName) {
        if (e.source === 'json_body' || e.source === 'body_json') {
          extractionLines.push(`    // Extract ${varName} for downstream steps\n    ${toSafeIdentifier(varName)} = jsonBody.${e.path};`);
          extractionLines.push(`    expect(${toSafeIdentifier(varName)}, 'Failed to extract ${varName}').toBeDefined();`);
        } else if (e.source === 'header') {
          extractionLines.push(`    ${toSafeIdentifier(varName)} = response.headers()['${e.path.toLowerCase()}'];`);
        }
      }
    });

    // Delay if specified
    const delayBlock = step.delayBeforeStepMs && step.delayBeforeStepMs > 0 
      ? `    // Intentional flow delay\n    await new Promise(r => setTimeout(r, ${step.delayBeforeStepMs}));\n\n`
      : '';

    const optionsContent: string[] = [];
    if (headerEntries.length > 0) {
      optionsContent.push(`      headers: {\n${headerEntries.join(',\n')}\n      }`);
    }
    if (bodyOption) {
      optionsContent.push(bodyOption.trimEnd());
    }

    const optionsBlock = optionsContent.length > 0 
      ? `,\n    {\n${optionsContent.join(',\n')}\n    }`
      : '';

    return `  test('${testName}', async ({ request }) => {
${delayBlock}    const startTime = Date.now();

    const response = await request.${method}(${formattedUrl}${optionsBlock});
    const durationMs = Date.now() - startTime;

    const jsonBody = await response.json().catch(() => ({}));

${assertionLines.join('\n\n')}

${extractionLines.length > 0 ? `${extractionLines.join('\n')}\n` : ''}  });`;
  }).join('\n\n');

  return `import { test, expect } from '@playwright/test';

/**
 * Playwright Chained API Test Flow
 * Flow: ${flowTitle}
 * Category: ${flow.category || 'e2e_journey'}
 * Serial execution preserves in-memory state and passes dynamic variables across steps.
 */
test.describe.serial('${flowTitle}', () => {
  // Shared Flow State Variables
${stateDeclarations || '  // No shared variables'}

${stepTests}

});
`;
}

/**
 * Generates playwright.config.ts configured specifically for API testing
 */
export function generatePlaywrightConfigTs(baseUrl: string = 'http://localhost:3000'): string {
  return `import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30000,
  
  // High-performance API Reporters
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'results/junit.xml' }],
    ['list']
  ],

  use: {
    // Base URL for APIRequestContext
    baseURL: process.env.API_BASE_URL || '${baseUrl}',

    // Default headers for all API requests
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },

    // Record tracing on failures for debugging
    trace: 'on-first-retry',
  },
});
`;
}

/**
 * Generates package.json with scripts and dependencies for Playwright API testing
 */
export function generatePlaywrightPackageJson(suiteName: string = 'api-automation-playwright'): string {
  const safeName = suiteName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return JSON.stringify({
    name: `@northstar/${safeName}`,
    version: '1.0.0',
    description: 'Enterprise API Test Automation Suite powered by @playwright/test',
    scripts: {
      'test:api': 'playwright test',
      'test:api:ui': 'playwright test --ui',
      'test:api:debug': 'playwright test --debug',
      'test:api:report': 'playwright show-report',
      'test:api:ci': 'playwright test --reporter=junit,html',
      'lint': 'tsc --noEmit'
    },
    devDependencies: {
      '@playwright/test': '^1.50.0',
      '@types/node': '^20.11.0',
      'dotenv': '^16.4.5',
      'typescript': '^5.3.3',
      'zod': '^3.22.4'
    }
  }, null, 2);
}

/**
 * Generates custom Playwright fixture for pre-authenticated API context and logging
 */
export function generatePlaywrightFixturesFile(): string {
  return `import { test as base, expect, APIRequestContext } from '@playwright/test';

type ApiFixtures = {
  // Pre-authenticated API Request Context
  authenticatedRequest: APIRequestContext;
  // Request logger helper
  logApiResponse: (stepName: string, status: number, durationMs: number) => void;
};

export const test = base.extend<ApiFixtures>({
  // Custom fixture to obtain Bearer Token and return authenticated context
  authenticatedRequest: async ({ playwright }, use) => {
    const apiContext = await playwright.request.newContext({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Authorization': \`Bearer \${process.env.API_AUTH_TOKEN || 'mock-jwt-token'}\`
      }
    });

    await use(apiContext);
    await apiContext.dispose();
  },

  logApiResponse: async ({}, use) => {
    await use((stepName: string, status: number, durationMs: number) => {
      console.log(\`[Playwright API] \${stepName} -> Status: \${status} (\${durationMs}ms)\`);
    });
  }
});

export { expect };
`;
}

/**
 * Generates Zod schema validation spec example for Playwright API testing
 */
export function generatePlaywrightZodSchemaSpec(collectionName: string = 'Core API'): string {
  return `import { test, expect } from '@playwright/test';
import { z } from 'zod';

/**
 * Zod Schema Definitions for Runtime Contract Testing
 */
const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'healthy', 'ready']),
  timestamp: z.string().optional(),
  uptime: z.number().optional()
});

const UserItemSchema = z.object({
  id: z.string().or(z.number()),
  username: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional()
});

const UsersListResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.array(UserItemSchema).optional(),
  total: z.number().optional()
});

test.describe('${collectionName} - Schema Contract Validation', () => {

  test('GET /api/health matches HealthResponseSchema', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const parseResult = HealthResponseSchema.safeParse(body);
    
    // Strict schema assertion
    expect(parseResult.success, \`Schema mismatch: \${JSON.stringify(parseResult.error?.format())}\`).toBe(true);
  });

  test('GET /api/users matches UsersListResponseSchema', async ({ request }) => {
    const response = await request.get('/api/users');
    expect(response.status()).toBeLessThan(400);

    const body = await response.json();
    const parseResult = UsersListResponseSchema.safeParse(body);
    expect(parseResult.success).toBe(true);
  });

});
`;
}

/**
 * Generates ready-to-run Azure DevOps Pipeline YAML definition for Playwright API testing
 */
export function generatePlaywrightAzureDevOpsYaml(suiteName: string = 'api-suite'): string {
  const safeName = suiteName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `trigger:
  branches:
    include:
      - main
      - release/*
  paths:
    include:
      - 'src/api/**'
      - 'tests/api/**'

pool:
  vmImage: 'ubuntu-latest'

variables:
  - name: API_BASE_URL
    value: 'https://staging-api.delivery.acm.internal'
  - group: acm-delivery-secrets

stages:
  - stage: PlaywrightApiAutomation
    displayName: 'Playwright API Quality Gate'
    jobs:
      - job: ExecutePlaywrightApiSuite
        displayName: 'Run @playwright/test API Suite'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js 20'

          - script: |
              npm ci
              npx playwright install --with-deps
            displayName: 'Install NPM Dependencies & Playwright'

          - script: |
              npx playwright test --reporter=junit,html
            displayName: 'Execute Playwright API Tests'
            env:
              API_BASE_URL: $(API_BASE_URL)
              API_AUTH_TOKEN: $(API_KEY)
              CI: 'true'

          - task: PublishTestResults@2
            displayName: 'Publish Playwright JUnit Test Results'
            condition: always()
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: 'results/junit.xml'
              failTaskOnFailedTests: true
              testRunTitle: 'Playwright API Test Quality Gate'

          - task: PublishBuildArtifacts@1
            displayName: 'Publish Playwright HTML Test Report'
            condition: always()
            inputs:
              PathtoPublish: 'playwright-report'
              ArtifactName: 'playwright-api-report'
`;
}

/**
 * Generates copyable GitHub Actions workflow YAML for Playwright API testing
 */
export function generatePlaywrightGitHubActionsYaml(suiteName: string = 'api-suite'): string {
  return `name: Playwright API Automation Quality Gates

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 4 * * 1-5' # Automated Daily 4 AM Smoke Suite
  workflow_dispatch:

jobs:
  playwright-api-tests:
    name: Run @playwright/test API Suite
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Playwright API Tests
        run: npx playwright test
        env:
          API_BASE_URL: \${{ secrets.API_BASE_URL }}
          API_AUTH_TOKEN: \${{ secrets.API_AUTH_TOKEN }}
          CI: true

      - name: Upload Playwright HTML Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-api-report
          path: playwright-report/
          retention-days: 30
`;
}

/**
 * Generates copyable CLI commands for developers running Playwright locally
 */
export function generatePlaywrightCliCommands(specName: string = 'api-suite.spec.ts'): string {
  return `# 1. Initialize Playwright in your repository
npm init playwright@latest -- --yes

# 2. Run all Playwright API Tests
npx playwright test

# 3. Run interactive Playwright Test UI Mode (Recommended)
npx playwright test --ui

# 4. Run specific test file in debug mode
npx playwright test tests/api/${specName} --debug

# 5. Open Playwright HTML Test Results Report
npx playwright show-report`;
}

/**
 * Generates a full zip bundle of the Playwright API testing project using JSZip
 */
export async function downloadPlaywrightProjectZip(
  target: ApiAutomationCollection | ApiTestFlow,
  environment?: ApiEnvironment | null,
  isFlow: boolean = false
): Promise<Blob> {
  const zip = new JSZip();
  const name = target.name || 'playwright-api-suite';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseUrl = environment?.baseUrl || (target as any).baseUrl || 'http://localhost:3000';

  // 1. package.json
  zip.file('package.json', generatePlaywrightPackageJson(name));

  // 2. playwright.config.ts
  zip.file('playwright.config.ts', generatePlaywrightConfigTs(baseUrl));

  // 3. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true
    },
    include: ['tests/**/*.ts', 'fixtures/**/*.ts', 'playwright.config.ts']
  };
  zip.file('tsconfig.json', JSON.stringify(tsconfig, null, 2));

  // 4. .env.example
  zip.file('.env.example', `API_BASE_URL=${baseUrl}\nAPI_AUTH_TOKEN=your-jwt-or-api-key\n`);

  // 5. fixtures/api-fixtures.ts
  zip.file('fixtures/api-fixtures.ts', generatePlaywrightFixturesFile());

  // 6. tests/api/
  if (isFlow) {
    const flowSpec = generatePlaywrightSpecFromFlow(target as ApiTestFlow, environment);
    zip.file(`tests/api/${slug}-flow.spec.ts`, flowSpec);
  } else {
    const colSpec = generatePlaywrightSpecFromCollection(target as ApiAutomationCollection, environment);
    zip.file(`tests/api/${slug}.spec.ts`, colSpec);
    zip.file(`tests/api/schema-validation.spec.ts`, generatePlaywrightZodSchemaSpec(name));
  }

  // 7. CI Workflows
  zip.file('.github/workflows/playwright-api.yml', generatePlaywrightGitHubActionsYaml(name));
  zip.file('azure-pipelines.yml', generatePlaywrightAzureDevOpsYaml(name));

  // 8. README.md
  const readme = `# ${name} - Playwright API Automation Suite

Automated API testing suite powered by **@playwright/test**.

## 🚀 Getting Started

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run API tests
npm run test:api

# 4. Open Playwright UI Mode
npm run test:api:ui

# 5. View Test Report
npm run test:api:report
\`\`\`

## 📁 Repository Structure
- \`tests/api/\`: Playwright test specs (.spec.ts)
- \`fixtures/\`: Custom request contexts and authenticated fixtures
- \`playwright.config.ts\`: Playwright test configuration
- \`.github/workflows/\`: Automated CI/CD quality gate
- \`azure-pipelines.yml\`: Azure DevOps pipeline definition

Generated by Northstar Delivery Platform.
`;
  zip.file('README.md', readme);

  return await zip.generateAsync({ type: 'blob' });
}
