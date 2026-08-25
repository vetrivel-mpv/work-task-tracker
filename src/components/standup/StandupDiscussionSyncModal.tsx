import React, { useState, useMemo } from 'react';
import { 
  AppState, 
  TeamMember, 
  Task, 
  Defect, 
  StandupEntry 
} from '../../types';
import { 
  discoverStandupReconciliationActions, 
  StandupReconciliationItem 
} from '../../utils/standupDashboardSync';
import { 
  X, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle, 
  CheckSquare, 
  Bug, 
  Sparkles, 
  Filter, 
  Search, 
  Check, 
  ArrowRight,
  ShieldAlert,
  Layers,
  ChevronRight
} from 'lucide-react';

interface StandupDiscussionSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
}

export const StandupDiscussionSyncModal: React.FC<StandupDiscussionSyncModalProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateState
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const actions = useMemo(() => {
    return discoverStandupReconciliationActions(state);
  }, [state]);

  if (!isOpen) return null;

  const filteredActions = actions.filter(action => {
    if (appliedActionIds.has(action.id)) return false;
    if (selectedType !== 'all' && action.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        action.memberName.toLowerCase().includes(q) ||
        action.title.toLowerCase().includes(q) ||
        action.description.toLowerCase().includes(q) ||
        action.sourceText.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleApplySingleAction = (action: StandupReconciliationItem) => {
    onUpdateState(prev => {
      let nextTasks = [...(prev.tasks || [])];
      let nextDefects = [...(prev.defects || [])];
      let nextStandup = { ...(prev.standup || {}) };

      if (action.type === 'mark_task_complete' && action.targetItemId) {
        nextTasks = nextTasks.map(t => 
          t.id === action.targetItemId 
            ? { ...t, status: 'complete', completedAt: new Date().toISOString() } 
            : t
        );
      } else if (action.type === 'create_blocker_defect') {
        const newDefect: Defect = {
          id: `defect-standup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: `[Standup Blocker] ${action.sourceText.slice(0, 100)}`,
          description: `Blocker identified in standup call with ${action.memberName}:\n\n${action.sourceText}`,
          severity: action.severity || 'high',
          status: 'Active',
          origin: 'internal_qa',
          assigneeId: action.memberId,
          assigneeName: action.memberName,
          environment: 'Dev',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        nextDefects = [newDefect, ...nextDefects];
      } else if (action.type === 'push_task_to_today' && action.targetItemId) {
        const currentEntry = nextStandup[action.memberId] || { yesterday: '', today: '', blockers: '' };
        const formattedBullet = `• [Task] ${action.sourceText}`;
        const newToday = currentEntry.today 
          ? `${currentEntry.today}\n${formattedBullet}`
          : formattedBullet;
        nextStandup[action.memberId] = {
          ...currentEntry,
          today: newToday
        };
      }

      return {
        ...prev,
        tasks: nextTasks,
        defects: nextDefects,
        standup: nextStandup
      };
    });

    setAppliedActionIds(prev => new Set([...prev, action.id]));
    showNotification(`Applied: ${action.suggestedActionLabel}`);
  };

  const handleApplyAll = () => {
    if (filteredActions.length === 0) return;

    onUpdateState(prev => {
      let nextTasks = [...(prev.tasks || [])];
      let nextDefects = [...(prev.defects || [])];
      let nextStandup = { ...(prev.standup || {}) };

      filteredActions.forEach(action => {
        if (action.type === 'mark_task_complete' && action.targetItemId) {
          nextTasks = nextTasks.map(t => 
            t.id === action.targetItemId 
              ? { ...t, status: 'complete', completedAt: new Date().toISOString() } 
              : t
          );
        } else if (action.type === 'create_blocker_defect') {
          const newDefect: Defect = {
            id: `defect-standup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            title: `[Standup Blocker] ${action.sourceText.slice(0, 100)}`,
            description: `Blocker identified in standup call with ${action.memberName}:\n\n${action.sourceText}`,
            severity: action.severity || 'high',
            status: 'Active',
            origin: 'internal_qa',
            assigneeId: action.memberId,
            assigneeName: action.memberName,
            environment: 'Dev',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          nextDefects = [newDefect, ...nextDefects];
        } else if (action.type === 'push_task_to_today' && action.targetItemId) {
          const currentEntry = nextStandup[action.memberId] || { yesterday: '', today: '', blockers: '' };
          const formattedBullet = `• [Task] ${action.sourceText}`;
          const newToday = currentEntry.today 
            ? `${currentEntry.today}\n${formattedBullet}`
            : formattedBullet;
          nextStandup[action.memberId] = {
            ...currentEntry,
            today: newToday
          };
        }
      });

      return {
        ...prev,
        tasks: nextTasks,
        defects: nextDefects,
        standup: nextStandup
      };
    });

    const newIds = new Set(appliedActionIds);
    filteredActions.forEach(a => newIds.add(a.id));
    setAppliedActionIds(newIds);

    showNotification(`Successfully reconciled ${filteredActions.length} items between Standup and Dashboard!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Standup & Dashboard Reconciliation Center
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Cross-reference daily standup discussions with open dashboard work items & synchronize states
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="mx-5 mt-4 bg-[var(--primary-light)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
            <Check size={16} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="p-5 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search member, task or blocker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs font-semibold bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="all">All Action Types</option>
              <option value="mark_task_complete">Mark Complete</option>
              <option value="create_blocker_defect">Create Defect</option>
              <option value="push_task_to_today">Add to Today</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyAll}
              disabled={filteredActions.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles size={14} />
              <span>Apply All ({filteredActions.length})</span>
            </button>
          </div>
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {filteredActions.length === 0 ? (
            <div className="p-12 text-center bg-[var(--surface-hover)] rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center gap-3">
              <CheckCircle2 size={36} className="text-[var(--success)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Fully Reconciled & In-Sync</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md">
                No discrepancies found between today's standup call notes and open dashboard items. All finished deliverables, active commitments, and blockers match!
              </p>
            </div>
          ) : (
            filteredActions.map(action => (
              <div
                key={action.id}
                className="bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">
                    {action.type === 'mark_task_complete' ? (
                      <div className="w-8 h-8 rounded-lg bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center font-bold">
                        <CheckSquare size={16} />
                      </div>
                    ) : action.type === 'create_blocker_defect' ? (
                      <div className="w-8 h-8 rounded-lg bg-[var(--critical-light)] text-[var(--critical)] flex items-center justify-center font-bold">
                        <Bug size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
                        <Layers size={16} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {action.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                        {action.memberName}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {action.description}
                    </p>

                    <div className="mt-2 text-[11px] bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] font-mono truncate">
                      Source: "{action.sourceText}"
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleApplySingleAction(action)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--surface)] hover:bg-[var(--primary)] hover:text-white border border-[var(--border)] hover:border-[var(--primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
                  >
                    <span>{action.suggestedActionLabel}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Showing {filteredActions.length} actionable sync items
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
