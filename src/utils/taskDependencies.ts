import { Task } from '../types';

export interface TaskBlockedStatus {
  isBlocked: boolean;
  blockingTasks: Task[];
  allPrerequisiteTasks: Task[];
  totalPrerequisites: number;
  completedPrerequisites: number;
  dependentTasks: Task[];
}

/**
 * Computes whether a task is currently blocked by any incomplete prerequisite tasks.
 */
export function getTaskBlockedStatus(task: Task, allTasks: Task[]): TaskBlockedStatus {
  const prerequisiteIds = task.dependsOnTaskIds || [];
  
  const allPrerequisiteTasks = prerequisiteIds
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Task => Boolean(t));

  const blockingTasks = allPrerequisiteTasks.filter(t => t.status !== 'complete');
  const completedPrerequisites = allPrerequisiteTasks.filter(t => t.status === 'complete').length;
  
  // A task is considered blocked if it is not completed itself and has at least one incomplete prerequisite
  const isBlocked = task.status !== 'complete' && blockingTasks.length > 0;

  // Tasks that depend on this task
  const dependentTasks = allTasks.filter(t => 
    t.id !== task.id && t.dependsOnTaskIds && t.dependsOnTaskIds.includes(task.id)
  );

  return {
    isBlocked,
    blockingTasks,
    allPrerequisiteTasks,
    totalPrerequisites: allPrerequisiteTasks.length,
    completedPrerequisites,
    dependentTasks
  };
}

/**
 * Checks whether adding a dependency candidateId to taskId would introduce a circular loop.
 */
export function wouldCreateCircularDependency(
  taskId: string, 
  candidatePrerequisiteId: string, 
  allTasks: Task[]
): boolean {
  if (taskId === candidatePrerequisiteId) return true;

  const visited = new Set<string>();
  const queue = [candidatePrerequisiteId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === taskId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentTask = allTasks.find(t => t.id === currentId);
    if (currentTask && currentTask.dependsOnTaskIds) {
      for (const nextPrereqId of currentTask.dependsOnTaskIds) {
        if (!visited.has(nextPrereqId)) {
          queue.push(nextPrereqId);
        }
      }
    }
  }

  return false;
}
