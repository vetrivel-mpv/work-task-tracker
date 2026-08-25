import { AppState, AppSettings, TestCase, UserStory, AppUser } from '../types';
import { toDateStr } from './date';
import { isTestCaseItem, convertStoryToTestCase, filterPureUserStories } from './itemClassification';
import { parseAdoTarget } from './adoPaths';
import { ensureUsersAndRoles } from './userManagement';
import { sanitizeAndLinkWorkItems } from './assigneeUtils';
import {
  INITIAL_BLUEPRINT,
  INITIAL_TEAM,
  INITIAL_GROUPS,
  INITIAL_RELEASES,
  INITIAL_STORIES,
  INITIAL_TEST_CASES,
  INITIAL_DEFECTS,
  INITIAL_SETTINGS,
  INITIAL_DUAL_ADO_CONFIG,
  INITIAL_RETRO_ITEMS,
  INITIAL_RETRO_SESSIONS,
  getInitialTasks
} from './demoData';
import {
  INITIAL_API_COLLECTIONS,
  INITIAL_API_ENVIRONMENTS,
  INITIAL_API_EXECUTION_RUNS
} from './apiAutomationDemoData';

const STORAGE_KEY_PREFIX = 'northstar:';
const STATE_STORAGE_KEY = `${STORAGE_KEY_PREFIX}state:v4`;

// Native IndexedDB Configuration
const IDB_NAME = 'northstar_delivery_db';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'app_state';
const IDB_KEY = 'current_state';

/**
 * Open or initialize native IndexedDB instance
 */
function getIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[Storage] IndexedDB open error, falling back to local memory/storage');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save full state to IndexedDB (virtually unlimited capacity)
 */
export async function saveToIndexedDB(state: AppState): Promise<void> {
  try {
    const db = await getIDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put(state, IDB_KEY);
  } catch (err) {
    console.warn('[Storage] IndexedDB save error:', err);
  }
}

/**
 * Load full state from IndexedDB
 */
export async function loadFromIndexedDB(): Promise<AppState | null> {
  try {
    const db = await getIDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (req.result && typeof req.result === 'object') {
          resolve(req.result as AppState);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Clean up obsolete or outdated localStorage keys to reclaim space
 */
function cleanupLegacyStorageKeys(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_KEY_PREFIX) && k !== STATE_STORAGE_KEY) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // Ignore cleanup error
  }
}

export function getFreshDemoState(): AppState {
  const todayStr = toDateStr(new Date());
  const partialState: Partial<AppState> = {
    team: INITIAL_TEAM,
    settings: INITIAL_SETTINGS,
    dualAdoConfig: INITIAL_DUAL_ADO_CONFIG
  };
  const { users, currentUserId } = ensureUsersAndRoles(partialState);

  return {
    dateStr: todayStr,
    tasks: getInitialTasks(todayStr),
    team: INITIAL_TEAM,
    groups: INITIAL_GROUPS,
    userStories: INITIAL_STORIES,
    testCases: INITIAL_TEST_CASES,
    defects: INITIAL_DEFECTS,
    releases: INITIAL_RELEASES,
    standup: {},
    standupHistory: {},
    peopleReviews: [],
    absences: [],
    roasts: [],
    retroItems: INITIAL_RETRO_ITEMS,
    retroActionItems: [],
    retroSessions: INITIAL_RETRO_SESSIONS,
    activeRetroSessionId: 'retro-session-current',
    apiCollections: INITIAL_API_COLLECTIONS,
    apiEnvironments: INITIAL_API_ENVIRONMENTS,
    apiExecutionRuns: INITIAL_API_EXECUTION_RUNS,
    activeApiEnvironmentId: 'env-local',
    blueprintSchedule: INITIAL_BLUEPRINT,
    settings: INITIAL_SETTINGS,
    activeView: 'board',
    selectedReleaseId: null,
    dualAdoConfig: INITIAL_DUAL_ADO_CONFIG,
    users,
    currentUserId
  };
}

export function loadStoredState(): AppState {
  const todayStr = toDateStr(new Date());
  cleanupLegacyStorageKeys();

  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        let dualAdoConfig = parsed.dualAdoConfig || INITIAL_DUAL_ADO_CONFIG;
        if (dualAdoConfig?.internal) {
          const parsedTarget = parseAdoTarget(dualAdoConfig.internal.organization, dualAdoConfig.internal.project);
          dualAdoConfig = {
            ...dualAdoConfig,
            internal: {
              ...dualAdoConfig.internal,
              organization: parsedTarget.cleanOrg,
              project: parsedTarget.cleanProject
            }
          };
        }

        const rawStories: any[] = Array.isArray(parsed.userStories) ? parsed.userStories : [];
        const rawTestCases: any[] = Array.isArray(parsed.testCases) ? parsed.testCases : [];

        // Auto-sanitize: remove any test cases that were previously misclassified as stories
        const sanitizedStories: UserStory[] = [];
        const extractedTestCases: TestCase[] = [...rawTestCases];

        rawStories.forEach((s: any) => {
          if (isTestCaseItem(s)) {
            const converted = convertStoryToTestCase(s, todayStr);
            const exists = extractedTestCases.some(tc => 
              tc.id === converted.id || 
              (converted.adoId && tc.adoId === converted.adoId)
            );
            if (!exists) {
              extractedTestCases.push(converted);
            }
          } else {
            sanitizedStories.push(s);
          }
        });

        // Deduplicate test cases by id/adoId
        const testCaseMap = new Map<string, TestCase>();
        extractedTestCases.forEach(tc => {
          testCaseMap.set(tc.id, tc);
        });

        const intermediateState: Partial<AppState> = {
          team: Array.isArray(parsed.team) ? parsed.team : [],
          users: Array.isArray(parsed.users) ? parsed.users : undefined,
          currentUserId: parsed.currentUserId,
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
          dualAdoConfig,
          adoConfig: parsed.adoConfig
        };

        const { users, currentUserId } = ensureUsersAndRoles(intermediateState);

        const linked = sanitizeAndLinkWorkItems({
          userStories: sanitizedStories,
          testCases: Array.from(testCaseMap.values()),
          defects: Array.isArray(parsed.defects) ? parsed.defects : [],
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          team: Array.isArray(parsed.team) ? parsed.team : []
        });

        const state: AppState = {
          dateStr: parsed.dateStr || todayStr,
          tasks: linked.tasks,
          team: linked.team,
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
          userStories: linked.userStories,
          testCases: linked.testCases,
          defects: linked.defects,
          releases: Array.isArray(parsed.releases) ? parsed.releases : [],
          standup: parsed.standup || {},
          standupHistory: parsed.standupHistory || {},
          peopleReviews: Array.isArray(parsed.peopleReviews) ? parsed.peopleReviews : [],
          absences: Array.isArray(parsed.absences) ? parsed.absences : [],
          roasts: Array.isArray(parsed.roasts) ? parsed.roasts : [],
          retroItems: Array.isArray(parsed.retroItems) ? parsed.retroItems : INITIAL_RETRO_ITEMS,
          retroActionItems: Array.isArray(parsed.retroActionItems) ? parsed.retroActionItems : [],
          retroSessions: Array.isArray(parsed.retroSessions) ? parsed.retroSessions : INITIAL_RETRO_SESSIONS,
          activeRetroSessionId: parsed.activeRetroSessionId || 'retro-session-current',
          apiCollections: Array.isArray(parsed.apiCollections) ? parsed.apiCollections : INITIAL_API_COLLECTIONS,
          apiEnvironments: Array.isArray(parsed.apiEnvironments) ? parsed.apiEnvironments : INITIAL_API_ENVIRONMENTS,
          apiExecutionRuns: Array.isArray(parsed.apiExecutionRuns) ? parsed.apiExecutionRuns : INITIAL_API_EXECUTION_RUNS,
          activeApiEnvironmentId: parsed.activeApiEnvironmentId || 'env-local',
          blueprintSchedule: Array.isArray(parsed.blueprintSchedule) ? parsed.blueprintSchedule : [],
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
          activeView: parsed.activeView || 'board',
          selectedReleaseId: parsed.selectedReleaseId || null,
          dualAdoConfig,
          users,
          currentUserId
        };

        return state;
      }
    }
  } catch (err) {
    console.warn('[Storage] Failed to load state from localStorage cache, using defaults:', err);
  }

  return getFreshDemoState();
}

/**
 * Creates a lightweight snapshot suitable for localStorage quota limits (<2.5MB)
 */
function createCompactStateForLocalStorage(state: AppState): AppState {
  // Prune long descriptions in local snapshot
  const compactStories = (state.userStories || []).map(s => ({
    ...s,
    description: s.description && s.description.length > 500 ? s.description.substring(0, 500) + '...' : s.description
  }));

  const compactTestCases = (state.testCases || []).map(tc => ({
    ...tc,
    description: tc.description && tc.description.length > 500 ? tc.description.substring(0, 500) + '...' : tc.description
  }));

  const compactDefects = (state.defects || []).map(d => ({
    ...d,
    description: d.description && d.description.length > 500 ? d.description.substring(0, 500) + '...' : d.description,
    stepsToReproduce: d.stepsToReproduce && d.stepsToReproduce.length > 500 ? d.stepsToReproduce.substring(0, 500) + '...' : d.stepsToReproduce
  }));

  // Limit standup history entries to the latest 10 days in localStorage cache
  const historyDates = Object.keys(state.standupHistory || {}).sort().slice(-10);
  const compactHistory: Record<string, any> = {};
  historyDates.forEach(d => {
    compactHistory[d] = state.standupHistory[d];
  });

  return {
    ...state,
    userStories: compactStories,
    testCases: compactTestCases,
    defects: compactDefects,
    standupHistory: compactHistory
  };
}

export function saveStoredState(state: AppState): void {
  // 1. Always persist full, high-fidelity uncompressed state to IndexedDB
  saveToIndexedDB(state);

  // 2. Persist to localStorage with safety and quota recovery
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const rawJson = JSON.stringify(state);
    // If under 2.5MB, save directly
    if (rawJson.length < 2500000) {
      localStorage.setItem(STATE_STORAGE_KEY, rawJson);
      return;
    }

    // Otherwise save compact version to avoid quota errors
    const compact = createCompactStateForLocalStorage(state);
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(compact));
  } catch (err: any) {
    // Quota Exceeded handling: cleanup old keys and attempt compact save
    try {
      cleanupLegacyStorageKeys();
      const compact = createCompactStateForLocalStorage(state);
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // IndexedDB has already persisted the state, so quietly absorb localStorage quota error
      console.info('[Storage] localStorage quota reached; state safely saved to IndexedDB.');
    }
  }
}

export function resetToDemoState(): AppState {
  const fresh = getFreshDemoState();
  saveStoredState(fresh);
  return fresh;
}

export function exportBackupJSON(state: AppState): void {
  const appName = state.settings?.appName || 'ACM (AT&T Connection Manager) Delivery';
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'delivery';
  const exportPayload = {
    app: appName,
    version: '4.0.0',
    exportedAt: new Date().toISOString(),
    data: state
  };
  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-backup-${toDateStr(new Date())}.json`;
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
      throw new Error('Invalid project delivery backup structure.');
    }
    const rawStories = Array.isArray(data.userStories) ? data.userStories : [];
    const rawTestCases = Array.isArray(data.testCases) ? data.testCases : [];
    const sanitizedStories: UserStory[] = [];
    const extractedTestCases: TestCase[] = [...rawTestCases];

    rawStories.forEach((s: any) => {
      if (isTestCaseItem(s)) {
        const converted = convertStoryToTestCase(s, data.dateStr || toDateStr(new Date()));
        const exists = extractedTestCases.some(tc => tc.id === converted.id || (converted.adoId && tc.adoId === converted.adoId));
        if (!exists) extractedTestCases.push(converted);
      } else {
        sanitizedStories.push(s);
      }
    });

    const cleanState: AppState = {
      dateStr: data.dateStr || toDateStr(new Date()),
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      team: Array.isArray(data.team) ? data.team : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      userStories: sanitizedStories,
      testCases: extractedTestCases,
      defects: Array.isArray(data.defects) ? data.defects : [],
      releases: Array.isArray(data.releases) ? data.releases : [],
      standup: data.standup || {},
      standupHistory: data.standupHistory || {},
      peopleReviews: Array.isArray(data.peopleReviews) ? data.peopleReviews : [],
      absences: Array.isArray(data.absences) ? data.absences : [],
      roasts: Array.isArray(data.roasts) ? data.roasts : [],
      retroItems: Array.isArray(data.retroItems) ? data.retroItems : INITIAL_RETRO_ITEMS,
      retroActionItems: Array.isArray(data.retroActionItems) ? data.retroActionItems : [],
      retroSessions: Array.isArray(data.retroSessions) ? data.retroSessions : INITIAL_RETRO_SESSIONS,
      activeRetroSessionId: data.activeRetroSessionId || 'retro-session-current',
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
