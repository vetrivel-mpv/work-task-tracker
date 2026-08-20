import { AppState, Task, AppSettings } from '../types';
import { toDateStr, shiftDate } from './date';
import {
  INITIAL_BLUEPRINT,
  INITIAL_TEAM,
  INITIAL_GROUPS,
  INITIAL_RELEASES,
  INITIAL_STORIES,
  INITIAL_DEFECTS,
  INITIAL_SETTINGS,
  INITIAL_DUAL_ADO_CONFIG,
  getInitialTasks
} from './demoData';

const STORAGE_KEY_PREFIX = 'northstar:';
const STATE_STORAGE_KEY = `${STORAGE_KEY_PREFIX}state:v3`;

export function getFreshDemoState(): AppState {
  const todayStr = toDateStr(new Date());
  return {
    dateStr: todayStr,
    tasks: getInitialTasks(todayStr),
    team: INITIAL_TEAM,
    groups: INITIAL_GROUPS,
    userStories: INITIAL_STORIES,
    defects: INITIAL_DEFECTS,
    releases: INITIAL_RELEASES,
    standup: {
      'tm-1': {
        yesterday: 'Finished code review on FHIR parser PR and closed architectural RFC for multi-tenant auth in Internal ADO.',
        today: 'Pair with Elena on PostgreSQL advisory lock for slot booking; triage Mount Sinai PDF timeout.',
        blockers: 'None.'
      },
      'tm-2': {
        yesterday: 'Executed automated regression suite (56 passed, 1 failed) in Internal ADO. Logged DEF-INT-301.',
        today: 'Validate DEF-INT-302 fix and run automated sanity suite against Sprint 24 build.',
        blockers: 'Awaiting advisory lock deployment to QA cluster.'
      },
      'tm-3': {
        yesterday: 'Implemented TOTP QR code modal & recovery key generation on provider portal.',
        today: 'Fix DEF-INT-303 print stylesheet and assist on Mount Sinai PDF renderer investigation.',
        blockers: 'None.'
      },
      'tm-5': {
        yesterday: 'Investigated Azure Blob 403 token issue on External ADO OPS ticket OPS-9460. Deployed fix.',
        today: 'Triage Mayo Regional SMS routing lag (OPS-9475) and coordinate carrier shortcode fallback.',
        blockers: 'Awaiting Twilio carrier NOC confirmation on Verizon route.'
      }
    },
    standupHistory: {},
    peopleReviews: [
      {
        id: 'rev-1',
        memberId: 'tm-2',
        dateStr: todayStr,
        period: 'quarter',
        highlights: 'Exceptional vigilance discovering the race condition in the appointment engine before staging deployment.',
        areasOfGrowth: 'Can expand automated Cypress coverage for Firefox mobile emulators.',
        appreciationNote: 'Maya, thank you for your relentless dedication to delivery quality and catching high-risk flaws early!',
        author: 'Alex Rivera (Lead)',
        createdAt: todayStr
      }
    ],
    blueprintSchedule: INITIAL_BLUEPRINT,
    settings: INITIAL_SETTINGS,
    activeView: 'board',
    selectedReleaseId: INITIAL_RELEASES[0]?.id || null,
    dualAdoConfig: INITIAL_DUAL_ADO_CONFIG
  };
}

export function loadStoredState(): AppState {
  const todayStr = toDateStr(new Date());
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY) || localStorage.getItem('northstar:state:v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) {
        // Handle migration to dual ADO config
        const dualAdoConfig = parsed.dualAdoConfig || {
          ...INITIAL_DUAL_ADO_CONFIG,
          internal: {
            ...INITIAL_DUAL_ADO_CONFIG.internal,
            organization: parsed.adoConfig?.organization || INITIAL_DUAL_ADO_CONFIG.internal.organization,
            project: parsed.adoConfig?.project || INITIAL_DUAL_ADO_CONFIG.internal.project,
            areaPath: parsed.adoConfig?.areaPath || INITIAL_DUAL_ADO_CONFIG.internal.areaPath,
            iterationPath: parsed.adoConfig?.iterationPath || INITIAL_DUAL_ADO_CONFIG.internal.iterationPath
          }
        };

        const state: AppState = {
          dateStr: parsed.dateStr || todayStr,
          tasks: parsed.tasks?.length > 0 ? parsed.tasks : getInitialTasks(todayStr),
          team: parsed.team?.length > 0 ? parsed.team : INITIAL_TEAM,
          groups: parsed.groups?.length > 0 ? parsed.groups : INITIAL_GROUPS,
          userStories: parsed.userStories?.length > 0 ? parsed.userStories : INITIAL_STORIES,
          defects: parsed.defects?.length > 0 ? parsed.defects : INITIAL_DEFECTS,
          releases: parsed.releases?.length > 0 ? parsed.releases : INITIAL_RELEASES,
          standup: parsed.standup || {},
          standupHistory: parsed.standupHistory || {},
          peopleReviews: parsed.peopleReviews || [],
          blueprintSchedule: parsed.blueprintSchedule || INITIAL_BLUEPRINT,
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
          activeView: parsed.activeView || 'board',
          selectedReleaseId: parsed.selectedReleaseId || INITIAL_RELEASES[0]?.id || null,
          dualAdoConfig
        };

        return state;
      }
    }
  } catch (err) {
    console.error('[Storage] Failed to load state from localStorage:', err);
  }

  return getFreshDemoState();
}

export function saveStoredState(state: AppState): void {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[Storage] Failed to save state to localStorage:', err);
  }
}

export function resetToDemoState(): AppState {
  const fresh = getFreshDemoState();
  saveStoredState(fresh);
  return fresh;
}

export function exportBackupJSON(state: AppState): void {
  const exportPayload = {
    app: 'Northstar Delivery Hub',
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    data: state
  };
  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `northstar-delivery-backup-${toDateStr(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBackupJSON(jsonString: string): AppState | null {
  try {
    const parsed = JSON.parse(jsonString);
    const data = parsed.data || parsed;
    if (!data || !Array.isArray(data.tasks)) {
      throw new Error('Invalid Northstar Delivery backup structure.');
    }
    const cleanState: AppState = {
      dateStr: data.dateStr || toDateStr(new Date()),
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      team: Array.isArray(data.team) ? data.team : INITIAL_TEAM,
      groups: Array.isArray(data.groups) ? data.groups : INITIAL_GROUPS,
      userStories: Array.isArray(data.userStories) ? data.userStories : INITIAL_STORIES,
      defects: Array.isArray(data.defects) ? data.defects : INITIAL_DEFECTS,
      releases: Array.isArray(data.releases) ? data.releases : INITIAL_RELEASES,
      standup: data.standup || {},
      standupHistory: data.standupHistory || {},
      peopleReviews: Array.isArray(data.peopleReviews) ? data.peopleReviews : [],
      blueprintSchedule: Array.isArray(data.blueprintSchedule) ? data.blueprintSchedule : INITIAL_BLUEPRINT,
      settings: {
        ...INITIAL_SETTINGS,
        ...(data.settings || {})
      },
      activeView: data.activeView || 'board',
      selectedReleaseId: data.selectedReleaseId || null,
      dualAdoConfig: data.dualAdoConfig || INITIAL_DUAL_ADO_CONFIG
    };
    saveStoredState(cleanState);
    return cleanState;
  } catch (err) {
    console.error('[Storage] Backup import error:', err);
    return null;
  }
}

