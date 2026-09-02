// Raw Data page — column registry. Every column here is either a raw field straight off the BC
// export (source = the exact BC column name, from bcParser.ts) or an existing approved
// calculation reused as-is. Fields the data model doesn't actually have (SKU Description, UoM,
// Vendor Shipment Number at line level, an "Actual Delivery Date") are deliberately NOT included —
// see the Raw Data build notes for what was left out and why, rather than inventing placeholder
// data for them.

import { differenceInCalendarDays } from 'date-fns';
import { rollupByPO, type PORollup } from './poAggregation';
import { weekOf, type IsChinaSupplier } from './kpiFormulas';
import { computeLeadTime } from './leadTimeUtils';
import { categorizeSKU, type SKUCategory } from './skuUtils';
import { skuVariationOf } from './leadTimeAnalytics';
import { getChannel, type Channel } from './channelUtils';
import type { PurchaseLine } from '../types';
import type { RawValue } from './xlsxWriter';

export type ColumnGroup = 'Identifiers' | 'Supply' | 'Dates' | 'Quantities' | 'Calculated' | 'Status';

export type DateFieldId = 'pgrd' | 'egrd' | 'esd' | 'asd' | 'edd' | 'orderDate';

export const DATE_FIELDS: { id: DateFieldId; label: string; getValue: (l: PurchaseLine) => Date | null }[] = [
  { id: 'pgrd', label: 'PGRD — Planned Goods Ready Date', getValue: (l) => l.pgrd },
  { id: 'egrd', label: 'EGRD — Expected Goods Ready Date', getValue: (l) => l.egrd },
  { id: 'esd', label: 'ESD — Expected Shipping Date', getValue: (l) => l.esd },
  { id: 'asd', label: 'ASD — Actual Shipping Date', getValue: (l) => l.asd },
  { id: 'edd', label: 'EDD — Expected Delivery Date', getValue: (l) => l.edd },
  { id: 'orderDate', label: 'Order Date', getValue: (l) => l.orderDate },
];

export interface DictEntry {
  label: string;
  description: string;
  source: string; // exact BC export column name, or 'Derived'/'Calculated'
  level: 'PO' | 'PO Line';
  type: 'Text' | 'Date' | 'Number' | 'Calculated';
}

export interface ColumnDef<Row> {
  id: string;
  label: string;
  group: ColumnGroup;
  defaultVisible: boolean;
  align?: 'right';
  getValue: (row: Row) => RawValue;
  dict: DictEntry;
}

// ---------------------------------------------------------------------------
// Status label — a simple, honest presentation of the SAME raw status text every other section
// already displays as-is (see BacklogPOTable/POList: `l.confirmedStatus || l.status`). No new
// status taxonomy is invented here; the badge color is just a cosmetic keyword match on that same
// raw text, and anything that doesn't match a known word still shows verbatim, uncolored.
// ---------------------------------------------------------------------------

export type StatusTint = 'pass' | 'fail' | 'warn' | 'neutral';

export function rawStatusText(l: PurchaseLine): string {
  return l.confirmedStatus || l.status || '—';
}

export function statusTint(text: string): StatusTint {
  const t = text.toLowerCase();
  if (t.includes('deliver')) return 'pass';
  if (t.includes('ship') || t.includes('transit')) return 'pass';
  if (t.includes('book')) return 'warn';
  if (t.includes('no booking') || t.includes('missing')) return 'fail';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// PO Level rows — built via the SAME rollupByPO used by SOT/OTIF and Backlog, not a new
// aggregation. Category/Channel are presentation-only derivations for display (a PO can span
// multiple SKU categories; "Mixed" is shown rather than silently picking one).
// ---------------------------------------------------------------------------

export interface PORow {
  rollup: PORollup;
  qty: number;
  cqty: number;
  lineCount: number;
  channel: Channel;
  category: SKUCategory | 'Mixed';
  daysInBacklog: number | null;
  statusText: string;
}

export function buildPORows(lines: PurchaseLine[], isChinaSupplier: IsChinaSupplier, today: Date): PORow[] {
  const rollups = rollupByPO(lines, isChinaSupplier, today);
  return rollups.map((rollup) => {
    const categories = new Set(rollup.lines.map((l) => categorizeSKU(l.sku)));
    const category: SKUCategory | 'Mixed' = categories.size === 1 ? [...categories][0] : 'Mixed';
    // Days in Backlog reuses the exact same eligibility test (weekOf(pgrd) < weekOf(today) && no
    // ASD yet — see kpiFormulas.ts's isBacklog) and day-count formula
    // (differenceInCalendarDays(today, pgrd)) as backlogAggregation.ts's computeBacklogRows,
    // applied to the rollup's own resolved pgrd/asd rather than an arbitrary single line.
    const isPOBacklog = !!rollup.pgrd && weekOf(rollup.pgrd) < weekOf(today) && !rollup.asd;
    const daysInBacklog = isPOBacklog ? differenceInCalendarDays(today, rollup.pgrd!) : null;
    return {
      rollup,
      qty: rollup.lines.reduce((s, l) => s + l.qty, 0),
      cqty: rollup.lines.reduce((s, l) => s + l.cqty, 0),
      lineCount: rollup.lines.length,
      channel: getChannel(rollup.destination),
      category,
      daysInBacklog,
      statusText: rawStatusText(rollup.lines[0]),
    };
  });
}

export const PO_COLUMNS: ColumnDef<PORow>[] = [
  { id: 'po', label: 'PO Number', group: 'Identifiers', defaultVisible: true, getValue: (r) => r.rollup.po,
    dict: { label: 'PO Number', description: 'Purchase order number.', source: 'Document No.', level: 'PO', type: 'Text' } },
  { id: 'supplier', label: 'Supplier', group: 'Supply', defaultVisible: true, getValue: (r) => r.rollup.supplier,
    dict: { label: 'Supplier', description: 'Vendor name for this PO.', source: 'Vendor Name', level: 'PO', type: 'Text' } },
  { id: 'channel', label: 'Channel', group: 'Supply', defaultVisible: true, getValue: (r) => r.channel,
    dict: { label: 'Channel', description: 'Offline/Online, derived from the delivery destination.', source: 'Derived — getChannel(destination)', level: 'PO', type: 'Text' } },
  { id: 'category', label: 'Category', group: 'Supply', defaultVisible: true, getValue: (r) => r.category,
    dict: { label: 'Category', description: 'SKU category (Beds/Mattresses/Accessories), derived from SKU code. Shows "Mixed" if the PO spans more than one category.', source: 'Derived — categorizeSKU(sku)', level: 'PO', type: 'Text' } },
  { id: 'destination', label: 'Warehouse (Destination)', group: 'Supply', defaultVisible: true, getValue: (r) => r.rollup.destination,
    dict: { label: 'Warehouse (Destination)', description: 'Delivery destination location code.', source: 'Location Code', level: 'PO', type: 'Text' } },
  { id: 'pgrd', label: 'PGRD', group: 'Dates', defaultVisible: true, getValue: (r) => r.rollup.pgrd,
    dict: { label: 'PGRD', description: 'Planned Goods Ready Date.', source: 'Planned Receipt Date', level: 'PO', type: 'Date' } },
  { id: 'egrd', label: 'EGRD', group: 'Dates', defaultVisible: true, getValue: (r) => r.rollup.egrd,
    dict: { label: 'EGRD', description: 'Expected Goods Ready Date.', source: 'Expected Goods Ready Date (or Expected Receipt Date)', level: 'PO', type: 'Date' } },
  { id: 'esd', label: 'ESD', group: 'Dates', defaultVisible: true, getValue: (r) => r.rollup.esd,
    dict: { label: 'ESD', description: 'Expected Shipping Date — used for the SOT calculation.', source: 'Expected Shipping Date', level: 'PO', type: 'Date' } },
  { id: 'asd', label: 'ASD', group: 'Dates', defaultVisible: true, getValue: (r) => r.rollup.asd,
    dict: { label: 'ASD', description: 'Actual Shipping Date.', source: 'Actual Shipping Date column(s)', level: 'PO', type: 'Date' } },
  { id: 'edd', label: 'EDD', group: 'Dates', defaultVisible: false, getValue: (r) => r.rollup.lines[0]?.edd ?? null,
    dict: { label: 'EDD', description: 'Expected Delivery Date from Shiptify — empty means not yet booked. There is no "actual" delivery date field in the data model, so only the expected date is available.', source: 'Expected Delivery Date', level: 'PO', type: 'Date' } },
  { id: 'orderDate', label: 'Order Date', group: 'Dates', defaultVisible: false, getValue: (r) => r.rollup.lines[0]?.orderDate ?? null,
    dict: { label: 'Order Date', description: 'Date the PO was placed.', source: 'Order Date', level: 'PO', type: 'Date' } },
  { id: 'qty', label: 'Qty', group: 'Quantities', defaultVisible: true, align: 'right', getValue: (r) => r.qty,
    dict: { label: 'Qty', description: 'Total ordered quantity across all lines on this PO.', source: 'Sum of Quantity', level: 'PO', type: 'Number' } },
  { id: 'lineCount', label: '# Lines', group: 'Quantities', defaultVisible: true, align: 'right', getValue: (r) => r.lineCount,
    dict: { label: '# Lines', description: 'Number of PO lines on this PO.', source: 'Derived — count of lines', level: 'PO', type: 'Number' } },
  { id: 'cqty', label: 'Qty Confirmed', group: 'Quantities', defaultVisible: false, align: 'right', getValue: (r) => r.cqty,
    dict: { label: 'Qty Confirmed', description: 'Total confirmed quantity across all lines on this PO.', source: 'Sum of Confirmed Quantity', level: 'PO', type: 'Number' } },
  { id: 'daysInBacklog', label: 'Days in Backlog', group: 'Calculated', defaultVisible: false, align: 'right', getValue: (r) => r.daysInBacklog,
    dict: { label: 'Days in Backlog', description: 'Calendar days since PGRD, only for POs currently in backlog (PGRD passed, not yet shipped) — same eligibility and formula as the Backlog section.', source: 'Calculated — backlogAggregation.ts', level: 'PO', type: 'Calculated' } },
  { id: 'status', label: 'Status', group: 'Status', defaultVisible: true, getValue: (r) => r.statusText,
    dict: { label: 'Status', description: 'Raw status text from the BC export (Confirmed Status if present, else Status). Not a normalized/derived state.', source: 'Status / Confirmed Status', level: 'PO', type: 'Text' } },
];

// ---------------------------------------------------------------------------
// PO Line Level rows — one row per PurchaseLine, no aggregation at all.
// ---------------------------------------------------------------------------

export interface LineRow {
  line: PurchaseLine;
  category: SKUCategory;
  channel: Channel;
  variation: string;
  leadTimeDays: number | null;
  statusText: string;
}

export function buildLineRows(lines: PurchaseLine[]): LineRow[] {
  return lines.map((line) => ({
    line,
    category: categorizeSKU(line.sku),
    channel: getChannel(line.destination),
    variation: skuVariationOf(line.sku),
    leadTimeDays: computeLeadTime(line).productionLT,
    statusText: rawStatusText(line),
  }));
}

export const LINE_COLUMNS: ColumnDef<LineRow>[] = [
  { id: 'po', label: 'PO Number', group: 'Identifiers', defaultVisible: true, getValue: (r) => r.line.po,
    dict: { label: 'PO Number', description: 'Purchase order number.', source: 'Document No.', level: 'PO Line', type: 'Text' } },
  { id: 'lineNo', label: 'PO Line', group: 'Identifiers', defaultVisible: true, align: 'right', getValue: (r) => r.line.line,
    dict: { label: 'PO Line', description: 'Line number within the PO.', source: 'Line No.', level: 'PO Line', type: 'Number' } },
  { id: 'supplier', label: 'Supplier', group: 'Supply', defaultVisible: true, getValue: (r) => r.line.supplier,
    dict: { label: 'Supplier', description: 'Vendor name for this line.', source: 'Vendor Name', level: 'PO Line', type: 'Text' } },
  { id: 'sku', label: 'SKU', group: 'Supply', defaultVisible: true, getValue: (r) => r.line.sku,
    dict: { label: 'SKU', description: 'SKU / item code. No SKU description text field exists in the data model.', source: 'No.', level: 'PO Line', type: 'Text' } },
  { id: 'variation', label: 'Variation', group: 'Supply', defaultVisible: false, getValue: (r) => r.variation,
    dict: { label: 'Variation', description: 'Last 3 characters of the SKU code (size/variant suffix) — not a separate stored field.', source: 'Derived — skuVariationOf(sku)', level: 'PO Line', type: 'Text' } },
  { id: 'category', label: 'Category', group: 'Supply', defaultVisible: true, getValue: (r) => r.category,
    dict: { label: 'Category', description: 'SKU category, derived from the SKU code.', source: 'Derived — categorizeSKU(sku)', level: 'PO Line', type: 'Text' } },
  { id: 'channel', label: 'Channel', group: 'Supply', defaultVisible: true, getValue: (r) => r.channel,
    dict: { label: 'Channel', description: 'Offline/Online, derived from the delivery destination.', source: 'Derived — getChannel(destination)', level: 'PO Line', type: 'Text' } },
  { id: 'destination', label: 'Warehouse', group: 'Supply', defaultVisible: true, getValue: (r) => r.line.destination,
    dict: { label: 'Warehouse', description: 'Delivery destination location code.', source: 'Location Code', level: 'PO Line', type: 'Text' } },
  { id: 'pgrd', label: 'PGRD', group: 'Dates', defaultVisible: true, getValue: (r) => r.line.pgrd,
    dict: { label: 'PGRD', description: 'Planned Goods Ready Date.', source: 'Planned Receipt Date', level: 'PO Line', type: 'Date' } },
  { id: 'egrd', label: 'EGRD', group: 'Dates', defaultVisible: true, getValue: (r) => r.line.egrd,
    dict: { label: 'EGRD', description: 'Expected Goods Ready Date.', source: 'Expected Goods Ready Date (or Expected Receipt Date)', level: 'PO Line', type: 'Date' } },
  { id: 'esd', label: 'ESD', group: 'Dates', defaultVisible: true, getValue: (r) => r.line.esd,
    dict: { label: 'ESD', description: 'Expected Shipping Date.', source: 'Expected Shipping Date', level: 'PO Line', type: 'Date' } },
  { id: 'asd', label: 'ASD', group: 'Dates', defaultVisible: true, getValue: (r) => r.line.asd,
    dict: { label: 'ASD', description: 'Actual Shipping Date.', source: 'Actual Shipping Date column(s)', level: 'PO Line', type: 'Date' } },
  { id: 'edd', label: 'EDD', group: 'Dates', defaultVisible: false, getValue: (r) => r.line.edd,
    dict: { label: 'EDD', description: 'Expected Delivery Date from Shiptify — empty means not yet booked. No "actual" delivery date exists in the data model.', source: 'Expected Delivery Date', level: 'PO Line', type: 'Date' } },
  { id: 'orderDate', label: 'Order Date', group: 'Dates', defaultVisible: false, getValue: (r) => r.line.orderDate,
    dict: { label: 'Order Date', description: 'Date the PO was placed.', source: 'Order Date', level: 'PO Line', type: 'Date' } },
  { id: 'qty', label: 'Qty Ordered', group: 'Quantities', defaultVisible: true, align: 'right', getValue: (r) => r.line.qty,
    dict: { label: 'Qty Ordered', description: 'Ordered quantity for this line.', source: 'Quantity', level: 'PO Line', type: 'Number' } },
  { id: 'cqty', label: 'Qty Confirmed', group: 'Quantities', defaultVisible: false, align: 'right', getValue: (r) => r.line.cqty,
    dict: { label: 'Qty Confirmed', description: 'Confirmed quantity for this line.', source: 'Confirmed Quantity', level: 'PO Line', type: 'Number' } },
  { id: 'leadTime', label: 'Lead Time (days)', group: 'Calculated', defaultVisible: false, align: 'right', getValue: (r) => r.leadTimeDays,
    dict: { label: 'Lead Time (days)', description: 'Production lead time: Order Date → Actual Shipping Date. Only available once a line has shipped. Same calculation used by the Lead Time section.', source: 'Calculated — leadTimeUtils.ts computeLeadTime().productionLT', level: 'PO Line', type: 'Calculated' } },
  { id: 'status', label: 'Status', group: 'Status', defaultVisible: true, getValue: (r) => r.statusText,
    dict: { label: 'Status', description: 'Raw status text from the BC export (Confirmed Status if present, else Status). Not a normalized/derived state.', source: 'Status / Confirmed Status', level: 'PO Line', type: 'Text' } },
];
