import type { InvoiceRow } from '../types/invoice';
import { parseDate } from './dateUtils';
import { computeEffectiveDueDate } from './invoiceUtils';
import { readXlsxFile } from './xlsxUtils';

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
  return readXlsxFile(file).then(({ rows }) => {
    if (rows.length < 2) return [];

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
        effectiveDueDate: null,
      };

      // step 3: compute effective due date via SCF logic
      row.effectiveDueDate = computeEffectiveDueDate(row);

      raw.push(row);
    }

    return deduplicate(raw);
  });
}
