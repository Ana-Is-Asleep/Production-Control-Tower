import { differenceInCalendarDays } from 'date-fns';
import { shiftISOWeek, weekRangeFor, lastCompletedWeek, getISOWeek, getISOWeekYear } from './dateUtils';
import type { PurchaseLine } from '../types';

export const RECENT_THRESHOLD_DAYS = 14;
export const PROJECTION_FORWARD_WEEKS = 4; // today + next 4 weeks

export type AgeBucket = 'recent' | 'accumulated';

export interface BacklogPORow {
  po: string;
  supplier: string;
  warehouse: string; // delivery destination
  pgrd: Date;
  egrd: Date | null;
  esd: Date | null;
  qtyConfirmed: number;
  ageDays: number; // days since PGRD
  ageBucket: AgeBucket;
  hasEsd: boolean;
  esdPassedNoAsd: boolean; // status label: ESD booked but already passed without clearing
}

export interface ExpectedPORow {
  po: string;
  supplier: string;
  warehouse: string;
  pgrd: Date;
  esd: Date;
}

function groupByPO(lines: PurchaseLine[]): Map<string, PurchaseLine[]> {
  const map = new Map<string, PurchaseLine[]>();
  for (const l of lines) {
    if (!map.has(l.po)) map.set(l.po, []);
    map.get(l.po)!.push(l);
  }
  return map;
}

// Backlog membership: PGRD has passed AND ASD is not filled — a PO with PGRD in the future is
// never backlog, regardless of ESD. One row per PO, sorted by age descending (most stale first).
// Recent/Accumulated are computed as a residual split of this single population (not two
// independent checks), so they're guaranteed mutually exclusive and always sum to the total.
export function computeBacklogRows(lines: PurchaseLine[], today: Date = new Date()): BacklogPORow[] {
  const byPO = groupByPO(lines);

  const rows: BacklogPORow[] = [];
  for (const [po, poLines] of byPO) {
    const pgrd = poLines.find((l) => l.pgrd)?.pgrd ?? null;
    if (!pgrd || pgrd >= today) continue; // PGRD must have passed — this is the only backlog gate
    const hasAnyASD = poLines.some((l) => l.asd);
    if (hasAnyASD) continue; // cleared

    const esd = poLines.find((l) => l.esd)?.esd ?? null;
    const egrd = poLines.find((l) => l.egrd)?.egrd ?? null;
    const ageDays = differenceInCalendarDays(today, pgrd);

    // residual split: Accumulated is the explicit >2wk check, Recent is simply "everything else"
    // in this already-backlog-only population — there is no third bucket a row could fall into here.
    const isAccumulated = ageDays > RECENT_THRESHOLD_DAYS;

    rows.push({
      po,
      supplier: poLines[0].supplier,
      warehouse: poLines[0].destination,
      pgrd,
      egrd,
      esd,
      qtyConfirmed: poLines.reduce((s, l) => s + l.cqty, 0),
      ageDays,
      ageBucket: isAccumulated ? 'accumulated' : 'recent',
      hasEsd: esd !== null,
      esdPassedNoAsd: esd !== null && esd < today,
    });
  }

  return rows.sort((a, b) => b.ageDays - a.ageDays);
}

// Expected Future Backlog is NOT backlog (PGRD hasn't passed yet) — a forward-looking early-warning
// bucket: PGRD in the future, with an ESD already booked for a date after that PGRD. Shown alongside
// the backlog numbers but never summed into Current Backlog, and never fed into the clearance
// forecast below — those are two different populations and must stay separate.
export function computeExpectedRows(lines: PurchaseLine[], today: Date = new Date()): ExpectedPORow[] {
  const byPO = groupByPO(lines);
  const rows: ExpectedPORow[] = [];
  for (const poLines of byPO.values()) {
    const pgrd = poLines.find((l) => l.pgrd)?.pgrd ?? null;
    if (!pgrd || pgrd <= today) continue; // PGRD must be in the future
    const esd = poLines.find((l) => l.esd)?.esd ?? null;
    if (!esd || esd <= pgrd) continue; // ESD must be booked for after PGRD
    rows.push({ po: poLines[0].po, supplier: poLines[0].supplier, warehouse: poLines[0].destination, pgrd, esd });
  }
  return rows;
}

export interface AgeBand {
  label: string;
  count: number;
}

export function computeAgeBands(rows: BacklogPORow[]): AgeBand[] {
  const bands: AgeBand[] = [
    { label: '<2 weeks', count: 0 },
    { label: '2–4 weeks', count: 0 },
    { label: '4–6 weeks', count: 0 },
    { label: '6+ weeks', count: 0 },
  ];
  for (const r of rows) {
    const weeks = r.ageDays / 7;
    if (weeks < 2) bands[0].count += 1;
    else if (weeks < 4) bands[1].count += 1;
    else if (weeks < 6) bands[2].count += 1;
    else bands[3].count += 1;
  }
  return bands;
}

export interface ClearanceForecastPoint {
  label: string; // 'Today' | 'W36' | ...
  offset: number;
  remaining: number; // current-backlog POs not yet cleared by this week's end, per their own ESD
  noEsdRemaining: number; // subset with no ESD at all — the permanent floor of this curve
}

// The main visualization: starting ONLY from today's Current Backlog population (never Expected
// Future Backlog — mixing the two would answer a different question), how many of those POs are
// still unresolved after each of the next few weeks, assuming each one clears in the week matching
// its own booked ESD. A PO with no ESD never clears in this model, so the curve floors at
// noEsdRemaining rather than reaching zero.
export function computeClearanceForecast(rows: BacklogPORow[], curWeek: number, curYear: number): ClearanceForecastPoint[] {
  const noEsdCount = rows.filter((r) => !r.hasEsd).length;
  const points: ClearanceForecastPoint[] = [{ label: 'Today', offset: 0, remaining: rows.length, noEsdRemaining: noEsdCount }];

  for (let offset = 1; offset <= PROJECTION_FORWARD_WEEKS; offset++) {
    const { week, year } = shiftISOWeek(curWeek, curYear, offset);
    const { end: weekEnd } = weekRangeFor(week, year);
    const remaining = rows.filter((r) => !r.hasEsd || r.esd! > weekEnd).length;
    points.push({ label: `W${String(week).padStart(2, '0')}`, offset, remaining, noEsdRemaining: noEsdCount });
  }
  return points;
}

export interface ExpectedByWeek {
  label: string; // 'W36' | ... | 'Later'
  count: number;
}

// Expected Future Backlog broken down by the PGRD week it's expected to land in — PGRD determines
// when (if the booking doesn't change) a PO actually becomes backlog. Anything beyond the forward
// window folds into a "Later" catch-all rather than growing the axis indefinitely.
export function computeExpectedByPgrdWeek(expectedRows: ExpectedPORow[], curWeek: number, curYear: number): ExpectedByWeek[] {
  const weeks: ExpectedByWeek[] = [];
  let laterCount = 0;
  const matchedPOs = new Set<string>();

  for (let offset = 1; offset <= PROJECTION_FORWARD_WEEKS; offset++) {
    const { week, year } = shiftISOWeek(curWeek, curYear, offset);
    const label = `W${String(week).padStart(2, '0')}`;
    const matching = expectedRows.filter((r) => getISOWeek(r.pgrd) === week && getISOWeekYear(r.pgrd) === year);
    matching.forEach((r) => matchedPOs.add(r.po));
    weeks.push({ label, count: matching.length });
  }

  laterCount = expectedRows.filter((r) => !matchedPOs.has(r.po)).length;
  if (laterCount > 0) weeks.push({ label: 'Later', count: laterCount });

  return weeks;
}

export interface SupplierBacklogSummary {
  supplier: string;
  count: number;
  pctOfBacklog: number;
  avgAgeDays: number;
  noEsdCount: number;
}

// Ranked by CURRENT backlog count. There is deliberately no week-over-week trend/chronic-vs-spike
// classification here: the data source is a live upload with records updated in place (once ASD
// fills in, the PO's earlier backlog status is gone), so a genuine "backlog as of last week"
// figure isn't reconstructable from it — computing one would just be fabricating a trend. Derived
// directly from the same `rows` population used everywhere else on the page, so a supplier with
// real current backlog can never silently disappear here.
export function computeSupplierBacklogSummary(rows: BacklogPORow[]): SupplierBacklogSummary[] {
  const bySupplier = new Map<string, BacklogPORow[]>();
  for (const r of rows) {
    if (!bySupplier.has(r.supplier)) bySupplier.set(r.supplier, []);
    bySupplier.get(r.supplier)!.push(r);
  }
  const total = rows.length;
  return [...bySupplier.entries()]
    .map(([supplier, poRows]) => ({
      supplier,
      count: poRows.length,
      pctOfBacklog: total ? Math.round((poRows.length / total) * 100) : 0,
      avgAgeDays: Math.round(poRows.reduce((s, r) => s + r.ageDays, 0) / poRows.length),
      noEsdCount: poRows.filter((r) => !r.hasEsd).length,
    }))
    .sort((a, b) => b.count - a.count);
}

export function findOutliers(rows: BacklogPORow[], curWeek: number, curYear: number): BacklogPORow[] {
  const { week, year } = shiftISOWeek(curWeek, curYear, PROJECTION_FORWARD_WEEKS);
  const { end: windowEnd } = weekRangeFor(week, year);
  return rows.filter((r) => r.hasEsd && r.esd! > windowEnd);
}

export function anchorWeek(): { week: number; year: number } {
  const { week, year } = lastCompletedWeek();
  return { week, year };
}
