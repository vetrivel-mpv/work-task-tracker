import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  X,
  Copy,
  Check,
  Send,
  Sparkles,
  Calendar,
  Shield,
  Zap,
  Users,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Clock,
  Settings,
  ChevronDown,
  Layers,
  CheckCircle2,
  ExternalLink,
  Sliders,
  BellRing,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { AppState, EmailTemplateType, EmailScheduleConfig, EmailDispatchLog } from '../../types';
import {
  generateEmailByType,
  copyHtmlAsRichText,
  EmailRenderOutput
} from '../../services/emailService';
import {
  generateSystemTestingDailyReport,
  SystemTestingAiReport
} from '../../services/aiService';
import { formatDisplayDate } from '../../utils/date';
import { formatReleaseDisplayName } from '../../utils/adoPaths';

interface EmailAutomationHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  initialTemplate?: EmailTemplateType;
  initialDefectId?: string;
  initialReleaseId?: string;
  onUpdateState?: (updater: (prev: AppState) => AppState) => void;
}

export const EmailAutomationHubModal: React.FC<EmailAutomationHubModalProps> = ({
  isOpen,
  onClose,
  state,
  initialTemplate = 'system_testing_daily',
  initialDefectId,
  initialReleaseId,
  onUpdateState
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>(initialTemplate);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>(initialReleaseId || state.selectedReleaseId || state.releases[0]?.id || '');
  const [selectedDefectId, setSelectedDefectId] = useState<string>(initialDefectId || state.defects[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown' | 'schedules' | 'logs'>('preview');

  // Generated email bundle
  const [emailData, setEmailData] = useState<EmailRenderOutput>(() =>
    generateEmailByType(initialTemplate, state, {
      releaseId: initialReleaseId || state.selectedReleaseId || undefined,
      defectId: initialDefectId
    })
  );

  // Recipient inputs
  const [recipients, setRecipients] = useState<string>('');
  const [ccRecipients, setCcRecipients] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');

  // AI Polisher & Auto-Drafter
  const [aiTone, setAiTone] = useState<'executive' | 'urgent' | 'casual' | 'formal'>('executive');
  const [isAiPolishing, setIsAiPolishing] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [aiHighlights, setAiHighlights] = useState<string[]>([]);
  const [aiDraftVerdict, setAiDraftVerdict] = useState<string | null>(null);
  const [aiDraftMetrics, setAiDraftMetrics] = useState<SystemTestingAiReport['metrics'] | null>(null);
  const [aiDraftModel, setAiDraftModel] = useState<string | null>(null);

  // Dispatch & Action state
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [copiedRich, setCopiedRich] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  // Auto-Draft Trigger
  const handleAutoDraft = useCallback(async (targetRelId?: string) => {
    setIsAiDrafting(true);
    const effectiveRelId = targetRelId || selectedReleaseId || state.selectedReleaseId || state.releases[0]?.id;
    try {
      const response = await generateSystemTestingDailyReport(
        state,
        effectiveRelId,
        undefined,
        aiTone,
        state.settings?.geminiApiKey
      );
      if (response.ok && response.report) {
        const rep = response.report;
        setEmailData({
          subject: rep.subject,
          markdown: rep.markdown,
          html: rep.html || generateEmailByType('system_testing_daily', state, { releaseId: effectiveRelId }).html,
          mailtoUrl: `mailto:${[state.settings.qaTeamEmail, state.settings.emailRecipient, state.settings.releaseManagerEmail].filter(Boolean).join(',')}?subject=${encodeURIComponent(rep.subject)}&body=${encodeURIComponent(rep.markdown)}`,
          suggestedRecipients: [
            state.settings.qaTeamEmail,
            state.settings.emailRecipient,
            state.settings.releaseManagerEmail
          ].filter(Boolean) as string[]
        });
        setCustomSubject(rep.subject);
        setRecipients(
          [state.settings.qaTeamEmail, state.settings.emailRecipient, state.settings.releaseManagerEmail]
            .filter(Boolean)
            .join(', ') || state.settings.emailRecipient || ''
        );
        setAiHighlights(rep.keyHighlights || []);
        setAiDraftVerdict(rep.overallVerdict || null);
        setAiDraftMetrics(rep.metrics || null);
        setAiDraftModel(response.model || 'Gemini 3.7 Flash');
      }
    } catch (e: any) {
      console.warn('[AutoDraft] Error during Gemini report generation:', e);
    } finally {
      setIsAiDrafting(false);
    }
  }, [state, selectedReleaseId, aiTone]);

  useEffect(() => {
    if (isOpen && initialTemplate === 'system_testing_daily') {
      handleAutoDraft(initialReleaseId);
    }
  }, [isOpen]);

  // Automation Schedules State
  const [schedules, setSchedules] = useState<EmailScheduleConfig[]>(() => state.settings.emailSchedules || [
    {
      id: 'sched-standup-daily',
      templateType: 'daily_standup',
      title: 'Daily Standup Digest & Blocker Alert',
      frequency: 'daily',
      targetDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timeStr: '17:00',
      recipients: [state.settings.emailRecipient || 'engineering-leads@careflow.io'],
      enabled: true,
      includeAiSummary: true
    },
    {
      id: 'sched-system-testing-daily',
      templateType: 'system_testing_daily',
      title: 'System Testing Daily Progress (Stories & Release)',
      frequency: 'daily',
      targetDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timeStr: '17:30',
      recipients: [state.settings.qaTeamEmail || 'qa-leads@careflow.io', state.settings.emailRecipient || 'engineering-leads@careflow.io'],
      enabled: true,
      includeAiSummary: false
    },
    {
      id: 'sched-dev-to-dev-int',
      templateType: 'dev_to_dev_integration',
      title: 'Dev-to-Dev Component Integration Testing Report',
      frequency: 'daily',
      targetDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timeStr: '16:30',
      recipients: [state.settings.devLeadEmail || state.settings.emailRecipient || 'dev-leads@careflow.io', state.settings.managerEmail || 'engineering-managers@careflow.io'],
      enabled: true,
      includeAiSummary: false
    },
    {
      id: 'sched-qa-gate',
      templateType: 'qa_gate',
      title: 'QA Health & Test Sanity Gate Report',
      frequency: 'daily',
      targetDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timeStr: '18:00',
      recipients: [state.settings.qaTeamEmail || 'qa-leads@careflow.io'],
      enabled: true,
      includeAiSummary: false
    },
    {
      id: 'sched-resource-weekly',
      templateType: 'resource_capacity',
      title: 'Weekly Capacity & Allocation Runway',
      frequency: 'weekly',
      targetDays: ['Mon'],
      timeStr: '09:00',
      recipients: [state.settings.managerEmail || 'engineering-managers@careflow.io'],
      enabled: true,
      includeAiSummary: true
    }
  ]);

  const [dispatchLogs, setDispatchLogs] = useState<EmailDispatchLog[]>(state.settings.emailLogs || []);

  // Sync template generation whenever parameters change
  useEffect(() => {
    const rendered = generateEmailByType(selectedTemplate, state, {
      releaseId: selectedReleaseId || undefined,
      defectId: selectedDefectId || undefined
    });
    setEmailData(rendered);
    setCustomSubject(rendered.subject);
    setRecipients(rendered.suggestedRecipients.join(', ') || state.settings.emailRecipient || '');
    setAiHighlights([]);
  }, [selectedTemplate, selectedReleaseId, selectedDefectId, state]);

  if (!isOpen) return null;

  const templatesList: { type: EmailTemplateType; title: string; desc: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    {
      type: 'client_qa_status',
      title: 'Client QA Status & Blockers',
      desc: 'Client-facing report: story-by-story blockers, delivery readiness & where we stand',
      icon: ShieldAlert
    },
    {
      type: 'daily_standup',
      title: 'Daily Standup Digest',
      desc: 'Member check-ins, tasks done %, blockers & OOO leaves',
      icon: Calendar
    },
    {
      type: 'system_testing_daily',
      title: 'System Testing Daily Report',
      desc: 'Story-wise test execution %, defect blockers & daily release progress',
      icon: CheckCircle2
    },
    {
      type: 'dev_to_dev_integration',
      title: 'Dev-to-Dev Integration Testing',
      desc: 'Cross-component API contracts, microservice interfaces & QA handover',
      icon: Layers
    },
    {
      type: 'qa_gate',
      title: 'QA Quality Gate Report',
      desc: 'Story QA Pass Rate %, open bug counts & critical defect callouts',
      icon: Shield
    },
    {
      type: 'executive_pulse',
      title: 'Executive Delivery Pulse',
      desc: 'Macro progress, burn-up velocity & active release pipelines',
      icon: Zap
    },
    {
      type: 'resource_capacity',
      title: 'Weekly Resource Capacity',
      desc: 'Net capacity, PTO deductions, planned tasks & team headroom',
      icon: Users
    },
    {
      type: 'defect_escalation',
      title: 'Critical Defect Escalation (P0)',
      desc: 'Immediate incident broadcast, RCA logs & SLA countdown',
      icon: AlertTriangle
    },
    {
      type: 'release_signoff',
      title: 'Release Go/No-Go Sign-Off',
      desc: 'Formal deployment checklist, QA clearance & rollback contacts',
      icon: FileCheck
    }
  ];

  // 1-Click Rich Text Copy for Outlook / Gmail
  const handleCopyRichHtml = async () => {
    const success = await copyHtmlAsRichText(emailData.html, emailData.markdown);
    if (success) {
      setCopiedRich(true);
      setTimeout(() => setCopiedRich(false), 2500);
    }
  };

  // 1-Click Markdown Copy for Slack / Teams
  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(emailData.markdown);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  // Direct Backend Dispatch
  const handleSendAutomatedEmail = async () => {
    if (!recipients.trim()) {
      alert('Please specify at least one recipient email address.');
      return;
    }

    setIsSending(true);
    setSendSuccess(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients.split(',').map(s => s.trim()).filter(Boolean),
          cc: ccRecipients ? ccRecipients.split(',').map(s => s.trim()).filter(Boolean) : [],
          subject: customSubject || emailData.subject,
          html: emailData.html,
          markdown: emailData.markdown,
          templateType: selectedTemplate,
          apiKey: state.settings?.geminiApiKey
        })
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setSendSuccess(`Successfully dispatched to ${recipients}!`);
        if (json.record) {
          const newLog: EmailDispatchLog = {
            id: json.record.id,
            timestamp: json.record.timestamp,
            templateType: selectedTemplate,
            subject: customSubject || emailData.subject,
            recipients: json.record.recipients,
            status: 'sent'
          };
          const updatedLogs = [newLog, ...dispatchLogs];
          setDispatchLogs(updatedLogs);
          if (onUpdateState) {
            onUpdateState(prev => ({
              ...prev,
              settings: {
                ...prev.settings,
                emailLogs: updatedLogs
              }
            }));
          }
        }
        setTimeout(() => setSendSuccess(null), 4000);
      } else {
        alert(json.error || 'Failed to dispatch email.');
      }
    } catch (e: any) {
      alert('Error sending email: ' + e.message);
    } finally {
      setIsSending(false);
    }
  };

  // AI Tone Enhancer
  const handleAiPolish = async () => {
    setIsAiPolishing(true);
    try {
      const res = await fetch('/api/email/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: customSubject || emailData.subject,
          content: emailData.markdown,
          templateType: selectedTemplate,
          tone: aiTone,
          apiKey: state.settings?.geminiApiKey
        })
      });

      const json = await res.json();
      if (res.ok && json.ok && json.data) {
        if (json.data.enhancedSubject) setCustomSubject(json.data.enhancedSubject);
        if (json.data.enhancedMarkdown) {
          setEmailData(prev => ({
            ...prev,
            markdown: json.data.enhancedMarkdown
          }));
        }
        if (json.data.keyHighlights) {
          setAiHighlights(json.data.keyHighlights);
        }
      } else {
        alert(json.error || 'AI enhancement unavailable.');
      }
    } catch (e: any) {
      alert('AI Polish error: ' + e.message);
    } finally {
      setIsAiPolishing(false);
    }
  };

  // Toggle recurring schedule
  const handleToggleSchedule = (id: string) => {
    const updated = schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSchedules(updated);
    if (onUpdateState) {
      onUpdateState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          emailSchedules: updated
        }
      }));
    }
    fetch('/api/email/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedules: updated })
    }).catch(console.error);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shadow-xs">
              <Mail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Email Automation & Dispatch Center</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  8 Production Formats
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Generate, AI-polish, schedule, and dispatch executive-grade delivery & QA reports
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY LAYOUT */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* LEFT SIDEBAR: TEMPLATE SELECTOR & PARAMETERS */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-y-auto p-4 gap-4 shrink-0">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                Select Email Format
              </label>
              <div className="flex flex-col gap-1.5">
                {templatesList.map(tpl => {
                  const Icon = tpl.icon;
                  const isSelected = selectedTemplate === tpl.type;
                  return (
                    <button
                      key={tpl.type}
                      onClick={() => setSelectedTemplate(tpl.type)}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] font-bold shadow-xs'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'}`}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs ${isSelected ? 'font-bold text-[var(--primary)]' : 'font-semibold text-[var(--text-primary)]'}`}>
                          {tpl.title}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                          {tpl.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DYNAMIC PARAMETER SELECTORS */}
            <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Context Parameters
              </label>

              {(selectedTemplate === 'client_qa_status' || selectedTemplate === 'qa_gate' || selectedTemplate === 'release_signoff' || selectedTemplate === 'system_testing_daily' || selectedTemplate === 'dev_to_dev_integration') && (
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">Target Release Scope</label>
                  <select
                    value={selectedReleaseId}
                    onChange={(e) => setSelectedReleaseId(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                  >
                    {state.releases.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.targetDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTemplate === 'defect_escalation' && (
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">Escalated Defect</label>
                  <select
                    value={selectedDefectId}
                    onChange={(e) => setSelectedDefectId(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                  >
                    {state.defects.map(d => (
                      <option key={d.id} value={d.id}>
                        [DEF-{d.adoId || d.id}] {d.title.substring(0, 32)}... ({d.severity})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* AI Executive Tone Polish Box */}
              <div className="bg-[var(--primary-light)]/50 border border-[var(--primary)]/20 p-3 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
                    <Sparkles size={14} />
                    <span>Gemini Tone Polish</span>
                  </div>
                  <select
                    value={aiTone}
                    onChange={(e: any) => setAiTone(e.target.value)}
                    className="text-[10px] font-bold px-2 py-0.5 bg-[var(--surface)] border border-[var(--primary)]/30 rounded text-[var(--primary)] outline-none"
                  >
                    <option value="executive">Executive Crisp</option>
                    <option value="urgent">Urgent Escalation</option>
                    <option value="casual">Agile Casual</option>
                    <option value="formal">Formal Sign-off</option>
                  </select>
                </div>
                <p className="text-[10.5px] text-[var(--text-secondary)] leading-tight">
                  Auto-rewrite summary into executive language with high-impact key highlights.
                </p>
                <button
                  onClick={handleAiPolish}
                  disabled={isAiPolishing}
                  className="w-full py-1.5 px-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  <span>{isAiPolishing ? 'Polishing…' : 'Polish Tone'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-hover)]/30">
            
            {/* TOP BAR: RECIPIENTS, SUBJECT & TABS */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider block mb-1">To (Recipients)</label>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="engineering-leads@careflow.io, stakeholders@careflow.io"
                    className="w-full text-xs font-medium px-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider block mb-1">CC (Optional)</label>
                  <input
                    type="text"
                    value={ccRecipients}
                    onChange={(e) => setCcRecipients(e.target.value)}
                    placeholder="release-managers@careflow.io"
                    className="w-full text-xs font-medium px-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider block mb-1">Subject Line</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--primary)] font-mono"
                />
              </div>

              {/* ACTION & VIEW TOGGLES */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1 bg-[var(--surface-hover)] p-1 rounded-xl border border-[var(--border)]">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'preview' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    HTML Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('markdown')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'markdown' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Markdown / Slack
                  </button>
                  <button
                    onClick={() => setActiveTab('schedules')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'schedules' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Clock size={13} />
                    <span>Schedules</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'logs' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Layers size={13} />
                    <span>Audit Logs</span>
                  </button>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyRichHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl shadow-xs transition-all cursor-pointer"
                    title="Copy formatted with styled tables for pasting directly into Outlook, Gmail, or Apple Mail"
                  >
                    {copiedRich ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedRich ? 'Copied Rich HTML!' : 'Copy for Outlook / Gmail'}</span>
                  </button>

                  <button
                    onClick={handleCopyMarkdown}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl shadow-xs transition-all cursor-pointer"
                    title="Copy raw Markdown for Slack or Teams"
                  >
                    {copiedMd ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedMd ? 'Copied' : 'Slack/Teams'}</span>
                  </button>

                  <a
                    href={`mailto:${recipients}?subject=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(emailData.markdown)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl shadow-xs transition-all"
                    title="Open in default desktop mail client"
                  >
                    <ExternalLink size={14} />
                    <span>Open Mail Client</span>
                  </a>

                  <button
                    onClick={handleSendAutomatedEmail}
                    disabled={isSending}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>{isSending ? 'Sending…' : 'Send Automated Email'}</span>
                  </button>
                </div>
              </div>

              {sendSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} />
                  <span>{sendSuccess}</span>
                </div>
              )}
            </div>

            {/* VIEW CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              
              {/* TAB 1: HTML VISUAL PREVIEW */}
              {activeTab === 'preview' && (
                <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                  {aiHighlights.length > 0 && (
                    <div className="bg-[var(--primary-light)] border border-[var(--primary)]/30 p-3.5 rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)] mb-1.5">
                        <Sparkles size={14} />
                        <span>AI Executive Highlights</span>
                      </div>
                      <ul className="text-xs text-[var(--text-primary)] space-y-1 list-disc pl-4 font-medium">
                        {aiHighlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Simulated Mail Client Viewport */}
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
                    <div dangerouslySetInnerHTML={{ __html: emailData.html }} />
                  </div>
                </div>
              )}

              {/* TAB 2: MARKDOWN / PLAIN TEXT */}
              {activeTab === 'markdown' && (
                <div className="max-w-3xl mx-auto">
                  <textarea
                    rows={20}
                    value={emailData.markdown}
                    readOnly
                    className="w-full text-xs font-mono p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-[var(--text-primary)] leading-relaxed outline-none"
                  />
                </div>
              )}

              {/* TAB 3: AUTOMATED RECURRING SCHEDULES */}
              {activeTab === 'schedules' && (
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Automated Email Dispatch Schedules</h3>
                        <p className="text-xs text-[var(--text-secondary)]">Configure scheduled daily and weekly triggers for recurring delivery digests</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Active Cron Handlers
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {schedules.map(sch => (
                        <div
                          key={sch.id}
                          className="p-4 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl flex items-center justify-between flex-wrap gap-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl mt-0.5 ${sch.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-500/10 text-gray-500'}`}>
                              <Clock size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">{sch.title}</h4>
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                                  {sch.frequency} @ {sch.timeStr || '17:00'}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-mono">
                                Recipients: {sch.recipients.join(', ')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleSchedule(sch.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                sch.enabled
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-[var(--border)] text-[var(--text-muted)]'
                              }`}
                            >
                              {sch.enabled ? 'Enabled' : 'Paused'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AUDIT DISPATCH LOGS */}
              {activeTab === 'logs' && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Transmission & Delivery History</h3>
                    {dispatchLogs.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] text-center py-8">No email dispatches recorded in this session yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] font-bold">
                              <th className="py-2.5 px-3">Time</th>
                              <th className="py-2.5 px-3">Template</th>
                              <th className="py-2.5 px-3">Subject</th>
                              <th className="py-2.5 px-3">Recipients</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dispatchLogs.map(log => (
                              <tr key={log.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                                <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">{log.templateType}</td>
                                <td className="py-2.5 px-3 font-medium text-[var(--text-primary)] truncate max-w-xs">{log.subject}</td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[150px]">
                                  {log.recipients.join(', ')}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                                    {log.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
