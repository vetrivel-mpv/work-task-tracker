import React, { useState } from 'react';
import { 
  ThumbsUp, 
  CheckCircle2, 
  Trash2, 
  ArrowRightLeft, 
  Sparkles, 
  Tag, 
  User, 
  ShieldAlert, 
  MoreVertical,
  Check,
  Edit2,
  Share2
} from 'lucide-react';
import { RetroItem, RetroCategory } from '../../types';

interface RetroCardProps {
  item: RetroItem;
  currentUserId?: string;
  onVote: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleDiscussed: (id: string) => void;
  onMoveCategory: (id: string, newCategory: RetroCategory) => void;
  onEdit: (id: string, newText: string, tags?: string[]) => void;
  onConvertToActionItem?: (item: RetroItem) => void;
}

const CATEGORY_CONFIG: Record<RetroCategory, {
  label: string;
  bgGradient: string;
  borderColor: string;
  accentBadge: string;
  iconBg: string;
  textColor: string;
  lightBg: string;
}> = {
  keep: {
    label: 'Keep',
    bgGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    accentBadge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/20'
  },
  stop: {
    label: 'Stop',
    bgGradient: 'from-rose-500/10 via-red-500/5 to-transparent',
    borderColor: 'border-rose-500/30 hover:border-rose-500/60',
    accentBadge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    iconBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
    textColor: 'text-rose-600 dark:text-rose-400',
    lightBg: 'bg-rose-50 dark:bg-rose-950/20'
  },
  start: {
    label: 'Start',
    bgGradient: 'from-blue-500/10 via-indigo-500/5 to-transparent',
    borderColor: 'border-blue-500/30 hover:border-blue-500/60',
    accentBadge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    iconBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    textColor: 'text-blue-600 dark:text-blue-400',
    lightBg: 'bg-blue-50 dark:bg-blue-950/20'
  }
};

export const RetroCard: React.FC<RetroCardProps> = ({
  item,
  currentUserId,
  onVote,
  onDelete,
  onToggleDiscussed,
  onMoveCategory,
  onEdit,
  onConvertToActionItem
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [showMenu, setShowMenu] = useState(false);
  const [hasVoted, setHasVoted] = useState(
    currentUserId && item.votedUserIds ? item.votedUserIds.includes(currentUserId) : false
  );

  const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.keep;

  const handleVoteClick = () => {
    onVote(item.id);
    setHasVoted(!hasVoted);
  };

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(item.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditText(item.text);
      setIsEditing(false);
    }
  };

  const otherCategories: RetroCategory[] = (['keep', 'stop', 'start'] as RetroCategory[]).filter(
    c => c !== item.category
  );

  return (
    <div
      id={`retro-card-${item.id}`}
      className={`group relative rounded-xl border ${config.borderColor} ${config.lightBg} p-4 transition-all duration-200 hover:shadow-md ${
        item.discussed ? 'opacity-80 bg-opacity-40' : ''
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Author Badge */}
          {item.isAnonymous ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              <span className="text-sm">🎭</span>
              <span>{item.authorAlias || 'Anonymous'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              <User className="w-3 h-3 text-zinc-500" />
              <span>{item.authorName || 'Teammate'}</span>
            </span>
          )}

          {/* Discussed Badge */}
          {item.discussed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              <Check className="w-3 h-3" />
              Discussed
            </span>
          )}

          {/* Action item created indicator */}
          {item.actionItemCreated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
              <Sparkles className="w-3 h-3" />
              Action Assigned
            </span>
          )}
        </div>

        {/* Card Options Menu */}
        <div className="relative">
          <button
            id={`retro-menu-btn-${item.id}`}
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
            title="Card options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setShowMenu(false)} 
              />
              <div 
                id={`retro-menu-dropdown-${item.id}`}
                className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-30 text-xs"
              >
                <button
                  id={`retro-menu-discuss-${item.id}`}
                  onClick={() => {
                    onToggleDiscussed(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {item.discussed ? 'Mark as Not Discussed' : 'Mark as Discussed'}
                </button>

                {onConvertToActionItem && (
                  <button
                    id={`retro-menu-action-${item.id}`}
                    onClick={() => {
                      onConvertToActionItem(item);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Turn into Action Item
                  </button>
                )}

                <button
                  id={`retro-menu-edit-${item.id}`}
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                  Edit Feedback
                </button>

                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

                <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Move to
                </div>
                {otherCategories.map(cat => (
                  <button
                    key={cat}
                    id={`retro-menu-move-${cat}-${item.id}`}
                    onClick={() => {
                      onMoveCategory(item.id, cat);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 capitalize"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
                    Move to {cat}
                  </button>
                ))}

                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

                <button
                  id={`retro-menu-delete-${item.id}`}
                  onClick={() => {
                    onDelete(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Card
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Text Content */}
      {isEditing ? (
        <div className="space-y-2 mt-2">
          <textarea
            id={`retro-card-edit-input-${item.id}`}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            placeholder="Edit your retrospective feedback..."
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setEditText(item.text);
                setIsEditing(false);
              }}
              className="px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm"
            >
              Save (Cmd+Enter)
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
          {item.text}
        </p>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {item.tags.map((t, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
              <Tag className="w-2.5 h-2.5" />
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer Controls: Upvoting & Convert */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-200/40 dark:border-zinc-700/40">
        <button
          id={`retro-card-vote-btn-${item.id}`}
          onClick={handleVoteClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            hasVoted || (item.votes && item.votes > 0)
              ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
          title="Upvote this item"
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-white' : ''}`} />
          <span>{item.votes || 0}</span>
          <span className="text-[10px] font-normal opacity-80">
            {item.votes === 1 ? 'vote' : 'votes'}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {onConvertToActionItem && !item.actionItemCreated && (
            <button
              id={`retro-card-quick-action-btn-${item.id}`}
              onClick={() => onConvertToActionItem(item)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              title="Create an Action Item from this feedback"
            >
              <Sparkles className="w-3 h-3" />
              <span>+ Action</span>
            </button>
          )}

          <button
            id={`retro-card-discuss-btn-${item.id}`}
            onClick={() => onToggleDiscussed(item.id)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              item.discussed
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/40'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={item.discussed ? 'Mark not discussed' : 'Mark discussed'}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
