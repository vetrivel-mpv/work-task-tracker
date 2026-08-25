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
  managerEmail: '',
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

export const INITIAL_RETRO_ITEMS: RetroItem[] = [
  {
    id: 'retro-item-1',
    category: 'keep',
    text: 'Automated daily standup notes & AI digest saved 20+ mins of repetitive typing every morning.',
    isAnonymous: true,
    authorName: 'Anonymous Contributor #1',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    votes: 5,
    votedUserIds: [],
    status: 'discussed',
    tags: ['Standup', 'Productivity']
  },
  {
    id: 'retro-item-2',
    category: 'keep',
    text: 'Direct Azure DevOps sync with WIQL queries keeps defect triage fast and transparent for release gating.',
    isAnonymous: true,
    authorName: 'Anonymous Contributor #2',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    votes: 7,
    votedUserIds: [],
    status: 'active',
    tags: ['ADO', 'Delivery']
  },
  {
    id: 'retro-item-3',
    category: 'stop',
    text: 'Stop pushing hotfix changes to Staging environment without linking the corresponding ADO bug or defect ticket.',
    isAnonymous: true,
    authorName: 'Anonymous Contributor #3',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    votes: 8,
    votedUserIds: [],
    status: 'action_taken',
    tags: ['Quality', 'Process']
  },
  {
    id: 'retro-item-4',
    category: 'stop',
    text: 'Stop holding ad-hoc meetings during deep focus windows (2:00 PM – 4:00 PM) to protect dev flow state.',
    isAnonymous: true,
    authorName: 'Anonymous Contributor #4',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    votes: 9,
    votedUserIds: [],
    status: 'active',
    tags: ['Focus', 'Culture']
  },
  {
    id: 'retro-item-5',
    category: 'start',
    text: 'Start running automated sanity regression suites on release candidates 24 hours prior to deployment window.',
    isAnonymous: true,
    authorName: 'Anonymous Contributor #5',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    votes: 11,
    votedUserIds: [],
    status: 'active',
    tags: ['Automation', 'QA']
  },
  {
    id: 'retro-item-6',
    category: 'start',
    text: 'Start logging hourly absence and permission requests directly in the People portal so team lead can balance test coverage.',
    isAnonymous: false,
    authorName: 'Engineering Lead',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    votes: 4,
    votedUserIds: [],
    status: 'active',
    tags: ['Team', 'Planning']
  }
];

export const INITIAL_RETRO_SESSIONS: RetroSession[] = [
  {
    id: 'retro-session-current',
    title: 'Sprint Retrospective — Continuous Quality & Delivery',
    dateStr: new Date().toISOString().split('T')[0],
    status: 'active',
    createdAt: new Date().toISOString(),
    notes: 'Focus on release gating, test plan synchronization, and developer focus windows.'
  }
];
