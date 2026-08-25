import React, { useState, useMemo, useEffect } from 'react';
import { Defect, Release, TeamMember } from '../../types';
import { 
  Flame, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Activity, 
  Clock, 
  Wrench, 
  ExternalLink, 
  Search, 
  Filter, 
  Info, 
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Zap,
  Tag,
  Rocket,
  User,
  X
} from 'lucide-react';
import { 
  analyzeTechnicalDebt, 
  SEVERITIES, 
  PRIORITIES, 
  SEVERITY_LABELS, 
  PRIORITY_LABELS,
  RISK_TIERS,
  getDefectPriority,
  getDefectRiskScore,
  getDefectRiskTier,
  MatrixCellData
} from '../../utils/defectImpact';
import { getWorkItemAssignee } from '../../utils/assigneeUtils';
import { matchesReleaseOrIteration, formatReleaseDisplayName } from '../../utils/adoPaths';

interface DefectImpactMatrixProps {
  defects: Defect[];
  releases: Release[];
  team: TeamMember[];
  selectedReleaseId?: string | null;
}

export const DefectImpactMatrix: React.FC<DefectImpactMatrixProps> = ({
  defects,
  releases,
  team,
  selectedReleaseId
}) => {
  // State for matrix filters & selection
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [selectedCell, setSelectedCell] = useState<{ severity: string; priority: string } | null>(null);
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');

  // Find active release if selected globally
  const activeRelease = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return null;
    return releases.find(r => r.id === selectedReleaseId);
  }, [releases, selectedReleaseId]);

  // Reset drilldown selection if release scope changes
  useEffect(() => {
    setSelectedCell(null);
    setSelectedTierFilter('all');
  }, [selectedReleaseId]);

  // Filter defects by release first if selected
  const scopedDefects = useMemo(() => {
    return defects.filter(d => {
      if (selectedReleaseId && selectedReleaseId !== 'all') {
        return matchesReleaseOrIteration(d, selectedReleaseId, releases);
      }
      return true;
    });
  }, [defects, selectedReleaseId, releases]);

  // Compute Technical Debt & Matrix Analysis
  const debtAnalysis = useMemo(() => {
    return analyzeTechnicalDebt(scopedDefects, { onlyActive });
  }, [scopedDefects, onlyActive]);

  // Filtered defects for the drilldown table
  const drilldownDefects = useMemo(() => {
    let list = onlyActive ? scopedDefects.filter(d => d.status !== 'Closed') : scopedDefects;

    // Filter by selected cell
    if (selectedCell) {
      list = list.filter(d => {
        const prio = getDefectPriority(d);
        return d.severity === selectedCell.severity && prio === selectedCell.priority;
      });
    }

    // Filter by tier filter if no specific cell selected
    if (!selectedCell && selectedTierFilter !== 'all') {
      list = list.filter(d => {
        const tier = getDefectRiskTier(d);
        return tier.id === selectedTierFilter;
      });
    }

    // Search query filter
    if (drilldownSearch.trim()) {
      const q = drilldownSearch.toLowerCase().trim();
      list = list.filter(d => 
        d.title.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.adoId && d.adoId.toString().includes(q)) ||
        (d.assigneeName && d.assigneeName.toLowerCase().includes(q)) ||
        (d.tags && d.tags.some(t => t.toLowerCase().includes(q))) ||
        (d.environment && d.environment.toLowerCase().includes(q))
      );
    }

    // Sort by risk score descending, then by updated date
    return list.sort((a, b) => {
      const scoreA = getDefectRiskScore(a);
      const scoreB = getDefectRiskScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });
  }, [scopedDefects, onlyActive, selectedCell, selectedTierFilter, drilldownSearch]);

  // Reset cell selection
  const handleClearSelection = () => {
    setSelectedCell(null);
    setSelectedTierFilter('all');
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg">
              <Layers size={18} />
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Technical Debt & Impact Matrix
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              Severity &times; Priority 2D Grid
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">
            Visualizes defect risk density and technical debt distribution across functional severity and business urgency.
          </p>
        </div>

        {/* Global Matrix Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Release Context Indicator (synced with global header) */}
          {activeRelease ? (
            <div className="inline-flex items-center gap-1.5 bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 rounded-xl px-2.5 py-1 text-xs font-semibold">
              <Rocket size={13} />
              <span>{formatReleaseDisplayName(activeRelease.name, activeRelease.releaseNumber)}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-[var(--primary)]/15 rounded-md font-bold">
                {scopedDefects.length} bugs
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl px-2.5 py-1 text-xs font-medium">
              <Rocket size={13} className="text-[var(--text-muted)]" />
              <span>All Releases ({scopedDefects.length} bugs)</span>
            </div>
          )}

          {/* Active vs All Toggle */}
          <div className="flex items-center p-0.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs font-semibold">
            <button
              onClick={() => setOnlyActive(true)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                onlyActive 
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-bold border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Active Defects
            </button>
            <button
              onClick={() => setOnlyActive(false)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                !onlyActive 
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-bold border border-[var(--border)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All (incl. Closed)
            </button>
          </div>
        </div>
      </div>

      {/* Top Health Stats & Technical Debt Score */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Health Grade & Debt Score */}
        <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Tech Debt Health
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${debtAnalysis.gradeColor}`}>
                Grade {debtAnalysis.debtGrade}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-bold">
                ({debtAnalysis.normalizedHealthScore}/100)
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Score: <strong className="text-[var(--text-primary)]">{debtAnalysis.totalScore} pts</strong>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border ${
            debtAnalysis.debtGrade === 'A' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
            debtAnalysis.debtGrade === 'B' ? 'bg-teal-500/10 text-teal-600 border-teal-500/30' :
            debtAnalysis.debtGrade === 'C' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
            debtAnalysis.debtGrade === 'D' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
            'bg-red-500/10 text-red-600 border-red-500/30'
          }`}>
            {debtAnalysis.debtGrade}
          </div>
        </div>

        {/* Critical Blockers */}
        <div 
          onClick={() => {
            setSelectedCell(null);
            setSelectedTierFilter(selectedTierFilter === 'critical_blocker' ? 'all' : 'critical_blocker');
          }}
          className={`bg-[var(--surface-hover)] border rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all ${
            selectedTierFilter === 'critical_blocker'
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/5'
              : 'border-[var(--border)] hover:border-red-500/40'
          }`}
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
              <Flame size={13} />
              <span>Release Blockers</span>
            </div>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
              {debtAnalysis.tierCounts.critical_blocker}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Score &ge; 12 &bull; Hotfix priority
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-600">
            <ShieldAlert size={20} />
          </div>
        </div>

        {/* Estimated Remediation Effort */}
        <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Wrench size={13} className="text-[var(--primary)]" />
              <span>Remediation Effort</span>
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              ~{debtAnalysis.estimatedRemediationHours} <span className="text-xs font-semibold text-[var(--text-secondary)]">hrs</span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              &asymp; {Math.ceil(debtAnalysis.estimatedRemediationHours / 6)} Dev-Days equivalent
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
            <Activity size={20} />
          </div>
        </div>

        {/* Blocker Aging */}
        <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Clock size={13} className="text-[var(--medium)]" />
              <span>Oldest Blocker Age</span>
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {debtAnalysis.oldestBlockerDays > 0 ? `${debtAnalysis.oldestBlockerDays}d` : '0d'}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {debtAnalysis.tierCounts.critical_blocker > 0 ? 'Requires escalation' : 'No active blockers'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Impact Matrix 2D Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* The 4x4 Interactive Matrix Grid (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">2D Matrix Heatmap</span>
              <span className="text-[10px] text-[var(--text-muted)]">(Click any cell to filter drilldown)</span>
            </div>

            {selectedCell && (
              <button
                onClick={handleClearSelection}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Clear cell filter ({SEVERITY_LABELS[selectedCell.severity as keyof typeof SEVERITY_LABELS]?.code} &times; {PRIORITY_LABELS[selectedCell.priority as keyof typeof PRIORITY_LABELS]?.code})</span>
              </button>
            )}
          </div>

          {/* Matrix Container */}
          <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl p-4 overflow-x-auto">
            {/* Column Headers (Priority - X Axis) */}
            <div className="grid grid-cols-5 gap-2 min-w-[540px]">
              {/* Top-Left Corner Label */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Severity &darr;</span>
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Priority &rarr;</span>
              </div>

              {/* Priority Columns */}
              {PRIORITIES.map(prio => {
                const pInfo = PRIORITY_LABELS[prio];
                return (
                  <div 
                    key={prio} 
                    className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center flex flex-col justify-center"
                  >
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-center gap-1">
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-black">
                        {pInfo.code}
                      </span>
                      <span>{pInfo.label}</span>
                    </div>
                    <div className="text-[9.5px] text-[var(--text-muted)] truncate mt-0.5 font-medium" title={pInfo.desc}>
                      {prio === 'critical' ? 'Urgent Hotfix' : prio === 'high' ? 'High Urgency' : prio === 'medium' ? 'Standard' : 'Low Urgency'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Matrix Rows (Severity - Y Axis) */}
            <div className="flex flex-col gap-2 mt-2 min-w-[540px]">
              {debtAnalysis.matrixGrid.map((row, rowIndex) => {
                const sev = SEVERITIES[rowIndex];
                const sInfo = SEVERITY_LABELS[sev];

                return (
                  <div key={sev} className="grid grid-cols-5 gap-2">
                    {/* Severity Row Label */}
                    <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-center">
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-black ${
                          sev === 'critical' ? 'bg-red-500/15 text-red-600' :
                          sev === 'high' ? 'bg-orange-500/15 text-orange-600' :
                          sev === 'medium' ? 'bg-amber-500/15 text-amber-600' :
                          'bg-emerald-500/15 text-emerald-600'
                        }`}>
                          {sInfo.code}
                        </span>
                        <span>{sInfo.label}</span>
                      </div>
                      <div className="text-[9.5px] text-[var(--text-muted)] truncate mt-0.5 font-medium" title={sInfo.desc}>
                        {sev === 'critical' ? 'Blocker/Crash' : sev === 'high' ? 'Major Defect' : sev === 'medium' ? 'Workaround' : 'Cosmetic'}
                      </div>
                    </div>

                    {/* Matrix Cells */}
                    {row.map((cell) => {
                      const isSelected = selectedCell?.severity === cell.severity && selectedCell?.priority === cell.priority;
                      const count = onlyActive ? cell.activeCount : cell.totalCount;
                      const tier = cell.tier;

                      // Calculate cell heatmap background intensity
                      let cellStyle = 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]';
                      if (count > 0) {
                        if (tier.id === 'critical_blocker') {
                          cellStyle = 'bg-red-500/15 border-red-500/40 hover:bg-red-500/25 text-red-700 dark:text-red-300';
                        } else if (tier.id === 'high_risk') {
                          cellStyle = 'bg-orange-500/15 border-orange-500/40 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300';
                        } else if (tier.id === 'moderate_debt') {
                          cellStyle = 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300';
                        } else {
                          cellStyle = 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300';
                        }
                      }

                      return (
                        <button
                          key={`${cell.severity}-${cell.priority}`}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCell(null);
                            } else {
                              setSelectedCell({ severity: cell.severity, priority: cell.priority });
                              setSelectedTierFilter('all');
                            }
                          }}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer relative group ${cellStyle} ${
                            isSelected ? 'ring-3 ring-[var(--primary)] border-[var(--primary)] shadow-md scale-[1.02] z-10' : ''
                          }`}
                        >
                          {/* Score Badge (Top Right) */}
                          <span className="absolute top-1 right-1.5 text-[9px] font-mono font-bold text-[var(--text-muted)] opacity-60">
                            w:{cell.score}
                          </span>

                          {/* Bug Count */}
                          <div className="text-xl font-black tracking-tight flex items-baseline gap-1">
                            <span>{count}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                              {count === 1 ? 'bug' : 'bugs'}
                            </span>
                          </div>

                          {/* Subtitle tag */}
                          <div className="text-[10px] font-semibold mt-0.5 opacity-80 truncate max-w-full">
                            {tier.shortLabel}
                          </div>

                          {/* Hover Tooltip Overlay */}
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                            <div className="bg-slate-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap border border-slate-700 font-medium">
                              <strong>{SEVERITY_LABELS[cell.severity].label} &times; {PRIORITY_LABELS[cell.priority].label}</strong>
                              <div className="text-slate-300 text-[9px]">
                                {cell.activeCount} active &bull; {cell.closedCount} resolved &bull; Risk Score {cell.score}
                              </div>
                            </div>
                            <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Risk Tier Distribution & Breakdown (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="text-xs font-bold text-[var(--text-primary)]">Technical Debt Risk Tiers</div>

          <div className="flex flex-col gap-2.5">
            {Object.values(RISK_TIERS).map((tier) => {
              const count = debtAnalysis.tierCounts[tier.id];
              const isSelected = selectedTierFilter === tier.id && !selectedCell;

              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setSelectedCell(null);
                    setSelectedTierFilter(isSelected ? 'all' : tier.id);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected 
                      ? `${tier.bg} ${tier.border} ring-2 ring-[var(--primary)] shadow-xs` 
                      : 'bg-[var(--surface-hover)] border-[var(--border)] hover:border-[var(--primary)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        tier.id === 'critical_blocker' ? 'bg-red-500' :
                        tier.id === 'high_risk' ? 'bg-orange-500' :
                        tier.id === 'moderate_debt' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <span className="text-xs font-bold text-[var(--text-primary)]">{tier.label}</span>
                    </div>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-md font-mono ${tier.bg} ${tier.text} border ${tier.border}`}>
                      {count} {count === 1 ? 'defect' : 'defects'}
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {tier.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Quick Technical Debt Health Recommendation */}
          <div className="bg-[var(--primary-light)] border border-[var(--primary)]/30 rounded-xl p-3.5 flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
              <Sparkles size={14} />
              <span>Remediation Recommendation</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {debtAnalysis.tierCounts.critical_blocker > 0 
                ? `Prioritize clearing ${debtAnalysis.tierCounts.critical_blocker} release blocker(s) before feature stabilization.`
                : debtAnalysis.tierCounts.high_risk > 0
                ? `Stabilize ${debtAnalysis.tierCounts.high_risk} high-risk defect(s) during current iteration sprint to reduce release risk.`
                : `Technical debt is under control (Grade ${debtAnalysis.debtGrade}). Focus on standard backlog grooming.`}
            </p>
          </div>
        </div>
      </div>

      {/* Drilldown Defect List */}
      <div className="border-t border-[var(--border)] pt-5 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span>Impact Matrix Drilldown</span>
              <span className="text-xs text-[var(--text-muted)] font-normal">
                ({drilldownDefects.length} matching)
              </span>
            </h3>

            {(selectedCell || selectedTierFilter !== 'all') && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 flex items-center gap-1">
                <span>Filtered: {selectedCell ? `${SEVERITY_LABELS[selectedCell.severity as keyof typeof SEVERITY_LABELS]?.label} &times; ${PRIORITY_LABELS[selectedCell.priority as keyof typeof PRIORITY_LABELS]?.label}` : RISK_TIERS[selectedTierFilter]?.label}</span>
                <button onClick={handleClearSelection} className="hover:text-red-500 cursor-pointer ml-1">
                  &times;
                </button>
              </span>
            )}
          </div>

          {/* Drilldown Search Box */}
          <div className="relative min-w-[240px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search drilldown defects..."
              value={drilldownSearch}
              onChange={(e) => setDrilldownSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
            />
            {drilldownSearch && (
              <button 
                onClick={() => setDrilldownSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Drilldown List Cards */}
        {drilldownDefects.length === 0 ? (
          <div className="p-8 text-center bg-[var(--surface-hover)] border border-dashed border-[var(--border)] rounded-2xl">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-60" />
            <div className="text-xs font-bold text-[var(--text-primary)]">No defects found in this selection</div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Try selecting a different cell in the matrix or changing your search filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {drilldownDefects.map((defect) => {
              const prio = getDefectPriority(defect);
              const riskScore = getDefectRiskScore(defect);
              const tier = getDefectRiskTier(defect);
              const assignee = getWorkItemAssignee(defect, team);
              const sInfo = SEVERITY_LABELS[defect.severity] || SEVERITY_LABELS.medium;
              const pInfo = PRIORITY_LABELS[prio] || PRIORITY_LABELS.medium;

              return (
                <div
                  key={defect.id}
                  className={`bg-[var(--surface)] border rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-2.5 transition-all hover:border-[var(--primary)]/40 ${
                    tier.id === 'critical_blocker' ? 'border-red-500/30' : 'border-[var(--border)]'
                  }`}
                >
                  {/* Top row: ID / ADO Link & Risk Score */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {defect.adoId ? (
                        <a
                          href={defect.adoUrl || `https://dev.azure.com/simetricwdh/ACM/_workitems/edit/${defect.adoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 border border-[var(--primary)]/20"
                          title="Open defect in Azure DevOps"
                        >
                          <span>#{defect.adoId}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                          {defect.id.slice(0, 8)}
                        </span>
                      )}

                      {/* Status */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        defect.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                        defect.status === 'Fixed' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                        defect.status === 'Retest' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                        'bg-red-500/10 text-red-600 border-red-500/30'
                      }`}>
                        {defect.status}
                      </span>

                      {/* Environment */}
                      {defect.environment && (
                        <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]">
                          {defect.environment}
                        </span>
                      )}
                    </div>

                    {/* Risk Score Pill */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${tier.bg} ${tier.text} ${tier.border}`}>
                      <span>Risk: {riskScore}</span>
                    </div>
                  </div>

                  {/* Defect Title */}
                  <div className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">
                    {defect.title}
                  </div>

                  {/* Severity & Priority Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      defect.severity === 'critical' ? 'bg-red-500/15 text-red-600 border-red-500/30' :
                      defect.severity === 'high' ? 'bg-orange-500/15 text-orange-600 border-orange-500/30' :
                      defect.severity === 'medium' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' :
                      'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                    }`}>
                      <span className="font-mono font-black">{sInfo.code}</span>
                      <span>{sInfo.label}</span>
                    </span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      prio === 'critical' ? 'bg-red-500/15 text-red-600 border-red-500/30' :
                      prio === 'high' ? 'bg-orange-500/15 text-orange-600 border-orange-500/30' :
                      prio === 'medium' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' :
                      'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                    }`}>
                      <span className="font-mono font-black">{pInfo.code}</span>
                      <span>{pInfo.label}</span>
                    </span>

                    {defect.tags && defect.tags.length > 0 && (
                      <span className="text-[9.5px] text-[var(--text-muted)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border)] truncate max-w-[120px]">
                        #{defect.tags[0]}
                      </span>
                    )}
                  </div>

                  {/* Assignee & Iteration Footer */}
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] border-t border-[var(--border)]/60 pt-2 mt-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-4 h-4 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
                        {assignee ? assignee.name.charAt(0) : '?'}
                      </div>
                      <span className="truncate font-medium text-[var(--text-secondary)]">
                        {assignee ? assignee.name : 'Unassigned'}
                      </span>
                    </div>

                    <div className="font-mono text-[9px] text-[var(--text-muted)] truncate max-w-[150px]">
                      {defect.iterationPath || 'ACM (Global)'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
