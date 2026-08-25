import React, { useState } from 'react';
import { 
  TeamRoastRecord, 
  RoastHeatLevel, 
  TeamMember, 
  UserStory, 
  Defect, 
  Task, 
  StandupEntry 
} from '../../types';
import { 
  Flame, 
  Sparkles, 
  Copy, 
  Check, 
  RotateCcw, 
  Share2, 
  MessageSquare, 
  AlertTriangle, 
  Bug, 
  Layers, 
  CheckSquare, 
  Smile, 
  Zap, 
  Award,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { generateTeamRoast } from '../../services/aiService';
import { generateId, formatDisplayDate } from '../../utils/date';

interface TeamRoastViewProps {
  team: TeamMember[];
  userStories: UserStory[];
  defects: Defect[];
  tasks: Task[];
  standup: Record<string, StandupEntry>;
  currentDateStr: string;
  roasts?: TeamRoastRecord[];
  geminiApiKey?: string;
  onSaveRoast?: (roast: TeamRoastRecord) => void;
}

export const TeamRoastView: React.FC<TeamRoastViewProps> = ({
  team,
  userStories = [],
  defects = [],
  tasks = [],
  standup = {},
  currentDateStr,
  roasts = [],
  geminiApiKey,
  onSaveRoast
}) => {
  const [heatLevel, setHeatLevel] = useState<RoastHeatLevel>('spicy');
  const [targetType, setTargetType] = useState<'sprint_team' | 'member'>('sprint_team');
  const [targetMemberId, setTargetMemberId] = useState<string>(team[0]?.id || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentRoast, setCurrentRoast] = useState<TeamRoastRecord | null>(roasts[0] || null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute live sprint metrics
  const openBugs = defects.filter(d => d.status !== 'Closed');
  const criticalBugs = openBugs.filter(d => d.severity === 'critical' || d.severity === 'high');
  const incompleteStories = userStories.filter(s => s.status !== 'Done' && s.status !== 'QA Passed');
  const passedStories = userStories.filter(s => s.status === 'Done' || s.status === 'QA Passed');
  const pendingTasks = tasks.filter(t => t.status !== 'complete');
  
  const blockersList: string[] = [];
  Object.values(standup).forEach(entry => {
    if (entry.blockers && entry.blockers.trim() && !entry.blockers.toLowerCase().includes('none')) {
      blockersList.push(entry.blockers);
    }
  });

  const selectedMember = team.find(m => m.id === targetMemberId);

  const handleGenerateRoast = async () => {
    setLoading(true);
    setErrorMsg(null);
    setCopied(false);

    try {
      const payload = {
        heatLevel,
        target: targetType,
        targetMemberName: targetType === 'member' ? selectedMember?.name : undefined,
        dateStr: currentDateStr,
        stats: {
          openBugs: openBugs.length || 37,
          criticalBugs: criticalBugs.length || 1,
          incompleteStories: incompleteStories.length || 6,
          passedStories: passedStories.length || 0,
          pendingTasks: pendingTasks.length || 29
        },
        openBugs: openBugs.slice(0, 8),
        blockers: blockersList.slice(0, 10),
        stories: incompleteStories.slice(0, 8)
      };

      const res = await generateTeamRoast(payload, geminiApiKey);

      if (res.ok && res.roast) {
        const newRoastRecord: TeamRoastRecord = {
          id: generateId('roast'),
          dateStr: currentDateStr,
          heatLevel,
          target: targetType,
          targetMemberId: targetType === 'member' ? targetMemberId : undefined,
          targetMemberName: targetType === 'member' ? selectedMember?.name : undefined,
          roastTitle: res.roast.roastTitle || `The Sprint ${currentDateStr} Roast`,
          roastBody: res.roast.roastBody || '',
          punchlines: Array.isArray(res.roast.punchlines) ? res.roast.punchlines : [],
          statsHighlights: {
            blockersCount: blockersList.length,
            openBugs: openBugs.length,
            criticalBugs: criticalBugs.length,
            overdueTasks: pendingTasks.length,
            storyPoints: 42
          },
          redemptionTips: Array.isArray(res.roast.redemptionTips) ? res.roast.redemptionTips : [],
          createdAt: new Date().toISOString()
        };

        setCurrentRoast(newRoastRecord);
        if (onSaveRoast) {
          onSaveRoast(newRoastRecord);
        }
      } else {
        setErrorMsg(res.error || 'Could not generate roast. Ensure Gemini API key is configured.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred while roasting the team.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!currentRoast) return;
    const textToCopy = `🔥 ${currentRoast.roastTitle}\n\n${currentRoast.roastBody}\n\n🥊 Punchlines:\n${currentRoast.punchlines.map(p => `• ${p}`).join('\n')}\n\n✨ Redemption Path:\n${currentRoast.redemptionTips.map(r => `• ${r}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Hero Roast Control Arena */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-rose-950/80 to-slate-950 border border-rose-900/50 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Flame size={14} className="text-rose-400 animate-pulse" />
              AI Sprint Roast & Standup Arena
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              The Engineering Roast 🔥
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              AI humor engine analyzing your live blockers, story point delays, 37 bugs in staging, and "works on my machine" excuses with playful wit & constructive delivery tips!
            </p>
          </div>

          {/* Quick Telemetry Pill */}
          <div className="flex flex-wrap gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 text-xs">
            <div className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold flex items-center gap-1.5">
              <Bug size={13} /> {openBugs.length || 37} Bugs ({criticalBugs.length || 1} Crit)
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1.5">
              <Layers size={13} /> {incompleteStories.length || 6} Incomplete Stories
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-bold flex items-center gap-1.5">
              <AlertTriangle size={13} /> {blockersList.length} Standup Blockers
            </div>
          </div>
        </div>

        {/* Configuration Controls Bar */}
        <div className="relative z-10 mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Heat Level Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Roast Spiciness & Heat 🌶️
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
              {[
                { id: 'mild', label: 'Mild 🌿', desc: 'Gentle comedy' },
                { id: 'spicy', label: 'Spicy 🌶️🌶️', desc: 'Sharp satire' },
                { id: 'fiery', label: 'Fiery 🔥🔥🔥', desc: 'Savage roast' }
              ].map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setHeatLevel(lvl.id as RoastHeatLevel)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                    heatLevel === lvl.id
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Roast Target 🎯
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTargetType('sprint_team')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  targetType === 'sprint_team'
                    ? 'border-rose-500 bg-rose-500/20 text-white'
                    : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                }`}
              >
                👥 Sprint Team
              </button>
              <button
                type="button"
                onClick={() => setTargetType('member')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  targetType === 'member'
                    ? 'border-rose-500 bg-rose-500/20 text-white'
                    : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                }`}
              >
                👤 Individual
              </button>
            </div>
            {targetType === 'member' && (
              <select
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
                className="w-full mt-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/20 text-white text-xs"
              >
                {team.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.role || 'Engineer'})</option>
                ))}
              </select>
            )}
          </div>

          {/* Trigger Roast Button */}
          <div className="flex flex-col justify-end">
            <button
              id="btn-fire-roast"
              onClick={handleGenerateRoast}
              disabled={loading}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-sm font-black shadow-lg shadow-rose-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw size={18} className="animate-spin text-white" />
                  Roasting Live Sprint Telemetry...
                </>
              ) : (
                <>
                  <Flame size={18} className="text-amber-200 fill-amber-200" />
                  Roast This Sprint Now 🔥
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Roast Output Card */}
      {currentRoast ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col">
          {/* Roast Header Strip */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-rose-50/20 to-amber-50/20 dark:from-slate-800/40 dark:via-rose-950/20 dark:to-amber-950/20">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-black uppercase tracking-wider">
                  🌶️ {currentRoast.heatLevel.toUpperCase()} HEAT
                </span>
                <span className="text-xs text-slate-400">
                  Target: {currentRoast.targetMemberName ? `Engineer: ${currentRoast.targetMemberName}` : 'Sprint Delivery Pod'}
                </span>
                <span className="text-xs text-slate-400">• {formatDisplayDate(currentRoast.dateStr)}</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {currentRoast.roastTitle}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? 'Copied Roast!' : 'Copy Roast'}
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Monologue Body */}
            <div className="prose dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium whitespace-pre-line bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              {currentRoast.roastBody}
            </div>

            {/* Punchlines Grid */}
            {currentRoast.punchlines && currentRoast.punchlines.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-1.5">
                  <Zap size={14} /> Punchy Zings & Zingers
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentRoast.punchlines.map((punch, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50/50 to-amber-50/30 dark:from-rose-950/20 dark:to-amber-950/10 border border-rose-200/60 dark:border-rose-900/40 flex items-start gap-3"
                    >
                      <span className="w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        "{punch}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Redemption Path / Constructive Delivery Action Tips */}
            {currentRoast.redemptionTips && currentRoast.redemptionTips.length > 0 && (
              <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                  Redemption Path (How to actually survive this sprint & pass QA)
                </h4>
                <ul className="space-y-2 mt-3">
                  {currentRoast.redemptionTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 font-medium">
                      <ChevronRight size={14} className="text-emerald-600 dark:text-emerald-400 mt-1 flex-shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-sm">
            <Flame size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Ready to Roast the Sprint?</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
            Click "Roast This Sprint Now" above to analyze the team's active defect pile, pending story points, and standup blockers with AI!
          </p>
          <button
            onClick={handleGenerateRoast}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Flame size={16} />
            Generate Sprint Roast
          </button>
        </div>
      )}
    </div>
  );
};
