import { getAuthHeaders } from '../utils/authClient';

export interface AdoIterationDto {
  id?: string | number;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
  timeFrame?: 'current' | 'past' | 'future';
  isCurrent?: boolean;
  level?: number;
  hasChildren?: boolean;
}

export interface AdoAreaDto {
  id?: string | number;
  name: string;
  path: string;
  level?: number;
  hasChildren?: boolean;
}

export interface AdoMetadataDiscoveryResult {
  ok: boolean;
  source?: string;
  org?: string;
  project?: string;
  currentIteration?: AdoIterationDto | null;
  iterations: AdoIterationDto[];
  areas: AdoAreaDto[];
  teams?: Array<{ id: string; name: string; description?: string }>;
  stats?: {
    totalIterations: number;
    totalAreas: number;
    activeIterationsCount: number;
  };
  error?: string;
}

export interface AdoWorkItemDto {
  id: string;
  adoId: number;
  title: string;
  status: string;
  areaPath: string;
  iterationPath: string;
  assigneeId?: string | null;
  assigneeName?: string;
  assigneeIds?: string[];
  createdById?: string | null;
  createdByName?: string;
  description?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  severity?: string;
  workItemType?: string;
  tags?: string[];
  sourceInstance?: 'internal' | 'external';
}

export interface AdoSyncResponse {
  ok: boolean;
  stories: AdoWorkItemDto[];
  defects: AdoWorkItemDto[];
  testCases?: AdoWorkItemDto[];
  tasks?: AdoWorkItemDto[];
  teamMembers?: Array<{
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatarColor?: string;
    source?: 'assigned_to' | 'created_by';
  }>;
  source?: string;
  error?: string;
  durationMs?: number;
  rawPayload?: any;
}

export interface FieldMappingDiff {
  adoId: number;
  title: string;
  rawType: string;
  mappedType: 'Story' | 'Defect';
  rawState: string;
  mappedStatus: string;
  rawArea: string;
  mappedArea: string;
  rawIteration: string;
  mappedIteration: string;
  rawAssignee: string;
  mappedAssignee: string;
  anomaly?: string;
}

export interface AdoSyncDiagnosticRecord {
  id: string;
  timestamp: string;
  targetInstance: 'all' | 'internal' | 'external';
  status: 'success' | 'warning' | 'error';
  org: string;
  project: string;
  areaPath: string;
  iterationPath: string;
  durationMs: number;
  source: string;
  itemsReceivedCount: number;
  storiesCount: number;
  defectsCount: number;
  wiqlQuery?: string;
  rawPayload: any;
  fieldMappings: FieldMappingDiff[];
  warnings: string[];
}

const STORAGE_KEY = 'northstar_ado_sync_diagnostics_history';

export interface AdoServerConfig {
  ok: boolean;
  hasServerPat: boolean;
  defaultOrg: string;
  defaultProject: string;
  proxyReady: boolean;
}

export interface AdoHealthResult {
  ok: boolean;
  status: 'healthy' | 'unhealthy' | 'unauthenticated' | 'error' | 'server_error';
  httpStatus?: number;
  message?: string;
  error?: string;
  hasToken: boolean;
  authMethod?: string;
  target?: {
    org: string;
    project: string;
    url: string;
    projectId?: string;
    projectState?: string;
    projectVisibility?: string;
  };
  durationMs?: number;
}

export const adoService = {
  async getServerConfig(): Promise<AdoServerConfig> {
    try {
      const res = await fetch('/api/ado/config', {
        headers: {
          ...getAuthHeaders()
        }
      });
      return await res.json();
    } catch {
      return { ok: false, hasServerPat: false, defaultOrg: 'simetricwdh', defaultProject: 'ACM', proxyReady: false };
    }
  },

  async checkHealth(org?: string, project?: string, pat?: string): Promise<AdoHealthResult> {
    try {
      const query = new URLSearchParams();
      if (org) query.set('org', org);
      if (project) query.set('project', project);
      if (pat) query.set('pat', pat);

      const qs = query.toString();
      const res = await fetch(`/api/ado/health${qs ? `?${qs}` : ''}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      return await res.json();
    } catch (err: any) {
      return {
        ok: false,
        status: 'server_error',
        error: err.message || 'Failed to reach ADO health endpoint',
        hasToken: Boolean(pat)
      };
    }
  },

  async testConnection(org: string, project: string, pat?: string): Promise<{ ok: boolean; error?: string; projects?: string[] }> {
    try {
      const res = await fetch('/api/ado/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ org, project, pat })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message || 'Connection test failed' };
    }
  },

  async discoverMetadata(org?: string, project?: string, pat?: string): Promise<AdoMetadataDiscoveryResult> {
    try {
      const res = await fetch('/api/ado/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ org, project, pat })
      });
      return await res.json();
    } catch (err: any) {
      return {
        ok: false,
        iterations: [],
        areas: [],
        error: err.message || 'Failed to discover metadata'
      };
    }
  },

  async fetchIterations(
    orgOrParams: string | { org?: string; project?: string; pat?: string },
    maybeProject?: string,
    maybePat?: string
  ): Promise<{ ok: boolean; iterations: AdoIterationDto[]; currentIteration?: AdoIterationDto; error?: string }> {
    try {
      const org = typeof orgOrParams === 'object' ? orgOrParams.org : orgOrParams;
      const project = typeof orgOrParams === 'object' ? orgOrParams.project : maybeProject;
      const pat = typeof orgOrParams === 'object' ? orgOrParams.pat : maybePat;

      const res = await fetch('/api/ado/iterations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ org, project, pat })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, iterations: [], error: err.message };
    }
  },

  async fetchAreas(
    orgOrParams: string | { org?: string; project?: string; pat?: string },
    maybeProject?: string,
    maybePat?: string
  ): Promise<{ ok: boolean; areas: AdoAreaDto[]; error?: string }> {
    try {
      const org = typeof orgOrParams === 'object' ? orgOrParams.org : orgOrParams;
      const project = typeof orgOrParams === 'object' ? orgOrParams.project : maybeProject;
      const pat = typeof orgOrParams === 'object' ? orgOrParams.pat : maybePat;

      const res = await fetch('/api/ado/areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ org, project, pat })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, areas: [], error: err.message };
    }
  },

  async syncWorkItems(params: {
    org: string;
    project: string;
    pat?: string;
    areaPath?: string;
    iterationPath?: string;
    targetInstance?: 'all' | 'internal' | 'external';
    customWiql?: string;
  }): Promise<AdoSyncResponse> {
    try {
      const res = await fetch('/api/ado/sync-workitems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(params)
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, stories: [], defects: [], error: err.message };
    }
  },

  async getWorkItem(id: number | string, params?: { org?: string; project?: string; pat?: string }): Promise<{ ok: boolean; workItem?: any; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (params?.org) query.set('org', params.org);
      if (params?.project) query.set('project', params.project);
      if (params?.pat) query.set('pat', params.pat);

      const qs = query.toString();
      const res = await fetch(`/api/ado/workitems/${id}${qs ? `?${qs}` : ''}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  },

  async createWorkItem(data: {
    type?: string;
    title: string;
    description?: string;
    areaPath?: string;
    iterationPath?: string;
    severity?: string;
    priority?: string | number;
    assignedTo?: string;
    acceptanceCriteria?: string[] | string;
    tags?: string[] | string;
    org?: string;
    project?: string;
    pat?: string;
    patchOperations?: any[];
  }): Promise<{ ok: boolean; workItem?: any; error?: string }> {
    try {
      const res = await fetch('/api/ado/workitems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  },

  async updateWorkItem(id: number | string, data: {
    state?: string;
    title?: string;
    description?: string;
    assignedTo?: string;
    severity?: string;
    comment?: string;
    org?: string;
    project?: string;
    pat?: string;
    patchOperations?: any[];
  }): Promise<{ ok: boolean; workItem?: any; error?: string }> {
    try {
      const res = await fetch(`/api/ado/workitems/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  },

  async proxyRequest(endpoint: string, options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    data?: any;
    org?: string;
    project?: string;
    pat?: string;
  }): Promise<{ ok: boolean; status?: number; data?: any; error?: string }> {
    try {
      const res = await fetch('/api/ado/proxy', {
        method: options?.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          endpoint,
          method: options?.method || 'GET',
          data: options?.data,
          org: options?.org,
          project: options?.project,
          pat: options?.pat
        })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  },

  /**
   * Fetches real ADO team members, identities, and work item contributors
   * with Original Name and User Email.
   */
  async fetchAdoTeamUsers(options?: {
    org?: string;
    project?: string;
    pat?: string;
  }): Promise<{
    ok: boolean;
    org?: string;
    project?: string;
    count?: number;
    users?: Array<{ id: string; name: string; email: string; teamName?: string; source?: string }>;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/ado/team-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          org: options?.org,
          project: options?.project,
          pat: options?.pat
        })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  },

  getStoredDiagnostics(): AdoSyncDiagnosticRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 5);
      }
    } catch (e) {
      console.warn('Failed to parse stored diagnostics:', e);
    }
    return [];
  },

  saveDiagnosticRecord(record: AdoSyncDiagnosticRecord): AdoSyncDiagnosticRecord[] {
    try {
      const current = this.getStoredDiagnostics();
      const updated = [record, ...current.filter(r => r.id !== record.id)].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed to save diagnostic record:', e);
      return [];
    }
  },

  clearDiagnostics(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear diagnostics:', e);
    }
  }
};

