export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey';

export interface ApiHeader {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface ApiParam {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface ApiAuth {
  type: AuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
}

export type AssertionType = 
  | 'status_code' 
  | 'response_time' 
  | 'json_body_contains' 
  | 'json_path_value' 
  | 'header_exists' 
  | 'header_equals' 
  | 'custom_script';

export type AssertionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'greater_than' 
  | 'less_than' 
  | 'exists' 
  | 'is_null' 
  | 'regex';

export interface ApiAssertion {
  id: string;
  type: AssertionType;
  target?: string; // e.g. json path "data.user.id" or header name "Content-Type"
  operator: AssertionOperator;
  expectedValue: string;
  description?: string;
  enabled: boolean;
}

export interface ApiVariableExtractor {
  id: string;
  source: 'json_body' | 'header' | 'status_code' | 'body_json' | 'regex';
  path: string; // e.g. "token" or "data.items[0].id"
  variableName: string; // e.g. "authToken"
  targetVariable?: string; // alias for variableName
  defaultValue?: string;
  enabled: boolean;
  description?: string;
}

export interface ApiRequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  description?: string;
  headers: ApiHeader[];
  params: ApiParam[];
  auth?: ApiAuth;
  bodyType: 'none' | 'json' | 'form' | 'raw';
  bodyContent?: string;
  assertions: ApiAssertion[];
  extractVariables: ApiVariableExtractor[];
  enabled: boolean;
  timeoutMs?: number;
  folder?: string;
}

export interface ApiAutomationCollection {
  id: string;
  name: string;
  description?: string;
  category?: 'smoke' | 'regression' | 'security' | 'integration' | 'performance';
  baseUrl?: string;
  auth?: ApiAuth;
  headers?: ApiHeader[];
  variables?: Record<string, string>;
  requests: ApiRequestItem[];
  webhookToken?: string;
  createdAt: string;
  updatedAt: string;
  lastRunStatus?: 'passed' | 'failed' | 'running' | 'idle';
  lastRunAt?: string;
  lastRunSummary?: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    passRate: number;
  };
}

export interface ApiEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  variables: Record<string, string>;
  headers?: ApiHeader[];
  isDefault?: boolean;
}

export interface ApiAssertionResult {
  assertionId: string;
  description: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  errorMessage?: string;
}

export interface ApiRequestExecutionResult {
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  status: 'passed' | 'failed' | 'skipped';
  httpStatus?: number;
  httpStatusText?: string;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  assertionResults: ApiAssertionResult[];
  extractedVariables?: Record<string, any>;
  error?: string;
}

export interface ApiTestExecutionRun {
  id: string;
  collectionId: string;
  collectionName: string;
  environmentName: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  durationMs: number;
  triggeredBy: 'manual_portal' | 'ci_webhook' | 'schedule';
  results: ApiRequestExecutionResult[];
}

// ============================================================================
// BRUNO & API FLOW TESTING MODELS
// ============================================================================

export type FlowStepCondition = 
  | 'always' 
  | 'only_if_prev_passed' 
  | 'skip_if_token_missing'
  | 'custom_expression';

export interface ApiFlowStep {
  id: string;
  stepNumber: number;
  name: string;
  description?: string;
  request: ApiRequestItem;
  condition: FlowStepCondition;
  customCondition?: string; // JS expression e.g. "vars.authToken && vars.status === 'active'"
  delayBeforeStepMs?: number;
  retryOnFailure?: {
    enabled: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
  stopFlowOnFailure?: boolean;
  brunoPreScript?: string; // Pre-request script e.g. req.setHeader('X-Trace', 'trace_' + Date.now())
  brunoPostScript?: string; // Post-response script e.g. bru.setVar('authToken', res.body.token)
  brunoAssertions?: {
    expression: string; // e.g. "res.status: eq 200", "res.body.token: isDefined"
    enabled: boolean;
  }[];
  extractors: ApiVariableExtractor[];
  assertions: ApiAssertion[];
}

export interface ApiTestFlow {
  id: string;
  name: string;
  description?: string;
  category?: 'e2e_journey' | 'auth_lifecycle' | 'order_checkout' | 'telemetry' | 'crud_lifecycle' | 'integration';
  collectionId?: string; // Associated parent collection
  globalVariables: Record<string, string>;
  steps: ApiFlowStep[];
  createdAt: string;
  updatedAt: string;
  lastRunStatus?: 'passed' | 'failed' | 'running' | 'cancelled' | 'idle';
  lastRunAt?: string;
  lastRunSummary?: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    durationMs: number;
    passRate: number;
  };
}

export interface ApiFlowStepExecutionResult {
  stepId: string;
  stepNumber: number;
  stepName: string;
  method: HttpMethod;
  url: string;
  status: 'passed' | 'failed' | 'skipped';
  httpStatus?: number;
  httpStatusText?: string;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  assertionResults: ApiAssertionResult[];
  extractedVariables: Record<string, any>;
  variablesSnapshotBefore: Record<string, any>;
  variablesSnapshotAfter: Record<string, any>;
  retriesAttempted?: number;
  error?: string;
}

export interface ApiFlowExecutionRun {
  id: string;
  flowId: string;
  flowName: string;
  environmentName: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  durationMs: number;
  stepResults: ApiFlowStepExecutionResult[];
  initialVariables: Record<string, any>;
  finalVariables: Record<string, any>;
  triggeredBy: 'manual_portal' | 'ci_webhook' | 'flow_debugger';
  error?: string;
}

export interface BrunoFileRepresentation {
  filename: string;
  path: string;
  bruContent: string;
  request: ApiRequestItem;
  seq?: number;
}
