import { UserStory, TestCase, Defect, Task } from '../types';

/**
 * Deterministically checks if an item is a pure User Story / Backlog Item / Requirement / Feature
 */
export function isPureUserStory(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const rawType = String(
    item.workItemType ||
    item.work_item_type ||
    item.type ||
    item.adoWorkItemType ||
    ''
  ).toLowerCase().trim();

  return (
    rawType === 'user story' ||
    rawType === 'userstory' ||
    rawType === 'story' ||
    rawType === 'product backlog item' ||
    rawType === 'pbi' ||
    rawType === 'requirement' ||
    rawType === 'feature' ||
    rawType === 'epic'
  );
}

/**
 * Robustly inspects an item to determine if it is a Test Case / Test Suite / Test Plan
 * rather than a User Story.
 */
export function isTestCaseItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;

  // Never classify a true User Story as a Test Case
  if (isPureUserStory(item)) {
    return false;
  }

  const idLower = String(item.id || '').toLowerCase().trim();
  if (idLower.startsWith('tc-') || idLower.startsWith('test-') || idLower.startsWith('tcase-')) {
    return true;
  }

  const rawType = String(
    item.workItemType ||
    item.work_item_type ||
    item.type ||
    item.adoWorkItemType ||
    ''
  ).toLowerCase().trim();

  if (
    rawType === 'test case' ||
    rawType === 'testcase' ||
    rawType === 'test plan' ||
    rawType === 'testplan' ||
    rawType === 'test suite' ||
    rawType === 'testsuite' ||
    rawType === 'shared steps' ||
    rawType === 'shared parameters' ||
    rawType.includes('test case') ||
    rawType.includes('test plan') ||
    rawType.includes('test suite') ||
    rawType.includes('test run') ||
    rawType.includes('test execution')
  ) {
    return true;
  }

  if (rawType.includes('test') && !rawType.includes('story') && !rawType.includes('backlog') && !rawType.includes('requirement')) {
    return true;
  }

  const title = String(item.title || '').trim();
  const titleLower = title.toLowerCase();

  // Only check title prefixes if workItemType is not explicitly a Story or Defect
  if (
    titleLower.startsWith('[test case]') ||
    titleLower.startsWith('test case:') ||
    titleLower.startsWith('test case -') ||
    titleLower.startsWith('test case #') ||
    titleLower.startsWith('[tc]') ||
    titleLower.startsWith('tc-') ||
    titleLower.startsWith('tc:') ||
    titleLower.startsWith('[test]') ||
    titleLower.startsWith('test plan:') ||
    titleLower.startsWith('test suite:') ||
    titleLower.includes('(test case)')
  ) {
    return true;
  }

  return false;
}

/**
 * Inspects an item to determine if it is a Defect / Bug
 */
export function isDefectItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;

  // Never classify a true User Story as a Defect
  if (isPureUserStory(item)) {
    return false;
  }

  const idLower = String(item.id || '').toLowerCase().trim();
  if (idLower.startsWith('def-') || idLower.startsWith('bug-')) {
    return true;
  }

  const rawType = String(
    item.workItemType ||
    item.work_item_type ||
    item.type ||
    item.adoWorkItemType ||
    ''
  ).toLowerCase().trim();

  return (
    rawType === 'bug' ||
    rawType.includes('bug') ||
    rawType.includes('defect') ||
    rawType.includes('issue') ||
    rawType.includes('incident')
  );
}

/**
 * Filter an array of stories to ensure ONLY true User Stories are present
 */
export function filterPureUserStories(stories: UserStory[] | any[]): UserStory[] {
  if (!Array.isArray(stories)) return [];
  return stories.filter(s => !isTestCaseItem(s) && !isDefectItem(s));
}

/**
 * Converts a misclassified story object into a standard TestCase object
 */
export function convertStoryToTestCase(story: any, fallbackDate?: string): TestCase {
  const today = fallbackDate || new Date().toISOString().split('T')[0];
  const cleanTitle = String(story.title || 'Untitled Test Case')
    .replace(/^\[Test Case\]\s*/i, '')
    .replace(/^Test Case:\s*/i, '')
    .replace(/^Test Case -\s*/i, '')
    .replace(/^\[TC\]\s*/i, '')
    .trim();

  let mappedStatus = 'Ready';
  const rawStatus = String(story.status || '').toLowerCase();
  if (rawStatus === 'design') mappedStatus = 'Design';
  else if (rawStatus === 'passed' || rawStatus === 'qa passed') mappedStatus = 'Passed';
  else if (rawStatus === 'failed') mappedStatus = 'Failed';
  else if (rawStatus === 'blocked') mappedStatus = 'Blocked';
  else if (rawStatus === 'in progress' || rawStatus === 'qa in progress') mappedStatus = 'In Progress';
  else if (rawStatus === 'closed' || rawStatus === 'done') mappedStatus = 'Closed';

  return {
    id: story.id && String(story.id).startsWith('tc-') ? story.id : `tc-${story.adoId || story.id || Date.now()}`,
    title: cleanTitle,
    description: story.description || '',
    status: mappedStatus,
    areaPath: story.areaPath || '',
    iterationPath: story.iterationPath || '',
    releaseId: story.releaseId || null,
    assigneeId: story.assigneeId || null,
    createdById: story.createdById || null,
    createdByName: story.createdByName || undefined,
    adoId: story.adoId ? Number(story.adoId) : undefined,
    adoUrl: story.adoUrl || undefined,
    workItemType: story.workItemType || 'Test Case',
    automationStatus: story.automationStatus || 'Not Automated',
    sourceInstance: story.sourceInstance || 'internal',
    tags: Array.isArray(story.tags) ? story.tags : [],
    createdAt: story.createdAt || today,
    updatedAt: story.updatedAt || today
  };
}
