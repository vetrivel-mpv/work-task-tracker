export * from './apiAutomation';
import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiTestExecutionRun 
} from './apiAutomation';

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'partial' | 'complete';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type DefectStatus = 'New' | 'Active' | 'Fixed' | 'Retest' | 'Closed';
export type UserStoryStatus = 'To Do' | 'In Analysis' | 'Dev In Progress' | 'QA Ready' | 'QA In Progress' | 'QA Passed' | 'Done' | 'Blocked';
export type TestCaseStatus = 'Design' | 'Ready' | 'In Progress' | 'Passed' | 'Failed' | 'Blocked' | 'Closed';
export type ReleaseStatus = 'Planning' | 'Active QA' | 'Staging' | 'Deployed' | 'Archived';
export type AdoInstanceRole = 'internal' | 'external';
export type AdoInstanceType = AdoInstanceRole;
export type DefectOrigin = 'internal_qa' | 'customer_reported' | 'ops_incident';
export type SlaPriority = 'P1 - 4h Critical' | 'P2 - 24h Major' | 'P3 - Normal';
export type AppTheme = 'executive_slate' | 'obsidian_dark' | 'steel_minimal' | 'crimson_ops';
export type ThemeId = AppTheme;

export type AppView = 
  | 'board' 
  | 'stories'
  | 'userStories' 
  | 'testCases'
  | 'defects' 
  | 'qa_dashboard'
  | 'defectsDashboard' 
  | 'apiAutomation'
  | 'api_automation'
  | 'releases' 
  | 'standup' 
  | 'retrospective'
  | 'people'
  | 'peopleReview' 
  | 'blueprint' 
  | 'adoSync' 
  | 'settings';

export type NavView = AppView;

export interface Task {
  id: string;
  title: string;
  time?: string;
  dueDate?: string; // YYYY-MM-DD
  priority: Priority;
  status: TaskStatus;
  dateStr: string; // YYYY-MM-DD
  assigneeIds: string[];
  assigneeId?: string | null;
  assigneeName?: string;
  groupIds: string[];
  sourceInstance?: 'internal' | 'external' | 'local';
  ticketType?: 'dev_activity' | 'customer_defect' | 'ops_ticket' | 'test_run' | 'general';
  customerName?: string;
  areaPath?: string;
  iterationPath?: string;
  userStoryId?: string | null;
  defectId?: string | null;
  releaseId?: string | null;
  dependsOnTaskIds?: string[];
  comments?: TaskComment[];
  adoId?: number;
  adoWorkItemType?: string;
  adoUrl?: string;
  discussedInStandup?: boolean;
  standupDiscussionNotes?: string;
  createdAt: string;
  completedAt?: string;
}

export enum UserRole {
  Administrator = 'Administrator',
  DeliveryReleaseManager = 'Delivery/Release Manager',
  EngineeringLead = 'Engineering Lead',
  QAEngineer = 'QA Engineer',
  EngineerContributor = 'Engineer/Contributor',
  StakeholderViewer = 'Stakeholder/Viewer'
}

export const USER_ROLES: UserRole[] = [
  UserRole.Administrator,
  UserRole.DeliveryReleaseManager,
  UserRole.EngineeringLead,
  UserRole.QAEngineer,
  UserRole.EngineerContributor,
  UserRole.StakeholderViewer
];

export interface RoleConfig {
  role: UserRole;
  label: string;
  description: string;
  badgeColor: string;
  canManageSettings: boolean;
  canManageTeam: boolean;
  canManageReleases: boolean;
  canTriggerAdoSync: boolean;
  canEditWorkItems: boolean;
  canRunTests: boolean;
  isReadOnly: boolean;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  [UserRole.Administrator]: {
    role: UserRole.Administrator,
    label: 'Administrator',
    description: 'Full system administration, security configurations, ADO synchronization, and member governance.',
    badgeColor: '#E11D48', // Ruby
    canManageSettings: true,
    canManageTeam: true,
    canManageReleases: true,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: true,
    isReadOnly: false
  },
  [UserRole.DeliveryReleaseManager]: {
    role: UserRole.DeliveryReleaseManager,
    label: 'Delivery/Release Manager',
    description: 'Release orchestration, sprint scope gating, milestone tracking, and cross-team delivery oversight.',
    badgeColor: '#7C3AED', // Violet
    canManageSettings: false,
    canManageTeam: true,
    canManageReleases: true,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: true,
    isReadOnly: false
  },
  [UserRole.EngineeringLead]: {
    role: UserRole.EngineeringLead,
    label: 'Engineering Lead',
    description: 'Technical architecture, sprint execution, code delivery tracking, defect assignment, and standup reviews.',
    badgeColor: '#0284C7', // Ocean Blue
    canManageSettings: false,
    canManageTeam: true,
    canManageReleases: true,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: true,
    isReadOnly: false
  },
  [UserRole.QAEngineer]: {
    role: UserRole.QAEngineer,
    label: 'QA Engineer',
    description: 'Test case execution, regression runs, defect verification, test plan management, and release quality sign-off.',
    badgeColor: '#059669', // Emerald
    canManageSettings: false,
    canManageTeam: false,
    canManageReleases: false,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: true,
    isReadOnly: false
  },
  [UserRole.EngineerContributor]: {
    role: UserRole.EngineerContributor,
    label: 'Engineer/Contributor',
    description: 'User story implementation, task updates, defect fixes, daily standup logging, and engineering contributions.',
    badgeColor: '#2563EB', // Sapphire
    canManageSettings: false,
    canManageTeam: false,
    canManageReleases: false,
    canTriggerAdoSync: false,
    canEditWorkItems: true,
    canRunTests: true,
    isReadOnly: false
  },
  [UserRole.StakeholderViewer]: {
    role: UserRole.StakeholderViewer,
    label: 'Stakeholder/Viewer',
    description: 'Executive visibility, release burndown monitoring, QA dashboard viewing, and read-only audit access.',
    badgeColor: '#64748B', // Slate
    canManageSettings: false,
    canManageTeam: false,
    canManageReleases: false,
    canTriggerAdoSync: false,
    canEditWorkItems: false,
    canRunTests: false,
    isReadOnly: true
  }
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgScope?: string; // e.g. 'simetricwdh' or '*' for global/all orgs
  projectScope?: string; // e.g. 'ACM' or '*' for global/all projects
  avatarColor?: string;
  isAdoConnectionOwner?: boolean;
  active?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: UserRole | string;
  email: string;
  avatarColor?: string;
  groupIds?: string[];
  active?: boolean;
  isMyTeam?: boolean; // True for 'My Team' members
  adoSource?: 'assigned_to' | 'created_by' | 'manual';
}

export interface TeamGroup {
  id: string;
  name: string;
  purpose?: string;
  memberIds?: string[];
  color?: string;
}

export interface TestPlanRef {
  suiteName: string;
  passedTests: number;
  failedTests: number;
  totalTests: number;
  reportUrl?: string;
  lastRunAt?: string;
  status: 'Passed' | 'Failed' | 'Running' | 'Blocked';
}

export interface UserStory {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  status: UserStoryStatus;
  storyPoints?: number;
  areaPath?: string;
  releaseId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string;
  createdById?: string | null;
  createdByName?: string;
  iterationPath?: string;
  groupIds?: string[];
  tags?: string[];
  sourceInstance?: 'internal' | 'external';
  testPlanRef?: TestPlanRef;
  adoId?: number;
  adoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
}

export interface TestCase {
  id: string;
  title: string;
  description?: string;
  steps?: TestStep[];
  status: TestCaseStatus | string;
  priority?: Priority;
  automationStatus?: 'Automated' | 'Not Automated' | 'Planned';
  areaPath?: string;
  iterationPath?: string;
  releaseId?: string | null;
  userStoryId?: string | null;
  defectId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string;
  createdById?: string | null;
  createdByName?: string;
  tags?: string[];
  workItemType?: string; // 'Test Case' | 'Test Suite' | 'Test Plan'
  adoId?: number;
  adoUrl?: string;
  sourceInstance?: 'internal' | 'external';
  createdAt: string;
  updatedAt: string;
}

export interface Defect {
  id: string;
  title: string;
  description?: string;
  stepsToReproduce?: string;
  severity: Severity;
  priority?: Priority;
  status: DefectStatus;
  sourceInstance?: 'internal' | 'external';
  origin?: DefectOrigin;
  customerName?: string; // For customer-reported defects
  opsIncidentNumber?: string; // For OPS tickets
  slaPriority?: SlaPriority;
  slaDeadline?: string;
  areaPath?: string;
  userStoryId?: string | null;
  releaseId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string;
  createdById?: string | null;
  createdByName?: string;
  iterationPath?: string;
  tags?: string[];
  environment?: string; // 'Dev' | 'QA' | 'Staging' | 'Prod'
  rootCause?: string;
  adoId?: number;
  adoState?: string;
  adoUrl?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface Release {
  id: string;
  name: string;
  releaseNumber?: string; // e.g. 'v2026.03' (Internal ADO release number)
  areaPath?: string; // e.g. 'ACM'
  targetDate: string; // YYYY-MM-DD
  iterationPath?: string; // e.g. 'ACM\D2 R 2026.03' (Internal ADO release/iteration identifier)
  connectionId?: string | null;
  status: ReleaseStatus;
  description?: string;
  scopeNotes?: string;
  createdAt: string;
}

export interface StandupEntry {
  yesterday: string;
  today: string;
  blockers: string;
  questions?: string;
  linkedTaskId?: string;
  linkedItemIds?: string[];
  submittedAt?: string;
  syncedWithDashboardAt?: string;
}

export interface StandupRecord {
  dateStr: string;
  memberEntries: Record<string, StandupEntry>;
  summary?: string;
  submittedBy?: string;
}

export interface PeopleReviewNote {
  id: string;
  memberId: string;
  dateStr: string;
  period: 'month' | 'quarter' | 'year';
  highlights: string;
  areasOfGrowth: string;
  appreciationNote?: string;
  author: string;
  createdAt: string;
}

export type AbsenceType = 'full_day' | 'half_day_morning' | 'half_day_afternoon' | 'hourly_permission';
export type AbsenceCategory = 'planned_pto' | 'sick_leave' | 'emergency' | 'doctor_appointment' | 'personal_errand' | 'wfh' | 'other';
export type AbsenceStatus = 'approved' | 'pending' | 'taken' | 'cancelled';

export interface AbsenceRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  dateStr: string; // YYYY-MM-DD
  endDateStr?: string; // For multi-day PTO
  type: AbsenceType;
  permissionHours?: number; // e.g. 1.0, 1.5, 2.0
  timeWindow?: string; // e.g. "10:00 AM - 12:00 PM" or "First Half (9 AM - 1 PM)"
  reason: string;
  category: AbsenceCategory;
  status: AbsenceStatus;
  impactNotes?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type RoastHeatLevel = 'mild' | 'spicy' | 'fiery';

export interface TeamRoastRecord {
  id: string;
  dateStr: string;
  heatLevel: RoastHeatLevel;
  target: 'sprint_team' | 'member';
  targetMemberId?: string;
  targetMemberName?: string;
  roastTitle: string;
  roastBody: string;
  punchlines: string[];
  statsHighlights?: {
    blockersCount: number;
    openBugs: number;
    criticalBugs: number;
    overdueTasks: number;
    storyPoints: number;
  };
  redemptionTips: string[];
  createdAt: string;
}

export interface DuplicateTicketItemRef {
  id: string;
  adoId?: number;
  title: string;
  type: 'story' | 'defect' | 'task' | 'testCase';
  status: string;
  severityOrPoints?: string | number;
  assigneeName?: string;
  iterationPath?: string;
  descriptionSnippet?: string;
}

export interface DuplicateTicketMatch {
  id: string;
  ticketA: DuplicateTicketItemRef;
  ticketB: DuplicateTicketItemRef;
  confidenceScore: number; // 0 - 100
  matchType: 'exact_duplicate' | 'semantic_overlap' | 'duplicate_defect' | 'scope_conflict' | 'identical_repro';
  reason: string;
  sharedKeywords?: string[];
  suggestedAction: 'merge_into_a' | 'merge_into_b' | 'close_duplicate' | 'link_related' | 'keep_separate';
}

export interface DuplicateAnalysisReport {
  timestamp: string;
  scannedCount: {
    stories: number;
    defects: number;
    tasks: number;
    testCases: number;
    total: number;
  };
  duplicatesFound: number;
  matches: DuplicateTicketMatch[];
  summary: string;
}

export interface BlueprintItem {
  id: string;
  title: string;
  time: string;
  priority: Priority;
  category?: string;
  description?: string;
}

export interface AdoInstanceConfig {
  id: 'internal' | 'external';
  name: string;
  role: AdoInstanceRole;
  organization: string;
  project: string;
  pat?: string;
  areaPath?: string;
  iterationPath?: string;
  connected: boolean;
  lastSyncAt?: string;
  features: {
    devActivities: boolean;
    userStories: boolean;
    internalDefects: boolean;
    testPlansAndReports: boolean;
    customerDefects: boolean;
    opsTickets: boolean;
  };
  testPlanSettings?: {
    testPlanName?: string;
    testSuite?: string;
    automatedRunsEnabled?: boolean;
    lastReportUrl?: string;
    passedTests?: number;
    failedTests?: number;
    totalTests?: number;
  };
}

export interface DualAdoConfig {
  internal: AdoInstanceConfig;
  external: AdoInstanceConfig;
  syncMode: 'auto' | 'manual';
  lastGlobalSyncAt?: string;
}

export interface AdoConfig {
  organization: string;
  project: string;
  pat?: string;
  areaPath?: string;
  iterationPath?: string;
  connected?: boolean;
  lastSyncAt?: string;
}

export type LayoutDensity = 'compact' | 'comfortable';

export interface AppSettings {
  appName?: string;
  projectCode?: string;
  projectSubtitle?: string;
  clientName?: string;
  customPresets?: any[];
  emailRecipient?: string;
  managerEmail?: string;
  yourName?: string;
  carryForward?: boolean;
  selectedReleaseId?: string | null;
  sidebarCollapsed?: boolean;
  lastBackupAt?: string | null;
  geminiModel?: string;
  theme?: AppTheme;
  density?: LayoutDensity;
}

export type RetroCategory = 'keep' | 'stop' | 'start';

export interface RetroActionItem {
  id: string;
  sessionId?: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  assigneeName?: string;
  assigneeId?: string;
  status: 'open' | 'in_progress' | 'completed';
  retroItemId?: string;
  dueDate?: string;
  createdAt: string;
}

export interface RetroItem {
  id: string;
  sessionId?: string;
  category: RetroCategory;
  text: string;
  isAnonymous: boolean;
  authorAlias?: string;
  authorName?: string;
  authorId?: string;
  createdAt: string;
  votes: number;
  votedUserIds?: string[];
  sprintOrRelease?: string;
  releaseId?: string | null;
  status?: 'active' | 'discussed' | 'action_taken';
  discussed?: boolean;
  actionItemCreated?: boolean;
  tags?: string[];
  actionItems?: RetroActionItem[];
}

export interface RetroSession {
  id: string;
  title: string;
  date?: string;
  dateStr?: string;
  linkedSprint?: string;
  releaseId?: string | null;
  releaseName?: string;
  createdAt?: string;
  status?: 'active' | 'completed' | 'archived';
  notes?: string;
}

export interface AppState {
  dateStr: string;
  tasks: Task[];
  team: TeamMember[];
  groups: TeamGroup[];
  userStories: UserStory[];
  testCases: TestCase[];
  defects: Defect[];
  releases: Release[];
  standup: Record<string, StandupEntry>;
  standupHistory: Record<string, Record<string, StandupEntry>>;
  peopleReviews: PeopleReviewNote[];
  absences?: AbsenceRecord[];
  roasts?: TeamRoastRecord[];
  retroItems?: RetroItem[];
  retroActionItems?: RetroActionItem[];
  retroSessions?: RetroSession[];
  activeRetroSessionId?: string | null;
  apiCollections?: ApiAutomationCollection[];
  apiEnvironments?: ApiEnvironment[];
  apiExecutionRuns?: ApiTestExecutionRun[];
  activeApiEnvironmentId?: string | null;
  blueprintSchedule: BlueprintItem[];
  settings: AppSettings;
  activeView: AppView;
  selectedReleaseId: string | null;
  dualAdoConfig: DualAdoConfig;
  adoConfig?: AdoConfig;
  users?: AppUser[];
  currentUserId?: string;
}

