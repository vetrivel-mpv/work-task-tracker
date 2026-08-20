import { AppState, AppSettings } from '../types';
import { toDateStr } from './date';
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
const STATE_STORAGE_KEY = `${STORAGE_KEY_PREFIX}state:v4`;

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
    standup: {},
    standupHistory: {},
    peopleReviews: [],
    blueprintSchedule: INITIAL_BLUEPRINT,
    settings: INITIAL_SETTINGS,
    activeView: 'board',
    selectedReleaseId: null,
    dualAdoConfig: INITIAL_DUAL_ADO_CONFIG
  };
}

export function loadStoredState(): AppState {
  const todayStr = toDateStr(new Date());
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const dualAdoConfig = parsed.dualAdoConfig || INITIAL_DUAL_ADO_CONFIG;

        const state: AppState = {
          dateStr: parsed.dateStr || todayStr,
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          team: Array.isArray(parsed.team) ? parsed.team : [],
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
          userStories: Array.isArray(parsed.userStories) ? parsed.userStories : [],
          defects: Array.isArray(parsed.defects) ? parsed.defects : [],
          releases: Array.isArray(parsed.releases) ? parsed.releases : [],
          standup: parsed.standup || {},
          standupHistory: parsed.standupHistory || {},
          peopleReviews: Array.isArray(parsed.peopleReviews) ? parsed.peopleReviews : [],
          blueprintSchedule: Array.isArray(parsed.blueprintSchedule) ? parsed.blueprintSchedule : [],
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
          activeView: parsed.activeView || 'board',
          selectedReleaseId: parsed.selectedReleaseId || null,
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
    version: '4.0.0',
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
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Northstar Delivery backup structure.');
    }
    const cleanState: AppState = {
      dateStr: data.dateStr || toDateStr(new Date()),
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      team: Array.isArray(data.team) ? data.team : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      userStories: Array.isArray(data.userStories) ? data.userStories : [],
      defects: Array.isArray(data.defects) ? data.defects : [],
      releases: Array.isArray(data.releases) ? data.releases : [],
      standup: data.standup || {},
      standupHistory: data.standupHistory || {},
      peopleReviews: Array.isArray(data.peopleReviews) ? data.peopleReviews : [],
      blueprintSchedule: Array.isArray(data.blueprintSchedule) ? data.blueprintSchedule : [],
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
