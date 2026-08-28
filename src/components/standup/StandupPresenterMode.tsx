import React, { useState, useEffect } from 'react';
import { 
  TeamMember, 
  StandupEntry, 
  AppState 
} from '../../types';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Target, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  Check, 
  Maximize2, 
  Minimize2,
  Volume2,
  VolumeX,
  Shuffle,
  Calendar
} from 'lucide-react';
import { formatDisplayDate } from '../../utils/date';
import { standupAudio } from '../../utils/standupAudio';

interface StandupPresenterModeProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamMember[];
  standup: Record<string, StandupEntry>;
  activeMemberId: string;
  onSelectMember: (memberId: string) => void;
  onUpdateStandupEntry: (memberId: string, entry: StandupEntry) => void;
  dateStr: string;
  state: AppState;
}

export const StandupPresenterMode: React.FC<StandupPresenterModeProps> = ({
  isOpen,
  onClose,
  team,
  standup,
  activeMemberId,
  onSelectMember,
  onUpdateStandupEntry,
  dateStr,
  state
}) => {
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [totalTimerSeconds, setTotalTimerSeconds] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(standupAudio.getMuted());

  // Active member
  const currentIndex = team.findIndex(m => m.id === activeMemberId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const activeMember = team[safeIndex] || team[0];
  const nextMember = team[(safeIndex + 1) % team.length];

  const activeEntry: StandupEntry = standup[activeMember?.id || ''] || {
    yesterday: '',
    today: '',
    blockers: ''
  };

  // Sound effects & Timer loop
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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsTimerRunning(prev => !prev);
      } else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNextSpeaker();
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrevSpeaker();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetTimer(totalTimerSeconds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, team, totalTimerSeconds]);

  // Reset timer on speaker change
  const handleSelectMember = (memberId: string) => {
    onSelectMember(memberId);
    setTimerSeconds(totalTimerSeconds);
    setIsTimerRunning(true);
    standupAudio.play('next');
  };

  const handleNextSpeaker = () => {
    const nextIdx = (safeIndex + 1) % team.length;
    if (nextIdx === 0) {
      standupAudio.play('complete');
    } else {
      standupAudio.play('next');
    }
    onSelectMember(team[nextIdx].id);
    setTimerSeconds(totalTimerSeconds);
    setIsTimerRunning(true);
  };

  const handlePrevSpeaker = () => {
    const prevIdx = safeIndex === 0 ? team.length - 1 : safeIndex - 1;
    onSelectMember(team[prevIdx].id);
    setTimerSeconds(totalTimerSeconds);
    setIsTimerRunning(true);
    standupAudio.play('next');
  };

  const handleResetTimer = (seconds: number = 60) => {
    setTotalTimerSeconds(seconds);
    setTimerSeconds(seconds);
    setIsTimerRunning(true);
  };

  const handleToggleMute = () => {
    const nextMute = standupAudio.toggleMute();
    setIsMuted(nextMute);
  };

  if (!isOpen || !activeMember) return null;

  const timerPercent = Math.max(0, Math.min(100, (timerSeconds / totalTimerSeconds) * 100));
  const isTimeCritical = timerSeconds <= 10;
  const isTimeWarning = timerSeconds <= 20 && !isTimeCritical;

  return (
    <div 
      className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text-primary)] flex flex-col justify-between overflow-hidden animate-in fade-in duration-200"
      id="standup-presenter-mode-screen"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[var(--text-primary)]">Standup Room Presenter</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30">
                {formatDisplayDate(dateStr)}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Speaker {safeIndex + 1} of {team.length} ({Math.round(((safeIndex + 1) / team.length) * 100)}% progress)
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-3">
          {/* Audio Chime Mute Toggle */}
          <button
            onClick={handleToggleMute}
            className="p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer"
            title={isMuted ? 'Unmute Standup Chimes' : 'Mute Standup Chimes'}
          >
            {isMuted ? <VolumeX size={17} className="text-[var(--critical)]" /> : <Volume2 size={17} />}
          </button>

          {/* Timer Preset Dropdown */}
          <div className="flex items-center gap-1 bg-[var(--surface-hover)] border border-[var(--border)] p-1 rounded-xl">
            {[30, 60, 90].map((sec) => (
              <button
                key={sec}
                onClick={() => handleResetTimer(sec)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  totalTimerSeconds === sec
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Exit Presenter Mode */}
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[var(--surface-hover)] hover:bg-[var(--critical-bg)] text-[var(--text-muted)] hover:text-[var(--critical)] border border-[var(--border)] transition-all cursor-pointer"
            title="Exit Presenter Mode (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Speaker Canvas */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-6 flex flex-col justify-center gap-6 overflow-y-auto custom-scrollbar">
        {/* Speaker Profile Header & Large Timer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-[var(--surface)] border border-[var(--border)] p-6 rounded-3xl shadow-lg">
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-md transition-transform transform hover:scale-105"
              style={{ backgroundColor: activeMember.avatarColor || 'var(--primary)' }}
            >
              {activeMember.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                  {activeMember.name}
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30">
                  {activeMember.role}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                {activeMember.email} &bull; Next Up: <strong className="text-[var(--text-primary)]">{nextMember.name}</strong>
              </p>
            </div>
          </div>

          {/* Big Interactive Timer */}
          <div className="flex items-center gap-4 bg-[var(--bg-subtle)] border border-[var(--border)] px-6 py-3 rounded-2xl">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Remaining Time</span>
              <span className={`text-4xl font-mono font-black transition-colors ${
                isTimeCritical ? 'text-[var(--critical)] animate-pulse' : isTimeWarning ? 'text-amber-500' : 'text-[var(--text-primary)]'
              }`}>
                00:{String(timerSeconds).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`p-3 rounded-xl text-white font-bold transition-all shadow-xs cursor-pointer ${
                  isTimerRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
                }`}
                title={isTimerRunning ? 'Pause (Space)' : 'Resume (Space)'}
              >
                {isTimerRunning ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => handleResetTimer(totalTimerSeconds)}
                className="p-3 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] transition-colors cursor-pointer"
                title="Reset (R)"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-[var(--border)] h-2 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${
              isTimeCritical ? 'bg-[var(--critical)]' : isTimeWarning ? 'bg-amber-500' : 'bg-[var(--primary)]'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>

        {/* 3 Pillars Standup Content Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Yesterday */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-3 hover:border-[var(--primary)]/40 transition-all">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
              <CheckCircle2 size={18} className="text-[var(--primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">1. Accomplishments (Yesterday)</h3>
            </div>
            <div className="text-xs font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {activeEntry.yesterday ? (
                activeEntry.yesterday
              ) : (
                <span className="text-[var(--text-muted)] italic">No accomplishments logged yet.</span>
              )}
            </div>
          </div>

          {/* Today */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col gap-3 hover:border-[var(--primary)]/40 transition-all">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
              <Target size={18} className="text-[var(--info)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">2. Today's Commitments & Focus</h3>
            </div>
            <div className="text-xs font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {activeEntry.today ? (
                activeEntry.today
              ) : (
                <span className="text-[var(--text-muted)] italic">No commitments recorded yet.</span>
              )}
            </div>
          </div>

          {/* Blockers */}
          <div className={`rounded-2xl p-5 shadow-xs flex flex-col gap-3 transition-all ${
            activeEntry.blockers && activeEntry.blockers.toLowerCase() !== 'none'
              ? 'bg-[var(--critical-bg)] border border-[var(--critical-border)]'
              : 'bg-[var(--surface)] border border-[var(--border)]'
          }`}>
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
              <AlertTriangle size={18} className="text-[var(--critical)]" />
              <h3 className="text-sm font-bold text-[var(--critical)]">3. Blockers & Risks</h3>
            </div>
            <div className="text-xs font-medium leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {activeEntry.blockers ? (
                <span className={activeEntry.blockers.toLowerCase() !== 'none' ? 'text-[var(--critical)] font-bold' : 'text-[var(--text-muted)]'}>
                  {activeEntry.blockers}
                </span>
              ) : (
                <span className="text-[var(--text-muted)] italic">None reported.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Toolbar & Member Carousel */}
      <div className="bg-[var(--surface)] border-t border-[var(--border)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevSpeaker}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-hover)] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            title="Previous Speaker (P / Left Arrow)"
          >
            <ArrowLeft size={16} />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNextSpeaker}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer hover:scale-102"
            title="Next Speaker (N / Right Arrow)"
          >
            <span>Next Speaker</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Member Roster Carousel Pills */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 custom-scrollbar">
          {team.map((member, idx) => {
            const isSelected = member.id === activeMember.id;
            const entry = standup[member.id];
            const hasDone = Boolean(entry?.yesterday || entry?.today);

            return (
              <button
                key={member.id}
                onClick={() => handleSelectMember(member.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] font-bold shadow-xs'
                    : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: member.avatarColor || 'var(--primary)' }}
                >
                  {member.name[0]}
                </div>
                <span className="text-xs truncate max-w-[100px]">{member.name.split(' ')[0]}</span>
                {hasDone && (
                  <Check size={12} className="text-[var(--success)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Keyboard Hints */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-medium">
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] font-mono">Space</kbd> Pause/Play</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] font-mono">N</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] font-mono">Esc</kbd> Exit</span>
        </div>
      </div>
    </div>
  );
};
