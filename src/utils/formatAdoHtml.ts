/**
 * Utility functions to clean, decode, and format Azure DevOps rich text and HTML content.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#x2F;': '/',
  '&#47;': '/',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&bull;': '•',
  '&middot;': '·',
  '&ndash;': '–',
  '&mdash;': '—'
};

/**
 * Decodes HTML entities (both named and numeric).
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str.replace(/&[a-z0-9#x]+;/gi, (match) => {
    const lower = match.toLowerCase();
    if (HTML_ENTITIES[lower]) {
      return HTML_ENTITIES[lower];
    }
    if (match.startsWith('&#x') || match.startsWith('&#X')) {
      const hex = parseInt(match.slice(3, -1), 16);
      if (!isNaN(hex)) return String.fromCharCode(hex);
    } else if (match.startsWith('&#')) {
      const dec = parseInt(match.slice(2, -1), 10);
      if (!isNaN(dec)) return String.fromCharCode(dec);
    }
    return match;
  });
}

/**
 * Converts ADO raw HTML markup into clean readable text without raw tags.
 * Preserves links, list items, and paragraph breaks.
 */
export function cleanAdoHtml(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';

  let text = str;

  // 1. If it contains data URIs, replace them
  text = text.replace(/src=["']data:image\/[^"']+["']/gi, 'src="[image]"');

  // 2. Remove script and style tags
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
             .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // 3. Convert <a> tags to link texts or URLs
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, anchorText) => {
    const cleanText = anchorText.replace(/<[^>]+>/g, '').trim();
    const cleanHref = (href || '').trim();
    if (!cleanText || cleanText === cleanHref) {
      return cleanHref;
    }
    return `${cleanText} (${cleanHref})`;
  });

  // 4. Line breaking elements
  text = text.replace(/<\/?(p|div|tr|h[1-6]|pre|blockquote)[^>]*>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/(td|th)>/gi, '  ');

  // 5. Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 6. Decode entities
  text = decodeHtmlEntities(text);

  // 7. Clean up excessive whitespace
  return text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
