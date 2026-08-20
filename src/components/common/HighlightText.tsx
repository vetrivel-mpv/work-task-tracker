import React from 'react';

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Escapes regex special characters safely
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HighlightText component highlights any matching substring(s) based on search query.
 */
export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  query,
  className = '',
  highlightClassName = 'bg-amber-300/85 dark:bg-amber-400/35 text-amber-950 dark:text-amber-100 font-bold px-0.5 rounded-xs border-b border-amber-500/70 shadow-xs'
}) => {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const trimmedQuery = query.trim();
  const escapedQuery = escapeRegExp(trimmedQuery);

  try {
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return (
      <span className={className}>
        {parts.map((part, index) => {
          if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
            return (
              <mark
                key={index}
                className={highlightClassName}
              >
                {part}
              </mark>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </span>
    );
  } catch {
    return <span className={className}>{text}</span>;
  }
};
