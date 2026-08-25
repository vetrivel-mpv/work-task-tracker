import React, { useState, useEffect } from 'react';
import { 
  TeamMember, 
  StandupEntry, 
  Task, 
  UserStory,
  Defect,
  AppState 
} from '../../types';
import { 
  Users, 
  CheckCircle2, 
  Target, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  Copy, 
  Mail, 
  Check, 
  Clock,
  Search,
  X,
  Layers,
  ArrowRightLeft,
  RefreshCw
} from 'lucide-react';
import { generateStandupSummary } from '../../services/aiService';
import { buildStandupEmail } from '../../services/emailService';
import { formatDisplayDate, shiftDate } from '../../utils/date';
import { OpenDashboardItemsPanel } from './OpenDashboardItemsPanel';
import { StandupDiscussionSyncModal } from './StandupDiscussionSyncModal';
import { 
  getMemberDashboardItems, 
  generateStandupFromDashboard, 
  syncAllMembersStandupFromDashboard 
} from '../../utils/standupDashboardSync';

interface StandupViewProps {
  team: TeamMember[];
  standup: Record<string, StandupEntry>;
  tasks: Task[];
  dateStr: string;
  state: AppState;
  geminiApiKey?: string;
  onUpdateStandupEntry: (memberId: string, entry: StandupEntry) => void;
  onUpdateTask?: (task: Task) => void;
  onUpdateDefect?: (defect: Defect) => void;
  onUpdateStory?: (story: UserStory) => void;
  onAddDefect?: (defect: Partial<Defect>) => void;
  onUpdateState?: (updater: (prev: AppState) => AppState) => void;
}

export const StandupView: React.FC<StandupViewProps> = ({
  team,
  standup,
  tasks,
  dateStr,
  state,
  geminiApiKey,
  onUpdateStandupEntry,
  onUpdateTask,
  onUpdateDefect,
  onUpdateStory,
  onAddDefect,
  onUpdateState
}) => {
  const [activeMemberId, setActiveMemberId] = useState<string>(team[0]?.id || '');
  
  // Timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // AI Summary state
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [copiedMd, setCopiedMd] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState<boolean>(false);
  const [bannerToast, setBannerToast] = useState<string | null>(null);

  const activeMember = team.find(t => t.id === activeMemberId) || team[0];
  const activeEntry: StandupEntry = standup[activeMemberId] || {
    yesterday: '',
    today: '',
    blockers: ''
  };

  const showBannerToast = (msg: string) => {
    setBannerToast(msg);
    setTimeout(() => setBannerToast(null), 3000);
  };

  // Timer interval effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const handleTimerToggle = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleTimerReset = (seconds: number = 60) => {
    setIsTimerRunning(false);
    setTimerSeconds(seconds);
  };

  const handleFieldChange = (field: keyof StandupEntry, value: string) => {
    onUpdateStandupEntry(activeMemberId, {
      ...activeEntry,
      [field]: value
    });
  };

  // Auto-sync active member from dashboard open items
  const handleAutoFillFromDashboard = () => {
    const generated = generateStandupFromDashboard(activeMemberId, state, activeEntry);
    onUpdateStandupEntry(activeMemberId, generated);
    showBannerToast(`Auto-synced ${activeMember.name}'s standup with open dashboard items!`);
  };

  // Bulk sync entire team roster from open dashboard items
  const handleBulkSyncAllTeam = () => {
    if (onUpdateState) {
      onUpdateState(prev => ({
        ...prev,
        standup: syncAllMembersStandupFromDashboard(prev)
      }));
    } else {
      const nextStandup = syncAllMembersStandupFromDashboard(state);
      Object.entries(nextStandup).forEach(([mId, entry]) => {
        onUpdateStandupEntry(mId, entry);
      });
    }
    showBannerToast(`Successfully synchronized standup entries for all ${team.length} team members!`);
  };

  const handleRunAiSummary = async () => {
    setAiLoading(true);
    setAiSummary('');
    const res = await generateStandupSummary(standup, team, dateStr, geminiApiKey);
    setAiLoading(false);
    if (res.ok && res.text) {
      setAiSummary(res.text);
    } else {
      setAiSummary(`⚠️ Could not generate summary: ${res.error}`);
    }
  };

  const { markdown, html, mailtoUrl } = buildStandupEmail(state);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(aiSummary || markdown);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner with Live Timer & Global Sync Controls */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-pulse"></span>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Interactive Standup Room</h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Daily sync for {formatDisplayDate(dateStr)} &bull; Bi-directional synchronization with open Dashboard items
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleBulkSyncAllTeam}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--primary-light)] hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white border border-[var(--primary)]/30 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Import all open tasks, stories & defects into today's standup notes for everyone"
          >
            <RefreshCw size={14} />
            <span>Sync All Members with Open Items</span>
          </button>

          <button
            onClick={() => setIsReconciliationModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
            title="Reconcile standup call discussion notes with open board items"
          >
            <ArrowRightLeft size={14} />
            <span>Reconcile Board</span>
          </button>

          {/* Live Speaker Timer */}
          <div className="flex items-center gap-3 bg-[var(--surface-hover)] border border-[var(--border)] px-4 py-2 rounded-xl">
            <Clock size={16} className="text-[var(--primary)]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Speaker Time</span>
              <span className={`text-sm font-mono font-bold ${timerSeconds <= 10 ? 'text-[var(--critical)]' : 'text-[var(--text-primary)]'}`}>
                00:{String(timerSeconds).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={handleTimerToggle}
                className={`p-1.5 rounded-lg text-white font-bold transition-all cursor-pointer ${
                  isTimerRunning ? 'bg-[var(--medium)]' : 'bg-[var(--primary)]'
                }`}
                title={isTimerRunning ? 'Pause' : 'Start'}
              >
                {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={() => handleTimerReset(60)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                title="Reset 60s"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Toast */}
      {bannerToast && (
        <div className="bg-[var(--primary-light)] border border-[var(--primary)] text-[var(--primary)] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>{bannerToast}</span>
          </div>
        </div>
      )}

      {/* Main Grid: Roster Selector & Standup Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Team Roster (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <span className="text-xs font-bold text-[var(--text-primary)]">Team Roster</span>
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              {Object.values(standup).filter(s => s.yesterday || s.today).length}/{team.length} Ready
            </span>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search roster..."
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface)] transition-all font-medium"
            />
            {memberSearch && (
              <button
                type="button"
                onClick={() => setMemberSearch('')}
                className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5 max-h-[580px] overflow-y-auto pr-0.5">
            {team
              .filter(m => {
                if (!memberSearch.trim()) return true;
                const q = memberSearch.toLowerCase().trim();
                return m.name.toLowerCase().includes(q) || (m.role && m.role.toLowerCase().includes(q));
              })
              .map(member => {
              const entry = standup[member.id];
              const isFilled = Boolean(entry && (entry.yesterday || entry.today));
              const hasBlockers = Boolean(entry?.blockers && entry.blockers.toLowerCase() !== 'none');
              const isSelected = member.id === activeMemberId;
              const memberDashboard = getMemberDashboardItems(member.id, state);

              return (
                <button
                  key={member.id}
                  onClick={() => {
                    setActiveMemberId(member.id);
                    handleTimerReset(60);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] shadow-xs'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs flex-shrink-0"
                      style={{ backgroundColor: member.avatarColor || 'var(--primary)' }}
                    >
                      {member.name[0]}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{member.name}</span>
                        {memberDashboard.totalOpenCount > 0 && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                            {memberDashboard.totalOpenCount} open
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] text-[var(--text-muted)] truncate">{member.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {hasBlockers && (
                      <span className="w-2 h-2 rounded-full bg-[var(--critical)]" title="Active Blocker Reported"></span>
                    )}
                    {isFilled ? (
                      <CheckCircle2 size={15} className="text-[var(--primary)]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[var(--border)]"></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Teammate Standup Editor & Open Items Panel (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {activeMember && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                    style={{ backgroundColor: activeMember.avatarColor || 'var(--primary)' }}
                  >
                    {activeMember.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[var(--text-primary)]">{activeMember.name}</h2>
                      {activeEntry.syncedWithDashboardAt && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/20">
                          Synced with Dashboard
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{activeMember.role} &bull; {activeMember.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoFillFromDashboard}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-light)] hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white border border-[var(--primary)]/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Import open tasks, active stories & defects directly into standup"
                  >
                    <Sparkles size={13} />
                    <span>Auto-Sync from Dashboard</span>
                  </button>
                </div>
              </div>

              {/* Yesterday Field */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  <CheckCircle2 size={15} className="text-[var(--primary)]" />
                  <span>1. Yesterday's Accomplishments</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What key code, reviews, QA runs, or deliverables were completed yesterday? (Or click '+ Done' from Open Dashboard Items below)"
                  value={activeEntry.yesterday}
                  onChange={(e) => handleFieldChange('yesterday', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] text-[var(--text-primary)] leading-relaxed"
                />
              </div>

              {/* Today Field */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  <Target size={15} className="text-[var(--info)]" />
                  <span>2. Today's Commitments & Focus</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What are the top sprint deliverables & goals for today? (Or click '+ Focus' from Open Dashboard Items below)"
                  value={activeEntry.today}
                  onChange={(e) => handleFieldChange('today', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] text-[var(--text-primary)] leading-relaxed"
                />
              </div>

              {/* Blockers Field */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[var(--critical)] mb-1.5">
                  <AlertTriangle size={15} />
                  <span>3. Blockers, Risks, or Dependencies</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Any roadblocks, dependencies, waiting on reviews/APIs? (Or 'None')"
                  value={activeEntry.blockers}
                  onChange={(e) => handleFieldChange('blockers', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-[var(--surface-hover)] border border-[var(--critical-border)] rounded-xl outline-none focus:bg-[var(--surface)] focus:border-[var(--critical)] text-[var(--text-primary)] leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Open Dashboard Items Live Hub */}
          {activeMember && (
            <OpenDashboardItemsPanel
              member={activeMember}
              state={state}
              activeEntry={activeEntry}
              onUpdateStandupEntry={(entry) => onUpdateStandupEntry(activeMemberId, entry)}
              onUpdateTask={onUpdateTask}
              onUpdateDefect={onUpdateDefect}
              onUpdateStory={onUpdateStory}
              onAddDefect={onAddDefect}
              onOpenReconciliationModal={() => setIsReconciliationModalOpen(true)}
              onBulkSyncAll={handleBulkSyncAllTeam}
            />
          )}

          {/* AI Executive Digest & Broadcast Panel */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Executive Standup Digest</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Gemini 3.7 Flash powered synthesis connecting standup discussion to sprint delivery</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAiSummary}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>{aiLoading ? 'Generating…' : 'Synthesize Digest'}</span>
                </button>

                <button
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl transition-colors cursor-pointer"
                  title="Copy as Markdown"
                >
                  {copiedMd ? <Check size={14} className="text-[var(--primary)]" /> : <Copy size={14} />}
                  <span>{copiedMd ? 'Copied' : 'Copy MD'}</span>
                </button>

                <a
                  href={mailtoUrl}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all"
                >
                  <Mail size={14} />
                  <span>Open Mail Client</span>
                </a>
              </div>
            </div>

            {aiSummary ? (
              <div className="prose prose-sm max-w-none text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap bg-[var(--surface-hover)] p-4 rounded-xl border border-[var(--border)]">
                {aiSummary}
              </div>
            ) : (
              <div className="p-4 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-center text-xs text-[var(--text-muted)]">
                Click <strong>"Synthesize Digest"</strong> to produce an executive briefing of today's standup entries and linked sprint delivery items.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Standup & Dashboard Reconciliation Modal */}
      {onUpdateState && (
        <StandupDiscussionSyncModal
          isOpen={isReconciliationModalOpen}
          onClose={() => setIsReconciliationModalOpen(false)}
          state={state}
          onUpdateState={onUpdateState}
        />
      )}
    </div>
  );
};
