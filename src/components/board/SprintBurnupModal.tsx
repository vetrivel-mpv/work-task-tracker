import React, { useEffect, useState } from 'react';
import { 
  Release, 
  UserStory, 
  Task, 
  Defect 
} from '../../types';
import { SprintBurnupChart } from './SprintBurnupChart';
import { 
  X, 
  TrendingUp, 
  Maximize2, 
  Minimize2, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Activity,
  Layers,
  ArrowUpRight,
  Printer
} from 'lucide-react';
import { formatReleaseDisplayName } from '../../utils/adoPaths';

interface SprintBurnupModalProps {
  isOpen: boolean;
  onClose: () => void;
  releases: Release[];
  userStories: UserStory[];
  tasks: Task[];
  defects: Defect[];
  selectedReleaseId: string | null;
  currentDateStr: string;
  onSelectRelease?: (releaseId: string | null) => void;
}

export const SprintBurnupModal: React.FC<SprintBurnupModalProps> = ({
  isOpen,
  onClose,
  releases,
  userStories,
  tasks,
  defects,
  selectedReleaseId,
  currentDateStr,
  onSelectRelease
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRelease = selectedReleaseId
    ? releases.find(r => r.id === selectedReleaseId || r.iterationPath === selectedReleaseId || r.name === selectedReleaseId)
    : releases.find(r => r.status === 'Active QA') || (releases.length > 0 ? releases[0] : null);

  const releaseTitle = currentRelease
    ? formatReleaseDisplayName(currentRelease.name, currentRelease.releaseNumber)
    : 'All Active Sprints';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
          isFullScreen 
            ? 'w-full h-full max-w-none rounded-none' 
            : 'w-full max-w-6xl max-h-[92vh]'
        }`}
      >
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shadow-xs shrink-0">
              <TrendingUp size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                  Sprint Burnup & Release Predictability Horizon
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 shrink-0">
                  {releaseTitle}
                </span>
                {currentRelease?.targetDate && (
                  <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1 hidden sm:flex">
                    <Calendar size={12} />
                    Target: {currentRelease.targetDate}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Real-time D3 scope burnup, Monte Carlo velocity projections, what-if simulations, and confidence modeling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Print / Export Report */}
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-all cursor-pointer hidden sm:flex items-center gap-1.5 text-xs font-bold"
              title="Print / Save Predictability Summary"
            >
              <Printer size={15} />
              <span>Print Report</span>
            </button>

            {/* Maximize / Minimize Modal */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-all cursor-pointer"
              title={isFullScreen ? 'Restore normal window' : 'Full-screen mode'}
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] border border-[var(--border)] transition-all cursor-pointer"
              title="Close popup (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <SprintBurnupChart
            releases={releases}
            userStories={userStories}
            tasks={tasks}
            defects={defects}
            selectedReleaseId={selectedReleaseId}
            currentDateStr={currentDateStr}
            onSelectRelease={onSelectRelease}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Calculated using live story points, completed tasks, and historical sprint velocity</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all shadow-xs cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
