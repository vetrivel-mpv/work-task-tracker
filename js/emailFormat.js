// Shared plain-text table formatting for the mailto-drafted emails.
// `mailto:` bodies are plain text, and most mail clients (Outlook
// included) display plain text in a proportional font by default — so
// padding cells with spaces to a fixed character width doesn't actually
// line columns up; character widths vary. Tab characters do, because
// plain-text renderers advance to a fixed tab stop regardless of font,
// the same way a text editor's tab key does. Join cells with a tab and
// they land in the same visual columns without needing any particular
// font — the standard way to fake a table in a plain-text email.
export function tableRow(cells){
  return cells.join('\t');
}

export function divider(width = 40){
  return '-'.repeat(width);
}
