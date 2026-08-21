import React, { useState } from 'react';
import { AppState } from '../../types';
import { 
  buildStandupEmail, 
  buildQaStatusReport, 
  buildDashboardDigest 
} from '../../services/emailService';
import { requestEmailFormat, requestWritingAssist } from '../../services/aiService';
import { 
  Mail, 
  Copy, 
  Check, 
  X, 
  ExternalLink, 
  FileText, 
  Code, 
  Send,
  Sparkles,
  Wand2,
  RefreshCw,
  Sliders,
  AlignLeft,
  FileCheck2
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
  const [copied, setCopied] = useState(false);

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
    reportData = buildQaStatusReport(state);
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

  const handleCopy = () => {
    const textToCopy = viewMode === 'html' ? reportData.html : reportData.markdown;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateAiEmail = async () => {
    setIsAiLoading(true);
    setAiError(null);

    try {
      const activeStories = state.userStories.map(s => `US-${s.adoId || ''} ${s.title} [${s.status}]`);
      const testCases = (state.testCases || []).map(tc => `TC-${tc.adoId || ''} ${tc.title} [Status: ${tc.status}, Result: ${tc.executionStatus}]`);
      const criticalDefects = state.defects.filter(d => d.severity === 'critical' || d.severity === 'high').map(d => `DEF-${d.adoId || ''} ${d.title} [${d.status}]`);

      const res = await requestEmailFormat({
        type: aiType,
        subject: aiSubject,
        recipient: aiRecipient,
        senderName: state.settings?.yourName || 'Delivery Lead',
        rawNotes: aiRawNotes,
        tone: aiTone,
        dataContext: {
          release: state.releases[0]?.name,
          activeStoriesCount: activeStories.length,
          testCasesSummary: testCases,
          criticalDefectsSummary: criticalDefects
        }
      });

      if (res.ok && res.text) {
        setAiGeneratedEmail(res.text);
      } else {
        setAiError(res.error || 'Failed to generate email via Gemini AI.');
      }
    } catch (err: any) {
      setAiError(err.message || 'AI request failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">Gemini AI Executive Email Dispatcher</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  Gemini Powered
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Compose, format, and broadcast high-impact delivery status emails and QA gates.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab & Format Controls */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)] gap-3">
          {/* Report Category */}
          <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl text-xs font-bold gap-1 flex-wrap">
            <button
              onClick={() => setActiveTab('ai_composer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'ai_composer' ? 'bg-purple-600 text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Wand2 size={13} />
              Gemini AI Writer
            </button>
            <button
              onClick={() => setActiveTab('standup')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'standup' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Standup Digest
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'qa' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              QA & Defects Gate
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Full Board Status
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${viewMode === 'preview' ? 'bg-[var(--surface)] font-bold text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
              >
                Rendered
              </button>
              <button
                onClick={() => setViewMode('markdown')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${viewMode === 'markdown' ? 'bg-[var(--surface)] font-bold text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
              >
                Markdown
              </button>
              <button
                onClick={() => setViewMode('html')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${viewMode === 'html' ? 'bg-[var(--surface)] font-bold text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-secondary)]'}`}
              >
                Raw HTML
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-subtle)] space-y-4">
          {/* If AI Composer Tab is Active */}
          {activeTab === 'ai_composer' && (
            <div className="space-y-4">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Email Template / Type
                    </label>
                    <select
                      value={aiType}
                      onChange={e => setAiType(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none"
                    >
                      <option value="Sprint 24 Status & QA Digest">Sprint 24 Status & QA Digest</option>
                      <option value="Executive Standup Summary">Executive Standup Summary</option>
                      <option value="QA Release Gate & Test Cases Sign-off">QA Release Gate & Test Sign-off</option>
                      <option value="Critical Incident & Root Cause Alert">Critical Incident & Root Cause Alert</option>
                      <option value="Client Stakeholder Delivery Milestone">Client Delivery Milestone</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Communication Tone
                    </label>
                    <select
                      value={aiTone}
                      onChange={e => setAiTone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none"
                    >
                      <option value="Executive & Crisp">Executive & Crisp (Leadership)</option>
                      <option value="Technical & Detailed">Technical & Detailed (Engineering)</option>
                      <option value="Celebratory & Motivating">Celebratory & Motivating (Sprint Wins)</option>
                      <option value="Direct & Urgent">Direct & Urgent (Blockers/Hotfix)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                      Target Recipient
                    </label>
                    <input
                      type="text"
                      value={aiRecipient}
                      onChange={e => setAiRecipient(e.target.value)}
                      placeholder="engineering-leads@careflow.io"
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      Key Highlights / Bullet Notes to Format & Polish
                    </label>
                    <span className="text-[11px] text-[var(--text-muted)]">Gemini AI will structure, format, and polish this into an executive email</span>
                  </div>
                  <textarea
                    rows={3}
                    value={aiRawNotes}
                    onChange={e => setAiRawNotes(e.target.value)}
                    placeholder="Enter rough updates, blockers, or test numbers..."
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>Includes live telemetry: {state.userStories.length} Stories, {(state.testCases || []).length} Test Cases, {state.defects.length} Defects</span>
                  </div>

                  <button
                    onClick={handleGenerateAiEmail}
                    disabled={isAiLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Sparkles size={14} className={isAiLoading ? 'animate-spin' : ''} />
                    {isAiLoading ? 'Formatting with Gemini AI...' : 'Format & Polish with Gemini AI'}
                  </button>
                </div>

                {aiError && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                    {aiError}
                  </div>
                )}
              </div>
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="text-xs text-[var(--text-muted)]">
            Recipient: <strong className="text-[var(--text-primary)]">{aiRecipient || state.settings?.emailRecipient || 'engineering-leads@careflow.io'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              Close
            </button>
            <a
              href={reportData.mailtoUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-xs cursor-pointer"
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

