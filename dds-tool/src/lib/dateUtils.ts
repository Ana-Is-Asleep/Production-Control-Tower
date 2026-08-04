import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  format,
} from 'date-fns';

export { getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek };

// handles both ISO strings and Excel serial numbers, BC exports can be either depending on the column
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    // Excel counts days from 1900-01-01, minus 25569 converts to unix epoch
    const date = new Date((value - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function isoWeekLabel(date: Date): string {
  return `W${String(getISOWeek(date)).padStart(2, '0')}`;
}

export function isoWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
}

// last completed week = current week minus 1, that's what we score against in DDS
export function lastCompletedWeek(): { week: number; year: number; date: Date } {
  const today = new Date();
  const w = getISOWeek(today);
  const y = getISOWeekYear(today);
  if (w === 1) {
    return { week: 52, year: y - 1, date: addWeeks(startOfISOWeek(today), -1) };
  }
  const prev = addWeeks(startOfISOWeek(today), -1);
  return { week: w - 1, year: getISOWeekYear(prev), date: prev };
}

export function formatDateShort(date: Date | null): string {
  if (!date) return '—';
  return format(date, 'dd MMM');
}

export function formatDateMedium(date: Date | null): string {
  if (!date) return '—';
  return format(date, 'dd MMM yyyy');
}

// current ISO week (this week, not last-completed) — used as the anchor for the global weekRange filter
export function currentISOWeek(): { week: number; year: number } {
  const today = new Date();
  return { week: getISOWeek(today), year: getISOWeekYear(today) };
}

// shifts a date by N ISO weeks and returns the resulting ISO week/year — robust across year boundaries
// (avoids the mod-52 rollover hack, which breaks on 53-week ISO years)
export function shiftISOWeek(week: number, year: number, offset: number): { week: number; year: number; weekStart: Date } {
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  const anchor = addWeeks(startOfWeek1, week - 1);
  const shifted = addWeeks(anchor, offset);
  return { week: getISOWeek(shifted), year: getISOWeekYear(shifted), weekStart: shifted };
}

export function weekRangeFor(week: number, year: number): { start: Date; end: Date } {
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  const start = addWeeks(startOfWeek1, week - 1);
  const end = endOfISOWeek(start);
  return { start, end };
}
