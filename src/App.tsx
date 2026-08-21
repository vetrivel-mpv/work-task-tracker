import React, { useState, useEffect } from 'react';
import { 
  AppState, 
  NavView, 
  Task, 
  UserStory, 
  Defect, 
  Release, 
  StandupEntry, 
  TeamMember, 
  TeamGroup, 
  PeopleReviewNote, 
  BlueprintItem, 
  AdoConfig,
  DualAdoConfig 
} from './types';
import { loadStoredState, saveStoredState, resetToDemoState, loadFromIndexedDB } from './utils/storage';
import { toDateStr, shiftDate, generateId } from './utils/date';

// Layout Components
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// View Modules
import { TaskBoard } from './components/board/TaskBoard';
import { NewTaskModal } from './components/board/NewTaskModal';
import { UserStoriesView } from './components/userStories/UserStoriesView';
import { DefectsView } from './components/defects/DefectsView';
import { DefectsDashboard } from './components/defects/DefectsDashboard';
import { ReleasesView } from './components/releases/ReleasesView';
import { StandupView } from './components/standup/StandupView';
import { PeopleReviewView } from './components/people/PeopleReviewView';
import { BlueprintView } from './components/blueprint/BlueprintView';
import { SettingsView } from './components/settings/SettingsView';

// Modals
import { AdoSyncModal } from './components/ado/AdoSyncModal';
import { EmailBroadcastModal } from './components/email/EmailBroadcastModal';

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
  const [emailInitialTab, setEmailInitialTab] = useState<'standup' | 'qa' | 'dashboard'>('standup');

  // Hydrate full state from IndexedDB on initial mount if available
  useEffect(() => {
    let isMounted = true;
    loadFromIndexedDB().then((idbState) => {
      if (isMounted && idbState) {
        setState(prev => {
          // If IndexedDB has more/equal data, merge cleanly
          if ((idbState.userStories?.length || 0) >= (prev.userStories?.length || 0) &&
              (idbState.defects?.length || 0) >= (prev.defects?.length || 0)) {
            return {
              ...prev,
              ...idbState,
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

  // Apply theme to document
  useEffect(() => {
    const currentTheme = state.settings?.theme || 'executive_slate';
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [state.settings?.theme]);

  // Quick stats counts for sidebar
  const pendingTasksCount = state.tasks.filter(
    t => t.dateStr === currentDateStr && t.status !== 'complete'
  ).length;
  const activeStoriesCount = state.userStories.filter(
    s => s.status !== 'Done' && s.status !== 'QA Passed'
  ).length;
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
    defects: Defect[];
    releases?: Release[];
    teamMembers?: Array<{ name: string; role?: string }>;
    tasks?: Task[];
    selectedReleaseId?: string;
  }) => {
    setState(prev => {
      // 1. Merge Stories: update existing or prepend new
      const storyMap = new Map(prev.userStories.map(s => [s.adoId ? `ado-${s.adoId}` : s.id, s]));
      synced.stories.forEach(s => {
        storyMap.set(s.adoId ? `ado-${s.adoId}` : s.id, s);
      });
      const updatedStories = Array.from(storyMap.values());

      // 2. Merge Defects: update existing or prepend new
      const defectMap = new Map(prev.defects.map(d => [d.adoId ? `ado-${d.adoId}` : d.id, d]));
      synced.defects.forEach(d => {
        defectMap.set(d.adoId ? `ado-${d.adoId}` : d.id, d);
      });
      const updatedDefects = Array.from(defectMap.values());

      // 3. Merge Releases
      const releaseMap = new Map(prev.releases.map(r => [r.id, r]));
      if (synced.releases) {
        synced.releases.forEach(r => {
          releaseMap.set(r.id, r);
        });
      }
      const updatedReleases = Array.from(releaseMap.values());

      // 4. Merge Team Members
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

      // 5. Merge Tasks (Dev Backlog)
      const taskMap = new Map(prev.tasks.map(t => [t.id, t]));
      if (synced.tasks) {
        synced.tasks.forEach(t => {
          taskMap.set(t.id, t);
        });
      }
      const updatedTasks = Array.from(taskMap.values());

      // 6. Selected Release
      const targetReleaseId = synced.selectedReleaseId || 
        (synced.releases && synced.releases.length > 0 ? synced.releases[0].id : prev.selectedReleaseId);

      return {
        ...prev,
        userStories: updatedStories,
        defects: updatedDefects,
        releases: updatedReleases,
        team: newMembers,
        tasks: updatedTasks,
        selectedReleaseId: targetReleaseId
      };
    });
  };

  // Reset
  const handleResetData = () => {
    const fresh = resetToDemoState();
    setState(fresh);
  };

  // Email helper triggers
  const handleOpenEmailModal = (tab: 'standup' | 'qa' | 'dashboard' = 'standup') => {
    setEmailInitialTab(tab);
    setEmailModalOpen(true);
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg)] text-[var(--text-primary)] overflow-hidden">
      {/* Structural Sidebar */}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        pendingTasksCount={pendingTasksCount}
        activeStoriesCount={activeStoriesCount}
        openDefectsCount={openDefectsCount}
        standupCount={standupCount}
        onOpenAdoModal={() => setAdoModalOpen(true)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Universal Header */}
        <Header
          appName={state.settings.appName || 'Northstar Delivery Hub'}
          currentDateStr={currentDateStr}
          onDateChange={setCurrentDateStr}
          onPrevDay={() => setCurrentDateStr(shiftDate(currentDateStr, -1))}
          onNextDay={() => setCurrentDateStr(shiftDate(currentDateStr, 1))}
          onToday={() => setCurrentDateStr(toDateStr(new Date()))}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          releases={state.releases}
          selectedReleaseId={selectedReleaseId}
          onSelectRelease={setSelectedReleaseId}
          onOpenNewTaskModal={() => setNewTaskModalOpen(true)}
          onOpenEmailModal={() => handleOpenEmailModal('standup')}
          onOpenAdoModal={() => setAdoModalOpen(true)}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
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
              onToggleStatus={handleToggleTaskStatus}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
              onAddComment={handleAddComment}
              onApplyBlueprint={handleApplyBlueprint}
              onReorderTasks={handleReorderTasks}
              onMoveTask={handleMoveTask}
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
              onAddStory={handleAddStory}
              onUpdateStory={handleUpdateStory}
              onDeleteStory={handleDeleteStory}
            />
          )}

          {activeView === 'defects' && (
            <DefectsView
              defects={state.defects}
              releases={state.releases}
              userStories={state.userStories}
              team={state.team}
              selectedReleaseId={selectedReleaseId}
              onAddDefect={handleAddDefect}
              onUpdateDefect={handleUpdateDefect}
              onDeleteDefect={handleDeleteDefect}
            />
          )}

          {activeView === 'qa_dashboard' && (
            <DefectsDashboard
              defects={state.defects}
              releases={state.releases}
              userStories={state.userStories}
              team={state.team}
              state={state}
              onOpenQaStatusEmail={() => handleOpenEmailModal('qa')}
            />
          )}

          {activeView === 'releases' && (
            <ReleasesView
              releases={state.releases}
              userStories={state.userStories}
              defects={state.defects}
              tasks={state.tasks}
              onAddRelease={handleAddRelease}
              onUpdateRelease={handleUpdateRelease}
              onDeleteRelease={handleDeleteRelease}
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

          {activeView === 'people' && (
            <PeopleReviewView
              team={state.team}
              groups={state.groups}
              tasks={state.tasks}
              userStories={state.userStories}
              defects={state.defects}
              peopleReviews={state.peopleReviews}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onAddGroup={handleAddGroup}
              onAddReviewNote={handleAddReviewNote}
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
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
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
      />
    </div>
  );
};

export default App;
