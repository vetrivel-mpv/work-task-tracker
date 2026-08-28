import React, { useEffect, useState, useMemo } from 'react';
import { 
  Defect, 
  Release, 
  TeamMember 
} from '../../types';
import { DefectImpactMatrix } from './DefectImpactMatrix';
import { 
  X, 
  ShieldAlert, 
  Maximize2, 
  Minimize2, 
  Calendar, 
  Sparkles, 
  Activity,
  Layers,
  Flame,
  Printer,
  ExternalLink,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatReleaseDisplayName } from '../../utils/adoPaths';
import { analyzeTechnicalDebt } from '../../utils/defectImpact';

interface TechnicalDebtImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  defects: Defect[];
  releases: Release[];
  team: TeamMember[];
  selectedReleaseId?: string | null;
  onSelectRelease?: (releaseId: string | null) => void;
}

export const TechnicalDebtImpactModal: React.FC<TechnicalDebtImpactModalProps> = ({
  isOpen,
  onClose,
  defects,
  releases,
  team,
  selectedReleaseId,
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

  // Telemetry for header badge
  const debtMetrics = useMemo(() => {
    const activeOnly = defects.filter(d => d.status !== 'Closed');
    const analysis = analyzeTechnicalDebt(activeOnly, { onlyActive: true });
    const criticalCount = activeOnly.filter(d => d.severity === 'critical').length;
    return {
      totalDebtScore: analysis.totalScore,
      debtGrade: analysis.debtGrade,
      criticalCount,
      activeCount: activeOnly.length
    };
  }, [defects]);

  if (!isOpen) return null;

  const currentRelease = selectedReleaseId && selectedReleaseId !== 'all'
    ? releases.find(r => r.id === selectedReleaseId || r.iterationPath === selectedReleaseId || r.name === selectedReleaseId)
    : null;

  const releaseTitle = currentRelease
    ? formatReleaseDisplayName(currentRelease.name, currentRelease.releaseNumber)
    : 'All Releases Scope';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      id="technical-debt-impact-modal-backdrop"
    >
      <div 
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
          isFullScreen 
            ? 'w-full h-full max-w-none rounded-none' 
            : 'w-full max-w-6xl max-h-[94vh]'
        }`}
        id="technical-debt-impact-modal-container"
      >
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shadow-xs shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                  Technical Debt & Impact Matrix
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 shrink-0">
                  {releaseTitle}
                </span>
                
                {/* Score badge */}
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                  <Flame size={12} />
                  Debt Index: {debtMetrics.totalDebtScore} pts
                </span>

                {debtMetrics.criticalCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical-border)]">
                    {debtMetrics.criticalCount} Critical
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Severity vs Priority risk categorization, technical debt accumulation, and defect impact triage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Print / Export Report */}
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-all cursor-pointer hidden sm:flex items-center gap-1.5 text-xs font-bold"
              title="Print / Save Impact Matrix Summary"
            >
              <Printer size={15} />
              <span>Print Matrix</span>
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
              id="close-tech-debt-modal-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <DefectImpactMatrix
            defects={defects}
            releases={releases}
            team={team}
            selectedReleaseId={selectedReleaseId}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity size={14} className="text-[var(--primary)]" />
              <span>Real-time technical debt index derived from defect severity, priority multipliers, and aging</span>
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
