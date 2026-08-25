import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { SearchableSelect, SelectOption } from './SearchableSelect';

export interface FilterDropdownConfig {
  id: string;
  label: string;
  placeholder: string;
  allOptionLabel?: string;
  icon?: React.ReactNode;
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  minWidth?: string;
  disabled?: boolean;
}

export interface FilterBarProps {
  search?: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    ariaLabel?: string;
  };
  filters: FilterDropdownConfig[];
  onReset?: () => void;
  activeFiltersCount?: number;
  extraLeadingContent?: React.ReactNode;
  extraTrailingContent?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  filters,
  onReset,
  activeFiltersCount = 0,
  extraLeadingContent,
  extraTrailingContent,
  className = '',
  containerClassName = ''
}) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 w-full ${containerClassName}`}
      data-testid="filter-bar"
    >
      {extraLeadingContent}

      {/* Search Input */}
      {search && (
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder={search.placeholder || 'Search...'}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            aria-label={search.ariaLabel || search.placeholder || 'Search'}
            className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text-primary)] outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] transition-all"
          />
          {search.value && (
            <button
              type="button"
              onClick={() => search.onChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer transition-colors"
              title="Clear search"
              aria-label="Clear search text"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Dynamic Dropdown Filters */}
      {filters.map((f) => (
        <div
          key={f.id}
          className={f.minWidth ? `min-w-[${f.minWidth}]` : 'min-w-[150px]'}
          style={f.minWidth ? { minWidth: f.minWidth } : undefined}
        >
          <SearchableSelect
            options={f.options}
            value={f.value}
            onChange={f.onChange}
            placeholder={f.placeholder}
            allOptionLabel={f.allOptionLabel || f.placeholder}
            label={f.label}
            icon={f.icon}
            disabled={f.disabled}
          />
        </div>
      ))}

      {extraTrailingContent}

      {/* Reset Filters Button */}
      {activeFiltersCount > 0 && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
          title="Reset all filters"
        >
          <X size={13} />
          <span>Reset ({activeFiltersCount})</span>
        </button>
      )}
    </div>
  );
};
