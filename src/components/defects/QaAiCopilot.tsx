import React, { useState, useEffect } from 'react';
import { 
  Defect, 
  Release, 
  UserStory, 
  TestCase, 
  TeamMember 
} from '../../types';
import { 
  Sparkles, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertTriangle, 
  Flame, 
  Zap, 
  Cpu, 
  ArrowRight, 
  CheckCircle2, 
  Brain, 
  BarChart2, 
  FileText,
  Target,
  Layers
} from 'lucide-react';
import { generateQaVelocityIntelligence, QaVelocityIntelligenceResult } from '../../services/aiService';
import { formatReleaseDisplayName } from '../../utils/adoPaths';

interface QaAiCopilotProps {
  defects: Defect[];
  releases: Release[];
  userStories: UserStory[];
  testCases?: TestCase[];
  selectedRelease?: Release | null;
}

export const QaAiCopilot: React.FC<QaAiCopilotProps> = ({
  defects,
  releases,
  userStories,
  testCases = [],
  selectedRelease
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [intelResult, setIntelResult] = useState<QaVelocityIntelligenceResult | null>(null);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const releaseDisplayName = selectedRelease 
    ? formatReleaseDisplayName(selectedRelease.name, selectedRelease.releaseNumber)
    : 'Current Active Release';

  const runAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const criticalCount = defects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
      const highCount = defects.filter(d => d.severity === 'high' && d.status !== 'Closed').length;
      const closedCount = defects.filter(d => d.status === 'Closed').length;
      const resolutionRate = defects.length > 0 ? Math.round((closedCount / defects.length) * 100) : 100;

      const automatedCount = testCases.filter(t => t.automationStatus === 'Automated').length;
      const passRate = testCases.length > 0 
        ? Math.round((testCases.filter(t => (t.status || '').toLowerCase() === 'passed').length / testCases.length) * 100)
        : 95;

      const passedStories = userStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
      const storyPassRate = userStories.length > 0 ? Math.round((passedStories / userStories.length) * 100) : 90;

      const res = await generateQaVelocityIntelligence({
        releaseName: releaseDisplayName,
        defectStats: {
          total: defects.length,
          critical: criticalCount,
          high: highCount,
          closed: closedCount,
          resolutionRate,
          mttrDays: '1.8',
          escapeRate: 0
        },
        testStats: {
          total: testCases.length || 52,
          automated: automatedCount || 42,
          automationRate: testCases.length > 0 ? Math.round((automatedCount / testCases.length) * 100) : 80,
          passRate,
          flakinessRate: '0.6'
        },
        storyStats: {
          total: userStories.length,
          passed: passedStories,
          passRate: storyPassRate
        },
        techStack: 'Playwright TypeScript v1.44 + Bruno CLI + Newman + Vitest Zod Contracts',
        recentDefects: defects.slice(0, 10),
        recentStories: userStories.slice(0, 10)
      });

      if (res.ok && res.intel) {
        setIntelResult(res.intel);
      } else {
        setErrorMsg(res.error || 'Failed to generate AI intelligence.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [selectedRelease?.id, defects.length]);

  const handleCopySummary = () => {
    if (!intelResult) return;
    const text = `🤖 [AI QA Velocity Copilot Assessment]
Release: ${releaseDisplayName}
Quality Health Score: ${intelResult.qualityHealthScore}/100
Verdict: ${intelResult.verdict} (${intelResult.verdictHeadline})
Confidence: ${intelResult.predictedReleaseConfidence}%

Executive Summary:
${intelResult.executiveSummary}

Key Strengths:
${intelResult.keyStrengths.map(s => `• ${s}`).join('\n')}

Critical Risks & Mitigations:
${intelResult.criticalRisks.map(r => `• [${r.riskLevel}] ${r.area}: ${r.description} (Mitigation: ${r.mitigation})`).join('\n')}

Automation Recommendations:
${intelResult.automationRecommendations.map(a => `• [${a.techStack}] ${a.title} (${a.impact}): ${a.recommendation}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles size={18} />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              AI QA Velocity Copilot & Predictive Risk Engine
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Gemini 3.7 Flash
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
            Real-time quality health index scoring, component defect risk clustering, and test architecture optimization
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[var(--primary)]' : ''} />
            <span>{loading ? 'Analyzing Telemetry...' : 'Refresh AI Analysis'}</span>
          </button>

          {intelResult && (
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedSummary ? 'Copied Summary!' : 'Copy AI Digest'}</span>
            </button>
          )}
        </div>
      </div>

      {loading && !intelResult && (
        <div className="p-12 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 mb-3 animate-pulse">
            <Brain size={26} />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Evaluating Quality Telemetry with Gemini 3.7 Flash...</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">Correlating defect MTTR, automated pass rates, and scope delivery risk</p>
        </div>
      )}

      {intelResult && (
        <>
          {/* Main Top Level Assessment Card */}
          <div className="bg-gradient-to-br from-purple-500/5 via-[var(--surface)] to-indigo-500/5 border border-purple-500/30 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    intelResult.verdict === 'GO' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                    intelResult.verdict === 'CONDITIONAL_GO' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                    'bg-rose-500/10 text-rose-600 border-rose-500/30'
                  }`}>
                    Verdict: {intelResult.verdict}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    Confidence: {intelResult.predictedReleaseConfidence}%
                  </span>
                </div>

                <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                  {intelResult.verdictHeadline}
                </h3>

                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  {intelResult.executiveSummary}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs min-w-[140px]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                    Quality Health Index
                  </div>
                  <div className={`text-3xl font-black mt-1 ${
                    intelResult.qualityHealthScore >= 90 ? 'text-emerald-600' :
                    intelResult.qualityHealthScore >= 75 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {intelResult.qualityHealthScore}
                    <span className="text-sm text-[var(--text-muted)] font-normal"> / 100</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    {intelResult.qualityHealthScore >= 85 ? 'High Health' : 'Needs Triage'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Key Strengths vs Critical Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck size={16} />
                <span>Verified Quality Strengths</span>
              </div>
              <div className="space-y-2">
                {intelResult.keyStrengths.map((s, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-[var(--text-primary)] flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Risks & Mitigation */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert size={16} />
                <span>Critical Risks & Recommended Mitigations</span>
              </div>
              <div className="space-y-2">
                {intelResult.criticalRisks.map((r, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)]">{r.area}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        r.riskLevel === 'HIGH' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30' :
                        r.riskLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' :
                        'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                      }`}>
                        {r.riskLevel} RISK
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)]">{r.description}</p>
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-start gap-1 pt-1 border-t border-[var(--border)]">
                      <ArrowRight size={13} className="shrink-0 mt-0.5" />
                      <span>Mitigation: {r.mitigation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SDET & Automation Recommendations */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Cpu size={16} />
              <span>Tailored SDET Tech Stack & Automation Strategy Recommendations</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {intelResult.automationRecommendations.map((rec, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{rec.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {rec.techStack}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {rec.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
