import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  CheckSquare, 
  BookOpen, 
  FileCheck2, 
  Bug, 
  BarChart3, 
  Rocket, 
  Users, 
  Award, 
  Clock, 
  Settings, 
  FolderGit2, 
  Mail, 
  Plus, 
  ArrowRight,
  Sparkles,
  Command,
  X,
  MessageSquareQuote,
  Zap,
  Flame
} from 'lucide-react';
import { AppView, AppState } from '../../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onOpenNewTask: () => void;
  onOpenAdoModal: () => void;
  onOpenEmailModal: (template?: string) => void;
  onOpenTechDebtModal?: () => void;
  state: AppState;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewTask,
  onOpenAdoModal,
  onOpenEmailModal,
  onOpenTechDebtModal,
  state
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Navigation commands
  const navCommands = [
    { id: 'board' as AppView, title: 'Daily Task Board', category: 'Navigation', icon: CheckSquare, desc: 'Manage daily execution, time slots & tasks' },
    { id: 'stories' as AppView, title: 'User Stories & Requirements', category: 'Navigation', icon: BookOpen, desc: 'Sprint backlog, acceptance criteria & ADO stories' },
    // { id: 'testCases' as AppView, title: 'Test Cases & Execution', category: 'Navigation', icon: FileCheck2, desc: 'QA test repository, design steps & pass/fail runs' },
    { id: 'defects' as AppView, title: 'Defects & Bug Tracking', category: 'Navigation', icon: Bug, desc: 'Live bug triage, root-cause AI & ADO sync' },
    { id: 'qa_dashboard' as AppView, title: 'QA Analytics & Metrics', category: 'Navigation', icon: BarChart3, desc: 'Quality velocity, defect aging & test coverage' },
    { id: 'releases' as AppView, title: 'Releases & Scope Planning', category: 'Navigation', icon: Rocket, desc: 'Release milestones, staging status & AI release notes' },
    { id: 'standup' as AppView, title: 'Standup Room & AI Insights', category: 'Navigation', icon: Users, desc: 'Daily blockers, yesterday/today notes & AI digest' },
    { id: 'retrospective' as AppView, title: 'Retrospective Board (Keep / Stop / Start)', category: 'Navigation', icon: MessageSquareQuote, desc: 'Sprint reflections, anonymous feedback & action commitments' },
    { id: 'people' as AppView, title: 'People & Performance Review', category: 'Navigation', icon: Award, desc: 'Team reviews, appreciation generator & capacity' },
    { id: 'blueprint' as AppView, title: 'Daily Blueprint Schedule', category: 'Navigation', icon: Clock, desc: 'Recurring schedule templates & time block planner' },
    { id: 'settings' as AppView, title: 'Settings & Color Themes', category: 'Navigation', icon: Settings, desc: 'Configure themes, ADO credentials & app preferences' },
  ];

  // Quick Action commands
  const actionCommands = [
    {
      id: 'action-new-task',
      title: 'Create New Task',
      category: 'Actions',
      icon: Plus,
      desc: 'Add a new deliverable or work item to the daily board',
      action: () => {
        onClose();
        onOpenNewTask();
      }
    },
    {
      id: 'action-ado-sync',
      title: 'Sync Azure DevOps (REST & WIQL)',
      category: 'Actions',
      icon: FolderGit2,
      desc: 'Run work item sync, test connection or custom queries',
      action: () => {
        onClose();
        onOpenAdoModal();
      }
    },
    {
      id: 'action-broadcast',
      title: 'Email Hub: Daily Standup Digest & Blockers',
      category: 'Email Automation',
      icon: Mail,
      desc: 'Generate & send formatted daily check-in digest, tasks done % & blockers',
      action: () => {
        onClose();
        onOpenEmailModal('daily_standup');
      }
    },
    {
      id: 'action-email-qa-gate',
      title: 'Email Hub: QA Quality Gate Report',
      category: 'Email Automation',
      icon: Mail,
      desc: 'Generate & send QA pass rate %, open bug counts & defect callouts',
      action: () => {
        onClose();
        onOpenEmailModal('qa_gate');
      }
    },
    {
      id: 'action-email-pulse',
      title: 'Email Hub: Executive Delivery Pulse',
      category: 'Email Automation',
      icon: Zap,
      desc: 'Generate C-suite macro progress, burn-up velocity & active release pipelines',
      action: () => {
        onClose();
        onOpenEmailModal('executive_pulse');
      }
    },
    {
      id: 'action-email-capacity',
      title: 'Email Hub: Weekly Resource Capacity & Allocation',
      category: 'Email Automation',
      icon: Users,
      desc: 'Generate team net capacity, planned tasks vs headroom breakdown',
      action: () => {
        onClose();
        onOpenEmailModal('resource_capacity');
      }
    },
    {
      id: 'action-email-signoff',
      title: 'Email Hub: Release Go/No-Go Sign-Off',
      category: 'Email Automation',
      icon: Rocket,
      desc: 'Generate formal deployment readiness checklist & QA sign-off',
      action: () => {
        onClose();
        onOpenEmailModal('release_signoff');
      }
    },
    ...(onOpenTechDebtModal ? [{
      id: 'action-tech-debt-matrix',
      title: 'Technical Debt & Defect Impact Matrix',
      category: 'Actions',
      icon: Flame,
      desc: 'Open severity, blast-radius & remediation velocity impact matrix popup',
      action: () => {
        onClose();
        onOpenTechDebtModal();
      }
    }] : [])
  ];

  // Search through state items (stories, defects, test cases)
  const itemResults: any[] = [];
  if (query.trim().length > 1) {
    const q = query.toLowerCase();

    // User stories
    (state.userStories || []).slice(0, 50).forEach(story => {
      if (story.title.toLowerCase().includes(q) || (story.adoId && String(story.adoId).includes(q))) {
        itemResults.push({
          id: `story-${story.id}`,
          title: `${story.adoId ? `#${story.adoId} ` : ''}${story.title}`,
          category: 'User Stories',
          icon: BookOpen,
          desc: `Status: ${story.status}${story.storyPoints ? ` | Points: ${story.storyPoints}` : ''}`,
          action: () => {
            onClose();
            onNavigate('stories');
          }
        });
      }
    });

    // Defects
    (state.defects || []).slice(0, 50).forEach(defect => {
      if (defect.title.toLowerCase().includes(q) || (defect.adoId && String(defect.adoId).includes(q))) {
        itemResults.push({
          id: `defect-${defect.id}`,
          title: `${defect.adoId ? `#${defect.adoId} ` : ''}${defect.title}`,
          category: 'Defects',
          icon: Bug,
          desc: `Severity: ${defect.severity.toUpperCase()} | Status: ${defect.status}`,
          action: () => {
            onClose();
            onNavigate('defects');
          }
        });
      }
    });

    // Test cases
    (state.testCases || []).slice(0, 50).forEach(tc => {
      if (tc.title.toLowerCase().includes(q) || (tc.adoId && String(tc.adoId).includes(q))) {
        itemResults.push({
          id: `tc-${tc.id}`,
          title: `${tc.adoId ? `#${tc.adoId} ` : ''}${tc.title}`,
          category: 'Test Cases',
          icon: FileCheck2,
          desc: `Status: ${tc.status} | Priority: ${tc.priority}`,
          action: () => {
            onClose();
            onNavigate('testCases');
          }
        });
      }
    });
  }

  const filteredNav = navCommands.filter(c => 
    !query || c.title.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase())
  ).map(c => ({
    ...c,
    action: () => {
      onClose();
      onNavigate(c.id);
    }
  }));

  const filteredActions = actionCommands.filter(c =>
    !query || c.title.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase())
  );

  const allFiltered = [...filteredActions, ...filteredNav, ...itemResults.slice(0, 8)];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (allFiltered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + allFiltered.length) % (allFiltered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allFiltered[selectedIndex]) {
          allFiltered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allFiltered, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--surface)]">
          <Search size={18} className="text-[var(--primary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, jump to a view, or search work items..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)] font-mono">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-[var(--border)]/40 flex-1">
          {allFiltered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              No matching commands or work items found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {allFiltered.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;

                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-xs'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? 'bg-[var(--primary)] text-white' 
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)]'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                            {item.title}
                          </span>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] truncate">
                          {item.desc}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isSelected && (
                        <span className="text-[10px] font-bold text-[var(--primary)] flex items-center gap-1">
                          Select <ArrowRight size={11} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="px-4 py-2.5 bg-[var(--bg-subtle)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">↵</kbd> Open
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles size={12} className="text-[var(--primary)]" />
            <span>Universal Command Ribbon</span>
          </div>
        </div>
      </div>
    </div>
  );
};
