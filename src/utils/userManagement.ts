import { AppState, AppUser, TeamMember, UserRole, ROLE_CONFIGS } from '../types';
import { generateId } from './date';
import { AVATAR_COLORS } from './demoData';

/**
 * Ensures that all users are modeled with fixed roles and org/project scoping.
 * Rule: Assigns Administrator for whoever set up the ADO connection, and Viewer (Stakeholder/Viewer)
 * for everyone else, so nobody is left without access.
 */
export function ensureUsersAndRoles(state: Partial<AppState>): { users: AppUser[]; currentUserId: string } {
  const existingUsers: AppUser[] = Array.isArray(state.users) ? [...state.users] : [];
  const teamMembers: TeamMember[] = Array.isArray(state.team) ? state.team : [];

  // Determine ADO connection owner details
  const internalAdo = state.dualAdoConfig?.internal;
  const legacyAdo = state.adoConfig;
  const primaryOrg = internalAdo?.organization || legacyAdo?.organization || '*';
  const primaryProject = internalAdo?.project || legacyAdo?.project || '*';
  const hasAdoConfig = Boolean((internalAdo?.organization && internalAdo?.project) || (legacyAdo?.organization && legacyAdo?.project));

  const adminName = state.settings?.yourName || 'ADO Connection Admin';
  const adminEmail = state.settings?.managerEmail || state.settings?.emailRecipient || 'admin@delivery.internal';

  // 1. If no users exist, seed initial users
  if (existingUsers.length === 0) {
    // Primary ADO Administrator
    const adminUser: AppUser = {
      id: 'usr-admin-primary',
      name: adminName,
      email: adminEmail,
      role: UserRole.Administrator,
      orgScope: primaryOrg,
      projectScope: primaryProject,
      avatarColor: '#E11D48',
      isAdoConnectionOwner: hasAdoConfig,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    existingUsers.push(adminUser);

    // Convert any existing team members to Users with default 'Stakeholder/Viewer' role so nobody is left without access
    teamMembers.forEach((member, idx) => {
      // Avoid duplicate if member matches admin name/email
      if (
        member.email?.toLowerCase() === adminEmail.toLowerCase() ||
        member.name?.toLowerCase() === adminName.toLowerCase()
      ) {
        return;
      }

      // If member already had a valid recognized UserRole, respect it; otherwise default to Stakeholder/Viewer
      const validRole = Object.values(UserRole).includes(member.role as UserRole)
        ? (member.role as UserRole)
        : UserRole.StakeholderViewer;

      existingUsers.push({
        id: member.id || generateId('usr'),
        name: member.name || `User ${idx + 1}`,
        email: member.email || `user${idx + 1}@company.com`,
        role: validRole,
        orgScope: primaryOrg !== '*' ? primaryOrg : '*',
        projectScope: primaryProject !== '*' ? primaryProject : '*',
        avatarColor: member.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length],
        isAdoConnectionOwner: false,
        active: member.active !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  } else {
    // 2. Existing users present - ensure at least one Administrator is assigned (the ADO connection owner)
    const hasAdmin = existingUsers.some(u => u.role === UserRole.Administrator);
    if (!hasAdmin && existingUsers.length > 0) {
      existingUsers[0].role = UserRole.Administrator;
      existingUsers[0].isAdoConnectionOwner = true;
    }

    // Ensure every user has a valid UserRole, defaulting to Stakeholder/Viewer if invalid or missing
    existingUsers.forEach(u => {
      if (!u.role || !Object.values(UserRole).includes(u.role)) {
        u.role = UserRole.StakeholderViewer;
      }
      if (!u.orgScope) u.orgScope = '*';
      if (!u.projectScope) u.projectScope = '*';
    });

    // Also sync any newly added team members who don't have a user record yet
    teamMembers.forEach((member, idx) => {
      const exists = existingUsers.some(
        u => u.id === member.id || (u.email && member.email && u.email.toLowerCase() === member.email.toLowerCase())
      );
      if (!exists) {
        existingUsers.push({
          id: member.id || generateId('usr'),
          name: member.name,
          email: member.email || `user-${idx}@company.com`,
          role: Object.values(UserRole).includes(member.role as UserRole) ? (member.role as UserRole) : UserRole.StakeholderViewer,
          orgScope: primaryOrg,
          projectScope: primaryProject,
          avatarColor: member.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length],
          isAdoConnectionOwner: false,
          active: member.active !== false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
  }

  // Determine current active user ID
  let currentUserId = state.currentUserId;
  if (!currentUserId || !existingUsers.some(u => u.id === currentUserId)) {
    const admin = existingUsers.find(u => u.role === UserRole.Administrator) || existingUsers[0];
    currentUserId = admin ? admin.id : 'usr-admin-primary';
  }

  return {
    users: existingUsers,
    currentUserId
  };
}

/**
 * Validates if a user is permitted to access or modify resources in a target org/project scope
 */
export function isUserInScope(user: AppUser, targetOrg?: string, targetProject?: string): boolean {
  if (user.role === UserRole.Administrator) return true;
  
  const matchesOrg = !user.orgScope || user.orgScope === '*' || !targetOrg || user.orgScope.toLowerCase() === targetOrg.toLowerCase();
  const matchesProj = !user.projectScope || user.projectScope === '*' || !targetProject || user.projectScope.toLowerCase() === targetProject.toLowerCase();

  return matchesOrg && matchesProj;
}

/**
 * Checks a specific permission capability against the user's fixed role and optional scope
 */
export function checkUserPermission(
  user: AppUser | undefined,
  action: keyof typeof ROLE_CONFIGS[UserRole],
  targetOrg?: string,
  targetProject?: string
): boolean {
  if (!user) return false;
  if (!isUserInScope(user, targetOrg, targetProject)) return false;

  const roleConfig = ROLE_CONFIGS[user.role] || ROLE_CONFIGS[UserRole.StakeholderViewer];
  return Boolean(roleConfig[action]);
}

/**
 * Synchronizes users fetched from ADO with strict deduplication:
 * - If user already exists by email or name, IGNORE adding.
 * - Only NEW users are added.
 */
export function syncAdoUsersWithDeduplication(params: {
  adoUsers: Array<{ id?: string; name: string; email: string; teamName?: string }>;
  existingUsers: AppUser[];
  existingTeam: TeamMember[];
  orgScope?: string;
  projectScope?: string;
}): {
  updatedUsers: AppUser[];
  updatedTeam: TeamMember[];
  addedCount: number;
  ignoredCount: number;
  addedUsers: AppUser[];
  ignoredUsers: string[];
} {
  const { adoUsers, existingUsers, existingTeam, orgScope = '*', projectScope = '*' } = params;

  const usersResult = [...existingUsers];
  const teamResult = [...existingTeam];
  const addedUsers: AppUser[] = [];
  const ignoredUsers: string[] = [];

  const isUserExisting = (name: string, email: string) => {
    const cleanName = (name || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    return (
      usersResult.some(u => 
        (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
        (cleanName && u.name && u.name.toLowerCase() === cleanName)
      ) ||
      teamResult.some(m => 
        (cleanEmail && m.email && m.email.toLowerCase() === cleanEmail) ||
        (cleanName && m.name && m.name.toLowerCase() === cleanName)
      )
    );
  };

  adoUsers.forEach((adoUser, idx) => {
    const origName = (adoUser.name || '').trim();
    const origEmail = (adoUser.email || '').trim();

    if (!origName) return;

    if (isUserExisting(origName, origEmail)) {
      // User already exists -> IGNORE adding
      ignoredUsers.push(`${origName} (${origEmail || 'no-email'})`);
    } else {
      // New user only -> ADD it
      const newUserId = generateId('usr');
      const avatarColor = AVATAR_COLORS[(usersResult.length + idx) % AVATAR_COLORS.length];

      const newUser: AppUser = {
        id: newUserId,
        name: origName,
        email: origEmail || `${origName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@company.com`,
        role: UserRole.StakeholderViewer,
        orgScope: orgScope !== '*' ? orgScope : '*',
        projectScope: projectScope !== '*' ? projectScope : '*',
        avatarColor,
        isAdoConnectionOwner: false,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      usersResult.push(newUser);
      addedUsers.push(newUser);

      // Also ensure added to Team list if not present
      if (!teamResult.some(m => m.name.toLowerCase() === origName.toLowerCase())) {
        const newTeamMember: TeamMember = {
          id: newUserId,
          name: origName,
          role: 'Viewer',
          email: newUser.email,
          avatarColor,
          active: true
        };
        teamResult.push(newTeamMember);
      }
    }
  });

  return {
    updatedUsers: usersResult,
    updatedTeam: teamResult,
    addedCount: addedUsers.length,
    ignoredCount: ignoredUsers.length,
    addedUsers,
    ignoredUsers
  };
}

