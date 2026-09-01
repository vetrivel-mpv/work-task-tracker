import { Release, UserStory, Defect, Task } from '../types';
import { normalizeAdoTarget, validateAdoIdentifier, NormalizedAdoTarget } from './adoNormalizer';

export { normalizeAdoTarget, validateAdoIdentifier };
export type { NormalizedAdoTarget };

export interface IterationPathInfo {
  iterationPath: string; // The full ADO Iteration path, e.g. "ACM\D5 R 2026.09"
  releaseName: string;   // Internal ADO Release name, e.g. "D5 R 2026.09"
  releaseNumber: string; // Internal ADO Release number, e.g. "v2026.09"
  releaseId: string;
  areaPath: string;      // Internal ADO Area path: always "ACM"
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
      displayName: formatReleaseDisplayName(rel.name, releaseNum)
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
    const releaseNum = extractReleaseNumber(iter.name) || '';

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
      displayName: formatReleaseDisplayName(iter.name, releaseNum)
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
        displayName: formatReleaseDisplayName(preset.name, preset.releaseNumber)
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
        const relNum = extractReleaseNumber(s.iterationPath);
        result.push({
          iterationPath: s.iterationPath,
          releaseName: s.iterationPath,
          releaseNumber: relNum,
          releaseId: s.releaseId || s.iterationPath,
          areaPath: s.areaPath || areaPathFilter,
          status: 'Active QA',
          targetDate: '2026-08-28',
          userStoryCount: userStories.filter(st => st.iterationPath === s.iterationPath).length,
          defectCount: defects.filter(df => df.iterationPath === s.iterationPath).length,
          openBlockerCount: 0,
          displayName: formatReleaseDisplayName(s.iterationPath, relNum)
        });
      }
    });
  }

  return result;
}

/**
 * Robustly parses and normalizes Azure DevOps organization and project strings,
 * stripping nested URLs, redundant dev.azure.com prefixes, visualstudio domains,
 * and double slash artifacts.
 *
 * Example:
 * Input: org = "https://dev.azure.com/simetricwdh/ACM", project = "ACM"
 * Output: { cleanOrg: "simetricwdh", cleanProject: "ACM", fullUrl: "https://dev.azure.com/simetricwdh/ACM", displayTarget: "simetricwdh/ACM" }
 */
export function parseAdoTarget(
  orgInput?: string,
  projectInput?: string
): { cleanOrg: string; cleanProject: string; fullUrl: string; displayTarget: string; isValid: boolean; validationError?: string } {
  const norm = normalizeAdoTarget(orgInput, projectInput);
  
  // Provide seamless defaults if inputs were empty
  let cleanOrg = norm.cleanOrg || 'simetricwdh';
  let cleanProject = norm.cleanProject || 'ACM';

  if (cleanProject && cleanProject.toLowerCase() === cleanOrg.toLowerCase()) {
    cleanOrg = 'simetricwdh';
    cleanProject = 'ACM';
  }

  const fullUrl = cleanProject ? `https://dev.azure.com/${cleanOrg}/${cleanProject}` : `https://dev.azure.com/${cleanOrg}`;
  const displayTarget = cleanProject ? `${cleanOrg}/${cleanProject}` : cleanOrg;

  return {
    cleanOrg,
    cleanProject,
    fullUrl,
    displayTarget,
    isValid: norm.isValid,
    validationError: norm.validationError
  };
}

/**
 * Extracts or infers a release number string (e.g. "v4.2.0", "D5-R2609", "Sprint-24") from a release name or iteration path string.
 */
export function extractReleaseNumber(text: string): string {
  if (!text) return '';
  const match = text.match(/(?:Release|Rel|v)?\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
  if (match && match[1]) {
    return `v${match[1]}`;
  }
  const dMatch = text.match(/\b(D\d+[\s\-_]*R[\s\-_]*\d{4}(?:\.\d{2})?)\b/i) || text.match(/\b(D\d+)\b/i) || text.match(/\b(R\d{4})\b/i);
  if (dMatch && dMatch[1]) {
    return dMatch[1].replace(/[\s_]+/g, '-');
  }
  const sprintMatch = text.match(/Sprint\s*([0-9]+)/i);
  if (sprintMatch && sprintMatch[1]) {
    return `Sprint-${sprintMatch[1]}`;
  }
  return '';
}

/**
 * Returns a clean, non-duplicated display label for a release/iteration
 */
export function formatReleaseDisplayName(name: string, releaseNumber?: string): string {
  if (!name) return 'Unnamed Iteration';
  const cleanName = name.trim();
  const cleanNum = (releaseNumber || '').trim();

  if (!cleanNum || cleanNum === cleanName || cleanName.toLowerCase().includes(cleanNum.toLowerCase())) {
    return cleanName;
  }
  return `${cleanName} (${cleanNum})`;
}

/**
 * Returns clean canonical Azure DevOps URL e.g. "https://dev.azure.com/simetricwdh/ACM"
 */
export function formatAdoUrl(org?: string, project?: string): string {
  return parseAdoTarget(org, project).fullUrl;
}

/**
 * Robust helper that matches any item (UserStory, TestCase, Defect, Task)
 * against a target release filter (release ID, iteration path, or release name).
 */
export function matchesReleaseOrIteration(
  item: { releaseId?: string | null; iterationPath?: string; areaPath?: string },
  filterReleaseIdOrIter: string,
  releases: Release[] = []
): boolean {
  if (!filterReleaseIdOrIter || filterReleaseIdOrIter === 'all') return true;

  const target = filterReleaseIdOrIter.trim();
  const targetLower = target.toLowerCase();
  const norm = (s?: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetNorm = norm(target);

  // 1. Direct releaseId match
  if (item.releaseId && (item.releaseId === target || item.releaseId.toLowerCase() === targetLower)) {
    return true;
  }

  // 2. Direct iterationPath exact match
  if (item.iterationPath) {
    const itemIterLower = item.iterationPath.toLowerCase();
    if (itemIterLower === targetLower) return true;
    if (targetNorm && norm(item.iterationPath) === targetNorm) return true;
  }

  // 3. Find if target is a known Release ID, Name, or Iteration Path
  const matchedRelease = releases.find(r => 
    r.id === target || 
    r.id.toLowerCase() === targetLower ||
    (r.iterationPath && r.iterationPath.toLowerCase() === targetLower) ||
    r.name.toLowerCase() === targetLower ||
    (targetNorm && (norm(r.id) === targetNorm || norm(r.iterationPath) === targetNorm || norm(r.name) === targetNorm))
  );

  if (matchedRelease) {
    if (item.releaseId && (item.releaseId === matchedRelease.id || item.releaseId.toLowerCase() === matchedRelease.id.toLowerCase())) {
      return true;
    }

    if (item.iterationPath) {
      const itemIterNorm = norm(item.iterationPath);
      const relIterNorm = norm(matchedRelease.iterationPath);
      const relNameNorm = norm(matchedRelease.name);

      if (relIterNorm && itemIterNorm === relIterNorm) return true;
      if (relNameNorm && itemIterNorm === relNameNorm) return true;

      // Extract milestone D-numbers to avoid cross-matching D5 with D4/D3
      const extractD = (s: string) => {
        const m = s.match(/d(\d+)/i);
        return m ? `d${m[1]}`.toLowerCase() : null;
      };

      const itemD = extractD(item.iterationPath);
      const relIterD = extractD(matchedRelease.iterationPath || '');
      const relNameD = extractD(matchedRelease.name || '');
      const targetD = relIterD || relNameD;

      if (itemD && targetD && itemD !== targetD) {
        return false;
      }

      if (relIterNorm && (itemIterNorm.includes(relIterNorm) || relIterNorm.includes(itemIterNorm))) return true;
      if (relNameNorm && (itemIterNorm.includes(relNameNorm) || relNameNorm.includes(itemIterNorm))) return true;
    }
  }

  return false;
}

/**
 * Generates a unified canonical key for a release to detect duplicates regardless of:
 * - "ACM\D5 R 2026.09" vs "D5 R 2026.09" vs "simetricwdh\ACM\D5 R 2026.09"
 * - Release numbers "v2026.09" vs "2026.09"
 */
export function normalizeReleaseKey(name: string, iterationPath?: string, releaseNumber?: string): string {
  const stripPrefix = (str: string) => {
    return (str || '')
      .replace(/^simetricwdh\\/i, '')
      .replace(/^acm\\/i, '')
      .replace(/^[\w-]+\\/i, '')
      .trim();
  };

  const cleanName = stripPrefix(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanIter = stripPrefix(iterationPath || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanNum = (releaseNumber || extractReleaseNumber(name) || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const dMatch = (name + ' ' + (iterationPath || '')).match(/d(\d+)/i);
  const dTag = dMatch ? `d${dMatch[1]}` : '';

  if (dTag && cleanNum) {
    return `${dTag}-${cleanNum}`;
  }

  return cleanIter || cleanName || cleanNum || 'release-default';
}

/**
 * Deduplicates and consolidates release records, merging duplicates and returning
 * the canonical clean list along with an ID redirection map for work items.
 */
export function deduplicateAndMergeReleases(releases: Release[]): {
  mergedReleases: Release[];
  idRedirectMap: Map<string, string>;
} {
  const groups = new Map<string, Release[]>();
  const idRedirectMap = new Map<string, string>();

  (releases || []).forEach(rel => {
    const key = normalizeReleaseKey(rel.name, rel.iterationPath, rel.releaseNumber);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(rel);
  });

  const mergedReleases: Release[] = [];

  groups.forEach((groupRels) => {
    groupRels.sort((a, b) => {
      const aHasPrefix = a.name.includes('\\');
      const bHasPrefix = b.name.includes('\\');
      if (!aHasPrefix && bHasPrefix) return -1;
      if (aHasPrefix && !bHasPrefix) return 1;

      if (a.status !== 'Planning' && b.status === 'Planning') return -1;
      if (a.status === 'Planning' && b.status !== 'Planning') return 1;

      return 0;
    });

    const canonical = groupRels[0];
    const canonicalId = canonical.id;

    const cleanName = canonical.name.includes('\\') 
      ? canonical.name.split('\\').pop()!.trim() 
      : canonical.name;

    const fullIterPath = canonical.iterationPath?.includes('\\') 
      ? canonical.iterationPath 
      : `ACM\\${cleanName}`;

    const merged: Release = {
      ...canonical,
      name: cleanName,
      iterationPath: fullIterPath,
      releaseNumber: canonical.releaseNumber || extractReleaseNumber(cleanName),
      description: canonical.description || groupRels.find(r => r.description)?.description || '',
      scopeNotes: canonical.scopeNotes || groupRels.find(r => r.scopeNotes)?.scopeNotes || ''
    };

    mergedReleases.push(merged);

    groupRels.forEach(r => {
      idRedirectMap.set(r.id, canonicalId);
    });
  });

  return { mergedReleases, idRedirectMap };
}


