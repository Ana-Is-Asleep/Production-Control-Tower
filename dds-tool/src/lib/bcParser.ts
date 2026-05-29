import * as XLSX from 'xlsx';
import type { PurchaseHeader, PurchaseLine } from '../types';
import { parseDate } from './dateUtils';

// BC exports have 2 metadata rows before the actual headers, so we scan for "Document Type"
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const row = rows[i];
    if (Array.isArray(row) && typeof row[0] === 'string' && row[0].includes('Document Type')) {
      return i;
    }
  }
  return -1;
}

// tries sheet name first, falls back to column count — Lines always has more columns than Header
function detectFileRole(wb: XLSX.WorkBook): 'header' | 'lines' | 'unknown' {
  const name = wb.SheetNames[0].toLowerCase();
  if (name.includes('header')) return 'header';
  if (name.includes('line')) return 'lines';
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const hRow = rows.find((r) => Array.isArray(r) && r[0] === 'Document Type') as unknown[] | undefined;
  if (!hRow) return 'unknown';
  return hRow.length > 10 ? 'lines' : 'header';
}

function parseHeaders(wb: XLSX.WorkBook): PurchaseHeader[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const hIdx = findHeaderRow(rows);
  // skip if no date, happens with open POs
  if (hIdx < 0) return [];

  const results: PurchaseHeader[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || !r[1]) continue;
    results.push({
      po: String(r[1] ?? ''),
      orderDate: parseDate(r[5]),
      purchaser: String(r[9] ?? ''),
      supplier: String(r[3] ?? ''),
      vendorShipmentNo: String(r[8] ?? ''),
    });
  }
  return results;
}

function parseLines(wb: XLSX.WorkBook): Omit<PurchaseLine, 'supplier' | 'purchaser' | 'orderDate'>[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const hIdx = findHeaderRow(rows);
  if (hIdx < 0) return [];

  const results: Omit<PurchaseLine, 'supplier' | 'purchaser' | 'orderDate'>[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || !r[1]) continue;
    results.push({
      po: String(r[1] ?? ''),
      line: Number(r[2] ?? 0),
      sku: String(r[4] ?? ''),
      destination: String(r[5] ?? ''),
      egrd: parseDate(r[6]),
      qty: Number(r[7] ?? 0),
      pgrd: parseDate(r[9]),
      cqty: Number(r[10] ?? 0),
      status: String(r[11] ?? ''),
      confirmedStatus: String(r[12] ?? ''),
      esd: parseDate(r[17]),
      // pretty please don't touch this :) BC exports two columns both named "Actual Shipping Date",
      // col 15 is wrong, col 18 is the real one — always use index not name
      asd: parseDate(r[18]),
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

export function parseFiles(file1: File, file2: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const readFile = (f: File) =>
      new Promise<XLSX.WorkBook>((res, rej) => {
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

    Promise.all([readFile(file1), readFile(file2)])
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
          reject(new Error('Could not detect Header/Lines files — check sheet names'));
          return;
        }

        const headers = parseHeaders(headerWb);
        const rawLines = parseLines(linesWb);

        // join on PO number so every line gets its supplier name from the header file
        const headerMap = new Map<string, PurchaseHeader>();
        headers.forEach((h) => headerMap.set(h.po, h));

        const lines: PurchaseLine[] = rawLines.map((l) => ({
          ...l,
          supplier: headerMap.get(l.po)?.supplier ?? 'Unknown',
          purchaser: headerMap.get(l.po)?.purchaser ?? '',
          orderDate: headerMap.get(l.po)?.orderDate ?? null,
        }));

        const matched = lines.filter((l) => l.supplier !== 'Unknown').length;
        const suppliers = [...new Set(lines.map((l) => l.supplier))];

        resolve({
          lines,
          headerCount: headers.length,
          lineCount: rawLines.length,
          matchedCount: matched,
          unmatchedCount: lines.length - matched,
          suppliers,
        });
      })
      .catch(reject);
  });
}
