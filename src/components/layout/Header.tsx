import React from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Plus, 
  Mail, 
  Sparkles,
  ArrowRightLeft,
  FolderGit2,
  Building2,
  Globe2,
  Rocket
} from 'lucide-react';
import { toDateStr, shiftDate, formatDisplayDate, isToday } from '../../utils/date';
import { Release, DualAdoConfig } from '../../types';

interface HeaderProps {
  appName?: string;
  currentDateStr?: string;
  dateStr?: string;
  onDateChange?: (date: string) => void;
  setDateStr?: (date: string) => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onToday?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  setSearchQuery?: (q: string) => void;
  releases?: Release[];
  selectedReleaseId?: string | null;
  onSelectRelease?: (id: string | null) => void;
  onOpenNewTaskModal?: () => void;
  onOpenNewTask?: () => void;
  onOpenEmailModal?: () => void;
  onOpenStandupEmail?: () => void;
  onOpenQaStatusEmail?: () => void;
  onOpenAdoModal?: () => void;
  onOpenCommandPalette?: () => void;
  onCarryForward?: () => void;
  dualAdoConfig?: DualAdoConfig;
}

export const Header: React.FC<HeaderProps> = ({
  appName = 'ACM (AT&T Connection Manager) Delivery',
  currentDateStr,
  dateStr: propDateStr,
  onDateChange,
  setDateStr,
  onPrevDay,
  onNextDay,
  onToday,
  searchQuery = '',
  onSearchChange,
  setSearchQuery,
  releases = [],
  selectedReleaseId,
  onSelectRelease,
  onOpenNewTaskModal,
  onOpenNewTask,
  onOpenEmailModal,
  onOpenStandupEmail,
  onOpenAdoModal,
  dualAdoConfig
}) => {
  const activeDate = currentDateStr || propDateStr || toDateStr(new Date());
  const isCurrentToday = isToday(activeDate);

  const handleDateChange = (d: string) => {
    if (onDateChange) onDateChange(d);
    if (setDateStr) setDateStr(d);
  };

  const handleSearchChange = (q: string) => {
    if (onSearchChange) onSearchChange(q);
    if (setSearchQuery) setSearchQuery(q);
  };

  const handleAddTask = () => {
    if (onOpenNewTaskModal) onOpenNewTaskModal();
    else if (onOpenNewTask) onOpenNewTask();
  };

  const handleOpenEmail = () => {
    if (onOpenEmailModal) onOpenEmailModal();
    else if (onOpenStandupEmail) onOpenStandupEmail();
  };

  return (
    <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-6 py-3 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-colors">
      {/* Left: Date Switcher & Navigation */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="flex items-center bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-0.5 shadow-xs flex-shrink-0">
          <button
            onClick={onPrevDay ? onPrevDay : () => handleDateChange(shiftDate(activeDate, -1))}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={15} />
          </button>
          
          <button
            onClick={onToday ? onToday : () => handleDateChange(toDateStr(new Date()))}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isCurrentToday
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            }`}
          >
            Today
          </button>

          <button
            onClick={onNextDay ? onNextDay : () => handleDateChange(shiftDate(activeDate, 1))}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Date Display Pill with Hidden Picker */}
        <div className="relative flex items-center gap-2 bg-[var(--bg-subtle)] border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--text-primary)] flex-shrink-0">
          <CalendarIcon size={13} className="text-[var(--primary)]" />
          <span className="whitespace-nowrap">{formatDisplayDate(activeDate)}</span>
          <input
            aria-label="Select Date"
            type="date"
            value={activeDate}
            onChange={(e) => e.target.value && handleDateChange(e.target.value)}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </div>

        {/* Release Filter Selector */}
        {releases.length > 0 && onSelectRelease && (
          <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2.5 py-1 text-xs font-bold text-[var(--text-primary)]">
            <Rocket size={13} className="text-[var(--primary)] flex-shrink-0" />
            <select
              value={selectedReleaseId || ''}
              onChange={(e) => onSelectRelease(e.target.value || null)}
              className="bg-transparent text-xs font-bold text-[var(--text-primary)] outline-none max-w-[160px] sm:max-w-[220px] truncate cursor-pointer"
            >
              <option value="">All Releases</option>
              {releases.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Center: Search Field */}
      <div className="flex-1 max-w-sm min-w-[160px] order-3 sm:order-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search tasks, defects, deliverables..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl pl-8.5 pr-3 py-1.5 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:bg-[var(--surface)] focus:border-[var(--primary)] outline-none transition-all"
          />
        </div>
      </div>

      {/* Right: ADO Sync, Broadcast & Add Task Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0 order-2 sm:order-3">
        {onOpenAdoModal && (
          <button
            onClick={onOpenAdoModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap"
            title="Azure DevOps Synchronization Hub"
          >
            <FolderGit2 size={14} className="text-[var(--primary)]" />
            <span className="hidden md:inline">ADO Sync</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" title="Azure DevOps Connected" />
          </button>
        )}

        <button
          onClick={handleOpenEmail}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap"
          title="Executive Email & Standup Dispatcher"
        >
          <Mail size={14} className="text-[var(--primary)]" />
          <span className="hidden md:inline">Broadcast</span>
        </button>

        <button
          onClick={handleAddTask}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl transition-all shadow-xs active:scale-98 cursor-pointer whitespace-nowrap"
        >
          <Plus size={14} />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};

