// Report builders — the ONLY thing this file does is call into the already-approved calculation
// functions each dashboard/drill-down uses (kpiFormulas, poAggregation, backlogAggregation,
// missingEsdAggregation, rootCauseAggregation, leadTimeUtils, invoiceUtils) and reshape their
// output into a report's KPI cards / tables / Excel sheets. No KPI logic is redefined here — if a
// number shown in Reports ever needs to change, the fix belongs in the lib file that owns that
// calculation, not here.

import { rollupByPO, type PORollup } from './poAggregation';
import { aggregateSOTRate, aggregateOTIFRate, type IsChinaSupplier } from './kpiFormulas';
import {
  computeBacklogRows, computeExpectedRows, computeAgeBands, computeClearanceForecast,
  computeExpectedByPgrdWeek, computeSupplierBacklogSummary,
} from './backlogAggregation';
import { computeMissingEsdRows, computeEgrdWeekBuckets, computeSupplierExposure } from './missingEsdAggregation';
import { computePORootCauseRows, computeRootCauseKPIs, rankCategories } from './rootCauseAggregation';
import { REASON_CATEGORY_LABELS } from './reasonClassification';
import { summariseLeadTimes } from './leadTimeUtils';
import { computeKPIs as computeInvoiceKPIs, supplierBreakdown, filterByChannel, filterBySupplierNames } from './invoiceUtils';
import { getISOWeek, getISOWeekYear, currentISOWeek } from './dateUtils';
import { categorizeSKU } from './skuUtils';
import { getChannel } from './channelUtils';
import type { WeekInRange, ActiveFilters } from '../hooks/useFilters';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';
import type { ClassificationEntry } from '../hooks/useReasonClassification';
import type { SheetDef, CellValue, ChartDef, StyledCell } from './xlsxWriter';

// ---------------------------------------------------------------------------
// Excel presentation helpers — pure formatting, never business logic. Every value passed in here
// already came from an approved calculation function; these only decide how that value is typed
// and styled once it lands in a workbook cell (real date vs. text, fraction vs. "90%" string, etc).
// ---------------------------------------------------------------------------

function dateCell(d: Date | null | undefined): StyledCell {
  return { value: d ?? null, style: 'date' };
}

function pctCell(v: number | string | null | undefined): StyledCell {
  if (v === null || v === undefined || v === '—' || typeof v !== 'number') return { value: '—', style: 'tableCell' };
  return { value: v / 100, style: 'percent' };
}

function intCell(v: number | string | null | undefined): StyledCell {
  if (v === null || v === undefined || v === '—' || typeof v !== 'number') return { value: v ?? '—', style: 'tableCell' };
  return { value: v, style: 'integer' };
}

function currencyCell(v: number | string | null | undefined): StyledCell {
  if (v === null || v === undefined || v === '—' || typeof v !== 'number') return { value: v ?? '—', style: 'tableCell' };
  return { value: v, style: 'currency' };
}

function statusCell(label: string, pass: boolean | null): StyledCell {
  return { value: label, style: pass === null ? 'statusNeutral' : pass ? 'statusPass' : 'statusFail' };
}

export interface ReportKpi {
  label: string;
  value: string;
  tint?: 'pass' | 'fail' | 'warn' | 'neutral';
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportResult {
  contextLabel: string;
  kpis: ReportKpi[];
  tables: ReportTable[];
  sheets: SheetDef[];
}

export interface ReportContext {
  filteredLines: PurchaseLine[]; // supplier/category/channel filtered, NOT week-range restricted
  weekRangeLines: PurchaseLine[]; // filteredLines further restricted to the active week range
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
  invoices: InvoiceRow[];
  classifications: Record<string, ClassificationEntry>;
  filterLabel: string;
  filters: ActiveFilters;
}

function linesForWeek(lines: PurchaseLine[], w: WeekInRange): PurchaseLine[] {
  return lines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === w.week && getISOWeekYear(l.pgrd) === w.year);
}

function poRowsSheet(rollups: PORollup[]): SheetDef {
  const header: CellValue[] = ['PO', 'Supplier', 'PGRD', 'EGRD', 'ESD', 'ASD', 'SOT', 'OTIF'].map((v) => ({ value: v, style: 'tableHeader' }));
  const rows: CellValue[][] = [header];
  rollups.forEach((r) => rows.push([
    { value: r.po, style: 'tableCell' }, { value: r.supplier, style: 'tableCell' },
    dateCell(r.pgrd), dateCell(r.egrd), dateCell(r.esd), dateCell(r.asd),
    statusCell(r.sot === null ? '—' : r.sot ? 'SOT' : 'Not SOT', r.sot),
    statusCell(r.otif === null ? '—' : r.otif ? 'OTIF' : 'Not OTIF', r.otif),
  ]));
  return { name: 'PO Detail', rows, freezeHeaderRow: true, autoFilter: true, colWidths: [14, 24, 12, 12, 12, 12, 10, 10] };
}

// KPI cards laid out 3-per-row, matching the "how it works" Excel-quality target (white card-like
// summary areas, not a plain two-column KPI/Value list).
function kpiCardsRows(kpis: ReportKpi[]): CellValue[][] {
  const rows: CellValue[][] = [];
  const perRow = 4;
  for (let i = 0; i < kpis.length; i += perRow) {
    const chunk = kpis.slice(i, i + perRow);
    const labelRow: CellValue[] = [];
    const valueRow: CellValue[] = [];
    chunk.forEach((k) => {
      labelRow.push({ value: k.label, style: 'kpiLabel' });
      const valueStyle = k.tint === 'pass' ? 'kpiValuePass' : k.tint === 'fail' ? 'kpiValueFail' : k.tint === 'warn' ? 'kpiValueWarn' : 'kpiValue';
      valueRow.push({ value: k.value, style: valueStyle });
    });
    rows.push(labelRow, valueRow, []);
  }
  return rows;
}

function summarySheet(reportName: string, filterLabel: string, kpis: ReportKpi[]): SheetDef {
  const rows: CellValue[][] = [
    [{ value: reportName, style: 'title' }],
    [{ value: `Generated ${new Date().toLocaleString()}`, style: 'subtitle' }],
    [{ value: `Filters: ${filterLabel}`, style: 'subtitle' }],
    [],
    ...kpiCardsRows(kpis),
  ];
  return { name: 'Summary', rows, colWidths: [22, 22, 22, 22] };
}

// Generic detail-sheet builder — auto-styles by JS type (Date -> real Excel date, number ->
// thousands-formatted, else plain text) so every "PO Detail"/"Line Detail" sheet gets header
// styling, a frozen header row and a filter without each report builder repeating the boilerplate.
export function detailSheet(name: string, columns: string[], rows: (string | number | Date | null | undefined)[][]): SheetDef {
  const header: CellValue[] = columns.map((c) => ({ value: c, style: 'tableHeader' }));
  const body: CellValue[][] = rows.map((r) => r.map((v): CellValue => {
    if (v instanceof Date) return dateCell(v);
    if (typeof v === 'number') return intCell(v);
    return { value: v ?? '—', style: 'tableCell' };
  }));
  return { name, rows: [header, ...body], freezeHeaderRow: true, autoFilter: true };
}

function tableSheet(t: ReportTable): SheetDef {
  const header: CellValue[] = t.columns.map((c) => ({ value: c, style: 'tableHeader' }));
  const rows: CellValue[][] = [header, ...t.rows.map((r) => r.map((v): CellValue => {
    if (typeof v === 'string' && v.endsWith('%')) return pctCell(Number(v.slice(0, -1)));
    if (typeof v === 'number') return intCell(v);
    return { value: v, style: 'tableCell' };
  }))];
  return { name: t.title, rows, freezeHeaderRow: true, autoFilter: true };
}

// A native Excel chart bound to the Weekly Evolution sheet's own cells (columns: Week, POs,
// SOT %, OTIF %) — not a pasted image, so it stays live if the sheet is edited.
function sotOtifChart(weeklyTable: ReportTable): ChartDef {
  const lastRow = weeklyTable.rows.length + 1; // header occupies row 1
  const sheetRef = `'${weeklyTable.title}'`;
  return {
    type: 'line',
    title: 'SOT & OTIF Weekly Evolution',
    categoryRange: `${sheetRef}!$A$2:$A$${lastRow}`,
    series: [
      { name: 'SOT %', valueRange: `${sheetRef}!$C$2:$C$${lastRow}` },
      { name: 'OTIF %', valueRange: `${sheetRef}!$D$2:$D$${lastRow}` },
    ],
    anchorRow: 8,
  };
}

// Shared SOT/OTIF core — used by both "SOT & OTIF Performance" (weekly-first) and "Supplier
// Performance" (supplier-first) since they're the same underlying calculation, just presented in a
// different order. Reuses aggregateSOTRate/aggregateOTIFRate/rollupByPO exactly as the SOT/OTIF
// drill-down does — no separate definition.
function computeSotOtifCore(ctx: ReportContext) {
  const lines = ctx.weekRangeLines;
  const rollups = rollupByPO(lines, ctx.isChinaSupplier, ctx.today);
  const sot = aggregateSOTRate(lines, ctx.isChinaSupplier, ctx.today);
  const otif = aggregateOTIFRate(lines, ctx.isChinaSupplier);
  const onTime = rollups.filter((r) => r.sot === true).length;
  const late = rollups.filter((r) => r.sot === false).length;

  const weeklyTable: ReportTable = {
    title: 'Weekly Evolution',
    columns: ['Week', 'POs', 'SOT %', 'OTIF %'],
    rows: ctx.weeksInRange.map((w) => {
      const wLines = linesForWeek(lines, w);
      const poCount = new Set(wLines.map((l) => l.po)).size;
      return [w.label, poCount, aggregateSOTRate(wLines, ctx.isChinaSupplier, ctx.today) ?? '—', aggregateOTIFRate(wLines, ctx.isChinaSupplier) ?? '—'];
    }),
  };

  const bySupplier = new Map<string, PORollup[]>();
  rollups.forEach((r) => {
    if (!bySupplier.has(r.supplier)) bySupplier.set(r.supplier, []);
    bySupplier.get(r.supplier)!.push(r);
  });
  const supplierTable: ReportTable = {
    title: 'Supplier Scorecard',
    columns: ['Supplier', 'POs', 'SOT %', 'OTIF %'],
    rows: [...bySupplier.entries()]
      .map(([supplier, poRows]) => {
        const supplierLines = lines.filter((l) => l.supplier === supplier);
        return [supplier, poRows.length, aggregateSOTRate(supplierLines, ctx.isChinaSupplier, ctx.today) ?? '—', aggregateOTIFRate(supplierLines, ctx.isChinaSupplier) ?? '—'] as (string | number)[];
      })
      .sort((a, b) => (b[1] as number) - (a[1] as number)),
  };

  const kpis: ReportKpi[] = [
    { label: 'POs in Scope', value: String(rollups.length) },
    { label: 'SOT %', value: sot === null ? '—' : `${sot}%`, tint: sot === null ? 'neutral' : sot >= 90 ? 'pass' : 'fail' },
    { label: 'OTIF %', value: otif === null ? '—' : `${otif}%`, tint: otif === null ? 'neutral' : otif >= 90 ? 'pass' : 'fail' },
    { label: 'On Time POs', value: String(onTime), tint: 'pass' },
    { label: 'Late POs', value: String(late), tint: late > 0 ? 'fail' : 'neutral' },
    { label: 'Target (Both)', value: '90%' },
  ];

  return { rollups, weeklyTable, supplierTable, kpis };
}

export function buildSotOtifReport(ctx: ReportContext): ReportResult {
  const { rollups, weeklyTable, supplierTable, kpis } = computeSotOtifCore(ctx);
  const tables = [weeklyTable, supplierTable];
  const summary = summarySheet('SOT & OTIF Performance', ctx.filterLabel, kpis);
  if (weeklyTable.rows.length > 0) summary.charts = [sotOtifChart(weeklyTable)];
  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables,
    sheets: [summary, ...tables.map(tableSheet), poRowsSheet(rollups)],
  };
}

export function buildSupplierPerformanceReport(ctx: ReportContext): ReportResult {
  const { rollups, weeklyTable, supplierTable, kpis } = computeSotOtifCore(ctx);
  const tables = [supplierTable, weeklyTable];
  const summary = summarySheet('Supplier Performance', ctx.filterLabel, kpis);
  if (weeklyTable.rows.length > 0) summary.charts = [sotOtifChart(weeklyTable)];
  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables,
    sheets: [summary, ...tables.map(tableSheet), poRowsSheet(rollups)],
  };
}

export function buildMissingEsdReport(ctx: ReportContext): ReportResult {
  const rows = computeMissingEsdRows(ctx.filteredLines);
  const needingAction = rows.filter((r) => r.urgency !== 'watchlist');
  const notUrgent = rows.filter((r) => r.urgency === 'watchlist');
  const { week: curWeek, year: curYear } = currentISOWeek();
  const buckets = computeEgrdWeekBuckets(rows, curWeek, curYear);
  const exposure = computeSupplierExposure(rows, 10);

  const kpis: ReportKpi[] = [
    { label: 'Needing Action', value: String(needingAction.length), tint: 'fail' },
    { label: 'Not Urgent', value: String(notUrgent.length), tint: 'neutral' },
    { label: 'Total Missing ESD', value: String(rows.length) },
  ];

  const bucketTable: ReportTable = { title: 'By EGRD Week', columns: ['Period', 'POs'], rows: buckets.map((b) => [b.label, b.count]) };
  const exposureTable: ReportTable = {
    title: 'Supplier Exposure',
    columns: ['Supplier', 'Missing ESD', 'Needing Action', 'Not Urgent'],
    rows: exposure.top.map((s) => [s.supplier, s.total, s.needingAction, s.notUrgent]),
  };
  const poSheet = detailSheet('PO Detail', ['PO', 'Supplier', 'Warehouse', 'PGRD', 'EGRD', 'Status', 'Days'],
    rows.map((r) => [r.po, r.supplier, r.warehouse, r.pgrd, r.egrd, r.urgency, r.daysUntilEgrd ?? '—']));

  const tables = [bucketTable, exposureTable];
  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables,
    sheets: [summarySheet('Missing ESD', ctx.filterLabel, kpis), ...tables.map(tableSheet), poSheet],
  };
}

export function buildBacklogOverviewReport(ctx: ReportContext): ReportResult {
  const rows = computeBacklogRows(ctx.filteredLines, ctx.today);
  const expectedRows = computeExpectedRows(ctx.filteredLines, ctx.today);
  const ageBands = computeAgeBands(rows);
  const { week: curWeek, year: curYear } = currentISOWeek();
  const forecast = computeClearanceForecast(rows, curWeek, curYear);
  const expectedByWeek = computeExpectedByPgrdWeek(expectedRows, curWeek, curYear);
  const avgAgeDays = rows.length ? Math.round(rows.reduce((s, r) => s + r.ageDays, 0) / rows.length) : 0;
  const noEsdCount = rows.filter((r) => !r.hasEsd).length;

  const kpis: ReportKpi[] = [
    { label: 'Current Backlog', value: String(rows.length) },
    { label: 'Recent (≤2wk)', value: String(rows.filter((r) => r.ageBucket === 'recent').length), tint: 'pass' },
    { label: 'Accumulated (>2wk)', value: String(rows.filter((r) => r.ageBucket === 'accumulated').length), tint: 'fail' },
    { label: 'Avg Age', value: `${avgAgeDays}d` },
    { label: 'No ESD', value: String(noEsdCount), tint: noEsdCount > 0 ? 'fail' : 'neutral' },
    { label: 'Expected Clearance', value: String(rows.length - noEsdCount) },
    { label: 'Expected Future Backlog', value: String(expectedRows.length) },
  ];

  const ageTable: ReportTable = { title: 'Age Breakdown', columns: ['Bucket', 'POs'], rows: ageBands.map((b) => [b.label, b.count]) };
  const forecastTable: ReportTable = { title: 'Clearance Forecast', columns: ['Period', 'Remaining', 'No ESD Floor'], rows: forecast.map((f) => [f.label, f.remaining, f.noEsdRemaining]) };
  const expectedTable: ReportTable = { title: 'Expected Future Backlog by PGRD Week', columns: ['Period', 'POs'], rows: expectedByWeek.map((e) => [e.label, e.count]) };
  const poSheet = detailSheet('PO Detail', ['PO', 'Supplier', 'Warehouse', 'PGRD', 'EGRD', 'ESD', 'Age (days)', 'Bucket', 'No ESD'],
    rows.map((r) => [r.po, r.supplier, r.warehouse, r.pgrd, r.egrd, r.esd, r.ageDays, r.ageBucket, r.hasEsd ? 'No' : 'Yes']));

  const tables = [ageTable, forecastTable, expectedTable];
  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables,
    sheets: [summarySheet('Backlog Overview', ctx.filterLabel, kpis), ...tables.map(tableSheet), poSheet],
  };
}

export function buildBacklogBySupplierReport(ctx: ReportContext): ReportResult {
  const rows = computeBacklogRows(ctx.filteredLines, ctx.today);
  const summary = computeSupplierBacklogSummary(rows);

  const kpis: ReportKpi[] = [
    { label: 'Current Backlog', value: String(rows.length) },
    { label: 'Suppliers with Backlog', value: String(summary.length) },
  ];

  const summaryTable: ReportTable = {
    title: 'Backlog by Supplier',
    columns: ['Supplier', 'POs', '% of Backlog', 'Avg Age', 'No ESD'],
    rows: summary.map((s) => [s.supplier, s.count, `${s.pctOfBacklog}%`, `${s.avgAgeDays}d`, s.noEsdCount]),
  };
  const poSheet = detailSheet('PO Detail', ['PO', 'Supplier', 'Warehouse', 'PGRD', 'ESD', 'Age (days)'],
    rows.map((r) => [r.po, r.supplier, r.warehouse, r.pgrd, r.esd, r.ageDays]));

  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables: [summaryTable],
    sheets: [summarySheet('Backlog by Supplier', ctx.filterLabel, kpis), tableSheet(summaryTable), poSheet],
  };
}

export function buildRootCauseReport(ctx: ReportContext): ReportResult {
  const rows = computePORootCauseRows(ctx.filteredLines, ctx.classifications, ctx.weeksInRange);
  const kpisRaw = computeRootCauseKPIs(rows, ctx.filteredLines);
  const ranking = rankCategories(rows);

  const kpis: ReportKpi[] = [
    { label: 'Affected POs', value: String(kpisRaw.poCount) },
    { label: 'Affected Lines', value: String(kpisRaw.affectedLines) },
    { label: 'Qty Affected', value: kpisRaw.qtyAffected.toLocaleString() },
    { label: 'Top Category', value: kpisRaw.topCategory ? `${REASON_CATEGORY_LABELS[kpisRaw.topCategory]} (${kpisRaw.topCategoryShare}%)` : '—' },
  ];

  const rankingTable: ReportTable = {
    title: 'Root Cause Ranking',
    columns: ['Category', 'POs', '% of Affected'],
    rows: ranking.map((r) => [REASON_CATEGORY_LABELS[r.category], r.count, `${r.pct}%`]),
  };
  const poSheet = detailSheet('PO Detail', ['PO', 'Supplier', 'Category', 'Qty'],
    rows.map((r) => [r.po, r.supplier, r.finalCategory ? REASON_CATEGORY_LABELS[r.finalCategory] : '—', r.qty]));

  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables: [rankingTable],
    sheets: [summarySheet('Root Cause Summary', ctx.filterLabel, kpis), tableSheet(rankingTable), poSheet],
  };
}

export function buildLeadTimeReport(ctx: ReportContext): ReportResult {
  const summary = summariseLeadTimes(ctx.weekRangeLines);

  const kpis: ReportKpi[] = [
    { label: 'Avg Production LT', value: summary.avgProductionLT !== null ? `${summary.avgProductionLT}d` : '—' },
    { label: 'Target LT', value: `${summary.targetLT}d` },
    { label: 'On Time POs', value: String(summary.onTimeCount), tint: 'pass' },
    { label: 'Early POs', value: String(summary.earlyCount), tint: 'pass' },
    { label: 'Late POs', value: String(summary.lateCount), tint: summary.lateCount > 0 ? 'fail' : 'neutral' },
    { label: 'Avg Agreed LT', value: `${summary.avgAgreedLT}d` },
  ];

  return {
    contextLabel: `PO Level · ${ctx.filterLabel}`,
    kpis,
    tables: [],
    sheets: [summarySheet('Lead Time Performance', ctx.filterLabel, kpis)],
  };
}

export function buildInvoiceReport(ctx: ReportContext): ReportResult {
  const channel = ctx.filters.channels.length === 1 ? ctx.filters.channels[0] : 'All';
  const scopedInvoices = filterBySupplierNames(filterByChannel(ctx.invoices, channel), ctx.filters.suppliers);
  const kpisRaw = computeInvoiceKPIs(scopedInvoices);
  const breakdown = supplierBreakdown(kpisRaw.totalPending);

  const kpis: ReportKpi[] = [
    { label: 'Overdue (Pending Approval)', value: String(kpisRaw.overdueP2w.length), tint: 'fail' },
    { label: 'Total Pending', value: String(kpisRaw.totalPending.length) },
    { label: 'Due by End of Week', value: String(kpisRaw.dueByEndOfWeek.length), tint: 'warn' },
    { label: 'Approved, Not Paid', value: String(kpisRaw.approvedNotPaid.length) },
  ];

  const breakdownTable: ReportTable = {
    title: 'Pending by Supplier',
    columns: ['Supplier', 'Invoices', 'Amount'],
    rows: breakdown.map((b) => [b.name, b.count, b.amountByCurrency]),
  };
  const invoiceHeader: CellValue[] = ['Invoice', 'Supplier', 'Status', 'Due Date', 'Amount', 'Currency'].map((v) => ({ value: v, style: 'tableHeader' }));
  const invoiceSheet: SheetDef = {
    name: 'Invoice Detail',
    rows: [invoiceHeader, ...kpisRaw.totalPending.map((r) => [
      { value: r.invoice, style: 'tableCell' } as CellValue, { value: r.name, style: 'tableCell' } as CellValue,
      { value: r.invoiceStatus, style: 'tableCell' } as CellValue, dateCell(r.effectiveDueDate),
      currencyCell(r.importedInvoiceAmount), { value: r.currency, style: 'tableCell' } as CellValue,
    ])],
    freezeHeaderRow: true,
    autoFilter: true,
  };

  return {
    contextLabel: `Invoice Level · ${ctx.filterLabel}`,
    kpis,
    tables: [breakdownTable],
    sheets: [summarySheet('Invoice Status', ctx.filterLabel, kpis), tableSheet(breakdownTable), invoiceSheet],
  };
}

export function buildWeeklyPackReport(ctx: ReportContext): ReportResult {
  const sotOtif = buildSotOtifReport(ctx);
  const backlog = buildBacklogOverviewReport(ctx);
  const missingEsd = buildMissingEsdReport(ctx);
  const invoices = buildInvoiceReport(ctx);

  const kpis: ReportKpi[] = [
    ...sotOtif.kpis.map((k) => ({ ...k, label: `SOT/OTIF · ${k.label}` })),
    ...backlog.kpis.slice(0, 3).map((k) => ({ ...k, label: `Backlog · ${k.label}` })),
    ...missingEsd.kpis.map((k) => ({ ...k, label: `Missing ESD · ${k.label}` })),
    ...invoices.kpis.slice(0, 2).map((k) => ({ ...k, label: `Invoices · ${k.label}` })),
  ];

  return {
    contextLabel: `Combined · ${ctx.filterLabel}`,
    kpis,
    tables: [...sotOtif.tables.slice(0, 1), ...backlog.tables.slice(0, 1), ...missingEsd.tables.slice(0, 1)],
    sheets: [summarySheet('Production Weekly Pack', ctx.filterLabel, kpis), ...sotOtif.sheets.slice(1), ...backlog.sheets.slice(1), ...missingEsd.sheets.slice(1), ...invoices.sheets.slice(1)],
  };
}

// ---------------------------------------------------------------------------
// Custom Report Builder — a guided config (level + group-by + approved metrics
// only), never a formula/calculated-field editor. Every metric below calls the
// same approved function used elsewhere; grouping only changes which line
// subset that function runs over, never what the formula means (per the
// "grouping must not modify KPI logic" requirement).
// ---------------------------------------------------------------------------

export type MetricId =
  | 'pos_in_scope' | 'sot_pct' | 'otif_pct' | 'on_time_pos' | 'late_pos'
  | 'current_backlog' | 'avg_backlog_age' | 'no_esd' | 'expected_clearance'
  | 'missing_esd_pos' | 'needing_action' | 'not_urgent';

export interface MetricDef {
  id: MetricId;
  label: string;
  group: string;
}

export const APPROVED_METRICS: MetricDef[] = [
  { id: 'pos_in_scope', label: 'POs in Scope', group: 'Performance' },
  { id: 'sot_pct', label: 'SOT %', group: 'Performance' },
  { id: 'otif_pct', label: 'OTIF %', group: 'Performance' },
  { id: 'on_time_pos', label: 'On Time POs', group: 'Performance' },
  { id: 'late_pos', label: 'Late POs', group: 'Performance' },
  { id: 'current_backlog', label: 'Current Backlog POs', group: 'Backlog' },
  { id: 'avg_backlog_age', label: 'Average Backlog Age', group: 'Backlog' },
  { id: 'no_esd', label: 'No ESD', group: 'Backlog' },
  { id: 'expected_clearance', label: 'Expected Clearance', group: 'Backlog' },
  { id: 'missing_esd_pos', label: 'Missing ESD POs', group: 'Missing ESD' },
  { id: 'needing_action', label: 'Needing Action', group: 'Missing ESD' },
  { id: 'not_urgent', label: 'Not Urgent', group: 'Missing ESD' },
];

export type GroupById = 'week' | 'supplier';
export type TimeBasis = 'pgrd' | 'egrd' | 'esd' | 'asd';
export type ReportStructure = 'aggregated' | 'detailed';

export const LINE_FIELDS = ['po', 'sku', 'supplier', 'destination', 'qty', 'cqty', 'pgrd', 'egrd', 'esd', 'asd'] as const;
export type LineFieldId = typeof LINE_FIELDS[number];
export const LINE_FIELD_LABELS: Record<LineFieldId, string> = {
  po: 'PO', sku: 'SKU', supplier: 'Supplier', destination: 'Destination', qty: 'Qty Ordered',
  cqty: 'Qty Confirmed', pgrd: 'PGRD', egrd: 'EGRD', esd: 'ESD', asd: 'ASD',
};

// Report Scope — filters by raw fields already on PurchaseLine (destination, sku) plus the same
// supplier/channel/category dimensions the dashboard filter bar already uses. This never
// redefines what a supplier/channel/category IS (still categorizeSKU/getChannel exactly as
// elsewhere) — it only decides which subset of the page's already-filtered lines a given report
// runs over, layered on top of (never wider than) the global dashboard filter selection.
export interface ReportScope {
  suppliers: string[];
  channels: string[];
  categories: string[];
  warehouses: string[]; // destination values
  skuSearch: string; // substring match against l.sku
}

export const DEFAULT_REPORT_SCOPE: ReportScope = { suppliers: [], channels: [], categories: [], warehouses: [], skuSearch: '' };

function applyReportScope(lines: PurchaseLine[], scope: ReportScope): PurchaseLine[] {
  let result = lines;
  if (scope.suppliers.length) result = result.filter((l) => scope.suppliers.includes(l.supplier));
  if (scope.channels.length) result = result.filter((l) => scope.channels.includes(getChannel(l.destination)));
  if (scope.categories.length) result = result.filter((l) => scope.categories.includes(categorizeSKU(l.sku)));
  if (scope.warehouses.length) result = result.filter((l) => scope.warehouses.includes(l.destination));
  if (scope.skuSearch.trim()) {
    const q = scope.skuSearch.trim().toLowerCase();
    result = result.filter((l) => l.sku.toLowerCase().includes(q));
  }
  return result;
}

function timeBasisDate(l: PurchaseLine, basis: TimeBasis): Date | null {
  return basis === 'pgrd' ? l.pgrd : basis === 'egrd' ? l.egrd : basis === 'esd' ? l.esd : l.asd;
}

function linesForWeekByBasis(lines: PurchaseLine[], w: WeekInRange, basis: TimeBasis): PurchaseLine[] {
  return lines.filter((l) => {
    const d = timeBasisDate(l, basis);
    return d && getISOWeek(d) === w.week && getISOWeekYear(d) === w.year;
  });
}

function metricValue(id: MetricId, lines: PurchaseLine[], ctx: ReportContext): number | string {
  switch (id) {
    case 'pos_in_scope': return new Set(lines.map((l) => l.po)).size;
    case 'sot_pct': return aggregateSOTRate(lines, ctx.isChinaSupplier, ctx.today) ?? '—';
    case 'otif_pct': return aggregateOTIFRate(lines, ctx.isChinaSupplier) ?? '—';
    case 'on_time_pos': return rollupByPO(lines, ctx.isChinaSupplier, ctx.today).filter((r) => r.sot === true).length;
    case 'late_pos': return rollupByPO(lines, ctx.isChinaSupplier, ctx.today).filter((r) => r.sot === false).length;
    case 'current_backlog': return computeBacklogRows(lines, ctx.today).length;
    case 'avg_backlog_age': {
      const rows = computeBacklogRows(lines, ctx.today);
      return rows.length ? Math.round(rows.reduce((s, r) => s + r.ageDays, 0) / rows.length) : '—';
    }
    case 'no_esd': return computeBacklogRows(lines, ctx.today).filter((r) => !r.hasEsd).length;
    case 'expected_clearance': {
      const rows = computeBacklogRows(lines, ctx.today);
      return rows.filter((r) => r.hasEsd).length;
    }
    case 'missing_esd_pos': return computeMissingEsdRows(lines).length;
    case 'needing_action': return computeMissingEsdRows(lines).filter((r) => r.urgency !== 'watchlist').length;
    case 'not_urgent': return computeMissingEsdRows(lines).filter((r) => r.urgency === 'watchlist').length;
    default: return '—';
  }
}

export interface CustomReportConfig {
  scope: ReportScope;
  timeBasis: TimeBasis;
  level: 'po' | 'line';
  structure: ReportStructure;
  groupBy: GroupById;
  metrics: MetricId[];
  fields: LineFieldId[]; // which raw columns to include on a 'detailed' line-level export
  includeChart: boolean; // add a native weekly-evolution chart to the Summary sheet, if applicable
}

export const DEFAULT_REPORT_CONFIG: CustomReportConfig = {
  scope: DEFAULT_REPORT_SCOPE,
  timeBasis: 'pgrd',
  level: 'po',
  structure: 'aggregated',
  groupBy: 'supplier',
  metrics: ['pos_in_scope', 'sot_pct', 'otif_pct'],
  fields: [...LINE_FIELDS],
  includeChart: false,
};

// Weekly evolution chart for a Custom Report's "Report Data" sheet — same native-chart mechanism
// as sotOtifChart, generalised to whichever metric columns the user picked (columns B.. onward).
function customReportChart(mainTable: ReportTable, metricDefs: MetricDef[]): ChartDef | null {
  if (metricDefs.length === 0 || mainTable.rows.length === 0) return null;
  const lastRow = mainTable.rows.length + 1;
  const sheetRef = `'${mainTable.title}'`;
  return {
    type: 'line',
    title: 'Weekly Evolution',
    categoryRange: `${sheetRef}!$A$2:$A$${lastRow}`,
    series: metricDefs.map((m, i) => ({
      name: m.label,
      valueRange: `${sheetRef}!$${colLetter(i + 1)}$2:$${colLetter(i + 1)}$${lastRow}`,
    })),
    anchorRow: 8,
  };
}

function colLetter(idx: number): string {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buildCustomReport(config: CustomReportConfig, ctx: ReportContext): ReportResult {
  const metricDefs = APPROVED_METRICS.filter((m) => config.metrics.includes(m.id));

  // Base pool: the dashboard's global supplier/channel/category/week-range filters always apply
  // first (ctx.filteredLines) — the wizard's own Scope step can only narrow further, never widen,
  // what the global filter bar already selected. Time basis then decides which date field buckets
  // lines into ctx.weeksInRange (PGRD is what the dashboard bar itself uses to build that range).
  const scoped = applyReportScope(ctx.filteredLines, config.scope);
  const weekKeySet = new Set(ctx.weeksInRange.map((w) => `${w.year}-${w.week}`));
  const lines = scoped.filter((l) => {
    const d = timeBasisDate(l, config.timeBasis);
    return d && weekKeySet.has(`${getISOWeekYear(d)}-${getISOWeek(d)}`);
  });

  const scopeLabel = [
    config.scope.suppliers.length ? `${config.scope.suppliers.length} supplier(s)` : null,
    config.scope.warehouses.length ? `${config.scope.warehouses.length} warehouse(s)` : null,
    config.scope.skuSearch.trim() ? `SKU: "${config.scope.skuSearch.trim()}"` : null,
  ].filter(Boolean).join(' · ');
  const filterLabel = scopeLabel ? `${ctx.filterLabel} · ${scopeLabel}` : ctx.filterLabel;

  // Detailed-data-only reports: no aggregation, no KPI cards, no charts — just a polished Excel
  // data table of the raw fields the user picked (per the "detailed-data-only" spec example).
  if (config.structure === 'detailed') {
    const columns = config.fields.length ? config.fields : LINE_FIELDS;
    const detail = detailSheet(
      config.level === 'po' ? 'PO Detail' : 'Line Detail',
      columns.map((f) => LINE_FIELD_LABELS[f]),
      lines.map((l) => columns.map((f) => l[f as keyof PurchaseLine] as string | number | Date | null))
    );
    return {
      contextLabel: `${config.level === 'po' ? 'PO Level' : 'Line Level'} · Detailed · ${filterLabel}`,
      kpis: [],
      tables: [],
      sheets: [detail],
    };
  }

  const groups: { key: string; lines: PurchaseLine[] }[] = config.groupBy === 'week'
    ? ctx.weeksInRange.map((w) => ({ key: w.label, lines: linesForWeekByBasis(lines, w, config.timeBasis) }))
    : [...new Set(lines.map((l) => l.supplier))].sort().map((s) => ({ key: s, lines: lines.filter((l) => l.supplier === s) }));

  const mainTable: ReportTable = {
    title: 'Report Data',
    columns: [config.groupBy === 'week' ? 'Week' : 'Supplier', ...metricDefs.map((m) => m.label)],
    rows: groups.map((g) => [g.key, ...metricDefs.map((m) => metricValue(m.id, g.lines, ctx))]),
  };

  const tables = [mainTable];
  const summary = summarySheet('Custom Report', filterLabel, metricDefs.map((m) => ({ label: m.label, value: '(see Report Data)' })));
  if (config.includeChart && config.groupBy === 'week') {
    const chart = customReportChart(mainTable, metricDefs);
    if (chart) summary.charts = [chart];
  }
  const sheets: SheetDef[] = [summary, tableSheet(mainTable)];

  if (config.level === 'line') {
    sheets.push(detailSheet('Line Detail', ['PO', 'Line', 'SKU', 'Supplier', 'PGRD', 'EGRD', 'ESD', 'ASD', 'Qty Ordered', 'Qty Confirmed'],
      lines.map((l) => [l.po, l.line, l.sku, l.supplier, l.pgrd, l.egrd, l.esd, l.asd, l.qty, l.cqty])));
  } else {
    sheets.push(poRowsSheet(rollupByPO(lines, ctx.isChinaSupplier, ctx.today)));
  }

  return {
    contextLabel: `${config.level === 'po' ? 'PO Level' : 'Line Level'} · ${ctx.filterLabel}`,
    kpis: [],
    tables,
    sheets,
  };
}

export type ReportId =
  | 'sot-otif' | 'supplier-performance' | 'missing-esd' | 'backlog-overview' | 'backlog-by-supplier'
  | 'root-cause' | 'lead-time' | 'invoice-status' | 'weekly-pack';

export interface ReportDefinition {
  id: ReportId;
  name: string;
  description: string;
  build: (ctx: ReportContext) => ReportResult;
}

export const REPORT_LIBRARY: ReportDefinition[] = [
  { id: 'sot-otif', name: 'SOT & OTIF Performance', description: 'Weekly SOT & OTIF evolution, targets, volumes and supplier scorecard.', build: buildSotOtifReport },
  { id: 'supplier-performance', name: 'Supplier Performance', description: 'Supplier-level SOT & OTIF performance, volumes and weekly evolution.', build: buildSupplierPerformanceReport },
  { id: 'missing-esd', name: 'Missing ESD', description: 'POs missing ESD, split by urgency based on EGRD.', build: buildMissingEsdReport },
  { id: 'backlog-overview', name: 'Backlog Overview', description: 'Current backlog, age analysis, clearance forecast and future backlog.', build: buildBacklogOverviewReport },
  { id: 'backlog-by-supplier', name: 'Backlog by Supplier', description: 'Backlog breakdown by supplier including age, no ESD and expected clearance.', build: buildBacklogBySupplierReport },
  { id: 'root-cause', name: 'Root Cause Summary', description: 'Root cause distribution, impacted POs, lines and quantity by supplier.', build: buildRootCauseReport },
  { id: 'lead-time', name: 'Lead Time Performance', description: 'Lead time KPI and breakdown by supplier and lane.', build: buildLeadTimeReport },
  { id: 'invoice-status', name: 'Invoice Status', description: 'Invoice status overview with pending, overdue and aging.', build: buildInvoiceReport },
  { id: 'weekly-pack', name: 'Production Weekly Pack', description: 'Combined management report containing selected main Control Tower KPIs.', build: buildWeeklyPackReport },
];
