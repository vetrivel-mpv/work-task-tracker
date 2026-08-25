/**
 * Azure DevOps URL & Project Name Normalization & Validation Utility
 *
 * Normalizes any pasted ADO link format, handles legacy visualstudio.com subdomains,
 * deep links (boards, workitems, queries, pipelines), URL encoded characters,
 * path variations, and validates/rejects malformed inputs before API execution.
 */

export interface NormalizedAdoTarget {
  isValid: boolean;
  cleanOrg: string;
  cleanProject: string;
  fullUrl: string;
  displayTarget: string;
  projectUrl: string;
  orgUrl: string;
  workItemsUrl: string;
  boardsUrl: string;
  detectedType?: 'modern_dev_azure' | 'legacy_visualstudio' | 'deep_link' | 'plain_name' | 'slash_separated' | 'invalid';
  validationError?: string;
}

// ADO Identifier naming constraints:
// - Organizations/Projects must not contain illegal characters: / \ : * ? " < > | ; # $ % { } [ ]
// - Length between 1 and 64 characters
const ILLEGAL_ADO_CHARS_REGEX = /[\\:*?"<>|;#$%{}[\]^~`]/;
const INVALID_START_END_REGEX = /^[._\-]|[\s._\-]$/;

/**
 * Validates whether an ADO organization or project name meets Azure DevOps rules
 */
export function validateAdoIdentifier(name: string, type: 'Organization' | 'Project' = 'Project'): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${type} name cannot be empty.` };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: `${type} name cannot be whitespace only.` };
  }

  if (trimmed.length > 64) {
    return { valid: false, error: `${type} name cannot exceed 64 characters.` };
  }

  if (ILLEGAL_ADO_CHARS_REGEX.test(trimmed)) {
    return { valid: false, error: `${type} name contains illegal characters (cannot contain / \\ : * ? " < > | ; # $ % { } [ ]).` };
  }

  if (INVALID_START_END_REGEX.test(trimmed)) {
    return { valid: false, error: `${type} name cannot start or end with spaces, periods, underscores, or hyphens.` };
  }

  return { valid: true };
}

/**
 * Normalizes any Azure DevOps link or name input format into a canonical target structure.
 * Supports:
 * - https://dev.azure.com/org/project
 * - https://org.visualstudio.com/project
 * - https://dev.azure.com/org/project/_workitems/edit/12345
 * - https://dev.azure.com/org/project/_boards/board/t/team/Stories
 * - https://dev.azure.com/org/project/_queries/query/xyz
 * - org/project (e.g., simetricwdh/ACM)
 * - org / project in separate fields
 * - Project names alone with default org fallbacks
 */
export function normalizeAdoTarget(
  orgOrUrlInput?: string,
  projectInput?: string
): NormalizedAdoTarget {
  const rawInput = (orgOrUrlInput || '').trim();
  const rawProjectInput = (projectInput || '').trim();

  // If both inputs are completely blank
  if (!rawInput && !rawProjectInput) {
    return {
      isValid: false,
      cleanOrg: '',
      cleanProject: '',
      fullUrl: '',
      displayTarget: '',
      projectUrl: '',
      orgUrl: '',
      workItemsUrl: '',
      boardsUrl: '',
      detectedType: 'invalid',
      validationError: 'Organization or Azure DevOps URL is required.'
    };
  }

  let extractedOrg = '';
  let extractedProject = '';
  let detectedType: NormalizedAdoTarget['detectedType'] = 'plain_name';

  // Decode URI components if URL-encoded (e.g. %20 for spaces)
  let workingText = rawInput;
  try {
    if (workingText.includes('%')) {
      workingText = decodeURIComponent(workingText);
    }
  } catch {
    // Keep working text as is if decode fails
  }

  // CASE 1: Legacy VisualStudio Domain (e.g. https://myorg.visualstudio.com/MyProject or https://myorg.visualstudio.com/DefaultCollection/MyProject)
  if (/^https?:\/\/([^.]+)\.visualstudio\.com/i.test(workingText)) {
    detectedType = 'legacy_visualstudio';
    const match = workingText.match(/^https?:\/\/([^.]+)\.visualstudio\.com(?:\/(?:DefaultCollection\/)?([^/?#]+))?/i);
    if (match) {
      extractedOrg = match[1] || '';
      extractedProject = match[2] || rawProjectInput || '';
    }
  }
  // CASE 2: Modern dev.azure.com URL (e.g. https://dev.azure.com/org/project/...)
  else if (/^https?:\/\/dev\.azure\.com\//i.test(workingText) || workingText.includes('dev.azure.com/')) {
    detectedType = 'modern_dev_azure';
    // Strip domain and query/hash
    const pathPart = workingText
      .replace(/^https?:\/\/dev\.azure\.com\//i, '')
      .replace(/^[a-z0-9-.]+dev\.azure\.com\//i, '')
      .split('?')[0]
      .split('#')[0];

    const segments = pathPart.split('/').filter(Boolean);

    if (segments.length >= 1) {
      extractedOrg = segments[0];
    }
    if (segments.length >= 2) {
      // If segment 2 is not a system route like _apis or _git
      const seg2 = segments[1];
      if (!seg2.startsWith('_')) {
        extractedProject = seg2;
      }
    }
  }
  // CASE 3: Slash separated (e.g. simetricwdh/ACM or simetricwdh\ACM)
  else if (workingText.includes('/') || workingText.includes('\\')) {
    detectedType = 'slash_separated';
    const cleanSlashes = workingText.replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
    const segments = cleanSlashes.split('/').filter(Boolean);
    if (segments.length >= 2) {
      extractedOrg = segments[0];
      extractedProject = segments[1];
    } else if (segments.length === 1) {
      extractedOrg = segments[0];
    }
  }
  // CASE 4: Plain inputs
  else {
    detectedType = 'plain_name';
    extractedOrg = workingText;
    extractedProject = rawProjectInput;
  }

  // If project was passed in projectInput override if extracted was empty
  if (!extractedProject && rawProjectInput) {
    let cleanProj = rawProjectInput;
    if (cleanProj.includes('/') || cleanProj.includes('\\')) {
      cleanProj = cleanProj.replace(/\\+/g, '/').split('/').filter(Boolean).pop() || cleanProj;
    }
    extractedProject = cleanProj;
  }

  // Clean trailing punctuation and internal markers
  extractedOrg = extractedOrg.replace(/[?#].*$/, '').trim();
  extractedProject = extractedProject.replace(/[?#].*$/, '').trim();

  // If project is duplicated or passed as _workitems or _boards, clean it
  if (extractedProject.startsWith('_')) {
    detectedType = 'deep_link';
    extractedProject = rawProjectInput || '';
  }

  // Validation Phase
  const orgValidation = validateAdoIdentifier(extractedOrg, 'Organization');
  if (!orgValidation.valid) {
    return {
      isValid: false,
      cleanOrg: extractedOrg,
      cleanProject: extractedProject,
      fullUrl: '',
      displayTarget: `${extractedOrg}/${extractedProject}`,
      projectUrl: '',
      orgUrl: '',
      workItemsUrl: '',
      boardsUrl: '',
      detectedType: 'invalid',
      validationError: `Invalid Organization: ${orgValidation.error}`
    };
  }

  if (extractedProject) {
    const projValidation = validateAdoIdentifier(extractedProject, 'Project');
    if (!projValidation.valid) {
      return {
        isValid: false,
        cleanOrg: extractedOrg,
        cleanProject: extractedProject,
        fullUrl: `https://dev.azure.com/${extractedOrg}`,
        displayTarget: `${extractedOrg}/${extractedProject}`,
        projectUrl: '',
        orgUrl: `https://dev.azure.com/${extractedOrg}`,
        workItemsUrl: '',
        boardsUrl: '',
        detectedType: 'invalid',
        validationError: `Invalid Project: ${projValidation.error}`
      };
    }
  }

  const cleanOrg = extractedOrg;
  const cleanProject = extractedProject;
  const orgUrl = `https://dev.azure.com/${cleanOrg}`;
  const projectUrl = cleanProject ? `https://dev.azure.com/${cleanOrg}/${cleanProject}` : orgUrl;
  const fullUrl = projectUrl;
  const displayTarget = cleanProject ? `${cleanOrg}/${cleanProject}` : cleanOrg;
  const workItemsUrl = cleanProject ? `https://dev.azure.com/${cleanOrg}/${cleanProject}/_workitems` : '';
  const boardsUrl = cleanProject ? `https://dev.azure.com/${cleanOrg}/${cleanProject}/_boards` : '';

  return {
    isValid: true,
    cleanOrg,
    cleanProject,
    fullUrl,
    displayTarget,
    projectUrl,
    orgUrl,
    workItemsUrl,
    boardsUrl,
    detectedType
  };
}

/**
 * Normalizes single work item deep links and returns org, project, and work item ID.
 * Example: https://dev.azure.com/simetricwdh/ACM/_workitems/edit/41203 -> { org: 'simetricwdh', project: 'ACM', workItemId: 41203 }
 */
export function parseWorkItemUrl(url: string): { org: string; project: string; workItemId: number | null; isValid: boolean } {
  if (!url || typeof url !== 'string') {
    return { org: '', project: '', workItemId: null, isValid: false };
  }

  const normalized = normalizeAdoTarget(url);
  let workItemId: number | null = null;

  const idMatch = url.match(/_workitems\/edit\/(\d+)/i) || 
                  url.match(/workitem=(\d+)/i) || 
                  url.match(/#workitem=(\d+)/i) ||
                  url.match(/\/(\d+)$/);

  if (idMatch && idMatch[1]) {
    workItemId = parseInt(idMatch[1], 10);
  }

  return {
    org: normalized.cleanOrg,
    project: normalized.cleanProject,
    workItemId,
    isValid: normalized.isValid && workItemId !== null && !isNaN(workItemId)
  };
}
