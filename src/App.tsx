import React, { useState, useEffect } from 'react';
import { 
  AppState, 
  NavView, 
  Task, 
  UserStory, 
  TestCase,
  Defect, 
  Release, 
  StandupEntry, 
  TeamMember, 
  TeamGroup, 
  PeopleReviewNote, 
  BlueprintItem, 
  AdoConfig,
  DualAdoConfig,
  AppUser
} from './types';
import { loadStoredState, saveStoredState, resetToDemoState, loadFromIndexedDB } from './utils/storage';
import { toDateStr, shiftDate, generateId } from './utils/date';
import { isTestCaseItem, isDefectItem, convertStoryToTestCase, filterPureUserStories } from './utils/itemClassification';
import { matchesReleaseOrIteration } from './utils/adoPaths';
import { syncAuthSession } from './utils/authClient';
import { sanitizeAndLinkWorkItems } from './utils/assigneeUtils';

// Layout Components
import { ModernPortalHeader } from './components/layout/ModernPortalHeader';
import { PortalSummaryStrip } from './components/layout/PortalSummaryStrip';
import { CommandPaletteModal } from './components/layout/CommandPaletteModal';

// View Modules
import { TaskBoard } from './components/board/TaskBoard';
import { NewTaskModal } from './components/board/NewTaskModal';
import { UserStoriesView } from './components/userStories/UserStoriesView';
import { TestCasesView } from './components/testCases/TestCasesView';
import { DefectsView } from './components/defects/DefectsView';
import { DefectsDashboard } from './components/defects/DefectsDashboard';
import { ReleasesView } from './components/releases/ReleasesView';
import { StandupView } from './components/standup/StandupView';
import { RetrospectiveView } from './components/retrospective/RetrospectiveView';
import { PeopleReviewView } from './components/people/PeopleReviewView';
import { BlueprintView } from './components/blueprint/BlueprintView';
import { SettingsView } from './components/settings/SettingsView';
import { ApiAutomationView } from './components/apiAutomation/ApiAutomationView';
import { ApiAutomationCollection, ApiEnvironment, ApiTestExecutionRun } from './types/apiAutomation';

// Modals
import { AdoSyncModal } from './components/ado/AdoSyncModal';
import { EmailBroadcastModal } from './components/email/EmailBroadcastModal';
import { AiDuplicateScannerModal } from './components/common/AiDuplicateScannerModal';
import { TechnicalDebtImpactModal } from './components/defects/TechnicalDebtImpactModal';
import { AbsenceRecord, TeamRoastRecord } from './types';

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadStoredState);
  const [activeView, setActiveView] = useState<NavView>('board');
  const [currentDateStr, setCurrentDateStr] = useState<string>(toDateStr(new Date()));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);

  // Modals state
  const [newTaskModalOpen, setNewTaskModalOpen] = useState<boolean>(false);
  const [adoModalOpen, setAdoModalOpen] = useState<boolean>(false);
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
  const [duplicateScannerOpen, setDuplicateScannerOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [techDebtModalOpen, setTechDebtModalOpen] = useState<boolean>(false);
  const [emailInitialTab, setEmailInitialTab] = useState<string>('daily_standup');
  const [emailModalDefectId, setEmailModalDefectId] = useState<string | undefined>(undefined);
  const [emailModalReleaseId, setEmailModalReleaseId] = useState<string | undefined>(undefined);

  // Global Command Palette Shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme updater
  const handleUpdateTheme = (theme: any) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme
      }
    }));
  };

  // Hydrate full state from IndexedDB on initial mount if available
  useEffect(() => {
    let isMounted = true;
    loadFromIndexedDB().then((idbState) => {
      if (isMounted && idbState) {
        setState(prev => {
          // If IndexedDB has more/equal data, merge cleanly
          if ((idbState.userStories?.length || 0) >= (prev.userStories?.length || 0) &&
              (idbState.defects?.length || 0) >= (prev.defects?.length || 0)) {
            const sanitized = sanitizeAndLinkWorkItems({
              userStories: idbState.userStories,
              testCases: idbState.testCases,
              defects: idbState.defects,
              tasks: idbState.tasks,
              team: idbState.team
            });
            return {
              ...prev,
              ...idbState,
              ...sanitized,
              settings: { ...prev.settings, ...(idbState.settings || {}) }
            };
          }
          return prev;
        });
      }
    }).catch(err => {
      console.warn('[App] IndexedDB hydration note:', err);
    });
    return () => { isMounted = false; };
  }, []);

  // Auto-persist state changes
  useEffect(() => {
    saveStoredState(state);
  }, [state]);

  // Synchronize authenticated session with backend proxy when active user changes
  useEffect(() => {
    const activeUser = (state.users || []).find(u => u.id === state.currentUserId) || (state.users || [])[0];
    if (activeUser) {
      syncAuthSession(activeUser);
    }
  }, [state.currentUserId, state.users]);

  // Apply theme, density, and application title to document
  useEffect(() => {
    const currentTheme = state.settings?.theme || 'executive_slate';
    document.documentElement.setAttribute('data-theme', currentTheme);
    const currentDensity = state.settings?.density || 'comfortable';
    document.documentElement.setAttribute('data-density', currentDensity);
    const appName = state.settings?.appName || 'ACM (AT&T Connection Manager) Delivery';
    document.title = appName;
  }, [state.settings?.theme, state.settings?.density, state.settings?.appName]);

  // Quick stats counts for sidebar
  const pendingTasksCount = state.tasks.filter(
    t => t.dateStr === currentDateStr && t.status !== 'complete'
  ).length;
  const activeStoriesCount = state.userStories.filter(
    s => !isTestCaseItem(s) && s.status !== 'Done' && s.status !== 'QA Passed'
  ).length;
  const testCasesCount = (state.testCases || []).length;
  const openDefectsCount = state.defects.filter(
    d => d.status !== 'Closed'
  ).length;
  const standupCount = Object.keys(state.standup).length;

  // Task Operations
  const handleToggleTaskStatus = (taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== taskId) return t;
        const nextStatus = t.status === 'complete' ? 'pending' : 'complete';
        return {
          ...t,
          status: nextStatus,
          completedAt: nextStatus === 'complete' ? new Date().toISOString() : undefined
        };
      })
    }));
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId)
    }));
  };

  const handleReorderTasks = (newTasks: Task[]) => {
    setState(prev => ({
      ...prev,
      tasks: newTasks
    }));
  };

  const handleMoveTask = (
    taskId: string,
    updates: Partial<Task>,
    targetTaskId?: string,
    position?: 'before' | 'after'
  ) => {
    setState(prev => {
      const taskIndex = prev.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;

      const originalTask = prev.tasks[taskIndex];
      const updatedTask: Task = { ...originalTask, ...updates };

      // If status changed to complete or from complete, handle completedAt
      if (updates.status) {
        if (updates.status === 'complete' && originalTask.status !== 'complete') {
          updatedTask.completedAt = new Date().toISOString();
        } else if (updates.status !== 'complete') {
          updatedTask.completedAt = undefined;
        }
      }

      if (!targetTaskId || targetTaskId === taskId) {
        return {
          ...prev,
          tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
        };
      }

      // Filter out the dragged task and find target task's index in the overall array
      const otherTasks = prev.tasks.filter(t => t.id !== taskId);
      const targetIndex = otherTasks.findIndex(t => t.id === targetTaskId);

      if (targetIndex === -1) {
        return {
          ...prev,
          tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
        };
      }

      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
      const newTasks = [...otherTasks];
      newTasks.splice(insertIndex, 0, updatedTask);

      return {
        ...prev,
        tasks: newTasks
      };
    });
  };

  const handleAddTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: generateId('tsk'),
      title: taskData.title || 'Untitled Task',
      time: taskData.time,
      priority: taskData.priority || 'medium',
      status: taskData.status || 'pending',
      dateStr: taskData.dateStr || currentDateStr,
      assigneeIds: taskData.assigneeIds || [],
      groupIds: taskData.groupIds || [],
      releaseId: taskData.releaseId,
      userStoryId: taskData.userStoryId,
      defectId: taskData.defectId,
      dependsOnTaskIds: taskData.dependsOnTaskIds,
      comments: taskData.comments || [],
      createdAt: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      tasks: [newTask, ...prev.tasks]
    }));
  };

  const handleAddComment = (taskId: string, text: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== taskId) return t;
        const newComment = {
          id: generateId('c'),
          author: 'Alex Rivera (Lead)',
          text: text.trim(),
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        return {
          ...t,
          comments: [...(t.comments || []), newComment]
        };
      })
    }));
  };

  const handleApplyBlueprint = (items: BlueprintItem[]) => {
    const existingTitles = new Set(
      state.tasks.filter(t => t.dateStr === currentDateStr).map(t => t.title.toLowerCase())
    );

    const newTasks: Task[] = items
      .filter(item => !existingTitles.has(item.title.toLowerCase()))
      .map(item => ({
        id: generateId('tsk'),
        title: item.title,
        time: item.time,
        priority: item.priority,
        status: 'pending',
        dateStr: currentDateStr,
        assigneeIds: [],
        groupIds: [],
        releaseId: selectedReleaseId || undefined,
        comments: item.description ? [
          {
            id: generateId('c'),
            author: 'Blueprint Cadence',
            text: item.description,
            createdAt: item.time || new Date().toISOString()
          }
        ] : [],
        createdAt: new Date().toISOString()
      }));

    if (newTasks.length > 0) {
      setState(prev => ({
        ...prev,
        tasks: [...newTasks, ...prev.tasks]
      }));
    }
  };

  // User Story Operations
  const handleAddStory = (story: UserStory) => {
    setState(prev => ({
      ...prev,
      userStories: [story, ...prev.userStories]
    }));
  };

  const handleUpdateStory = (updatedStory: UserStory) => {
    setState(prev => ({
      ...prev,
      userStories: prev.userStories.map(s => s.id === updatedStory.id ? updatedStory : s)
    }));
  };

  const handleDeleteStory = (storyId: string) => {
    setState(prev => ({
      ...prev,
      userStories: prev.userStories.filter(s => s.id !== storyId)
    }));
  };

  // Test Case Operations
  const handleAddTestCase = (testCase: TestCase) => {
    setState(prev => ({
      ...prev,
      testCases: [testCase, ...(prev.testCases || [])]
    }));
  };

  const handleUpdateTestCase = (updatedTestCase: TestCase) => {
    setState(prev => ({
      ...prev,
      testCases: (prev.testCases || []).map(tc => tc.id === updatedTestCase.id ? updatedTestCase : tc)
    }));
  };

  const handleDeleteTestCase = (testCaseId: string) => {
    setState(prev => ({
      ...prev,
      testCases: (prev.testCases || []).filter(tc => tc.id !== testCaseId)
    }));
  };

  // Defect Operations
  const handleAddDefect = (defect: Defect) => {
    setState(prev => ({
      ...prev,
      defects: [defect, ...prev.defects]
    }));
  };

  const handleUpdateDefect = (updatedDefect: Defect) => {
    setState(prev => ({
      ...prev,
      defects: prev.defects.map(d => d.id === updatedDefect.id ? updatedDefect : d)
    }));
  };

  const handleDeleteDefect = (defectId: string) => {
    setState(prev => ({
      ...prev,
      defects: prev.defects.filter(d => d.id !== defectId)
    }));
  };

  // Release Operations
  const handleAddRelease = (release: Release) => {
    if (!release) {
      console.error('[Release Validation] Attempted to add an invalid or undefined release object:', release);
      return;
    }

    setState(prev => {
      // 1. Ensure displayable name/title
      const rawName = release.name ? release.name.trim() : '';
      const fallbackName = (release.releaseNumber?.trim() || release.iterationPath?.trim() || 'Unnamed Release');
      const validName = rawName || fallbackName;

      if (!rawName) {
        console.warn(`[Release Validation] Release was missing a displayable name. Using fallback name: "${validName}"`, release);
      }

      // 2. Ensure unique and valid ID
      let validId = (release.id && release.id.trim()) ? release.id.trim() : generateId('rel');
      const idExists = prev.releases.some(r => r.id === validId);
      if (idExists) {
        const uniqueId = `${validId}_${Date.now()}`;
        console.warn(`[Release Validation] Duplicate release ID "${validId}" detected. Generated new unique ID: "${uniqueId}" for release "${validName}"`);
        validId = uniqueId;
      }

      // 3. Construct clean, displayable release object
      const sanitizedRelease: Release = {
        ...release,
        id: validId,
        name: validName,
        releaseNumber: release.releaseNumber?.trim() || undefined,
        areaPath: release.areaPath?.trim() || undefined,
        iterationPath: release.iterationPath?.trim() || undefined,
        targetDate: release.targetDate || toDateStr(new Date()),
        status: release.status || 'Planning',
        createdAt: release.createdAt || toDateStr(new Date())
      };

      console.info(
        `[Release Added] Successfully registered release "${sanitizedRelease.name}" (ID: "${sanitizedRelease.id}"). ` +
        `Total releases available in dropdowns: ${prev.releases.length + 1}`
      );

      return {
        ...prev,
        releases: [sanitizedRelease, ...prev.releases]
      };
    });
  };

  const handleUpdateRelease = (updatedRelease: Release) => {
    if (!updatedRelease || !updatedRelease.id) {
      console.warn('[Release Validation] Cannot update release without a valid ID:', updatedRelease);
      return;
    }

    setState(prev => {
      const cleanName = (updatedRelease.name?.trim() || updatedRelease.releaseNumber?.trim() || updatedRelease.iterationPath?.trim() || 'Unnamed Release');
      const sanitizedRelease: Release = {
        ...updatedRelease,
        name: cleanName,
        targetDate: updatedRelease.targetDate || toDateStr(new Date()),
        status: updatedRelease.status || 'Planning',
        createdAt: updatedRelease.createdAt || toDateStr(new Date())
      };

      return {
        ...prev,
        releases: prev.releases.map(r => r.id === sanitizedRelease.id ? sanitizedRelease : r)
      };
    });
  };

  const handleDeleteRelease = (releaseId: string) => {
    setState(prev => ({
      ...prev,
      releases: prev.releases.filter(r => r.id !== releaseId)
    }));
  };

  // Standup Operations
  const handleUpdateStandupEntry = (memberId: string, entry: StandupEntry) => {
    setState(prev => ({
      ...prev,
      standup: {
        ...prev.standup,
        [memberId]: entry
      }
    }));
  };

  // Team & People Operations
  const handleAddMember = (member: TeamMember) => {
    setState(prev => ({
      ...prev,
      team: [...prev.team, member]
    }));
  };

  const handleUpdateMember = (updatedMember: TeamMember) => {
    setState(prev => ({
      ...prev,
      team: prev.team.map(m => m.id === updatedMember.id ? updatedMember : m)
    }));
  };

  const handleDeleteMember = (memberId: string) => {
    setState(prev => ({
      ...prev,
      team: prev.team.filter(m => m.id !== memberId)
    }));
  };

  const handleAddGroup = (group: TeamGroup) => {
    setState(prev => ({
      ...prev,
      groups: [...prev.groups, group]
    }));
  };

  const handleAddReviewNote = (note: PeopleReviewNote) => {
    setState(prev => ({
      ...prev,
      peopleReviews: [note, ...prev.peopleReviews]
    }));
  };

  // User & Access Control Operations
  const handleAddUser = (user: AppUser) => {
    setState(prev => ({
      ...prev,
      users: [...(prev.users || []), user]
    }));
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    setState(prev => ({
      ...prev,
      users: (prev.users || []).map(u => u.id === updatedUser.id ? updatedUser : u)
    }));
  };

  const handleDeleteUser = (userId: string) => {
    setState(prev => ({
      ...prev,
      users: (prev.users || []).filter(u => u.id !== userId)
    }));
  };

  const handleSetCurrentUser = (userId: string) => {
    setState(prev => ({
      ...prev,
      currentUserId: userId
    }));
  };

  const handleBatchAddUsers = (newUsers: AppUser[]) => {
    setState(prev => {
      const existingEmails = new Set((prev.users || []).map(u => u.email.toLowerCase()));
      const filtered = newUsers.filter(u => !existingEmails.has(u.email.toLowerCase()));
      return {
        ...prev,
        users: [...(prev.users || []), ...filtered]
      };
    });
  };

  // Absence & Permissions Operations
  const handleAddAbsence = (record: AbsenceRecord) => {
    setState(prev => ({
      ...prev,
      absences: [record, ...(prev.absences || [])]
    }));
  };

  const handleUpdateAbsence = (updated: AbsenceRecord) => {
    setState(prev => ({
      ...prev,
      absences: (prev.absences || []).map(a => a.id === updated.id ? updated : a)
    }));
  };

  const handleDeleteAbsence = (recordId: string) => {
    setState(prev => ({
      ...prev,
      absences: (prev.absences || []).filter(a => a.id !== recordId)
    }));
  };

  // Team Roast Operations
  const handleSaveRoast = (roast: TeamRoastRecord) => {
    setState(prev => ({
      ...prev,
      roasts: [roast, ...(prev.roasts || [])]
    }));
  };

  // Blueprint Operations
  const handleUpdateBlueprint = (schedule: BlueprintItem[]) => {
    setState(prev => ({
      ...prev,
      blueprintSchedule: schedule
    }));
  };

  // ADO Dual Config & Live Synchronization
  const handleSaveDualAdoConfig = (config: DualAdoConfig) => {
    setState(prev => ({
      ...prev,
      dualAdoConfig: config
    }));
  };

  const handleSyncAdoData = (synced: {
    stories: UserStory[];
    testCases?: TestCase[];
    defects: Defect[];
    releases?: Release[];
    teamMembers?: Array<{ name: string; role?: string }>;
    tasks?: Task[];
    selectedReleaseId?: string;
    releaseIteration?: string;
  }) => {
    setState(prev => {
      const targetReleaseId = synced.selectedReleaseId || 
        (synced.releases && synced.releases.length > 0 ? synced.releases[0].id : prev.selectedReleaseId);

      const targetRelease = targetReleaseId ? prev.releases.find(r => r.id === targetReleaseId) : null;

      // 1. Separate incoming stories vs test cases
      const rawSyncedStories = synced.stories || [];
      const incomingStories: UserStory[] = [];
      const incomingTestCases: TestCase[] = [...(synced.testCases || [])];

      rawSyncedStories.forEach((s: any) => {
        const itemWithRel = {
          ...s,
          releaseId: s.releaseId || targetReleaseId || null,
          iterationPath: s.iterationPath || targetRelease?.iterationPath || s.iterationPath || ''
        };
        if (isTestCaseItem(itemWithRel)) {
          const converted = convertStoryToTestCase(itemWithRel);
          const exists = incomingTestCases.some(tc => tc.id === converted.id || (converted.adoId && tc.adoId === converted.adoId));
          if (!exists) incomingTestCases.push(converted);
        } else if (!isDefectItem(itemWithRel)) {
          incomingStories.push(itemWithRel);
        }
      });

      const incomingDefects = (synced.defects || []).map(d => ({
        ...d,
        releaseId: d.releaseId || targetReleaseId || null,
        iterationPath: d.iterationPath || targetRelease?.iterationPath || d.iterationPath || ''
      }));

      const storyAdoIdMap = new Map<number, string>();
      incomingStories.forEach(s => {
        if (s.adoId) storyAdoIdMap.set(s.adoId, s.id);
      });
      const defectAdoIdMap = new Map<number, string>();
      incomingDefects.forEach(d => {
        if (d.adoId) defectAdoIdMap.set(d.adoId, d.id);
      });

      const todayStr = currentDateStr || toDateStr(new Date());

      const incomingTasks = (synced.tasks || []).map(t => {
        let userStoryId = t.userStoryId || null;
        let defectId = t.defectId || null;
        const parentId = (t as any).parentId;
        if (parentId && typeof parentId === 'number') {
          if (storyAdoIdMap.has(parentId)) {
            userStoryId = storyAdoIdMap.get(parentId)!;
          } else if (defectAdoIdMap.has(parentId)) {
            defectId = defectAdoIdMap.get(parentId)!;
          }
        }
        return {
          ...t,
          dateStr: t.dateStr || todayStr,
          priority: t.priority || 'medium',
          status: t.status || 'pending',
          userStoryId,
          defectId,
          releaseId: t.releaseId || targetReleaseId || null,
          iterationPath: t.iterationPath || targetRelease?.iterationPath || t.iterationPath || ''
        };
      });

      const incomingTestCasesWithRel = incomingTestCases.map(tc => ({
        ...tc,
        releaseId: tc.releaseId || targetReleaseId || null,
        iterationPath: tc.iterationPath || targetRelease?.iterationPath || tc.iterationPath || ''
      }));

      let updatedStories: UserStory[];
      let updatedDefects: Defect[];
      let updatedTasks: Task[];
      let updatedTestCases: TestCase[];

      if (synced.selectedReleaseId && targetReleaseId) {
        // Targeted release sync: purge previous mock/stale items for this release and replace with fresh live data
        const otherStories = filterPureUserStories(prev.userStories).filter(
          s => s.releaseId !== targetReleaseId && !matchesReleaseOrIteration(s, targetReleaseId, prev.releases)
        );
        const storyMap = new Map(otherStories.map(s => [s.adoId ? `ado-${s.adoId}` : s.id, s]));
        incomingStories.forEach(s => {
          storyMap.set(s.adoId ? `ado-${s.adoId}` : s.id, s);
        });
        updatedStories = Array.from(storyMap.values());

        const otherDefects = prev.defects.filter(
          d => d.releaseId !== targetReleaseId && !matchesReleaseOrIteration(d, targetReleaseId, prev.releases)
        );
        const defectMap = new Map(otherDefects.map(d => [d.adoId ? `ado-${d.adoId}` : d.id, d]));
        incomingDefects.forEach(d => {
          defectMap.set(d.adoId ? `ado-${d.adoId}` : d.id, d);
        });
        updatedDefects = Array.from(defectMap.values());

        const otherTasks = prev.tasks.filter(
          t => t.releaseId !== targetReleaseId && !matchesReleaseOrIteration(t, targetReleaseId, prev.releases)
        );
        const taskMap = new Map(otherTasks.map(t => [t.adoId ? `ado-${t.adoId}` : t.id, t]));
        incomingTasks.forEach(t => {
          taskMap.set(t.adoId ? `ado-${t.adoId}` : t.id, t);
        });
        updatedTasks = Array.from(taskMap.values());

        const otherTestCases = (prev.testCases || []).filter(
          tc => tc.releaseId !== targetReleaseId && !matchesReleaseOrIteration(tc, targetReleaseId, prev.releases)
        );
        const testCaseMap = new Map(otherTestCases.map(tc => [tc.adoId ? `ado-${tc.adoId}` : tc.id, tc]));
        incomingTestCasesWithRel.forEach(tc => {
          testCaseMap.set(tc.adoId ? `ado-${tc.adoId}` : tc.id, tc);
        });
        updatedTestCases = Array.from(testCaseMap.values());
      } else {
        // Global project-wide sync: merge into existing
        const cleanPrevStories = filterPureUserStories(prev.userStories);
        const storyMap = new Map(cleanPrevStories.map(s => [s.adoId ? `ado-${s.adoId}` : s.id, s]));
        incomingStories.forEach(s => {
          storyMap.set(s.adoId ? `ado-${s.adoId}` : s.id, s);
        });
        updatedStories = Array.from(storyMap.values());

        const testCaseMap = new Map((prev.testCases || []).map(tc => [tc.adoId ? `ado-${tc.adoId}` : tc.id, tc]));
        incomingTestCasesWithRel.forEach(tc => {
          testCaseMap.set(tc.adoId ? `ado-${tc.adoId}` : tc.id, tc);
        });
        updatedTestCases = Array.from(testCaseMap.values());

        const defectMap = new Map(prev.defects.map(d => [d.adoId ? `ado-${d.adoId}` : d.id, d]));
        incomingDefects.forEach(d => {
          defectMap.set(d.adoId ? `ado-${d.adoId}` : d.id, d);
        });
        updatedDefects = Array.from(defectMap.values());

        const taskMap = new Map(prev.tasks.map(t => [t.adoId ? `ado-${t.adoId}` : t.id, t]));
        incomingTasks.forEach(t => {
          taskMap.set(t.adoId ? `ado-${t.adoId}` : t.id, t);
        });
        updatedTasks = Array.from(taskMap.values());
      }

      // 4. Merge Releases
      const releaseMap = new Map(prev.releases.map(r => [r.id, r]));
      if (synced.releases) {
        synced.releases.forEach(r => {
          releaseMap.set(r.id, r);
        });
      }
      const updatedReleases = Array.from(releaseMap.values());

      // 5. Merge Team Members
      const existingMemberNames = new Set(prev.team.map(m => m.name.toLowerCase()));
      const newMembers = [...prev.team];
      const avatarColors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#4f46e5'];

      if (synced.teamMembers) {
        synced.teamMembers.forEach((tm: any, idx) => {
          if (tm.name && !existingMemberNames.has(tm.name.toLowerCase())) {
            existingMemberNames.add(tm.name.toLowerCase());
            const emailSlug = tm.name.toLowerCase().replace(/[^a-z0-9]/g, '.');
            newMembers.push({
              id: `member-${tm.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: tm.name,
              role: tm.role || (tm.source === 'created_by' ? 'Product / ADO Creator' : 'Software Engineer'),
              email: `${emailSlug}@company.com`,
              avatarColor: avatarColors[(newMembers.length + idx) % avatarColors.length],
              groupIds: [],
              active: true,
              isMyTeam: false,
              adoSource: tm.source || 'assigned_to'
            });
          }
        });
      }

      const sanitized = sanitizeAndLinkWorkItems({
        userStories: updatedStories,
        testCases: updatedTestCases,
        defects: updatedDefects,
        tasks: updatedTasks,
        team: newMembers
      });

      return {
        ...prev,
        userStories: sanitized.userStories,
        testCases: sanitized.testCases,
        defects: sanitized.defects,
        tasks: sanitized.tasks,
        team: sanitized.team,
        releases: updatedReleases,
        selectedReleaseId: targetReleaseId
      };
    });
  };

  // Reset
  const handleResetData = () => {
    const fresh = resetToDemoState();
    setState(fresh);
  };

  // API Automation State Handlers
  const handleUpdateApiCollections = (apiCollections: ApiAutomationCollection[]) => {
    setState(prev => ({
      ...prev,
      apiCollections
    }));
  };

  const handleUpdateApiEnvironments = (apiEnvironments: ApiEnvironment[]) => {
    setState(prev => ({
      ...prev,
      apiEnvironments
    }));
  };

  const handleSaveApiExecutionRun = (run: ApiTestExecutionRun) => {
    setState(prev => ({
      ...prev,
      apiExecutionRuns: [run, ...(prev.apiExecutionRuns || [])]
    }));
  };

  const handleSelectApiEnvironment = (activeApiEnvironmentId: string) => {
    setState(prev => ({
      ...prev,
      activeApiEnvironmentId
    }));
  };

  // Email helper triggers
  const handleOpenEmailModal = (template: string = 'daily_standup', defectId?: string, releaseId?: string) => {
    setEmailInitialTab(template);
    setEmailModalDefectId(defectId);
    setEmailModalReleaseId(releaseId);
    setEmailModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[var(--bg)] text-[var(--text-primary)] transition-colors">
      {/* Modern Top Portal Header & Navigation Ribbon */}
      <ModernPortalHeader
        activeView={activeView}
        onNavigate={setActiveView}
        currentDateStr={currentDateStr}
        onDateChange={setCurrentDateStr}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        releases={state.releases}
        selectedReleaseId={selectedReleaseId}
        onSelectRelease={setSelectedReleaseId}
        onOpenNewTaskModal={() => setNewTaskModalOpen(true)}
        onOpenAdoModal={() => setAdoModalOpen(true)}
        onOpenEmailModal={(tab) => handleOpenEmailModal(tab || 'standup')}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenTechDebtModal={() => setTechDebtModalOpen(true)}
        dualAdoConfig={state.dualAdoConfig}
        state={state}
        onUpdateTheme={handleUpdateTheme}
      />

      {/* Contextual Telemetry & Horizon Summary Strip */}
      <PortalSummaryStrip
        activeView={activeView}
        state={state}
        currentDateStr={currentDateStr}
        searchQuery={searchQuery}
        onClearSearch={() => setSearchQuery('')}
        selectedReleaseId={selectedReleaseId}
        onClearReleaseFilter={() => setSelectedReleaseId(null)}
        onOpenTechDebtModal={() => setTechDebtModalOpen(true)}
      />

      {/* Main Full-Width Portal Workspace */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'board' && (
            <TaskBoard
              tasks={state.tasks}
              dateStr={currentDateStr}
              team={state.team}
              groups={state.groups}
              userStories={state.userStories}
              defects={state.defects}
              releases={state.releases}
              selectedReleaseId={selectedReleaseId}
              searchQuery={searchQuery}
              blueprintSchedule={state.blueprintSchedule}
              standup={state.standup}
              state={state}
              onToggleStatus={handleToggleTaskStatus}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
              onAddComment={handleAddComment}
              onApplyBlueprint={handleApplyBlueprint}
              onReorderTasks={handleReorderTasks}
              onMoveTask={handleMoveTask}
              onSelectRelease={setSelectedReleaseId}
              onUpdateStandupEntry={handleUpdateStandupEntry}
              onUpdateState={setState}
            />
          )}

          {activeView === 'stories' && (
            <UserStoriesView
              userStories={state.userStories}
              releases={state.releases}
              team={state.team}
              groups={state.groups}
              tasks={state.tasks}
              defects={state.defects}
              selectedReleaseId={selectedReleaseId}
              currentDateStr={currentDateStr}
              onSelectRelease={setSelectedReleaseId}
              onAddStory={handleAddStory}
              onUpdateStory={handleUpdateStory}
              onDeleteStory={handleDeleteStory}
              onAddTask={handleAddTask}
              onToggleTaskStatus={handleToggleTaskStatus}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {/* Test cases section commented out per user request
          {activeView === 'testCases' && (
            <TestCasesView
              testCases={state.testCases || []}
              releases={state.releases}
              userStories={state.userStories}
              defects={state.defects}
              team={state.team}
              selectedReleaseId={selectedReleaseId}
              onSelectRelease={setSelectedReleaseId}
              onAddTestCase={handleAddTestCase}
              onUpdateTestCase={handleUpdateTestCase}
              onDeleteTestCase={handleDeleteTestCase}
            />
          )} */}

          {activeView === 'defects' && (
            <DefectsView
              defects={state.defects}
              releases={state.releases}
              userStories={state.userStories}
              team={state.team}
              selectedReleaseId={selectedReleaseId}
              tasks={state.tasks}
              dualAdoConfig={state.dualAdoConfig}
              adoConfig={state.adoConfig}
              currentUserId={state.currentUserId}
              users={state.users}
              currentDateStr={currentDateStr}
              onSelectRelease={setSelectedReleaseId}
              onAddDefect={handleAddDefect}
              onUpdateDefect={handleUpdateDefect}
              onDeleteDefect={handleDeleteDefect}
              onAddTask={handleAddTask}
              onToggleTaskStatus={handleToggleTaskStatus}
              onDeleteTask={handleDeleteTask}
              onOpenEmailModal={handleOpenEmailModal}
            />
          )}

          {activeView === 'qa_dashboard' && (
            <DefectsDashboard
              defects={state.defects}
              releases={state.releases}
              userStories={state.userStories}
              testCases={state.testCases}
              team={state.team}
              state={state}
              selectedReleaseId={selectedReleaseId}
              onOpenQaStatusEmail={() => handleOpenEmailModal('qa')}
            />
          )}

          {activeView === 'apiAutomation' && (
            <ApiAutomationView
              collections={state.apiCollections || []}
              environments={state.apiEnvironments || []}
              executionRuns={state.apiExecutionRuns || []}
              activeEnvironmentId={state.activeApiEnvironmentId || 'env-local'}
              onUpdateCollections={handleUpdateApiCollections}
              onUpdateEnvironments={handleUpdateApiEnvironments}
              onSaveExecutionRun={handleSaveApiExecutionRun}
              onSelectEnvironment={handleSelectApiEnvironment}
            />
          )}

          {activeView === 'releases' && (
            <ReleasesView
              releases={state.releases}
              userStories={state.userStories}
              defects={state.defects}
              tasks={state.tasks}
              testCases={state.testCases}
              dualAdoConfig={state.dualAdoConfig}
              adoConfig={state.adoConfig}
              onAddRelease={handleAddRelease}
              onUpdateRelease={handleUpdateRelease}
              onDeleteRelease={handleDeleteRelease}
              onSyncData={handleSyncAdoData}
              onOpenAdoModal={() => setAdoModalOpen(true)}
              onOpenEmailModal={handleOpenEmailModal}
            />
          )}

          {activeView === 'standup' && (
            <StandupView
              team={state.team}
              standup={state.standup}
              tasks={state.tasks}
              dateStr={currentDateStr}
              state={state}
              onUpdateStandupEntry={handleUpdateStandupEntry}
            />
          )}

          {activeView === 'retrospective' && (
            <RetrospectiveView
              state={state}
              onUpdateState={setState}
            />
          )}

          {activeView === 'people' && (
            <PeopleReviewView
              team={state.team}
              groups={state.groups}
              tasks={state.tasks}
              userStories={state.userStories}
              defects={state.defects}
              peopleReviews={state.peopleReviews}
              users={state.users || []}
              currentUserId={state.currentUserId}
              dualAdoConfig={state.dualAdoConfig}
              adoConfig={state.adoConfig}
              geminiApiKey={state.settings?.geminiApiKey}
              absences={state.absences || []}
              roasts={state.roasts || []}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onAddGroup={handleAddGroup}
              onAddReviewNote={handleAddReviewNote}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSetCurrentUser={handleSetCurrentUser}
              onBatchAddUsers={handleBatchAddUsers}
              onAddAbsence={handleAddAbsence}
              onUpdateAbsence={handleUpdateAbsence}
              onDeleteAbsence={handleDeleteAbsence}
              onSaveRoast={handleSaveRoast}
              onUpdateTask={handleUpdateTask}
              onUpdateStory={handleUpdateStory}
              onUpdateDefect={handleUpdateDefect}
            />
          )}

          {activeView === 'blueprint' && (
            <BlueprintView
              blueprintSchedule={state.blueprintSchedule}
              onUpdateBlueprint={handleUpdateBlueprint}
              onApplyToday={handleApplyBlueprint}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              state={state}
              onUpdateState={setState}
              onResetData={handleResetData}
              onOpenAdoModal={() => setAdoModalOpen(true)}
            />
          )}
        </main>

      {/* Global Modals */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveView}
        onOpenNewTask={() => setNewTaskModalOpen(true)}
        onOpenAdoModal={() => setAdoModalOpen(true)}
        onOpenEmailModal={() => handleOpenEmailModal('standup')}
        onOpenTechDebtModal={() => setTechDebtModalOpen(true)}
        state={state}
      />

      <NewTaskModal
        isOpen={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        dateStr={currentDateStr}
        tasks={state.tasks}
        team={state.team}
        groups={state.groups}
        userStories={state.userStories}
        defects={state.defects}
        releases={state.releases}
        selectedReleaseId={selectedReleaseId}
        onAddTask={handleAddTask}
      />

      <AdoSyncModal
        isOpen={adoModalOpen}
        onClose={() => setAdoModalOpen(false)}
        dualAdoConfig={state.dualAdoConfig}
        userStories={state.userStories}
        defects={state.defects}
        releases={state.releases}
        tasks={state.tasks}
        team={state.team}
        onSaveConfig={handleSaveDualAdoConfig}
        onAddRelease={handleAddRelease}
        onSyncData={handleSyncAdoData}
      />

      <EmailBroadcastModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        state={state}
        initialTab={emailInitialTab}
        initialDefectId={emailModalDefectId}
        initialReleaseId={emailModalReleaseId}
        onUpdateState={setState}
      />

      <AiDuplicateScannerModal
        isOpen={duplicateScannerOpen}
        onClose={() => setDuplicateScannerOpen(false)}
        userStories={state.userStories}
        defects={state.defects}
        tasks={state.tasks}
        releases={state.releases}
        selectedReleaseId={selectedReleaseId}
      />

      <TechnicalDebtImpactModal
        isOpen={techDebtModalOpen}
        onClose={() => setTechDebtModalOpen(false)}
        defects={state.defects || []}
        releases={state.releases || []}
        team={state.team || []}
        selectedReleaseId={selectedReleaseId}
        onSelectRelease={setSelectedReleaseId}
      />
    </div>
  );
};

export default App;
