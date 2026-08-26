import React, { useState, useEffect } from 'react';
import { TeamMember, AppState } from '../../types';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  User, 
  Play, 
  Pause, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  ListTodo,
  ExternalLink,
  Flame,
  Check
} from 'lucide-react';
import { standupAudio } from '../../utils/standupAudio';

export interface ParkingLotTopic {
  id: string;
  title: string;
  ownerId?: string;
  ownerName?: string;
  notes?: string;
  estMinutes: number;
  status: 'pending' | 'in_discussion' | 'resolved';
  createdAt: string;
}

interface StandupParkingLotProps {
  team: TeamMember[];
  dateStr: string;
  onOpenItem?: (id: string, type: 'task' | 'story' | 'defect') => void;
}

export const StandupParkingLot: React.FC<StandupParkingLotProps> = ({
  team,
  dateStr,
  onOpenItem
}) => {
  const storageKey = `northstar_parking_lot_${dateStr}`;

  // Load persisted topics for today
  const [topics, setTopics] = useState<ParkingLotTopic[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      {
        id: 'pl-init-1',
        title: 'API Authentication payload schema contract alignment between Mobile & Backend',
        ownerId: team[0]?.id,
        ownerName: team[0]?.name || 'Tech Lead',
        notes: 'Follow-up on token expiration refresh logic and response headers',
        estMinutes: 5,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Save changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(topics));
    } catch {
      // ignore
    }
  }, [topics, storageKey]);

  // New topic state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOwnerId, setNewOwnerId] = useState<string>(team[0]?.id || '');
  const [newEstMinutes, setNewEstMinutes] = useState<number>(5);
  const [newNotes, setNewNotes] = useState('');

  // 16th-minute discussion timer
  const [discussionTimer, setDiscussionTimer] = useState<number>(300); // 5 mins
  const [isDiscussionRunning, setIsDiscussionRunning] = useState<boolean>(false);
  const [activeDiscussionTopicId, setActiveDiscussionTopicId] = useState<string | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isDiscussionRunning && discussionTimer > 0) {
      interval = setInterval(() => {
        setDiscussionTimer(prev => prev - 1);
      }, 1000);
    } else if (discussionTimer === 0 && isDiscussionRunning) {
      setIsDiscussionRunning(false);
      standupAudio.play('timeUp');
    }
    return () => clearInterval(interval);
  }, [isDiscussionRunning, discussionTimer]);

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const owner = team.find(t => t.id === newOwnerId);
    const newTopic: ParkingLotTopic = {
      id: `pl-${Date.now()}`,
      title: newTitle.trim(),
      ownerId: newOwnerId || undefined,
      ownerName: owner ? owner.name : 'Unassigned',
      notes: newNotes.trim() || undefined,
      estMinutes: Number(newEstMinutes) || 5,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setTopics(prev => [newTopic, ...prev]);
    setNewTitle('');
    setNewNotes('');
    setIsAdding(false);
    standupAudio.play('click');
  };

  const handleToggleStatus = (topicId: string) => {
    setTopics(prev => prev.map(t => {
      if (t.id === topicId) {
        const nextStatus = t.status === 'resolved' ? 'pending' : 'resolved';
        if (nextStatus === 'resolved') {
          standupAudio.play('click');
        }
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const handleDeleteTopic = (topicId: string) => {
    setTopics(prev => prev.filter(t => t.id !== topicId));
  };

  const handleStartDiscussion = (topic: ParkingLotTopic) => {
    setActiveDiscussionTopicId(topic.id);
    setDiscussionTimer(topic.estMinutes * 60);
    setIsDiscussionRunning(true);
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, status: 'in_discussion' } : t));
    standupAudio.play('start');
  };

  const totalEstMinutes = topics.filter(t => t.status !== 'resolved').reduce((acc, t) => acc + t.estMinutes, 0);
  const pendingCount = topics.filter(t => t.status !== 'resolved').length;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold shadow-xs">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                16th-Minute Parking Lot & Deep-Dives
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {pendingCount} Topics &bull; ~{totalEstMinutes} mins
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Park technical debates and multi-person alignments here to protect the 15-minute standup timebox.
            </p>
          </div>
        </div>

        {/* Discussion Timer Controls */}
        <div className="flex items-center gap-3 bg-[var(--surface-hover)] border border-[var(--border)] px-4 py-2 rounded-xl">
          <Clock size={16} className="text-amber-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {activeDiscussionTopicId ? 'Active Topic Timer' : 'Deep-Dive Timer'}
            </span>
            <span className={`text-sm font-mono font-bold ${discussionTimer <= 30 ? 'text-[var(--critical)]' : 'text-[var(--text-primary)]'}`}>
              {Math.floor(discussionTimer / 60)}:{String(discussionTimer % 60).padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setIsDiscussionRunning(!isDiscussionRunning)}
              className={`p-1.5 rounded-lg text-white font-bold transition-all cursor-pointer ${
                isDiscussionRunning ? 'bg-amber-600' : 'bg-[var(--primary)]'
              }`}
              title={isDiscussionRunning ? 'Pause' : 'Start'}
            >
              {isDiscussionRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={() => {
                setIsDiscussionRunning(false);
                setDiscussionTimer(300);
              }}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors cursor-pointer"
              title="Reset to 5m"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Topic Action Bar */}
      {!isAdding ? (
        <div className="flex items-center justify-between bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Have a topic requiring 2+ people or detailed debugging?
          </span>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Parking Lot Topic</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleAddTopic} className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-primary)]">New Parking Lot Topic</span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Topic title or technical question..."
            className="w-full text-xs font-medium px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 block">Discussion Lead / Owner</label>
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="w-full text-xs font-medium px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
              >
                {team.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--text-secondary)] mb-1 block">Estimated Time (Mins)</label>
              <select
                value={newEstMinutes}
                onChange={(e) => setNewEstMinutes(Number(e.target.value))}
                className="w-full text-xs font-medium px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
              >
                <option value={3}>3 Minutes (Quick Sync)</option>
                <option value={5}>5 Minutes (Standard Alignment)</option>
                <option value={10}>10 Minutes (Architecture / Debug)</option>
                <option value={15}>15 Minutes (Design Review)</option>
              </select>
            </div>
          </div>

          <textarea
            rows={2}
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Optional context, PR link, or meeting takeaway details..."
            className="w-full text-xs font-medium px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface)] rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Save Topic
            </button>
          </div>
        </form>
      )}

      {/* Topic List */}
      <div className="flex flex-col gap-2.5">
        {topics.length === 0 ? (
          <div className="p-8 text-center bg-[var(--bg-subtle)] rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">
            No parking lot topics logged for today. Standup was smooth and focused!
          </div>
        ) : (
          topics.map((topic) => {
            const isResolved = topic.status === 'resolved';
            const isCurrent = activeDiscussionTopicId === topic.id;

            return (
              <div
                key={topic.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isResolved
                    ? 'bg-[var(--surface)]/50 border-[var(--border)] opacity-60'
                    : isCurrent
                    ? 'bg-amber-500/5 border-amber-500/40 shadow-xs'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleStatus(topic.id)}
                    className={`mt-0.5 p-1 rounded-lg border transition-all cursor-pointer ${
                      isResolved
                        ? 'bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/30'
                        : 'border-[var(--border)] hover:border-[var(--primary)] text-[var(--text-muted)]'
                    }`}
                    title={isResolved ? 'Mark as Pending' : 'Mark as Resolved'}
                  >
                    <Check size={14} className={isResolved ? 'opacity-100' : 'opacity-0'} />
                  </button>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${isResolved ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                        {topic.title}
                      </span>
                      {topic.estMinutes && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]">
                          {topic.estMinutes}m
                        </span>
                      )}
                      {isCurrent && isDiscussionRunning && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-500 text-white animate-pulse">
                          In Discussion
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <User size={11} />
                        <span>{topic.ownerName || 'Unassigned'}</span>
                      </span>
                      {topic.notes && (
                        <span>&bull; {topic.notes}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!isResolved && (
                    <button
                      onClick={() => handleStartDiscussion(topic)}
                      className="px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Play size={11} />
                      <span>Start ({topic.estMinutes}m)</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg transition-colors cursor-pointer"
                    title="Delete Topic"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
