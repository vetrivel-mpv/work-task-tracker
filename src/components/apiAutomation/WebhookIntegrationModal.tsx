import React, { useState } from 'react';
import { 
  X, 
  Link2, 
  Copy, 
  Check, 
  ShieldCheck, 
  GitBranch, 
  Terminal,
  Zap,
  RotateCw
} from 'lucide-react';
import { ApiAutomationCollection } from '../../types/apiAutomation';

interface WebhookIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: ApiAutomationCollection;
}

export const WebhookIntegrationModal: React.FC<WebhookIntegrationModalProps> = ({
  isOpen,
  onClose,
  collection
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const webhookUrl = `${window.location.origin}/api/automation/webhook/${collection.id}`;
  const webhookToken = collection.webhookToken || 'whk_live_sec_token_sample';

  const curlTrigger = `curl -X POST "${webhookUrl}" \\
  -H "X-Webhook-Token: ${webhookToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"triggeredBy": "AzureDevOps_CI", "environment": "staging"}'`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-sm">
              <Link2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                CI/CD Webhook & Remote Trigger
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Trigger this collection remotely from Azure DevOps, GitHub Actions, Jenkins, or cron
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-muted)]">Target Webhook Endpoint</label>
              <button
                onClick={() => handleCopy(webhookUrl, 'url')}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'url' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'url' ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs break-all border border-slate-800">
              {webhookUrl}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-muted)]">Secret Webhook Token</label>
              <button
                onClick={() => handleCopy(webhookToken, 'token')}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'token' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'token' ? 'Copied' : 'Copy Token'}</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono text-xs border border-[var(--border)]">
              {webhookToken}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-muted)]">cURL Remote Trigger Command</label>
              <button
                onClick={() => handleCopy(curlTrigger, 'curl')}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'curl' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'curl' ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800">
              {curlTrigger}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
