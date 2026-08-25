import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UseWorkItemFiltersOptions {
  initialSearch?: string;
  initialAreaPath?: string;
  initialRelease?: string;
  initialAssignee?: string;
  initialStatus?: string;
  initialCustomFilters?: Record<string, string>;
  selectedReleaseId?: string | null;
  onSelectRelease?: (releaseId: string | null) => void;
  // Default values that count as "unfiltered" (e.g., '' or 'all')
  emptyReleaseValue?: string;
  emptyAreaValue?: string;
  emptyAssigneeValue?: string;
  emptyStatusValue?: string;
}

export interface UseWorkItemFiltersReturn {
  search: string;
  setSearch: (s: string) => void;
  filterAreaPath: string;
  setFilterAreaPath: (area: string) => void;
  handleAreaPathChange: (area: string) => void;
  filterRelease: string;
  setFilterRelease: (rel: string) => void;
  handleReleaseChange: (rel: string) => void;
  filterAssignee: string;
  setFilterAssignee: (assignee: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  customFilters: Record<string, string>;
  setCustomFilter: (key: string, value: string) => void;
  getCustomFilter: (key: string, defaultValue?: string) => string;
  activeFiltersCount: number;
  handleClearFilters: () => void;
}

export function useWorkItemFilters(options: UseWorkItemFiltersOptions = {}): UseWorkItemFiltersReturn {
  const {
    initialSearch = '',
    initialAreaPath = '',
    initialRelease = '',
    initialAssignee = '',
    initialStatus = '',
    initialCustomFilters = {},
    selectedReleaseId,
    onSelectRelease,
    emptyReleaseValue = '',
    emptyAreaValue = '',
    emptyAssigneeValue = '',
    emptyStatusValue = ''
  } = options;

  const [search, setSearch] = useState<string>(initialSearch);
  const [filterAreaPath, setFilterAreaPath] = useState<string>(initialAreaPath);
  const [filterRelease, setFilterRelease] = useState<string>(initialRelease || selectedReleaseId || '');
  const [filterAssignee, setFilterAssignee] = useState<string>(initialAssignee);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [customFilters, setCustomFilters] = useState<Record<string, string>>(initialCustomFilters);

  // Sync with global selectedReleaseId when it changes externally
  useEffect(() => {
    if (selectedReleaseId !== undefined) {
      setFilterRelease(selectedReleaseId || emptyReleaseValue);
    }
  }, [selectedReleaseId, emptyReleaseValue]);

  const handleReleaseChange = useCallback(
    (val: string) => {
      setFilterRelease(val);
      if (onSelectRelease) {
        // Normalize 'all' or empty string to null for global release selector
        const isAll = val === 'all' || !val || val === emptyReleaseValue;
        onSelectRelease(isAll ? null : val);
      }
    },
    [onSelectRelease, emptyReleaseValue]
  );

  const handleAreaPathChange = useCallback(
    (area: string) => {
      setFilterAreaPath(area);
      // When area changes, clear the release/iteration filter to avoid mismatched iterations
      handleReleaseChange(emptyReleaseValue);
    },
    [handleReleaseChange, emptyReleaseValue]
  );

  const setCustomFilter = useCallback((key: string, value: string) => {
    setCustomFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const getCustomFilter = useCallback(
    (key: string, defaultValue = ''): string => {
      return customFilters[key] ?? defaultValue;
    },
    [customFilters]
  );

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setFilterAreaPath(emptyAreaValue);
    setFilterRelease(emptyReleaseValue);
    setFilterAssignee(emptyAssigneeValue);
    setFilterStatus(emptyStatusValue);
    
    // Reset all custom filters to default/empty values
    setCustomFilters((prev) => {
      const resetMap: Record<string, string> = {};
      Object.keys(prev).forEach((k) => {
        resetMap[k] = '';
      });
      return resetMap;
    });

    if (onSelectRelease) {
      onSelectRelease(null);
    }
  }, [emptyAreaValue, emptyReleaseValue, emptyAssigneeValue, emptyStatusValue, onSelectRelease]);

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (filterAreaPath && filterAreaPath !== emptyAreaValue && filterAreaPath !== 'all') count++;
    if (filterRelease && filterRelease !== emptyReleaseValue && filterRelease !== 'all') count++;
    if (filterAssignee && filterAssignee !== emptyAssigneeValue && filterAssignee !== 'all') count++;
    if (filterStatus && filterStatus !== emptyStatusValue && filterStatus !== 'all') count++;

    Object.values(customFilters).forEach((val) => {
      if (val && val !== 'all' && val !== '') count++;
    });

    return count;
  }, [
    search,
    filterAreaPath,
    filterRelease,
    filterAssignee,
    filterStatus,
    customFilters,
    emptyAreaValue,
    emptyReleaseValue,
    emptyAssigneeValue,
    emptyStatusValue
  ]);

  return {
    search,
    setSearch,
    filterAreaPath,
    setFilterAreaPath,
    handleAreaPathChange,
    filterRelease,
    setFilterRelease,
    handleReleaseChange,
    filterAssignee,
    setFilterAssignee,
    filterStatus,
    setFilterStatus,
    customFilters,
    setCustomFilter,
    getCustomFilter,
    activeFiltersCount,
    handleClearFilters
  };
}
