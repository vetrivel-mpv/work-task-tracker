import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  TestCase, 
  Defect, 
  Release, 
  BlueprintItem, 
  AppSettings,
  DualAdoConfig,
  RetroItem,
  RetroSession
} from '../types';

export const AVATAR_COLORS = [
  '#4F46E5', // Royal Indigo
  '#0284C7', // Ocean Blue
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#DB2777', // Pink
  '#DC2626', // Crimson
  '#2563EB', // Sapphire
];

export const INITIAL_BLUEPRINT: BlueprintItem[] = [];

export const INITIAL_TEAM: TeamMember[] = [];

export const INITIAL_GROUPS: TeamGroup[] = [];

export const INITIAL_RELEASES: Release[] = [];

export const INITIAL_STORIES: UserStory[] = [];

export const INITIAL_TEST_CASES: TestCase[] = [];

export const INITIAL_DEFECTS: Defect[] = [];

export const INITIAL_DUAL_ADO_CONFIG: DualAdoConfig = {
  internal: {
    id: 'internal',
    name: 'Internal Dev Azure DevOps',
    role: 'internal',
    organization: '',
    project: '',
    pat: '',
    areaPath: '',
    iterationPath: '',
    connected: false,
    lastSyncAt: undefined,
    features: {
      devActivities: true,
      userStories: true,
      internalDefects: true,
      testPlansAndReports: true,
      customerDefects: false,
      opsTickets: false
    }
  },
  external: {
    id: 'external',
    name: 'External Customer & OPS Azure DevOps',
    role: 'external',
    organization: '',
    project: '',
    pat: '',
    areaPath: '',
    iterationPath: '',
    connected: false,
    lastSyncAt: undefined,
    features: {
      devActivities: false,
      userStories: false,
      internalDefects: false,
      testPlansAndReports: false,
      customerDefects: true,
      opsTickets: true
    }
  },
  syncMode: 'manual',
  lastGlobalSyncAt: undefined
};

export const INITIAL_SETTINGS: AppSettings = {
  appName: 'ACM (AT&T Connection Manager) Delivery',
  projectCode: 'ACM',
  projectSubtitle: 'AT&T Connection Manager Delivery Hub',
  emailRecipient: 'engineering-leads@careflow.io',
  qaTeamEmail: 'qa-leads@careflow.io',
  devLeadEmail: 'dev-leads@careflow.io',
  releaseManagerEmail: 'release-managers@careflow.io',
  managerEmail: 'engineering-managers@careflow.io',
  executiveEmail: 'executives@careflow.io',
  onCallEmail: 'oncall@careflow.io',
  yourName: 'Team Lead',
  carryForward: true,
  selectedReleaseId: null,
  sidebarCollapsed: false,
  lastBackupAt: null,
  geminiModel: 'gemini-2.5-flash',
  theme: 'executive_slate',
  density: 'comfortable'
};

export const getInitialTasks = (_todayStr: string): Task[] => {
  return [];
};

export const INITIAL_RETRO_ITEMS: RetroItem[] = [];

export const INITIAL_RETRO_SESSIONS: RetroSession[] = [];

