import * as XLSX from 'xlsx';
import type { PurchaseHeader, PurchaseLine } from '../types';
import { parseDate } from './dateUtils';

// BC exports sometimes have metadata rows before the actual headers, so we scan for "Document Type"
// The newer single-file export starts with "Document No." in row 0 directly
function findHeaderRow(rows: unknown[][]): number {
  const r0 = rows[0];
  if (Array.isArray(r0) && typeof r0[0] === 'string' && r0[0].toLowerCase().includes('document no')) {
    return 0;
  }
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const row = rows[i];
    if (Array.isArray(row) && typeof row[0] === 'string' && row[0].includes('Document Type')) {
      return i;
    }
  }
  return -1;
}

// tries sheet name, then row content — Lines always has more columns than Header
// new single-file export starts with "Document No." (not "Document Type")
function detectFileRole(wb: XLSX.WorkBook): 'header' | 'lines' | 'unknown' {
  const name = wb.SheetNames[0].toLowerCase();
  if (name.includes('header')) return 'header';
  if (name.includes('line')) return 'lines';
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  // new single-file format: first row starts with "Document No." → Lines
  const row0 = rows[0] as unknown[] | undefined;
  if (Array.isArray(row0) && typeof row0[0] === 'string' && row0[0].toLowerCase().includes('document no')) {
    return 'lines';
  }
  // old format: scan for "Document Type" header row — Lines has >10 cols, Header has ≤10
  const hRow = rows.find((r) => Array.isArray(r) && r[0] === 'Document Type') as unknown[] | undefined;
  if (!hRow) return 'unknown';
  return hRow.length > 10 ? 'lines' : 'header';
}

function parseHeaders(wb: XLSX.WorkBook): PurchaseHeader[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const hIdx = findHeaderRow(rows);
  if (hIdx < 0) return [];

  // find columns by name — BC exports vary so we don't hardcode indices here
  const headerRow = rows[hIdx] as string[];
  const col = (needle: string) => headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes(needle.toLowerCase()));

  const vendorNameCol  = col('vendor name');
  const poCol          = col('no.');
  const purchaserCol   = col('purchaser');
  const orderDateCol   = col('order date') !== -1 ? col('order date') : col('document date');
  const shipmentCol    = col('vendor shipment');

  const results: PurchaseHeader[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || !r[1]) continue;
    results.push({
      po:              String(r[poCol          !== -1 ? poCol          : 1] ?? ''),
      orderDate:       parseDate(r[orderDateCol !== -1 ? orderDateCol  : 5]),
      purchaser:       String(r[purchaserCol   !== -1 ? purchaserCol   : 9] ?? ''),
      // pretty please don't change to a fixed index :) vendor name column moves between BC versions
      supplier:        String(r[vendorNameCol  !== -1 ? vendorNameCol  : 3] ?? ''),
      vendorShipmentNo:String(r[shipmentCol    !== -1 ? shipmentCol    : 8] ?? ''),
    });
  }
  return results;
}

// returns full PurchaseLine — supplier/purchaser/orderDate come from the file if available (new format)
// or get filled in later via header join (old two-file format)
function parseLines(wb: XLSX.WorkBook): PurchaseLine[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const hIdx = findHeaderRow(rows);
  if (hIdx < 0) return [];

  // find columns by name — supports both the 20-col default export and the 46-col extended export
  // we cast to string[] and sanitise below to avoid prototype pollution from crafted XLSX files
  const headerRow = (rows[hIdx] as unknown[]).map(h => (typeof h === 'string' ? h : ''));
  const col = (needle: string) => headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().trim() === needle.toLowerCase().trim());

  const poCol           = col('document no.');
  const lineCol         = col('line no.');
  const skuCol          = col('no.');
  const destCol         = col('location code');
  const egrdCol         = col('expected goods ready date') !== -1 ? col('expected goods ready date') : col('expected receipt date');
  const qtyCol          = col('quantity');
  const pgrdCol         = col('planned receipt date');
  const cqtyCol         = col('confirmed quantity');
  const statusCol       = col('status');
  const confStatusCol   = col('confirmed status');
  const lossReasonCol   = col('loss reason code');
  // new single-file export includes vendor name directly on each line
  const vendorNameCol   = col('vendor name');
  const purchaserCol    = col('purchaser code') !== -1 ? col('purchaser code') : col('purchaser');
  const orderDateCol    = col('order date');
  // pretty please don't touch this :) BC exports two files with different column counts
  // 46-col extended file has "Expected Shipping Date" (col 36) — always prefer it over "Expected Delivery Date"
  // extended file: "Expected Shipping Date" (col 36) = 12 Jun ✓
  // default file: "Expected Receipt Date" (col 6) = 12 Jun ✓ (same value, different name)
  // never fall back to "Expected Delivery Date" — that's EDD (17 Jun), not ESD
  const esdCol = col('expected shipping date') !== -1 ? col('expected shipping date') : col('expected receipt date');
  // EDD = Expected Delivery Date from Shiptify — empty means no booking (used for "Not Booked" check)
  const eddCol = col('expected delivery date');
  // ASD: col 18 in 20-col file (second "Actual Shipping Date"), col 34 in 46-col file, col 34 in new single-file
  const asdCol          = (() => {
    const all: number[] = [];
    headerRow.forEach((h, i) => { if (typeof h === 'string' && h.toLowerCase().trim() === 'actual shipping date') all.push(i); });
    // always use the LAST occurrence — old extended file has two ASD columns, new file has one
    return all.length >= 1 ? all[all.length - 1] : 18;
  })();

  const results: PurchaseLine[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || !(r[poCol !== -1 ? poCol : 1])) continue;
    results.push({
      po:              String(r[poCol !== -1 ? poCol : 1] ?? ''),
      line:            Number(r[lineCol !== -1 ? lineCol : 2] ?? 0),
      sku:             String(r[skuCol !== -1 ? skuCol : 9] ?? ''),
      destination:     String(r[destCol !== -1 ? destCol : 11] ?? ''),
      egrd:            parseDate(r[egrdCol !== -1 ? egrdCol : 6]),
      qty:             Number(r[qtyCol !== -1 ? qtyCol : 16] ?? 0),
      pgrd:            parseDate(r[pgrdCol !== -1 ? pgrdCol : 30]),
      cqty:            Number(r[cqtyCol !== -1 ? cqtyCol : 23] ?? 0),
      status:          String(r[statusCol !== -1 ? statusCol : 5] ?? ''),
      confirmedStatus: String(r[confStatusCol !== -1 ? confStatusCol : 41] ?? ''),
      lossReasonCode:  String(r[lossReasonCol !== -1 ? lossReasonCol : -1] ?? '').trim(),
      esd:             parseDate(r[esdCol !== -1 ? esdCol : 36]),
      edd:             parseDate(r[eddCol !== -1 ? eddCol : 33]),
      // pretty please don't touch this :) BC exports two columns both named "Actual Shipping Date"
      // we always use the LAST occurrence (col 18 in 20-col file, col 34 in 46-col/new single-file)
      asd:             parseDate(r[asdCol]),
      // filled here if the new single-file format is used, otherwise overwritten by header join
      supplier:        vendorNameCol !== -1 ? String(r[vendorNameCol] ?? '') : '',
      purchaser:       purchaserCol !== -1 ? String(r[purchaserCol] ?? '') : '',
      orderDate:       orderDateCol !== -1 ? parseDate(r[orderDateCol]) : null,
    });
  }
  return results;
}

export interface ParseResult {
  lines: PurchaseLine[];
  headerCount: number;
  lineCount: number;
  matchedCount: number;
  unmatchedCount: number;
  suppliers: string[];
}

function readWorkbook(f: File): Promise<XLSX.WorkBook> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // cellFormula + cellHTML disabled on purpose, stops formula injection from crafted files
        const wb = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false });
        res(wb);
      } catch (err) {
        rej(err);
      }
    };
    reader.onerror = rej;
    reader.readAsArrayBuffer(f);
  });
}

// new single-file export — vendor name is on each line, no header join needed
export function parseSingleFile(file: File): Promise<ParseResult> {
  return readWorkbook(file).then((wb) => {
    const lines = parseLines(wb);
    const suppliers = [...new Set(lines.map((l) => l.supplier).filter(Boolean))];
    const matched = lines.filter((l) => !!l.supplier).length;
    return {
      lines,
      headerCount: 0,
      lineCount: lines.length,
      matchedCount: matched,
      unmatchedCount: lines.length - matched,
      suppliers,
    };
  });
}

export function parseFiles(file1: File, file2: File): Promise<ParseResult> {
  return Promise.all([readWorkbook(file1), readWorkbook(file2)])
    .then(([wb1, wb2]) => {
      const role1 = detectFileRole(wb1);
      const role2 = detectFileRole(wb2);

      let headerWb: XLSX.WorkBook;
      let linesWb: XLSX.WorkBook;

      if (role1 === 'header' && role2 === 'lines') {
        headerWb = wb1;
        linesWb = wb2;
      } else if (role1 === 'lines' && role2 === 'header') {
        headerWb = wb2;
        linesWb = wb1;
      } else {
        throw new Error('Could not detect Header/Lines files — check sheet names');
      }

      const headers = parseHeaders(headerWb);
      const rawLines = parseLines(linesWb);

      // if vendor name is already in the lines file, skip the join
      const hasVendorNames = rawLines.some((l) => !!l.supplier);
      if (hasVendorNames) {
        const suppliers = [...new Set(rawLines.map((l) => l.supplier).filter(Boolean))];
        return {
          lines: rawLines,
          headerCount: 0,
          lineCount: rawLines.length,
          matchedCount: rawLines.filter((l) => !!l.supplier).length,
          unmatchedCount: rawLines.filter((l) => !l.supplier).length,
          suppliers,
        };
      }

      // join on PO number so every line gets its supplier name from the header file
      const headerMap = new Map<string, PurchaseHeader>();
      headers.forEach((h) => headerMap.set(h.po, h));

      const lines: PurchaseLine[] = rawLines.map((l) => ({
        ...l,
        supplier:  headerMap.get(l.po)?.supplier  ?? 'Unknown',
        purchaser: headerMap.get(l.po)?.purchaser ?? '',
        orderDate: headerMap.get(l.po)?.orderDate ?? null,
      }));

      const matched = lines.filter((l) => l.supplier !== 'Unknown').length;
      const suppliers = [...new Set(lines.map((l) => l.supplier))];

      return {
        lines,
        headerCount: headers.length,
        lineCount: rawLines.length,
        matchedCount: matched,
        unmatchedCount: lines.length - matched,
        suppliers,
      };
    });
}
