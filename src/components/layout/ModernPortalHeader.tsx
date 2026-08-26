import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Settings, 
  Search, 
  Plus, 
  Mail, 
  FolderGit2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Command, 
  Moon, 
  Sun, 
  RefreshCw, 
  Activity,
  Layers,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  MessageSquareQuote,
  Zap,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  RotateCcw,
  Check,
  Grid,
  GripVertical,
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import { AppView, Release, DualAdoConfig, AppState, AppTheme, UserRole, ROLE_CONFIGS } from '../../types';
import { toDateStr, shiftDate, formatDisplayDate, isToday } from '../../utils/date';
import { parseAdoTarget, formatReleaseDisplayName } from '../../utils/adoPaths';

interface ModernPortalHeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  currentDateStr: string;
  onDateChange: (date: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  releases: Release[];
  selectedReleaseId: string | null;
  onSelectRelease: (id: string | null) => void;
  onOpenNewTaskModal: () => void;
  onOpenAdoModal: () => void;
  onOpenEmailModal: (tab?: 'standup' | 'qa' | 'dashboard') => void;
  onOpenCommandPalette: () => void;
  onOpenTechDebtModal?: () => void;
  dualAdoConfig?: DualAdoConfig;
  state: AppState;
  onUpdateTheme?: (theme: AppTheme) => void;
}

export const ModernPortalHeader: React.FC<ModernPortalHeaderProps> = ({
  activeView,
  onNavigate,
  currentDateStr,
  onDateChange,
  searchQuery,
  onSearchChange,
  releases = [],
  selectedReleaseId,
  onSelectRelease,
  onOpenNewTaskModal,
  onOpenAdoModal,
  onOpenEmailModal,
  onOpenCommandPalette,
  onOpenTechDebtModal,
  dualAdoConfig,
  state,
  onUpdateTheme
}) => {
  const isCurrentToday = isToday(currentDateStr);
  const primaryAdo = dualAdoConfig?.internal;
  const adoTarget = parseAdoTarget(primaryAdo?.organization, primaryAdo?.project);

  const appName = state.settings?.appName || 'ACM (AT&T Connection Manager) Delivery';
  const projectCode = state.settings?.projectCode || (appName.includes('ACM') ? 'ACM' : 'DELIVERY');
  const projectSubtitle = state.settings?.projectSubtitle || 'AT&T Connection Manager Delivery Hub';
  const brandInitial = projectCode ? projectCode[0].toUpperCase() : (appName ? appName[0].toUpperCase() : 'A');

  // Compute live counter metrics
  const pendingTasksCount = (state.tasks || []).filter(
    t => t.dateStr === currentDateStr && t.status !== 'complete'
  ).length;

  const activeStoriesCount = (state.userStories || []).filter(
    s => s.status !== 'Done' && s.status !== 'QA Passed'
  ).length;

  const testCasesCount = (state.testCases || []).length;

  const openDefectsCount = (state.defects || []).filter(
    d => d.status !== 'Closed'
  ).length;

  const criticalDefectsCount = (state.defects || []).filter(
    d => d.status !== 'Closed' && (d.severity === 'critical' || d.severity === 'high')
  ).length;

  const standupCount = Object.keys(state.standup || {}).length;
  const teamCount = (state.team || []).length;

  // Default canonical tab sequence
  const DEFAULT_TAB_ORDER: AppView[] = [
    'board',
    'stories',
    // 'testCases', // Commented out per user request
    'defects',
    'qa_dashboard',
    'apiAutomation',
    'releases',
    'standup',
    'retrospective',
    'people',
    'blueprint',
    'settings'
  ];

  const TAB_ORDER_STORAGE_KEY = 'acm_portal_nav_tab_order_v2';

  // State for customized tab ordering
  const [tabOrder, setTabOrder] = useState<AppView[]>(() => {
    try {
      const saved = localStorage.getItem(TAB_ORDER_STORAGE_KEY);
      if (saved) {
        const parsed: AppView[] = JSON.parse(saved);
        const valid = parsed.filter(id => DEFAULT_TAB_ORDER.includes(id));
        const missing = DEFAULT_TAB_ORDER.filter(id => !valid.includes(id));
        if (valid.length > 0) {
          return [...valid, ...missing];
        }
      }
    } catch (e) {
      console.error('Error parsing stored tab order', e);
    }
    return DEFAULT_TAB_ORDER;
  });

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showAllTabsDropdown, setShowAllTabsDropdown] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<AppView | null>(null);

  // Move tab Left / Right handler
  const handleMoveTab = useCallback((tabId: AppView, direction: 'left' | 'right', e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setTabOrder(prev => {
      const index = prev.indexOf(tabId);
      if (index === -1) return prev;
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      try {
        localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to persist tab order', err);
      }
      return next;
    });
  }, []);

  const handleResetTabOrder = () => {
    setTabOrder(DEFAULT_TAB_ORDER);
    try {
      localStorage.removeItem(TAB_ORDER_STORAGE_KEY);
    } catch (e) {}
  };

  // Drag & Drop reordering
  const handleDragStart = (tabId: AppView, e: React.DragEvent) => {
    setDraggedTabId(tabId);
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetTabId: AppView, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      return;
    }
    setTabOrder(prev => {
      const fromIdx = prev.indexOf(draggedTabId);
      const toIdx = prev.indexOf(targetTabId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      try {
        localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {}
      return next;
    });
    setDraggedTabId(null);
  };

  // Horizontal ribbon scroll tracking & controls
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollBounds = useCallback(() => {
    if (!navRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScrollBounds();
    el.addEventListener('scroll', checkScrollBounds, { passive: true });
    window.addEventListener('resize', checkScrollBounds);
    return () => {
      el.removeEventListener('scroll', checkScrollBounds);
      window.removeEventListener('resize', checkScrollBounds);
    };
  }, [checkScrollBounds, tabOrder]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!navRef.current) return;
    const offset = direction === 'left' ? -280 : 280;
    navRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Mouse wheel horizontal translation
  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (!navRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      navRef.current.scrollLeft += e.deltaY;
      checkScrollBounds();
    }
  };

  // Drag-to-scroll
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isReorderMode) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - (navRef.current?.offsetLeft || 0);
    scrollLeftStartRef.current = navRef.current?.scrollLeft || 0;
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !navRef.current || isReorderMode) return;
    e.preventDefault();
    const x = e.pageX - (navRef.current.offsetLeft || 0);
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 5) {
      hasDraggedRef.current = true;
    }
    navRef.current.scrollLeft = scrollLeftStartRef.current - walk;
    checkScrollBounds();
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeView]);

  // Modern navigation tabs dictionary
  const navTabsMap: Record<string, {
    id: AppView;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge: string | null;
    badgeType: 'critical' | 'accent' | 'neutral';
    group: string;
  }> = {
    board: {
      id: 'board' as AppView,
      label: 'Daily Board',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? String(pendingTasksCount) : null,
      badgeType: 'neutral',
      group: 'delivery'
    },
    stories: {
      id: 'stories' as AppView,
      label: 'User Stories',
      icon: BookOpen,
      badge: activeStoriesCount > 0 ? String(activeStoriesCount) : null,
      badgeType: 'neutral',
      group: 'delivery'
    },
    /* testCases: {
      id: 'testCases' as AppView,
      label: 'Test Cases',
      icon: FileCheck2,
      badge: testCasesCount > 0 ? String(testCasesCount) : null,
      badgeType: 'neutral',
      group: 'quality'
    }, */
    defects: {
      id: 'defects' as AppView,
      label: 'Defects & QA',
      icon: Bug,
      badge: openDefectsCount > 0 ? String(openDefectsCount) : null,
      badgeType: criticalDefectsCount > 0 ? 'critical' : 'neutral',
      group: 'quality'
    },
    qa_dashboard: {
      id: 'qa_dashboard' as AppView,
      label: 'QA Analytics',
      icon: BarChart3,
      badge: null,
      badgeType: 'neutral',
      group: 'quality'
    },
    apiAutomation: {
      id: 'apiAutomation' as AppView,
      label: 'API Automation',
      icon: Zap,
      badge: (state.apiCollections || []).length > 0 ? String((state.apiCollections || []).length) : 'New',
      badgeType: 'accent',
      group: 'quality'
    },
    releases: {
      id: 'releases' as AppView,
      label: 'Releases',
      icon: Rocket,
      badge: releases.length > 0 ? String(releases.length) : null,
      badgeType: 'neutral',
      group: 'planning'
    },
    standup: {
      id: 'standup' as AppView,
      label: 'Standup Room',
      icon: Users,
      badge: standupCount > 0 ? `${standupCount}` : 'Live',
      badgeType: 'accent',
      group: 'collaboration'
    },
    retrospective: {
      id: 'retrospective' as AppView,
      label: 'Retrospective',
      icon: MessageSquareQuote,
      badge: (state.retroItems || []).length > 0 ? String((state.retroItems || []).length) : null,
      badgeType: 'neutral',
      group: 'collaboration'
    },
    people: {
      id: 'people' as AppView,
      label: 'People Review',
      icon: Award,
      badge: teamCount > 0 ? String(teamCount) : null,
      badgeType: 'neutral',
      group: 'collaboration'
    },
    blueprint: {
      id: 'blueprint' as AppView,
      label: 'Blueprint',
      icon: Clock,
      badge: null,
      badgeType: 'neutral',
      group: 'planning'
    },
    settings: {
      id: 'settings' as AppView,
      label: 'Settings',
      icon: Settings,
      badge: null,
      badgeType: 'neutral',
      group: 'admin'
    }
  };

  const orderedTabs = tabOrder
    .map(id => navTabsMap[id])
    .filter(Boolean);

  // Theme switcher helper
  const currentTheme = state.settings?.theme || 'executive_slate';
  const handleToggleTheme = () => {
    if (!onUpdateTheme) return;
    const nextTheme: AppTheme = 
      currentTheme === 'executive_slate' ? 'obsidian_dark' :
      currentTheme === 'obsidian_dark' ? 'steel_minimal' :
      currentTheme === 'steel_minimal' ? 'crimson_ops' : 'executive_slate';
    onUpdateTheme(nextTheme);
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] shadow-xs transition-colors">
      {/* Top Deck: Brand, Global Telemetry, Omnibar & Action Center */}
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div 
            onClick={() => onNavigate('board')}
            className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-[var(--primary)]/20 transition-transform group-hover:scale-105 uppercase">
              {brandInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-[var(--text-primary)] leading-tight truncate max-w-[280px]" title={appName}>
                  {appName}
                </span>
                <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                  {projectCode}
                </span>
              </div>
              <span className="text-[10.5px] text-[var(--text-muted)] font-medium leading-none hidden sm:block truncate max-w-[280px]" title={projectSubtitle}>
                {projectSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Command Omnibar (Click or ⌘K triggers Command Palette) */}
        <div className="flex-1 max-w-md min-w-[200px] order-3 sm:order-2">
          <div 
            onClick={onOpenCommandPalette}
            className="relative flex items-center justify-between w-full bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl px-3 py-1.5 cursor-pointer transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search size={13} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors shrink-0" />
              <span className="text-xs text-[var(--text-muted)] truncate font-medium">
                {searchQuery ? `Filtering: "${searchQuery}"` : 'Quick search or jump to...'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded shadow-2xs font-mono">
                <Command size={10} /> K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right Deck: Date Navigation, Release Filter & Action Center */}
        <div className="flex items-center gap-2 order-2 sm:order-3 shrink-0 flex-wrap">
          
          {/* Date Segmented Control */}
          <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-0.5 shadow-2xs">
            <button
              onClick={() => onDateChange(shiftDate(currentDateStr, -1))}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft size={13} />
            </button>
            
            <button
              onClick={() => onDateChange(toDateStr(new Date()))}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                isCurrentToday
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => onDateChange(shiftDate(currentDateStr, 1))}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Date Picker Pill */}
          <div className="relative flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] px-2.5 py-1 rounded-xl text-xs font-bold text-[var(--text-primary)] shrink-0 cursor-pointer hover:bg-[var(--surface-hover)]">
            <CalendarIcon size={12} className="text-[var(--primary)]" />
            <span className="text-[11px] whitespace-nowrap">{formatDisplayDate(currentDateStr)}</span>
            <input
              aria-label="Select Target Date"
              type="date"
              value={currentDateStr}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </div>

          {/* Universal Release / Iteration Filter (Applies to all tabs) */}
          {releases.length > 0 && (
            <div 
              id="header-universal-release-filter"
              className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1 text-xs font-semibold shrink-0 transition-all ${
                selectedReleaseId
                  ? 'bg-[var(--primary-light)]/40 border-[var(--primary)]/50 text-[var(--primary)] shadow-2xs'
                  : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
              title="Universal Release & Iteration Filter — Applies across all tabs"
            >
              <Rocket size={12} className={selectedReleaseId ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} />
              <select
                id="header-release-selector"
                value={selectedReleaseId || ''}
                onChange={(e) => onSelectRelease(e.target.value || null)}
                className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] outline-none max-w-[140px] sm:max-w-[180px] truncate cursor-pointer"
              >
                <option value="">All Releases / Sprints</option>
                {releases.map(r => (
                  <option key={r.id} value={r.id}>
                    {formatReleaseDisplayName(r.name, r.releaseNumber)} {r.iterationPath ? `• ${r.iterationPath}` : ''}
                  </option>
                ))}
              </select>
              {selectedReleaseId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRelease(null);
                  }}
                  className="hover:opacity-75 cursor-pointer text-[var(--primary)] p-0.5 rounded-md ml-0.5 transition-opacity"
                  title="Clear release filter (show all releases)"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Azure DevOps Synchronization Hub (Single Canonical Location) */}
          <button
            onClick={onOpenAdoModal}
            id="header-ado-sync-hub-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 rounded-xl transition-all shadow-2xs cursor-pointer shrink-0 group"
            title="Azure DevOps Synchronization Hub"
          >
            <FolderGit2 size={13} className="text-[var(--primary)] shrink-0" />
            <span className="hidden sm:inline text-[11px] font-mono font-bold truncate max-w-[130px]">
              {adoTarget.displayTarget || 'ADO Sync'}
            </span>
            <span className="sm:hidden text-[11px]">ADO</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Azure DevOps Connected" />
          </button>

          {/* Technical Debt & Impact Matrix Popup Trigger */}
          {onOpenTechDebtModal && (
            <button
              onClick={onOpenTechDebtModal}
              id="header-tech-debt-matrix-btn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all shadow-2xs cursor-pointer shrink-0 group"
              title="Technical Debt & Defect Impact Matrix"
            >
              <Flame size={13} className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:inline text-[11px] font-bold">Tech Debt</span>
            </button>
          )}

          {/* Email Automation Hub & Executive Dispatcher */}
          <button
            onClick={() => onOpenEmailModal('daily_standup')}
            id="header-email-hub-btn"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all shadow-2xs cursor-pointer shrink-0"
            title="Email Automation & Dispatch Center (6 Production Formats)"
          >
            <Mail size={13} className="text-[var(--primary)]" />
            <span className="hidden xl:inline text-[11px]">Email Hub</span>
          </button>

          {/* Active User Indicator */}
          {(() => {
            const currentUser = (state.users || []).find(u => u.id === state.currentUserId) || (state.users || [])[0];
            if (!currentUser) return null;
            const roleConfig = ROLE_CONFIGS[currentUser.role] || ROLE_CONFIGS[UserRole.StakeholderViewer];
            
            return (
              <div 
                onClick={() => onNavigate('people')}
                title={`Active User: ${currentUser.name} (${currentUser.role}). Click to view User & Role Governance.`}
                className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl cursor-pointer transition-all shadow-2xs group shrink-0"
              >
                <div 
                  className="w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                  style={{ backgroundColor: currentUser.avatarColor || '#4F46E5' }}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] max-w-[90px] truncate leading-none">
                      {currentUser.name.split(' ')[0]}
                    </span>
                    <span 
                      className="w-1.5 h-1.5 rounded-full shrink-0" 
                      style={{ backgroundColor: roleConfig.badgeColor }} 
                    />
                  </div>
                  <span className="text-[9.5px] text-[var(--text-muted)] leading-tight truncate max-w-[90px]">
                    {currentUser.role.split('/')[0]}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Theme Quick Switcher */}
          {onUpdateTheme && (
            <button
              onClick={handleToggleTheme}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all shadow-2xs cursor-pointer shrink-0"
              title={`Active Theme: ${currentTheme}. Click to cycle themes.`}
            >
              {currentTheme === 'obsidian_dark' || currentTheme === 'crimson_ops' ? (
                <Sun size={14} className="text-amber-400" />
              ) : (
                <Moon size={14} className="text-[var(--primary)]" />
              )}
            </button>
          )}

          {/* New Task CTA */}
          <button
            onClick={onOpenNewTaskModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] rounded-xl transition-all shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span className="text-[11px]">New Task</span>
          </button>
        </div>
      </div>

      {/* Lower Deck: Horizontal Segmented Tab Ribbon with Scroll & Reordering */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)]/80 relative">
        <div className="max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6">

          {/* Reorder Mode Guidance Banner */}
          {isReorderMode && (
            <div className="py-1.5 px-3 mb-1 mt-1 bg-[var(--primary-light)]/50 border border-[var(--primary)]/30 rounded-xl flex items-center justify-between text-xs text-[var(--primary)] animate-fadeIn">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} className="shrink-0" />
                <span className="font-bold">
                  Tab Reorder Mode: Click ◀ or ▶ on any menu item (Daily Board, User Stories, Test Cases, etc.) to shift it, or drag to reorder.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetTabOrder}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Reset Order
                </button>
                <button
                  type="button"
                  onClick={() => setIsReorderMode(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-extrabold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 shadow-2xs transition-all cursor-pointer"
                >
                  <Check size={12} />
                  Done
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 py-1.5">
            
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                canScrollLeft
                  ? 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--border)] shadow-2xs'
                  : 'opacity-30 cursor-not-allowed bg-transparent text-[var(--text-muted)] border-transparent'
              }`}
              title="Scroll menu left"
              aria-label="Scroll menu left"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Scrollable Navigation Track */}
            <div className="relative flex-1 min-w-0 overflow-hidden">
              {/* Fade Overlays */}
              {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--bg-subtle)] to-transparent pointer-events-none z-10" />
              )}
              {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--bg-subtle)] to-transparent pointer-events-none z-10" />
              )}

              <nav
                ref={navRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none no-scrollbar cursor-grab active:cursor-grabbing"
              >
                {orderedTabs.map((tab, idx) => {
                  const Icon = tab.icon;
                  const isActive = activeView === tab.id ||
                    (tab.id === 'stories' && activeView === 'userStories') ||
                    (tab.id === 'qa_dashboard' && activeView === 'defectsDashboard') ||
                    (tab.id === 'people' && activeView === 'peopleReview') ||
                    (tab.id === 'apiAutomation' && activeView === 'api_automation');

                  return (
                    <div
                      key={tab.id}
                      draggable={isReorderMode}
                      onDragStart={(e) => handleDragStart(tab.id, e)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(tab.id, e)}
                      className={`relative flex items-center rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                        isReorderMode
                          ? 'border border-dashed border-[var(--primary)]/60 bg-[var(--surface)] p-0.5'
                          : ''
                      }`}
                    >
                      {/* In-Pill Move Left Button (In Reorder Mode) */}
                      {isReorderMode && (
                        <button
                          type="button"
                          onClick={(e) => handleMoveTab(tab.id, 'left', e)}
                          disabled={idx === 0}
                          title={`Move ${tab.label} Left (←)`}
                          className={`p-1 rounded-md transition-colors ${
                            idx === 0
                              ? 'opacity-20 cursor-not-allowed text-[var(--text-muted)]'
                              : 'text-[var(--primary)] hover:bg-[var(--primary-light)] cursor-pointer'
                          }`}
                        >
                          <ChevronLeft size={13} />
                        </button>
                      )}

                      {/* Main Tab Button */}
                      <button
                        type="button"
                        data-active={isActive}
                        onClick={() => {
                          if (!hasDraggedRef.current) {
                            onNavigate(tab.id);
                          }
                        }}
                        className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          isActive && !isReorderMode
                            ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/70 border border-transparent'
                        }`}
                      >
                        {isReorderMode && (
                          <GripVertical size={12} className="text-[var(--text-muted)] shrink-0 cursor-move" />
                        )}
                        <Icon
                          size={14}
                          className={`shrink-0 transition-colors ${
                            isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                          }`}
                        />
                        <span className="whitespace-nowrap">{tab.label}</span>

                        {tab.badge && (
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full leading-tight shrink-0 font-mono ${
                              tab.badgeType === 'critical'
                                ? 'bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical-border)] animate-pulse'
                                : tab.badgeType === 'accent'
                                ? 'bg-[var(--primary)] text-white'
                                : isActive
                                ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                                : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}

                        {/* Active Bottom Glow Indicator */}
                        {isActive && !isReorderMode && (
                          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--primary)] rounded-full" />
                        )}
                      </button>

                      {/* In-Pill Move Right Button (In Reorder Mode) */}
                      {isReorderMode && (
                        <button
                          type="button"
                          onClick={(e) => handleMoveTab(tab.id, 'right', e)}
                          disabled={idx === orderedTabs.length - 1}
                          title={`Move ${tab.label} Right (→)`}
                          className={`p-1 rounded-md transition-colors ${
                            idx === orderedTabs.length - 1
                              ? 'opacity-20 cursor-not-allowed text-[var(--text-muted)]'
                              : 'text-[var(--primary)] hover:bg-[var(--primary-light)] cursor-pointer'
                          }`}
                        >
                          <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                canScrollRight
                  ? 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border-[var(--border)] shadow-2xs'
                  : 'opacity-30 cursor-not-allowed bg-transparent text-[var(--text-muted)] border-transparent'
              }`}
              title="Scroll menu right"
              aria-label="Scroll menu right"
            >
              <ChevronRight size={14} />
            </button>

            {/* Divider */}
            <div className="h-4 w-px bg-[var(--border)] mx-0.5 shrink-0" />

            {/* Reorder / Customize Tabs Toggle Button */}
            <button
              type="button"
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                isReorderMode
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                  : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]'
              }`}
              title={isReorderMode ? 'Exit reorder mode' : 'Move menu items left or right (Customize tab order)'}
            >
              <ArrowLeftRight size={13} className={isReorderMode ? 'text-white' : 'text-[var(--primary)]'} />
              <span className="hidden xl:inline text-[11px]">
                {isReorderMode ? 'Done' : 'Move / Reorder'}
              </span>
            </button>

            {/* All Views Popover Dropdown Button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowAllTabsDropdown(!showAllTabsDropdown)}
                className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  showAllTabsDropdown
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/40'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]'
                }`}
                title="All Navigation Views & Quick Position Shift"
                aria-label="All Navigation Views"
              >
                <Grid size={14} />
              </button>

              {/* All Views Popover Menu */}
              {showAllTabsDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 p-2 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                      <Grid size={13} className="text-[var(--primary)]" />
                      <span>All Navigation Views</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllTabsDropdown(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                    {orderedTabs.map((tab, idx) => {
                      const Icon = tab.icon;
                      const isActive = activeView === tab.id ||
                        (tab.id === 'stories' && activeView === 'userStories') ||
                        (tab.id === 'qa_dashboard' && activeView === 'defectsDashboard') ||
                        (tab.id === 'people' && activeView === 'peopleReview') ||
                        (tab.id === 'apiAutomation' && activeView === 'api_automation');

                      return (
                        <div
                          key={tab.id}
                          className={`flex items-center justify-between p-1.5 rounded-xl transition-all ${
                            isActive
                              ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                              : 'hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                          }`}
                        >
                          <div
                            onClick={() => {
                              onNavigate(tab.id);
                              setShowAllTabsDropdown(false);
                            }}
                            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                          >
                            <Icon size={14} className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} />
                            <span className="truncate">{tab.label}</span>
                            {tab.badge && (
                              <span className="text-[9px] font-bold px-1 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                                {tab.badge}
                              </span>
                            )}
                          </div>

                          {/* Quick Position Shift Controls */}
                          <div className="flex items-center gap-0.5 shrink-0 ml-1">
                            <button
                              type="button"
                              onClick={(e) => handleMoveTab(tab.id, 'left', e)}
                              disabled={idx === 0}
                              title={`Shift ${tab.label} Left (Earlier)`}
                              className={`p-1 rounded hover:bg-[var(--surface)] transition-colors ${
                                idx === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer text-[var(--text-secondary)] hover:text-[var(--primary)]'
                              }`}
                            >
                              <ArrowLeft size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleMoveTab(tab.id, 'right', e)}
                              disabled={idx === orderedTabs.length - 1}
                              title={`Shift ${tab.label} Right (Later)`}
                              className={`p-1 rounded hover:bg-[var(--surface)] transition-colors ${
                                idx === orderedTabs.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer text-[var(--text-secondary)] hover:text-[var(--primary)]'
                              }`}
                            >
                              <ArrowRight size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 mt-1.5 border-t border-[var(--border)] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleResetTabOrder}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={10} />
                      Reset to Default
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReorderMode(true);
                        setShowAllTabsDropdown(false);
                      }}
                      className="text-[11px] text-[var(--primary)] font-bold hover:underline cursor-pointer"
                    >
                      Open Reorder Bar
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
