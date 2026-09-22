import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { ActionItem } from '../types/actions';
import type { PurchaseLine } from '../types';

export interface ActionWeek {
  week: number;
  year: number;
  label: string; // "W39"
}

// Flags are tied to a PO but don't store its PGRD week directly — derive it from the PO's own
// lines (first line with a PGRD date), the same source every other "PGRD week" in this app uses.
export function deriveActionWeek(action: ActionItem, allLines: PurchaseLine[]): ActionWeek | null {
  if (!action.poReference) return null;
  const line = allLines.find((l) => l.po === action.poReference && l.pgrd);
  if (!line?.pgrd) return null;
  const week = getISOWeek(line.pgrd);
  const year = getISOWeekYear(line.pgrd);
  return { week, year, label: `W${String(week).padStart(2, '0')}` };
}

export interface PgrdWeekOption extends ActionWeek {
  count: number; // total PO actions in this week, scoped to the current SCM filter (if any)
}

// Distinct PGRD weeks across every PO-action flag, each with a count reflecting the given SCM
// filter (or all SCMs if none selected yet) — powers the "PGRD Week" dropdown on the entry screen.
export function buildPgrdWeekOptions(actions: ActionItem[], allLines: PurchaseLine[], scmEmail: string | null): PgrdWeekOption[] {
  const totals = new Map<string, PgrdWeekOption>();
  for (const a of actions) {
    if (a.type !== 'flag') continue;
    if (scmEmail && a.owner !== scmEmail) continue;
    const week = deriveActionWeek(a, allLines);
    if (!week) continue;
    const key = `${week.year}-${week.week}`;
    const existing = totals.get(key);
    if (existing) existing.count += 1;
    else totals.set(key, { ...week, count: 1 });
  }
  return [...totals.values()].sort((a, b) => (a.year - b.year) || (a.week - b.week));
}

// The SCM's PO-action queue for one PGRD week — every matching flag (open or already closed), so
// Previous/Next can revisit resolved ones too. Sorted by PO number for a stable, predictable order.
export function buildPOQueue(actions: ActionItem[], allLines: PurchaseLine[], scmEmail: string, week: ActionWeek): ActionItem[] {
  return actions
    .filter((a) => a.type === 'flag' && a.owner === scmEmail)
    .filter((a) => {
      const w = deriveActionWeek(a, allLines);
      return w !== null && w.week === week.week && w.year === week.year;
    })
    .sort((a, b) => (a.poReference ?? '').localeCompare(b.poReference ?? ''));
}

// The SCM's outstanding Open Points — not scoped to any PGRD week, since Open Points may not
// belong to a PO/PGRD week at all.
export function buildOpenPointQueue(actions: ActionItem[], scmEmail: string): ActionItem[] {
  return actions
    .filter((a) => a.type === 'open_point' && a.owner === scmEmail && a.status !== 'closed')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type ProgressBucket = 'todo' | 'in_progress' | 'completed';

export function progressBucket(status: ActionItem['status']): ProgressBucket {
  if (status === 'closed') return 'completed';
  if (status === 'in_progress' || status === 'blocked') return 'in_progress';
  return 'todo';
}
