import React, { useState } from 'react';
import { BlueprintItem, Priority } from '../../types';
import { 
  Plus, 
  CalendarClock, 
  CheckCircle2, 
  Zap, 
  Edit3, 
  Trash2, 
  Clock, 
  Sparkles,
  Layers
} from 'lucide-react';
import { generateId } from '../../utils/date';

interface BlueprintViewProps {
  blueprintSchedule: BlueprintItem[];
  onUpdateBlueprint: (schedule: BlueprintItem[]) => void;
  onApplyToday: (schedule: BlueprintItem[]) => void;
}

export const BlueprintView: React.FC<BlueprintViewProps> = ({
  blueprintSchedule,
  onUpdateBlueprint,
  onApplyToday
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BlueprintItem | null>(null);

  // Form state
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');

  const openAddModal = () => {
    setEditingItem(null);
    setTime('09:00');
    setTitle('');
    setCategory('Routine');
    setPriority('medium');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (item: BlueprintItem) => {
    setEditingItem(item);
    setTime(item.time);
    setTitle(item.title);
    setCategory(item.category || 'Routine');
    setPriority(item.priority);
    setDescription(item.description || '');
    setModalOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    onUpdateBlueprint(blueprintSchedule.filter(i => i.id !== id));
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !time) return;

    if (editingItem) {
      onUpdateBlueprint(
        blueprintSchedule.map(i => 
          i.id === editingItem.id 
            ? { ...i, time, title: title.trim(), category: category.trim() || 'Routine', priority, description: description.trim() || undefined }
            : i
        )
      );
    } else {
      onUpdateBlueprint([
        ...blueprintSchedule,
        {
          id: generateId('bp'),
          time,
          title: title.trim(),
          category: category.trim() || 'Routine',
          priority,
          description: description.trim() || undefined
        }
      ]);
    }

    setModalOpen(false);
  };

  // Sort by time
  const sortedSchedule = [...blueprintSchedule].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Daily Blueprint & Standard Cadence</h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Configure default daily time blocks and one-click seed today's delivery board
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onApplyToday(blueprintSchedule)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Zap size={14} />
            <span>Apply to Today's Board</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Cadence Block</span>
          </button>
        </div>
      </div>

      {/* Blueprint Timeline */}
      <div className="flex flex-col gap-3">
        {sortedSchedule.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <CalendarClock size={36} className="text-[var(--text-muted)] mb-3 opacity-60" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">No Blueprint Time Blocks Configured</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
              Add standard recurring cadence blocks (e.g. Daily Standup, QA Regression, Blocker Triage) to populate your delivery board on demand.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Add First Block</span>
            </button>
          </div>
        ) : (
          sortedSchedule.map((item) => {
          const priorityColor = 
            item.priority === 'high' ? 'text-[var(--critical)] bg-[var(--critical-bg)] border-[var(--critical-border)]' :
            item.priority === 'medium' ? 'text-[var(--medium)] bg-[var(--medium-bg)] border-[var(--medium-border)]' :
            'text-[var(--low)] bg-[var(--low-bg)] border-[var(--low-border)]';

          return (
            <div
              key={item.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4 hover:border-[var(--primary)] transition-all"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] text-center font-mono font-bold text-xs text-[var(--text-primary)] flex-shrink-0">
                  {item.time}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">{item.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${priorityColor}`}>
                      {item.priority}
                    </span>
                    <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                      &bull; {item.category}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed truncate">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 text-[var(--text-muted)] flex-shrink-0">
                <button
                  onClick={() => openEditModal(item)}
                  className="p-1.5 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Edit / Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">
              {editingItem ? 'Edit Cadence Block' : 'Add Cadence Block'}
            </h2>
            <form onSubmit={handleSaveModal} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Time (24h)</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Block Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Standup & Blockers"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Sync, Focus, QA"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Context or objectives for this routine block..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs cursor-pointer"
                >
                  Save Cadence Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
