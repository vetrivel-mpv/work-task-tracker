export interface AdoIterationDto {
  id?: string | number;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
}

export interface AdoAreaDto {
  id?: string | number;
  name: string;
  path: string;
}

export interface AdoWorkItemDto {
  id: string;
  adoId: number;
  title: string;
  status: string;
  areaPath: string;
  iterationPath: string;
  assigneeName?: string;
  createdByName?: string;
  description?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  severity?: string;
}

export interface AdoSyncResponse {
  ok: boolean;
  stories: AdoWorkItemDto[];
  defects: AdoWorkItemDto[];
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

export const adoService = {
  async testConnection(org: string, project: string, pat: string): Promise<{ ok: boolean; error?: string; projects?: string[] }> {
    try {
      const res = await fetch('/api/ado/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org, project, pat })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message || 'Connection test failed' };
    }
  },

  async fetchIterations(org: string, project: string, pat?: string): Promise<{ ok: boolean; iterations: AdoIterationDto[]; error?: string }> {
    try {
      const res = await fetch('/api/ado/iterations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org, project, pat })
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, iterations: [], error: err.message };
    }
  },

  async fetchAreas(org: string, project: string, pat?: string): Promise<{ ok: boolean; areas: AdoAreaDto[]; error?: string }> {
    try {
      const res = await fetch('/api/ado/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }): Promise<AdoSyncResponse> {
    try {
      const res = await fetch('/api/ado/sync-workitems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, stories: [], defects: [], error: err.message };
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

