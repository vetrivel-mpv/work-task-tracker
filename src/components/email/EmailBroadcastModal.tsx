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
  CheckSquare,
  Bug,
  ListTodo,
  ShieldCheck,
  ShieldAlert,
  Sparkle
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
import { formatDisplayDate, formatLongDate } from '../../utils/date';
import { formatReleaseDisplayName } from '../../utils/adoPaths';

interface EmailBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  initialTab?: string;
  initialTemplate?: EmailTemplateType;
  initialDefectId?: string;
  initialReleaseId?: string;
  onUpdateState?: (updater: (prev: AppState) => AppState) => void;
}

export const EmailBroadcastModal: React.FC<EmailBroadcastModalProps> = ({
  isOpen,
  onClose,
  state,
  initialTab,
  initialTemplate,
  initialDefectId,
  initialReleaseId,
  onUpdateState
}) => {
  // Map legacy tab names to EmailTemplateType
  const resolveInitialTemplate = (): EmailTemplateType => {
    if (initialTemplate) return initialTemplate;
    if (initialTab === 'standup') return 'daily_standup';
    if (initialTab === 'status') return 'client_qa_status';
    if (initialTab === 'system_testing' || initialTab === 'ai_report') return 'system_testing_daily';
    if (initialTab === 'defect') return 'defect_escalation';
    if (initialTab === 'retro') return 'release_signoff';
    return 'client_qa_status';
  };

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>(resolveInitialTemplate);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>(
    initialReleaseId || state.selectedReleaseId || state.releases[0]?.id || ''
  );
  const [selectedDefectId, setSelectedDefectId] = useState<string>(
    initialDefectId || state.defects[0]?.id || ''
  );
  const [deliveryDeadline, setDeliveryDeadline] = useState<string>('Monday Delivery');
  const [activeViewMode, setActiveViewMode] = useState<'preview' | 'markdown' | 'schedules' | 'logs'>('preview');

  // Generated email bundle
  const [emailData, setEmailData] = useState<EmailRenderOutput>(() =>
    generateEmailByType(resolveInitialTemplate(), state, {
      releaseId: initialReleaseId || state.selectedReleaseId || undefined,
      defectId: initialDefectId,
      deliveryTargetDate: 'Monday Delivery'
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
  const [customAiPrompt, setCustomAiPrompt] = useState<string>('');
  const [showPromptDrawer, setShowPromptDrawer] = useState<boolean>(false);

  // Dispatch & Action state
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [copiedRich, setCopiedRich] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  // Automation Schedules State
  const [schedules, setSchedules] = useState<EmailScheduleConfig[]>(() => state.settings.emailSchedules || [
    {
      id: 'sched-system-testing-daily',
      templateType: 'system_testing_daily',
      title: 'System Testing Daily Progress (Stories & Release)',
      frequency: 'daily',
      targetDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timeStr: '17:30',
      recipients: [state.settings.qaTeamEmail || 'qa-leads@careflow.io', state.settings.emailRecipient || 'engineering-leads@careflow.io'],
      enabled: true,
      includeAiSummary: true
    },
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

  // AI Auto-Draft Trigger for System Testing Report
  const handleAutoDraftSystemTesting = useCallback(async (targetRelId?: string, promptOverride?: string) => {
    setIsAiDrafting(true);
    const effectiveRelId = targetRelId || selectedReleaseId || state.selectedReleaseId || state.releases[0]?.id;
    
    try {
      const response = await generateSystemTestingDailyReport(
        state,
        effectiveRelId,
        promptOverride || customAiPrompt,
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
  }, [state, selectedReleaseId, customAiPrompt, aiTone]);

  // Update selection if prop initialTab changes when opening
  useEffect(() => {
    if (isOpen) {
      const tpl = resolveInitialTemplate();
      setSelectedTemplate(tpl);
      if (initialDefectId) setSelectedDefectId(initialDefectId);
      if (initialReleaseId) setSelectedReleaseId(initialReleaseId);

      // Auto-draft if opened on system testing daily report
      if (tpl === 'system_testing_daily') {
        handleAutoDraftSystemTesting(initialReleaseId);
      }
    }
  }, [isOpen, initialTab, initialTemplate, initialDefectId, initialReleaseId]);

  // Sync template generation whenever parameters change (for non-AI auto-draft templates)
  useEffect(() => {
    if (selectedTemplate === 'system_testing_daily') {
      // Trigger AI auto-draft on template selection or release change
      handleAutoDraftSystemTesting(selectedReleaseId);
    } else {
      const rendered = generateEmailByType(selectedTemplate, state, {
        releaseId: selectedReleaseId || undefined,
        defectId: selectedDefectId || undefined,
        deliveryTargetDate: deliveryDeadline
      });
      setEmailData(rendered);
      setCustomSubject(rendered.subject);
      setRecipients(rendered.suggestedRecipients.join(', ') || state.settings.emailRecipient || '');
      setAiHighlights([]);
      setAiDraftVerdict(null);
      setAiDraftMetrics(null);
      setAiDraftModel(null);
    }
  }, [selectedTemplate, selectedReleaseId, selectedDefectId, deliveryDeadline]);

  if (!isOpen) return null;

  const templatesList: { type: EmailTemplateType; title: string; desc: string; icon: React.FC<{ size?: number; className?: string }>; badge?: string }[] = [
    {
      type: 'client_qa_status',
      title: 'Client QA Status & Blockers',
      desc: 'Client-facing report: story-by-story blockers, delivery readiness & where we stand',
      icon: ShieldAlert,
      badge: 'Client Ready'
    },
    {
      type: 'system_testing_daily',
      title: 'System Testing Daily Report',
      desc: 'Gemini AI auto-draft of story test pass %, task throughput & defect triage',
      icon: ShieldCheck,
      badge: 'Gemini AI'
    },
    {
      type: 'daily_standup',
      title: 'Daily Standup Digest',
      desc: 'Member check-ins, task counts, active blockers & leaves',
      icon: Calendar
    },
    {
      type: 'dev_to_dev_integration',
      title: 'Dev-to-Dev Integration Testing',
      desc: 'Inter-component API contracts, stub validations & integration coverage',
      icon: Layers
    },
    {
      type: 'qa_gate',
      title: 'QA Quality Gate Report',
      desc: 'Story QA Pass Rate %, open bug counts & critical blocker callouts',
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
      desc: 'Immediate incident broadcast, reproduction logs & SLA countdown',
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

  const activeReleaseObj = state.releases.find(r => r.id === selectedReleaseId) || state.releases[0];

  return (
    <div 
      id="email-automation-hub-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div 
        id="email-automation-hub-container"
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shadow-xs">
              <Mail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Email Automation & Dispatch Center</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  8 Professional Formats
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Sparkles size={11} />
                  Gemini API Powered
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Auto-draft, AI-polish, schedule, and dispatch executive-grade System Testing & Delivery reports
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          
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
                        <div className="flex items-center justify-between gap-1">
                          <div className={`text-xs ${isSelected ? 'font-bold text-[var(--primary)]' : 'font-semibold text-[var(--text-primary)]'}`}>
                            {tpl.title}
                          </div>
                          {tpl.badge && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                              {tpl.badge}
                            </span>
                          )}
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

              {(selectedTemplate === 'client_qa_status' || selectedTemplate === 'system_testing_daily' || selectedTemplate === 'dev_to_dev_integration' || selectedTemplate === 'qa_gate' || selectedTemplate === 'release_signoff') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Target Release</label>
                    {selectedTemplate === 'client_qa_status' && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {state.userStories.length} stories &bull; {state.defects.length} bugs
                      </span>
                    )}
                    {selectedTemplate === 'system_testing_daily' && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {state.tasks.length} tasks &bull; {state.defects.length} bugs
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedReleaseId}
                    onChange={(e) => setSelectedReleaseId(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                  >
                    {state.releases.map(r => (
                      <option key={r.id} value={r.id}>
                        {formatReleaseDisplayName(r.name, r.releaseNumber)} ({r.targetDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTemplate === 'client_qa_status' && (
                <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert size={13} className="text-amber-600" />
                      <span>Delivery Target / Deadline</span>
                    </label>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Client Target</span>
                  </div>
                  <input
                    type="text"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    placeholder="e.g. Monday Delivery (Aug 31)"
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-[var(--surface)] border border-amber-500/30 rounded-lg text-[var(--text-primary)] outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setDeliveryDeadline('Monday Delivery')}
                      className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded hover:bg-amber-500/30 cursor-pointer"
                    >
                      ⚡ Monday Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const activeRel = state.releases.find(r => r.id === selectedReleaseId);
                        if (activeRel?.targetDate) setDeliveryDeadline(`Target: ${formatLongDate(activeRel.targetDate)}`);
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded hover:bg-[var(--surface-hover)] cursor-pointer"
                    >
                      📅 Release Target Date
                    </button>
                  </div>
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

              {/* Gemini AI Auto-Draft Quick Actions Box for System Testing */}
              {selectedTemplate === 'system_testing_daily' ? (
                <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-500/20 p-3 rounded-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                      <span>Gemini Auto-Drafter</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                      {aiDraftModel || 'gemini-3.7-flash'}
                    </span>
                  </div>
                  
                  <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                    Auto-synthesizes live tasks progress, story test coverage, and defect triage into an executive daily report.
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAutoDraftSystemTesting()}
                      disabled={isAiDrafting}
                      className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isAiDrafting ? 'animate-spin' : ''} />
                      <span>{isAiDrafting ? 'Drafting with AI…' : 'Re-Draft with AI'}</span>
                    </button>
                    <button
                      onClick={() => setShowPromptDrawer(prev => !prev)}
                      className={`p-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        showPromptDrawer
                          ? 'bg-indigo-500 text-white border-indigo-600'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Customize prompt instructions"
                    >
                      <Sliders size={13} />
                    </button>
                  </div>

                  {showPromptDrawer && (
                    <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in">
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Custom Focus / Instructions</label>
                      <textarea
                        rows={2}
                        value={customAiPrompt}
                        onChange={(e) => setCustomAiPrompt(e.target.value)}
                        placeholder="e.g. Highlight P0 blocker resolution on roaming sockets; emphasize staging gate readiness"
                        className="w-full text-xs p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none"
                      />
                      <button
                        onClick={() => handleAutoDraftSystemTesting(undefined, customAiPrompt)}
                        disabled={isAiDrafting}
                        className="py-1 px-2 bg-[var(--primary)] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                      >
                        Apply & Re-Draft
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* AI Tone Polish Box for other templates */
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
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-hover)]/30 min-h-0">
            
            {/* TOP BAR: RECIPIENTS, SUBJECT & TABS */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider block mb-1">To (Recipients)</label>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="qa-leads@careflow.io, engineering-leads@careflow.io"
                    className="w-full text-xs font-medium px-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider block mb-1">CC (Optional)</label>
                  <input
                    type="text"
                    value={ccRecipients}
                    onChange={(e) => setCcRecipients(e.target.value)}
                    placeholder="release-managers@careflow.io, managers@careflow.io"
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
                    onClick={() => setActiveViewMode('preview')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeViewMode === 'preview' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    HTML Preview
                  </button>
                  <button
                    onClick={() => setActiveViewMode('markdown')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeViewMode === 'markdown' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Markdown / Slack
                  </button>
                  <button
                    onClick={() => setActiveViewMode('schedules')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeViewMode === 'schedules' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Clock size={13} />
                    <span>Schedules</span>
                  </button>
                  <button
                    onClick={() => setActiveViewMode('logs')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeViewMode === 'logs' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
              
              {/* TAB 1: HTML VISUAL PREVIEW */}
              {activeViewMode === 'preview' && (
                <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                  
                  {/* AI Drafting Loading Banner */}
                  {isAiDrafting && (
                    <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/30 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                      <div className="p-2 rounded-xl bg-indigo-500 text-white">
                        <Sparkles size={18} className="animate-spin" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          Gemini API is drafting the System Testing Daily Report...
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          Analyzing {state.tasks.length} tasks, {state.defects.length} defects, and user stories for {activeReleaseObj ? activeReleaseObj.name : 'release'}.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System Testing AI Telemetry & Verdict Banner */}
                  {selectedTemplate === 'system_testing_daily' && !isAiDrafting && (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            System Testing Telemetry &middot; {activeReleaseObj?.name || 'Release Scope'}
                          </span>
                        </div>
                        {aiDraftVerdict && (
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                            aiDraftVerdict === 'ON_TRACK'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                              : aiDraftVerdict === 'NEEDS_ATTENTION'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                          }`}>
                            Verdict: {aiDraftVerdict.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Quick telemetry chips */}
                      {aiDraftMetrics && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="p-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Story Pass Rate</div>
                            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                              {aiDraftMetrics.storyPassPct}% ({aiDraftMetrics.storyPassed}/{aiDraftMetrics.storyTotal})
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Task Throughput</div>
                            <div className="text-sm font-extrabold text-[var(--primary)]">
                              {aiDraftMetrics.taskCompletionPct}% ({aiDraftMetrics.tasksCompleted}/{aiDraftMetrics.tasksTotal})
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Open Defects</div>
                            <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                              {aiDraftMetrics.openDefects} Active
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Critical Blockers</div>
                            <div className={`text-sm font-extrabold ${aiDraftMetrics.criticalDefects > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {aiDraftMetrics.criticalDefects} P0/P1
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Highlights Card */}
                  {aiHighlights.length > 0 && (
                    <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/30 p-3.5 rounded-2xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1.5">
                        <Sparkles size={14} className="text-indigo-600" />
                        <span>Gemini AI Key Highlights</span>
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
              {activeViewMode === 'markdown' && (
                <div className="max-w-3xl mx-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">Editable Plain Text & Markdown Source</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">{emailData.markdown.length} characters</span>
                  </div>
                  <textarea
                    rows={22}
                    value={emailData.markdown}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmailData(prev => ({ ...prev, markdown: val }));
                    }}
                    className="w-full text-xs font-mono p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-[var(--text-primary)] leading-relaxed outline-none focus:border-[var(--primary)]"
                  />
                </div>
              )}

              {/* TAB 3: AUTOMATED RECURRING SCHEDULES */}
              {activeViewMode === 'schedules' && (
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
              {activeViewMode === 'logs' && (
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
