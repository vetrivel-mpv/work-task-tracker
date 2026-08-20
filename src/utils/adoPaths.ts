import { Release, UserStory, Defect, Task } from '../types';

export interface IterationPathInfo {
  iterationPath: string; // The full ADO Iteration path, e.g. "CareFlow-Core\Sprint 24"
  releaseName: string;   // Internal ADO Release name, e.g. "Release 4.2 - Telehealth & EHR Connect"
  releaseNumber: string; // Internal ADO Release number, e.g. "v4.2.0"
  releaseId: string;
  areaPath: string;      // Internal ADO Area path, e.g. "CareFlow-Core\EHR-Connect"
  status: string;        // Release status e.g. "Active QA", "Planning", "Deployed"
  targetDate: string;
  userStoryCount: number;
  defectCount: number;
  openBlockerCount: number;
  displayName: string;
}

export const DEFAULT_INTERNAL_AREA_PATHS = [
  'CareFlow-Core\\EHR-Connect',
  'CareFlow-Core\\Clinical-Portal',
  'CareFlow-Core\\Billing-Engine',
  'CareFlow-Core\\Security-Platform',
  'CareFlow-Ops\\Customer-Escalations',
  'CareFlow-Ops\\Infra-Tickets'
];

/**
 * Returns all distinct Area Paths configured or discovered across releases, stories, defects and tasks.
 */
export function getAllAreaPaths(
  releases: Release[] = [],
  userStories: UserStory[] = [],
  defects: Defect[] = [],
  tasks: Task[] = []
): string[] {
  const set = new Set<string>(DEFAULT_INTERNAL_AREA_PATHS);

  releases.forEach(r => {
    if (r.areaPath) set.add(r.areaPath);
  });

  userStories.forEach(s => {
    if (s.areaPath) set.add(s.areaPath);
  });

  defects.forEach(d => {
    if (d.areaPath) set.add(d.areaPath);
  });

  tasks.forEach(t => {
    if (t.areaPath) set.add(t.areaPath);
  });

  return Array.from(set).sort();
}

/**
 * Core Requirement:
 * "Based on the AREA path filter, All the Iteration path should returned. 
 *  Iteration path is the release name/Number that we are maintaining our internal ADO"
 *
 * This function takes an Area Path (or empty for all) and queries all matching
 * Iteration Paths (Release Names / Numbers) in our internal ADO.
 */
export function getIterationPathsForArea(
  areaPathFilter: string,
  releases: Release[] = [],
  userStories: UserStory[] = [],
  defects: Defect[] = []
): IterationPathInfo[] {
  const normalizedFilter = (areaPathFilter || '').trim().toLowerCase();

  // Find all releases that match the area path filter
  const matchingReleases = releases.filter(r => {
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    const relArea = (r.areaPath || '').toLowerCase();
    return relArea === normalizedFilter || 
           relArea.includes(normalizedFilter) || 
           normalizedFilter.includes(relArea);
  });

  const result: IterationPathInfo[] = [];
  const processedIterationSet = new Set<string>();

  matchingReleases.forEach(rel => {
    const iterPath = rel.iterationPath || rel.name;
    if (processedIterationSet.has(iterPath)) return;
    processedIterationSet.add(iterPath);

    const relStories = userStories.filter(s => s.releaseId === rel.id || s.iterationPath === iterPath);
    const relDefects = defects.filter(d => d.releaseId === rel.id || d.iterationPath === iterPath);
    const blockerCount = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;

    const releaseNum = rel.releaseNumber || extractReleaseNumber(rel.name);

    result.push({
      iterationPath: iterPath,
      releaseName: rel.name,
      releaseNumber: releaseNum,
      releaseId: rel.id,
      areaPath: rel.areaPath || 'CareFlow-Core\\EHR-Connect',
      status: rel.status,
      targetDate: rel.targetDate,
      userStoryCount: relStories.length,
      defectCount: relDefects.length,
      openBlockerCount: blockerCount,
      displayName: `${rel.name} (${releaseNum})`
    });
  });

  // Also discover any standalone iteration paths on stories/defects matching this area
  if (normalizedFilter && normalizedFilter !== 'all') {
    userStories.forEach(s => {
      if (!s.iterationPath || processedIterationSet.has(s.iterationPath)) return;
      const storyArea = (s.areaPath || '').toLowerCase();
      if (storyArea === normalizedFilter || storyArea.includes(normalizedFilter)) {
        processedIterationSet.add(s.iterationPath);
        result.push({
          iterationPath: s.iterationPath,
          releaseName: s.iterationPath,
          releaseNumber: extractReleaseNumber(s.iterationPath),
          releaseId: s.releaseId || s.iterationPath,
          areaPath: s.areaPath || areaPathFilter,
          status: 'Active QA',
          targetDate: '2026-08-28',
          userStoryCount: userStories.filter(st => st.iterationPath === s.iterationPath).length,
          defectCount: defects.filter(df => df.iterationPath === s.iterationPath).length,
          openBlockerCount: 0,
          displayName: `${s.iterationPath} (${extractReleaseNumber(s.iterationPath)})`
        });
      }
    });
  }

  return result;
}

/**
 * Extracts or infers a release number string (e.g. "v4.2.0") from a release name or iteration path string.
 */
export function extractReleaseNumber(text: string): string {
  if (!text) return 'v1.0.0';
  const match = text.match(/(?:Release|Rel|v)?\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
  if (match && match[1]) {
    return `v${match[1]}`;
  }
  const sprintMatch = text.match(/Sprint\s*([0-9]+)/i);
  if (sprintMatch && sprintMatch[1]) {
    return `Sprint-${sprintMatch[1]}`;
  }
  return text;
}
