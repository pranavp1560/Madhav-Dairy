// =============================================================================
// Dashboard Utilities: Date Ranges, Formats, Comparisons, and Aggregations
// =============================================================================

export type DateRangePreset = 'today' | 'yesterday' | '7days' | 'this_month' | 'last_month' | 'custom';

export interface DateRangeBounds {
  preset: DateRangePreset;
  startStr: string;     // YYYY-MM-DD
  endStr: string;       // YYYY-MM-DD
  prevStartStr: string; // YYYY-MM-DD for comparison period
  prevEndStr: string;   // YYYY-MM-DD for comparison period
  label: string;
}

export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatINR(val: number, compact = false): string {
  if (compact) {
    if (Math.abs(val) >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (Math.abs(val) >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (Math.abs(val) >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export function formatCompactNumber(val: number): string {
  if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toLocaleString('en-IN');
}

export function calculatePercentChange(current: number, previous: number): { percent: number; isPositive: boolean; isZero: boolean } {
  if (previous === 0) {
    if (current > 0) return { percent: 100, isPositive: true, isZero: false };
    if (current < 0) return { percent: -100, isPositive: false, isZero: false };
    return { percent: 0, isPositive: true, isZero: true };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  return {
    percent: Math.abs(pct),
    isPositive: pct >= 0,
    isZero: pct === 0,
  };
}

export function getDateRangeBounds(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const now = new Date();
  const todayStr = toLocalDateString(now);

  if (preset === 'today') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = toLocalDateString(yesterday);
    return {
      preset,
      startStr: todayStr,
      endStr: todayStr,
      prevStartStr: yestStr,
      prevEndStr: yestStr,
      label: 'Today',
    };
  }

  if (preset === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - 2);
    const yestStr = toLocalDateString(yest);
    const dbStr = toLocalDateString(dayBefore);
    return {
      preset,
      startStr: yestStr,
      endStr: yestStr,
      prevStartStr: dbStr,
      prevEndStr: dbStr,
      label: 'Yesterday',
    };
  }

  if (preset === '7days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    return {
      preset,
      startStr: toLocalDateString(start),
      endStr: todayStr,
      prevStartStr: toLocalDateString(prevStart),
      prevEndStr: toLocalDateString(prevEnd),
      label: 'Last 7 Days',
    };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const daysInCurrentMonth = Math.ceil((now.getTime() - start.getTime()) / 86400000) + 1;
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysInCurrentMonth - 1));
    return {
      preset,
      startStr: toLocalDateString(start),
      endStr: todayStr,
      prevStartStr: toLocalDateString(prevStart),
      prevEndStr: toLocalDateString(prevEnd),
      label: 'This Month',
    };
  }

  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    return {
      preset,
      startStr: toLocalDateString(start),
      endStr: toLocalDateString(end),
      prevStartStr: toLocalDateString(prevStart),
      prevEndStr: toLocalDateString(prevEnd),
      label: 'Last Month',
    };
  }

  // Custom
  const startStr = customStart || todayStr;
  const endStr = customEnd || todayStr;
  const sDate = parseLocalDate(startStr);
  const eDate = parseLocalDate(endStr);
  const durationDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / 86400000) + 1);

  const prevEnd = new Date(sDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (durationDays - 1));

  return {
    preset: 'custom',
    startStr,
    endStr,
    prevStartStr: toLocalDateString(prevStart),
    prevEndStr: toLocalDateString(prevEnd),
    label: `${startStr} to ${endStr}`,
  };
}
