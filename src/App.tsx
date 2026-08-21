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
  DualAdoConfig 
} from './types';
import { loadStoredState, saveStoredState, resetToDemoState } from './utils/storage';
import { toDateStr, shiftDate, generateId } from './utils/date';

// Layout Components
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// View Modules
import { TaskBoard } from './components/board/TaskBoard';
import { NewTaskModal } from './components/board/NewTaskModal';
import { UserStoriesView } from './components/userStories/UserStoriesView';
import { TestCasesView } from './components/testCases/TestCasesView';
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
import { AiWritingAssistantModal } from './components/ai/AiWritingAssistantModal';

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
    setState(prev => ({
      ...prev,
      releases: [release, ...prev.releases]
    }));
  };

  const handleUpdateRelease = (updatedRelease: Release) => {
    setState(prev => ({
      ...prev,
      releases: prev.releases.map(r => r.id === updatedRelease.id ? updatedRelease : r)
    }));
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

  // ADO Dual Config
  const handleSaveDualAdoConfig = (config: DualAdoConfig) => {
    setState(prev => ({
      ...prev,
      dualAdoConfig: config
    }));
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
        testCasesCount={testCasesCount}
        testCases={state.testCases}
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

          {activeView === 'testCases' && (
            <TestCasesView
              testCases={state.testCases || []}
              userStories={state.userStories}
              defects={state.defects}
              releases={state.releases}
              team={state.team}
              groups={state.groups}
              selectedReleaseId={selectedReleaseId}
              onAddTestCase={handleAddTestCase}
              onUpdateTestCase={handleUpdateTestCase}
              onDeleteTestCase={handleDeleteTestCase}
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
        onSaveConfig={handleSaveDualAdoConfig}
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
