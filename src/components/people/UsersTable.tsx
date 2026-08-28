import React, { useState, useMemo } from 'react';
import { 
  AppUser, 
  UserRole, 
  USER_ROLES, 
  ROLE_CONFIGS, 
  DualAdoConfig, 
  AdoConfig 
} from '../../types';
import { 
  Shield, 
  UserCheck, 
  UserPlus, 
  Users,
  Search, 
  Filter, 
  Lock, 
  Globe, 
  FolderGit2, 
  Edit3, 
  Trash2, 
  Key, 
  Crown, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Layers,
  Sparkles,
  Info,
  RotateCcw,
  Download
} from 'lucide-react';
import { generateId } from '../../utils/date';
import { AVATAR_COLORS } from '../../utils/demoData';
import { adoService } from '../../services/adoService';
import { syncAdoUsersWithDeduplication } from '../../utils/userManagement';

interface UsersTableProps {
  users: AppUser[];
  currentUserId?: string;
  dualAdoConfig?: DualAdoConfig;
  adoConfig?: AdoConfig;
  onAddUser: (user: AppUser) => void;
  onUpdateUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  onSetCurrentUser: (userId: string) => void;
  onBatchAddUsers?: (newUsers: AppUser[]) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  currentUserId,
  dualAdoConfig,
  adoConfig,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSetCurrentUser,
  onBatchAddUsers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [adoSyncLoading, setAdoSyncLoading] = useState<boolean>(false);
  const [adoSyncResult, setAdoSyncResult] = useState<{
    addedCount: number;
    ignoredCount: number;
    addedUsers: AppUser[];
    ignoredUsers: string[];
  } | null>(null);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>(UserRole.StakeholderViewer);
  const [formOrgScope, setFormOrgScope] = useState('*');
  const [formProjectScope, setFormProjectScope] = useState('*');
  const [formActive, setFormActive] = useState(true);
  const [formIsAdoOwner, setFormIsAdoOwner] = useState(false);

  // Derive connected ADO targets for quick scoping suggestions
  const defaultOrg = dualAdoConfig?.internal?.organization || adoConfig?.organization || '';
  const defaultProject = dualAdoConfig?.internal?.project || adoConfig?.project || '';

  // Open create/edit modal
  const handleOpenModal = (user?: AppUser) => {
    if (user) {
      setEditingUser(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormRole(user.role);
      setFormOrgScope(user.orgScope || '*');
      setFormProjectScope(user.projectScope || '*');
      setFormActive(user.active !== false);
      setFormIsAdoOwner(!!user.isAdoConnectionOwner);
    } else {
      setEditingUser(null);
      setFormName('');
      setFormEmail('');
      setFormRole(UserRole.StakeholderViewer); // default new users to Viewer so nobody is left without access
      setFormOrgScope(defaultOrg || '*');
      setFormProjectScope(defaultProject || '*');
      setFormActive(true);
      setFormIsAdoOwner(false);
    }
    setModalOpen(true);
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        orgScope: formOrgScope.trim() || '*',
        projectScope: formProjectScope.trim() || '*',
        active: formActive,
        isAdoConnectionOwner: formIsAdoOwner,
        updatedAt: new Date().toISOString()
      });
    } else {
      const newUser: AppUser = {
        id: generateId('usr'),
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        orgScope: formOrgScope.trim() || '*',
        projectScope: formProjectScope.trim() || '*',
        avatarColor: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
        active: formActive,
        isAdoConnectionOwner: formIsAdoOwner,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onAddUser(newUser);
    }
    setModalOpen(false);
  };

  // Quick inline role change
  const handleQuickRoleChange = (user: AppUser, newRole: UserRole) => {
    onUpdateUser({
      ...user,
      role: newRole,
      updatedAt: new Date().toISOString()
    });
  };

  // Fetch Original Name and User Email from ADO
  // Rule: If user already exists, ignore adding. New user only add it.
  const handleFetchAdoUsers = async () => {
    setAdoSyncLoading(true);
    setAdoSyncResult(null);

    try {
      const activePat = dualAdoConfig?.internal?.pat || adoConfig?.pat;
      const res = await adoService.fetchAdoTeamUsers({
        org: defaultOrg,
        project: defaultProject,
        pat: activePat
      });

      if (res.ok && Array.isArray(res.users)) {
        const syncRes = syncAdoUsersWithDeduplication({
          adoUsers: res.users,
          existingUsers: users,
          existingTeam: [],
          orgScope: defaultOrg,
          projectScope: defaultProject
        });

        // Add only the new users
        if (syncRes.addedUsers.length > 0) {
          if (onBatchAddUsers) {
            onBatchAddUsers(syncRes.addedUsers);
          } else {
            syncRes.addedUsers.forEach(u => onAddUser(u));
          }
        }

        setAdoSyncResult({
          addedCount: syncRes.addedCount,
          ignoredCount: syncRes.ignoredCount,
          addedUsers: syncRes.addedUsers,
          ignoredUsers: syncRes.ignoredUsers
        });
      } else {
        alert(res.error || 'Failed to fetch team users from Azure DevOps. Check connection settings.');
      }
    } catch (err: any) {
      alert(`Error fetching ADO users: ${err.message}`);
    } finally {
      setAdoSyncLoading(false);
    }
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesRole = u.role.toLowerCase().includes(q);
        const matchesOrg = (u.orgScope || '').toLowerCase().includes(q);
        const matchesProj = (u.projectScope || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesRole && !matchesOrg && !matchesProj) return false;
      }

      // Role Filter
      if (roleFilter !== 'all' && u.role !== roleFilter) {
        return false;
      }

      // Scope Filter
      if (scopeFilter !== 'all') {
        if (scopeFilter === 'global' && (u.orgScope !== '*' || u.projectScope !== '*')) return false;
        if (scopeFilter === 'project_scoped' && (u.orgScope === '*' && u.projectScope === '*')) return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, scopeFilter]);

  // Metrics
  const adminCount = users.filter(u => u.role === UserRole.Administrator).length;
  const viewerCount = users.filter(u => u.role === UserRole.StakeholderViewer).length;
  const activeCount = users.filter(u => u.active !== false).length;
  const connectionOwner = users.find(u => u.isAdoConnectionOwner) || users.find(u => u.role === UserRole.Administrator);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Users</div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">{users.length}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{activeCount} active in system</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Administrators</div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{adminCount}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Full governance rights</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
            <Crown className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Stakeholder / Viewers</div>
            <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">{viewerCount}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Read-only non-blocked access</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">ADO Connection Owner</div>
            <div className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate max-w-[150px]">
              {connectionOwner ? connectionOwner.name : 'Not configured'}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Auto-assigned Administrator
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Scope & Role Policy Clarification Bar */}
      <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[12px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-bold">Role & Scope Governance:</span> Every user is guaranteed a predictable role from the 6 fixed security archetypes. The ADO connection owner is automatically assigned <span className="font-bold text-rose-700 dark:text-rose-300">Administrator</span>, while newly imported members receive <span className="font-bold text-slate-700 dark:text-slate-300">Stakeholder/Viewer</span> by default so access is never locked out. Org and Project scopes allow fine-grained multi-project partitioning.
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, role, or scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="all">All Roles ({users.length})</option>
              {USER_ROLES.map(r => (
                <option key={r} value={r}>
                  {r} ({users.filter(u => u.role === r).length})
                </option>
              ))}
            </select>
          </div>

          {/* Scope Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl text-xs">
            <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">Scope:</span>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="all">All Scopes</option>
              <option value="global">Global (*)</option>
              <option value="project_scoped">Project-Scoped</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-fetch-ado-users"
            onClick={handleFetchAdoUsers}
            disabled={adoSyncLoading}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Fetch Original name & Email from ADO. If user already exists, ignore adding. New user only add it."
          >
            {adoSyncLoading ? (
              <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Download className="w-4 h-4 text-blue-600" />
            )}
            <span>{adoSyncLoading ? 'Fetching ADO Users...' : 'Fetch Users from ADO'}</span>
          </button>

          {/* Add User Button */}
          <button
            onClick={() => handleOpenModal()}
            className="px-3.5 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* ADO User Sync Result Banner */}
      {adoSyncResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">ADO User Sync Completed</div>
              <div className="mt-1">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{adoSyncResult.addedCount} new users added</span>
                {' • '}
                <span className="text-slate-600 dark:text-slate-400">{adoSyncResult.ignoredCount} existing users skipped (ignored adding)</span>
              </div>
              {adoSyncResult.addedUsers.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[11px] font-semibold">New Users:</span>
                  {adoSyncResult.addedUsers.map(u => (
                    <span key={u.id} className="px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 text-[11px] font-medium">
                      {u.name} ({u.email})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setAdoSyncResult(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Assigned Fixed Role</th>
                <th className="py-3 px-4">ADO Org Scope</th>
                <th className="py-3 px-4">ADO Project Scope</th>
                <th className="py-3 px-4">Core Permissions</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">No users matching your filters.</p>
                    <p className="text-[11px] mt-0.5">Try resetting search query or role filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleConfig = ROLE_CONFIGS[user.role] || ROLE_CONFIGS[UserRole.StakeholderViewer];
                  const isCurrent = user.id === currentUserId;

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-[var(--bg-subtle)]/60 transition-colors ${
                        isCurrent ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* User identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm shrink-0 relative"
                            style={{ backgroundColor: user.avatarColor || '#4F46E5' }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                            {user.isAdoConnectionOwner && (
                              <span 
                                title="ADO Connection Owner" 
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center shadow-sm"
                              >
                                <Crown className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                                  You (Active Session)
                                </span>
                              )}
                              {user.isAdoConnectionOwner && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  ADO Owner
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)] font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Fixed Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: roleConfig.badgeColor }} 
                          />
                          <select
                            value={user.role}
                            onChange={(e) => handleQuickRoleChange(user, e.target.value as UserRole)}
                            className="text-xs font-bold px-2.5 py-1 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg outline-none cursor-pointer hover:border-[var(--primary)]"
                          >
                            {USER_ROLES.map(r => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Org Scope */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-mono text-[11px] border border-[var(--border)]">
                          <Globe className="w-3 h-3 text-[var(--text-muted)]" />
                          {user.orgScope === '*' ? 'Global (*)' : user.orgScope || '*'}
                        </span>
                      </td>

                      {/* Project Scope */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-mono text-[11px] border border-[var(--border)]">
                          <FolderGit2 className="w-3 h-3 text-[var(--text-muted)]" />
                          {user.projectScope === '*' ? 'All Projects (*)' : user.projectScope || '*'}
                        </span>
                      </td>

                      {/* Core Permissions Preview */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {roleConfig.isReadOnly ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Read-Only
                            </span>
                          ) : (
                            <>
                              {roleConfig.canManageSettings && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Settings
                                </span>
                              )}
                              {roleConfig.canManageReleases && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  Releases
                                </span>
                              )}
                              {roleConfig.canTriggerAdoSync && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  ADO Sync
                                </span>
                              )}
                              {roleConfig.canRunTests && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  QA & Tests
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {user.active !== false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCurrent && (
                            <button
                              onClick={() => onSetCurrentUser(user.id)}
                              title="Switch active session to this user to test permissions"
                              className="px-2 py-1 bg-[var(--bg-subtle)] hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-[10.5px] font-bold border border-[var(--border)] transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Key className="w-3 h-3" />
                              <span>Switch</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenModal(user)}
                            title="Edit User & Permissions"
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove ${user.name}?`)) {
                                onDeleteUser(user.id);
                              }
                            }}
                            title="Delete User"
                            disabled={user.isAdoConnectionOwner}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-subtle)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {editingUser ? 'Edit User & Scoped Role' : 'Add New User'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Configure fixed role permissions and ADO project boundaries.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Johnson"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex.j@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Assigned Fixed Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full text-xs font-bold px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none cursor-pointer focus:border-[var(--primary)]"
                >
                  {USER_ROLES.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {ROLE_CONFIGS[formRole] && (
                  <div className="mt-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                      <span 
                        className="w-2 h-2 rounded-full inline-block" 
                        style={{ backgroundColor: ROLE_CONFIGS[formRole]?.badgeColor }} 
                      />
                      <span>{ROLE_CONFIGS[formRole]?.label}</span>
                      {ROLE_CONFIGS[formRole]?.isReadOnly && (
                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)]">
                          Read-Only Access
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)] text-[10.5px] leading-relaxed">
                      {ROLE_CONFIGS[formRole]?.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    ADO Organization Scope
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. simetricwdh or *"
                    value={formOrgScope}
                    onChange={(e) => setFormOrgScope(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)]"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Use '*' for all orgs</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    ADO Project Scope
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ACM or *"
                    value={formProjectScope}
                    onChange={(e) => setFormProjectScope(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)]"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Use '*' for all projects</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[var(--border)]">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded text-[var(--primary)]"
                  />
                  <span>Active User Account</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3.5 py-1.5 border border-[var(--border)] text-xs font-semibold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-all cursor-pointer"
                  >
                    {editingUser ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
