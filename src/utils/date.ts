export function toDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = (s || toDateStr()).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftDate(s: string, days: number): string {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function formatDisplayDate(s: string): string {
  const d = fromDateStr(s);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function formatLongDate(s: string): string {
  const d = fromDateStr(s);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function isToday(s: string): boolean {
  return s === toDateStr(new Date());
}

export function formatTime12(time24?: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

export function getDaysDiff(dateStrA: string, dateStrB: string): number {
  const dA = fromDateStr(dateStrA);
  const dB = fromDateStr(dateStrB);
  const diffTime = dA.getTime() - dB.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function isTaskOverdue(dueDate?: string, status?: string, referenceDate?: string): boolean {
  if (!dueDate || status === 'complete') return false;
  const ref = referenceDate || toDateStr(new Date());
  return dueDate < ref;
}

export function getDueStatus(
  dueDate?: string, 
  status?: string, 
  referenceDate?: string
): 'overdue' | 'due-today' | 'due-soon' | 'future' | 'completed' | null {
  if (!dueDate) return null;
  if (status === 'complete') return 'completed';
  const ref = referenceDate || toDateStr(new Date());
  
  if (dueDate < ref) return 'overdue';
  if (dueDate === ref) return 'due-today';
  
  const diffDays = getDaysDiff(dueDate, ref);
  if (diffDays <= 2) return 'due-soon';
  return 'future';
}

export function formatDueDateBadge(dueDate: string, referenceDate?: string): {
  label: string;
  isOverdue: boolean;
  daysDiff: number;
} {
  const ref = referenceDate || toDateStr(new Date());
  const diff = getDaysDiff(dueDate, ref);
  const display = formatDisplayDate(dueDate);

  if (diff < 0) {
    const daysLate = Math.abs(diff);
    return {
      label: `Overdue by ${daysLate}d (${display})`,
      isOverdue: true,
      daysDiff: diff
    };
  } else if (diff === 0) {
    return {
      label: `Due Today (${display})`,
      isOverdue: false,
      daysDiff: 0
    };
  } else if (diff === 1) {
    return {
      label: `Due Tomorrow (${display})`,
      isOverdue: false,
      daysDiff: 1
    };
  } else {
    return {
      label: `Due ${display}`,
      isOverdue: false,
      daysDiff: diff
    };
  }
}

