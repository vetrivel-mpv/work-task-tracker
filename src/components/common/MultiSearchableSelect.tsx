import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Users } from 'lucide-react';
import { SelectOption } from './SearchableSelect';

export interface MultiSearchableSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  allOptionLabel?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  icon?: React.ReactNode;
  maxDisplayTags?: number;
}

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  options,
  values = [],
  onChange,
  placeholder = 'Select options...',
  searchPlaceholder = 'Search...',
  label,
  allOptionLabel = 'All Members',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  size = 'sm',
  disabled = false,
  icon = <Users size={13} />,
  maxDisplayTags = 2
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selectedOptions = useMemo(() => {
    return options.filter(o => values.includes(o.value));
  }, [options, values]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(term) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term)) ||
      (o.badge && o.badge.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const handleToggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    if (values.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm'
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
          {label}
        </label>
      )}

      {/* Button Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border font-semibold transition-all cursor-pointer text-left ${
          sizeClasses[size]
        } ${
          isOpen
            ? 'bg-[var(--surface)] border-[var(--primary)] ring-2 ring-[var(--primary)]/20 text-[var(--text-primary)]'
            : values.length > 0
            ? 'bg-[var(--primary-light)]/40 border-[var(--primary)]/40 text-[var(--text-primary)]'
            : 'bg-[var(--surface-hover)] hover:bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          {icon && <span className="text-[var(--primary)] flex-shrink-0">{icon}</span>}
          
          {values.length === 0 ? (
            <span className="text-[var(--text-secondary)] truncate font-semibold">
              {allOptionLabel || placeholder}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--primary)] text-white flex-shrink-0">
                {values.length}
              </span>
              
              {selectedOptions.slice(0, maxDisplayTags).map(opt => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-primary)] shadow-2xs max-w-[120px] truncate"
                >
                  {opt.avatarColor && (
                    <div
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: opt.avatarColor }}
                    >
                      {opt.avatarInitials || opt.label[0]}
                    </div>
                  )}
                  <span className="truncate">{opt.label}</span>
                </span>
              ))}

              {values.length > maxDisplayTags && (
                <span className="text-[10px] font-bold text-[var(--text-muted)]">
                  +{values.length - maxDisplayTags} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 text-[var(--text-muted)]">
          {values.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="p-0.5 hover:text-[var(--critical)] hover:bg-[var(--surface)] rounded-md transition-colors cursor-pointer"
              title="Clear all"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[var(--primary)]' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div 
          className={`absolute left-0 z-50 mt-1.5 w-full min-w-[260px] max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
        >
          {/* Header Actions */}
          <div className="p-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-2">
            <div className="relative flex-1 flex items-center">
              <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus:bg-[var(--surface)] transition-all font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--critical)] px-2 py-1 rounded-lg hover:bg-[var(--critical-bg)] transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Quick Select All Button */}
          {!searchTerm && (
            <div className="px-2 pt-1.5 pb-0.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-semibold border-b border-[var(--border)]/50">
              <button
                type="button"
                onClick={handleClearAll}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  values.length === 0
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                    : 'hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                }`}
              >
                <span>{allOptionLabel}</span>
                {values.length === 0 && <Check size={14} className="text-[var(--primary)]" />}
              </button>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-[var(--text-muted)] font-medium">
                No matching options found
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = values.includes(opt.value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggle(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Checkbox Box */}
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                        isSelected 
                          ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-2xs' 
                          : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>

                      {opt.avatarColor && (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 shadow-2xs"
                          style={{ backgroundColor: opt.avatarColor }}
                        >
                          {opt.avatarInitials || opt.label[0]}
                        </div>
                      )}
                      
                      {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                      
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="text-[10px] text-[var(--text-muted)] truncate font-normal">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {opt.badge && (
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{ 
                          backgroundColor: opt.badgeColor ? `${opt.badgeColor}20` : 'var(--surface-hover)',
                          color: opt.badgeColor || 'var(--text-secondary)' 
                        }}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
