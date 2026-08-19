import { aggregatePOReasons, type LineForAggregation } from './poReasonAggregation';
import { isSubstantiveReason, type ReasonCategory } from './reasonClassification';
import { getISOWeek, getISOWeekYear } from './dateUtils';
import { categorizeSKU, type SKUCategory } from './skuUtils';
import type { WeekInRange } from '../hooks/useFilters';
import type { PurchaseLine } from '../types';
import type { ClassificationEntry } from '../hooks/useReasonClassification';

export interface PORootCauseRow {
  po: string;
  supplier: string;
  week: WeekInRange | undefined;
  finalCategory: ReasonCategory | null;
  qty: number; // total qty across this PO's lines — the "quantity affected" basis (no cost/price
  // field exists anywhere in this app, so there's no monetary "value lost" to compute)
  rawReasons: string[];
}

// One row per PO (not per line) — same PO-level aggregation rollupByPO/aggregatePOReasons already
// uses for the dashboard's Root Cause card, reused here so the drill-down never introduces a
// second, inconsistent definition of "the PO's root cause".
export function computePORootCauseRows(
  lines: PurchaseLine[],
  classifications: Record<string, ClassificationEntry>,
  weeksInRange: WeekInRange[]
): PORootCauseRow[] {
  const linesForAgg: LineForAggregation[] = lines.map((l) => {
    const reason = l.lossReasonCode.trim();
    const category = isSubstantiveReason(reason) ? (classifications[reason]?.category ?? null) : null;
    return { po: l.po, line: l.line, qty: l.qty, rawReason: reason, category };
  });
  const poResults = aggregatePOReasons(linesForAgg);

  const byPO = new Map<string, PurchaseLine[]>();
  for (const l of lines) {
    if (!byPO.has(l.po)) byPO.set(l.po, []);
    byPO.get(l.po)!.push(l);
  }

  const rows: PORootCauseRow[] = [];
  for (const [po, poLines] of byPO) {
    const result = poResults.get(po);
    if (!result || !result.finalCategory) continue;
    const first = poLines[0];
    const week = first.pgrd
      ? weeksInRange.find((w) => w.week === getISOWeek(first.pgrd!) && w.year === getISOWeekYear(first.pgrd!))
      : undefined;
    const rawReasons = poLines
      .map((l) => l.lossReasonCode.trim())
      .filter((r) => isSubstantiveReason(r));
    const qty = poLines.reduce((s, l) => s + l.qty, 0);
    rows.push({ po, supplier: first.supplier, week, finalCategory: result.finalCategory, qty, rawReasons });
  }
  return rows;
}

export interface RootCauseKPIs {
  affectedLines: number; // raw line count with a substantive reason (data is at PO line level)
  qtyAffected: number;
  poCount: number;
  topCategory: ReasonCategory | null;
  topCategoryShare: number; // 0-100, share of poCount
}

export function computeRootCauseKPIs(rows: PORootCauseRow[], lines: PurchaseLine[]): RootCauseKPIs {
  const affectedLines = lines.filter((l) => isSubstantiveReason(l.lossReasonCode.trim())).length;
  const qtyAffected = rows.reduce((s, r) => s + r.qty, 0);
  const poCount = rows.length;

  const totals = new Map<ReasonCategory, number>();
  for (const r of rows) {
    if (!r.finalCategory) continue;
    totals.set(r.finalCategory, (totals.get(r.finalCategory) ?? 0) + 1);
  }

  let topCategory: ReasonCategory | null = null;
  let topCount = 0;
  for (const [cat, count] of totals) {
    if (count > topCount) { topCategory = cat; topCount = count; }
  }

  return {
    affectedLines,
    qtyAffected,
    poCount,
    topCategory,
    topCategoryShare: poCount > 0 ? Math.round((topCount / poCount) * 100) : 0,
  };
}

export interface CategoryRanking {
  category: ReasonCategory;
  count: number;
  pct: number;
}

// Pareto ranking — categories by total PO impact within whatever rows are in scope.
export function rankCategories(rows: PORootCauseRow[]): CategoryRanking[] {
  const totals = new Map<ReasonCategory, number>();
  for (const r of rows) {
    if (!r.finalCategory) continue;
    totals.set(r.finalCategory, (totals.get(r.finalCategory) ?? 0) + 1);
  }
  const total = rows.length;
  return [...totals.entries()]
    .map(([category, count]) => ({ category, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface SupplierCategoryMatrix {
  suppliers: string[]; // sorted by total impact, worst first
  categories: ReasonCategory[]; // sorted by total impact, worst first
  cellCount: (supplier: string, category: ReasonCategory) => number;
  maxCell: number;
}

// Supplier x Root Cause heatmap data — capped to the top suppliers/categories so the grid stays
// legible; everything still feeds the totals via all `rows`, only the grid itself is capped.
export function buildSupplierCategoryMatrix(rows: PORootCauseRow[], maxSuppliers = 10, maxCategories = 8): SupplierCategoryMatrix {
  const cells = new Map<string, number>();
  const supplierTotals = new Map<string, number>();
  const categoryTotals = new Map<ReasonCategory, number>();

  for (const r of rows) {
    if (!r.finalCategory) continue;
    const key = `${r.supplier}__${r.finalCategory}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    supplierTotals.set(r.supplier, (supplierTotals.get(r.supplier) ?? 0) + 1);
    categoryTotals.set(r.finalCategory, (categoryTotals.get(r.finalCategory) ?? 0) + 1);
  }

  const suppliers = [...supplierTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxSuppliers).map(([s]) => s);
  const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCategories).map(([c]) => c);
  const maxCell = Math.max(1, ...cells.values());

  return {
    suppliers,
    categories,
    cellCount: (supplier, category) => cells.get(`${supplier}__${category}`) ?? 0,
    maxCell,
  };
}

export type TrendDirection = 'up' | 'down' | 'flat';

// >10% change either way counts as a real trend; smaller moves are "flat". "up" means more
// flagged POs (worse), "down" means fewer (better) — the caller decides the color for that.
export function computeTrendDirection(currentCount: number, priorCount: number): TrendDirection {
  if (currentCount === 0 && priorCount === 0) return 'flat';
  const diff = currentCount - priorCount;
  const base = Math.max(priorCount, 1);
  const pctChange = (diff / base) * 100;
  if (pctChange > 10) return 'up';
  if (pctChange < -10) return 'down';
  return 'flat';
}

export interface LineDetailRow {
  po: string;
  line: number;
  supplier: string;
  week: WeekInRange | undefined;
  skuCategory: SKUCategory;
  shipDate: Date | null; // ASD if shipped, else ESD if booked, else null
  qty: number;
  aiCategory: ReasonCategory | null; // this line's OWN classified category (not the PO-level result)
  rawReason: string;
}

// True line-level rows (this app's actual data grain) — used for the grouped table's expansion
// and as the primary panel in the single-supplier deep-dive. Unlike PORootCauseRow, this is not
// aggregated to one-per-PO: every substantive-reason line gets its own row.
export function computeLineDetailRows(
  lines: PurchaseLine[],
  classifications: Record<string, ClassificationEntry>,
  weeksInRange: WeekInRange[]
): LineDetailRow[] {
  const mapped: (LineDetailRow | null)[] = lines.map((l) => {
    const reason = l.lossReasonCode.trim();
    if (!isSubstantiveReason(reason)) return null;
    const week = l.pgrd ? weeksInRange.find((w) => w.week === getISOWeek(l.pgrd!) && w.year === getISOWeekYear(l.pgrd!)) : undefined;
    return {
      po: l.po,
      line: l.line,
      supplier: l.supplier,
      week,
      skuCategory: categorizeSKU(l.sku),
      shipDate: l.asd ?? l.esd ?? null,
      qty: l.qty,
      aiCategory: classifications[reason]?.category ?? null,
      rawReason: reason,
    };
  });
  return mapped.filter((r): r is LineDetailRow => r !== null);
}
