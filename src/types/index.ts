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
  | 'releases' 
  | 'standup' 
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
  createdAt: string;
  completedAt?: string;
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
  role: string;
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
  createdById?: string | null;
  createdByName?: string;
  iterationPath?: string;
  groupIds?: string[];
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
  releaseNumber?: string; // e.g. 'v4.2.0' (Internal ADO release number)
  areaPath?: string; // e.g. 'CareFlow-Core\EHR-Connect'
  targetDate: string; // YYYY-MM-DD
  iterationPath?: string; // e.g. 'CareFlow-Core\Sprint 24' (Internal ADO release/iteration identifier)
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
  submittedAt?: string;
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

export interface AppSettings {
  appName?: string;
  emailRecipient?: string;
  managerEmail?: string;
  yourName?: string;
  carryForward?: boolean;
  selectedReleaseId?: string | null;
  sidebarCollapsed?: boolean;
  lastBackupAt?: string | null;
  geminiModel?: string;
  theme?: AppTheme;
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
  blueprintSchedule: BlueprintItem[];
  settings: AppSettings;
  activeView: AppView;
  selectedReleaseId: string | null;
  dualAdoConfig: DualAdoConfig;
  adoConfig?: AdoConfig;
}

