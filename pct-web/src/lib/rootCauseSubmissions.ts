import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { WeekInRange } from '../hooks/useFilters';
import type { PurchaseLine } from '../types';
import type { ActionItem, RootCauseReason } from '../types/actions';

export interface RootCauseSubmissionRow {
  po: string;
  supplier: string;
  week: WeekInRange | undefined;
  reason: RootCauseReason | null; // null = flagged (missed SOT) but SCM hasn't submitted an answer yet
  status: ActionItem['status'];
  qty: number;
  shipDate: Date | null; // ASD if shipped, else ESD if booked, else null
  lines: PurchaseLine[]; // this PO's own lines, for the expand-detail view
  // only populated when relevant to the submitted reason — see ActionItem for field meaning
  missingComponent?: string;
  missingComponentSupplier?: string;
  missingComponentPoNumber?: string;
  coverPoNumber?: string;
}

// One row per R002 (missed SOT) flag in scope. This is the page's real source of truth going
// forward — the SCM-submitted root cause replaces the old AI-classified/free-text loss-reason
// pipeline (computePORootCauseRows), per Ana's request that this be an analysis-only view driven
// by what SCMs actually answer, not inferred from raw data.
export function computeRootCauseSubmissionRows(
  actions: ActionItem[],
  lines: PurchaseLine[],
  weeksInRange: WeekInRange[],
  filteredPOs: Set<string>
): RootCauseSubmissionRow[] {
  const byPO = new Map<string, PurchaseLine[]>();
  for (const l of lines) {
    if (!byPO.has(l.po)) byPO.set(l.po, []);
    byPO.get(l.po)!.push(l);
  }

  const r002 = actions.filter(
    (a): a is ActionItem & { poReference: string } =>
      a.type === 'flag' && a.ruleKey === 'R002' && !!a.poReference && filteredPOs.has(a.poReference)
  );

  const rows: RootCauseSubmissionRow[] = [];
  for (const a of r002) {
    const poLines = byPO.get(a.poReference);
    if (!poLines || poLines.length === 0) continue;
    const first = poLines[0];
    const week = first.pgrd
      ? weeksInRange.find((w) => w.week === getISOWeek(first.pgrd!) && w.year === getISOWeekYear(first.pgrd!))
      : undefined;
    const qty = poLines.reduce((s, l) => s + l.qty, 0);
    rows.push({
      po: a.poReference,
      supplier: first.supplier,
      week,
      reason: a.rootCauseReason ?? null,
      status: a.status,
      qty,
      shipDate: first.asd ?? first.esd ?? null,
      lines: poLines,
      missingComponent: a.missingComponent,
      missingComponentSupplier: a.missingComponentSupplier,
      missingComponentPoNumber: a.missingComponentPoNumber,
      coverPoNumber: a.coverPoNumber,
    });
  }
  return rows;
}

export interface RootCauseSubmissionKPIs {
  flaggedPOs: number;
  pendingCount: number;
  qtyAffected: number;
  topReason: RootCauseReason | null;
  topReasonShare: number; // 0-100, share of SUBMITTED POs — pending rows have no reason to share
}

export function computeSubmissionKPIs(rows: RootCauseSubmissionRow[]): RootCauseSubmissionKPIs {
  const submitted = rows.filter((r) => r.reason);
  const totals = new Map<RootCauseReason, number>();
  for (const r of submitted) totals.set(r.reason!, (totals.get(r.reason!) ?? 0) + 1);

  let topReason: RootCauseReason | null = null;
  let topCount = 0;
  for (const [reason, count] of totals) {
    if (count > topCount) { topReason = reason; topCount = count; }
  }

  return {
    flaggedPOs: rows.length,
    pendingCount: rows.length - submitted.length,
    qtyAffected: rows.reduce((s, r) => s + r.qty, 0),
    topReason,
    topReasonShare: submitted.length > 0 ? Math.round((topCount / submitted.length) * 100) : 0,
  };
}

export interface ReasonRanking {
  category: RootCauseReason;
  count: number;
  pct: number;
}

// Pareto ranking — submitted rows only; pct is share of submitted POs, so it reads as "of the
// answers we have so far" rather than being diluted by however many are still pending.
export function rankReasons(rows: RootCauseSubmissionRow[]): ReasonRanking[] {
  const submitted = rows.filter((r) => r.reason);
  const totals = new Map<RootCauseReason, number>();
  for (const r of submitted) totals.set(r.reason!, (totals.get(r.reason!) ?? 0) + 1);
  const total = submitted.length;
  return [...totals.entries()]
    .map(([category, count]) => ({ category, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface SupplierReasonMatrix {
  suppliers: string[];
  categories: RootCauseReason[];
  cellCount: (supplier: string, category: RootCauseReason) => number;
  maxCell: number;
}

// Supplier x Root Cause heatmap data, same shape/capping approach as the old
// buildSupplierCategoryMatrix — capped to the top suppliers/reasons so the grid stays legible.
export function buildSupplierReasonMatrix(rows: RootCauseSubmissionRow[], maxSuppliers = 10, maxCategories = 8): SupplierReasonMatrix {
  const submitted = rows.filter((r) => r.reason);
  const cells = new Map<string, number>();
  const supplierTotals = new Map<string, number>();
  const reasonTotals = new Map<RootCauseReason, number>();

  for (const r of submitted) {
    const key = `${r.supplier}__${r.reason}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    supplierTotals.set(r.supplier, (supplierTotals.get(r.supplier) ?? 0) + 1);
    reasonTotals.set(r.reason!, (reasonTotals.get(r.reason!) ?? 0) + 1);
  }

  const suppliers = [...supplierTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxSuppliers).map(([s]) => s);
  const categories = [...reasonTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCategories).map(([c]) => c);
  const maxCell = Math.max(1, ...cells.values());

  return {
    suppliers,
    categories,
    cellCount: (supplier, category) => cells.get(`${supplier}__${category}`) ?? 0,
    maxCell,
  };
}
