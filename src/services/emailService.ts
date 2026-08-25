import { AppState, Task, Defect, UserStory, Release, TeamMember } from '../types';
import { formatDisplayDate, formatLongDate, isToday, formatTime12 } from '../utils/date';
import { formatReleaseDisplayName } from '../utils/adoPaths';

export function buildStandupEmail(state: AppState): {
  subject: string;
  html: string;
  markdown: string;
  mailtoUrl: string;
} {
  const appName = state.settings?.appName || 'ACM (AT&T Connection Manager) Delivery';
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
  const highPriority = todayTasks.filter(t => t.priority === 'high');
  const completedCount = todayTasks.filter(t => t.status === 'complete').length;
  const blockersCount = entriesList.filter(e => e.blockers && e.blockers.toLowerCase() !== 'none').length;
  const progressPercent = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;

  // Markdown format
  let md = `# 📋 ${appName} — Daily Standup Digest\n`;
  md += `**Date:** ${dateFormatted}\n`;
  md += `**Daily Target Progress:** ${completedCount}/${todayTasks.length} tasks (${progressPercent}%) completed\n`;
  if (blockersCount > 0) {
    md += `**Active Blockers:** 🚨 ${blockersCount} member blocker(s) reported\n`;
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

  // HTML format (optimized for email clients and in-app preview)
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0 0 4px; color: #4F46E5; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">${appName}</h2>
          <span style="font-size: 11px; font-weight: 700; background: #EEF2FF; color: #4F46E5; padding: 4px 10px; border-radius: 20px; border: 1px solid #C7D2FE;">Daily Standup</span>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px; font-weight: 500;">${dateFormatted} &bull; <strong>${completedCount}/${todayTasks.length}</strong> tasks completed (${progressPercent}%)</p>
      </div>

      <!-- Quick Executive Metrics -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #4F46E5;">${progressPercent}%</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Completion</div>
        </div>
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #0F172A;">${entriesList.length}</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Check-ins</div>
        </div>
        <div style="background: ${blockersCount > 0 ? '#FEF2F2' : '#F0FDF4'}; padding: 12px; border-radius: 12px; border: 1px solid ${blockersCount > 0 ? '#FECACA' : '#DCFCE7'}; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: ${blockersCount > 0 ? '#DC2626' : '#16A34A'};">${blockersCount}</div>
          <div style="font-size: 11px; font-weight: 600; color: ${blockersCount > 0 ? '#DC2626' : '#16A34A'}; text-transform: uppercase;">Blockers</div>
        </div>
      </div>

      ${entriesList.map(e => `
        <div style="margin-bottom: 16px; background: #F8FAFC; padding: 14px 18px; border-radius: 12px; border: 1px solid #E2E8F0; border-left: 4px solid #4F46E5;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #0F172A;">${e.name}</h4>
            <span style="font-size: 11px; color: #64748B; font-weight: 600;">${e.role}</span>
          </div>
          ${e.yesterday ? `<p style="margin: 4px 0; font-size: 12.5px; line-height: 1.5; color: #334155;"><strong>Yesterday:</strong> ${e.yesterday}</p>` : ''}
          ${e.today ? `<p style="margin: 4px 0; font-size: 12.5px; line-height: 1.5; color: #334155;"><strong>Today:</strong> ${e.today}</p>` : ''}
          ${e.blockers && e.blockers.toLowerCase() !== 'none' ? `<p style="margin: 6px 0 0; padding: 6px 10px; background: #FEF2F2; border-radius: 6px; font-size: 12px; color: #DC2626; font-weight: 600;">🚨 <strong>Blocker:</strong> ${e.blockers}</p>` : ''}
        </div>
      `).join('')}

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${appName}</strong> &bull; Executive Delivery Intelligence
      </div>
    </div>
  `;

  const recipient = state.settings.emailRecipient || state.settings.managerEmail || '';
  const bodyEncoded = encodeURIComponent(md);
  const subjectEncoded = encodeURIComponent(subject);
  const mailtoUrl = `mailto:${recipient}?subject=${subjectEncoded}&body=${bodyEncoded}`;

  return { subject, html, markdown: md, mailtoUrl };
}

export function buildQaStatusReport(state: AppState, releaseId?: string): {
  subject: string;
  html: string;
  markdown: string;
  mailtoUrl: string;
} {
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
  const subject = `[QA Health Gate] ${releaseName} — Test Sanity & Defect Readiness (${formatDisplayDate(state.dateStr)})`;

  let md = `# 🛡️ QA & Release Gate Status: ${releaseName}\n`;
  md += `**Report Date:** ${formatLongDate(state.dateStr)}\n`;
  md += `**Target Launch Date:** ${targetDate}\n`;
  md += `**Release Lifecycle:** ${currentRelease?.status || 'Active QA'}\n\n`;

  md += `## 📊 Executive Quality Gate Summary\n`;
  md += `- **Story QA Pass Rate:** ${passedStories.length}/${relStories.length} (${passRate}%)\n`;
  md += `- **Active Defects:** ${openDefects.length} (🚨 ${criticalDefects.length} Critical, ⚠️ ${highDefects.length} High)\n`;
  md += `- **Blocked Work Items:** ${blockedStories.length}\n\n`;

  if (criticalDefects.length > 0) {
    md += `## 🚨 Critical Defect Blockers (Action Required)\n`;
    criticalDefects.forEach(d => {
      const assignee = state.team.find(t => t.id === d.assigneeId)?.name || 'Unassigned';
      md += `- **[DEF-${d.adoId || d.id}]** ${d.title} (Status: ${d.status}, Severity: Critical, Assignee: ${assignee})\n`;
    });
    md += `\n`;
  }

  md += `## 🧪 User Story Validation Progress\n`;
  relStories.forEach(s => {
    const assignee = state.team.find(t => t.id === s.assigneeId)?.name || 'Unassigned';
    md += `- [${s.status}] **US-${s.adoId || s.id}:** ${s.title} (${s.storyPoints || 0} pts, Assignee: ${assignee})\n`;
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="border-bottom: 2px solid #0284C7; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0 0 4px; color: #0284C7; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">QA Gate: ${releaseName}</h2>
          <span style="font-size: 11px; font-weight: 700; background: #E0F2FE; color: #0284C7; padding: 4px 10px; border-radius: 20px; border: 1px solid #BAE6FD;">${currentRelease?.status || 'Active QA'}</span>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px; font-weight: 500;">Target Launch: <strong>${targetDate}</strong> &bull; Verified: <strong>${passedStories.length}/${relStories.length}</strong> Stories</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #16A34A;">${passRate}%</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Pass Rate</div>
        </div>
        <div style="background: ${openDefects.length > 0 ? '#FEF2F2' : '#F0FDF4'}; padding: 12px; border-radius: 12px; border: 1px solid ${openDefects.length > 0 ? '#FECACA' : '#DCFCE7'}; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'};">${openDefects.length}</div>
          <div style="font-size: 11px; font-weight: 600; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'}; text-transform: uppercase;">Open Bugs</div>
        </div>
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #0284C7;">${relStories.length}</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Scope Stories</div>
        </div>
      </div>

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

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${state.settings?.appName || 'ACM Delivery'}</strong> &bull; Automated Test & Quality Assurance Engine
      </div>
    </div>
  `;

  const recipient = state.settings.emailRecipient || state.settings.managerEmail || '';
  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl };
}

export function buildDashboardDigest(state: AppState): {
  subject: string;
  html: string;
  markdown: string;
  mailtoUrl: string;
} {
  const appName = state.settings?.appName || 'ACM (AT&T Connection Manager) Delivery';
  const dateFormatted = formatLongDate(state.dateStr);
  const subject = `[Executive Pulse] ${appName} Delivery Operations — ${formatDisplayDate(state.dateStr)}`;

  const todayTasks = state.tasks.filter(t => t.dateStr === state.dateStr);
  const doneTasks = todayTasks.filter(t => t.status === 'complete');
  const highPending = todayTasks.filter(t => t.priority === 'high' && t.status !== 'complete');
  const activeReleases = state.releases.filter(r => r.status === 'Active QA' || r.status === 'Staging');
  const openDefects = state.defects.filter(d => d.status !== 'Closed');

  let md = `# 🚀 ${appName} Executive Operations Pulse\n`;
  md += `**Date:** ${dateFormatted}\n\n`;
  md += `## 🎯 Daily Commitment Execution\n`;
  md += `- **Completed:** ${doneTasks.length}/${todayTasks.length} tasks\n`;
  md += `- **High Priority In-Flight:** ${highPending.length}\n\n`;

  md += `## 📋 Scope & Quality Governance\n`;
  md += `- **Tracked User Stories:** ${state.userStories.length} across ${state.releases.length} releases\n`;
  md += `- **Active Open Defects:** ${openDefects.length}\n`;
  md += `- **Active Release Pipelines:** ${activeReleases.length}\n`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-width: 680px; margin: 0 auto; padding: 24px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 4px; color: #4F46E5; font-size: 20px; font-weight: 800;">${appName} — Executive Pulse</h2>
        <p style="margin: 0; color: #64748B; font-size: 13px;">${dateFormatted} &bull; High-level cross-functional delivery briefing</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #4F46E5;">${doneTasks.length}/${todayTasks.length}</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Tasks Closed</div>
        </div>
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #0F172A;">${state.userStories.length}</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">User Stories</div>
        </div>
        <div style="background: #F8FAFC; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: ${openDefects.length > 0 ? '#DC2626' : '#16A34A'};">${openDefects.length}</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">Open Defects</div>
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
        Generated by <strong>${appName}</strong> &bull; Executive Delivery Intelligence
      </div>
    </div>
  `;

  const recipient = state.settings.emailRecipient || '';
  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(md)}`;

  return { subject, html, markdown: md, mailtoUrl };
}

