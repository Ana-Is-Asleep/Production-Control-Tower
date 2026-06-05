import * as XLSX from 'xlsx';
import type { InvoiceRow } from '../types/invoice';
import { parseDate } from './dateUtils';
import { computeEffectiveDueDate } from './invoiceUtils';

function findCol(headers: string[], needle: string): number {
  return headers.findIndex((h) => typeof h === 'string' && h.toLowerCase().trim() === needle.toLowerCase().trim());
}

// Step 1.3: deduplicate rows with same Invoice + Invoice account
// keep Paid (Posting Status), else keep most recent by Due date
function deduplicate(rows: InvoiceRow[]): InvoiceRow[] {
  const key = (r: InvoiceRow) => `${r.invoice}||${r.invoiceAccount}`;
  const map = new Map<string, InvoiceRow[]>();
  rows.forEach((r) => {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  });

  const result: InvoiceRow[] = [];
  map.forEach((group) => {
    if (group.length === 1) { result.push(group[0]); return; }
    const paid = group.filter((r) => r.postingStatus === 'Paid');
    if (paid.length > 0) { result.push(...paid); return; }
    // keep most recent by due date
    const sorted = [...group].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return b.dueDate.getTime() - a.dueDate.getTime();
    });
    result.push(sorted[0]);
  });
  return result;
}

export function parseInvoiceFile(file: File): Promise<InvoiceRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];

        if (rows.length < 2) { resolve([]); return; }

        const headerRow = rows[0] as string[];
        const col = (name: string) => findCol(headerRow, name);

        const invoiceCol         = col('Invoice');
        const accountCol         = col('Invoice account');
        const nameCol            = col('Name');
        const reasonCol          = col('Reason code');
        const amountCol          = col('Imported invoice amount');
        const dueDateCol         = col('Due date');
        const postingStatusCol   = col('Posting Status');
        const invoiceStatusCol   = col('Invoice Status');
        const currencyCol        = col('Currency');
        const archivedCol        = col('Archived');
        const costCenterCol      = col('CostCenter');

        const raw: InvoiceRow[] = [];

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] as unknown[];
          if (!r || !r[invoiceCol]) continue;

          const costCenter = String(r[costCenterCol] ?? '');
          // step 1.1: skip archived
          const archived = String(r[archivedCol] ?? '').toLowerCase() === 'yes';
          if (archived) continue;
          // step 1.2: only 02.13 (Online) or 02.42 (Offline)
          const isOnline  = costCenter.startsWith('02.13');
          const isOffline = costCenter.startsWith('02.42');
          if (!isOnline && !isOffline) continue;

          const row: InvoiceRow = {
            invoice:              String(r[invoiceCol] ?? ''),
            invoiceAccount:       String(r[accountCol] ?? ''),
            name:                 String(r[nameCol] ?? ''),
            reasonCode:           String(r[reasonCol] ?? ''),
            importedInvoiceAmount:Number(r[amountCol] ?? 0),
            dueDate:              parseDate(r[dueDateCol]),
            invoiceStatus:        String(r[invoiceStatusCol] ?? ''),
            postingStatus:        String(r[postingStatusCol] ?? ''),
            currency:             String(r[currencyCol] ?? 'EUR'),
            archived,
            costCenter,
            channel: isOnline ? 'Online' : 'Offline',
            effectiveDueDate: null, // computed below
          };

          // step 3: compute effective due date via SCF logic
          row.effectiveDueDate = computeEffectiveDueDate(row);

          raw.push(row);
        }

        // step 1.3: deduplicate
        resolve(deduplicate(raw));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// detect if an uploaded file is the invoice file
export function isInvoiceFile(wb: XLSX.WorkBook): boolean {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];
  if (!rows[0]) return false;
  const headers = rows[0] as string[];
  return headers.some((h) => typeof h === 'string' && h.toLowerCase().includes('invoice status'));
}
