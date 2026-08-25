import { TeamMember, UserStory, TestCase, Defect, Task } from '../types';

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

/**
 * Deterministically generates an avatar color from a string (name or id).
 */
export function getAvatarColorForName(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Standardizes a name to a clean alphanumeric ID slug.
 */
export function generateMemberIdFromName(name: string): string {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return clean ? `member-${clean}` : 'member-unassigned';
}

export interface ResolvedAssignee {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
  avatarInitials: string;
  isVirtual?: boolean;
}

/**
 * Checks if a string represents an unassigned work item.
 */
export function isUnassignedValue(val?: string | null): boolean {
  if (!val) return true;
  const lower = val.trim().toLowerCase();
  return lower === '' || lower === 'unassigned' || lower === 'none' || lower === 'null' || lower === 'undefined';
}

/**
 * Robustly resolves the assignee for any work item (UserStory, Defect, TestCase, Task).
 * Tries:
 * 1. Matching assigneeId against team members by id.
 * 2. Matching assigneeId against team members by name or email.
 * 3. Matching assigneeName against team members by name, email, or id.
 * 4. Checking assigneeIds array (for Tasks).
 * 5. If not in team list but assigneeName is present, generates a valid virtual assignee object
 *    so the UI never incorrectly displays "Unassigned" when a valid name exists.
 */
export function getWorkItemAssignee(
  item: {
    assigneeId?: string | null;
    assigneeName?: string | null;
    assigneeIds?: string[];
  } | null | undefined,
  team: TeamMember[] = []
): ResolvedAssignee | null {
  if (!item) return null;

  const { assigneeId, assigneeName, assigneeIds } = item;

  // 1. Direct ID match
  if (assigneeId && !isUnassignedValue(assigneeId)) {
    const directMember = team.find(m => m.id === assigneeId);
    if (directMember) {
      return formatResolvedAssignee(directMember);
    }

    // Check if assigneeId is actually a member's name or email
    const nameMatch = team.find(
      m => m.name.toLowerCase() === assigneeId.toLowerCase() ||
           m.email?.toLowerCase() === assigneeId.toLowerCase()
    );
    if (nameMatch) {
      return formatResolvedAssignee(nameMatch);
    }
  }

  // 2. Check assigneeName if present
  if (assigneeName && !isUnassignedValue(assigneeName)) {
    const cleanName = assigneeName.replace(/<[^>]+>/, '').trim();
    const memberByName = team.find(
      m => m.name.toLowerCase() === cleanName.toLowerCase() ||
           m.id === cleanName.toLowerCase() ||
           m.email?.toLowerCase() === cleanName.toLowerCase()
    );
    if (memberByName) {
      return formatResolvedAssignee(memberByName);
    }

    // 3. Fallback virtual assignee from assigneeName
    return {
      id: assigneeId || generateMemberIdFromName(cleanName),
      name: cleanName,
      role: 'Team Member',
      email: `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@company.com`,
      avatarColor: getAvatarColorForName(cleanName),
      avatarInitials: getInitials(cleanName),
      isVirtual: true
    };
  }

  // 4. Check assigneeIds array
  if (assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0) {
    for (const id of assigneeIds) {
      if (isUnassignedValue(id)) continue;
      const member = team.find(m => m.id === id || m.name.toLowerCase() === id.toLowerCase());
      if (member) {
        return formatResolvedAssignee(member);
      }
      // If id is a name string
      return {
        id: generateMemberIdFromName(id),
        name: id,
        role: 'Team Member',
        email: `${id.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@company.com`,
        avatarColor: getAvatarColorForName(id),
        avatarInitials: getInitials(id),
        isVirtual: true
      };
    }
  }

  return null;
}

/**
 * Returns all assigned members for a Task or multi-assignee item.
 */
export function getWorkItemAssignees(
  task: {
    assigneeIds?: string[];
    assigneeId?: string | null;
    assigneeName?: string | null;
  } | null | undefined,
  team: TeamMember[] = []
): ResolvedAssignee[] {
  if (!task) return [];

  const results: ResolvedAssignee[] = [];
  const seenIds = new Set<string>();

  // Collect from assigneeIds array
  if (task.assigneeIds && Array.isArray(task.assigneeIds)) {
    task.assigneeIds.forEach(id => {
      if (isUnassignedValue(id)) return;
      const member = team.find(m => m.id === id || m.name.toLowerCase() === id.toLowerCase());
      if (member) {
        if (!seenIds.has(member.id)) {
          seenIds.add(member.id);
          results.push(formatResolvedAssignee(member));
        }
      } else {
        const fallbackId = generateMemberIdFromName(id);
        if (!seenIds.has(fallbackId)) {
          seenIds.add(fallbackId);
          results.push({
            id: fallbackId,
            name: id,
            role: 'Team Member',
            email: `${id.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@company.com`,
            avatarColor: getAvatarColorForName(id),
            avatarInitials: getInitials(id),
            isVirtual: true
          });
        }
      }
    });
  }

  // If no assignees found via array, fall back to single assignee resolver
  if (results.length === 0) {
    const single = getWorkItemAssignee(task, team);
    if (single) {
      results.push(single);
    }
  }

  return results;
}

/**
 * Helper to match an item against the assignee filter value.
 * filterValue can be '' / undefined (all), 'unassigned', or a member ID/name.
 */
export function matchesAssigneeFilter(
  item: {
    assigneeId?: string | null;
    assigneeName?: string | null;
    assigneeIds?: string[];
  } | null | undefined,
  filterValue: string,
  team: TeamMember[] = []
): boolean {
  if (!filterValue || filterValue === 'all') return true;

  const resolved = getWorkItemAssignee(item, team);

  if (filterValue === 'unassigned') {
    return resolved === null;
  }

  if (!resolved) return false;

  // Compare against filterValue (could be member ID or name)
  return Boolean(
    resolved.id.toLowerCase() === filterValue.toLowerCase() ||
    resolved.name.toLowerCase() === filterValue.toLowerCase() ||
    (item?.assigneeId && item.assigneeId.toLowerCase() === filterValue.toLowerCase()) ||
    (item?.assigneeName && item.assigneeName.toLowerCase() === filterValue.toLowerCase()) ||
    (item?.assigneeIds && item.assigneeIds.some(id => id.toLowerCase() === filterValue.toLowerCase()))
  );
}

/**
 * Sanitizes and extracts all unique team members from work items,
 * linking their assigneeId / assigneeIds properly.
 */
export function sanitizeAndLinkWorkItems(
  data: {
    userStories?: UserStory[];
    testCases?: TestCase[];
    defects?: Defect[];
    tasks?: Task[];
    team?: TeamMember[];
  }
): {
  userStories: UserStory[];
  testCases: TestCase[];
  defects: Defect[];
  tasks: Task[];
  team: TeamMember[];
} {
  const currentTeam = [...(data.team || [])];
  const teamMemberMap = new Map<string, TeamMember>();

  // Register existing team members
  currentTeam.forEach(m => {
    teamMemberMap.set(m.id.toLowerCase(), m);
    teamMemberMap.set(m.name.toLowerCase(), m);
  });

  const getOrCreateMember = (rawName?: string | null, role: string = 'Software Engineer'): TeamMember | null => {
    if (!rawName || isUnassignedValue(rawName)) return null;
    const cleanName = rawName.replace(/<[^>]+>/, '').trim();
    if (!cleanName || isUnassignedValue(cleanName)) return null;

    const existing = teamMemberMap.get(cleanName.toLowerCase());
    if (existing) return existing;

    const memberId = generateMemberIdFromName(cleanName);
    const existingById = teamMemberMap.get(memberId.toLowerCase());
    if (existingById) return existingById;

    const emailSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.');
    const newMember: TeamMember = {
      id: memberId,
      name: cleanName,
      role,
      email: `${emailSlug}@company.com`,
      avatarColor: getAvatarColorForName(cleanName),
      groupIds: [],
      active: true,
      isMyTeam: false,
      adoSource: 'assigned_to'
    };

    teamMemberMap.set(memberId.toLowerCase(), newMember);
    teamMemberMap.set(cleanName.toLowerCase(), newMember);
    currentTeam.push(newMember);
    return newMember;
  };

  // Sanitize User Stories
  const sanitizedStories = (data.userStories || []).map(s => {
    const member = getOrCreateMember(s.assigneeName || s.assigneeId);
    return {
      ...s,
      assigneeId: member ? member.id : (s.assigneeId && !isUnassignedValue(s.assigneeId) ? s.assigneeId : null),
      assigneeName: member ? member.name : (s.assigneeName && !isUnassignedValue(s.assigneeName) ? s.assigneeName : undefined)
    };
  });

  // Sanitize Test Cases
  const sanitizedTestCases = (data.testCases || []).map(tc => {
    const member = getOrCreateMember(tc.assigneeName || tc.assigneeId);
    return {
      ...tc,
      assigneeId: member ? member.id : (tc.assigneeId && !isUnassignedValue(tc.assigneeId) ? tc.assigneeId : null),
      assigneeName: member ? member.name : (tc.assigneeName && !isUnassignedValue(tc.assigneeName) ? tc.assigneeName : undefined)
    };
  });

  // Sanitize Defects
  const sanitizedDefects = (data.defects || []).map(d => {
    const member = getOrCreateMember(d.assigneeName || d.assigneeId);
    return {
      ...d,
      assigneeId: member ? member.id : (d.assigneeId && !isUnassignedValue(d.assigneeId) ? d.assigneeId : null),
      assigneeName: member ? member.name : (d.assigneeName && !isUnassignedValue(d.assigneeName) ? d.assigneeName : undefined)
    };
  });

  // Sanitize Tasks
  const sanitizedTasks = (data.tasks || []).map(t => {
    const primaryName = t.assigneeName || (t.assigneeIds && t.assigneeIds[0]);
    const member = getOrCreateMember(primaryName);
    const assigneeIds = member ? [member.id] : (t.assigneeIds || []);

    return {
      ...t,
      assigneeIds,
      assigneeId: member ? member.id : (t.assigneeId || null),
      assigneeName: member ? member.name : (t.assigneeName || undefined)
    };
  });

  return {
    userStories: sanitizedStories,
    testCases: sanitizedTestCases,
    defects: sanitizedDefects,
    tasks: sanitizedTasks,
    team: currentTeam
  };
}

function formatResolvedAssignee(m: TeamMember): ResolvedAssignee {
  return {
    id: m.id,
    name: m.name,
    role: typeof m.role === 'string' ? m.role : 'Team Member',
    email: m.email || '',
    avatarColor: m.avatarColor || getAvatarColorForName(m.name),
    avatarInitials: getInitials(m.name),
    isVirtual: false
  };
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
