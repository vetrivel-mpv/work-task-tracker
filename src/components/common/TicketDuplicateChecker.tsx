import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';
import { checkSingleTicketDuplicate } from '../../services/aiService';

interface TicketDuplicateCheckerProps {
  ticketTitle: string;
  ticketDescription?: string;
  ticketType?: string;
  existingTickets: any[];
  geminiApiKey?: string;
}

export const TicketDuplicateChecker: React.FC<TicketDuplicateCheckerProps> = ({
  ticketTitle,
  ticketDescription = '',
  ticketType = 'Defect',
  existingTickets = [],
  geminiApiKey
}) => {
  const [checking, setChecking] = useState<boolean>(false);
  const [result, setResult] = useState<{
    hasDuplicate?: boolean;
    highestConfidence?: number;
    matches?: Array<{
      existingTicketId: string;
      existingTicketAdoId?: number;
      existingTitle: string;
      confidenceScore: number;
      reason: string;
      recommendation: string;
    }>;
  } | null>(null);

  const handleCheck = async () => {
    if (!ticketTitle || ticketTitle.trim().length < 5) return;
    setChecking(true);
    setResult(null);

    try {
      const res = await checkSingleTicketDuplicate(
        {
          title: ticketTitle.trim(),
          description: ticketDescription,
          type: ticketType
        },
        existingTickets,
        geminiApiKey
      );

      if (res.ok) {
        setResult({
          hasDuplicate: res.hasDuplicate,
          highestConfidence: res.highestConfidence,
          matches: res.matches
        });
      }
    } catch (err) {
      console.warn('Duplicate check error:', err);
    } finally {
      setChecking(false);
    }
  };

  if (!ticketTitle || ticketTitle.trim().length < 5) return null;

  return (
    <div className="mt-2 text-xs">
      {!result && !checking && (
        <button
          type="button"
          onClick={handleCheck}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
        >
          <Sparkles size={13} className="text-rose-500" />
          AI Duplicate Check
        </button>
      )}

      {checking && (
        <div className="inline-flex items-center gap-1.5 text-slate-500 py-1 font-medium">
          <RotateCcw size={13} className="animate-spin text-rose-500" />
          Analyzing backlog for duplicate tickets...
        </div>
      )}

      {result && (
        <div className={`p-3 rounded-xl border mt-1.5 transition-all ${
          result.hasDuplicate 
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200' 
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              {result.hasDuplicate ? (
                <>
                  <ShieldAlert size={15} className="text-rose-600 dark:text-rose-400" />
                  <span>Possible Duplicate Detected ({result.highestConfidence}% match)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>No Duplicates Found (Original Work Item)</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleCheck}
              className="text-[11px] underline opacity-80 hover:opacity-100"
            >
              Re-check
            </button>
          </div>

          {result.matches && result.matches.length > 0 && (
            <div className="mt-2 space-y-1.5 pt-1.5 border-t border-rose-200/60 dark:border-rose-800/60">
              {result.matches.slice(0, 2).map((m, idx) => (
                <div key={idx} className="text-[11px]">
                  <span className="font-semibold">Matching Ticket:</span> {m.existingTicketAdoId ? `#${m.existingTicketAdoId} ` : ''}"{m.existingTitle}"
                  <p className="opacity-90 mt-0.5">{m.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
