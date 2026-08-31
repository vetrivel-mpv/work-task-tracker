import { JiraProject, JiraSprint, JiraIssue, JiraIssueComment, JiraWorkLog, JiraIssueStatus, HasuraConnectionConfig } from '../types/jira';
import { AppState, UserStory, Defect, Task } from '../types';

const HASURA_ENDPOINT_STORAGE_KEY = 'northstar_hasura_endpoint';
const HASURA_SECRET_STORAGE_KEY = 'northstar_hasura_secret';

export const DEFAULT_HASURA_ENDPOINT = 
  (typeof window !== 'undefined' && (window as any).__HASURA_URL__) ||
  'http://localhost:8080/v1/graphql';

export class GraphqlService {
  private endpoint: string;
  private adminSecret: string;

  constructor() {
    if (typeof window !== 'undefined') {
      this.endpoint = localStorage.getItem(HASURA_ENDPOINT_STORAGE_KEY) || DEFAULT_HASURA_ENDPOINT;
      this.adminSecret = localStorage.getItem(HASURA_SECRET_STORAGE_KEY) || 'adminsecretkey';
    } else {
      this.endpoint = DEFAULT_HASURA_ENDPOINT;
      this.adminSecret = 'adminsecretkey';
    }
  }

  public getConfig(): HasuraConnectionConfig {
    return {
      endpoint: this.endpoint,
      adminSecret: this.adminSecret,
      connected: false
    };
  }

  public updateConfig(endpoint: string, adminSecret?: string): void {
    this.endpoint = endpoint.trim() || DEFAULT_HASURA_ENDPOINT;
    this.adminSecret = (adminSecret || '').trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(HASURA_ENDPOINT_STORAGE_KEY, this.endpoint);
      if (this.adminSecret) {
        localStorage.setItem(HASURA_SECRET_STORAGE_KEY, this.adminSecret);
      } else {
        localStorage.removeItem(HASURA_SECRET_STORAGE_KEY);
      }
    }
  }

  /**
   * Core GraphQL Request Executor
   */
  public async execute<T = any>(query: string, variables: Record<string, any> = {}): Promise<{ data?: T; errors?: any[]; ok: boolean }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.adminSecret) {
        headers['x-hasura-admin-secret'] = this.adminSecret;
      }

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables })
      });

      if (!res.ok) {
        return { ok: false, errors: [{ message: `HTTP Error ${res.status}: ${res.statusText}` }] };
      }

      const result = await res.json();
      if (result.errors && result.errors.length > 0) {
        return { ok: false, errors: result.errors, data: result.data };
      }

      return { ok: true, data: result.data };
    } catch (err: any) {
      return { ok: false, errors: [{ message: err.message || 'Failed to connect to GraphQL endpoint' }] };
    }
  }

  /**
   * Healthcheck to verify Hasura Engine connection
   */
  public async checkConnection(): Promise<HasuraConnectionConfig> {
    const query = `
      query CheckHasuraHealth {
        __schema {
          queryType {
            name
          }
        }
      }
    `;

    const start = Date.now();
    const result = await this.execute(query);
    const config: HasuraConnectionConfig = {
      endpoint: this.endpoint,
      adminSecret: this.adminSecret,
      connected: result.ok,
      lastChecked: new Date().toISOString(),
      error: result.errors ? result.errors[0]?.message : undefined
    };

    return config;
  }

  /**
   * Fetch All Agile Projects
   */
  public async getProjects(): Promise<JiraProject[]> {
    const query = `
      query GetProjects {
        projects(order_by: { name: asc }) {
          id
          key
          name
          description
          lead_id
          category
          avatar_url
          created_at
          updated_at
        }
      }
    `;

    const res = await this.execute<{ projects: any[] }>(query);
    if (!res.ok || !res.data?.projects) return [];

    return res.data.projects.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      leadId: p.lead_id,
      category: p.category,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  }

  /**
   * Fetch Sprints for a Project
   */
  public async getSprints(projectId?: string): Promise<JiraSprint[]> {
    const query = `
      query GetSprints($projectId: String) {
        sprints(
          where: { project_id: { _eq: $projectId } }
          order_by: { sequence_number: asc, created_at: desc }
        ) {
          id
          project_id
          name
          goal
          state
          start_date
          end_date
          complete_date
          sequence_number
          created_at
          updated_at
        }
      }
    `;

    const res = await this.execute<{ sprints: any[] }>(query, projectId ? { projectId } : {});
    if (!res.ok || !res.data?.sprints) return [];

    return res.data.sprints.map(s => ({
      id: s.id,
      projectId: s.project_id,
      name: s.name,
      goal: s.goal,
      state: s.state,
      startDate: s.start_date,
      endDate: s.end_date,
      completeDate: s.complete_date,
      sequenceNumber: s.sequence_number,
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }));
  }

  /**
   * Fetch Jira Issues
   */
  public async getIssues(filter?: { projectId?: string; sprintId?: string; status?: string }): Promise<JiraIssue[]> {
    const query = `
      query GetIssues($projectId: String, $sprintId: String) {
        issues(
          where: {
            _and: [
              { project_id: { _eq: $projectId } },
              { sprint_id: { _eq: $sprintId } }
            ]
          }
          order_by: { created_at: desc }
        ) {
          id
          issue_key
          project_id
          sprint_id
          release_id
          parent_issue_id
          epic_id
          issue_type
          summary
          description
          status
          priority
          severity
          story_points
          original_estimate_hours
          time_spent_hours
          assignee_id
          reporter_id
          environment
          resolution
          area_path
          iteration_path
          ado_id
          tags
          acceptance_criteria
          execution_metrics
          created_at
          updated_at
          issue_comments(order_by: { created_at: desc }) {
            id
            author_id
            author_name
            body
            created_at
          }
          work_logs(order_by: { started_at: desc }) {
            id
            author_id
            author_name
            time_spent_hours
            description
            started_at
            created_at
          }
        }
      }
    `;

    const variables: any = {};
    if (filter?.projectId) variables.projectId = filter.projectId;
    if (filter?.sprintId) variables.sprintId = filter.sprintId;

    const res = await this.execute<{ issues: any[] }>(query, variables);
    if (!res.ok || !res.data?.issues) return [];

    return res.data.issues.map(i => this.mapRawIssue(i));
  }

  /**
   * Create Issue in Hasura GraphQL
   */
  public async createIssue(issue: Partial<JiraIssue>): Promise<JiraIssue | null> {
    const mutation = `
      mutation CreateIssue($object: issues_insert_input!) {
        insert_issues_one(object: $object) {
          id
          issue_key
          project_id
          sprint_id
          release_id
          parent_issue_id
          epic_id
          issue_type
          summary
          description
          status
          priority
          severity
          story_points
          original_estimate_hours
          time_spent_hours
          assignee_id
          reporter_id
          environment
          resolution
          area_path
          iteration_path
          ado_id
          tags
          acceptance_criteria
          execution_metrics
          created_at
          updated_at
        }
      }
    `;

    const object = {
      id: issue.id || undefined,
      issue_key: issue.issueKey,
      project_id: issue.projectId,
      sprint_id: issue.sprintId || null,
      release_id: issue.releaseId || null,
      parent_issue_id: issue.parentIssueId || null,
      epic_id: issue.epicId || null,
      issue_type: issue.issueType || 'Story',
      summary: issue.summary,
      description: issue.description || '',
      status: issue.status || 'To Do',
      priority: issue.priority || 'medium',
      severity: issue.severity || 'medium',
      story_points: issue.storyPoints || 0,
      original_estimate_hours: issue.originalEstimateHours || 0,
      time_spent_hours: issue.timeSpentHours || 0,
      assignee_id: issue.assigneeId || null,
      reporter_id: issue.reporterId || null,
      environment: issue.environment || 'QA',
      area_path: issue.areaPath || '',
      iteration_path: issue.iterationPath || '',
      ado_id: issue.adoId || null,
      tags: issue.tags || [],
      acceptance_criteria: issue.acceptanceCriteria || [],
      execution_metrics: issue.executionMetrics || {}
    };

    const res = await this.execute<{ insert_issues_one: any }>(mutation, { object });
    if (!res.ok || !res.data?.insert_issues_one) return null;

    return this.mapRawIssue(res.data.insert_issues_one);
  }

  /**
   * Update Issue Status (e.g. from Board drag-and-drop)
   */
  public async updateIssueStatus(issueId: string, status: JiraIssueStatus): Promise<boolean> {
    const mutation = `
      mutation UpdateIssueStatus($id: String!, $status: String!) {
        update_issues_by_pk(pk_columns: { id: $id }, _set: { status: $status, updated_at: "now()" }) {
          id
          status
        }
      }
    `;

    const res = await this.execute(mutation, { id: issueId, status });
    return res.ok;
  }

  /**
   * Add Comment to Issue
   */
  public async addComment(issueId: string, authorName: string, body: string, authorId?: string): Promise<JiraIssueComment | null> {
    const mutation = `
      mutation AddComment($object: issue_comments_insert_input!) {
        insert_issue_comments_one(object: $object) {
          id
          issue_id
          author_id
          author_name
          body
          created_at
        }
      }
    `;

    const object = {
      issue_id: issueId,
      author_id: authorId || null,
      author_name: authorName,
      body: body.trim()
    };

    const res = await this.execute<{ insert_issue_comments_one: any }>(mutation, { object });
    if (!res.ok || !res.data?.insert_issue_comments_one) return null;

    const c = res.data.insert_issue_comments_one;
    return {
      id: c.id,
      issueId: c.issue_id,
      authorId: c.author_id,
      authorName: c.author_name,
      body: c.body,
      createdAt: c.created_at
    };
  }

  /**
   * Log Work (Time Tracking)
   */
  public async logWork(issueId: string, authorName: string, timeSpentHours: number, description?: string, authorId?: string): Promise<JiraWorkLog | null> {
    const mutation = `
      mutation LogWork($object: work_logs_insert_input!, $issueId: String!, $hours: numeric!) {
        insert_work_logs_one(object: $object) {
          id
          issue_id
          author_id
          author_name
          time_spent_hours
          description
          started_at
          created_at
        }
        update_issues_by_pk(
          pk_columns: { id: $issueId }
          _inc: { time_spent_hours: $hours }
        ) {
          id
          time_spent_hours
        }
      }
    `;

    const object = {
      issue_id: issueId,
      author_id: authorId || null,
      author_name: authorName,
      time_spent_hours: timeSpentHours,
      description: description || ''
    };

    const res = await this.execute<{ insert_work_logs_one: any }>(mutation, { object, issueId, hours: timeSpentHours });
    if (!res.ok || !res.data?.insert_work_logs_one) return null;

    const w = res.data.insert_work_logs_one;
    return {
      id: w.id,
      issueId: w.issue_id,
      authorId: w.author_id,
      authorName: w.author_name,
      timeSpentHours: Number(w.time_spent_hours),
      description: w.description,
      startedAt: w.started_at,
      createdAt: w.created_at
    };
  }

  /**
   * Map raw GraphQL issue object to JiraIssue
   */
  private mapRawIssue(i: any): JiraIssue {
    return {
      id: i.id,
      issueKey: i.issue_key,
      projectId: i.project_id,
      sprintId: i.sprint_id,
      releaseId: i.release_id,
      parentIssueId: i.parent_issue_id,
      epicId: i.epic_id,
      issueType: i.issue_type,
      summary: i.summary,
      description: i.description,
      status: i.status,
      priority: i.priority,
      severity: i.severity,
      storyPoints: i.story_points ? Number(i.story_points) : 0,
      originalEstimateHours: i.original_estimate_hours ? Number(i.original_estimate_hours) : 0,
      timeSpentHours: i.time_spent_hours ? Number(i.time_spent_hours) : 0,
      assigneeId: i.assignee_id,
      reporterId: i.reporter_id,
      environment: i.environment,
      resolution: i.resolution,
      areaPath: i.area_path,
      iterationPath: i.iteration_path,
      adoId: i.ado_id,
      tags: i.tags || [],
      acceptanceCriteria: i.acceptance_criteria || [],
      executionMetrics: i.execution_metrics,
      comments: Array.isArray(i.issue_comments) 
        ? i.issue_comments.map((c: any) => ({
            id: c.id,
            issueId: i.id,
            authorId: c.author_id,
            authorName: c.author_name,
            body: c.body,
            createdAt: c.created_at
          }))
        : [],
      workLogs: Array.isArray(i.work_logs)
        ? i.work_logs.map((w: any) => ({
            id: w.id,
            issueId: i.id,
            authorId: w.author_id,
            authorName: w.author_name,
            timeSpentHours: Number(w.time_spent_hours),
            description: w.description,
            startedAt: w.started_at,
            createdAt: w.created_at
          }))
        : [],
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || new Date().toISOString()
    };
  }

  /**
   * Helper to bridge standard AppState (UserStories, Defects, Tasks) into Jira Agile Issues
   */
  public bridgeAppStateToJira(state: AppState): {
    projects: JiraProject[];
    sprints: JiraSprint[];
    issues: JiraIssue[];
  } {
    const defaultProject: JiraProject = {
      id: 'proj-acm',
      key: 'ACM',
      name: state.settings.appName || 'ACM Delivery & Core Platform',
      description: 'Enterprise Telecom eSIM and Device Gateway Delivery Suite',
      category: 'Software',
      leadId: state.team[0]?.id
    };

    const projects = state.jiraProjects && state.jiraProjects.length > 0
      ? state.jiraProjects
      : [defaultProject];

    const defaultSprint: JiraSprint = {
      id: 'sprint-current',
      projectId: projects[0].id,
      name: `Sprint ${state.releases[0]?.releaseNumber || state.releases[0]?.name || '2026.09'} Active`,
      goal: 'Deliver high-priority telemetry fixes and complete test execution before target date.',
      state: 'active',
      sequenceNumber: 1
    };

    const sprints = state.jiraSprints && state.jiraSprints.length > 0
      ? state.jiraSprints
      : [defaultSprint];

    // Convert UserStories to Jira Stories
    const storyIssues: JiraIssue[] = (state.userStories || []).map((s, idx) => {
      let jiraStatus: JiraIssueStatus = 'To Do';
      if (s.status === 'Done') jiraStatus = 'Done';
      else if (s.status === 'QA Passed') jiraStatus = 'QA Passed';
      else if (s.status === 'QA In Progress') jiraStatus = 'QA In Progress';
      else if (s.status === 'QA Ready') jiraStatus = 'QA Ready';
      else if (s.status === 'Dev In Progress') jiraStatus = 'In Progress';
      else if (s.status === 'Blocked') jiraStatus = 'Blocked';

      const assignee = state.team.find(m => m.id === s.assigneeId);

      return {
        id: s.id || `story-${s.adoId || idx}`,
        issueKey: `ACM-${s.adoId || (100 + idx)}`,
        projectId: projects[0].id,
        sprintId: sprints[0].id,
        releaseId: s.releaseId || state.selectedReleaseId || undefined,
        issueType: 'Story',
        summary: s.title,
        description: s.description,
        status: jiraStatus,
        priority: 'high',
        storyPoints: s.storyPoints || 5,
        originalEstimateHours: (s.storyPoints || 5) * 3,
        timeSpentHours: jiraStatus === 'Done' ? (s.storyPoints || 5) * 3 : (s.storyPoints || 5),
        assigneeId: s.assigneeId,
        assigneeName: assignee ? assignee.name : s.assigneeName,
        areaPath: s.areaPath || 'ACM',
        iterationPath: s.iterationPath,
        adoId: s.adoId,
        tags: s.tags || [],
        acceptanceCriteria: s.acceptanceCriteria || [],
        executionMetrics: s.executionMetrics,
        comments: (s.comments || []).map(c => ({
          id: String(c.id),
          issueId: s.id,
          authorName: c.author || 'Contributor',
          body: c.text,
          createdAt: c.createdAt
        })),
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString()
      };
    });

    // Convert Defects to Jira Bugs
    const bugIssues: JiraIssue[] = (state.defects || []).map((d, idx) => {
      let jiraStatus: JiraIssueStatus = 'In Progress';
      if (d.status === 'Closed') jiraStatus = 'Done';
      else if (d.status === 'Fixed' || d.status === 'Retest') jiraStatus = 'QA Ready';
      else if (d.status === 'New') jiraStatus = 'To Do';

      const assignee = state.team.find(m => m.id === d.assigneeId);

      return {
        id: d.id || `bug-${d.adoId || idx}`,
        issueKey: `ACM-BUG-${d.adoId || (900 + idx)}`,
        projectId: projects[0].id,
        sprintId: sprints[0].id,
        releaseId: d.releaseId || state.selectedReleaseId || undefined,
        parentIssueId: d.userStoryId || undefined,
        issueType: 'Bug',
        summary: d.title,
        description: d.description || d.stepsToReproduce,
        status: jiraStatus,
        priority: d.severity === 'critical' ? 'critical' : d.severity === 'high' ? 'high' : 'medium',
        severity: d.severity,
        storyPoints: d.severity === 'critical' ? 3 : 2,
        originalEstimateHours: 8,
        timeSpentHours: jiraStatus === 'Done' ? 8 : 4,
        assigneeId: d.assigneeId,
        assigneeName: assignee ? assignee.name : d.assigneeName,
        environment: d.environment || 'QA',
        areaPath: d.areaPath || 'ACM',
        iterationPath: d.iterationPath,
        adoId: d.adoId,
        tags: d.tags || [],
        comments: ((d as any).comments || []).map((c: any) => ({
          id: String(c.id),
          issueId: d.id,
          authorName: c.author || 'QA Lead',
          body: c.text,
          createdAt: c.createdAt || new Date().toISOString()
        })),
        createdAt: (d as any).createdAt || new Date().toISOString(),
        updatedAt: (d as any).updatedAt || new Date().toISOString()
      };
    });

    // Convert Tasks to Jira Tasks
    const taskIssues: JiraIssue[] = (state.tasks || []).map((t, idx) => {
      let jiraStatus: JiraIssueStatus = 'To Do';
      if (t.status === 'complete') jiraStatus = 'Done';
      else if (t.status === 'partial') jiraStatus = 'In Progress';

      const assignee = state.team.find(m => m.id === t.assigneeId);

      return {
        id: t.id || `task-${(t as any).adoId || idx}`,
        issueKey: `ACM-TASK-${(t as any).adoId || (500 + idx)}`,
        projectId: projects[0].id,
        sprintId: sprints[0].id,
        releaseId: t.releaseId || state.selectedReleaseId || undefined,
        parentIssueId: t.userStoryId || t.defectId || undefined,
        issueType: t.userStoryId || t.defectId ? 'Subtask' : 'Task',
        summary: t.title,
        description: (t as any).description || t.title,
        status: jiraStatus,
        priority: t.priority || 'medium',
        storyPoints: 1,
        originalEstimateHours: 4,
        timeSpentHours: jiraStatus === 'Done' ? 4 : 1,
        assigneeId: t.assigneeId,
        assigneeName: assignee ? assignee.name : t.assigneeName,
        areaPath: t.areaPath || 'ACM',
        iterationPath: t.iterationPath,
        adoId: (t as any).adoId,
        tags: (t as any).tags || [],
        comments: (t.comments || []).map(c => ({
          id: String(c.id),
          issueId: t.id,
          authorName: c.author || 'Engineer',
          body: c.text,
          createdAt: c.createdAt
        })),
        createdAt: (t as any).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    const issues = state.jiraIssues && state.jiraIssues.length > 0
      ? state.jiraIssues
      : [...storyIssues, ...bugIssues, ...taskIssues];

    return {
      projects,
      sprints,
      issues
    };
  }
}

export const graphqlService = new GraphqlService();
