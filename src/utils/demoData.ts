import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  Defect, 
  Release, 
  BlueprintItem, 
  AppSettings,
  DualAdoConfig
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
  managerEmail: '',
  yourName: 'Team Lead',
  carryForward: true,
  selectedReleaseId: null,
  sidebarCollapsed: false,
  lastBackupAt: null,
  geminiModel: 'gemini-2.5-flash',
  theme: 'executive_slate'
};

export const getInitialTasks = (_todayStr: string): Task[] => {
  return [];
};
