import { differenceInCalendarDays } from 'date-fns';
import type { PurchaseLine } from '../types';

export type UrgencyBucket = 'overdue' | 'due_soon' | 'watchlist';

export const URGENT_WINDOW_DAYS = 21; // "next 3 weeks" from today

export interface MissingEsdRow {
  po: string;
  supplier: string;
  warehouse: string; // delivery destination
  pgrd: Date | null;
  egrd: Date | null;
  qtyConfirmed: number;
  daysUntilEgrd: number | null; // negative = overdue, null = no EGRD to judge urgency by
  urgency: UrgencyBucket;
}

function urgencyFor(daysUntilEgrd: number | null): UrgencyBucket {
  if (daysUntilEgrd === null) return 'watchlist';
  if (daysUntilEgrd <= 0) return 'overdue';
  if (daysUntilEgrd <= URGENT_WINDOW_DAYS) return 'due_soon';
  return 'watchlist';
}

// One row per PO (not per line) — sums confirmed qty across the PO's lines, and uses the
// earliest EGRD among them for urgency/sort (the soonest-due line is what actually drives when
// the PO needs to be booked). A PO qualifies when every one of its lines is missing ESD, matching
// the existing dashboard card's definition, with the same qty>1 noise filter.
export function computeMissingEsdRows(lines: PurchaseLine[]): MissingEsdRow[] {
  const byPO = new Map<string, PurchaseLine[]>();
  for (const l of lines) {
    if (!byPO.has(l.po)) byPO.set(l.po, []);
    byPO.get(l.po)!.push(l);
  }

  const rows: MissingEsdRow[] = [];
  for (const [po, poLines] of byPO) {
    const noESD = poLines.every((l) => !l.esd);
    const qtyConfirmed = poLines.reduce((s, l) => s + l.cqty, 0);
    if (!noESD || qtyConfirmed <= 1) continue;

    const egrds = poLines.map((l) => l.egrd).filter((d): d is Date => d !== null);
    const egrd = egrds.length ? new Date(Math.min(...egrds.map((d) => d.getTime()))) : null;
    const pgrds = poLines.map((l) => l.pgrd).filter((d): d is Date => d !== null);
    const pgrd = pgrds.length ? new Date(Math.min(...pgrds.map((d) => d.getTime()))) : null;

    const daysUntilEgrd = egrd ? differenceInCalendarDays(egrd, new Date()) : null;

    rows.push({
      po,
      supplier: poLines[0].supplier,
      warehouse: poLines[0].destination,
      pgrd,
      egrd,
      qtyConfirmed,
      daysUntilEgrd,
      urgency: urgencyFor(daysUntilEgrd),
    });
  }

  // most overdue first: nulls (no EGRD) sort last
  return rows.sort((a, b) => {
    if (a.daysUntilEgrd === null) return 1;
    if (b.daysUntilEgrd === null) return -1;
    return a.daysUntilEgrd - b.daysUntilEgrd;
  });
}

export interface ConsolidationRisk {
  supplier: string;
  egrd: Date;
  poCount: number;
}

const CONSOLIDATION_THRESHOLD = 10; // hardcoded, not user-adjustable

// Flags supplier/EGRD combinations where more than 10 unbooked POs share the same Friday EGRD —
// a Friday slip leaves no weekend runway before the pickup actually happens.
export function findConsolidationRisks(rows: MissingEsdRow[]): ConsolidationRisk[] {
  const groups = new Map<string, { supplier: string; egrd: Date; count: number }>();
  for (const r of rows) {
    if (!r.egrd || r.egrd.getDay() !== 5) continue; // Friday only
    const key = `${r.supplier}__${r.egrd.toDateString()}`;
    const g = groups.get(key) ?? { supplier: r.supplier, egrd: r.egrd, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.count > CONSOLIDATION_THRESHOLD)
    .map((g) => ({ supplier: g.supplier, egrd: g.egrd, poCount: g.count }))
    .sort((a, b) => b.poCount - a.poCount);
}
