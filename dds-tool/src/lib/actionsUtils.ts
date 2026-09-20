import { differenceInCalendarDays } from 'date-fns';
import type { ActionItem } from '../types/actions';

// "Time Open" is new presentation logic, not an existing approved KPI — it's plain calendar-day
// arithmetic on two already-real timestamps (createdAt, and closedAt/today), added specifically
// for the Actions page per spec. Open: today - createdAt. Closed: closedAt - createdAt (falls back
// to updatedAt for actions closed before closedAt existed).
export function daysOpen(action: ActionItem, today: Date): number | null {
  const created = new Date(action.createdAt);
  if (isNaN(created.getTime())) return null;
  if (action.status === 'closed') {
    const closed = new Date(action.closedAt ?? action.updatedAt);
    if (isNaN(closed.getTime())) return null;
    return Math.max(0, differenceInCalendarDays(closed, created));
  }
  return Math.max(0, differenceInCalendarDays(today, created));
}

// Flags only ever carry a ruleKey today (see rulesEngine.ts) — one rule, R001, exists. Open Points
// have no structured "reason" at all (description is free text a user types), so they all bucket
// into "Manual entry" rather than a fabricated taxonomy.
export const RULE_LABELS: Record<string, string> = {
  R001: 'EGRD in the past with no booking',
};

export function reasonBucket(action: ActionItem): string {
  if (action.type === 'flag' && action.ruleKey) return RULE_LABELS[action.ruleKey] ?? action.ruleKey;
  return 'Manual entry';
}

// Older flags (created before the rule text was trimmed) still have their PO number baked into
// the stored description itself — e.g. "PO PO-E-55114 — EGRD in the past...". Every place that
// shows a description already shows the PO number right next to it (title line/column), so this
// strips a leading "PO <poReference> —" if present rather than showing it twice. Purely a display
// concern — the stored description is never rewritten.
export function displayDescription(action: ActionItem): string {
  const desc = action.description ?? '';
  if (!action.poReference) return desc;
  const prefix = new RegExp(`^PO\\s+${action.poReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—-]\\s*`, 'i');
  return desc.replace(prefix, '');
}
