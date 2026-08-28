import { Task, UserStory, Defect, TestCase, ExecutionMetrics, TaskComment } from '../types/index.ts';

/**
 * Strips HTML formatting from Azure DevOps work item comments
 */
export function cleanAdoHtml(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses execution metrics from raw comment text (HTML or plain text)
 */
export function parseExecutionMetricsFromText(text?: string | null): ExecutionMetrics | null {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return null;
  }

  const clean = cleanAdoHtml(text).trim();
  if (!clean) return null;

  let totalTestCases = 0;
  let completedTestCases = 0;
  let passedTestCases = 0;
  let blockedTestCases = 0;
  let failedTestCases = 0;
  let openDefects = 0;
  let matched = false;
  let statusLabel: 'Passed' | 'In Progress' | 'Blocked' | 'Not Applicable' | 'Failed' | 'Pending' | undefined;
  let remarks: string | undefined;

  const lowerClean = clean.toLowerCase();

  // Detect explicit 'Not Applicable' / 'N/A' keywords
  const isNotApplicable = 
    lowerClean.includes('not applicable') ||
    lowerClean.includes('n/a') ||
    /\bna\b/i.test(lowerClean) ||
    lowerClean.includes('status: na') ||
    lowerClean.includes('status: not applicable') ||
    lowerClean.includes('testing not applicable') ||
    lowerClean.includes('qa not applicable') ||
    lowerClean.includes('scope: not applicable') ||
    lowerClean.includes('no qa required') ||
    lowerClean.includes('no testing required') ||
    lowerClean.includes('no test cases needed') ||
    lowerClean.includes('not in qa scope');

  // Detect explicit 'Blocked' keywords
  const isExplicitBlocked =
    lowerClean.includes('status: blocked') ||
    lowerClean.includes('test status: blocked') ||
    lowerClean.includes('testing blocked') ||
    lowerClean.includes('qa blocked') ||
    lowerClean.includes('blocked by defect') ||
    lowerClean.includes('blocked by bug') ||
    lowerClean.includes('blocked due to') ||
    lowerClean.includes('blocked by dependency') ||
    lowerClean.includes('currently blocked') ||
    lowerClean.includes('[blocked]');

  // Detect explicit 'Passed' / 'Sign-off' keywords
  const isExplicitPassed =
    lowerClean.includes('status: passed') ||
    lowerClean.includes('status: pass') ||
    lowerClean.includes('status: qa passed') ||
    lowerClean.includes('test status: passed') ||
    lowerClean.includes('test status: pass') ||
    lowerClean.includes('qa status: passed') ||
    lowerClean.includes('qa status: pass') ||
    lowerClean.includes('all test cases passed') ||
    lowerClean.includes('all test scenarios passed') ||
    lowerClean.includes('all verification criteria passed') ||
    lowerClean.includes('all tests passed') ||
    lowerClean.includes('100% passed') ||
    lowerClean.includes('100% pass') ||
    lowerClean.includes('qa sign-off complete') ||
    lowerClean.includes('qa signed off') ||
    lowerClean.includes('tested and verified') ||
    lowerClean.includes('tested & verified') ||
    lowerClean.includes('verification complete') ||
    lowerClean.includes('verification passed') ||
    lowerClean.includes('[passed]');

  // Detect explicit 'Failed' keywords
  const isExplicitFailed =
    lowerClean.includes('status: failed') ||
    lowerClean.includes('status: fail') ||
    lowerClean.includes('test status: failed') ||
    lowerClean.includes('qa status: failed') ||
    lowerClean.includes('[failed]');

  // Detect explicit 'In Progress' keywords
  const isExplicitInProgress =
    lowerClean.includes('status: in progress') ||
    lowerClean.includes('test status: in progress') ||
    lowerClean.includes('testing in progress') ||
    lowerClean.includes('qa in progress') ||
    lowerClean.includes('verification in progress') ||
    lowerClean.includes('[in progress]');

  // Extract explicit Remarks or Activity notes
  const remarksMatch = clean.match(/(?:remarks?|notes?|details?|reason|activity|execution notes?|today activity)\s*[:=]\s*([^|\n;]+)/i);
  if (remarksMatch && remarksMatch[1]) {
    remarks = remarksMatch[1].trim();
  }

  // 1. Structured Pipe/Colon/Comma/Newline Syntax (e.g. "Total Test Cases: 15 | Completed: 12 | Blocked: 1 | Failed: 2 | Open Defects: 2")
  const totalMatch = clean.match(/(?:total(?:\s+test(?:\s*cases?)?)?|test\s*cases?|scenarios?|tests|tc\s*total)\s*[:=]\s*(\d+)/i);
  if (totalMatch) {
    totalTestCases = parseInt(totalMatch[1], 10);
    matched = true;
  }

  const completedMatch = clean.match(/(?:completed(?:\s+test(?:\s*cases?)?)?|executed(?:\s+test(?:\s*cases?)?)?|done|exec)\s*[:=]\s*(\d+)/i);
  if (completedMatch) {
    completedTestCases = parseInt(completedMatch[1], 10);
    matched = true;
  }

  const passedMatch = clean.match(/(?:passed(?:\s+test(?:\s*cases?)?)?|pass(?:es)?)\s*[:=]\s*(\d+)/i);
  if (passedMatch) {
    passedTestCases = parseInt(passedMatch[1], 10);
    if (!completedMatch) completedTestCases = passedTestCases;
    matched = true;
  }

  const blockedMatch = clean.match(/(?:blocked(?:\s+test(?:\s*cases?)?)?|blockers?)\s*[:=]\s*(\d+)/i);
  if (blockedMatch) {
    blockedTestCases = parseInt(blockedMatch[1], 10);
    matched = true;
  }

  const failedMatch = clean.match(/(?:failed(?:\s+test(?:\s*cases?)?)?|failures?|fail(?:s)?)\s*[:=]\s*(\d+)/i);
  if (failedMatch) {
    failedTestCases = parseInt(failedMatch[1], 10);
    matched = true;
  }

  const defectMatch = clean.match(/(?:(?:open\s+)?defects?|bugs?|active\s+bugs?|issues?)\s*[:=]\s*(\d+)/i);
  if (defectMatch) {
    openDefects = parseInt(defectMatch[1], 10);
    matched = true;
  }

  // 2. Fractional Pattern e.g. "12/15 Passed", "12/15 Completed", "Executed 10/12 test cases"
  if (!totalMatch) {
    const fractionMatch = clean.match(/(\d+)\s*\/\s*(\d+)\s*(?:passed|completed|executed|test\s*cases?|scenarios|tests)?/i);
    if (fractionMatch) {
      completedTestCases = parseInt(fractionMatch[1], 10);
      totalTestCases = parseInt(fractionMatch[2], 10);
      passedTestCases = completedTestCases;
      matched = true;
    }
  }

  // 3. Natural language patterns e.g. "Completed 8 test cases with 1 failure and 0 blockers. Logged 1 defect."
  if (!matched) {
    const natCompleted = clean.match(/(?:completed|executed|passed)\s+(\d+)(?:\s+(?:of|\/)\s+(\d+))?\s*(?:test\s*cases?|scenarios|tests)?/i);
    if (natCompleted) {
      completedTestCases = parseInt(natCompleted[1], 10);
      passedTestCases = completedTestCases;
      if (natCompleted[2]) {
        totalTestCases = parseInt(natCompleted[2], 10);
      } else {
        totalTestCases = Math.max(totalTestCases, completedTestCases);
      }
      matched = true;
    }

    const natBlocked = clean.match(/(\d+)\s*(?:blocked|blockers?)/i);
    if (natBlocked) {
      blockedTestCases = parseInt(natBlocked[1], 10);
      matched = true;
    }

    const natFailed = clean.match(/(\d+)\s*(?:failed|failures?)/i);
    if (natFailed) {
      failedTestCases = parseInt(natFailed[1], 10);
      matched = true;
    }

    const natDefects = clean.match(/(\d+)\s*(?:open\s+)?(?:defects?|bugs?)/i);
    if (natDefects) {
      openDefects = parseInt(natDefects[1], 10);
      matched = true;
    }
  }

  if (totalTestCases < completedTestCases) {
    totalTestCases = completedTestCases + blockedTestCases;
  }
  if (!passedTestCases && completedTestCases >= failedTestCases) {
    passedTestCases = Math.max(0, completedTestCases - failedTestCases);
  }

  // Determine explicit Status Label
  if (isNotApplicable) {
    statusLabel = 'Not Applicable';
    matched = true;
  } else if (isExplicitBlocked || blockedTestCases > 0) {
    statusLabel = 'Blocked';
    if (!blockedTestCases) blockedTestCases = 1;
    matched = true;
  } else if (isExplicitFailed || failedTestCases > 0) {
    statusLabel = 'Failed';
    matched = true;
  } else if (isExplicitPassed) {
    statusLabel = 'Passed';
    if (totalTestCases === 0) totalTestCases = Math.max(completedTestCases, 8);
    if (completedTestCases === 0) completedTestCases = totalTestCases;
    if (passedTestCases === 0) passedTestCases = completedTestCases;
    matched = true;
  } else if (isExplicitInProgress) {
    statusLabel = 'In Progress';
    matched = true;
  } else if (totalTestCases > 0 && completedTestCases >= totalTestCases && passedTestCases === totalTestCases && failedTestCases === 0 && blockedTestCases === 0) {
    statusLabel = 'Passed';
  } else if (completedTestCases > 0 || totalTestCases > 0) {
    statusLabel = 'In Progress';
  }

  if (!matched && totalTestCases === 0 && completedTestCases === 0 && openDefects === 0 && !statusLabel) {
    return null;
  }

  return {
    totalTestCases,
    completedTestCases,
    passedTestCases,
    blockedTestCases,
    failedTestCases,
    openDefects,
    statusLabel,
    remarks: remarks || (isNotApplicable ? 'Not Applicable for Testing' : isExplicitBlocked ? 'Execution Blocked' : isExplicitPassed ? 'All scenarios validated' : undefined),
    notes: clean.slice(0, 300),
    source: 'parsed',
    assessedAt: new Date().toISOString()
  };
}

export interface LatestCommentDetail {
  text: string;
  author?: string;
  createdAt?: string;
  id?: string;
}

/**
 * Returns detailed latest comment information from an item, prioritizing chronological newest
 */
export function getLatestCommentDetail(item?: {
  comments?: TaskComment[];
  latestComment?: string;
  todayActivityComment?: string;
  standupDiscussionNotes?: string;
  assigneeName?: string;
} | null): LatestCommentDetail | null {
  if (!item) return null;

  // 1. If comments array exists, find the latest comment by createdAt or last element
  if (item.comments && item.comments.length > 0) {
    // Sort comments by timestamp if parseable, otherwise preserve order (last is newest)
    const sorted = [...item.comments].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && !isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB;
      }
      return 0; // maintain insertion order
    });

    const newest = sorted[sorted.length - 1];
    if (newest && newest.text && newest.text.trim()) {
      return {
        id: newest.id,
        text: cleanAdoHtml(newest.text.trim()),
        author: newest.author || item.assigneeName,
        createdAt: newest.createdAt
      };
    }
  }

  // 2. Today Activity Comment
  if (item.todayActivityComment && item.todayActivityComment.trim()) {
    return {
      text: cleanAdoHtml(item.todayActivityComment.trim()),
      author: item.assigneeName,
      createdAt: new Date().toISOString()
    };
  }

  // 3. latestComment field
  if (item.latestComment && item.latestComment.trim()) {
    return {
      text: cleanAdoHtml(item.latestComment.trim()),
      author: item.assigneeName,
      createdAt: new Date().toISOString()
    };
  }

  // 4. standupDiscussionNotes
  if (item.standupDiscussionNotes && item.standupDiscussionNotes.trim()) {
    return {
      text: cleanAdoHtml(item.standupDiscussionNotes.trim()),
      author: item.assigneeName,
      createdAt: new Date().toISOString()
    };
  }

  return null;
}

/**
 * Returns the most recent comment text from an item
 */
export function getLatestCommentText(item?: {
  comments?: TaskComment[];
  latestComment?: string;
  todayActivityComment?: string;
  standupDiscussionNotes?: string;
} | null): string {
  const detail = getLatestCommentDetail(item as any);
  return detail ? detail.text : '';
}

/**
 * Standard execution comment template helper for user convenience
 */
export function generateExecutionCommentTemplate(options?: {
  total?: number;
  completed?: number;
  blocked?: number;
  failed?: number;
  defects?: number;
  activity?: string;
  notes?: string;
}): string {
  const activity = options?.activity || 'Executed daily verification test suite';
  const total = options?.total ?? 10;
  const completed = options?.completed ?? 10;
  const blocked = options?.blocked ?? 0;
  const failed = options?.failed ?? 0;
  const defects = options?.defects ?? 0;
  const notes = options?.notes || 'All verification criteria validated for today.';

  return `Today Activity: ${activity}
Total Test Cases: ${total} | Completed: ${completed} | Blocked: ${blocked} | Failed: ${failed} | Open Defects: ${defects}
Execution Notes: ${notes}`;
}

export interface AssessedStoryStatus {
  storyId: string;
  storyTitle: string;
  metrics: ExecutionMetrics;
  latestTask?: Task;
  todayTasks: Task[];
  latestCommentText: string;
  commentAuthor?: string;
  isTaskClosedToday: boolean;
  sourceDescription: string;
  executionPct: number;
  passPct: number;
  statusLabel: 'Passed' | 'In Progress' | 'Blocked' | 'Not Applicable' | 'Failed' | 'Pending';
  remarks?: string;
}

/**
 * Provides a clean, polished HTML/Text badge styling for email and UI rendering
 */
export function getStoryTestingStatusInfo(status: AssessedStoryStatus['statusLabel']): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
} {
  switch (status) {
    case 'Blocked':
      return {
        label: 'BLOCKED',
        badgeBg: '#fef2f2',
        badgeText: '#dc2626',
        badgeBorder: '#fecaca'
      };
    case 'Not Applicable':
      return {
        label: 'NOT APPLICABLE (N/A)',
        badgeBg: '#f8fafc',
        badgeText: '#64748b',
        badgeBorder: '#cbd5e1'
      };
    case 'Passed':
      return {
        label: 'PASSED',
        badgeBg: '#f0fdf4',
        badgeText: '#16a34a',
        badgeBorder: '#bbf7d0'
      };
    case 'Failed':
      return {
        label: 'FAILED',
        badgeBg: '#fef2f2',
        badgeText: '#b91c1c',
        badgeBorder: '#fca5a5'
      };
    case 'In Progress':
      return {
        label: 'IN PROGRESS',
        badgeBg: '#eff6ff',
        badgeText: '#2563eb',
        badgeBorder: '#bfdbfe'
      };
    default:
      return {
        label: 'PENDING QA',
        badgeBg: '#f8fafc',
        badgeText: '#64748b',
        badgeBorder: '#e2e8f0'
      };
  }
}

/**
 * Assesses the test status report metrics for a specific User Story
 * by extracting complete execution details from its today's task(s) and latest comments.
 */
export function assessStoryTestStatus(
  story: UserStory,
  allTasks: Task[] = [],
  allDefects: Defect[] = [],
  allTestCases: TestCase[] = [],
  todayDateStr?: string
): AssessedStoryStatus {
  const targetDate = todayDateStr || new Date().toISOString().slice(0, 10);

  // 1. Find all linked tasks for this story
  const linkedTasks = allTasks.filter(t => 
    t.userStoryId === story.id || 
    (story.adoId && (t.parentId === story.adoId || t.parentId === Number(story.adoId)))
  );

  // Sort tasks so today's tasks or newest updated tasks come first
  const todayTasks = linkedTasks.filter(t => t.dateStr === targetDate);
  const sortedTasks = [...linkedTasks].sort((a, b) => {
    if (a.dateStr === targetDate && b.dateStr !== targetDate) return -1;
    if (b.dateStr === targetDate && a.dateStr !== targetDate) return 1;
    return new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime();
  });

  const latestTask = sortedTasks[0];
  const isTaskClosedToday = todayTasks.some(t => t.status === 'complete');

  // 2. Extract latest comment: compare User Story direct comments vs linked Task comments to find the most recent
  const storyDetail = getLatestCommentDetail(story as any);
  const taskDetail = latestTask ? getLatestCommentDetail(latestTask as any) : null;

  let winningDetail: LatestCommentDetail | null = null;
  let sourceKind: 'story_comment' | 'task_comment' | 'preconfigured' | 'manual' = 'story_comment';

  if (storyDetail && taskDetail) {
    const storyTime = storyDetail.createdAt ? new Date(storyDetail.createdAt).getTime() : 0;
    const taskTime = taskDetail.createdAt ? new Date(taskDetail.createdAt).getTime() : 0;

    const storyParsed = parseExecutionMetricsFromText(storyDetail.text);
    const taskParsed = parseExecutionMetricsFromText(taskDetail.text);

    // If story has explicit metrics and task does not, prioritize story
    if (storyParsed && !taskParsed) {
      winningDetail = storyDetail;
      sourceKind = 'story_comment';
    } else if (taskParsed && !storyParsed) {
      winningDetail = taskDetail;
      sourceKind = 'task_comment';
    } else if (storyTime >= taskTime || isNaN(taskTime)) {
      winningDetail = storyDetail;
      sourceKind = 'story_comment';
    } else {
      winningDetail = taskDetail;
      sourceKind = 'task_comment';
    }
  } else if (storyDetail) {
    winningDetail = storyDetail;
    sourceKind = 'story_comment';
  } else if (taskDetail) {
    winningDetail = taskDetail;
    sourceKind = 'task_comment';
  }

  const effectiveComment = winningDetail ? winningDetail.text : '';
  const commentAuthor = winningDetail ? (winningDetail.author || story.assigneeName) : story.assigneeName;

  // 3. Parse execution metrics from the most recent comment
  const parsedFromComment = parseExecutionMetricsFromText(effectiveComment);

  // 4. Ground-truth fallback from linked test cases and defects if available
  const linkedTestCases = allTestCases.filter(tc => tc.userStoryId === story.id || (story.adoId && tc.adoId === story.adoId));
  const linkedDefects = allDefects.filter(d => (d.userStoryId === story.id || (story.adoId && d.userStoryId === String(story.adoId))) && d.status !== 'Closed');

  const tcTotal = linkedTestCases.length;
  const tcPassed = linkedTestCases.filter(tc => tc.status === 'Passed' || tc.status === 'Pass').length;
  const tcFailed = linkedTestCases.filter(tc => tc.status === 'Failed' || tc.status === 'Fail').length;
  const tcBlocked = linkedTestCases.filter(tc => tc.status === 'Blocked').length;
  const tcCompleted = tcPassed + tcFailed;

  let finalMetrics: ExecutionMetrics;
  let sourceDescription = '';

  if (parsedFromComment) {
    finalMetrics = {
      ...parsedFromComment,
      source: sourceKind
    };
    sourceDescription = sourceKind === 'story_comment'
      ? `Assessed from User Story latest comment`
      : `Assessed from Task #${latestTask?.adoId || latestTask?.id?.slice(0, 6)} latest execution comment`;
  } else if (story.executionMetrics) {
    finalMetrics = { ...story.executionMetrics };
    sourceDescription = 'Pre-configured execution metrics';
  } else if (story.testPlanRef && story.testPlanRef.totalTests > 0) {
    finalMetrics = {
      totalTestCases: story.testPlanRef.totalTests,
      completedTestCases: story.testPlanRef.passedTests + story.testPlanRef.failedTests,
      passedTestCases: story.testPlanRef.passedTests,
      blockedTestCases: story.testPlanRef.status === 'Blocked' ? 1 : 0,
      failedTestCases: story.testPlanRef.failedTests,
      openDefects: linkedDefects.length,
      notes: `Test Plan: ${story.testPlanRef.suiteName} (${story.testPlanRef.status})`,
      source: 'manual',
      assessedAt: new Date().toISOString()
    };
    sourceDescription = 'Assessed from linked Test Plan Suite';
  } else if (tcTotal > 0) {
    finalMetrics = {
      totalTestCases: tcTotal,
      completedTestCases: tcCompleted,
      passedTestCases: tcPassed,
      blockedTestCases: tcBlocked,
      failedTestCases: tcFailed,
      openDefects: linkedDefects.length,
      notes: `${tcPassed}/${tcTotal} Test Scenarios Executed`,
      source: 'manual',
      assessedAt: new Date().toISOString()
    };
    sourceDescription = 'Assessed from linked Test Case scenarios';
  } else {
    // Default estimated coverage based on story status and points
    const defaultTotal = Math.max((story.storyPoints || 3) * 2, 4);
    const isPassed = story.status === 'QA Passed' || story.status === 'Done';
    const isInQa = story.status === 'QA In Progress';
    const isBlocked = story.status === 'Blocked';

    const completed = isPassed ? defaultTotal : isInQa ? Math.round(defaultTotal * 0.6) : 0;
    const passed = isPassed ? defaultTotal : isInQa ? Math.round(defaultTotal * 0.5) : 0;
    const blocked = isBlocked ? 2 : 0;
    const failed = isInQa && linkedDefects.length > 0 ? 1 : 0;

    finalMetrics = {
      totalTestCases: defaultTotal,
      completedTestCases: completed,
      passedTestCases: passed,
      blockedTestCases: blocked,
      failedTestCases: failed,
      openDefects: linkedDefects.length,
      notes: isPassed ? 'All scenarios validated' : isInQa ? 'Verification in progress' : 'Awaiting QA execution',
      source: 'manual',
      assessedAt: new Date().toISOString()
    };
    sourceDescription = 'Estimated baseline from story QA status';
  }

  // Calculate percentages
  const executionPct = finalMetrics.totalTestCases > 0 
    ? Math.round((finalMetrics.completedTestCases / finalMetrics.totalTestCases) * 100) 
    : 0;
  const passPct = finalMetrics.completedTestCases > 0 
    ? Math.round((finalMetrics.passedTestCases / finalMetrics.completedTestCases) * 100) 
    : 0;

  // Resolve overarching status label
  let statusLabel: AssessedStoryStatus['statusLabel'] = finalMetrics.statusLabel || 'Pending';
  if (!finalMetrics.statusLabel) {
    if (finalMetrics.blockedTestCases > 0 || story.status === 'Blocked') {
      statusLabel = 'Blocked';
    } else if (finalMetrics.failedTestCases > 0) {
      statusLabel = 'Failed';
    } else if (story.status === 'QA Passed' || story.status === 'Done') {
      statusLabel = 'Passed';
    } else if (finalMetrics.completedTestCases > 0 || story.status === 'QA In Progress') {
      statusLabel = 'In Progress';
    } else {
      statusLabel = 'Pending';
    }
  }

  return {
    storyId: story.adoId ? `US-${story.adoId}` : story.id,
    storyTitle: story.title,
    metrics: finalMetrics,
    latestTask,
    todayTasks,
    latestCommentText: effectiveComment,
    commentAuthor,
    isTaskClosedToday,
    sourceDescription,
    executionPct,
    passPct,
    statusLabel,
    remarks: finalMetrics.remarks
  };
}

/**
 * Aggregates all assessed story metrics for a release or full scope
 */
export function aggregateReleaseTestMetrics(
  stories: UserStory[],
  allTasks: Task[],
  allDefects: Defect[],
  allTestCases: TestCase[],
  todayDateStr?: string
) {
  const assessedStories = stories.map(s => 
    assessStoryTestStatus(s, allTasks, allDefects, allTestCases, todayDateStr)
  );

  let totalTestCases = 0;
  let completedTestCases = 0;
  let passedTestCases = 0;
  let blockedTestCases = 0;
  let failedTestCases = 0;
  let openDefects = 0;

  assessedStories.forEach(as => {
    totalTestCases += as.metrics.totalTestCases;
    completedTestCases += as.metrics.completedTestCases;
    passedTestCases += as.metrics.passedTestCases;
    blockedTestCases += as.metrics.blockedTestCases;
    failedTestCases += as.metrics.failedTestCases;
    openDefects += as.metrics.openDefects;
  });

  const executionPct = totalTestCases > 0 
    ? Math.round((completedTestCases / totalTestCases) * 100) 
    : 0;
  const passPct = completedTestCases > 0 
    ? Math.round((passedTestCases / completedTestCases) * 100) 
    : 0;

  return {
    totalTestCases,
    completedTestCases,
    passedTestCases,
    blockedTestCases,
    failedTestCases,
    openDefects,
    executionPct,
    passPct,
    assessedStories
  };
}
