import { Priority, Severity, ExecutionMetrics } from './index';

export type JiraIssueType = 'Epic' | 'Story' | 'Bug' | 'Task' | 'Subtask';

export type JiraIssueStatus = 
  | 'To Do'
  | 'In Progress'
  | 'Code Review'
  | 'QA Ready'
  | 'QA In Progress'
  | 'QA Passed'
  | 'Done'
  | 'Blocked';

export type JiraSprintState = 'future' | 'active' | 'closed';

export type JiraLinkType = 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates' | 'is_duplicated_by';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  leadId?: string;
  category?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface JiraSprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  state: JiraSprintState;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  sequenceNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface JiraIssueComment {
  id: string;
  issueId: string;
  authorId?: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

export interface JiraWorkLog {
  id: string;
  issueId: string;
  authorId?: string;
  authorName: string;
  timeSpentHours: number;
  description?: string;
  startedAt: string;
  createdAt: string;
}

export interface JiraIssueLink {
  id: string;
  sourceIssueId: string;
  targetIssueId: string;
  linkType: JiraLinkType;
  targetIssueKey?: string;
  targetIssueSummary?: string;
  targetIssueStatus?: string;
  createdAt?: string;
}

export interface JiraIssue {
  id: string;
  issueKey: string; // e.g. 'ACM-101'
  projectId: string;
  sprintId?: string | null;
  releaseId?: string | null;
  parentIssueId?: string | null;
  epicId?: string | null;
  issueType: JiraIssueType;
  summary: string;
  description?: string;
  status: JiraIssueStatus;
  priority: Priority;
  severity?: Severity;
  storyPoints?: number;
  originalEstimateHours?: number;
  timeSpentHours?: number;
  assigneeId?: string | null;
  assigneeName?: string;
  reporterId?: string | null;
  reporterName?: string;
  environment?: string;
  resolution?: string;
  areaPath?: string;
  iterationPath?: string;
  adoId?: number;
  tags?: string[];
  acceptanceCriteria?: string[];
  executionMetrics?: ExecutionMetrics;
  comments?: JiraIssueComment[];
  workLogs?: JiraWorkLog[];
  issueLinks?: JiraIssueLink[];
  subtasks?: JiraIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface HasuraConnectionConfig {
  endpoint: string;
  adminSecret?: string;
  connected: boolean;
  lastChecked?: string;
  error?: string;
}
