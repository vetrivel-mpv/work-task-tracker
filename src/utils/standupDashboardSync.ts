import { AppState, Task, UserStory, Defect, TeamMember, StandupEntry } from '../types';
import { shiftDate } from './date';
import { getWorkItemAssignees } from './assigneeUtils';

export interface MemberDashboardItems {
  member: TeamMember;
  openTasks: Task[];
  completedTasksYesterday: Task[];
  completedTasksToday: Task[];
  activeStories: UserStory[];
  activeDefects: Defect[];
  blockedTasks: Task[];
  totalOpenCount: number;
}

export interface StandupReconciliationItem {
  id: string;
  memberId: string;
  memberName: string;
  type: 'mark_task_complete' | 'create_blocker_defect' | 'push_task_to_today' | 'update_defect_status' | 'sync_standup_comment';
  title: string;
  description: string;
  sourceText: string;
  targetItemId?: string;
  targetItemType?: 'task' | 'defect' | 'story';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  suggestedActionLabel: string;
  applied?: boolean;
}

/**
 * Checks if a work item is assigned to a specific team member.
 */
export function isItemAssignedToMember(
  item: { assigneeId?: string | null; assigneeName?: string | null; assigneeIds?: string[] },
  memberId: string,
  team: TeamMember[]
): boolean {
  if (!memberId) return false;
  const member = team.find(m => m.id === memberId);
  if (!member) return false;

  // Direct ID match
  if (item.assigneeId === memberId) return true;
  if (item.assigneeIds && item.assigneeIds.includes(memberId)) return true;

  // Name match
  const memberNameLower = member.name.toLowerCase().trim();
  if (item.assigneeName && item.assigneeName.toLowerCase().trim() === memberNameLower) return true;
  if (item.assigneeId && item.assigneeId.toLowerCase().trim() === memberNameLower) return true;
  if (item.assigneeIds && item.assigneeIds.some(id => id.toLowerCase().trim() === memberNameLower)) return true;

  return false;
}

/**
 * Retrieves all categorized dashboard items for a specific team member.
 */
export function getMemberDashboardItems(memberId: string, state: AppState): MemberDashboardItems {
  const member = state.team.find(m => m.id === memberId) || {
    id: memberId,
    name: 'Team Member',
    role: 'Contributor',
    email: 'member@company.com'
  };

  const yesterdayStr = shiftDate(state.dateStr, -1);

  // Open tasks (pending or partial)
  const openTasks = (state.tasks || []).filter(t => 
    t.status !== 'complete' && isItemAssignedToMember(t, memberId, state.team)
  );

  // Completed yesterday
  const completedTasksYesterday = (state.tasks || []).filter(t => 
    t.status === 'complete' && 
    (t.dateStr === yesterdayStr || t.completedAt?.startsWith(yesterdayStr)) &&
    isItemAssignedToMember(t, memberId, state.team)
  );

  // Completed today
  const completedTasksToday = (state.tasks || []).filter(t => 
    t.status === 'complete' && 
    (t.dateStr === state.dateStr || t.completedAt?.startsWith(state.dateStr)) &&
    isItemAssignedToMember(t, memberId, state.team)
  );

  // Active user stories
  const activeStories = (state.userStories || []).filter(s => 
    s.status !== 'Done' && isItemAssignedToMember(s, memberId, state.team)
  );

  // Active defects
  const activeDefects = (state.defects || []).filter(d => 
    d.status !== 'Closed' && isItemAssignedToMember(d, memberId, state.team)
  );

  // Blocked tasks
  const blockedTasks = openTasks.filter(t => {
    if (!t.dependsOnTaskIds || t.dependsOnTaskIds.length === 0) return false;
    return t.dependsOnTaskIds.some(depId => {
      const dep = (state.tasks || []).find(p => p.id === depId);
      return dep && dep.status !== 'complete';
    });
  });

  const totalOpenCount = openTasks.length + activeStories.length + activeDefects.length;

  return {
    member,
    openTasks,
    completedTasksYesterday,
    completedTasksToday,
    activeStories,
    activeDefects,
    blockedTasks,
    totalOpenCount
  };
}

/**
 * Formats a task, user story, or defect into a concise standup bullet.
 */
export function formatItemForStandup(
  item: Task | UserStory | Defect, 
  type: 'task' | 'story' | 'defect'
): string {
  const idBadge = item.adoId ? `#${item.adoId}` : item.id.slice(-4).toUpperCase();
  
  if (type === 'task') {
    const t = item as Task;
    const priorityTag = t.priority === 'critical' ? ' [CRITICAL]' : t.priority === 'high' ? ' [HIGH]' : '';
    return `[Task ${idBadge}] ${t.title}${priorityTag}`;
  } else if (type === 'story') {
    const s = item as UserStory;
    return `[Story ${idBadge}] ${s.title} (${s.status})`;
  } else {
    const d = item as Defect;
    return `[Defect ${idBadge}] ${d.title} (Severity: ${d.severity.toUpperCase()}, Status: ${d.status})`;
  }
}

/**
 * Generates an auto-synced standup entry for a member from their open dashboard items.
 */
export function generateStandupFromDashboard(
  memberId: string, 
  state: AppState,
  existingEntry?: StandupEntry
): StandupEntry {
  const items = getMemberDashboardItems(memberId, state);

  // 1. Yesterday's Accomplishments
  const yesterdayLines: string[] = [];
  if (items.completedTasksYesterday.length > 0) {
    items.completedTasksYesterday.forEach(t => {
      yesterdayLines.push(formatItemForStandup(t, 'task'));
    });
  } else if (items.completedTasksToday.length > 0) {
    items.completedTasksToday.forEach(t => {
      yesterdayLines.push(formatItemForStandup(t, 'task'));
    });
  }

  // 2. Today's Commitments & Focus
  const todayLines: string[] = [];
  // Add in-progress or pending tasks
  items.openTasks.forEach(t => {
    todayLines.push(formatItemForStandup(t, 'task'));
  });
  // Add active user stories
  items.activeStories.forEach(s => {
    todayLines.push(formatItemForStandup(s, 'story'));
  });
  // Add assigned defects
  items.activeDefects.forEach(d => {
    todayLines.push(formatItemForStandup(d, 'defect'));
  });

  // 3. Blockers
  const blockerLines: string[] = [];
  if (items.blockedTasks.length > 0) {
    items.blockedTasks.forEach(t => {
      blockerLines.push(`Blocked task [Task #${t.adoId || t.id.slice(-4)}]: Waiting on prerequisite tasks`);
    });
  }
  const criticalDefects = items.activeDefects.filter(d => d.severity === 'critical' || d.severity === 'high');
  if (criticalDefects.length > 0) {
    criticalDefects.forEach(d => {
      blockerLines.push(`High/Critical Defect [Defect #${d.adoId || d.id.slice(-4)}]: ${d.title}`);
    });
  }

  const yesterdayText = yesterdayLines.length > 0 
    ? yesterdayLines.map(l => `• ${l}`).join('\n')
    : (existingEntry?.yesterday || 'Continued delivery and code reviews');

  const todayText = todayLines.length > 0
    ? todayLines.map(l => `• ${l}`).join('\n')
    : (existingEntry?.today || 'Sprint backlog implementation & defect triage');

  const blockersText = blockerLines.length > 0
    ? blockerLines.map(l => `• ${l}`).join('\n')
    : (existingEntry?.blockers || 'None');

  const allLinkedIds = [
    ...items.openTasks.map(t => t.id),
    ...items.activeStories.map(s => s.id),
    ...items.activeDefects.map(d => d.id)
  ];

  return {
    yesterday: yesterdayText,
    today: todayText,
    blockers: blockersText,
    linkedItemIds: allLinkedIds,
    submittedAt: new Date().toISOString(),
    syncedWithDashboardAt: new Date().toISOString()
  };
}

/**
 * Bulk syncs all team members' standups with their open dashboard items.
 */
export function syncAllMembersStandupFromDashboard(state: AppState): Record<string, StandupEntry> {
  const nextStandup: Record<string, StandupEntry> = { ...(state.standup || {}) };

  state.team.forEach(member => {
    const existing = nextStandup[member.id];
    nextStandup[member.id] = generateStandupFromDashboard(member.id, state, existing);
  });

  return nextStandup;
}

/**
 * Discovers reconciliation actions between Standup discussions and Dashboard items.
 */
export function discoverStandupReconciliationActions(state: AppState): StandupReconciliationItem[] {
  const actions: StandupReconciliationItem[] = [];
  const standup = state.standup || {};
  const tasks = state.tasks || [];
  const defects = state.defects || [];

  state.team.forEach(member => {
    const entry = standup[member.id];
    if (!entry) return;

    // 1. Check Yesterday text for open tasks that might now be complete
    if (entry.yesterday && entry.yesterday.trim()) {
      const yesterdayLower = entry.yesterday.toLowerCase();
      const memberOpenTasks = tasks.filter(t => 
        t.status !== 'complete' && isItemAssignedToMember(t, member.id, state.team)
      );

      memberOpenTasks.forEach(task => {
        const titleMatch = task.title.toLowerCase();
        const idMatch = task.adoId ? `#${task.adoId}` : task.id.slice(-4).toLowerCase();
        
        if (
          yesterdayLower.includes(titleMatch) || 
          yesterdayLower.includes(idMatch) || 
          (task.title.length > 8 && yesterdayLower.includes(task.title.toLowerCase().substring(0, 15)))
        ) {
          actions.push({
            id: `rec-complete-${member.id}-${task.id}`,
            memberId: member.id,
            memberName: member.name,
            type: 'mark_task_complete',
            title: `Mark "${task.title}" as Complete`,
            description: `Mentioned in ${member.name}'s yesterday accomplishments, but task status is "${task.status}" on the Dashboard.`,
            sourceText: entry.yesterday,
            targetItemId: task.id,
            targetItemType: 'task',
            suggestedActionLabel: 'Mark Task Complete'
          });
        }
      });
    }

    // 2. Check Blockers text for potential new blockers or defects
    if (entry.blockers && entry.blockers.trim() && entry.blockers.toLowerCase() !== 'none') {
      const lines = entry.blockers.split('\n').filter(l => l.trim());
      lines.forEach((line, idx) => {
        const cleanLine = line.replace(/^[•\-\*\s]+/, '').trim();
        if (cleanLine.length < 5) return;

        // Check if there's already a defect matching this text
        const existingDefect = defects.find(d => 
          d.title.toLowerCase().includes(cleanLine.toLowerCase().slice(0, 20))
        );

        if (!existingDefect) {
          actions.push({
            id: `rec-blocker-${member.id}-${idx}`,
            memberId: member.id,
            memberName: member.name,
            type: 'create_blocker_defect',
            title: `Create Defect for Blocker: "${cleanLine.slice(0, 60)}"`,
            description: `Blocker raised in standup by ${member.name}: "${cleanLine}"`,
            sourceText: cleanLine,
            severity: cleanLine.toLowerCase().includes('critical') || cleanLine.toLowerCase().includes('crash') ? 'critical' : 'high',
            suggestedActionLabel: 'Create Dashboard Defect'
          });
        }
      });
    }

    // 3. Check for high-priority open tasks not mentioned in Today's Focus
    if (entry.today) {
      const todayLower = entry.today.toLowerCase();
      const criticalPendingTasks = tasks.filter(t => 
        (t.priority === 'critical' || t.priority === 'high') && 
        t.status !== 'complete' && 
        isItemAssignedToMember(t, member.id, state.team)
      );

      criticalPendingTasks.forEach(task => {
        const titleMatch = task.title.toLowerCase();
        const idMatch = task.adoId ? `#${task.adoId}` : task.id.slice(-4).toLowerCase();

        if (!todayLower.includes(titleMatch) && !todayLower.includes(idMatch)) {
          actions.push({
            id: `rec-push-today-${member.id}-${task.id}`,
            memberId: member.id,
            memberName: member.name,
            type: 'push_task_to_today',
            title: `Add [${task.priority.toUpperCase()}] "${task.title}" to Today's Standup`,
            description: `High-priority open task assigned to ${member.name} is not listed in their Today commitments.`,
            sourceText: task.title,
            targetItemId: task.id,
            targetItemType: 'task',
            suggestedActionLabel: 'Add to Standup Today'
          });
        }
      });
    }
  });

  return actions;
}
