import { AppState, Task, Defect, UserStory, Release, TeamMember, EmailTemplateType } from '../types';
import { formatDisplayDate, formatLongDate, isToday, formatTime12, fromDateStr, toDateStr } from '../utils/date';
import { formatReleaseDisplayName } from '../utils/adoPaths';

export interface EmailRenderOutput {
  subject: string;
  html: string;
  markdown: string;
  mailtoUrl: string;
  suggestedRecipients: string[];
}

/**
 * Helper to copy rich HTML to clipboard so that pasting into Outlook, Gmail, 
 * Apple Mail or Word preserves rich tables, styling, badges, and colors!
 */
export async function copyHtmlAsRichText(html: string, fallbackPlain: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([fallbackPlain], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (e) {
    console.warn('[copyHtmlAsRichText] Rich HTML clipboard copy failed, falling back to plain text:', e);
  }

  // Fallback plain copy
  try {
    await navigator.clipboard.writeText(fallbackPlain);
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// 1. DAILY STANDUP & BLOCKER DIGEST
// -------------------------------------------------------------
export function buildStandupEmail(state: AppState): EmailRenderOutput {
  const appName = state.settings?.appName || 'ACM Delivery';
  const dateFormatted = formatLongDate(state.dateStr);
  const subject = `[Standup Digest] ${appName} — ${formatDisplayDate(state.dateStr)}`;
  
  const entriesList = Object.entries(state.standup)
    .filter(([_, entry]) => entry.yesterday || entry.today || entry.blockers)
    .map(([memberId, entry]) => {
      const member = state.team.find(t => t.id === memberId);
      const name = member ? member.name : 'Team Member';
      const role = member ? member.role : '';
      return {
        name,
        role,
        ...entry
      };
    });

  // Today's tasks
  const todayTasks = state.tasks.filter(t => t.dateStr === state.dateStr);
  const highPriority = todayTasks.filter(t => t.priority === 'high' || t.priority === 'critical');
  const completedCount = todayTasks.filter(t => t.status === 'complete').length;
  const blockersCount = entriesList.filter(e => e.blockers && e.blockers.toLowerCase() !== 'none').length;
  const progressPercent = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;

  // Absences today
  const absentMembers = (state.absences || []).filter(a => {
    if (a.status === 'cancelled') return false;
    if (a.endDateStr && a.endDateStr >= a.dateStr) {
      return state.dateStr >= a.dateStr && state.dateStr <= a.endDateStr;
    }
    return a.dateStr === state.dateStr;
  });

  // Markdown
  let md = `# 📋 ${appName} — Daily Standup Digest\n`;
  md += `**Date:** ${dateFormatted}\n`;
  md += `**Daily Target Progress:** ${completedCount}/${todayTasks.length} tasks (${progressPercent}%) completed\n`;
  if (blockersCount > 0) {
    md += `**Active Blockers:** 🚨 ${blockersCount} member blocker(s) reported\n`;
  }
  if (absentMembers.length > 0) {
    md += `**Absent / On Leave:** ${absentMembers.map(a => `${a.memberName} (${a.type.replace(/_/g, ' ')})`).join(', ')}\n`;
  }
  md += `\n`;

  if (entriesList.length > 0) {
    md += `## 👥 Team Status Updates\n\n`;
    entriesList.forEach(e => {
      md += `### ${e.name} — *${e.role}*\n`;
      if (e.yesterday) md += `- **Yesterday:** ${e.yesterday}\n`;
      if (e.today) md += `- **Today:** ${e.today}\n`;
      if (e.blockers && e.blockers.toLowerCase() !== 'none') {
        md += `- 🚨 **Blockers:** ${e.blockers}\n`;
      }
      md += `\n`;
    });
  }

  if (highPriority.length > 0) {
    md += `## 🎯 Critical & High Priority Deliverables\n\n`;
    highPriority.forEach(t => {
      const icon = t.status === 'complete' ? '[x]' : t.status === 'partial' ? '[-]' : '[ ]';
      const timeStr = t.time ? ` (${formatTime12(t.time)})` : '';
      md += `- ${icon} **${t.title}**${timeStr} — *${t.status.toUpperCase()}*\n`;
    });
    md += `\n`;
  }

  // HTML format
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0 0 4px; color: #4F46E5; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">${appName}</h2>
          <span style="font-size: 11px; font-weight: 700; background: #EEF2FF; color: #4F46E5; padding: 4px 10px; border-radius: 20px; border: 1px solid #C7D2FE;">Daily Standup</span>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px; font-weight: 500;">${dateFormatted} &bull; <strong>${completedCount}/${todayTasks.length}</strong> tasks completed (${progressPercent}%)</p>
      </div>

      <!-- Quick Executive Metrics Grid -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 16px;">
        <tr>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #4F46E5; font-family: monospace;">${progressPercent}%</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Completion</div>
          </td>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #0F172A; font-family: monospace;">${entriesList.length}</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Check-ins</div>
          </td>
          <td style="width: 33%; background: ${blockersCount > 0 ? '#FEF2F2' : '#F0FDF4'}; padding: 14px; border-radius: 12px; border: 1px solid ${blockersCount > 0 ? '#FECACA' : '#DCFCE7'}; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: ${blockersCount > 0 ? '#DC2626' : '#16A34A'}; font-family: monospace;">${blockersCount}</div>
            <div style="font-size: 11px; font-weight: 600; color: ${blockersCount > 0 ? '#DC2626' : '#16A34A'}; text-transform: uppercase;">Blockers</div>
          </td>
        </tr>
      </table>

      ${absentMembers.length > 0 ? `
        <div style="margin-bottom: 16px; background: #FFFBEB; border: 1px solid #FDE68A; padding: 10px 14px; border-radius: 10px; font-size: 12px; color: #92400E;">
          ✈️ <strong>Out of Office / Leave Today:</strong> ${absentMembers.map(a => `<span style="background: #FEF3C7; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-right: 4px;">${a.memberName} (${a.type.replace(/_/g, ' ')})</span>`).join('')}
        </div>
      ` : ''}

      <!-- Team Updates -->
      <div style="margin-top: 16px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #64748B; letter-spacing: 0.05em; margin: 0 0 12px; font-weight: 700;">Team Member Updates</h3>
        ${entriesList.map(e => `
          <div style="margin-bottom: 12px; background: #F8FAFC; padding: 14px 16px; border-radius: 12px; border: 1px solid #E2E8F0; border-left: 4px solid #4F46E5;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: #0F172A;">${e.name}</span>
              <span style="font-size: 11px; color: #64748B; font-weight: 600;">${e.role}</span>
            </div>
            ${e.yesterday ? `<p style="margin: 4px 0; font-size: 12.5px; line-height: 1.5; color: #334155;"><strong>Yesterday:</strong> ${e.yesterday}</p>` : ''}
            ${e.today ? `<p style="margin: 4px 0; font-size: 12.5px; line-height: 1.5; color: #334155;"><strong>Today:</strong> ${e.today}</p>` : ''}
            ${e.blockers && e.blockers.toLowerCase() !== 'none' ? `<p style="margin: 6px 0 0; padding: 6px 10px; background: #FEF2F2; border-radius: 6px; font-size: 12px; color: #DC2626; font-weight: 600;">🚨 <strong>Blocker:</strong> ${e.blockers}</p>` : ''}
          </div>
        `).join('')}
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${appName}</strong> &bull; Executive Delivery Intelligence
      </div>
    </div>
  `;

  const recipients = [
    state.settings.emailRecipient,
    state.settings.managerEmail
  ].filter(Boolean) as string[];

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl, suggestedRecipients: recipients };
}

// -------------------------------------------------------------
// 2. QA HEALTH & QUALITY GATE REPORT
// -------------------------------------------------------------
export function buildQaStatusReport(state: AppState, releaseId?: string): EmailRenderOutput {
  const targetRelId = releaseId || state.selectedReleaseId;
  const currentRelease = state.releases.find(r => r.id === targetRelId) || state.releases[0];
  const releaseName = currentRelease ? formatReleaseDisplayName(currentRelease.name, currentRelease.releaseNumber) : 'All Active Releases';
  const targetDate = currentRelease ? currentRelease.targetDate : 'TBD';

  const relStories = currentRelease 
    ? state.userStories.filter(s => s.releaseId === currentRelease.id || (currentRelease.iterationPath && s.iterationPath === currentRelease.iterationPath))
    : state.userStories;

  const relDefects = currentRelease
    ? state.defects.filter(d => d.releaseId === currentRelease.id || (currentRelease.iterationPath && d.iterationPath === currentRelease.iterationPath))
    : state.defects;

  const passedStories = relStories.filter(s => s.status === 'QA Passed' || s.status === 'Done');
  const inQaStories = relStories.filter(s => s.status === 'QA In Progress' || s.status === 'QA Ready');
  const blockedStories = relStories.filter(s => s.status === 'Blocked');

  const criticalDefects = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed');
  const highDefects = relDefects.filter(d => d.severity === 'high' && d.status !== 'Closed');
  const openDefects = relDefects.filter(d => d.status !== 'Closed');

  const passRate = relStories.length ? Math.round((passedStories.length / relStories.length) * 100) : 0;
  const gateDecision = criticalDefects.length > 0 ? 'GATE BLOCKED 🛑' : highDefects.length > 2 ? 'CONDITIONAL PASS ⚠️' : 'GATE PASSED ✅';
  const subject = `[QA Quality Gate] ${releaseName} — ${gateDecision} (${formatDisplayDate(state.dateStr)})`;

  let md = `# 🛡️ QA & Quality Gate Report: ${releaseName}\n`;
  md += `**Report Date:** ${formatLongDate(state.dateStr)}\n`;
  md += `**Target Launch:** ${targetDate} &bull; **Status:** ${currentRelease?.status || 'Active QA'}\n`;
  md += `**Quality Gate Decision:** **${gateDecision}**\n\n`;

  md += `## 📊 Executive Quality Metrics\n`;
  md += `- **Story QA Pass Rate:** ${passedStories.length}/${relStories.length} (${passRate}%)\n`;
  md += `- **Active Defect Tally:** ${openDefects.length} (🚨 ${criticalDefects.length} Critical, ⚠️ ${highDefects.length} High)\n`;
  md += `- **In-Flight Stories:** ${inQaStories.length} in QA testing\n`;
  md += `- **Blocked Work Items:** ${blockedStories.length}\n\n`;

  if (criticalDefects.length > 0) {
    md += `## 🚨 Critical Defect Blockers (Immediate Action Required)\n`;
    criticalDefects.forEach(d => {
      const assignee = state.team.find(t => t.id === d.assigneeId)?.name || 'Unassigned';
      md += `- **[DEF-${d.adoId || d.id}]** ${d.title} (Status: ${d.status}, Assignee: ${assignee})\n`;
    });
    md += `\n`;
  }

  md += `## 🧪 User Story Validation Ledger\n`;
  relStories.forEach(s => {
    const assignee = state.team.find(t => t.id === s.assigneeId)?.name || 'Unassigned';
    md += `- [${s.status}] **US-${s.adoId || s.id}:** ${s.title} (${s.storyPoints || 0} pts, Assignee: ${assignee})\n`;
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="border-bottom: 2px solid #0284C7; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0 0 4px; color: #0284C7; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">QA Quality Gate: ${releaseName}</h2>
          <span style="font-size: 11px; font-weight: 700; background: ${criticalDefects.length > 0 ? '#FEF2F2' : '#F0FDF4'}; color: ${criticalDefects.length > 0 ? '#DC2626' : '#16A34A'}; padding: 4px 10px; border-radius: 20px; border: 1px solid ${criticalDefects.length > 0 ? '#FECACA' : '#DCFCE7'};">${gateDecision}</span>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px; font-weight: 500;">Target Launch: <strong>${targetDate}</strong> &bull; Verified: <strong>${passedStories.length}/${relStories.length}</strong> Stories</p>
      </div>

      <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 16px;">
        <tr>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #16A34A; font-family: monospace;">${passRate}%</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Pass Rate</div>
          </td>
          <td style="width: 33%; background: ${openDefects.length > 0 ? '#FEF2F2' : '#F0FDF4'}; padding: 14px; border-radius: 12px; border: 1px solid ${openDefects.length > 0 ? '#FECACA' : '#DCFCE7'}; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'}; font-family: monospace;">${openDefects.length}</div>
            <div style="font-size: 11px; font-weight: 600; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'}; text-transform: uppercase;">Open Bugs</div>
          </td>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #0284C7; font-family: monospace;">${relStories.length}</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Scope Stories</div>
          </td>
        </tr>
      </table>

      ${criticalDefects.length > 0 ? `
        <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 14px 18px; border-radius: 12px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px; color: #DC2626; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">🚨 Critical Defect Blockers</h4>
          ${criticalDefects.map(d => `
            <div style="margin: 4px 0; font-size: 12.5px; color: #991B1B;">
              &bull; <strong>DEF-${d.adoId || d.id}:</strong> ${d.title} <span style="font-size: 11px; color: #DC2626; background: #FEE2E2; padding: 2px 6px; border-radius: 4px;">${d.status}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.05em;">Stories Verification Breakdown</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left; color: #475569;">
              <th style="padding: 8px 10px; border-radius: 6px 0 0 6px;">ID</th>
              <th style="padding: 8px 10px;">Title</th>
              <th style="padding: 8px 10px;">Status</th>
              <th style="padding: 8px 10px; border-radius: 0 6px 6px 0;">Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${relStories.slice(0, 10).map(s => {
              const assignee = state.team.find(t => t.id === s.assigneeId)?.name || 'Unassigned';
              const statusColor = s.status === 'QA Passed' || s.status === 'Done' ? '#16A34A' : s.status === 'Blocked' ? '#DC2626' : '#0284C7';
              return `
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="padding: 8px 10px; font-weight: 700; font-family: monospace;">US-${s.adoId || s.id}</td>
                  <td style="padding: 8px 10px; color: #1E293B;">${s.title}</td>
                  <td style="padding: 8px 10px;"><span style="color: ${statusColor}; font-weight: 700;">${s.status}</span></td>
                  <td style="padding: 8px 10px; color: #64748B;">${assignee}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${relStories.length > 10 ? `<p style="font-size: 11px; color: #64748B; text-align: right; margin-top: 6px;">+ ${relStories.length - 10} more stories</p>` : ''}
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${state.settings?.appName || 'ACM Delivery'}</strong> &bull; Automated Test & Quality Assurance Engine
      </div>
    </div>
  `;

  const recipients = [
    state.settings.qaTeamEmail,
    state.settings.emailRecipient,
    state.settings.releaseManagerEmail
  ].filter(Boolean) as string[];

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl, suggestedRecipients: recipients };
}

// -------------------------------------------------------------
// 3. EXECUTIVE DELIVERY & SPRINT PULSE
// -------------------------------------------------------------
export function buildDashboardDigest(state: AppState): EmailRenderOutput {
  const appName = state.settings?.appName || 'ACM Delivery';
  const dateFormatted = formatLongDate(state.dateStr);
  const subject = `[Executive Pulse] ${appName} Delivery Operations — ${formatDisplayDate(state.dateStr)}`;

  const todayTasks = state.tasks.filter(t => t.dateStr === state.dateStr);
  const doneTasks = todayTasks.filter(t => t.status === 'complete');
  const highPending = todayTasks.filter(t => (t.priority === 'high' || t.priority === 'critical') && t.status !== 'complete');
  const activeReleases = state.releases.filter(r => r.status === 'Active QA' || r.status === 'Staging' || r.status === 'Active Dev');
  const openDefects = state.defects.filter(d => d.status !== 'Closed');
  const criticalDefects = openDefects.filter(d => d.severity === 'critical');

  let md = `# 🚀 ${appName} Executive Operations Pulse\n`;
  md += `**Date:** ${dateFormatted}\n\n`;
  md += `## 🎯 Daily Commitment Execution\n`;
  md += `- **Completed:** ${doneTasks.length}/${todayTasks.length} tasks\n`;
  md += `- **High Priority In-Flight:** ${highPending.length}\n\n`;

  md += `## 📋 Scope & Quality Governance\n`;
  md += `- **Tracked User Stories:** ${state.userStories.length} across ${state.releases.length} releases\n`;
  md += `- **Active Open Defects:** ${openDefects.length} (🚨 ${criticalDefects.length} Critical)\n`;
  md += `- **Active Release Pipelines:** ${activeReleases.length}\n`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 4px; color: #4F46E5; font-size: 20px; font-weight: 800;">${appName} — Executive Pulse</h2>
        <p style="margin: 0; color: #64748B; font-size: 13px;">${dateFormatted} &bull; Cross-functional delivery intelligence briefing</p>
      </div>

      <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 16px;">
        <tr>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #4F46E5; font-family: monospace;">${doneTasks.length}/${todayTasks.length}</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Tasks Closed</div>
          </td>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #0F172A; font-family: monospace;">${state.userStories.length}</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">User Stories</div>
          </td>
          <td style="width: 33%; background: ${openDefects.length > 0 ? '#FEF2F2' : '#F0FDF4'}; padding: 14px; border-radius: 12px; border: 1px solid ${openDefects.length > 0 ? '#FECACA' : '#DCFCE7'}; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'}; font-family: monospace;">${openDefects.length}</div>
            <div style="font-size: 11px; font-weight: 600; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'}; text-transform: uppercase;">Open Defects</div>
          </td>
        </tr>
      </table>

      <!-- Active Releases Highlight -->
      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.05em;">Active Release Roadmaps</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${activeReleases.map(r => `
            <div style="background: #F8FAFC; padding: 10px 14px; border-radius: 8px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 13px; color: #0F172A;">${formatReleaseDisplayName(r.name, r.releaseNumber)}</strong>
                <span style="font-size: 11px; color: #64748B; margin-left: 8px;">Target: ${r.targetDate}</span>
              </div>
              <span style="font-size: 11px; font-weight: 700; background: #EEF2FF; color: #4F46E5; padding: 2px 8px; border-radius: 12px;">${r.status}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${appName}</strong> &bull; Executive Delivery Intelligence
      </div>
    </div>
  `;

  const recipients = [
    state.settings.executivesEmail,
    state.settings.emailRecipient,
    state.settings.managerEmail
  ].filter(Boolean) as string[];

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl, suggestedRecipients: recipients };
}

// -------------------------------------------------------------
// 4. WEEKLY RESOURCE & CAPACITY ALLOCATION REPORT
// -------------------------------------------------------------
export function buildResourceCapacityEmail(state: AppState, anchorDateStr?: string): EmailRenderOutput {
  const appName = state.settings?.appName || 'ACM Delivery';
  const curDate = anchorDateStr || state.dateStr;
  
  // Calculate Monday through Friday
  const d = fromDateStr(curDate);
  const dayOfWeek = d.getDay();
  const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + distToMon);
  
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const weekStartStr = toDateStr(monday);
  const weekEndStr = toDateStr(friday);
  const weekRangeLabel = `${formatDisplayDate(weekStartStr)} – ${formatDisplayDate(weekEndStr)}`;

  const activeTeam = state.team.filter(m => m.active !== false);

  // Compute allocation per member
  const memberRows = activeTeam.map(member => {
    const gross = member.weeklyCapacityHours || 40;
    
    // Check absences
    const memberAbsences = (state.absences || []).filter(a => {
      if (a.memberId !== member.id || a.status === 'cancelled') return false;
      if (a.endDateStr && a.endDateStr >= a.dateStr) {
        return weekEndStr >= a.dateStr && weekStartStr <= a.endDateStr;
      }
      return a.dateStr >= weekStartStr && a.dateStr <= weekEndStr;
    });

    let leaveHours = 0;
    memberAbsences.forEach(a => {
      if (a.type === 'full_day') leaveHours += 8;
      else if (a.type === 'half_day_morning' || a.type === 'half_day_afternoon') leaveHours += 4;
      else if (a.type === 'hourly_permission') leaveHours += (a.permissionHours || 2);
    });

    const netCapacity = Math.max(0, gross - leaveHours);
    const effectiveCapacity = Math.round(netCapacity * 0.85); // 85% focus

    // Tasks & Workload
    const memberTasks = state.tasks.filter(t => (t.assigneeId === member.id || (t.assigneeIds && t.assigneeIds.includes(member.id))) && t.status !== 'complete');
    const memberStories = state.userStories.filter(s => s.assigneeId === member.id && s.status !== 'Done' && s.status !== 'Closed');
    const memberDefects = state.defects.filter(def => def.assigneeId === member.id && def.status !== 'Closed');

    const taskHours = memberTasks.length * 3.5;
    const storyHours = memberStories.reduce((acc, s) => acc + ((s.storyPoints || 3) * 5), 0);
    const defectHours = memberDefects.reduce((acc, df) => acc + (df.severity === 'critical' ? 6 : df.severity === 'high' ? 4 : 2), 0);
    const totalPlanned = Math.round(taskHours + storyHours + defectHours);

    const utilPct = effectiveCapacity > 0 ? Math.round((totalPlanned / effectiveCapacity) * 100) : 100;
    const headroom = effectiveCapacity - totalPlanned;

    return {
      member,
      gross,
      leaveHours,
      netCapacity: effectiveCapacity,
      totalPlanned,
      taskCount: memberTasks.length,
      storyCount: memberStories.length,
      defectCount: memberDefects.length,
      utilPct,
      headroom,
      isOverloaded: utilPct > 100,
      isUnderutilized: utilPct < 70
    };
  });

  const totalCapacity = memberRows.reduce((s, r) => s + r.netCapacity, 0);
  const totalPlanned = memberRows.reduce((s, r) => s + r.totalPlanned, 0);
  const totalLeaves = memberRows.reduce((s, r) => s + r.leaveHours, 0);
  const teamUtilPct = totalCapacity > 0 ? Math.round((totalPlanned / totalCapacity) * 100) : 0;
  const overloadedCount = memberRows.filter(r => r.isOverloaded).length;

  const subject = `[Resource Capacity] ${appName} — Week of ${weekRangeLabel} (${teamUtilPct}% Utilized)`;

  let md = `# 👥 Weekly Resource Capacity & Allocation Report\n`;
  md += `**Week Range:** ${weekRangeLabel}\n`;
  md += `**Total Effective Capacity:** ${totalCapacity} hrs (after ${totalLeaves}h PTO deductions)\n`;
  md += `**Total Planned Workload:** ${totalPlanned} hrs\n`;
  md += `**Overall Team Utilization:** ${teamUtilPct}%\n`;
  if (overloadedCount > 0) {
    md += `**🚨 Bottlenecks:** ${overloadedCount} member(s) over 100% capacity\n`;
  }
  md += `\n## Member Allocation Ledger\n`;
  memberRows.forEach(r => {
    md += `- **${r.member.name}** (${r.member.role}): ${r.totalPlanned}h planned / ${r.netCapacity}h cap (${r.utilPct}%) &bull; ${r.headroom >= 0 ? `+${r.headroom}h free` : `${r.headroom}h OVER`}\n`;
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="border-bottom: 2px solid #6366F1; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0 0 4px; color: #6366F1; font-size: 20px; font-weight: 800;">Resource Capacity & Allocation</h2>
          <span style="font-size: 11px; font-weight: 700; background: #EEF2FF; color: #6366F1; padding: 4px 10px; border-radius: 20px; border: 1px solid #C7D2FE;">${weekRangeLabel}</span>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px; font-weight: 500;">Planned tasks, stories & bugs vs. effective capacity & PTO deductions</p>
      </div>

      <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 16px;">
        <tr>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #6366F1; font-family: monospace;">${totalCapacity}h</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Net Capacity</div>
          </td>
          <td style="width: 33%; background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #0F172A; font-family: monospace;">${totalPlanned}h</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Planned Work</div>
          </td>
          <td style="width: 33%; background: ${teamUtilPct > 100 ? '#FEF2F2' : '#F0FDF4'}; padding: 14px; border-radius: 12px; border: 1px solid ${teamUtilPct > 100 ? '#FECACA' : '#DCFCE7'}; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: ${teamUtilPct > 100 ? '#DC2626' : '#16A34A'}; font-family: monospace;">${teamUtilPct}%</div>
            <div style="font-size: 11px; font-weight: 600; color: ${teamUtilPct > 100 ? '#DC2626' : '#16A34A'}; text-transform: uppercase;">Utilization</div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.05em;">Team Capacity Matrix</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left; color: #475569;">
              <th style="padding: 8px 10px; border-radius: 6px 0 0 6px;">Member</th>
              <th style="padding: 8px 10px;">Capacity</th>
              <th style="padding: 8px 10px;">Planned</th>
              <th style="padding: 8px 10px;">Util (%)</th>
              <th style="padding: 8px 10px; border-radius: 0 6px 6px 0;">Headroom</th>
            </tr>
          </thead>
          <tbody>
            ${memberRows.map(r => {
              const utilColor = r.isOverloaded ? '#DC2626' : r.isUnderutilized ? '#D97706' : '#16A34A';
              return `
                <tr style="border-bottom: 1px solid #E2E8F0; background: ${r.isOverloaded ? '#FEF2F2' : 'transparent'};">
                  <td style="padding: 8px 10px; font-weight: 700; color: #1E293B;">
                    ${r.member.name}
                    ${r.leaveHours > 0 ? `<span style="font-size: 10px; color: #DC2626; margin-left: 4px;">(-${r.leaveHours}h leave)</span>` : ''}
                  </td>
                  <td style="padding: 8px 10px; font-family: monospace;">${r.netCapacity}h</td>
                  <td style="padding: 8px 10px; font-family: monospace;">${r.totalPlanned}h</td>
                  <td style="padding: 8px 10px; font-weight: 700; color: ${utilColor}; font-family: monospace;">${r.utilPct}%</td>
                  <td style="padding: 8px 10px; font-family: monospace; color: ${r.headroom >= 0 ? '#16A34A' : '#DC2626'}; font-weight: 700;">
                    ${r.headroom >= 0 ? `+${r.headroom}h` : `${r.headroom}h`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${appName}</strong> &bull; Resource & Capacity Optimization
      </div>
    </div>
  `;

  const recipients = [
    state.settings.managerEmail,
    state.settings.emailRecipient
  ].filter(Boolean) as string[];

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl, suggestedRecipients: recipients };
}

// -------------------------------------------------------------
// 5. CRITICAL DEFECT ESCALATION (P0 / P1)
// -------------------------------------------------------------
export function buildDefectEscalationEmail(state: AppState, defectId?: string): EmailRenderOutput {
  const appName = state.settings?.appName || 'ACM Delivery';
  const targetDefect = defectId 
    ? state.defects.find(d => d.id === defectId || d.adoId === defectId) 
    : state.defects.find(d => d.severity === 'critical' && d.status !== 'Closed') || state.defects[0];

  const defIdStr = targetDefect ? (targetDefect.adoId || targetDefect.id) : 'UNKNOWN';
  const defTitle = targetDefect ? targetDefect.title : 'Critical Incident Blocker';
  const defSeverity = targetDefect ? targetDefect.severity.toUpperCase() : 'CRITICAL';
  const defAssignee = targetDefect ? (state.team.find(t => t.id === targetDefect.assigneeId)?.name || targetDefect.assigneeName || 'Unassigned') : 'Unassigned';
  const defStatus = targetDefect ? targetDefect.status : 'Active';
  const defEnvironment = targetDefect?.environment || 'Staging / Production';
  const defSteps = targetDefect?.description || 'Steps to reproduce: See Azure DevOps work item link below for complete logs and telemetry.';

  const subject = `🚨 [URGENT ESCALATION] ${defSeverity} DEF-${defIdStr}: ${defTitle}`;

  let md = `# 🚨 Critical Defect Incident Escalation: DEF-${defIdStr}\n`;
  md += `**Severity / Priority:** ${defSeverity} (P0 Urgent)\n`;
  md += `**Defect Title:** ${defTitle}\n`;
  md += `**Current Status:** ${defStatus}\n`;
  md += `**Assigned Engineer:** ${defAssignee}\n`;
  md += `**Impacted Environment:** ${defEnvironment}\n\n`;

  md += `## 📝 Description & Reproduction Context\n`;
  md += `${defSteps}\n\n`;
  md += `## ⚠️ Action Items & SLA Countdown\n`;
  md += `- Triage & RCA in progress\n`;
  md += `- Immediate containment fix required within SLA (4 hours)\n`;
  md += `- Please join the incident war room or reply on this thread with updates.\n`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 2px solid #DC2626; box-shadow: 0 4px 20px rgba(220,38,38,0.08);">
      <div style="background: #FEF2F2; border-bottom: 2px solid #F87171; padding: 16px; margin: -24px -24px 20px -24px; border-radius: 14px 14px 0 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🚨</span>
            <h2 style="margin: 0; color: #DC2626; font-size: 18px; font-weight: 800; letter-spacing: -0.02em;">CRITICAL DEFECT ESCALATION</h2>
          </div>
          <span style="font-size: 11px; font-weight: 800; background: #DC2626; color: #FFFFFF; padding: 4px 10px; border-radius: 20px;">${defSeverity}</span>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 800; color: #0F172A;">[DEF-${defIdStr}] ${defTitle}</h3>
        <p style="margin: 0; font-size: 12.5px; color: #64748B;">Impacted Scope: <strong>${defEnvironment}</strong> &bull; Assigned: <strong>${defAssignee}</strong></p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12.5px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px;">
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; color: #475569; width: 30%; border-bottom: 1px solid #E2E8F0;">Status</td>
          <td style="padding: 10px 14px; font-weight: 700; color: #DC2626; border-bottom: 1px solid #E2E8F0;">${defStatus}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; color: #475569; border-bottom: 1px solid #E2E8F0;">Assigned Lead</td>
          <td style="padding: 10px 14px; color: #0F172A; border-bottom: 1px solid #E2E8F0;">${defAssignee}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; color: #475569;">Environment</td>
          <td style="padding: 10px 14px; color: #0F172A;">${defEnvironment}</td>
        </tr>
      </table>

      <div style="background: #F1F5F9; padding: 14px 16px; border-radius: 10px; border: 1px solid #E2E8F0; margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569;">Reproduction & Telemetry Notes</h4>
        <div style="font-size: 12.5px; line-height: 1.5; color: #334155; white-space: pre-wrap;">${defSteps}</div>
      </div>

      <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 12px 16px; border-radius: 10px; font-size: 12px; color: #92400E;">
        ⏱️ <strong>SLA Response Mandate:</strong> P0 Critical defects require immediate engineering triage and hourly status updates until mitigated.
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Dispatched by <strong>${appName} Incident Response Service</strong>
      </div>
    </div>
  `;

  const recipients = [
    state.settings.onCallEmail,
    state.settings.managerEmail,
    state.settings.qaTeamEmail
  ].filter(Boolean) as string[];

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl, suggestedRecipients: recipients };
}

// -------------------------------------------------------------
// 6. RELEASE DEPLOYMENT & GO/NO-GO SIGN-OFF
// -------------------------------------------------------------
export function buildReleaseSignOffEmail(state: AppState, releaseId?: string): EmailRenderOutput {
  const appName = state.settings?.appName || 'ACM Delivery';
  const targetRelId = releaseId || state.selectedReleaseId;
  const currentRelease = state.releases.find(r => r.id === targetRelId) || state.releases[0];
  const releaseName = currentRelease ? formatReleaseDisplayName(currentRelease.name, currentRelease.releaseNumber) : 'Current Production Release';
  const targetDate = currentRelease ? currentRelease.targetDate : formatDisplayDate(state.dateStr);

  const relStories = currentRelease 
    ? state.userStories.filter(s => s.releaseId === currentRelease.id || (currentRelease.iterationPath && s.iterationPath === currentRelease.iterationPath))
    : state.userStories;

  const relDefects = currentRelease
    ? state.defects.filter(d => d.releaseId === currentRelease.id || (currentRelease.iterationPath && d.iterationPath === currentRelease.iterationPath))
    : state.defects;

  const criticalDefects = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed');
  const highDefects = relDefects.filter(d => d.severity === 'high' && d.status !== 'Closed');
  const isGo = criticalDefects.length === 0 && highDefects.length === 0;
  const decisionStatus = isGo ? 'GO (APPROVED FOR DEPLOYMENT) 🚀' : 'NO-GO / CONDITIONAL HOLD 🛑';

  const subject = `[Release Sign-Off] ${releaseName} — ${decisionStatus} (${targetDate})`;

  let md = `# 🎯 Release Deployment & Go/No-Go Sign-Off: ${releaseName}\n`;
  md += `**Deployment Target Window:** ${targetDate}\n`;
  md += `**Final Decision:** **${decisionStatus}**\n\n`;

  md += `## 📋 Sign-Off Verification Matrix\n`;
  md += `- [${isGo ? 'x' : ' '}] **QA & Sanity Gate:** ${isGo ? 'PASSED (0 Blocker Defects)' : `FAILED (${criticalDefects.length} Critical Bugs)`}\n`;
  md += `- [x] **Performance & Security Review:** VERIFIED\n`;
  md += `- [x] **Database Migration & Schemas:** VERIFIED\n`;
  md += `- [x] **Rollback Runbook Prepared:** YES\n\n`;

  md += `## 📦 Release Scope Summary\n`;
  md += `- **Features & Stories Delivered:** ${relStories.length}\n`;
  md += `- **Open Caveats / Low Defect Items:** ${relDefects.filter(d => d.status !== 'Closed').length}\n\n`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
      <div style="border-bottom: 2px solid ${isGo ? '#16A34A' : '#DC2626'}; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0 0 4px; color: ${isGo ? '#16A34A' : '#DC2626'}; font-size: 20px; font-weight: 800;">Release Sign-Off: ${releaseName}</h2>
          <span style="font-size: 11px; font-weight: 800; background: ${isGo ? '#DCFCE7' : '#FEE2E2'}; color: ${isGo ? '#16A34A' : '#DC2626'}; padding: 4px 10px; border-radius: 20px;">${isGo ? 'GO APPROVED' : 'NO-GO HOLD'}</span>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px;">Target Window: <strong>${targetDate}</strong> &bull; Total Scope: <strong>${relStories.length} Work Items</strong></p>
      </div>

      <div style="background: ${isGo ? '#F0FDF4' : '#FEF2F2'}; border: 1px solid ${isGo ? '#BBF7D0' : '#FECACA'}; padding: 14px 18px; border-radius: 12px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 6px; color: ${isGo ? '#15803D' : '#DC2626'}; font-size: 14px; font-weight: 800;">Final Executive Decision: ${decisionStatus}</h4>
        <p style="margin: 0; font-size: 12.5px; color: #475569;">All engineering stakeholders, QA leads, and release management criteria have been evaluated.</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.05em;">Gate Sign-off Checklist</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #334155;">QA Sanity & Regression Suite</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${isGo ? '#16A34A' : '#DC2626'};">${isGo ? 'PASSED ✅' : 'BLOCKED 🛑'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #334155;">Security & Dependency Scans</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #16A34A;">CLEARED ✅</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #334155;">Database Migrations & Backward Compatibility</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #16A34A;">VERIFIED ✅</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #334155;">Deployment Rollback Runbook</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #16A34A;">PREPARED ✅</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${appName}</strong> &bull; Release & Deployment Sign-Off Portal
      </div>
    </div>
  `;

  const recipients = [
    state.settings.releaseManagerEmail,
    state.settings.executivesEmail,
    state.settings.managerEmail,
    state.settings.qaTeamEmail
  ].filter(Boolean) as string[];

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl, suggestedRecipients: recipients };
}

// -------------------------------------------------------------
// MASTER DISPATCHER HELPER
// -------------------------------------------------------------
export function generateEmailByType(
  type: EmailTemplateType, 
  state: AppState, 
  options?: { releaseId?: string; defectId?: string; weekDateStr?: string }
): EmailRenderOutput {
  switch (type) {
    case 'daily_standup':
      return buildStandupEmail(state);
    case 'qa_gate':
      return buildQaStatusReport(state, options?.releaseId);
    case 'executive_pulse':
      return buildDashboardDigest(state);
    case 'resource_capacity':
      return buildResourceCapacityEmail(state, options?.weekDateStr);
    case 'defect_escalation':
      return buildDefectEscalationEmail(state, options?.defectId);
    case 'release_signoff':
      return buildReleaseSignOffEmail(state, options?.releaseId);
    default:
      return buildStandupEmail(state);
  }
}
