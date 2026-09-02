import React, { useState, useEffect, useRef } from 'react';
import { 
  Grid, 
  Search, 
  Plus, 
  Bell, 
  Settings, 
  HelpCircle, 
  Moon, 
  Sun, 
  FolderGit2, 
  Layers, 
  ChevronDown, 
  Sparkles,
  Command,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  BarChart3,
  Bookmark,
  Bug,
  CheckSquare,
  Rocket,
  Shield,
  Calendar,
  MessageSquareQuote,
  Award,
  Check,
  Mail,
  Server
} from 'lucide-react';
import { AppTheme, DualAdoConfig, AppView } from '../../types';

interface JiraTopNavProps {
  onNavigate: (view: AppView) => void;
  onOpenCreateModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenAdoModal: () => void;
  onOpenEmailModal: (template?: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  theme?: AppTheme;
  onToggleTheme: () => void;
  dualAdoConfig?: DualAdoConfig;
  projectName?: string;
  projectKey?: string;
}

export const JiraTopNav: React.FC<JiraTopNavProps> = ({
  onNavigate,
  onOpenCreateModal,
  onOpenCommandPalette,
  onOpenAdoModal,
  onOpenEmailModal,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  dualAdoConfig,
  projectName = 'ACM Delivery',
  projectKey = 'ACM'
}) => {
  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => (prev === name ? null : name));
  };

  const isDark = theme === 'obsidian_dark' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'obsidian_dark');

  return (
    <header ref={navRef} className="h-13 bg-[var(--surface)] border-b border-[var(--border)] px-4 flex items-center justify-between gap-3 select-none sticky top-0 z-40 shadow-xs font-sans">
      {/* Left section: App Switcher + Jira Logo + Navigation dropdowns */}
      <div className="flex items-center gap-2.5">
        {/* Atlassian 9-dot App Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleDropdown('switcher')}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              activeDropdown === 'switcher'
                ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
            }`}
            title="Atlassian Products & Tools"
          >
            <Grid size={18} />
          </button>

          {/* App Switcher Popover */}
          {activeDropdown === 'switcher' && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-2.5 z-50 text-xs flex flex-col gap-2 animate-scaleUp">
              <span className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Integrated Suite
              </span>

              <button
                type="button"
                onClick={() => {
                  onNavigate('jira_board');
                  setActiveDropdown(null);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-all text-left cursor-pointer font-semibold text-[var(--text-primary)]"
              >
                <div className="w-6 h-6 rounded bg-[#0052CC] text-white flex items-center justify-center font-bold text-xs">
                  J
                </div>
                <div>
                  <div className="font-bold">Jira Software</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Agile board & sprint planning</div>
                </div>
              </button>

              <a
                href="http://localhost:8080"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-all text-left font-semibold text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    <Layers size={13} />
                  </div>
                  <div>
                    <div className="font-bold">Hasura GraphQL Console</div>
                    <div className="text-[10px] text-[var(--text-muted)]">GraphQL Engine & metadata</div>
                  </div>
                </div>
                <ExternalLink size={12} className="text-[var(--text-muted)]" />
              </a>

              <button
                type="button"
                onClick={() => {
                  onOpenAdoModal();
                  setActiveDropdown(null);
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-all text-left cursor-pointer font-semibold text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    <FolderGit2 size={13} />
                  </div>
                  <div>
                    <div className="font-bold">Azure DevOps Hub</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Cloud work item sync</div>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </button>
            </div>
          )}
        </div>

        {/* Jira Logo & Brand */}
        <div 
          onClick={() => onNavigate('jira_board')}
          className="flex items-center gap-2 pr-2 border-r border-[var(--border)] cursor-pointer"
        >
          <div className="w-7 h-7 rounded bg-[#0052CC] flex items-center justify-center text-white shadow-2xs">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M11.53 2c0 2.4-1.97 4.35-4.4 4.35H2.8a.8.8 0 0 0-.8.8v4.33c0 2.4 1.97 4.35 4.4 4.35h4.33c2.4 0 4.35-1.97 4.35-4.4V2z" />
              <path d="M12.47 22c0-2.4 1.97-4.35 4.4-4.35h4.33a.8.8 0 0 0 .8-.8v-4.33c0-2.4-1.97-4.35-4.4-4.35h-4.33c-2.4 0-4.35 1.97-4.35 4.4V22z" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] font-sans hidden sm:inline">
            Jira <span className="font-medium text-xs text-[var(--text-muted)]">Software</span>
          </span>
        </div>

        {/* Dropdown menus */}
        <div className="hidden md:flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">
          {/* 1. Projects Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown('projects')}
              className={`px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer ${
                activeDropdown === 'projects' ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold' : ''
              }`}
            >
              <span>Projects</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>

            {activeDropdown === 'projects' && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-2.5 z-50 text-xs flex flex-col gap-1.5 animate-scaleUp">
                <span className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Current Project
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('jira_board');
                    setActiveDropdown(null);
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] font-bold text-left cursor-pointer"
                >
                  <span className="w-6 h-6 rounded bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {projectKey}
                  </span>
                  <div className="truncate">
                    <div className="truncate">{projectName}</div>
                    <div className="text-[10px] font-normal text-[var(--text-secondary)]">Software project &bull; {projectKey}</div>
                  </div>
                </button>

                <div className="h-px bg-[var(--border)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('settings');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-left cursor-pointer flex items-center gap-2"
                >
                  <Settings size={13} />
                  <span>Project Settings</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Filters Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown('filters')}
              className={`px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer ${
                activeDropdown === 'filters' ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold' : ''
              }`}
            >
              <span>Filters</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>

            {activeDropdown === 'filters' && (
              <div className="absolute left-0 top-full mt-2 w-60 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-2.5 z-50 text-xs flex flex-col gap-1 animate-scaleUp">
                <span className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Quick Filters
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('jira_board');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Bookmark size={14} className="text-emerald-600" />
                  <span>All Active Stories & Sprints</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('defects');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Bug size={14} className="text-rose-600" />
                  <span>Unresolved P0/P1 Defects</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('releases');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Rocket size={14} className="text-indigo-600" />
                  <span>Target Release Scope</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Dashboards Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown('dashboards')}
              className={`px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer ${
                activeDropdown === 'dashboards' ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold' : ''
              }`}
            >
              <span>Dashboards</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>

            {activeDropdown === 'dashboards' && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-2.5 z-50 text-xs flex flex-col gap-1 animate-scaleUp">
                <span className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Agile Dashboards
                </span>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('environments');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Server size={14} className="text-purple-600" />
                  <span>Environment Activity Hub</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('qa_dashboard');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <BarChart3 size={14} className="text-[#0052CC]" />
                  <span>QA Execution Analytics</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('jira_timeline');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Calendar size={14} className="text-purple-600" />
                  <span>Roadmap & Gantt Timeline</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('jira_backlog');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <CheckSquare size={14} className="text-emerald-600" />
                  <span>Sprint Velocity & Backlog</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Teams Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown('teams')}
              className={`px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer ${
                activeDropdown === 'teams' ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold' : ''
              }`}
            >
              <span>Teams</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>

            {activeDropdown === 'teams' && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-2.5 z-50 text-xs flex flex-col gap-1 animate-scaleUp">
                <span className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Team Collaboration
                </span>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('standup');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Users size={14} className="text-blue-600" />
                  <span>Daily Standup Room</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('people');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <Award size={14} className="text-amber-600" />
                  <span>People Review & Recognition</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('retrospective');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 text-[var(--text-primary)] font-semibold"
                >
                  <MessageSquareQuote size={14} className="text-emerald-600" />
                  <span>Sprint Retrospectives</span>
                </button>
              </div>
            )}
          </div>

          {/* Big Blue + Create Button */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="ml-2 px-3.5 py-1.5 bg-[#0052CC] hover:bg-[#0747A6] text-white rounded-md font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <Plus size={14} />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Center / Right section: Search bar + Status badges + Actions */}
      <div className="flex items-center gap-2 flex-1 max-w-xl justify-end">
        {/* Global Jira Search Bar */}
        <div 
          onClick={onOpenCommandPalette}
          className="relative flex-1 max-w-xs hidden lg:flex items-center bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-muted)] cursor-pointer transition-all"
        >
          <Search size={13} className="mr-2 text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search Jira..."
            className="bg-transparent text-xs text-[var(--text-primary)] outline-none w-full placeholder:text-[var(--text-muted)]"
            onClick={e => e.stopPropagation()}
          />
          <div className="flex items-center gap-0.5 px-1.5 py-0.2 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-mono text-[var(--text-muted)] shrink-0 ml-1">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>

        {/* Hasura GraphQL Badge Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleDropdown('hasura')}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] transition-all cursor-pointer"
            title="Hasura GraphQL Engine Status"
          >
            <Layers size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="font-mono">Hasura</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          </button>

          {activeDropdown === 'hasura' && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-3.5 z-50 text-xs flex flex-col gap-2.5 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                  <Layers size={15} className="text-purple-600" />
                  <span>Hasura GraphQL Engine</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                  Connected
                </span>
              </div>

              <div className="text-[11px] text-[var(--text-secondary)] space-y-1 font-mono">
                <div>Endpoint: <span className="font-bold text-[var(--text-primary)]">http://localhost:8080</span></div>
                <div>PostgreSQL: <span className="font-bold text-[var(--text-primary)]">acm_jira (Docker)</span></div>
                <div>Admin Secret: <span className="font-bold text-[var(--text-primary)]">adminsecretkey</span></div>
              </div>

              <a
                href="http://localhost:8080"
                target="_blank"
                rel="noreferrer"
                className="w-full py-1.5 rounded-lg bg-[#0052CC] text-white text-center font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#0747A6] transition-all"
              >
                <span>Open GraphQL Console</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Azure DevOps Hub */}
        <button
          type="button"
          onClick={onOpenAdoModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title="Azure DevOps Synchronization Hub"
        >
          <FolderGit2 size={13} className="text-[#0052CC]" />
          <span className="hidden xl:inline">ADO Sync</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </button>

        {/* Email Automation Hub & Executive Dispatcher */}
        <button
          type="button"
          onClick={() => onOpenEmailModal('client_qa_status')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title="Email Automation Hub — Client QA Status, Daily Standup & Delivery Blockers"
        >
          <Mail size={13} className="text-[#0052CC]" />
          <span className="hidden xl:inline">Email Hub</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Toggle Light / Dark Jira Theme"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleDropdown('notifications')}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer relative"
            title="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#0052CC]" />
          </button>

          {activeDropdown === 'notifications' && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 z-50 text-xs flex flex-col gap-2 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 font-bold text-[var(--text-primary)]">
                <span>Notifications</span>
                <span className="text-[10px] text-[#0052CC] cursor-pointer hover:underline">Mark all read</span>
              </div>

              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                <div className="p-2 rounded-xl bg-[var(--surface-hover)] flex flex-col gap-1">
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span className="text-rose-600">🔴 Critical Defect Reported</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-normal">10m ago</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">ACM-102: Modem handshake timeout on /v2/switch requires QA validation.</p>
                </div>

                <div className="p-2 rounded-xl bg-[var(--surface-hover)] flex flex-col gap-1">
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span className="text-[#0052CC]">⚡ ADO Synced Successfully</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-normal">1h ago</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">Comments and work items refreshed from Azure DevOps.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Settings button */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Jira Settings"
        >
          <Settings size={16} />
        </button>

        {/* User Profile Avatar Dropdown */}
        <div className="relative">
          <div 
            onClick={() => toggleDropdown('profile')}
            className="w-7 h-7 rounded-full bg-[#0052CC] text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-2xs ring-2 ring-[var(--surface)] ml-1"
            title="Alex Mercer (Lead QA)"
          >
            <span>AM</span>
          </div>

          {activeDropdown === 'profile' && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 z-50 text-xs flex flex-col gap-2.5 animate-scaleUp">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-2.5">
                <div className="w-9 h-9 rounded-full bg-[#0052CC] text-white font-bold text-sm flex items-center justify-center">
                  AM
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[var(--text-primary)] truncate">Alex Mercer</span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate">alex.m@careflow.io</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('people');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Award size={13} />
                  <span>Profile & Recognition</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('settings');
                    setActiveDropdown(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center gap-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={13} />
                  <span>Account Settings</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-left cursor-pointer flex items-center justify-between font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <span className="flex items-center gap-2">
                    {isDark ? <Sun size={13} /> : <Moon size={13} />}
                    <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{isDark ? 'Dark' : 'Light'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
