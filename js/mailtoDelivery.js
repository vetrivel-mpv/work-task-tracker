// Shared mailto + clipboard delivery for email drafts.
// Always try to open a mail-app draft first. Clipboard is the fallback
// when the URI is too long — never the primary success path.

export const MAILTO_SAFE_LEN = 1800;

export async function copyTextToClipboard(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){ /* fall through */ }
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){
    return false;
  }
}

function isWindows(){
  if(navigator.userAgentData && navigator.userAgentData.platform){
    return /Win/i.test(navigator.userAgentData.platform);
  }
  return /Win/i.test(navigator.userAgent || '') || /Windows/i.test(navigator.platform || '');
}

function clickHref(href){
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function outlookHref({recipients, subject, body}){
  return `ms-outlook:?to=${encodeURIComponent(recipients)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Opens a mail-app draft when the URI is short enough. On Windows, opens
// ms-outlook: (typical work client) instead of mailto — never both.
// Clipboard is used only when the URI would exceed client limits.
//
// Returns {via: 'mailto'|'clipboard'|'failed', clipboardOk, mailtoOpened, tooLong}
export async function deliverEmailDraft({to, subject, body, forceClipboard = false}){
  const recipients = Array.isArray(to) ? to.filter(Boolean).join(';') : String(to || '');
  const toLine = Array.isArray(to) ? to.filter(Boolean).join('; ') : String(to || '');
  const pasteBlob = `To: ${toLine}\nSubject: ${subject}\n\n${body}`;
  const href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const outlook = outlookHref({recipients, subject, body});
  const tooLong = href.length > MAILTO_SAFE_LEN || (isWindows() && outlook.length > MAILTO_SAFE_LEN);

  if(forceClipboard || tooLong){
    const clipboardOk = await copyTextToClipboard(pasteBlob);
    if(clipboardOk){
      return {via: 'clipboard', clipboardOk: true, mailtoOpened: false, tooLong: true};
    }
    return {via: 'failed', clipboardOk: false, mailtoOpened: false, tooLong: true};
  }

  // Open one draft: Outlook on Windows when the URI is short enough,
  // otherwise mailto. Never fire both (that stacked two compose windows).
  try{
    if(isWindows() && outlook.length <= MAILTO_SAFE_LEN){
      clickHref(outlook);
    }else{
      clickHref(href);
    }
    return {via: 'mailto', clipboardOk: false, mailtoOpened: true, tooLong: false};
  }catch(e){
    return {via: 'failed', clipboardOk: false, mailtoOpened: false, tooLong: false};
  }
}

export function draftDeliveryMessage({label, via, clipboardOk, recipientNote = '', tooLong = false}){
  const note = recipientNote ? ` ${recipientNote}` : '';
  if(via === 'clipboard' || tooLong){
    return `${label} copied to the clipboard because the draft was too large to open in the mail app${note}. Paste into a new message.`;
  }
  if(via === 'mailto'){
    return `${label} opened as a mail-app draft${note}.`;
  }
  if(via === 'failed' && clipboardOk){
    return `${label} copied to the clipboard${note} — the mail app could not be opened.`;
  }
  return `${label} could not be delivered — the mail app did not open and clipboard copy failed. Shorten the draft and try again.`;
}
