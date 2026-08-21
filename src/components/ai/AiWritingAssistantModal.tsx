import React, { useState } from 'react';
import { requestWritingAssist, WritingAssistOptions } from '../../services/aiService';
import { 
  Sparkles, 
  Wand2, 
  X, 
  Copy, 
  Check, 
  ArrowRight, 
  FileText, 
  Sliders, 
  Zap, 
  RefreshCw,
  AlignLeft,
  CheckCircle2
} from 'lucide-react';

interface AiWritingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  contextTitle?: string;
  onApplyText?: (refinedText: string) => void;
}

export const AiWritingAssistantModal: React.FC<AiWritingAssistantModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  contextTitle = 'General Delivery & Engineering Note',
  onApplyText
}) => {
  const [inputContent, setInputContent] = useState<string>(initialText);
  const [action, setAction] = useState<WritingAssistOptions['action']>('improve');
  const [tone, setTone] = useState<string>('Executive & Crisp');
  const [outputContent, setOutputContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!inputContent.trim()) {
      setError('Please provide some text to refine.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await requestWritingAssist({
        text: inputContent,
        action,
        tone,
        context: contextTitle
      });

      if (res.ok && res.text) {
        setOutputContent(res.text);
      } else {
        setError(res.error || 'Failed to generate writing assistance.');
      }
    } catch (err: any) {
      setError(err.message || 'AI request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputContent || inputContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (onApplyText && outputContent) {
      onApplyText(outputContent);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">Gemini AI Real-Time Writing Assistant</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  Gemini Flash
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Context: {contextTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action & Tone Bar */}
        <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Transformation:</span>
            <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl text-xs font-semibold gap-1">
              <button
                onClick={() => setAction('improve')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${action === 'improve' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Improve Flow
              </button>
              <button
                onClick={() => setAction('expand')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${action === 'expand' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Expand & Detail
              </button>
              <button
                onClick={() => setAction('shorten')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${action === 'shorten' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Condense
              </button>
              <button
                onClick={() => setAction('bulletize')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${action === 'bulletize' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Bulletize
              </button>
              <button
                onClick={() => setAction('formal')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${action === 'formal' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Executive Formal
              </button>
              <button
                onClick={() => setAction('technical')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${action === 'technical' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                Technical Precision
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Tone:</span>
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="Executive & Crisp">Executive & Crisp</option>
              <option value="Technical & Precise">Technical & Precise</option>
              <option value="Friendly & Motivating">Friendly & Motivating</option>
              <option value="Direct & Action-Oriented">Direct & Action-Oriented</option>
            </select>
          </div>
        </div>

        {/* Content Body: Side-by-side or stacked */}
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-subtle)] grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Box */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xs flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)]">
                Original Draft / Raw Notes
              </label>
              <span className="text-[10.5px] text-[var(--text-muted)] font-mono">{inputContent.length} chars</span>
            </div>
            <textarea
              rows={8}
              value={inputContent}
              onChange={e => setInputContent(e.target.value)}
              placeholder="Paste or type your draft, bullet points, or thoughts here..."
              className="flex-1 w-full p-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-purple-500 font-mono resize-none leading-relaxed"
            />
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Sparkles size={13} className={isLoading ? 'animate-spin' : ''} />
                {isLoading ? 'Synthesizing with Gemini...' : 'Transform with Gemini'}
              </button>
            </div>
          </div>

          {/* Output Box */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-2xs flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles size={12} />
                Gemini Refined Result
              </label>
              {outputContent && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 w-full p-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] font-mono overflow-y-auto leading-relaxed whitespace-pre-wrap min-h-[160px]">
              {outputContent ? (
                outputContent
              ) : (
                <div className="h-full flex items-center justify-center text-center text-[var(--text-muted)] text-xs">
                  {isLoading ? 'Generating refined output...' : 'Click "Transform with Gemini" to generate refined text.'}
                </div>
              )}
            </div>

            {error && (
              <div className="text-xs text-rose-600 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {error}
              </div>
            )}

            {outputContent && onApplyText && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleApply}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition-all"
                >
                  <CheckCircle2 size={13} />
                  Apply to Target Field
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="text-xs text-[var(--text-muted)]">
            Powered by Google Gemini 3.7 Flash
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
