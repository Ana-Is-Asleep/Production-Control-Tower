import type { PurchaseLine } from '../types';
import { parseDate } from './dateUtils';
import { readXlsxFile } from './xlsxUtils';

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const r = rows[i];
    if (Array.isArray(r) && typeof r[0] === 'string' && r[0].toLowerCase().includes('document no')) return i;
  }
  return -1;
}

function parseLines(rows: unknown[][]): PurchaseLine[] {
  const hIdx = findHeaderRow(rows);
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
  const purchaserCol  = col('purchaser code') !== -1 ? col('purchaser code') : col('purchaser');
  const orderDateCol  = col('order date');
  const esdCol        = col('expected shipping date') !== -1 ? col('expected shipping date') : col('expected receipt date');
  const eddCol        = col('expected delivery date');
  const asdCol        = (() => {
    const all: number[] = [];
    headerRow.forEach((h, i) => { if (h.toLowerCase().trim() === 'actual shipping date') all.push(i); });
    return all.length >= 1 ? all[all.length - 1] : 18;
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
      purchaser:       purchaserCol  !== -1 ? String(r[purchaserCol]  ?? '') : '',
      orderDate:       orderDateCol  !== -1 ? parseDate(r[orderDateCol]) : null,
    });
  }
  return results;
}

export interface ParseResult {
  lines: PurchaseLine[];
  lineCount: number;
  suppliers: string[];
}

export function parsePurchaseLines(file: File): Promise<ParseResult> {
  return readXlsxFile(file).then(({ rows }) => {
    const lines = parseLines(rows);
    const suppliers = [...new Set(lines.map((l) => l.supplier).filter(Boolean))];
    return { lines, lineCount: lines.length, suppliers };
  });
}
