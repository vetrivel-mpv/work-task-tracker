import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Sparkles, 
  FileText, 
  Filter, 
  Search, 
  CheckCircle2, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Share2, 
  Download, 
  Calendar, 
  User, 
  ShieldCheck, 
  Tag, 
  SlidersHorizontal,
  ThumbsUp,
  FolderPlus,
  RefreshCw,
  Clock,
  Layers,
  ChevronDown
} from 'lucide-react';
import { 
  AppState, 
  RetroItem, 
  RetroCategory, 
  RetroActionItem, 
  RetroSession,
  TeamMember
} from '../../types';
import { RetroCard } from './RetroCard';
import { RetroSummaryModal } from './RetroSummaryModal';

interface RetrospectiveViewProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
}

const PSEUDONYMS = [
  'Anonymous Contributor',
  'Anonymous Falcon',
  'Anonymous Architect',
  'Anonymous Tester',
  'Anonymous Ninja',
  'Anonymous Debugger',
  'Anonymous Pioneer',
  'Anonymous SRE'
];

export const RetrospectiveView: React.FC<RetrospectiveViewProps> = ({
  state,
  onUpdateState
}) => {
  // Current user & session resolution
  const currentUserId = state.currentUserId || 'u-lead';
  const currentUser = state.users?.find(u => u.id === currentUserId) || 
    state.team?.find(t => t.id === currentUserId) || {
      id: currentUserId,
      name: 'Current User',
      role: 'Engineering Lead'
    };

  const sessions: RetroSession[] = state.retroSessions && state.retroSessions.length > 0 
    ? state.retroSessions 
    : [
        {
          id: 'retro-session-current',
          title: 'Sprint 43 Retrospective',
          date: state.dateStr || new Date().toISOString().split('T')[0],
          status: 'active',
          linkedSprint: 'Sprint 43'
        }
      ];

  const [activeSessionId, setActiveSessionId] = useState<string>(
    state.activeRetroSessionId || sessions[0]?.id || 'retro-session-current'
  );

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RetroCategory | 'actions'>('all');
  const [sortBy, setSortBy] = useState<'votes' | 'newest' | 'oldest'>('votes');
  const [showDiscussedOnly, setShowDiscussedOnly] = useState(false);

  // New feedback input bar state
  const [inputText, setInputText] = useState('');
  const [inputCategory, setInputCategory] = useState<RetroCategory>('keep');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [chosenAlias, setChosenAlias] = useState(PSEUDONYMS[0]);
  const [customTag, setCustomTag] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Modals & Sub-forms
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionSprint, setNewSessionSprint] = useState('');

  // Action item creation modal / quick state
  const [isCreateActionOpen, setIsCreateActionOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionPriority, setActionPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [actionAssignee, setActionAssignee] = useState<string>('');
  const [actionDueDate, setActionDueDate] = useState<string>('');

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // All retro items for active session
  const allSessionItems = useMemo(() => {
    return (state.retroItems || []).filter(item => {
      if (!item.sessionId) return true; // Legacy items match active
      return item.sessionId === activeSessionId;
    });
  }, [state.retroItems, activeSessionId]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return allSessionItems.filter(item => {
      if (categoryFilter !== 'all' && categoryFilter !== 'actions' && item.category !== categoryFilter) {
        return false;
      }
      if (showDiscussedOnly && !item.discussed) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = item.text.toLowerCase().includes(q);
        const matchesAuthor = (item.authorName || item.authorAlias || '').toLowerCase().includes(q);
        const matchesTag = (item.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesText && !matchesAuthor && !matchesTag) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'votes') {
        return (b.votes || 0) - (a.votes || 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [allSessionItems, categoryFilter, showDiscussedOnly, searchQuery, sortBy]);

  const keepItems = useMemo(() => filteredItems.filter(i => i.category === 'keep'), [filteredItems]);
  const stopItems = useMemo(() => filteredItems.filter(i => i.category === 'stop'), [filteredItems]);
  const startItems = useMemo(() => filteredItems.filter(i => i.category === 'start'), [filteredItems]);

  const sessionActionItems = useMemo(() => {
    return (state.retroActionItems || []).filter(a => !a.sessionId || a.sessionId === activeSessionId);
  }, [state.retroActionItems, activeSessionId]);

  // Statistics
  const totalFeedbackCount = allSessionItems.length;
  const totalVotesCount = allSessionItems.reduce((acc, i) => acc + (i.votes || 0), 0);
  const discussedCount = allSessionItems.filter(i => i.discussed).length;
  const completedActionsCount = sessionActionItems.filter(a => a.status === 'completed').length;

  // Handlers
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const newItem: RetroItem = {
      id: `retro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId: activeSessionId,
      category: inputCategory,
      text: inputText.trim(),
      votes: 1, // Author automatically gets first upvote
      votedUserIds: [currentUserId],
      isAnonymous,
      authorAlias: isAnonymous ? chosenAlias : undefined,
      authorName: !isAnonymous ? (currentUser.name || 'Teammate') : undefined,
      authorId: !isAnonymous ? currentUserId : undefined,
      createdAt: new Date().toISOString(),
      discussed: false,
      tags: selectedTags.length > 0 ? selectedTags : undefined
    };

    onUpdateState(prev => ({
      ...prev,
      retroItems: [newItem, ...(prev.retroItems || [])]
    }));

    setInputText('');
    setSelectedTags([]);
    // Randomize alias next time for variety
    const nextAlias = PSEUDONYMS[Math.floor(Math.random() * PSEUDONYMS.length)];
    setChosenAlias(nextAlias);
  };

  const handleVote = (itemId: string) => {
    onUpdateState(prev => {
      const items = (prev.retroItems || []).map(item => {
        if (item.id !== itemId) return item;
        const votedIds = item.votedUserIds || [];
        const alreadyVoted = votedIds.includes(currentUserId);
        if (alreadyVoted) {
          return {
            ...item,
            votes: Math.max(0, (item.votes || 1) - 1),
            votedUserIds: votedIds.filter(id => id !== currentUserId)
          };
        } else {
          return {
            ...item,
            votes: (item.votes || 0) + 1,
            votedUserIds: [...votedIds, currentUserId]
          };
        }
      });
      return { ...prev, retroItems: items };
    });
  };

  const handleDeleteItem = (itemId: string) => {
    onUpdateState(prev => ({
      ...prev,
      retroItems: (prev.retroItems || []).filter(i => i.id !== itemId)
    }));
  };

  const handleToggleDiscussed = (itemId: string) => {
    onUpdateState(prev => ({
      ...prev,
      retroItems: (prev.retroItems || []).map(i => 
        i.id === itemId ? { ...i, discussed: !i.discussed } : i
      )
    }));
  };

  const handleMoveCategory = (itemId: string, newCategory: RetroCategory) => {
    onUpdateState(prev => ({
      ...prev,
      retroItems: (prev.retroItems || []).map(i => 
        i.id === itemId ? { ...i, category: newCategory } : i
      )
    }));
  };

  const handleEditItem = (itemId: string, newText: string, tags?: string[]) => {
    onUpdateState(prev => ({
      ...prev,
      retroItems: (prev.retroItems || []).map(i => 
        i.id === itemId ? { ...i, text: newText, ...(tags ? { tags } : {}) } : i
      )
    }));
  };

  const handleConvertToAction = (item: RetroItem) => {
    const newAction: RetroActionItem = {
      id: `act-${Date.now()}`,
      sessionId: activeSessionId,
      retroItemId: item.id,
      title: item.text.length > 80 ? `${item.text.substring(0, 80)}...` : item.text,
      description: `Formulated from retrospective feedback: "${item.text}"`,
      priority: item.category === 'stop' ? 'high' : 'medium',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    onUpdateState(prev => ({
      ...prev,
      retroItems: (prev.retroItems || []).map(i => 
        i.id === item.id ? { ...i, actionItemCreated: true } : i
      ),
      retroActionItems: [newAction, ...(prev.retroActionItems || [])]
    }));

    alert(`Action item created: "${newAction.title}"! View it in the Action Items tab.`);
  };

  const handleAddDirectAction = () => {
    if (!actionTitle.trim()) return;

    const newAction: RetroActionItem = {
      id: `act-${Date.now()}`,
      sessionId: activeSessionId,
      title: actionTitle.trim(),
      priority: actionPriority,
      assigneeName: actionAssignee || undefined,
      dueDate: actionDueDate || undefined,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    onUpdateState(prev => ({
      ...prev,
      retroActionItems: [newAction, ...(prev.retroActionItems || [])]
    }));

    setActionTitle('');
    setActionDueDate('');
    setIsCreateActionOpen(false);
  };

  const handleToggleActionStatus = (actionId: string) => {
    onUpdateState(prev => ({
      ...prev,
      retroActionItems: (prev.retroActionItems || []).map(a => {
        if (a.id !== actionId) return a;
        const nextStatus: 'open' | 'in_progress' | 'completed' = 
          a.status === 'open' ? 'in_progress' : a.status === 'in_progress' ? 'completed' : 'open';
        return { ...a, status: nextStatus };
      })
    }));
  };

  const handleDeleteAction = (actionId: string) => {
    onUpdateState(prev => ({
      ...prev,
      retroActionItems: (prev.retroActionItems || []).filter(a => a.id !== actionId)
    }));
  };

  const handleCreateSession = () => {
    if (!newSessionTitle.trim()) return;
    const newId = `session-${Date.now()}`;
    const newSession: RetroSession = {
      id: newId,
      title: newSessionTitle.trim(),
      date: new Date().toISOString().split('T')[0],
      status: 'active',
      linkedSprint: newSessionSprint.trim() || undefined
    };

    onUpdateState(prev => ({
      ...prev,
      retroSessions: [newSession, ...(prev.retroSessions || [])],
      activeRetroSessionId: newId
    }));

    setActiveSessionId(newId);
    setNewSessionTitle('');
    setNewSessionSprint('');
    setIsCreateSessionOpen(false);
  };

  return (
    <div id="retrospective-board-view" className="space-y-6 max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Top Header Card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                Continuous Improvement
              </span>
              <span className="text-xs text-zinc-500">
                Anonymous Feedback & Action Tracking
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mt-1">
              Retrospective Board
            </h1>
          </div>

          {/* Session Switcher & Export Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Session Selector */}
            <div className="relative">
              <select
                id="retro-session-select"
                value={activeSessionId}
                onChange={e => {
                  if (e.target.value === 'create_new') {
                    setIsCreateSessionOpen(true);
                  } else {
                    setActiveSessionId(e.target.value);
                    onUpdateState(prev => ({ ...prev, activeRetroSessionId: e.target.value }));
                  }
                }}
                className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.date})
                  </option>
                ))}
                <option value="create_new">+ New Retro Session...</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick Action Item Button */}
            <button
              id="retro-add-action-btn"
              onClick={() => setIsCreateActionOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-500" />
              <span>New Action Item</span>
            </button>

            {/* AI Synthesize Button */}
            <button
              id="retro-ai-insights-btn"
              onClick={() => setIsSummaryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Insights & Export</span>
            </button>
          </div>
        </div>

        {/* Telemetry Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{keepItems.length}</div>
              <div className="text-[11px] text-zinc-500 font-medium">Keep (Wins)</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stopItems.length}</div>
              <div className="text-[11px] text-zinc-500 font-medium">Stop (Blockers)</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{startItems.length}</div>
              <div className="text-[11px] text-zinc-500 font-medium">Start (Ideas)</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {completedActionsCount}/{sessionActionItems.length}
              </div>
              <div className="text-[11px] text-zinc-500 font-medium">Actions Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Submission Input Form */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-3">
        <form onSubmit={handleAddItem} className="space-y-3">
          {/* Category Selector Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="retro-input-tab-keep"
                onClick={() => setInputCategory('keep')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  inputCategory === 'keep'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <span>🟢 Keep</span>
              </button>

              <button
                type="button"
                id="retro-input-tab-stop"
                onClick={() => setInputCategory('stop')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  inputCategory === 'stop'
                    ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/30'
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                <span>🔴 Stop</span>
              </button>

              <button
                type="button"
                id="retro-input-tab-start"
                onClick={() => setInputCategory('start')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  inputCategory === 'start'
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                    : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                }`}
              >
                <span>🔵 Start</span>
              </button>
            </div>

            {/* Anonymity Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="retro-toggle-anon-btn"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isAnonymous
                    ? 'bg-zinc-800 text-amber-300 dark:bg-zinc-700 border border-zinc-600 shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
                title="Toggle anonymous submission"
              >
                <span>{isAnonymous ? '🎭 Anonymous Mode: ON' : '👤 Identified as You'}</span>
              </button>

              {isAnonymous && (
                <select
                  value={chosenAlias}
                  onChange={e => setChosenAlias(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                >
                  {PSEUDONYMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Text Input Area */}
          <div className="relative">
            <textarea
              id="retro-feedback-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              rows={2}
              placeholder={
                inputCategory === 'keep'
                  ? 'What worked great this sprint? (e.g. "Automated deployment pipeline cut our release time by 50%...")'
                  : inputCategory === 'stop'
                  ? 'What caused friction or blockers? (e.g. "Flaky test cases blocking PR merges...")'
                  : 'What new experiment or habit should we try? (e.g. "Daily 10-minute defect triage meeting...")'
              }
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Tag suggestions & Submit button */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-zinc-400 font-medium">Quick tags:</span>
              {['#automation', '#qa-testing', '#deployment', '#ado-sync', '#code-reviews', '#standup', '#architecture'].map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              id="retro-submit-feedback-btn"
              disabled={!inputText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Post Feedback (Enter)</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="retro-search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search feedback, tags, or authors..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-zinc-800 text-white dark:bg-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              All ({totalFeedbackCount})
            </button>
            <button
              onClick={() => setCategoryFilter('keep')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === 'keep'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              🟢 Keep ({allSessionItems.filter(i => i.category === 'keep').length})
            </button>
            <button
              onClick={() => setCategoryFilter('stop')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === 'stop'
                  ? 'bg-rose-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              🔴 Stop ({allSessionItems.filter(i => i.category === 'stop').length})
            </button>
            <button
              onClick={() => setCategoryFilter('start')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === 'start'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              🔵 Start ({allSessionItems.filter(i => i.category === 'start').length})
            </button>
            <button
              onClick={() => setCategoryFilter('actions')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === 'actions'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              🚀 Actions ({sessionActionItems.length})
            </button>
          </div>

          {/* Sort By Selector */}
          <select
            id="retro-sort-by-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="votes">🔥 Most Voted First</option>
            <option value="newest">🕒 Newest First</option>
            <option value="oldest">⌛ Oldest First</option>
          </select>
        </div>
      </div>

      {/* 3 Columns Retrospective Board (Keep, Stop, Start) */}
      {categoryFilter !== 'actions' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* Column 1: KEEP */}
          {(categoryFilter === 'all' || categoryFilter === 'keep') && (
            <div 
              id="retro-column-keep"
              className="flex flex-col rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-emerald-500/20 p-4 space-y-3 min-h-[450px]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Keep (What Went Well)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                  {keepItems.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {keepItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-4 border border-dashed border-emerald-500/20 rounded-xl">
                    <p className="text-xs text-zinc-400 font-medium">No "Keep" feedback yet.</p>
                    <button
                      onClick={() => {
                        setInputCategory('keep');
                        document.getElementById('retro-feedback-input')?.focus();
                      }}
                      className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      + Add first item
                    </button>
                  </div>
                ) : (
                  keepItems.map(item => (
                    <RetroCard
                      key={item.id}
                      item={item}
                      currentUserId={currentUserId}
                      onVote={handleVote}
                      onDelete={handleDeleteItem}
                      onToggleDiscussed={handleToggleDiscussed}
                      onMoveCategory={handleMoveCategory}
                      onEdit={handleEditItem}
                      onConvertToActionItem={handleConvertToAction}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Column 2: STOP */}
          {(categoryFilter === 'all' || categoryFilter === 'stop') && (
            <div 
              id="retro-column-stop"
              className="flex flex-col rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-rose-500/20 p-4 space-y-3 min-h-[450px]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-rose-500/15">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Stop (Pain Points & Blockers)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                  {stopItems.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {stopItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-4 border border-dashed border-rose-500/20 rounded-xl">
                    <p className="text-xs text-zinc-400 font-medium">No "Stop" feedback yet.</p>
                    <button
                      onClick={() => {
                        setInputCategory('stop');
                        document.getElementById('retro-feedback-input')?.focus();
                      }}
                      className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      + Add first item
                    </button>
                  </div>
                ) : (
                  stopItems.map(item => (
                    <RetroCard
                      key={item.id}
                      item={item}
                      currentUserId={currentUserId}
                      onVote={handleVote}
                      onDelete={handleDeleteItem}
                      onToggleDiscussed={handleToggleDiscussed}
                      onMoveCategory={handleMoveCategory}
                      onEdit={handleEditItem}
                      onConvertToActionItem={handleConvertToAction}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Column 3: START */}
          {(categoryFilter === 'all' || categoryFilter === 'start') && (
            <div 
              id="retro-column-start"
              className="flex flex-col rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-blue-500/20 p-4 space-y-3 min-h-[450px]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-blue-500/15">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Start (New Ideas & Experiments)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                  {startItems.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {startItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-4 border border-dashed border-blue-500/20 rounded-xl">
                    <p className="text-xs text-zinc-400 font-medium">No "Start" feedback yet.</p>
                    <button
                      onClick={() => {
                        setInputCategory('start');
                        document.getElementById('retro-feedback-input')?.focus();
                      }}
                      className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + Add first item
                    </button>
                  </div>
                ) : (
                  startItems.map(item => (
                    <RetroCard
                      key={item.id}
                      item={item}
                      currentUserId={currentUserId}
                      onVote={handleVote}
                      onDelete={handleDeleteItem}
                      onToggleDiscussed={handleToggleDiscussed}
                      onMoveCategory={handleMoveCategory}
                      onEdit={handleEditItem}
                      onConvertToActionItem={handleConvertToAction}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Action Items Section */}
      <div 
        id="retro-action-items-section" 
        className={`rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4 ${
          categoryFilter === 'actions' ? 'block' : 'mt-8'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Action Items & Continuous Improvements
              </h3>
              <p className="text-xs text-zinc-500">
                Agreed commitments resulting from retrospective feedback
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateActionOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Action Item</span>
          </button>
        </div>

        {sessionActionItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            No action items assigned for this retrospective session yet. Click "Turn into Action Item" on any retro card or use "+ Add Action Item" above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessionActionItems.map(action => (
              <div
                key={action.id}
                id={`retro-action-${action.id}`}
                className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  action.status === 'completed'
                    ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                    : 'bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <button
                    onClick={() => handleToggleActionStatus(action.id)}
                    className={`mt-0.5 p-1 rounded-md transition-colors ${
                      action.status === 'completed'
                        ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40'
                        : 'text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title="Toggle completion status"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${
                        action.status === 'completed'
                          ? 'line-through text-zinc-500'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}>
                        {action.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        action.priority === 'high'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : action.priority === 'medium'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {action.priority}
                      </span>
                    </div>

                    {action.description && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {action.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                      {action.assigneeName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-zinc-400" />
                          {action.assigneeName}
                        </span>
                      )}
                      {action.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          Due: {action.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteAction(action.id)}
                  className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Delete action item"
                >
                  <Plus className="w-3.5 h-3.5 rotate-45" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Modal Component */}
      <RetroSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        session={currentSession}
        items={allSessionItems}
        actionItems={sessionActionItems}
        projectName={state.settings?.appName || 'ACM (AT&T Connection Manager) Delivery'}
        onAddActionItem={(title, priority, suggestedRole) => {
          const newAction: RetroActionItem = {
            id: `act-${Date.now()}`,
            sessionId: activeSessionId,
            title,
            priority: priority || 'high',
            assigneeName: suggestedRole,
            status: 'open',
            createdAt: new Date().toISOString()
          };
          onUpdateState(prev => ({
            ...prev,
            retroActionItems: [newAction, ...(prev.retroActionItems || [])]
          }));
        }}
      />

      {/* Modal: Create New Session */}
      {isCreateSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Start New Retrospective Session
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={e => setNewSessionTitle(e.target.value)}
                  placeholder="e.g. Sprint 44 Retrospective"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Linked Sprint / Release
                </label>
                <input
                  type="text"
                  value={newSessionSprint}
                  onChange={e => setNewSessionSprint(e.target.value)}
                  placeholder="e.g. Sprint 44 or Release 2.5"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreateSessionOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSessionTitle.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Direct Action Item Creator */}
      {isCreateActionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Create Retrospective Action Item
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Action Commitment Title
                </label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={e => setActionTitle(e.target.value)}
                  placeholder="e.g. Automate nightly regression test suite"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={actionPriority}
                    onChange={e => setActionPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Owner / Role
                  </label>
                  <input
                    type="text"
                    value={actionAssignee}
                    onChange={e => setActionAssignee(e.target.value)}
                    placeholder="e.g. David Ross (QA Lead)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={actionDueDate}
                  onChange={e => setActionDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreateActionOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDirectAction}
                disabled={!actionTitle.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
              >
                Add Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
