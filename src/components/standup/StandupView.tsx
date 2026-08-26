import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
  Maximize2,
  Volume2,
  VolumeX,
  Shuffle,
  Calendar,
  MessageSquare,
  FileText,
  Send,
  UserX,
  UserCheck,
  ChevronRight,
  ArrowRight,
  Flame,
  Download,
  Share2
} from 'lucide-react';
import { generateStandupSummary } from '../../services/aiService';
import { buildStandupEmail } from '../../services/emailService';
import { formatDisplayDate, shiftDate } from '../../utils/date';
import { OpenDashboardItemsPanel } from './OpenDashboardItemsPanel';
import { StandupDiscussionSyncModal } from './StandupDiscussionSyncModal';
import { StandupPresenterMode } from './StandupPresenterMode';
import { StandupParkingLot } from './StandupParkingLot';
import { standupAudio } from '../../utils/standupAudio';
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

type StandupTab = 'notes' | 'dashboard_items' | 'parking_lot' | 'ai_digest';
type RosterFilter = 'all' | 'ready' | 'pending' | 'blockers';

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
  // Speaker order state (allows randomizing/shuffling)
  const [rosterOrder, setRosterOrder] = useState<string[]>(() => team.map(m => m.id));

  // Sync rosterOrder if team changes
  useEffect(() => {
    setRosterOrder(prev => {
      const currentIds = team.map(m => m.id);
      const existing = prev.filter(id => currentIds.includes(id));
      const newlyAdded = currentIds.filter(id => !existing.includes(id));
      return [...existing, ...newlyAdded];
    });
  }, [team]);

  const [activeMemberId, setActiveMemberId] = useState<string>(team[0]?.id || '');
  const [activeTab, setActiveTab] = useState<StandupTab>('notes');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');
  const [memberSearch, setMemberSearch] = useState<string>('');

  // Presenter full-screen mode
  const [isPresenterOpen, setIsPresenterOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(standupAudio.getMuted());

  // Absent / OOO tracking
  const [absentMemberIds, setAbsentMemberIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`northstar_standup_ooo_${dateStr}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleAbsent = (memberId: string) => {
    setAbsentMemberIds(prev => {
      const next = prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId];
      try {
        localStorage.setItem(`northstar_standup_ooo_${dateStr}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Timer state
  const [totalTimerSeconds, setTotalTimerSeconds] = useState<number>(60);
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // AI Summary state
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [copiedMd, setCopiedMd] = useState<boolean>(false);
  const [copiedSlack, setCopiedSlack] = useState<boolean>(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState<boolean>(false);
  const [bannerToast, setBannerToast] = useState<string | null>(null);

  // Re-ordered team according to active roster order
  const orderedTeam = useMemo(() => {
    const map = new Map(team.map(m => [m.id, m]));
    const result: TeamMember[] = [];
    rosterOrder.forEach(id => {
      const member = map.get(id);
      if (member) result.push(member);
    });
    // Add any remaining
    team.forEach(m => {
      if (!result.some(r => r.id === m.id)) result.push(m);
    });
    return result;
  }, [team, rosterOrder]);

  const activeMember = orderedTeam.find(t => t.id === activeMemberId) || orderedTeam[0];
  const activeIndex = orderedTeam.findIndex(t => t.id === activeMemberId);

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
        setTimerSeconds(prev => {
          if (prev === 11) {
            standupAudio.play('warning');
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      standupAudio.play('timeUp');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const handleTimerToggle = () => {
    if (!isTimerRunning && timerSeconds === 0) {
      setTimerSeconds(totalTimerSeconds);
    }
    setIsTimerRunning(!isTimerRunning);
  };

  const handleTimerReset = (seconds: number = totalTimerSeconds) => {
    setIsTimerRunning(false);
    setTotalTimerSeconds(seconds);
    setTimerSeconds(seconds);
  };

  const handleToggleMute = () => {
    const nextMute = standupAudio.toggleMute();
    setIsMuted(nextMute);
  };

  const handleNextSpeaker = () => {
    const nextIdx = (activeIndex + 1) % orderedTeam.length;
    setActiveMemberId(orderedTeam[nextIdx].id);
    handleTimerReset(totalTimerSeconds);
    setIsTimerRunning(true);
    if (nextIdx === 0) {
      standupAudio.play('complete');
      showBannerToast('🎉 All team members have completed their standup turn!');
    } else {
      standupAudio.play('next');
    }
  };

  const handleShuffleRoster = () => {
    const shuffled = [...team.map(m => m.id)].sort(() => Math.random() - 0.5);
    setRosterOrder(shuffled);
    setActiveMemberId(shuffled[0]);
    handleTimerReset(totalTimerSeconds);
    standupAudio.play('start');
    showBannerToast('🎲 Shuffled speaker roster order for today!');
  };

  const handleFieldChange = (field: keyof StandupEntry, value: string) => {
    onUpdateStandupEntry(activeMemberId, {
      ...activeEntry,
      [field]: value
    });
  };

  // Quick insertion tags for fast updates
  const handleInsertTag = (field: 'yesterday' | 'today' | 'blockers', tag: string) => {
    const current = (activeEntry[field] || '').trim();
    let updated: string;
    if (!current || current.toLowerCase() === 'none') {
      updated = `• ${tag}: `;
    } else {
      updated = `${current}\n• ${tag}: `;
    }
    handleFieldChange(field, updated);
    standupAudio.play('click');
  };

  // Auto-sync active member from dashboard open items
  const handleAutoFillFromDashboard = () => {
    const generated = generateStandupFromDashboard(activeMemberId, state, activeEntry);
    onUpdateStandupEntry(activeMemberId, generated);
    standupAudio.play('click');
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
    standupAudio.play('start');
    showBannerToast(`Successfully synchronized standup entries for all ${team.length} team members!`);
  };

  const handleRunAiSummary = async () => {
    setAiLoading(true);
    setAiSummary('');
    const res = await generateStandupSummary(standup, team, dateStr, geminiApiKey);
    setAiLoading(false);
    if (res.ok && res.text) {
      setAiSummary(res.text);
      standupAudio.play('complete');
    } else {
      setAiSummary(`⚠️ Could not generate summary: ${res.error}`);
    }
  };

  const { markdown, html, mailtoUrl } = buildStandupEmail(state);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(aiSummary || markdown);
    setCopiedMd(true);
    standupAudio.play('click');
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopySlackFormatted = () => {
    let slackText = `*🚀 Daily Standup Digest - ${formatDisplayDate(dateStr)}*\n\n`;
    orderedTeam.forEach(member => {
      const entry = standup[member.id];
      if (entry && (entry.yesterday || entry.today)) {
        slackText += `*${member.name}* (${member.role})\n`;
        if (entry.yesterday) slackText += `• *Yesterday:* ${entry.yesterday.replace(/\n/g, ' ')}\n`;
        if (entry.today) slackText += `• *Today:* ${entry.today.replace(/\n/g, ' ')}\n`;
        if (entry.blockers && entry.blockers.toLowerCase() !== 'none') {
          slackText += `• *🚨 Blocker:* ${entry.blockers.replace(/\n/g, ' ')}\n`;
        }
        slackText += '\n';
      }
    });
    navigator.clipboard.writeText(slackText);
    setCopiedSlack(true);
    standupAudio.play('click');
    setTimeout(() => setCopiedSlack(false), 2000);
  };

  const handleDownloadTranscript = () => {
    let transcript = `DAILY STANDUP TRANSCRIPT - ${formatDisplayDate(dateStr)}\n`;
    transcript += `========================================================\n\n`;
    orderedTeam.forEach(member => {
      const entry = standup[member.id];
      transcript += `TEAM MEMBER: ${member.name} (${member.role})\n`;
      transcript += `1. Yesterday's Accomplishments:\n${entry?.yesterday || 'None recorded'}\n\n`;
      transcript += `2. Today's Commitments & Focus:\n${entry?.today || 'None recorded'}\n\n`;
      transcript += `3. Blockers / Dependencies:\n${entry?.blockers || 'None'}\n`;
      transcript += `--------------------------------------------------------\n\n`;
    });

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Standup_Transcript_${dateStr}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Completion metrics
  const nonAbsentTeam = orderedTeam.filter(m => !absentMemberIds.includes(m.id));
  const completedCount = nonAbsentTeam.filter(m => {
    const entry = standup[m.id];
    return Boolean(entry && (entry.yesterday || entry.today));
  }).length;
  const progressPercent = nonAbsentTeam.length > 0 ? Math.round((completedCount / nonAbsentTeam.length) * 100) : 0;
  const totalBlockersCount = orderedTeam.filter(m => {
    const entry = standup[m.id];
    return entry?.blockers && entry.blockers.toLowerCase() !== 'none';
  }).length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner with Pulse, Live Speaker Controls & Fullscreen Presenter Launcher */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-[var(--primary)] animate-pulse shadow-xs"></span>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Interactive Standup Room
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30">
              {formatDisplayDate(dateStr)}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
            {completedCount} of {nonAbsentTeam.length} updates logged ({progressPercent}%) &bull; {totalBlockersCount > 0 ? <span className="text-[var(--critical)] font-bold">{totalBlockersCount} blockers active</span> : 'No blockers'} &bull; Bi-directional sync with Live Board
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Fullscreen Presenter Mode Button */}
          <button
            onClick={() => {
              setIsPresenterOpen(true);
              standupAudio.play('start');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-102 active:scale-98"
            id="launch-standup-presenter-btn"
            title="Launch high-visibility Standup Presenter for screen sharing"
          >
            <Maximize2 size={14} />
            <span>Presenter Mode</span>
          </button>

          {/* Shuffle Roster Order Button */}
          <button
            onClick={handleShuffleRoster}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
            title="Randomize speaker order for an engaging standup ritual"
          >
            <Shuffle size={14} className="text-amber-500" />
            <span className="hidden sm:inline">Shuffle</span>
          </button>

          {/* Sound Chimes Mute Toggle */}
          <button
            onClick={handleToggleMute}
            className="p-2 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title={isMuted ? 'Unmute standup chimes' : 'Mute standup chimes'}
          >
            {isMuted ? <VolumeX size={16} className="text-[var(--critical)]" /> : <Volume2 size={16} />}
          </button>

          {/* Bi-directional Board Sync */}
          <button
            onClick={() => setIsReconciliationModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer"
            title="Reconcile standup call discussion notes with open board items"
          >
            <ArrowRightLeft size={14} />
            <span className="hidden md:inline">Reconcile Board</span>
          </button>

          {/* Speaker Timer Widget */}
          <div className="flex items-center gap-2.5 bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-1.5 rounded-xl">
            <Clock size={15} className="text-[var(--primary)]" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Timer</span>
              <span className={`text-xs font-mono font-bold ${timerSeconds <= 10 ? 'text-[var(--critical)] animate-pulse' : 'text-[var(--text-primary)]'}`}>
                00:{String(timerSeconds).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={handleTimerToggle}
                className={`p-1 rounded-lg text-white font-bold transition-all cursor-pointer ${
                  isTimerRunning ? 'bg-amber-600' : 'bg-[var(--primary)]'
                }`}
                title={isTimerRunning ? 'Pause' : 'Start'}
              >
                {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button
                onClick={() => handleTimerReset(60)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                title="Reset 60s"
              >
                <RotateCcw size={12} />
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
          <button onClick={() => setBannerToast(null)} className="text-[var(--primary)] hover:opacity-70 p-0.5 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Grid: Team Roster (4 cols) & Workspace (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Team Roster & Turn Tracker (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[var(--primary)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Speaker Roster</span>
            </div>
            <span className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-full border border-[var(--primary)]/30">
              {progressPercent}% Complete
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[var(--primary)] h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Search & Filter Chips */}
          <div className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search teammates..."
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

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[10px] font-bold">
              <button
                onClick={() => setRosterFilter('all')}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                  rosterFilter === 'all'
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                }`}
              >
                All ({orderedTeam.length})
              </button>
              <button
                onClick={() => setRosterFilter('ready')}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                  rosterFilter === 'ready'
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                }`}
              >
                Done ({completedCount})
              </button>
              <button
                onClick={() => setRosterFilter('pending')}
                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                  rosterFilter === 'pending'
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                }`}
              >
                Pending ({nonAbsentTeam.length - completedCount})
              </button>
              {totalBlockersCount > 0 && (
                <button
                  onClick={() => setRosterFilter('blockers')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                    rosterFilter === 'blockers'
                      ? 'bg-[var(--critical)] text-white border-[var(--critical)]'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                  }`}
                >
                  Blockers ({totalBlockersCount})
                </button>
              )}
            </div>
          </div>

          {/* Teammate List */}
          <div className="flex flex-col gap-1.5 max-h-[560px] overflow-y-auto pr-0.5 custom-scrollbar">
            {orderedTeam
              .filter(m => {
                if (memberSearch.trim()) {
                  const q = memberSearch.toLowerCase().trim();
                  if (!m.name.toLowerCase().includes(q) && !(m.role && m.role.toLowerCase().includes(q))) {
                    return false;
                  }
                }
                const entry = standup[m.id];
                const isFilled = Boolean(entry && (entry.yesterday || entry.today));
                const hasBlockers = Boolean(entry?.blockers && entry.blockers.toLowerCase() !== 'none');

                if (rosterFilter === 'ready') return isFilled;
                if (rosterFilter === 'pending') return !isFilled && !absentMemberIds.includes(m.id);
                if (rosterFilter === 'blockers') return hasBlockers;
                return true;
              })
              .map((member, idx) => {
                const entry = standup[member.id];
                const isFilled = Boolean(entry && (entry.yesterday || entry.today));
                const hasBlockers = Boolean(entry?.blockers && entry.blockers.toLowerCase() !== 'none');
                const isSelected = member.id === activeMemberId;
                const isAbsent = absentMemberIds.includes(member.id);
                const memberDashboard = getMemberDashboardItems(member.id, state);

                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]/30'
                        : isAbsent
                        ? 'bg-[var(--bg-subtle)] border-[var(--border)] opacity-60'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveMemberId(member.id);
                        handleTimerReset(totalTimerSeconds);
                        standupAudio.play('click');
                      }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs flex-shrink-0"
                        style={{ backgroundColor: member.avatarColor || 'var(--primary)' }}
                      >
                        {member.name[0]}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${isAbsent ? 'line-through text-[var(--text-muted)]' : ''}`}>
                            {member.name}
                          </span>
                          {memberDashboard.totalOpenCount > 0 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                              {memberDashboard.totalOpenCount} open
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] text-[var(--text-muted)] truncate">
                          {isAbsent ? 'Out of Office' : member.role}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasBlockers && (
                        <span className="w-2 h-2 rounded-full bg-[var(--critical)]" title="Active Blocker Reported"></span>
                      )}
                      
                      {isFilled ? (
                        <CheckCircle2 size={15} className="text-[var(--primary)]" />
                      ) : isAbsent ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-muted)]">
                          OOO
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[var(--border)]"></span>
                      )}

                      {/* Quick OOO toggle */}
                      <button
                        onClick={() => toggleAbsent(member.id)}
                        className={`p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer`}
                        title={isAbsent ? 'Mark Present' : 'Mark Out of Office (OOO)'}
                      >
                        {isAbsent ? <UserCheck size={13} className="text-[var(--success)]" /> : <UserX size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Quick Roster Bulk Sync Action */}
          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
            <button
              onClick={handleBulkSyncAllTeam}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--primary-light)] hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white border border-[var(--primary)]/30 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Import all open tasks, stories & defects for everyone in one click"
            >
              <RefreshCw size={13} />
              <span>Bulk Sync All Teammates</span>
            </button>
          </div>
        </div>

        {/* Right Column: Standup Workspace (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Workspace Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--border)] pb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setActiveTab('notes')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
              >
                <FileText size={14} />
                <span>Standup Updates</span>
              </button>

              <button
                onClick={() => setActiveTab('dashboard_items')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard_items'
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
              >
                <Layers size={14} />
                <span>Live Open Deliverables</span>
              </button>

              <button
                onClick={() => setActiveTab('parking_lot')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'parking_lot'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
              >
                <MessageSquare size={14} />
                <span>16th-Min Parking Lot</span>
              </button>

              <button
                onClick={() => setActiveTab('ai_digest')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ai_digest'
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
              >
                <Sparkles size={14} />
                <span>AI Standup Digest</span>
              </button>
            </div>

            {/* Advance Speaker Action */}
            <button
              onClick={handleNextSpeaker}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all shadow-xs cursor-pointer"
              title="Save and advance to next speaker"
            >
              <span>Next Speaker</span>
              <ArrowRight size={13} className="text-[var(--primary)]" />
            </button>
          </div>

          {/* TAB 1: STANDUP UPDATES EDITOR */}
          {activeTab === 'notes' && activeMember && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
              {/* Speaker Profile Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                    style={{ backgroundColor: activeMember.avatarColor || 'var(--primary)' }}
                  >
                    {activeMember.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-[var(--text-primary)]">{activeMember.name}</h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]">
                        {activeMember.role}
                      </span>
                      {activeEntry.syncedWithDashboardAt && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/20">
                          Synced with Dashboard
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{activeMember.email}</p>
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

              {/* Quick Template Chips Toolbar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium custom-scrollbar">
                <span className="text-xs font-bold text-[var(--text-muted)] shrink-0 mr-1">Quick Tag:</span>
                <button
                  type="button"
                  onClick={() => handleInsertTag('yesterday', 'Merged PR')}
                  className="px-2 py-1 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
                >
                  🚀 Merged PR
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTag('yesterday', 'QA Verification Passed')}
                  className="px-2 py-1 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
                >
                  🧪 QA Passed
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTag('today', 'Sprint Task Backlog')}
                  className="px-2 py-1 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
                >
                  ⚙️ Backlog Feature
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTag('today', 'Code Review & PRs')}
                  className="px-2 py-1 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
                >
                  📝 Code Review
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTag('blockers', 'Waiting on API Backend / Dependency')}
                  className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 transition-all cursor-pointer shrink-0"
                >
                  🚨 Blocked by API
                </button>
              </div>

              {/* Yesterday Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <CheckCircle2 size={15} className="text-[var(--primary)]" />
                    <span>1. Yesterday's Accomplishments</span>
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">Completed deliverables & reviews</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="What key code, reviews, QA runs, or deliverables were completed yesterday? (e.g. • Completed user authentication flow)"
                  value={activeEntry.yesterday}
                  onChange={(e) => handleFieldChange('yesterday', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] text-[var(--text-primary)] leading-relaxed"
                />
              </div>

              {/* Today Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <Target size={15} className="text-[var(--info)]" />
                    <span>2. Today's Commitments & Focus</span>
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">Top sprint goals & tasks</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="What are the top sprint deliverables & commitments for today? (e.g. • Finish defect #412 validation)"
                  value={activeEntry.today}
                  onChange={(e) => handleFieldChange('today', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] text-[var(--text-primary)] leading-relaxed"
                />
              </div>

              {/* Blockers Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--critical)]">
                    <AlertTriangle size={15} />
                    <span>3. Blockers, Risks, or Dependencies</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('blockers', 'None')}
                    className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer"
                  >
                    Set to "None"
                  </button>
                </div>
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

          {/* TAB 2: LIVE OPEN DELIVERABLES PANEL */}
          {activeTab === 'dashboard_items' && activeMember && (
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

          {/* TAB 3: 16TH-MIN PARKING LOT */}
          {activeTab === 'parking_lot' && (
            <StandupParkingLot
              team={team}
              dateStr={dateStr}
            />
          )}

          {/* TAB 4: AI STANDUP DIGEST & BROADCAST */}
          {activeTab === 'ai_digest' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold shadow-xs">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">AI Executive Standup Digest</h3>
                    <p className="text-xs text-[var(--text-muted)]">Gemini 3.7 Flash powered synthesis connecting standup discussion to sprint delivery</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleRunAiSummary}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>{aiLoading ? 'Generating…' : 'Synthesize Digest'}</span>
                  </button>

                  <button
                    onClick={handleCopySlackFormatted}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl transition-colors cursor-pointer"
                    title="Copy formatted for Slack/Teams"
                  >
                    {copiedSlack ? <Check size={14} className="text-[var(--primary)]" /> : <Copy size={14} />}
                    <span>{copiedSlack ? 'Copied' : 'Slack / Teams'}</span>
                  </button>

                  <button
                    onClick={handleCopyMarkdown}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl transition-colors cursor-pointer"
                    title="Copy as Markdown"
                  >
                    {copiedMd ? <Check size={14} className="text-[var(--primary)]" /> : <Copy size={14} />}
                    <span>{copiedMd ? 'Copied' : 'Markdown'}</span>
                  </button>

                  <button
                    onClick={handleDownloadTranscript}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl transition-colors cursor-pointer"
                    title="Download Text Transcript"
                  >
                    <Download size={14} />
                    <span>Transcript</span>
                  </button>

                  <a
                    href={mailtoUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all"
                  >
                    <Mail size={14} />
                    <span>Email Broadcast</span>
                  </a>
                </div>
              </div>

              {aiSummary ? (
                <div className="prose prose-sm max-w-none text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap bg-[var(--surface-hover)] p-5 rounded-2xl border border-[var(--border)]">
                  {aiSummary}
                </div>
              ) : (
                <div className="p-8 bg-[var(--bg-subtle)] border border-dashed border-[var(--border)] rounded-2xl text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                  <Sparkles size={24} className="text-[var(--primary)] opacity-60" />
                  <p>
                    Click <strong>"Synthesize Digest"</strong> to generate an executive briefing of today's standup entries, blockers, and linked sprint deliverables.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Standup Presenter Full-Screen Mode */}
      <StandupPresenterMode
        isOpen={isPresenterOpen}
        onClose={() => setIsPresenterOpen(false)}
        team={orderedTeam}
        standup={standup}
        activeMemberId={activeMemberId}
        onSelectMember={(mId) => {
          setActiveMemberId(mId);
          handleTimerReset(totalTimerSeconds);
        }}
        onUpdateStandupEntry={onUpdateStandupEntry}
        dateStr={dateStr}
        state={state}
      />

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
