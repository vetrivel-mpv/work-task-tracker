import React, { useState } from 'react';
import { AppState } from '../../types';
import { 
  buildStandupEmail, 
  buildQaStatusReport, 
  buildDashboardDigest 
} from '../../services/emailService';
import { formatReleaseDisplayName } from '../../utils/adoPaths';
import { 
  Mail, 
  Copy, 
  Check, 
  X, 
  FileText, 
  Code, 
  Send,
  Rocket,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

interface EmailBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  initialTab?: 'standup' | 'qa' | 'dashboard' | 'ai_composer';
}

export const EmailBroadcastModal: React.FC<EmailBroadcastModalProps> = ({
  isOpen,
  onClose,
  state,
  initialTab = 'standup'
}) => {
  const [activeTab, setActiveTab] = useState<'standup' | 'qa' | 'dashboard' | 'ai_composer'>(initialTab);
  const [viewMode, setViewMode] = useState<'preview' | 'markdown' | 'html'>('preview');
  const [copiedType, setCopiedType] = useState<'md' | 'html' | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>(
    state.selectedReleaseId || (state.releases[0]?.id ?? '')
  );

  // AI Composer State
  const [aiType, setAiType] = useState<string>('Sprint 24 Status & QA Digest');
  const [aiTone, setAiTone] = useState<string>('Executive & Crisp');
  const [aiSubject, setAiSubject] = useState<string>('[CareFlow EHR] Sprint 24 Delivery & QA Verification Digest');
  const [aiRecipient, setAiRecipient] = useState<string>(state.settings?.emailRecipient || 'engineering-leadership@careflow.io');
  const [aiRawNotes, setAiRawNotes] = useState<string>(
    `- Completed FHIR schema validator & closed multi-tenant auth RFC\n- Maya discovered appointment slot double-booking race condition; advisory lock deployed\n- 56 tests passed, 1 failed (Mount Sinai PDF batch timeout)\n- Next focus: Sprint 24 QA sign-off & customer patch release`
  );
  const [aiGeneratedEmail, setAiGeneratedEmail] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  let reportData: { subject: string; markdown: string; html: string; mailtoUrl: string };

  if (activeTab === 'qa') {
    reportData = buildQaStatusReport(state, selectedReleaseId || undefined);
  } else if (activeTab === 'dashboard') {
    reportData = buildDashboardDigest(state);
  } else if (activeTab === 'ai_composer' && aiGeneratedEmail) {
    const encodedSubject = encodeURIComponent(aiSubject || 'Executive Delivery & Quality Update');
    const encodedBody = encodeURIComponent(aiGeneratedEmail);
    reportData = {
      subject: aiSubject,
      markdown: aiGeneratedEmail,
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6;">${aiGeneratedEmail.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}</div>`,
      mailtoUrl: `mailto:${aiRecipient || state.settings?.emailRecipient || ''}?subject=${encodedSubject}&body=${encodedBody}`
    };
  } else {
    reportData = buildStandupEmail(state);
  }

  const handleCopy = (type: 'md' | 'html') => {
    const textToCopy = type === 'html' ? reportData.html : reportData.markdown;
    navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const currentRel = state.releases.find(r => r.id === selectedReleaseId) || state.releases[0];

  return (
    <div 
      id="email-broadcast-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div 
        id="email-broadcast-modal-container"
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold shadow-2xs">
              <Mail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Executive Report & Email Dispatcher
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 font-mono">
                  Pulse v2.4
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate max-w-lg">
                {reportData.subject}
              </p>
            </div>
          </div>

          <button
            id="close-email-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Controls & Scope Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] gap-3 shrink-0">
          {/* Report Category Segmented Controller */}
          <div className="flex bg-[var(--surface)] border border-[var(--border)] p-1 rounded-xl text-xs font-bold shadow-2xs">
            <button
              id="tab-btn-standup"
              onClick={() => setActiveTab('standup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'standup' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Activity size={13} />
              <span>Daily Standup</span>
            </button>
            <button
              id="tab-btn-qa"
              onClick={() => setActiveTab('qa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'qa' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <ShieldCheck size={13} />
              <span>QA & Defects Gate</span>
            </button>
            <button
              id="tab-btn-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-[var(--primary)] text-white shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Sparkles size={13} />
              <span>Full Ops Pulse</span>
            </button>
          </div>

          {/* Release Scoping Filter (Shown on QA tab or applicable views) */}
          {activeTab === 'qa' && state.releases.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2.5 py-1 text-xs font-semibold shadow-2xs">
              <Rocket size={12} className="text-[var(--primary)] shrink-0" />
              <select
                id="modal-release-selector"
                value={selectedReleaseId}
                onChange={(e) => setSelectedReleaseId(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] outline-none cursor-pointer pr-1"
              >
                {state.releases.map(r => (
                  <option key={r.id} value={r.id}>
                    {formatReleaseDisplayName(r.name, r.releaseNumber)} ({r.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Format Selector & Copy Actions */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--surface)] border border-[var(--border)] p-1 rounded-xl text-xs font-semibold shadow-2xs">
              <button
                id="format-btn-rendered"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'preview' 
                    ? 'bg-[var(--primary-light)] font-bold text-[var(--primary)] shadow-2xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileText size={12} />
                <span>Formatted</span>
              </button>
              <button
                id="format-btn-markdown"
                onClick={() => setViewMode('markdown')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'markdown' 
                    ? 'bg-[var(--primary-light)] font-bold text-[var(--primary)] shadow-2xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Code size={12} />
                <span>Markdown</span>
              </button>
              <button
                id="format-btn-html"
                onClick={() => setViewMode('html')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'html' 
                    ? 'bg-[var(--primary-light)] font-bold text-[var(--primary)] shadow-2xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>HTML</span>
              </button>
            </div>

            <button
              id="copy-report-btn"
              onClick={() => handleCopy(viewMode === 'html' ? 'html' : 'md')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              {copiedType ? (
                <Check size={13} className="text-emerald-500" />
              ) : (
                <Copy size={13} className="text-[var(--text-muted)]" />
              )}
              <span>{copiedType ? 'Copied to Clipboard' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Content Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg)]">
          {viewMode === 'preview' && (
            <div className="flex justify-center">
              <div 
                id="email-rendered-preview-content"
                className="w-full max-w-2xl bg-white text-slate-900 p-2 sm:p-4 rounded-2xl border border-[var(--border)] shadow-sm"
                dangerouslySetInnerHTML={{ __html: reportData.html }}
              />
            </div>
          )}

          {viewMode === 'markdown' && (
            <div className="relative">
              <pre 
                id="email-markdown-preview-content"
                className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto shadow-2xs"
              >
                {reportData.markdown}
              </pre>
            </div>
          )}

          {viewMode === 'html' && (
            <div className="relative">
              <pre 
                id="email-html-preview-content"
                className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto shadow-2xs"
              >
                {reportData.html}
              </pre>
            </div>
          )}

          {/* Email Preview Area */}
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xs text-xs font-sans">
            {viewMode === 'preview' && (
              <div 
                className="space-y-4"
                dangerouslySetInnerHTML={{ __html: reportData.html }}
              />
            )}

            {viewMode === 'markdown' && (
              <pre className="bg-[var(--bg)] text-[var(--text-primary)] p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto border border-[var(--border)]">
                {reportData.markdown}
              </pre>
            )}

            {viewMode === 'html' && (
              <pre className="bg-[var(--bg)] text-[var(--text-primary)] p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto border border-[var(--border)]">
                {reportData.html}
              </pre>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface)] shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Mail size={13} />
            <span>Target Recipient:</span>
            <strong className="text-[var(--text-primary)] font-mono text-[11px]">
              {state.settings.emailRecipient || state.settings.managerEmail || 'engineering-leads@domain.com'}
            </strong>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="cancel-email-modal-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <a
              id="launch-mail-client-btn"
              href={reportData.mailtoUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-xs transition-all cursor-pointer"
            >
              <Send size={14} />
              <span>Launch Default Mail Client</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

