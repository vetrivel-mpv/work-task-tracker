/**
 * Northstar Delivery - Server-Side Permission & Role Middleware
 * 
 * Centralized, shared middleware functions for role-based access control (RBAC),
 * capability permissions, and Azure DevOps organizational scoping.
 * 
 * Usage examples:
 *   import { requireRole, requirePermission, requireScope } from './permissionMiddleware.js';
 * 
 *   // Restrict route to specific roles:
 *   app.post('/api/admin/users', requireRole(['Administrator']), handler);
 *   app.post('/api/releases/gate', requireRole(['Administrator', 'Delivery/Release Manager']), handler);
 * 
 *   // Restrict route by fine-grained capability:
 *   app.post('/api/ado/workitems', requirePermission('canEditWorkItems'), handler);
 *   app.post('/api/ado/sync-workitems', requirePermission('canTriggerAdoSync'), handler);
 * 
 *   // Validate organization & project scoping:
 *   app.post('/api/ado/metadata', requireScope(), handler);
 */

export const ROLE_PERMISSIONS = {
  'Administrator': {
    canManageUsers: true,
    canManageSettings: true,
    canManageReleases: true,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: true,
    canApproveGating: true,
    isReadOnly: false,
    canProxyAdo: true
  },
  'Delivery/Release Manager': {
    canManageUsers: false,
    canManageSettings: false,
    canManageReleases: true,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: false,
    canApproveGating: true,
    isReadOnly: false,
    canProxyAdo: true
  },
  'Engineering Lead': {
    canManageUsers: false,
    canManageSettings: false,
    canManageReleases: false,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: false,
    canApproveGating: false,
    isReadOnly: false,
    canProxyAdo: true
  },
  'QA Engineer': {
    canManageUsers: false,
    canManageSettings: false,
    canManageReleases: false,
    canTriggerAdoSync: true,
    canEditWorkItems: true,
    canRunTests: true,
    canApproveGating: false,
    isReadOnly: false,
    canProxyAdo: true
  },
  'Engineer/Contributor': {
    canManageUsers: false,
    canManageSettings: false,
    canManageReleases: false,
    canTriggerAdoSync: false,
    canEditWorkItems: true,
    canRunTests: false,
    canApproveGating: false,
    isReadOnly: false,
    canProxyAdo: true
  },
  'Stakeholder/Viewer': {
    canManageUsers: false,
    canManageSettings: false,
    canManageReleases: false,
    canTriggerAdoSync: false,
    canEditWorkItems: false,
    canRunTests: false,
    canApproveGating: false,
    isReadOnly: true,
    canProxyAdo: true
  }
};

// Aliases mapping common variations or shorthand names to the canonical 6 roles
export const ROLE_ALIASES = {
  'admin': 'Administrator',
  'administrator': 'Administrator',
  'delivery manager': 'Delivery/Release Manager',
  'release manager': 'Delivery/Release Manager',
  'delivery/release manager': 'Delivery/Release Manager',
  'engineering lead': 'Engineering Lead',
  'eng lead': 'Engineering Lead',
  'tech lead': 'Engineering Lead',
  'qa': 'QA Engineer',
  'qa engineer': 'QA Engineer',
  'qa lead': 'QA Engineer',
  'tester': 'QA Engineer',
  'engineer': 'Engineer/Contributor',
  'contributor': 'Engineer/Contributor',
  'developer': 'Engineer/Contributor',
  'software engineer': 'Engineer/Contributor',
  'engineer/contributor': 'Engineer/Contributor',
  'stakeholder': 'Stakeholder/Viewer',
  'viewer': 'Stakeholder/Viewer',
  'stakeholder/viewer': 'Stakeholder/Viewer',
  'read-only': 'Stakeholder/Viewer',
  'readonly': 'Stakeholder/Viewer'
};

/**
 * Normalizes an arbitrary role name or alias to canonical form
 */
export function normalizeRoleName(role) {
  if (!role || typeof role !== 'string') return role;
  const key = role.trim().toLowerCase();
  return ROLE_ALIASES[key] || role;
}

/**
 * Validates organizational and project scoping against active auth context
 */
export function checkScopeAccess(auth, targetOrg, targetProject) {
  if (!auth) {
    return { allowed: false, reason: 'Unauthenticated session.' };
  }

  // Administrators and connection owners bypass scoping restrictions
  if (auth.role === 'Administrator' || auth.isAdoConnectionOwner) {
    return { allowed: true };
  }

  if (auth.orgScope && auth.orgScope !== '*' && targetOrg && auth.orgScope.toLowerCase() !== targetOrg.toLowerCase()) {
    return {
      allowed: false,
      reason: `Access denied: User role "${auth.role}" is scoped to organization "${auth.orgScope}" and cannot access "${targetOrg}".`
    };
  }

  if (auth.projectScope && auth.projectScope !== '*' && targetProject && auth.projectScope.toLowerCase() !== targetProject.toLowerCase()) {
    return {
      allowed: false,
      reason: `Access denied: User role "${auth.role}" is scoped to project "${auth.projectScope}" and cannot access "${targetProject}".`
    };
  }

  return { allowed: true };
}

/**
 * Shared Middleware: requireRole(allowedRoles)
 * 
 * Guarantees that the request's authenticated role matches one of the specified allowed roles.
 * Supports string, array of strings, and common aliases (e.g. 'Delivery Manager', 'admin').
 * 
 * @param {string|string[]} allowedRoles
 */
export function requireRole(allowedRoles) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = rolesArray.map(normalizeRoleName);

  return function (req, res, next) {
    const userRole = req.auth?.role;
    const isOwner = Boolean(req.auth?.isAdoConnectionOwner);

    // Connection owners or Administrators bypass role restrictions if Administrator is permitted
    if (isOwner && normalizedAllowed.includes('Administrator')) {
      return next();
    }

    if (userRole && normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      ok: false,
      error: `Access denied: Role "${userRole || 'Anonymous'}" is not authorized for this operation. Required role(s): ${rolesArray.join(', ')}.`,
      requiredRoles: rolesArray,
      currentRole: userRole || 'Anonymous',
      authSession: {
        userId: req.auth?.userId,
        role: userRole
      }
    });
  };
}

/**
 * Shared Middleware: requirePermission(permissionKey)
 * 
 * Guarantees that the requesting user has the specified functional capability enabled in the role matrix.
 * 
 * @param {string} permissionKey (e.g. 'canTriggerAdoSync', 'canEditWorkItems', 'canManageReleases')
 */
export function requirePermission(permissionKey) {
  return function (req, res, next) {
    const permissions = req.auth?.permissions || {};
    const userRole = req.auth?.role;
    const isOwner = Boolean(req.auth?.isAdoConnectionOwner);

    // Administrator or connection owner has superuser bypass
    if (userRole === 'Administrator' || isOwner || permissions[permissionKey] === true) {
      return next();
    }

    return res.status(403).json({
      ok: false,
      error: `Access denied: Role "${userRole || 'Anonymous'}" does not have permission "${permissionKey}".`,
      requiredPermission: permissionKey,
      currentRole: userRole || 'Anonymous',
      authSession: {
        userId: req.auth?.userId,
        role: userRole
      }
    });
  };
}

/**
 * Shared Middleware: requireAnyPermission(permissionKeys)
 * 
 * Permits access if the user has AT LEAST ONE of the specified permissions.
 * 
 * @param {string[]} permissionKeys
 */
export function requireAnyPermission(permissionKeys) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];

  return function (req, res, next) {
    const permissions = req.auth?.permissions || {};
    const userRole = req.auth?.role;
    const isOwner = Boolean(req.auth?.isAdoConnectionOwner);

    if (userRole === 'Administrator' || isOwner) {
      return next();
    }

    const hasAny = keys.some(key => permissions[key] === true);
    if (hasAny) {
      return next();
    }

    return res.status(403).json({
      ok: false,
      error: `Access denied: Role "${userRole || 'Anonymous'}" requires at least one of permissions: [${keys.join(', ')}].`,
      requiredPermissions: keys,
      currentRole: userRole || 'Anonymous',
      authSession: {
        userId: req.auth?.userId,
        role: userRole
      }
    });
  };
}

/**
 * Shared Middleware: requireAllPermissions(permissionKeys)
 * 
 * Permits access ONLY IF the user possesses ALL specified permissions.
 * 
 * @param {string[]} permissionKeys
 */
export function requireAllPermissions(permissionKeys) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];

  return function (req, res, next) {
    const permissions = req.auth?.permissions || {};
    const userRole = req.auth?.role;
    const isOwner = Boolean(req.auth?.isAdoConnectionOwner);

    if (userRole === 'Administrator' || isOwner) {
      return next();
    }

    const hasAll = keys.every(key => permissions[key] === true);
    if (hasAll) {
      return next();
    }

    return res.status(403).json({
      ok: false,
      error: `Access denied: Role "${userRole || 'Anonymous'}" requires all permissions: [${keys.join(', ')}].`,
      requiredPermissions: keys,
      currentRole: userRole || 'Anonymous',
      authSession: {
        userId: req.auth?.userId,
        role: userRole
      }
    });
  };
}

/**
 * Shared Middleware: requireScope(getOrgAndProject)
 * 
 * Validates that the targeted organization and project are within the user's allowed scope.
 * 
 * @param {Function} [getOrgAndProject] Optional callback (req) => ({ org, project })
 */
export function requireScope(getOrgAndProject) {
  return function (req, res, next) {
    let org = null;
    let project = null;

    if (typeof getOrgAndProject === 'function') {
      const extracted = getOrgAndProject(req);
      org = extracted?.org;
      project = extracted?.project;
    } else {
      org = req.body?.org || req.query?.org || req.params?.org || process.env.ADO_ORG || 'simetricwdh';
      project = req.body?.project || req.query?.project || req.params?.project || process.env.ADO_PROJECT || 'ACM';
    }

    const scopeCheck = checkScopeAccess(req.auth, org, project);
    if (!scopeCheck.allowed) {
      return res.status(403).json({
        ok: false,
        error: scopeCheck.reason,
        authSession: {
          userId: req.auth?.userId,
          role: req.auth?.role
        }
      });
    }

    next();
  };
}
