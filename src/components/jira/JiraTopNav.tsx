import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { AppTheme, DualAdoConfig } from '../../types';

interface JiraTopNavProps {
  onOpenCreateModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenAdoModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  theme?: AppTheme;
  onToggleTheme: () => void;
  dualAdoConfig?: DualAdoConfig;
  projectName?: string;
  projectKey?: string;
}

export const JiraTopNav: React.FC<JiraTopNavProps> = ({
  onOpenCreateModal,
  onOpenCommandPalette,
  onOpenAdoModal,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  dualAdoConfig,
  projectName = 'ACM Delivery',
  projectKey = 'ACM'
}) => {
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);

  const isDark = theme === 'obsidian_dark' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'obsidian_dark');

  return (
    <header className="h-13 bg-[var(--surface)] border-b border-[var(--border)] px-4 flex items-center justify-between gap-3 select-none sticky top-0 z-40 shadow-xs">
      {/* Left section: App Switcher + Jira Logo + Navigation dropdowns */}
      <div className="flex items-center gap-3">
        {/* Atlassian 9-dot App Switcher */}
        <button
          type="button"
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Atlassian Products Switcher"
        >
          <Grid size={18} />
        </button>

        {/* Jira Logo & Brand */}
        <div className="flex items-center gap-2 pr-2 border-r border-[var(--border)]">
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
          {/* Projects dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
              className="px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Projects</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>
          </div>

          <button
            type="button"
            className="px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Filters</span>
            <ChevronDown size={13} className="text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            className="px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Dashboards</span>
            <ChevronDown size={13} className="text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            className="px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Teams</span>
            <ChevronDown size={13} className="text-[var(--text-muted)]" />
          </button>

          {/* Big Blue + Create Button */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="ml-2 px-3 py-1 bg-[#0052CC] hover:bg-[#0747A6] text-white rounded font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <Plus size={14} />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Center / Right section: Search bar + Status badges + Actions */}
      <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
        {/* Global Jira Search Bar */}
        <div 
          onClick={onOpenCommandPalette}
          className="relative flex-1 max-w-xs hidden lg:flex items-center bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] border border-[var(--border)] rounded-md px-2.5 py-1 text-xs text-[var(--text-muted)] cursor-pointer transition-all"
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

        {/* Hasura GraphQL Badge */}
        <div 
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)]"
          title="Hasura GraphQL Engine connected to PostgreSQL (Docker)"
        >
          <Layers size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="font-mono">Hasura</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        </div>

        {/* Azure DevOps Hub */}
        <button
          type="button"
          onClick={onOpenAdoModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title="Azure DevOps Synchronization Hub"
        >
          <FolderGit2 size={13} className="text-[#0052CC]" />
          <span className="hidden xl:inline">ADO Sync</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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

        {/* Notification Bell */}
        <button
          type="button"
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer relative"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#0052CC]" />
        </button>

        {/* Settings */}
        <button
          type="button"
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Jira Settings"
        >
          <Settings size={16} />
        </button>

        {/* User Profile Avatar */}
        <div className="w-7 h-7 rounded-full bg-[#0052CC] text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-2xs ring-2 ring-[var(--surface)] ml-1">
          <span>AM</span>
        </div>
      </div>
    </header>
  );
};
