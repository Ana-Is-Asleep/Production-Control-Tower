import {
  differenceInCalendarDays, startOfISOWeek, endOfISOWeek, addWeeks, getISOWeek, getISOWeekYear,
  startOfMonth, endOfMonth, addMonths, startOfQuarter, endOfQuarter, addQuarters, format,
} from 'date-fns';
import { categorizeSKU, type SKUCategory } from './skuUtils';
import { getChannel, type Channel } from './channelUtils';
import type { PurchaseLine } from '../types';

// Lead time here always means Order Date -> Actual Shipping Date (the "production lead time"
// basis already used elsewhere in this app) at PO-header level: a PO's lead time is its LATEST
// ASD across its own lines minus its Order Date, not any one line's individual lead time.
export const LT_TARGET_DAYS = 30;

export type LTPeriod = 'weeks' | 'months' | 'quarters';
export type LTView = 'General' | 'Category' | 'Supplier';
export type LTHeatmapRows = 'Category' | 'Supplier';
export type LTPOSet = 'all' | 'delayed';

export interface LTBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

export function buildBuckets(from: Date, to: Date, period: LTPeriod): LTBucket[] {
  const buckets: LTBucket[] = [];
  if (period === 'weeks') {
    let cursor = startOfISOWeek(from);
    const last = startOfISOWeek(to);
    for (let guard = 0; cursor.getTime() <= last.getTime() && guard < 600; guard++) {
      const week = getISOWeek(cursor);
      const year = getISOWeekYear(cursor);
      buckets.push({ key: `W${year}-${week}`, label: `W${String(week).padStart(2, '0')} '${String(year).slice(2)}`, start: cursor, end: endOfISOWeek(cursor) });
      cursor = addWeeks(cursor, 1);
    }
  } else if (period === 'months') {
    let cursor = startOfMonth(from);
    const last = startOfMonth(to);
    for (let guard = 0; cursor.getTime() <= last.getTime() && guard < 400; guard++) {
      buckets.push({ key: `M${cursor.getFullYear()}-${cursor.getMonth()}`, label: format(cursor, "MMM ''yy"), start: cursor, end: endOfMonth(cursor) });
      cursor = addMonths(cursor, 1);
    }
  } else {
    let cursor = startOfQuarter(from);
    const last = startOfQuarter(to);
    for (let guard = 0; cursor.getTime() <= last.getTime() && guard < 200; guard++) {
      const q = Math.floor(cursor.getMonth() / 3);
      buckets.push({ key: `Q${cursor.getFullYear()}-${q}`, label: `Q${q + 1} '${String(cursor.getFullYear()).slice(2)}`, start: cursor, end: endOfQuarter(cursor) });
      cursor = addQuarters(cursor, 1);
    }
  }
  return buckets;
}

export function bucketKeyForDate(date: Date, period: LTPeriod): string {
  if (period === 'weeks') return `W${getISOWeekYear(date)}-${getISOWeek(date)}`;
  if (period === 'months') return `M${date.getFullYear()}-${date.getMonth()}`;
  return `Q${date.getFullYear()}-${Math.floor(date.getMonth() / 3)}`;
}

interface HeaderGroup<D> {
  po: string;
  supplier: string;
  order: Date;
  end: Date;
  dim: D;
  lines: PurchaseLine[];
}

// Groups lines into PO-header records, one per (PO, dimension) combination — a PO with lines in
// two categories contributes one header row to each category's aggregation, each using only that
// category's own lines for the "latest ASD" calculation. Lines without both an Order Date and an
// ASD can't be scored yet and are skipped (matches the rest of the app's canScore convention).
function groupPOHeaders<D>(lines: PurchaseLine[], dimOf: (l: PurchaseLine) => D, dimKey: (d: D) => string): Map<string, HeaderGroup<D>> {
  const groups = new Map<string, HeaderGroup<D>>();
  for (const l of lines) {
    if (!l.orderDate || !l.asd) continue;
    const dim = dimOf(l);
    const key = `${l.po}|${dimKey(dim)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { po: l.po, supplier: l.supplier, order: l.orderDate, end: l.asd, dim, lines: [l] });
    } else {
      existing.lines.push(l);
      if (l.asd.getTime() > existing.end.getTime()) existing.end = l.asd;
    }
  }
  return groups;
}

// Sanity clamp matching the rest of the app's lead-time handling — a PO can't have a negative
// lead time, and anything past a year is almost certainly a data issue, not a real lead time.
function leadDaysOf(g: { order: Date; end: Date }): number | null {
  const lead = differenceInCalendarDays(g.end, g.order);
  if (lead <= 0 || lead > 365) return null;
  return lead;
}

export interface OverviewPoint {
  bucketKey: string;
  label: string;
  byCategory: Partial<Record<SKUCategory, number | null>>;
  overall: number | null;
}

// Two independent aggregations feed one chart: the per-category bars group POs by (PO, category)
// so a multi-category PO counts once per category it touches; the "Overall" line groups POs by PO
// alone (all of a PO's lines together), so it reflects true PO-level lead time, not a re-derived
// average of the category bars.
export function computeOverviewSeries(lines: PurchaseLine[], buckets: LTBucket[], period: LTPeriod, categories: SKUCategory[]): OverviewPoint[] {
  const keySet = new Set(buckets.map((b) => b.key));

  const catGroups = groupPOHeaders(lines, (l) => categorizeSKU(l.sku), (c) => c);
  const catSum = new Map<string, number>();
  const catCount = new Map<string, number>();
  catGroups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    const bk = bucketKeyForDate(g.end, period);
    if (!keySet.has(bk)) return;
    const k = `${bk}|${g.dim}`;
    catSum.set(k, (catSum.get(k) ?? 0) + lead);
    catCount.set(k, (catCount.get(k) ?? 0) + 1);
  });

  const overallGroups = groupPOHeaders(lines, () => 0, () => '0');
  const overallSum = new Map<string, number>();
  const overallCount = new Map<string, number>();
  overallGroups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    const bk = bucketKeyForDate(g.end, period);
    if (!keySet.has(bk)) return;
    overallSum.set(bk, (overallSum.get(bk) ?? 0) + lead);
    overallCount.set(bk, (overallCount.get(bk) ?? 0) + 1);
  });

  return buckets.map((b) => {
    const byCategory: Partial<Record<SKUCategory, number | null>> = {};
    categories.forEach((c) => {
      const k = `${b.key}|${c}`;
      const count = catCount.get(k);
      byCategory[c] = count ? Math.round((catSum.get(k)! / count) * 10) / 10 : null;
    });
    const oCount = overallCount.get(b.key);
    return { bucketKey: b.key, label: b.label, byCategory, overall: oCount ? Math.round((overallSum.get(b.key)! / oCount) * 10) / 10 : null };
  });
}

export interface LTKpis {
  currentLeadTime: number | null;
  currentBucketLabel: string;
  vsTargetDays: number | null;
  trendVsPrevDays: number | null;
  pctPeriodsUnderTarget: number;
  periodsUnderTarget: number;
  periodsPresent: number;
}

export function computeLTKpis(overview: OverviewPoint[]): LTKpis {
  const present = overview.map((p, i) => ({ v: p.overall, i })).filter((o): o is { v: number; i: number } => o.v !== null);
  const last = present.length ? present[present.length - 1] : null;
  const prev = present.length > 1 ? present[present.length - 2] : null;
  const cur = last ? last.v : null;
  const under = present.filter((o) => o.v <= LT_TARGET_DAYS).length;

  return {
    currentLeadTime: cur,
    currentBucketLabel: overview.length ? overview[overview.length - 1].label : '',
    vsTargetDays: cur !== null ? Math.round((cur - LT_TARGET_DAYS) * 10) / 10 : null,
    trendVsPrevDays: cur !== null && prev ? Math.round((cur - prev.v) * 10) / 10 : null,
    pctPeriodsUnderTarget: present.length ? Math.round((under / present.length) * 100) : 0,
    periodsUnderTarget: under,
    periodsPresent: present.length,
  };
}

export interface HeatmapCell {
  rowKey: string;
  bucketKey: string;
  avg: number;
  count: number;
}

export interface HeatmapData {
  rows: string[]; // ranked by total PO count, worst/most-active first
  cells: HeatmapCell[];
}

// "Delayed POs" scopes the heatmap to only the PO-groups that missed the 30-day target — showing
// how bad the delayed ones are, not diluted by the ones that were already on time.
export function computeHeatmap(lines: PurchaseLine[], buckets: LTBucket[], period: LTPeriod, rowsBy: LTHeatmapRows, poSet: LTPOSet): HeatmapData {
  const keySet = new Set(buckets.map((b) => b.key));
  const dimOf = rowsBy === 'Category' ? (l: PurchaseLine) => categorizeSKU(l.sku) as string : (l: PurchaseLine) => l.supplier;
  const groups = groupPOHeaders(lines, dimOf, (d) => d);

  const cellMap = new Map<string, { sum: number; count: number }>();
  const rowTotals = new Map<string, number>();
  groups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    if (poSet === 'delayed' && lead <= LT_TARGET_DAYS) return;
    const bk = bucketKeyForDate(g.end, period);
    if (!keySet.has(bk)) return;
    const k = `${bk}|${g.dim}`;
    const cell = cellMap.get(k) ?? { sum: 0, count: 0 };
    cell.sum += lead;
    cell.count += 1;
    cellMap.set(k, cell);
    rowTotals.set(g.dim, (rowTotals.get(g.dim) ?? 0) + 1);
  });

  const rows = [...rowTotals.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  const cells: HeatmapCell[] = [];
  cellMap.forEach((v, k) => {
    const [bucketKey, rowKey] = k.split('|');
    cells.push({ rowKey, bucketKey, avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count });
  });

  return { rows, cells };
}

export const skuGroupOf = (sku: string) => sku.slice(0, 5).toUpperCase();
export const skuVariationOf = (sku: string) => sku.slice(-3).toUpperCase();

export interface SupplierSeriesPoint {
  bucketKey: string;
  label: string;
  bySupplier: Record<string, number | null>;
}

export interface SupplierSeries {
  suppliers: string[]; // top N by PO count, ranked
  totalSuppliers: number;
  points: SupplierSeriesPoint[];
}

// Per-SKU-group card on the SKU tab: compares suppliers' average lead time over the same buckets,
// capped to the top 8 suppliers by PO count so the chart stays legible.
export function computeSupplierSeries(lines: PurchaseLine[], buckets: LTBucket[], period: LTPeriod, maxSuppliers = 8): SupplierSeries {
  const keySet = new Set(buckets.map((b) => b.key));
  const groups = groupPOHeaders(lines, (l) => l.supplier, (s) => s);

  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  const supplierTotals = new Map<string, number>();
  groups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    const bk = bucketKeyForDate(g.end, period);
    if (!keySet.has(bk)) return;
    const k = `${bk}|${g.dim}`;
    sum.set(k, (sum.get(k) ?? 0) + lead);
    count.set(k, (count.get(k) ?? 0) + 1);
    supplierTotals.set(g.dim, (supplierTotals.get(g.dim) ?? 0) + 1);
  });

  const ranked = [...supplierTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const suppliers = ranked.slice(0, maxSuppliers);

  const points = buckets.map((b) => {
    const bySupplier: Record<string, number | null> = {};
    suppliers.forEach((s) => {
      const k = `${b.key}|${s}`;
      const c = count.get(k);
      bySupplier[s] = c ? Math.round((sum.get(k)! / c) * 10) / 10 : null;
    });
    return { bucketKey: b.key, label: b.label, bySupplier };
  });

  return { suppliers, totalSuppliers: ranked.length, points };
}

export interface DrillRow {
  po: string;
  supplier: string;
  categories: SKUCategory[];
  channel: Channel | 'Mixed';
  orderDate: Date;
  endDate: Date;
  leadDays: number;
  lines: PurchaseLine[]; // this PO's own lines — for expandable line-level detail
}

// Underlying PO rows behind a clicked bar/cell — bucketed the same way as whatever chart the user
// clicked on (dimFilter narrows to one category/supplier when the click came from a per-dim series).
export function computeDrillRows(
  lines: PurchaseLine[],
  bucket: LTBucket,
  period: LTPeriod,
  dim?: { by: 'Category' | 'Supplier'; value: string }
): DrillRow[] {
  const scoped = dim
    ? lines.filter((l) => (dim.by === 'Category' ? categorizeSKU(l.sku) === dim.value : l.supplier === dim.value))
    : lines;

  const groups = groupPOHeaders(scoped, () => 0, () => '0');
  const rows: DrillRow[] = [];
  groups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    if (bucketKeyForDate(g.end, period) !== bucket.key) return;
    const categories = [...new Set(g.lines.map((l) => categorizeSKU(l.sku)))];
    const channels = [...new Set(g.lines.map((l) => getChannel(l.destination)))];
    rows.push({
      po: g.po,
      supplier: g.supplier,
      categories,
      channel: channels.length > 1 ? 'Mixed' : channels[0],
      orderDate: g.order,
      endDate: g.end,
      leadDays: lead,
      lines: g.lines,
    });
  });

  return rows.sort((a, b) => b.leadDays - a.leadDays);
}

export interface PeriodSummary {
  bucketKey: string;
  label: string;
  poCount: number;
  avgLeadDays: number | null;
  vsTargetDays: number | null;
  meetingTarget: boolean | null; // null when no scored POs in that period
}

// One row per period — Recent Periods Detail table. Reuses the exact same PO-level (latest ASD)
// grouping as every other Lead Time view; this is packaging, not a new calculation.
export function computePeriodsSummary(lines: PurchaseLine[], buckets: LTBucket[], period: LTPeriod): PeriodSummary[] {
  const keySet = new Set(buckets.map((b) => b.key));
  const groups = groupPOHeaders(lines, () => 0, () => '0');

  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  groups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    const bk = bucketKeyForDate(g.end, period);
    if (!keySet.has(bk)) return;
    sum.set(bk, (sum.get(bk) ?? 0) + lead);
    count.set(bk, (count.get(bk) ?? 0) + 1);
  });

  return buckets.map((b) => {
    const c = count.get(b.key) ?? 0;
    const avg = c ? Math.round((sum.get(b.key)! / c) * 10) / 10 : null;
    return {
      bucketKey: b.key,
      label: b.label,
      poCount: c,
      avgLeadDays: avg,
      vsTargetDays: avg !== null ? Math.round((avg - LT_TARGET_DAYS) * 10) / 10 : null,
      meetingTarget: avg !== null ? avg <= LT_TARGET_DAYS : null,
    };
  });
}

export interface LeadTimeDistributionBucket {
  label: string;
  count: number;
  pct: number;
}

export interface LeadTimeDistribution {
  bucketLabel: string;
  total: number;
  buckets: LeadTimeDistributionBucket[];
}

const DISTRIBUTION_RANGES: { label: string; max: number | null }[] = [
  { label: '0–20 days', max: 20 },
  { label: '21–30 days', max: 30 },
  { label: '31–45 days', max: 45 },
  { label: '46–60 days', max: 60 },
  { label: '> 60 days', max: null },
];

// Severity distribution for one period (the latest completed one, by default) — same per-PO lead
// days used everywhere else on this page, just bucketed by magnitude instead of averaged.
export function computeLeadTimeDistribution(lines: PurchaseLine[], bucket: LTBucket, period: LTPeriod): LeadTimeDistribution {
  const groups = groupPOHeaders(lines, () => 0, () => '0');
  const counts = DISTRIBUTION_RANGES.map(() => 0);
  let total = 0;

  groups.forEach((g) => {
    const lead = leadDaysOf(g);
    if (lead === null) return;
    if (bucketKeyForDate(g.end, period) !== bucket.key) return;
    total += 1;
    const idx = DISTRIBUTION_RANGES.findIndex((r) => r.max === null || lead <= r.max);
    counts[idx === -1 ? counts.length - 1 : idx] += 1;
  });

  return {
    bucketLabel: bucket.label,
    total,
    buckets: DISTRIBUTION_RANGES.map((r, i) => ({ label: r.label, count: counts[i], pct: total ? Math.round((counts[i] / total) * 100) : 0 })),
  };
}
