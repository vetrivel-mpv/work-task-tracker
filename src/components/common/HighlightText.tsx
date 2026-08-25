import React from 'react';
import { cleanAdoHtml } from '../../utils/formatAdoHtml';
import { ExternalLink } from 'lucide-react';

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
  highlightClassName?: string;
  autoLink?: boolean;
}

/**
 * Escapes regex special characters safely
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * URL matching regular expression
 */
const URL_REGEX = /(https?:\/\/[^\s<>'"]+)/gi;

/**
 * HighlightText component highlights search matches and cleans/linkifies ADO rich text.
 */
export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  query,
  className = '',
  highlightClassName = 'bg-amber-300/85 dark:bg-amber-400/35 text-amber-950 dark:text-amber-100 font-bold px-0.5 rounded-xs border-b border-amber-500/70 shadow-xs',
  autoLink = true
}) => {
  if (!text) return null;

  // Clean any raw HTML or HTML entities from ADO
  const cleanedText = text.includes('<') || text.includes('&') ? cleanAdoHtml(text) : text;

  // Helper to render matching query text
  const renderHighlighted = (segment: string, keyPrefix: string) => {
    if (!query || !query.trim()) {
      return <React.Fragment key={keyPrefix}>{segment}</React.Fragment>;
    }

    const trimmedQuery = query.trim();
    const escapedQuery = escapeRegExp(trimmedQuery);

    try {
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = segment.split(regex);

      return (
        <React.Fragment key={keyPrefix}>
          {parts.map((part, index) => {
            if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
              return (
                <mark
                  key={`${keyPrefix}-${index}`}
                  className={highlightClassName}
                >
                  {part}
                </mark>
              );
            }
            return <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>;
          })}
        </React.Fragment>
      );
    } catch {
      return <React.Fragment key={keyPrefix}>{segment}</React.Fragment>;
    }
  };

  if (!autoLink) {
    return <span className={className}>{renderHighlighted(cleanedText, 'raw')}</span>;
  }

  // Parse text for URLs to render clickable links
  const segments = cleanedText.split(URL_REGEX);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.match(/^https?:\/\//i)) {
          return (
            <a
              key={i}
              href={seg}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--primary)] hover:underline inline-flex items-center gap-0.5 break-all font-semibold"
              title={seg}
            >
              <span>{seg}</span>
              <ExternalLink size={10} className="inline-block flex-shrink-0 ml-0.5 opacity-80" />
            </a>
          );
        }
        return renderHighlighted(seg, `seg-${i}`);
      })}
    </span>
  );
};

