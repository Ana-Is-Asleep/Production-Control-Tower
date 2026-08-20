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

// Expected is NOT backlog (PGRD hasn't passed yet) — it's a forward-looking early-warning bucket:
// PGRD in the future, with an ESD already booked for a date after that PGRD. Kept separate from
// the strict backlog membership rule above.
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
    if (!pgrd || pgrd >= today) continue; // PGRD must have passed
    const hasAnyASD = poLines.some((l) => l.asd);
    if (hasAnyASD) continue; // cleared

    const esd = poLines.find((l) => l.esd)?.esd ?? null;
    const egrd = poLines.find((l) => l.egrd)?.egrd ?? null;
    const ageDays = differenceInCalendarDays(today, pgrd);
    const reasonResult = poReasonResults.get(po);
    const rawReasons = poLines.map((l) => l.lossReasonCode.trim()).filter((r) => isSubstantiveReason(r));

    rows.push({
      po,
      supplier: poLines[0].supplier,
      warehouse: poLines[0].destination,
      pgrd,
      egrd,
      esd,
      qtyConfirmed: poLines.reduce((s, l) => s + l.cqty, 0),
      ageDays,
      ageBucket: ageDays <= RECENT_THRESHOLD_DAYS ? 'recent' : 'accumulated',
      hasEsd: esd !== null,
      esdPassedNoAsd: esd !== null && esd < today,
      rootCauseCategory: reasonResult?.finalCategory ?? null,
      rootCauseLabel: reasonResult?.finalCategory ? REASON_CATEGORY_LABELS[reasonResult.finalCategory] : null,
      rootCauseRawReasons: rawReasons,
    });
  }

  return rows.sort((a, b) => b.ageDays - a.ageDays);
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
  count: number;
}

// Stock view of backlog with an ESD booked (No-ESD is intentionally excluded — it's surfaced as
// its own standalone note instead). A PO counts as backlog in every week from when its PGRD
// passes through to whichever week it clears: offsets 0-1 (last completed + current in-progress
// week) use real ASD as it stands today; offsets 2+ additionally assume on-schedule clearance per
// booked ESD, since those weeks haven't happened yet.
export function computeProjectionSeries(lines: PurchaseLine[], curWeek: number, curYear: number): ProjectionWeek[] {
  const byPO = groupByPO(lines);
  const pos: { pgrd: Date; asd: Date | null; esd: Date }[] = [];
  for (const poLines of byPO.values()) {
    const pgrd = poLines.find((l) => l.pgrd)?.pgrd ?? null;
    const esd = poLines.find((l) => l.esd)?.esd ?? null;
    if (!pgrd || !esd) continue; // No-ESD excluded from the projection chart
    const asd = poLines.find((l) => l.asd)?.asd ?? null;
    pos.push({ pgrd, asd, esd });
  }

  const weeks: ProjectionWeek[] = [];
  for (let offset = 0; offset <= PROJECTION_FORWARD_WEEKS; offset++) {
    const { week, year } = shiftISOWeek(curWeek, curYear, offset);
    const { end: weekEnd } = weekRangeFor(week, year);
    const count = pos.filter((p) => {
      if (p.pgrd > weekEnd) return false; // hasn't entered backlog by this week
      const clearedReal = p.asd !== null && p.asd <= weekEnd;
      const clearedProjected = offset >= 2 && p.esd <= weekEnd;
      return !clearedReal && !clearedProjected;
    }).length;
    weeks.push({ label: `W${String(week).padStart(2, '0')}`, offset, count });
  }
  return weeks;
}

export function findOutliers(rows: BacklogPORow[], curWeek: number, curYear: number): BacklogPORow[] {
  const { week, year } = shiftISOWeek(curWeek, curYear, PROJECTION_FORWARD_WEEKS);
  const { end: windowEnd } = weekRangeFor(week, year);
  return rows.filter((r) => r.hasEsd && r.esd! > windowEnd);
}

export interface SupplierTrend {
  supplier: string;
  current: number;
  priorWeek: number;
  netChange: number;
  trailing: number[]; // last 6 weekly snapshots, oldest first, ending at last completed week
  classification: 'chronic' | 'spike' | 'improving' | 'stable';
}

const TRAILING_WEEKS = 6;

// Historical backlog level per supplier, computed the same way as the forward projection but
// looking backward with only real ASD data (every one of these weeks has already happened).
function backlogCountAsOfWeek(lines: PurchaseLine[], weekEnd: Date): Map<string, number> {
  const byPO = groupByPO(lines);
  const counts = new Map<string, number>();
  for (const poLines of byPO.values()) {
    const pgrd = poLines.find((l) => l.pgrd)?.pgrd ?? null;
    if (!pgrd || pgrd > weekEnd) continue;
    const asd = poLines.find((l) => l.asd)?.asd ?? null;
    if (asd && asd <= weekEnd) continue; // cleared by then
    const supplier = poLines[0].supplier;
    counts.set(supplier, (counts.get(supplier) ?? 0) + 1);
  }
  return counts;
}

export function computeSupplierTrends(lines: PurchaseLine[], curWeek: number, curYear: number, today: Date = new Date()): SupplierTrend[] {
  const snapshots: Map<string, number>[] = [];
  for (let offset = -(TRAILING_WEEKS - 1); offset <= 0; offset++) {
    const { week, year } = shiftISOWeek(curWeek, curYear, offset);
    const { end: weekEnd } = weekRangeFor(week, year);
    snapshots.push(backlogCountAsOfWeek(lines, weekEnd));
  }
  const currentCounts = backlogCountAsOfWeek(lines, today);

  const suppliers = new Set<string>();
  snapshots.forEach((m) => m.forEach((_, s) => suppliers.add(s)));
  currentCounts.forEach((_, s) => suppliers.add(s));

  const trends: SupplierTrend[] = [];
  for (const supplier of suppliers) {
    const trailing = snapshots.map((m) => m.get(supplier) ?? 0);
    const current = currentCounts.get(supplier) ?? 0;
    const priorWeek = trailing[trailing.length - 1];
    const netChange = current - priorWeek;

    const weeksElevated = trailing.filter((c) => c > 0).length;
    const earlierAvg = trailing.slice(0, -1).reduce((s, c) => s + c, 0) / Math.max(trailing.length - 1, 1);

    let classification: SupplierTrend['classification'];
    if (weeksElevated >= trailing.length - 1 && trailing.length > 1) classification = 'chronic';
    else if (netChange > 0 && current > earlierAvg * 2) classification = 'spike';
    else if (netChange < 0) classification = 'improving';
    else classification = 'stable';

    if (current > 0 || trailing.some((c) => c > 0)) {
      trends.push({ supplier, current, priorWeek, netChange, trailing, classification });
    }
  }

  return trends.sort((a, b) => b.netChange - a.netChange);
}

export interface BacklogInsight {
  narrative: string;
  growthPct: number | null;
}

// Auto-generated narrative from the underlying numbers — never hardcoded text.
export function buildInsight(rows: BacklogPORow[], trends: SupplierTrend[], today: Date = new Date()): BacklogInsight {
  const current = rows.length;
  const priorWeek = trends.reduce((s, t) => s + t.priorWeek, 0);
  const growthPct = priorWeek > 0 ? Math.round(((current - priorWeek) / priorWeek) * 100) : null;

  const growing = [...trends].filter((t) => t.netChange > 0).sort((a, b) => b.netChange - a.netChange).slice(0, 2);
  const driverText = growing.length
    ? `driven primarily by ${growing.map((t) => t.supplier).join(' and ')}`
    : 'with no single supplier standing out';

  // dominant root cause among currently-new (recent-bucket) entries with a classified reason
  const recentWithReason = rows.filter((r) => r.ageBucket === 'recent' && r.rootCauseCategory);
  const catCounts = new Map<ReasonCategory, number>();
  recentWithReason.forEach((r) => catCounts.set(r.rootCauseCategory!, (catCounts.get(r.rootCauseCategory!) ?? 0) + 1));
  const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const catText = topCat
    ? `${REASON_CATEGORY_LABELS[topCat[0]]} accounts for the largest share of new entries (${topCat[1]} of ${recentWithReason.length} classified).`
    : '';

  const trendWord = growthPct === null ? 'Backlog stands at' : growthPct > 0 ? `Backlog grew ${growthPct}% this week` : growthPct < 0 ? `Backlog shrank ${Math.abs(growthPct)}% this week` : 'Backlog held flat this week';

  const narrative = growthPct === null
    ? `Backlog stands at ${current} POs. ${catText}`.trim()
    : `${trendWord}, ${driverText}. ${catText}`.trim();

  return { narrative, growthPct };
}

export interface EtaEstimate {
  weeksToClear: number | null; // null when there's no measurable recent clearance pace
  avgClearancePerWeek: number;
}

const ETA_LOOKBACK_WEEKS = 4;

// Rough ETA: no-ESD backlog volume / recent average weekly clearance pace (any PO whose ASD
// landed in one of the last N completed weeks, regardless of what bucket it's in now).
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
