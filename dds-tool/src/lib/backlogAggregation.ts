import { differenceInCalendarDays } from 'date-fns';
import { shiftISOWeek, weekRangeFor, lastCompletedWeek } from './dateUtils';
import { aggregatePOReasons, type LineForAggregation } from './poReasonAggregation';
import { isSubstantiveReason, REASON_CATEGORY_LABELS, type ReasonCategory } from './reasonClassification';
import type { ClassificationEntry } from '../hooks/useReasonClassification';
import type { PurchaseLine } from '../types';

export const RECENT_THRESHOLD_DAYS = 14;
export const PROJECTION_FORWARD_WEEKS = 4; // last completed week + next 4

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
  rootCauseCategory: ReasonCategory | null;
  rootCauseLabel: string | null;
  rootCauseRawReasons: string[];
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
export function computeBacklogRows(
  lines: PurchaseLine[],
  classifications: Record<string, ClassificationEntry>,
  today: Date = new Date()
): BacklogPORow[] {
  const byPO = groupByPO(lines);

  // reused so a backlogged PO's own AI-classified loss reason (when available) can be surfaced
  // instead of re-deriving a separate, inconsistent definition of "this PO's root cause"
  const linesForAgg: LineForAggregation[] = lines.map((l) => {
    const reason = l.lossReasonCode.trim();
    const category = isSubstantiveReason(reason) ? (classifications[reason]?.category ?? null) : null;
    return { po: l.po, line: l.line, qty: l.qty, rawReason: reason, category };
  });
  const poReasonResults = aggregatePOReasons(linesForAgg);

  const rows: BacklogPORow[] = [];
  for (const [po, poLines] of byPO) {
    const pgrd = poLines.find((l) => l.pgrd)?.pgrd ?? null;
    if (!pgrd || pgrd >= today) continue; // PGRD must have passed — this is the only backlog gate
    const hasAnyASD = poLines.some((l) => l.asd);
    if (hasAnyASD) continue; // cleared

    const esd = poLines.find((l) => l.esd)?.esd ?? null;
    const egrd = poLines.find((l) => l.egrd)?.egrd ?? null;
    const ageDays = differenceInCalendarDays(today, pgrd);
    const reasonResult = poReasonResults.get(po);
    const rawReasons = poLines.map((l) => l.lossReasonCode.trim()).filter((r) => isSubstantiveReason(r));

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
      rootCauseCategory: reasonResult?.finalCategory ?? null,
      rootCauseLabel: reasonResult?.finalCategory ? REASON_CATEGORY_LABELS[reasonResult.finalCategory] : null,
      rootCauseRawReasons: rawReasons,
    });
  }

  return rows.sort((a, b) => b.ageDays - a.ageDays);
}

// Expected is NOT backlog (PGRD hasn't passed yet) — a forward-looking early-warning bucket:
// PGRD in the future, with an ESD already booked for a date after that PGRD. Shown alongside the
// backlog numbers but never summed into Total Backlog. A PO with PGRD already passed + ESD booked
// is not "Expected" — it's just ordinary Recent/Accumulated backlog (already covered above).
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
    { label: '<2wk', count: 0 },
    { label: '2-4wk', count: 0 },
    { label: '4-6wk', count: 0 },
    { label: '6wk+', count: 0 },
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

export interface ProjectionWeek {
  label: string;
  offset: number;
  recent: number;
  accumulated: number;
  expected: number;
  total: number; // recent + accumulated only — matches the Total Backlog KPI definition
  stackTotal: number; // recent + accumulated + expected — the chart's actual visual bar height
}

interface ProjectionPO {
  pgrd: Date;
  asd: Date | null;
  esd: Date | null;
}

type WeekStatus = 'recent' | 'accumulated' | 'expected' | 'other';

// Recomputes what a single PO's status WOULD be as of a given week's end — not "carry forward
// today's classification": a currently-Recent PO ages into Accumulated if still unresolved by a
// later week, and a currently-Expected PO (future PGRD) rolls into Recent once its PGRD passes.
function statusAsOfWeek(po: ProjectionPO, weekEnd: Date, useEsdAssumption: boolean): WeekStatus {
  const clearedReal = po.asd !== null && po.asd <= weekEnd;
  const clearedProjected = useEsdAssumption && po.esd !== null && po.esd <= weekEnd;
  if (clearedReal || clearedProjected) return 'other';

  if (po.pgrd <= weekEnd) {
    const ageDays = differenceInCalendarDays(weekEnd, po.pgrd);
    return ageDays > RECENT_THRESHOLD_DAYS ? 'accumulated' : 'recent';
  }
  if (po.esd && po.esd > po.pgrd) return 'expected';
  return 'other'; // ordinary future order, not yet due, no ESD signal
}

// Running stock view, split by status per week (Recent / Accumulated / Expected) rather than one
// solid bar. Offsets 0-1 (last completed + current in-progress week) use real ASD data as it
// stands today; offsets 2+ additionally assume on-schedule clearance per booked ESD, since those
// weeks haven't happened yet. Operates over ALL lines (not just currently-open backlog) since a PO
// not yet backlog today can still enter backlog by a later week in this projection.
export function computeProjectionSeries(lines: PurchaseLine[], curWeek: number, curYear: number): ProjectionWeek[] {
  const byPO = groupByPO(lines);
  const pos: ProjectionPO[] = [];
  for (const poLines of byPO.values()) {
    const pgrd = poLines.find((l) => l.pgrd)?.pgrd ?? null;
    if (!pgrd) continue;
    const asd = poLines.find((l) => l.asd)?.asd ?? null;
    const esd = poLines.find((l) => l.esd)?.esd ?? null;
    pos.push({ pgrd, asd, esd });
  }

  const weeks: ProjectionWeek[] = [];
  for (let offset = 0; offset <= PROJECTION_FORWARD_WEEKS; offset++) {
    const { week, year } = shiftISOWeek(curWeek, curYear, offset);
    const { end: weekEnd } = weekRangeFor(week, year);
    const useEsdAssumption = offset >= 2;

    let recent = 0;
    let accumulated = 0;
    let expected = 0;
    for (const p of pos) {
      const status = statusAsOfWeek(p, weekEnd, useEsdAssumption);
      if (status === 'recent') recent += 1;
      else if (status === 'accumulated') accumulated += 1;
      else if (status === 'expected') expected += 1;
    }

    weeks.push({ label: `W${String(week).padStart(2, '0')}`, offset, recent, accumulated, expected, total: recent + accumulated, stackTotal: recent + accumulated + expected });
  }
  return weeks;
}

export function findOutliers(rows: BacklogPORow[], curWeek: number, curYear: number): BacklogPORow[] {
  const { week, year } = shiftISOWeek(curWeek, curYear, PROJECTION_FORWARD_WEEKS);
  const { end: windowEnd } = weekRangeFor(week, year);
  return rows.filter((r) => r.hasEsd && r.esd! > windowEnd);
}

export interface SupplierBacklogSummary {
  supplier: string;
  count: number;
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
  return [...bySupplier.entries()]
    .map(([supplier, poRows]) => ({
      supplier,
      count: poRows.length,
      avgAgeDays: Math.round(poRows.reduce((s, r) => s + r.ageDays, 0) / poRows.length),
      noEsdCount: poRows.filter((r) => !r.hasEsd).length,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface BacklogInsight {
  narrative: string;
}

// Auto-generated from current-state facts only (no week-over-week trend claim — see
// computeSupplierBacklogSummary's comment for why that isn't computable from this data source).
export function buildInsight(rows: BacklogPORow[], curWeek: number, curYear: number): BacklogInsight {
  const total = rows.length;
  if (total === 0) return { narrative: 'No backlog in scope.' };

  const { week, year } = shiftISOWeek(curWeek, curYear, PROJECTION_FORWARD_WEEKS);
  const { end: windowEnd } = weekRangeFor(week, year);
  const windowLabel = `W${String(week).padStart(2, '0')}`;
  const expectedToClear = rows.filter((r) => r.hasEsd && r.esd! <= windowEnd).length;
  const pctExpectedToClear = Math.round((expectedToClear / total) * 100);

  const bySupplier = new Map<string, number>();
  rows.forEach((r) => bySupplier.set(r.supplier, (bySupplier.get(r.supplier) ?? 0) + 1));
  const topSupplier = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])[0];

  const parts = [
    `${total} POs in backlog`,
    `${pctExpectedToClear}% expected to clear by ${windowLabel}`,
    topSupplier ? `${topSupplier[0]} currently carries the most backlog (${topSupplier[1]} POs)` : null,
  ].filter((p): p is string => p !== null);

  return { narrative: parts.join(' — ') };
}

export interface EtaEstimate {
  weeksToClear: number | null; // null when there's no measurable recent clearance pace
  avgClearancePerWeek: number;
}

const ETA_LOOKBACK_WEEKS = 4;

// Rough ETA: no-ESD backlog volume / recent average weekly clearance pace (any PO whose ASD
// landed in one of the last N completed weeks, regardless of what bucket it's in now). Unlike the
// supplier trend above, this only reads real ASD timestamps already present on today's records —
// it doesn't require reconstructing a past backlog LEVEL, so it holds up under the same live-data
// constraint. It would still undercount if cleared POs get archived out of the export entirely
// rather than just having ASD filled in place — worth confirming with the Dynamics export owner.
export function computeEtaEstimate(lines: PurchaseLine[], noEsdCount: number, curWeek: number, curYear: number): EtaEstimate {
  const byPO = groupByPO(lines);
  let cleared = 0;
  for (let offset = -(ETA_LOOKBACK_WEEKS - 1); offset <= 0; offset++) {
    const { week, year } = shiftISOWeek(curWeek, curYear, offset);
    const { start, end } = weekRangeFor(week, year);
    for (const poLines of byPO.values()) {
      const asd = poLines.find((l) => l.asd)?.asd;
      if (asd && asd >= start && asd <= end) cleared += 1;
    }
  }
  const avgClearancePerWeek = cleared / ETA_LOOKBACK_WEEKS;
  return {
    avgClearancePerWeek,
    weeksToClear: avgClearancePerWeek > 0 ? Math.ceil(noEsdCount / avgClearancePerWeek) : null,
  };
}

export function anchorWeek(): { week: number; year: number } {
  const { week, year } = lastCompletedWeek();
  return { week, year };
}
