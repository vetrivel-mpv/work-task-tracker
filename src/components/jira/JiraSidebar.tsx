import React from 'react';
import { 
  Layers, 
  CheckSquare, 
  Calendar, 
  Rocket, 
  Bug, 
  BarChart3, 
  Users, 
  MessageSquareQuote, 
  Award, 
  Settings, 
  FolderGit2, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Mail,
  Flame
} from 'lucide-react';
import { AppView } from '../../types';

interface JiraSidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenEmailModal?: (template?: string) => void;
  onOpenTechDebtModal?: () => void;
  projectName?: string;
  projectKey?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  counts?: {
    issues?: number;
    defects?: number;
    releases?: number;
    team?: number;
  };
}

export const JiraSidebar: React.FC<JiraSidebarProps> = ({
  activeView,
  onNavigate,
  onOpenEmailModal,
  onOpenTechDebtModal,
  projectName = 'ACM Delivery',
  projectKey = 'ACM',
  isCollapsed,
  onToggleCollapse,
  counts
}) => {
  const planningItems: { id: AppView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'jira_board', label: 'Board', icon: Layers },
    { id: 'jira_backlog', label: 'Backlog', icon: CheckSquare },
    { id: 'jira_timeline', label: 'Timeline', icon: Calendar },
    { id: 'releases', label: 'Releases', icon: Rocket }
  ];

  const qualityItems: { id: AppView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'defects', label: 'Defects & QA', icon: Bug },
    { id: 'qa_dashboard', label: 'QA Analytics', icon: BarChart3 },
    { id: 'standup', label: 'Standup Room', icon: Users },
    { id: 'retrospective', label: 'Retrospectives', icon: MessageSquareQuote },
    { id: 'people', label: 'People Review', icon: Award }
  ];

  const settingsItems: { id: AppView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'blueprint', label: 'Schedule Blueprint', icon: Clock },
    { id: 'settings', label: 'Project Settings', icon: Settings }
  ];

  return (
    <aside
      className={`bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-all duration-200 select-none relative z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Project Header Widget */}
      <div className="p-3.5 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#0052CC] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
          {projectKey}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs text-[var(--text-primary)] truncate font-sans">
              {projectName}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] truncate">
              Software project
            </span>
          </div>
        )}
      </div>

      {/* Nav Items List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-4">
        {/* Section 1: PLANNING */}
        <div className="flex flex-col gap-0.5">
          {!isCollapsed && (
            <span className="px-3 py-1 text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
              Planning
            </span>
          )}
          {planningItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={16} className={`shrink-0 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Section 2: QUALITY & TRACKING */}
        <div className="flex flex-col gap-0.5">
          {!isCollapsed && (
            <span className="px-3 py-1 text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
              Quality & Tracking
            </span>
          )}
          {qualityItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id ||
              (item.id === 'qa_dashboard' && activeView === 'defectsDashboard') ||
              (item.id === 'people' && activeView === 'peopleReview');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={16} className={`shrink-0 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Section 3: EXECUTIVE & EMAIL DISPATCH */}
        {onOpenEmailModal && (
          <div className="flex flex-col gap-0.5">
            {!isCollapsed && (
              <span className="px-3 py-1 text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
                Email & Reports
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenEmailModal('client_qa_status')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer group"
              title={isCollapsed ? 'Client QA Status & Delivery Blockers Email' : undefined}
            >
              <Mail size={16} className="shrink-0 text-[#0052CC] group-hover:scale-110 transition-transform" />
              {!isCollapsed && <span className="truncate">Email Dispatch Hub</span>}
            </button>

            {onOpenTechDebtModal && (
              <button
                type="button"
                onClick={onOpenTechDebtModal}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer group"
                title={isCollapsed ? 'Technical Debt & Impact Matrix' : undefined}
              >
                <Flame size={16} className="shrink-0 text-rose-500 group-hover:scale-110 transition-transform" />
                {!isCollapsed && <span className="truncate">Tech Debt Matrix</span>}
              </button>
            )}
          </div>
        )}

        {/* Section 4: OPERATIONS & SETTINGS */}
        <div className="flex flex-col gap-0.5">
          {!isCollapsed && (
            <span className="px-3 py-1 text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
              Configuration
            </span>
          )}
          {settingsItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={16} className={`shrink-0 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapse Toggle Tab Button at Sidebar Edge */}
      <div className="p-2 border-t border-[var(--border)] flex justify-end">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
