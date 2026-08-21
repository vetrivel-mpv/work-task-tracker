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

export const DEFAULT_INTERNAL_AREA_PATHS: string[] = ['ACM'];

export const KNOWN_PROJECT_ITERATIONS: Record<string, Array<{ name: string; path: string; releaseNumber: string; startDate: string; targetDate: string }>> = {
  'acm': [
    { name: 'D2 R 2026.03', path: 'ACM\\D2 R 2026.03', releaseNumber: 'v2026.03', startDate: '2025-11-14', targetDate: '2026-04-23' },
    { name: 'D3 R 2026.05', path: 'ACM\\D3 R 2026.05', releaseNumber: 'v2026.05', startDate: '2026-01-06', targetDate: '2026-05-21' },
    { name: 'D4 R 2026.07', path: 'ACM\\D4 R 2026.07', releaseNumber: 'v2026.07', startDate: '2026-03-20', targetDate: '2026-07-23' },
    { name: 'D5 R 2026.09', path: 'ACM\\D5 R 2026.09', releaseNumber: 'v2026.09', startDate: '2026-05-15', targetDate: '2026-09-17' },
    { name: 'R 2026.06', path: 'ACM\\R 2026.06', releaseNumber: 'v2026.06', startDate: '2026-06-01', targetDate: '2026-06-30' },
    { name: 'R 2026.08 - Migration', path: 'ACM\\R 2026.08 - Migration', releaseNumber: 'v2026.08', startDate: '2026-06-30', targetDate: '2026-08-20' },
    { name: 'D6 R 2026.10', path: 'ACM\\D6 R 2026.10', releaseNumber: 'v2026.10', startDate: '2026-08-01', targetDate: '2026-10-31' },
    { name: 'D7 R 2026.11', path: 'ACM\\D7 R 2026.11', releaseNumber: 'v2026.11', startDate: '2026-09-14', targetDate: '2026-12-11' }
  ]
};

/**
 * Returns all distinct Area Paths configured or discovered across releases, stories, defects and tasks.
 */
export function getAllAreaPaths(
  releases: Release[] = [],
  userStories: UserStory[] = [],
  defects: Defect[] = [],
  tasks: Task[] = [],
  discoveredAreas: Array<{ name: string; path: string }> = []
): string[] {
  const set = new Set<string>(['ACM']);

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

  discoveredAreas.forEach(a => {
    if (a.path) set.add(a.path);
    if (a.name) set.add(a.name);
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
  defects: Defect[] = [],
  discoveredIterations: Array<{ id?: string | number; name: string; path: string; startDate?: string; finishDate?: string }> = []
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
      areaPath: rel.areaPath || 'ACM',
      status: rel.status,
      targetDate: rel.targetDate,
      userStoryCount: relStories.length,
      defectCount: relDefects.length,
      openBlockerCount: blockerCount,
      displayName: `${rel.name} (${releaseNum})`
    });
  });

  // Merge discovered iterations from live ADO
  discoveredIterations.forEach(iter => {
    const iterPath = iter.path || iter.name;
    if (processedIterationSet.has(iterPath)) return;
    processedIterationSet.add(iterPath);

    const relStories = userStories.filter(s => s.iterationPath === iterPath || (s.iterationPath && s.iterationPath.includes(iter.name)));
    const relDefects = defects.filter(d => d.iterationPath === iterPath || (d.iterationPath && d.iterationPath.includes(iter.name)));
    const blockerCount = relDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
    const releaseNum = extractReleaseNumber(iter.name) || 'v1.0.0';

    result.push({
      iterationPath: iterPath,
      releaseName: iter.name,
      releaseNumber: releaseNum,
      releaseId: `ado-${iter.id || iter.name}`,
      areaPath: areaPathFilter || 'ACM',
      status: 'Active QA',
      targetDate: iter.finishDate || '2026-09-17',
      userStoryCount: relStories.length,
      defectCount: relDefects.length,
      openBlockerCount: blockerCount,
      displayName: `${iter.name} (${releaseNum})`
    });
  });

  // If no iterations matched and project area filter matches ACM presets
  if (result.length === 0 && (normalizedFilter.includes('acm') || !normalizedFilter)) {
    const acmPresets = KNOWN_PROJECT_ITERATIONS['acm'] || [];
    acmPresets.forEach(preset => {
      if (processedIterationSet.has(preset.path)) return;
      processedIterationSet.add(preset.path);

      const relStories = userStories.filter(s => s.iterationPath === preset.path || (s.iterationPath && s.iterationPath.includes(preset.name)));
      const relDefects = defects.filter(d => d.iterationPath === preset.path || (d.iterationPath && d.iterationPath.includes(preset.name)));

      result.push({
        iterationPath: preset.path,
        releaseName: preset.name,
        releaseNumber: preset.releaseNumber,
        releaseId: `preset-${preset.name}`,
        areaPath: 'ACM',
        status: 'Active QA',
        targetDate: preset.targetDate,
        userStoryCount: relStories.length,
        defectCount: relDefects.length,
        openBlockerCount: 0,
        displayName: `${preset.name} (${preset.releaseNumber})`
      });
    });
  }

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
