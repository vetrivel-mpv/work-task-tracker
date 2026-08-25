import { ApiFlowStep, ApiTestFlow } from '../types/apiAutomation';

export interface VariableDependencyLink {
  variableName: string;
  producerStepIndex?: number;
  producerStepId?: string;
  producerStepName?: string;
  consumerStepIndex: number;
  consumerStepId: string;
  consumerStepName: string;
  location: 'url' | 'header' | 'param' | 'body' | 'auth' | 'script' | 'condition';
  isResolved: boolean; // true if produced by prior step or global/env vars
}

export interface StepDependencySummary {
  stepId: string;
  stepNumber: number;
  stepName: string;
  producedVariables: string[];
  consumedVariables: {
    variableName: string;
    location: string;
    resolvedBy?: {
      type: 'global' | 'environment' | 'step';
      stepNumber?: number;
      stepName?: number | string;
    };
    isMissing: boolean;
  }[];
  dependsOnStepNumbers: number[];
  providesForStepNumbers: number[];
}

export interface FlowDependencyGraph {
  allProducedVariables: Set<string>;
  allConsumedVariables: Set<string>;
  missingVariables: string[];
  stepSummaries: StepDependencySummary[];
  dependencyLinks: VariableDependencyLink[];
  hasBrokenDependencies: boolean;
}

/**
 * Extract all {{variableName}} and bru.getVar('var') references from text
 */
export function extractVariableNames(text?: string): string[] {
  if (!text) return [];
  const vars = new Set<string>();

  // 1. Match {{varName}}
  const mustacheRegex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let match;
  while ((match = mustacheRegex.exec(text)) !== null) {
    if (match[1]) vars.add(match[1].trim());
  }

  // 2. Match bru.getVar('varName') or bru.getVar("varName")
  const getVarRegex = /bru\.getVar\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g;
  while ((match = getVarRegex.exec(text)) !== null) {
    if (match[1]) vars.add(match[1].trim());
  }

  // 3. Match vars.varName in custom JS expressions
  const varsObjRegex = /\bvars\.([a-zA-Z0-9_]+)\b/g;
  while ((match = varsObjRegex.exec(text)) !== null) {
    if (match[1]) vars.add(match[1].trim());
  }

  return Array.from(vars);
}

/**
 * Extract all variables produced by a step (extractors + bru.setVar)
 */
export function extractProducedVariables(step: ApiFlowStep): string[] {
  const produced = new Set<string>();

  // 1. From step extractors
  (step.extractors || []).forEach(ext => {
    const varName = ext.variableName || ext.targetVariable;
    if (varName && varName.trim()) {
      produced.add(varName.trim());
    }
  });

  // 2. From request extractVariables
  (step.request?.extractVariables || []).forEach(ext => {
    const varName = ext.variableName || ext.targetVariable;
    if (varName && varName.trim()) {
      produced.add(varName.trim());
    }
  });

  // 3. From brunoPostScript: bru.setVar('name', val)
  if (step.brunoPostScript) {
    const setVarRegex = /bru\.setVar\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*,/g;
    let match;
    while ((match = setVarRegex.exec(step.brunoPostScript)) !== null) {
      if (match[1]) produced.add(match[1].trim());
    }
  }

  return Array.from(produced);
}

/**
 * Extract all variables consumed by a step
 */
export function extractConsumedVariables(step: ApiFlowStep): { variableName: string; location: 'url' | 'header' | 'param' | 'body' | 'auth' | 'script' | 'condition' }[] {
  const consumed: { variableName: string; location: 'url' | 'header' | 'param' | 'body' | 'auth' | 'script' | 'condition' }[] = [];
  const seen = new Set<string>();

  const addVar = (name: string, location: 'url' | 'header' | 'param' | 'body' | 'auth' | 'script' | 'condition') => {
    const key = `${name}_${location}`;
    if (!seen.has(key)) {
      seen.add(key);
      consumed.push({ variableName: name, location });
    }
  };

  // URL
  if (step.request?.url) {
    extractVariableNames(step.request.url).forEach(v => addVar(v, 'url'));
  }

  // Headers
  (step.request?.headers || []).forEach(h => {
    if (h.enabled) {
      extractVariableNames(h.key).forEach(v => addVar(v, 'header'));
      extractVariableNames(h.value).forEach(v => addVar(v, 'header'));
    }
  });

  // Query Params
  (step.request?.params || []).forEach(p => {
    if (p.enabled) {
      extractVariableNames(p.key).forEach(v => addVar(v, 'param'));
      extractVariableNames(p.value).forEach(v => addVar(v, 'param'));
    }
  });

  // Body
  if (step.request?.bodyContent) {
    extractVariableNames(step.request.bodyContent).forEach(v => addVar(v, 'body'));
  }

  // Auth Bearer
  if (step.request?.auth?.bearerToken) {
    extractVariableNames(step.request.auth.bearerToken).forEach(v => addVar(v, 'auth'));
  }

  // Condition Expression
  if (step.customCondition) {
    extractVariableNames(step.customCondition).forEach(v => addVar(v, 'condition'));
  }

  // Bruno Pre-Script
  if (step.brunoPreScript) {
    extractVariableNames(step.brunoPreScript).forEach(v => addVar(v, 'script'));
  }

  return consumed;
}

/**
 * Analyzes the entire flow's step dependency graph
 */
export function analyzeFlowDependencies(
  flow: ApiTestFlow, 
  globalVariables: Record<string, any> = {},
  environmentVariables: Record<string, any> = {}
): FlowDependencyGraph {
  const allProducedVariables = new Set<string>();
  const allConsumedVariables = new Set<string>();
  const missingVariables = new Set<string>();
  const dependencyLinks: VariableDependencyLink[] = [];
  const stepSummaries: StepDependencySummary[] = [];

  // Available variables at each stage of sequence
  const variableProducersMap = new Map<string, { stepNumber: number; stepId: string; stepName: string }>();

  // Register globals and env vars first
  Object.keys(globalVariables || {}).forEach(k => allProducedVariables.add(k));
  Object.keys(environmentVariables || {}).forEach(k => allProducedVariables.add(k));

  flow.steps.forEach((step, stepIdx) => {
    const produced = extractProducedVariables(step);
    const consumed = extractConsumedVariables(step);

    produced.forEach(p => allProducedVariables.add(p));

    const consumedSummary: StepDependencySummary['consumedVariables'] = [];
    const dependsOnSteps = new Set<number>();

    consumed.forEach(({ variableName, location }) => {
      allConsumedVariables.add(variableName);

      // Check where this variable comes from
      let resolved = false;
      let resolvedByInfo: StepDependencySummary['consumedVariables'][0]['resolvedBy'] | undefined;

      if (variableProducersMap.has(variableName)) {
        const prod = variableProducersMap.get(variableName)!;
        resolved = true;
        resolvedByInfo = {
          type: 'step',
          stepNumber: prod.stepNumber,
          stepName: prod.stepName
        };
        dependsOnSteps.add(prod.stepNumber);

        dependencyLinks.push({
          variableName,
          producerStepIndex: prod.stepNumber - 1,
          producerStepId: prod.stepId,
          producerStepName: prod.stepName,
          consumerStepIndex: stepIdx,
          consumerStepId: step.id,
          consumerStepName: step.name,
          location,
          isResolved: true
        });
      } else if (globalVariables && variableName in globalVariables) {
        resolved = true;
        resolvedByInfo = { type: 'global' };
        dependencyLinks.push({
          variableName,
          consumerStepIndex: stepIdx,
          consumerStepId: step.id,
          consumerStepName: step.name,
          location,
          isResolved: true
        });
      } else if (environmentVariables && variableName in environmentVariables) {
        resolved = true;
        resolvedByInfo = { type: 'environment' };
        dependencyLinks.push({
          variableName,
          consumerStepIndex: stepIdx,
          consumerStepId: step.id,
          consumerStepName: step.name,
          location,
          isResolved: true
        });
      } else {
        // Variable is NOT resolved by any prior step or global/env!
        missingVariables.add(variableName);
        dependencyLinks.push({
          variableName,
          consumerStepIndex: stepIdx,
          consumerStepId: step.id,
          consumerStepName: step.name,
          location,
          isResolved: false
        });
      }

      consumedSummary.push({
        variableName,
        location,
        resolvedBy: resolvedByInfo,
        isMissing: !resolved
      });
    });

    stepSummaries.push({
      stepId: step.id,
      stepNumber: step.stepNumber || stepIdx + 1,
      stepName: step.name,
      producedVariables: produced,
      consumedVariables: consumedSummary,
      dependsOnStepNumbers: Array.from(dependsOnSteps),
      providesForStepNumbers: [] // Populated in second pass
    });

    // Register this step's produced variables for subsequent steps
    produced.forEach(p => {
      variableProducersMap.set(p, {
        stepNumber: step.stepNumber || stepIdx + 1,
        stepId: step.id,
        stepName: step.name
      });
    });
  });

  // Second pass: fill providesForStepNumbers
  stepSummaries.forEach(consumer => {
    consumer.dependsOnStepNumbers.forEach(producerNum => {
      const producer = stepSummaries.find(s => s.stepNumber === producerNum);
      if (producer && !producer.providesForStepNumbers.includes(consumer.stepNumber)) {
        producer.providesForStepNumbers.push(consumer.stepNumber);
      }
    });
  });

  return {
    allProducedVariables,
    allConsumedVariables,
    missingVariables: Array.from(missingVariables),
    stepSummaries,
    dependencyLinks,
    hasBrokenDependencies: missingVariables.size > 0
  };
}
