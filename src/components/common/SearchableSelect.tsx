import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  avatarColor?: string;
  avatarInitials?: string;
  icon?: React.ReactNode;
  group?: string;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  allowClear?: boolean;
  clearLabel?: string;
  allOptionLabel?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  icon?: React.ReactNode;
  renderOption?: (opt: SelectOption, isSelected: boolean) => React.ReactNode;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  label,
  allowClear = true,
  clearLabel = 'All',
  allOptionLabel,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  size = 'sm',
  disabled = false,
  icon,
  renderOption
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find(o => o.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(term) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term)) ||
      (o.badge && o.badge.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % (filteredOptions.length + (allOptionLabel ? 1 : 0)));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const count = filteredOptions.length + (allOptionLabel ? 1 : 0);
          return (prev - 1 + count) % count;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (allOptionLabel && highlightedIndex === 0) {
          onChange('');
          setIsOpen(false);
          setSearchTerm('');
        } else {
          const targetOpt = allOptionLabel 
            ? filteredOptions[highlightedIndex - 1] 
            : filteredOptions[highlightedIndex];
          if (targetOpt) {
            onChange(targetOpt.value);
            setIsOpen(false);
            setSearchTerm('');
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm'
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
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
            : 'bg-[var(--surface-hover)] hover:bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedOption.avatarColor ? (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: selectedOption.avatarColor }}
                >
                  {selectedOption.avatarInitials || selectedOption.label[0]}
                </div>
              ) : selectedOption.icon ? (
                <span className="flex-shrink-0 text-[var(--primary)]">{selectedOption.icon}</span>
              ) : icon ? (
                <span className="text-[var(--primary)] flex-shrink-0">{icon}</span>
              ) : null}
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span 
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                  style={{ 
                    backgroundColor: selectedOption.badgeColor ? `${selectedOption.badgeColor}20` : 'var(--primary-light)',
                    color: selectedOption.badgeColor || 'var(--primary)' 
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {icon && <span className="text-[var(--primary)] flex-shrink-0">{icon}</span>}
              <span className="text-[var(--text-muted)] truncate">
                {allOptionLabel || placeholder}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 text-[var(--text-muted)]">
          {allowClear && selectedOption && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-[var(--critical)] hover:bg-[var(--surface-hover)] rounded-md transition-colors"
              title="Clear selection"
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
          className={`absolute left-0 z-50 mt-1.5 w-full min-w-[220px] max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
        >
          {/* Live Search Input */}
          <div className="p-2 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
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
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {allOptionLabel && !searchTerm && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                  !value
                    ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                    : highlightedIndex === 0
                    ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{allOptionLabel}</span>
                {!value && <Check size={14} className="text-[var(--primary)] flex-shrink-0" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-[var(--text-muted)] font-medium">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = (allOptionLabel && !searchTerm ? idx + 1 : idx) === highlightedIndex;

                if (renderOption) {
                  return (
                    <div 
                      key={opt.value} 
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className="cursor-pointer"
                    >
                      {renderOption(opt, isSelected)}
                    </div>
                  );
                }

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    onMouseEnter={() => setHighlightedIndex(allOptionLabel && !searchTerm ? idx + 1 : idx)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                        : isHighlighted
                        ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
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

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {opt.badge && (
                        <span 
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ 
                            backgroundColor: opt.badgeColor ? `${opt.badgeColor}20` : 'var(--surface-hover)',
                            color: opt.badgeColor || 'var(--text-secondary)' 
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={14} className="text-[var(--primary)] flex-shrink-0 ml-1" />}
                    </div>
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
