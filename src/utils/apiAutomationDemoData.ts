import { ApiAutomationCollection, ApiEnvironment, ApiTestExecutionRun } from '../types/apiAutomation';

export const INITIAL_API_ENVIRONMENTS: ApiEnvironment[] = [
  {
    id: 'env-local',
    name: 'Development (Current Host)',
    baseUrl: window.location.origin || 'http://localhost:3000',
    description: 'Current portal server instance with simulated and live proxy endpoints',
    isDefault: true,
    variables: {
      baseUrl: window.location.origin || 'http://localhost:3000',
      apiKey: 'dev-key-northstar-2026',
      projectCode: 'ACM',
      timeoutLimit: '2500'
    },
    headers: [
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'X-Portal-Client', value: 'Northstar-Automation-Engine', enabled: true }
    ]
  },
  {
    id: 'env-qa-staging',
    name: 'QA & Staging Server',
    baseUrl: 'https://staging-api.att-connection-manager.internal',
    description: 'Staging environment for release validation and regression suites',
    isDefault: false,
    variables: {
      baseUrl: 'https://staging-api.att-connection-manager.internal',
      apiKey: 'qa-staging-secret-key-778',
      projectCode: 'ACM',
      timeoutLimit: '5000'
    },
    headers: [
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'X-Environment', value: 'staging', enabled: true }
    ]
  },
  {
    id: 'env-prod',
    name: 'Production (Smoke Only)',
    baseUrl: 'https://api.att-connection-manager.internal',
    description: 'Live production endpoints with strict read-only smoke validations',
    isDefault: false,
    variables: {
      baseUrl: 'https://api.att-connection-manager.internal',
      apiKey: 'prod-read-token-live',
      projectCode: 'ACM',
      timeoutLimit: '1500'
    },
    headers: [
      { key: 'Accept', value: 'application/json', enabled: true }
    ]
  }
];

export const INITIAL_API_COLLECTIONS: ApiAutomationCollection[] = [
  {
    id: 'col-auth-session',
    name: 'ACM Core Authentication & Session API',
    description: 'Validates JWT token issuance, session resolution, RBAC role scopes, and service health checks.',
    category: 'smoke',
    baseUrl: '{{baseUrl}}',
    webhookToken: 'whk_auth_sec_8921a4f02',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastRunStatus: 'passed',
    lastRunAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastRunSummary: {
      total: 3,
      passed: 3,
      failed: 0,
      durationMs: 245,
      passRate: 100
    },
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Accept', value: 'application/json', enabled: true }
    ],
    variables: {
      adminEmail: 'admin@northstar.delivery',
      expectedRole: 'Administrator'
    },
    requests: [
      {
        id: 'req-health-check',
        name: '1. Service Health & Engine Probe',
        method: 'GET',
        url: '{{baseUrl}}/api/health',
        description: 'Verifies backend gateway status, timestamp precision, and Gemini AI connectivity.',
        enabled: true,
        timeoutMs: 3000,
        headers: [],
        params: [],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-health-status-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status code must be 200 OK',
            enabled: true
          },
          {
            id: 'as-health-time-limit',
            type: 'response_time',
            operator: 'less_than',
            expectedValue: '1000',
            description: 'Gateway response latency under 1000ms',
            enabled: true
          },
          {
            id: 'as-health-body-status',
            type: 'json_path_value',
            target: 'status',
            operator: 'equals',
            expectedValue: 'ok',
            description: 'Response payload status must equal "ok"',
            enabled: true
          }
        ],
        extractVariables: []
      },
      {
        id: 'req-auth-token',
        name: '2. Acquire Session JWT Token',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/token',
        description: 'Issues an authenticated JWT session with RBAC permissions payload.',
        enabled: true,
        timeoutMs: 4000,
        headers: [
          { key: 'Content-Type', value: 'application/json', enabled: true }
        ],
        params: [],
        bodyType: 'json',
        bodyContent: JSON.stringify({
          userId: 'usr-admin-01',
          name: 'Sarah Chen (Lead)',
          email: '{{adminEmail}}',
          role: 'Administrator'
        }, null, 2),
        assertions: [
          {
            id: 'as-auth-token-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status is 200 OK',
            enabled: true
          },
          {
            id: 'as-auth-has-token',
            type: 'json_path_value',
            target: 'token',
            operator: 'exists',
            expectedValue: 'true',
            description: 'Response contains signed JWT token string',
            enabled: true
          }
        ],
        extractVariables: [
          {
            id: 'ex-jwt-token',
            source: 'json_body',
            path: 'token',
            variableName: 'jwtToken',
            enabled: true,
            description: 'Extracts session JWT for subsequent authenticated requests'
          }
        ]
      },
      {
        id: 'req-auth-session-check',
        name: '3. Verify Session Identity & Scopes',
        method: 'GET',
        url: '{{baseUrl}}/api/auth/session',
        description: 'Validates token signature and extracts role permissions using Bearer Authorization.',
        enabled: true,
        timeoutMs: 3000,
        headers: [
          { key: 'Authorization', value: 'Bearer {{jwtToken}}', enabled: true }
        ],
        params: [],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-session-status-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status is 200 OK',
            enabled: true
          },
          {
            id: 'as-session-role-admin',
            type: 'json_path_value',
            target: 'role',
            operator: 'equals',
            expectedValue: '{{expectedRole}}',
            description: 'Authenticated role matches expected role',
            enabled: true
          }
        ],
        extractVariables: []
      }
    ]
  },
  {
    id: 'col-delivery-workitems',
    name: 'Work Items & ADO Integration Suite',
    description: 'Automated test suite verifying workitem querying, classification, sync status, and release gate checks.',
    category: 'integration',
    baseUrl: '{{baseUrl}}',
    webhookToken: 'whk_delivery_902bc51e',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    lastRunStatus: 'passed',
    lastRunAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    lastRunSummary: {
      total: 3,
      passed: 3,
      failed: 0,
      durationMs: 380,
      passRate: 100
    },
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    variables: {
      searchQuery: 'ACM',
      minWorkItems: '1'
    },
    requests: [
      {
        id: 'req-query-workitems',
        name: '1. Query Active Work Items',
        method: 'GET',
        url: '{{baseUrl}}/api/ado/workitems?search={{searchQuery}}',
        description: 'Retrieves current user stories, test cases, and tasks with active search filter.',
        enabled: true,
        timeoutMs: 4000,
        headers: [],
        params: [
          { key: 'search', value: '{{searchQuery}}', enabled: true, description: 'Target project code filter' }
        ],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-workitems-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status 200 OK',
            enabled: true
          },
          {
            id: 'as-workitems-array-returned',
            type: 'json_path_value',
            target: 'ok',
            operator: 'equals',
            expectedValue: 'true',
            description: 'Response payload returns ok: true',
            enabled: true
          }
        ],
        extractVariables: []
      },
      {
        id: 'req-validate-sync-status',
        name: '2. ADO Dual Connection Health',
        method: 'GET',
        url: '{{baseUrl}}/api/ado/status',
        description: 'Probes internal and customer ADO endpoints configuration validity.',
        enabled: true,
        timeoutMs: 3000,
        headers: [],
        params: [],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-ado-status-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status 200 OK',
            enabled: true
          }
        ],
        extractVariables: []
      },
      {
        id: 'req-release-gate-check',
        name: '3. Release Quality Gate Verification',
        method: 'GET',
        url: '{{baseUrl}}/api/health',
        description: 'Verifies release gate constraints and sign-off prerequisites.',
        enabled: true,
        timeoutMs: 3000,
        headers: [],
        params: [],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-gate-status-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status 200 OK',
            enabled: true
          },
          {
            id: 'as-gate-latency-fast',
            type: 'response_time',
            operator: 'less_than',
            expectedValue: '800',
            description: 'Gate latency < 800ms',
            enabled: true
          }
        ],
        extractVariables: []
      }
    ]
  },
  {
    id: 'col-defects-incident-suite',
    name: 'Defects & Incident SLA Automation',
    description: 'Ensures defect reporting endpoints, severity escalations, and regression triage APIs conform to SLA specifications.',
    category: 'regression',
    baseUrl: '{{baseUrl}}',
    webhookToken: 'whk_defects_c3021f98',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    lastRunStatus: 'passed',
    lastRunAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastRunSummary: {
      total: 2,
      passed: 2,
      failed: 0,
      durationMs: 190,
      passRate: 100
    },
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    variables: {
      defectId: 'DEF-802',
      severity: 'critical'
    },
    requests: [
      {
        id: 'req-query-defects',
        name: '1. Scan High Severity Open Defects',
        method: 'GET',
        url: '{{baseUrl}}/api/health',
        description: 'Pulls open critical defects for QA blocker notification.',
        enabled: true,
        timeoutMs: 3000,
        headers: [],
        params: [],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-def-status-200',
            type: 'status_code',
            operator: 'equals',
            expectedValue: '200',
            description: 'HTTP Status 200 OK',
            enabled: true
          }
        ],
        extractVariables: []
      },
      {
        id: 'req-triage-sla-check',
        name: '2. Validate Triage SLA Response Time',
        method: 'GET',
        url: '{{baseUrl}}/api/health',
        description: 'Checks SLA reporting telemetry response integrity.',
        enabled: true,
        timeoutMs: 2000,
        headers: [],
        params: [],
        bodyType: 'none',
        assertions: [
          {
            id: 'as-sla-time-limit',
            type: 'response_time',
            operator: 'less_than',
            expectedValue: '500',
            description: 'Response time strictly within 500ms SLA',
            enabled: true
          }
        ],
        extractVariables: []
      }
    ]
  }
];

export const INITIAL_API_EXECUTION_RUNS: ApiTestExecutionRun[] = [
  {
    id: 'run-hist-001',
    collectionId: 'col-auth-session',
    collectionName: 'ACM Core Authentication & Session API',
    environmentName: 'Development (Current Host)',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2 + 245).toISOString(),
    status: 'passed',
    totalRequests: 3,
    passedRequests: 3,
    failedRequests: 0,
    totalAssertions: 7,
    passedAssertions: 7,
    failedAssertions: 0,
    durationMs: 245,
    triggeredBy: 'manual_portal',
    results: [
      {
        requestId: 'req-health-check',
        requestName: '1. Service Health & Engine Probe',
        method: 'GET',
        url: 'http://localhost:3000/api/health',
        status: 'passed',
        httpStatus: 200,
        httpStatusText: 'OK',
        durationMs: 42,
        requestHeaders: { 'Accept': 'application/json' },
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: { status: 'ok', time: new Date().toISOString(), aiReady: true },
        assertionResults: [
          {
            assertionId: 'as-health-status-200',
            description: 'HTTP Status code must be 200 OK',
            passed: true,
            actual: 200,
            expected: 200
          },
          {
            assertionId: 'as-health-time-limit',
            description: 'Gateway response latency under 1000ms',
            passed: true,
            actual: 42,
            expected: 1000
          },
          {
            assertionId: 'as-health-body-status',
            description: 'Response payload status must equal "ok"',
            passed: true,
            actual: 'ok',
            expected: 'ok'
          }
        ],
        extractedVariables: {}
      },
      {
        requestId: 'req-auth-token',
        requestName: '2. Acquire Session JWT Token',
        method: 'POST',
        url: 'http://localhost:3000/api/auth/token',
        status: 'passed',
        httpStatus: 200,
        httpStatusText: 'OK',
        durationMs: 110,
        requestHeaders: { 'Content-Type': 'application/json' },
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: { ok: true, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3ItYWRtaW4tMDEiLCJyb2xlIjoiQWRtaW5pc3RyYXRvciJ9.sig_sample_preview', expiresAt: new Date(Date.now() + 86400000).toISOString() },
        assertionResults: [
          {
            assertionId: 'as-auth-token-200',
            description: 'HTTP Status is 200 OK',
            passed: true,
            actual: 200,
            expected: 200
          },
          {
            assertionId: 'as-auth-has-token',
            description: 'Response contains signed JWT token string',
            passed: true,
            actual: 'present',
            expected: 'true'
          }
        ],
        extractedVariables: {
          jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3ItYWRtaW4tMDEiLCJyb2xlIjoiQWRtaW5pc3RyYXRvciJ9.sig_sample_preview'
        }
      },
      {
        requestId: 'req-auth-session-check',
        requestName: '3. Verify Session Identity & Scopes',
        method: 'GET',
        url: 'http://localhost:3000/api/auth/session',
        status: 'passed',
        httpStatus: 200,
        httpStatusText: 'OK',
        durationMs: 93,
        requestHeaders: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1Ni...' },
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: { ok: true, userId: 'usr-admin-01', role: 'Administrator', permissions: { canRunTests: true, canManageReleases: true } },
        assertionResults: [
          {
            assertionId: 'as-session-status-200',
            description: 'HTTP Status is 200 OK',
            passed: true,
            actual: 200,
            expected: 200
          },
          {
            assertionId: 'as-session-role-admin',
            description: 'Authenticated role matches expected role',
            passed: true,
            actual: 'Administrator',
            expected: 'Administrator'
          }
        ],
        extractedVariables: {}
      }
    ]
  }
];
