import React, { useState, useEffect } from 'react';
import { 
  TeamMember, 
  StandupEntry, 
  Task, 
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
  X
} from 'lucide-react';
import { generateStandupSummary } from '../../services/aiService';
import { buildStandupEmail } from '../../services/emailService';
import { formatDisplayDate, shiftDate } from '../../utils/date';

interface StandupViewProps {
  team: TeamMember[];
  standup: Record<string, StandupEntry>;
  tasks: Task[];
  dateStr: string;
  state: AppState;
  geminiApiKey?: string;
  onUpdateStandupEntry: (memberId: string, entry: StandupEntry) => void;
}

export const StandupView: React.FC<StandupViewProps> = ({
  team,
  standup,
  tasks,
  dateStr,
  state,
  geminiApiKey,
  onUpdateStandupEntry
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

  const activeMember = team.find(t => t.id === activeMemberId) || team[0];
  const activeEntry: StandupEntry = standup[activeMemberId] || {
    yesterday: '',
    today: '',
    blockers: ''
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

  const handleAutoFillFromTasks = () => {
    const yesterdayStr = shiftDate(dateStr, -1);
    const yesterdayDone = tasks.filter(
      t => t.dateStr === yesterdayStr && t.assigneeIds.includes(activeMemberId) && t.status === 'complete'
    );
    const todayAssigned = tasks.filter(
      t => t.dateStr === dateStr && t.assigneeIds.includes(activeMemberId)
    );

    const yesterdayText = yesterdayDone.map(t => t.title).join('; ') || activeEntry.yesterday;
    const todayText = todayAssigned.map(t => t.title).join('; ') || activeEntry.today;

    onUpdateStandupEntry(activeMemberId, {
      ...activeEntry,
      yesterday: yesterdayText,
      today: todayText
    });
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
      {/* Top Banner with Live Timer */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-pulse"></span>
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Interactive Standup Room</h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Daily sync for {formatDisplayDate(dateStr)} &bull; Track accomplishments, commitments & blockers
          </p>
        </div>

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

          <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto">
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
                      <span className="text-xs font-bold truncate">{member.name}</span>
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

        {/* Right: Active Teammate Standup Editor (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {activeMember && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                    style={{ backgroundColor: activeMember.avatarColor || 'var(--primary)' }}
                  >
                    {activeMember.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">{activeMember.name}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{activeMember.role} &bull; {activeMember.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleAutoFillFromTasks}
                  className="px-3 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--primary)] transition-colors cursor-pointer"
                  title="Import from board task history"
                >
                  ⚡ Autofill from Tasks
                </button>
              </div>

              {/* Yesterday Field */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  <CheckCircle2 size={15} className="text-[var(--primary)]" />
                  <span>1. Yesterday's Accomplishments</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What key code, reviews, QA runs, or deliverables were completed yesterday?"
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
                  placeholder="What are the top 2-3 goals for today?"
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
                  placeholder="Any roadblocks, waiting on client/API/reviews? (Or 'None')"
                  value={activeEntry.blockers}
                  onChange={(e) => handleFieldChange('blockers', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-[var(--surface-hover)] border border-[var(--critical-border)] rounded-xl outline-none focus:bg-[var(--surface)] focus:border-[var(--critical)] text-[var(--text-primary)] leading-relaxed"
                />
              </div>
            </div>
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
                  <p className="text-[11px] text-[var(--text-muted)]">Gemini 3.7 Flash powered synthesis for engineering leadership</p>
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
                Click <strong>"Synthesize Digest"</strong> to produce an executive briefing of today's standup entries.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

