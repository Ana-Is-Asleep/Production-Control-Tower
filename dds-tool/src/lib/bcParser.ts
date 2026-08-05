import type { PurchaseHeader, PurchaseLine } from '../types';
import { parseDate } from './dateUtils';
import { readXlsxFile } from './xlsxUtils';

export type BCFileKind = 'header' | 'lines' | 'unknown';

// Real BC exports carry a title row (row 1) naming the report — e.g. "Purchase Header" or
// "Purchase Line" — which is the only reliable way to tell the two apart, since both export
// with the same generic filename pattern (Default<date>_<time>.xlsx) and near-identical shape.
export function detectBCFileKind(rows: unknown[][]): BCFileKind {
  const first = rows[0];
  if (!Array.isArray(first)) return 'unknown';
  const marker = first.find((v): v is string => typeof v === 'string' && /purchase (header|line)/i.test(v));
  if (!marker) return 'unknown';
  return /purchase header/i.test(marker) ? 'header' : 'lines';
}

// Finds the row containing an exact (case-insensitive) match for `marker` in ANY column —
// real exports have a leading "Document Type" column before "Document No.", so the header
// row can't be identified by column A alone.
function findRowWithCell(rows: unknown[][], marker: string): number {
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const r = rows[i];
    if (Array.isArray(r) && r.some((c) => typeof c === 'string' && c.toLowerCase().trim() === marker)) return i;
  }
  return -1;
}

export function parseLinesFromRows(rows: unknown[][]): PurchaseLine[] {
  const hIdx = findRowWithCell(rows, 'document no.');
  if (hIdx < 0) return [];

  const headerRow = (rows[hIdx] as unknown[]).map((h) => (typeof h === 'string' ? h : ''));
  const col = (n: string) => headerRow.findIndex((h) => h.toLowerCase().trim() === n.toLowerCase().trim());

  const poCol         = col('document no.');
  const lineCol       = col('line no.');
  const skuCol        = col('no.');
  const destCol       = col('location code');
  const egrdCol       = col('expected goods ready date') !== -1 ? col('expected goods ready date') : col('expected receipt date');
  const qtyCol        = col('quantity');
  const pgrdCol       = col('planned receipt date');
  const cqtyCol       = col('confirmed quantity');
  const statusCol     = col('status');
  const confStatusCol = col('confirmed status');
  const lossReasonCol = col('loss reason code');
  const vendorNameCol = col('vendor name');
  const vendorCodeCol = col('buy-from vendor no.') !== -1 ? col('buy-from vendor no.')
    : col('vendor no.') !== -1 ? col('vendor no.')
    : col('vendor code');
  const purchaserCol  = col('purchaser code') !== -1 ? col('purchaser code') : col('purchaser');
  const orderDateCol  = col('order date');
  const esdCol        = col('expected shipping date') !== -1 ? col('expected shipping date') : col('expected receipt date');
  const eddCol        = col('expected delivery date');
  // Real exports have two columns named "Actual Shipping Date" — the first one carries the
  // real value, the second is consistently empty (verified against a live export).
  const asdCol        = (() => {
    const all: number[] = [];
    headerRow.forEach((h, i) => { if (h.toLowerCase().trim() === 'actual shipping date') all.push(i); });
    return all.length >= 1 ? all[0] : 15;
  })();

  const results: PurchaseLine[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const poVal = r[poCol !== -1 ? poCol : 1];
    if (!r || !poVal) continue;
    results.push({
      po:              String(poVal ?? ''),
      line:            Number(r[lineCol   !== -1 ? lineCol   : 2]  ?? 0),
      sku:             String(r[skuCol    !== -1 ? skuCol    : 9]  ?? ''),
      destination:     String(r[destCol   !== -1 ? destCol   : 11] ?? ''),
      egrd:            parseDate(r[egrdCol !== -1 ? egrdCol  : 6]),
      qty:             Number(r[qtyCol    !== -1 ? qtyCol    : 16] ?? 0),
      pgrd:            parseDate(r[pgrdCol !== -1 ? pgrdCol  : 30]),
      cqty:            Number(r[cqtyCol   !== -1 ? cqtyCol   : 23] ?? 0),
      status:          String(r[statusCol !== -1 ? statusCol : 5]  ?? ''),
      confirmedStatus: String(r[confStatusCol !== -1 ? confStatusCol : 41] ?? ''),
      lossReasonCode:  String(r[lossReasonCol !== -1 ? lossReasonCol : -1] ?? '').trim(),
      esd:             parseDate(r[esdCol !== -1 ? esdCol    : 36]),
      edd:             parseDate(r[eddCol !== -1 ? eddCol    : 33]),
      asd:             parseDate(r[asdCol]),
      supplier:        vendorNameCol !== -1 ? String(r[vendorNameCol] ?? '') : '',
      vendorCode:      vendorCodeCol !== -1 ? String(r[vendorCodeCol] ?? '') : '',
      purchaser:       purchaserCol  !== -1 ? String(r[purchaserCol]  ?? '') : '',
      orderDate:       orderDateCol  !== -1 ? parseDate(r[orderDateCol]) : null,
    });
  }
  return results;
}

// Purchase Header export: one row per PO, carrying Order Date / Purchaser / Vendor Name —
// none of which exist on the Lines export. Optional upload; when present, joinLinesWithHeaders
// backfills these onto each line by matching PO number.
export function parseHeadersFromRows(rows: unknown[][]): PurchaseHeader[] {
  const hIdx = findRowWithCell(rows, 'purchaser code');
  if (hIdx < 0) return [];

  const headerRow = (rows[hIdx] as unknown[]).map((h) => (typeof h === 'string' ? h : ''));
  const col = (n: string) => headerRow.findIndex((h) => h.toLowerCase().trim() === n.toLowerCase().trim());

  const poCol             = col('no.');
  const orderDateCol      = col('order date');
  const purchaserCol      = col('purchaser code');
  const vendorShipmentCol = col('vendor shipment no.');
  const supplierCol       = col('buy-from vendor name');

  const results: PurchaseHeader[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const poVal = r[poCol];
    if (!r || poCol === -1 || !poVal) continue;
    results.push({
      po:               String(poVal ?? ''),
      orderDate:        orderDateCol      !== -1 ? parseDate(r[orderDateCol]) : null,
      purchaser:        purchaserCol      !== -1 ? String(r[purchaserCol] ?? '') : '',
      supplier:         supplierCol       !== -1 ? String(r[supplierCol] ?? '') : '',
      vendorShipmentNo: vendorShipmentCol !== -1 ? String(r[vendorShipmentCol] ?? '') : '',
    });
  }
  return results;
}

// Backfills supplier/orderDate/purchaser from the Header export onto each line by PO number —
// the Lines export alone has no vendor name column, only a vendor code.
export function joinLinesWithHeaders(lines: PurchaseLine[], headers: PurchaseHeader[]): PurchaseLine[] {
  if (headers.length === 0) return lines;
  const byPO = new Map(headers.map((h) => [h.po, h]));
  return lines.map((line) => {
    const header = byPO.get(line.po);
    if (!header) return line;
    return {
      ...line,
      supplier: header.supplier || line.supplier,
      orderDate: line.orderDate ?? header.orderDate,
      purchaser: line.purchaser || header.purchaser,
    };
  });
}

export interface ParseResult {
  lines: PurchaseLine[];
  lineCount: number;
  suppliers: string[];
}

export function parsePurchaseLines(file: File): Promise<ParseResult> {
  return readXlsxFile(file).then(({ rows }) => {
    const lines = parseLinesFromRows(rows);
    const suppliers = [...new Set(lines.map((l) => l.supplier).filter(Boolean))];
    return { lines, lineCount: lines.length, suppliers };
  });
}

export function parsePurchaseHeaders(file: File): Promise<PurchaseHeader[]> {
  return readXlsxFile(file).then(({ rows }) => parseHeadersFromRows(rows));
}
