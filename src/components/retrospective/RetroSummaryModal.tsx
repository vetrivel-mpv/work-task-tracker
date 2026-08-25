import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  FileText, 
  Code, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Lightbulb, 
  HeartHandshake,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RetroItem, RetroActionItem, RetroSession } from '../../types';
import { generateRetroSummary } from '../../services/aiService';

interface RetroSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: RetroSession;
  items: RetroItem[];
  actionItems: RetroActionItem[];
  projectName?: string;
  onAddActionItem?: (title: string, priority?: 'high' | 'medium' | 'low', assigneeName?: string) => void;
}

export const RetroSummaryModal: React.FC<RetroSummaryModalProps> = ({
  isOpen,
  onClose,
  session,
  items,
  actionItems,
  projectName = 'ACM (AT&T Connection Manager) Delivery',
  onAddActionItem
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown' | 'ai' | 'json'>('preview');
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const keepItems = items.filter(i => i.category === 'keep').sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const stopItems = items.filter(i => i.category === 'stop').sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const startItems = items.filter(i => i.category === 'start').sort((a, b) => (b.votes || 0) - (a.votes || 0));

  const totalVotes = items.reduce((acc, i) => acc + (i.votes || 0), 0);
  const sessionTitle = session?.title || 'Sprint Retrospective Summary';
  const sessionDate = session?.date || new Date().toISOString().split('T')[0];

  // Markdown Summary Generator
  const generateMarkdown = (): string => {
    let md = `# 🎯 Retrospective Summary: ${sessionTitle}\n\n`;
    md += `**Project:** ${projectName}  \n`;
    md += `**Date:** ${sessionDate}  \n`;
    md += `**Total Feedbacks:** ${items.length} | **Total Upvotes:** ${totalVotes}  \n\n`;

    md += `---\n\n`;

    md += `## 🟢 Keep (What went well & should continue)\n`;
    if (keepItems.length === 0) {
      md += `*No keep items recorded.*\n`;
    } else {
      keepItems.forEach(item => {
        md += `- **[+${item.votes || 0} votes]** ${item.text} ${item.isAnonymous ? '*(Anonymous)*' : `*(${item.authorName || 'Teammate'})*`}\n`;
      });
    }
    md += `\n`;

    md += `## 🔴 Stop (Blockers, pain points & friction)\n`;
    if (stopItems.length === 0) {
      md += `*No stop items recorded.*\n`;
    } else {
      stopItems.forEach(item => {
        md += `- **[+${item.votes || 0} votes]** ${item.text} ${item.isAnonymous ? '*(Anonymous)*' : `*(${item.authorName || 'Teammate'})*`}\n`;
      });
    }
    md += `\n`;

    md += `## 🔵 Start (New ideas & experiments to try)\n`;
    if (startItems.length === 0) {
      md += `*No start items recorded.*\n`;
    } else {
      startItems.forEach(item => {
        md += `- **[+${item.votes || 0} votes]** ${item.text} ${item.isAnonymous ? '*(Anonymous)*' : `*(${item.authorName || 'Teammate'})*`}\n`;
      });
    }
    md += `\n`;

    if (actionItems.length > 0) {
      md += `## 🚀 Action Items & Commitments\n`;
      md += `| Status | Priority | Action Item | Owner | Due Date |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      actionItems.forEach(action => {
        const statusEmoji = action.status === 'completed' ? '✅ Done' : action.status === 'in_progress' ? '🔄 In Progress' : '⏳ Open';
        md += `| ${statusEmoji} | ${(action.priority || 'medium').toUpperCase()} | ${action.title} | ${action.assigneeName || 'Unassigned'} | ${action.dueDate || 'Sprint End'} |\n`;
      });
      md += `\n`;
    }

    if (aiSummary) {
      md += `## 🤖 AI Retrospective Insights & Sentiment\n`;
      md += `> **Executive Summary:** ${aiSummary.executiveSummary}\n\n`;
      md += `**Morale Index:** ${aiSummary.moraleScore}/100 (${aiSummary.moraleHealthCategory})  \n`;
      md += `**Team Mantra:** *"${aiSummary.teamMantra}"*\n\n`;
    }

    return md;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunAiSynthesis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await generateRetroSummary(items, sessionTitle, {
        projectName,
        date: sessionDate,
        actionItemsCount: actionItems.length
      });

      if (res.ok && res.summary) {
        setAiSummary(res.summary);
      } else {
        setAiError(res.error || 'Failed to generate AI retrospective analysis.');
      }
    } catch (err: any) {
      setAiError(err.message || 'Error executing AI analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/70 backdrop-blur-sm overflow-y-auto">
      <div 
        id="retro-summary-modal-dialog"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Retrospective Summary & Export
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {sessionTitle} • {sessionDate} • {items.length} feedback items
              </p>
            </div>
          </div>

          <button
            id="retro-summary-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Action Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-zinc-100/50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              id="retro-tab-preview"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Summary View
            </button>
            <button
              id="retro-tab-ai"
              onClick={() => {
                setActiveTab('ai');
                if (!aiSummary && !aiLoading) handleRunAiSynthesis();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ai'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              AI Insights
            </button>
            <button
              id="retro-tab-markdown"
              onClick={() => setActiveTab('markdown')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'markdown'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Markdown (ADO / Jira / Wiki)
            </button>
            <button
              id="retro-tab-json"
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'json'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              JSON
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="retro-summary-copy-btn"
              onClick={() => handleCopy(activeTab === 'json' ? JSON.stringify({ session, items, actionItems, aiSummary }, null, 2) : generateMarkdown())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
            <button
              id="retro-summary-download-btn"
              onClick={() => {
                if (activeTab === 'json') {
                  handleDownload(
                    `retro-export-${sessionDate}.json`,
                    JSON.stringify({ session, items, actionItems, aiSummary }, null, 2),
                    'application/json'
                  );
                } else {
                  handleDownload(
                    `retro-summary-${sessionDate}.md`,
                    generateMarkdown(),
                    'text/markdown'
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Preview View */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Stat summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-xl p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Keep Items</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{keepItems.length}</div>
                  <div className="text-[11px] text-emerald-600/80 mt-0.5">{keepItems.reduce((a, b) => a + (b.votes || 0), 0)} upvotes</div>
                </div>

                <div className="rounded-xl p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-500/20">
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">Stop Items</div>
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{stopItems.length}</div>
                  <div className="text-[11px] text-rose-600/80 mt-0.5">{stopItems.reduce((a, b) => a + (b.votes || 0), 0)} upvotes</div>
                </div>

                <div className="rounded-xl p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-500/20">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">Start Items</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{startItems.length}</div>
                  <div className="text-[11px] text-blue-600/80 mt-0.5">{startItems.reduce((a, b) => a + (b.votes || 0), 0)} upvotes</div>
                </div>

                <div className="rounded-xl p-3.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-500/20">
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Action Items</div>
                  <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{actionItems.length}</div>
                  <div className="text-[11px] text-indigo-600/80 mt-0.5">
                    {actionItems.filter(a => a.status === 'completed').length} completed
                  </div>
                </div>
              </div>

              {/* Keep Column Breakdown */}
              <div className="rounded-xl border border-emerald-500/20 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-500/15">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    🟢 Keep ({keepItems.length})
                  </h3>
                  <span className="text-xs text-zinc-500">What went well & should continue</span>
                </div>
                <div className="space-y-2">
                  {keepItems.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No keep items recorded.</p>
                  ) : (
                    keepItems.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                        <span className="text-zinc-800 dark:text-zinc-200">{item.text}</span>
                        <span className="shrink-0 font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[11px]">
                          +{item.votes || 0}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stop Column Breakdown */}
              <div className="rounded-xl border border-rose-500/20 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rose-500/15">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    🔴 Stop ({stopItems.length})
                  </h3>
                  <span className="text-xs text-zinc-500">Blockers, friction & process debt</span>
                </div>
                <div className="space-y-2">
                  {stopItems.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No stop items recorded.</p>
                  ) : (
                    stopItems.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/10 border border-rose-500/10">
                        <span className="text-zinc-800 dark:text-zinc-200">{item.text}</span>
                        <span className="shrink-0 font-semibold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px]">
                          +{item.votes || 0}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Start Column Breakdown */}
              <div className="rounded-xl border border-blue-500/20 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-500/15">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    🔵 Start ({startItems.length})
                  </h3>
                  <span className="text-xs text-zinc-500">New initiatives, experiments & tooling</span>
                </div>
                <div className="space-y-2">
                  {startItems.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No start items recorded.</p>
                  ) : (
                    startItems.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-500/10">
                        <span className="text-zinc-800 dark:text-zinc-200">{item.text}</span>
                        <span className="shrink-0 font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[11px]">
                          +{item.votes || 0}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Items Table */}
              {actionItems.length > 0 && (
                <div className="rounded-xl border border-indigo-500/20 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-500/15">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      🚀 Action Commitments ({actionItems.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Priority</th>
                          <th className="pb-2 font-medium">Action Description</th>
                          <th className="pb-2 font-medium">Owner</th>
                          <th className="pb-2 font-medium">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {actionItems.map(a => (
                          <tr key={a.id} className="py-2">
                            <td className="py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                                a.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : a.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                  : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}>
                                {a.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2">
                              <span className={`font-semibold ${
                                a.priority === 'high' ? 'text-rose-600 dark:text-rose-400' : a.priority === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'
                              }`}>
                                {(a.priority || 'medium').toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 font-medium text-zinc-900 dark:text-zinc-100">{a.title}</td>
                            <td className="py-2 text-zinc-600 dark:text-zinc-400">{a.assigneeName || 'Unassigned'}</td>
                            <td className="py-2 text-zinc-500">{a.dueDate || 'Sprint End'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI Insights */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Synthesizing Retrospective with Gemini AI...
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                    Analyzing team feedback sentiment, clustering key themes, and generating actionable sprint commitments.
                  </p>
                </div>
              ) : aiError ? (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    AI Synthesis Error
                  </div>
                  <p>{aiError}</p>
                  <button
                    onClick={handleRunAiSynthesis}
                    className="mt-3 px-3 py-1 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-700"
                  >
                    Retry Synthesis
                  </button>
                </div>
              ) : aiSummary ? (
                <div className="space-y-5">
                  {/* Morale Banner */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xl">
                        {aiSummary.moraleScore}
                        <span className="text-xs opacity-75">/100</span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Team Morale & Velocity Health
                        </div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {aiSummary.moraleHealthCategory}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleRunAiSynthesis}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Re-Analyze
                    </button>
                  </div>

                  {/* Executive Summary */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Executive Summary
                    </h4>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                      {aiSummary.executiveSummary}
                    </p>
                  </div>

                  {/* Team Mantra */}
                  {aiSummary.teamMantra && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
                      <span className="font-bold mr-1.5">🌟 Team Sprint Mantra:</span>
                      <span className="italic font-medium">"{aiSummary.teamMantra}"</span>
                    </div>
                  )}

                  {/* Strengths and Risks 2-column */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20">
                      <div className="flex items-center gap-2 font-bold text-xs text-emerald-700 dark:text-emerald-300 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        Key Team Strengths & Wins
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {aiSummary.topStrengths?.map((s: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-500">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-500/20">
                      <div className="flex items-center gap-2 font-bold text-xs text-rose-700 dark:text-rose-300 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Critical Process Risks & Bottlenecks
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {aiSummary.criticalRisks?.map((r: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-rose-500">⚠</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* AI Recommended Actions */}
                  {aiSummary.recommendedActionItems && aiSummary.recommendedActionItems.length > 0 && (
                    <div className="p-4 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-indigo-700 dark:text-indigo-300">
                          <Lightbulb className="w-4 h-4" />
                          AI Suggested Action Commitments
                        </div>
                        <span className="text-[11px] text-zinc-500">Click '+ Add' to adopt</span>
                      </div>

                      <div className="space-y-2">
                        {aiSummary.recommendedActionItems.map((act: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 shadow-xs"
                          >
                            <div className="space-y-0.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                  {act.title}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-medium">
                                  {act.category || 'Process'}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {act.rationale || `Owner recommendation: ${act.suggestedRole}`}
                              </p>
                            </div>

                            {onAddActionItem && (
                              <button
                                onClick={() => {
                                  onAddActionItem(act.title, act.priority || 'high', act.suggestedRole);
                                  alert(`Action item "${act.title}" added to commitments!`);
                                }}
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                              >
                                <span>+ Adopt</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <button
                    onClick={handleRunAiSynthesis}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate AI Retrospective Synthesis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Markdown */}
          {activeTab === 'markdown' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Standard Markdown ready to paste into Azure DevOps Wiki, Jira, or Confluence:</span>
              </div>
              <textarea
                readOnly
                value={generateMarkdown()}
                rows={16}
                className="w-full font-mono text-xs p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}

          {/* TAB 4: JSON */}
          {activeTab === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Raw JSON payload:</span>
              </div>
              <textarea
                readOnly
                value={JSON.stringify({ session, items, actionItems, aiSummary }, null, 2)}
                rows={16}
                className="w-full font-mono text-xs p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
          <div className="text-xs text-zinc-500">
            Exported from <span className="font-semibold">{projectName}</span> Retrospective Board
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
