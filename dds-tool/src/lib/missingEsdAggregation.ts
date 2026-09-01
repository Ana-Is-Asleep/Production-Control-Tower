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

export interface UrgencyProfileBucket {
  key: 'overdue' | 'due_lt_1wk' | 'due_1_3wk' | 'due_3_6wk' | 'due_gt_6wk';
  label: string;
  count: number;
}

// Finer-grained breakdown than the overdue/due_soon/watchlist buckets used for filtering — purely
// a presentational split of the same two groups (overdue + due_lt_1wk + due_1_3wk = Needing
// Action; due_3_6wk + due_gt_6wk = Not Urgent) so the urgency profile bar can show more texture
// without changing what "needing action" means anywhere else.
export function computeUrgencyProfile(rows: MissingEsdRow[]): UrgencyProfileBucket[] {
  const counts = { overdue: 0, due_lt_1wk: 0, due_1_3wk: 0, due_3_6wk: 0, due_gt_6wk: 0 };
  for (const r of rows) {
    const d = r.daysUntilEgrd;
    if (d === null) counts.due_gt_6wk += 1;
    else if (d <= 0) counts.overdue += 1;
    else if (d <= 7) counts.due_lt_1wk += 1;
    else if (d <= 21) counts.due_1_3wk += 1;
    else if (d <= 42) counts.due_3_6wk += 1;
    else counts.due_gt_6wk += 1;
  }
  return [
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'due_lt_1wk', label: 'Due in < 1 week', count: counts.due_lt_1wk },
    { key: 'due_1_3wk', label: 'Due in 1–3 weeks', count: counts.due_1_3wk },
    { key: 'due_3_6wk', label: 'Due in 3–6 weeks', count: counts.due_3_6wk },
    { key: 'due_gt_6wk', label: 'Due in > 6 weeks', count: counts.due_gt_6wk },
  ];
}

export interface SupplierExposureRow {
  supplier: string;
  total: number;
  needingAction: number;
  notUrgent: number;
}

function emptyExposure(supplier: string): SupplierExposureRow {
  return { supplier, total: 0, needingAction: 0, notUrgent: 0 };
}

// Top-N suppliers by total missing-ESD volume, folding the long tail into "Others" — same
// volume-ranked-top-N-plus-rest pattern as the SOT/OTIF Scorecard, so exposure isn't buried
// behind a wall of low-volume suppliers.
export function computeSupplierExposure(rows: MissingEsdRow[], topN = 5) {
  const bySupplier = new Map<string, SupplierExposureRow>();
  for (const r of rows) {
    const cur = bySupplier.get(r.supplier) ?? emptyExposure(r.supplier);
    cur.total += 1;
    if (r.urgency === 'watchlist') cur.notUrgent += 1;
    else cur.needingAction += 1;
    bySupplier.set(r.supplier, cur);
  }

  const sorted = [...bySupplier.values()].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  const sum = (list: SupplierExposureRow[], supplier: string) =>
    list.reduce((acc, r) => ({
      supplier,
      total: acc.total + r.total,
      needingAction: acc.needingAction + r.needingAction,
      notUrgent: acc.notUrgent + r.notUrgent,
    }), emptyExposure(supplier));

  return {
    top,
    others: rest.length ? sum(rest, 'Others') : null,
    total: sum(sorted, 'TOTAL'),
  };
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
