import React, { useState } from 'react';
import { 
  AppView, 
  Release, 
  Task, 
  UserStory, 
  TestCase,
  Defect 
} from '../../types';
import { 
  CheckSquare, 
  BookOpen, 
  FileCheck2,
  Bug, 
  BarChart3, 
  Rocket, 
  Users, 
  Award, 
  Clock, 
  RefreshCw, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Globe2,
  MessageSquareQuote
} from 'lucide-react';

interface SidebarProps {
  appName?: string;
  projectCode?: string;
  activeView: AppView;
  onNavigate?: (view: AppView) => void;
  setActiveView?: (view: AppView) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  releases?: Release[];
  selectedReleaseId?: string | null;
  setSelectedReleaseId?: (id: string | null) => void;
  tasks?: Task[];
  userStories?: UserStory[];
  testCases?: TestCase[];
  defects?: Defect[];
  dateStr?: string;
  pendingTasksCount?: number;
  activeStoriesCount?: number;
  testCasesCount?: number;
  openDefectsCount?: number;
  standupCount?: number;
  onOpenAdoModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  appName = 'ACM (AT&T Connection Manager) Delivery',
  projectCode = 'ACM',
  activeView,
  onNavigate,
  setActiveView,
  collapsed: propCollapsed,
  setCollapsed: propSetCollapsed,
  pendingTasksCount = 0,
  activeStoriesCount = 0,
  testCasesCount = 0,
  openDefectsCount = 0,
  standupCount = 0,
  onOpenAdoModal
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;
  const toggleCollapsed = () => {
    if (propSetCollapsed) propSetCollapsed(!isCollapsed);
    else setInternalCollapsed(!internalCollapsed);
  };

  const handleNav = (view: AppView) => {
    if (onNavigate) onNavigate(view);
    if (setActiveView) setActiveView(view);
  };

  const brandInitial = projectCode ? projectCode[0].toUpperCase() : (appName ? appName[0].toUpperCase() : 'A');

  const navItems = [
    {
      id: 'board' as AppView,
      label: 'Daily Board',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? String(pendingTasksCount) : null,
      badgeType: 'neutral'
    },
    {
      id: 'stories' as AppView,
      label: 'User Stories',
      icon: BookOpen,
      badge: activeStoriesCount > 0 ? String(activeStoriesCount) : null,
      badgeType: 'neutral'
    },
    {
      id: 'testCases' as AppView,
      label: 'Test Cases',
      icon: FileCheck2,
      badge: testCasesCount > 0 ? String(testCasesCount) : null,
      badgeType: 'neutral'
    },
    {
      id: 'defects' as AppView,
      label: 'Defects & QA',
      icon: Bug,
      badge: openDefectsCount > 0 ? String(openDefectsCount) : null,
      badgeType: 'critical'
    },
    {
      id: 'qa_dashboard' as AppView,
      label: 'QA Analytics',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'releases' as AppView,
      label: 'Releases & Scope',
      icon: Rocket,
      badge: null
    },
    {
      id: 'standup' as AppView,
      label: 'Standup Room',
      icon: Users,
      badge: standupCount > 0 ? `${standupCount}` : 'Live',
      badgeType: 'accent'
    },
    {
      id: 'retrospective' as AppView,
      label: 'Retrospective Board',
      icon: MessageSquareQuote,
      badge: null
    },
    {
      id: 'people' as AppView,
      label: 'Peoples, People, Performance',
      icon: Award,
      badge: null
    },
    {
      id: 'blueprint' as AppView,
      label: 'Daily Blueprint',
      icon: Clock,
      badge: null
    },
    {
      id: 'settings' as AppView,
      label: 'Settings & Themes',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside 
      className={`bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col justify-between transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-[72px]' : 'w-[250px]'
      } h-screen sticky top-0 overflow-hidden`}
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0 uppercase">
              {brandInitial}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[14px] text-[var(--text-primary)] tracking-tight truncate leading-tight" title={appName}>
                  {appName}
                </span>
                <span className="text-[10.5px] text-[var(--text-muted)] truncate font-medium">
                  Azure DevOps Connected
                </span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer flex-shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
          {!isCollapsed && (
            <span className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase px-3 py-1 mt-1 flex-shrink-0">
              Delivery Modules
            </span>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id || 
              (item.id === 'stories' && activeView === 'userStories') ||
              (item.id === 'qa_dashboard' && activeView === 'defectsDashboard') ||
              (item.id === 'people' && activeView === 'peopleReview');

            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-xs font-bold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  size={17}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none flex-shrink-0 ${
                      item.badgeType === 'critical'
                        ? 'bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical-border)]'
                        : item.badgeType === 'accent'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Azure DevOps Integration shortcut */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] flex-shrink-0">
        {onOpenAdoModal && !isCollapsed && (
          <button
            onClick={onOpenAdoModal}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw size={13} className="text-[var(--primary)] flex-shrink-0" />
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs leading-tight truncate">Azure DevOps Sync</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal truncate">REST API & WIQL</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                LIVE
              </span>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};

