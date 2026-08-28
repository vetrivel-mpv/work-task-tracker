import React, { useState } from 'react';
import { 
  UserStory, 
  Defect, 
  Task, 
  TestCase, 
  Release,
  DuplicateTicketMatch, 
  DuplicateAnalysisReport 
} from '../../types';
import { 
  Sparkles, 
  AlertTriangle, 
  Copy, 
  Check, 
  RotateCcw, 
  X, 
  Layers, 
  Bug, 
  CheckSquare, 
  ArrowRight, 
  CheckCircle2, 
  ShieldAlert, 
  GitMerge, 
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import { analyzeDuplicateTickets } from '../../services/aiService';

interface AiDuplicateScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userStories: UserStory[];
  defects: Defect[];
  tasks: Task[];
  testCases?: TestCase[];
  releases?: Release[];
  selectedReleaseId?: string | null;
  geminiApiKey?: string;
  onResolveDuplicate?: (match: DuplicateTicketMatch, action: string) => void;
}

export const AiDuplicateScannerModal: React.FC<AiDuplicateScannerModalProps> = ({
  isOpen,
  onClose,
  userStories = [],
  defects = [],
  tasks = [],
  testCases = [],
  geminiApiKey,
  onResolveDuplicate
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<DuplicateAnalysisReport | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [resolvedIds, setResolvedIds] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunScan = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await analyzeDuplicateTickets(userStories, defects, tasks, testCases, geminiApiKey);
      if (res.ok) {
        setReport({
          timestamp: res.timestamp || new Date().toISOString(),
          scannedCount: {
            stories: userStories.length,
            defects: defects.length,
            tasks: tasks.length,
            testCases: testCases.length,
            total: userStories.length + defects.length + tasks.length + testCases.length
          },
          duplicatesFound: res.duplicatesFound || 0,
          matches: (res.matches || []) as DuplicateTicketMatch[],
          summary: res.summary || 'Scan complete.'
        });
      } else {
        setErrorMsg(res.error || 'Failed to analyze tickets. Check Gemini API key configuration.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while communicating with the AI service.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (match: DuplicateTicketMatch, action: string) => {
    setResolvedIds(prev => ({ ...prev, [match.id]: action }));
    if (onResolveDuplicate) {
      onResolveDuplicate(match, action);
    }
  };

  const filteredMatches = (report?.matches || []).filter(match => {
    if (filterType === 'defects') return match.ticketA.type === 'defect' || match.ticketB.type === 'defect';
    if (filterType === 'stories') return match.ticketA.type === 'story' || match.ticketB.type === 'story';
    if (filterType === 'tasks') return match.ticketA.type === 'task' || match.ticketB.type === 'task';
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'defect':
        return <Bug size={14} className="text-rose-500" />;
      case 'story':
        return <Layers size={14} className="text-amber-500" />;
      case 'task':
      default:
        return <CheckSquare size={14} className="text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-rose-50/50 via-slate-50 to-blue-50/50 dark:from-rose-950/20 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  AI Duplicate Ticket & Overlap Analyzer
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[10px] font-black uppercase">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Semantic analysis scanning User Stories, Defects, and Tasks to catch redundant tickets & identical bugs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action / Scan Strip */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold">Inventory:</span>
            <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
              {userStories.length} Stories
            </span>
            <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-rose-600 dark:text-rose-400">
              {defects.length} Defects
            </span>
            <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-blue-600 dark:text-blue-400">
              {tasks.length} Tasks
            </span>
          </div>

          <div className="flex items-center gap-3">
            {report && (
              <div className="flex items-center gap-1.5">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Types</option>
                  <option value="defects">Defects Only</option>
                  <option value="stories">Stories Only</option>
                  <option value="tasks">Tasks Only</option>
                </select>
              </div>
            )}

            <button
              id="btn-trigger-duplicate-scan"
              onClick={handleRunScan}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw size={14} className="animate-spin" />
                  Analyzing Tickets with AI...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {report ? 'Re-Scan Backlog' : 'Start AI Duplicate Scan'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-3">
              <AlertTriangle size={18} className="text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!report && !loading && (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <Sparkles size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Prevent Duplicate Ticket Creation
              </h4>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-6 leading-relaxed">
                Gemini AI will cross-reference all tickets in your backlog, analyzing descriptions, titles, and steps to reproduce to detect duplicate bug reports and overlapping features.
              </p>
              <button
                onClick={handleRunScan}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-500/20 transition-all"
              >
                Run AI Duplicate Analysis
              </button>
            </div>
          )}

          {loading && (
            <div className="p-16 text-center flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-rose-200 dark:border-rose-900 border-t-rose-600 animate-spin" />
                <Sparkles size={20} className="absolute inset-0 m-auto text-rose-600 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cross-referencing {userStories.length + defects.length + tasks.length} work items...
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Comparing stack traces, defect symptoms, acceptance criteria, and semantic similarities
                </p>
              </div>
            </div>
          )}

          {report && !loading && (
            <>
              {/* Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Scan Summary</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      report.duplicatesFound > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {report.duplicatesFound} Potential Overlaps Found
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {report.summary}
                  </p>
                </div>
              </div>

              {/* Duplicate Match Cards */}
              {filteredMatches.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={28} className="text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">No Duplicates Detected</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    All scanned work items have unique scopes and distinct technical requirements.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMatches.map(match => {
                    const isResolved = Boolean(resolvedIds[match.id]);
                    const resolutionAction = resolvedIds[match.id];

                    return (
                      <div 
                        key={match.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          isResolved 
                            ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60' 
                            : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60 shadow-sm'
                        }`}
                      >
                        {/* Match Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-xs font-black flex items-center gap-1.5">
                              <ShieldAlert size={14} />
                              {match.confidenceScore}% Duplicate Match
                            </div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              {match.matchType.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {isResolved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                              <Check size={14} /> Resolved: {resolutionAction}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAction(match, 'Marked as Duplicate')}
                                className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all"
                              >
                                Close Ticket B as Duplicate
                              </button>
                              <button
                                onClick={() => handleAction(match, 'Merged Notes')}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                              >
                                Merge Scopes
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Side-by-Side Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Ticket A */}
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-bold text-slate-400 flex items-center gap-1">
                                {getTypeIcon(match.ticketA.type)} Primary Item
                              </span>
                              <span className="font-bold text-slate-600 dark:text-slate-300">
                                {match.ticketA.adoId ? `#${match.ticketA.adoId}` : match.ticketA.id}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                              {match.ticketA.title}
                            </h5>
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 font-medium">
                                {match.ticketA.status}
                              </span>
                              {match.ticketA.assigneeName && (
                                <span>👤 {match.ticketA.assigneeName}</span>
                              )}
                            </div>
                          </div>

                          {/* Ticket B */}
                          <div className="p-3.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                {getTypeIcon(match.ticketB.type)} Duplicate Candidate
                              </span>
                              <span className="font-bold text-slate-600 dark:text-slate-300">
                                {match.ticketB.adoId ? `#${match.ticketB.adoId}` : match.ticketB.id}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                              {match.ticketB.title}
                            </h5>
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 font-medium">
                                {match.ticketB.status}
                              </span>
                              {match.ticketB.assigneeName && (
                                <span>👤 {match.ticketB.assigneeName}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* AI Reason */}
                        <div className="mt-3.5 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50">
                          <p className="text-xs text-amber-900 dark:text-amber-200">
                            <span className="font-bold">AI Analysis:</span> {match.reason}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Powered by Gemini AI Semantic Work Item Triaging
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
