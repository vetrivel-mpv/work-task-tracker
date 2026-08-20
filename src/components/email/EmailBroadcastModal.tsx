import React, { useState } from 'react';
import { AppState } from '../../types';
import { 
  buildStandupEmail, 
  buildQaStatusReport, 
  buildDashboardDigest 
} from '../../services/emailService';
import { 
  Mail, 
  Copy, 
  Check, 
  X, 
  ExternalLink, 
  FileText, 
  Code, 
  Send 
} from 'lucide-react';

interface EmailBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  initialTab?: 'standup' | 'qa' | 'dashboard';
}

export const EmailBroadcastModal: React.FC<EmailBroadcastModalProps> = ({
  isOpen,
  onClose,
  state,
  initialTab = 'standup'
}) => {
  const [activeTab, setActiveTab] = useState<'standup' | 'qa' | 'dashboard'>(initialTab);
  const [viewMode, setViewMode] = useState<'preview' | 'markdown' | 'html'>('preview');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let reportData: { subject: string; markdown: string; html: string; mailtoUrl: string };

  if (activeTab === 'qa') {
    reportData = buildQaStatusReport(state);
  } else if (activeTab === 'dashboard') {
    reportData = buildDashboardDigest(state);
  } else {
    reportData = buildStandupEmail(state);
  }

  const handleCopy = () => {
    const textToCopy = viewMode === 'html' ? reportData.html : reportData.markdown;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E2E8E4] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E4] bg-[#F7FAF8]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8F3F0] text-[#0C6E5E] flex items-center justify-center font-bold">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#15221E]">Executive Report & Email Dispatcher</h2>
              <p className="text-xs text-[#5A675F]">{reportData.subject}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#84918A] hover:text-[#15221E] hover:bg-[#F3F6F4]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab & Format Controls */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-[#E2E8E4] bg-white gap-3">
          {/* Report Category */}
          <div className="flex bg-[#F3F6F4] p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('standup')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'standup' ? 'bg-[#0C6E5E] text-white shadow-xs' : 'text-[#5A675F]'
              }`}
            >
              Standup Digest
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'qa' ? 'bg-[#0C6E5E] text-white shadow-xs' : 'text-[#5A675F]'
              }`}
            >
              QA & Defects Gate
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'dashboard' ? 'bg-[#0C6E5E] text-white shadow-xs' : 'text-[#5A675F]'
              }`}
            >
              Full Board Status
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F3F6F4] p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-lg ${viewMode === 'preview' ? 'bg-white font-bold text-[#15221E] shadow-xs' : 'text-[#5A675F]'}`}
              >
                Rendered
              </button>
              <button
                onClick={() => setViewMode('markdown')}
                className={`px-2.5 py-1 rounded-lg ${viewMode === 'markdown' ? 'bg-white font-bold text-[#15221E] shadow-xs' : 'text-[#5A675F]'}`}
              >
                Markdown
              </button>
              <button
                onClick={() => setViewMode('html')}
                className={`px-2.5 py-1 rounded-lg ${viewMode === 'html' ? 'bg-white font-bold text-[#15221E] shadow-xs' : 'text-[#5A675F]'}`}
              >
                Raw HTML
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#15221E] bg-[#F7FAF8] hover:bg-[#F3F6F4] border border-[#E2E8E4] rounded-xl transition-colors"
            >
              {copied ? <Check size={13} className="text-[#0C6E5E]" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Content Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#F7FAF8]">
          {viewMode === 'preview' && (
            <div 
              className="bg-white p-6 rounded-2xl border border-[#E2E8E4] shadow-xs text-xs font-sans"
              dangerouslySetInnerHTML={{ __html: reportData.html }}
            />
          )}

          {viewMode === 'markdown' && (
            <pre className="bg-[#15221E] text-[#EEF2F0] p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {reportData.markdown}
            </pre>
          )}

          {viewMode === 'html' && (
            <pre className="bg-[#15221E] text-[#EEF2F0] p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {reportData.html}
            </pre>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8E4] bg-white">
          <div className="text-xs text-[#84918A]">
            Configured default recipient: <strong>{state.settings.emailRecipient || 'engineering-leads@careflow.io'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A675F] hover:bg-[#F3F6F4]"
            >
              Close
            </button>
            <a
              href={reportData.mailtoUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0C6E5E] hover:bg-[#095447] shadow-xs"
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
