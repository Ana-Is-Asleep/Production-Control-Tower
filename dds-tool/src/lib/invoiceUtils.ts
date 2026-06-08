import { addDays, startOfISOWeek, endOfISOWeek, isBefore } from 'date-fns';
import type { InvoiceRow, InvoiceKPIs, InvoiceChannel } from '../types/invoice';

// SCF = Supply Chain Finance programme
// suppliers in this programme have different payment terms, so the due date in the file
// isn't the real due date — we have to recalculate it before doing any overdue checks
//
// pretty please don't change these without Finance signing off :)
// if a supplier joins or leaves the SCF programme, update their entry here
// the group (A or B) changes the offset calculation below — check with Ana before editing
export const SCF_SUPPLIERS: Record<string, { name: string; termsDays: number; group: 'A' | 'B' }> = {
  '9800284': { name: 'AGRo International GmbH Co. KG',   termsDays: 90,  group: 'B' },
  '9800217': { name: 'B and A Quilting (UK) Ltd',         termsDays: 60,  group: 'B' },
  '9804110': { name: 'Fennobed OÜ',                       termsDays: 90,  group: 'B' },
  '9802124': { name: 'Flex 2000',                         termsDays: 90,  group: 'B' },
  '9803188': { name: 'Haoxiang Furniture MFG Co., Ltd',   termsDays: 120, group: 'B' },
  '9800218': { name: 'Kayfoam Woolfson',                  termsDays: 90,  group: 'B' },
  '9802801': { name: 'LPT d.o.o.',                        termsDays: 90,  group: 'B' },
  '9800087': { name: 'Ningbo Comfort Industry Co., Ltd.', termsDays: 90,  group: 'B' },
  '9802238': { name: 'Novaqui SA',                        termsDays: 60,  group: 'B' },
  '9802184': { name: 'Sitab PE spa',                      termsDays: 120, group: 'B' },
  '9805244': { name: 'USLEEP SAS',                        termsDays: 60,  group: 'B' },
  '9801690': { name: 'Vitafoam, Vita Cellular',           termsDays: 90,  group: 'B' },
  '9801296': { name: 'Wendre AS',                         termsDays: 90,  group: 'B' },
  '9800011': { name: 'XILINMEN FURNITURE CO., LTD',       termsDays: 150, group: 'B' },
  '9804111': { name: 'VELAMEN S.A.',                      termsDays: 18,  group: 'A' },
};

// the SCF programme works by pushing the due date forward
// the raw due date in the file is based on the original payment terms
// the real due date is: raw due date minus those terms, plus the SCF offset
// group B gets +8 days (standard SCF), group A gets +18 days (different programme rules)
// if no SCF entry for this supplier, just use the date from the file as-is
export function computeEffectiveDueDate(row: InvoiceRow): Date | null {
  if (!row.dueDate) return null;
  const scf = SCF_SUPPLIERS[row.invoiceAccount];
  if (!scf) return row.dueDate;
  const offset = scf.group === 'A' ? 18 : 8;
  return addDays(row.dueDate, -scf.termsDays + offset);
}

// end of week = Sunday, since we're working in ISO weeks
function endOfCurrentWeek(): Date {
  return endOfISOWeek(new Date());
}

export function computeKPIs(rows: InvoiceRow[]): InvoiceKPIs {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = endOfCurrentWeek();
  weekEnd.setHours(23, 59, 59, 999);

  // Card 1: overdue and waiting for approval — excludes MISSINGGR because that's a different problem
  const overdueP2w = rows.filter((r) =>
    r.invoiceStatus === 'Submitted, but not Approved' &&
    r.reasonCode !== 'MISSINGGR' &&
    r.effectiveDueDate !== null &&
    isBefore(r.effectiveDueDate, today)
  );

  // Card 2: everything pending, no date filter — gives the full picture including drafts
  const totalPending = rows.filter((r) =>
    r.invoiceStatus === 'Submitted, but not Approved' ||
    r.invoiceStatus === 'Draft'
  );

  // Card 3: due this week — includes already overdue ones since they're also before Sunday
  const dueByEndOfWeek = rows.filter((r) =>
    r.invoiceStatus === 'Submitted, but not Approved' &&
    r.effectiveDueDate !== null &&
    r.effectiveDueDate <= weekEnd
  );

  // Card 4: approved but the payment hasn't gone out yet — split so you can see what's urgent
  const approvedNotPaid = rows.filter((r) => r.invoiceStatus === 'Approved, but not paid');
  const approvedNotPaidOverdue    = approvedNotPaid.filter((r) => r.effectiveDueDate !== null && isBefore(r.effectiveDueDate, today));
  const approvedNotPaidNotYetDue  = approvedNotPaid.filter((r) => r.effectiveDueDate === null || !isBefore(r.effectiveDueDate, today));

  return { overdueP2w, totalPending, dueByEndOfWeek, approvedNotPaid, approvedNotPaidOverdue, approvedNotPaidNotYetDue };
}

// groups invoice amounts by currency and formats them for display
// e.g. "EUR 45,230 / GBP 12,100" — only shows the currency symbol if there are multiple currencies
export function formatAmountsByCurrency(rows: InvoiceRow[]): string {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    map.set(r.currency, (map.get(r.currency) ?? 0) + r.importedInvoiceAmount);
  });
  if (map.size === 0) return '—';
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, amt]) => `${cur} ${amt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)
    .join(' / ');
}

// applies the channel filter at render time — the underlying data is computed once
export function filterByChannel(rows: InvoiceRow[], channel: InvoiceChannel): InvoiceRow[] {
  if (channel === 'All') return rows;
  return rows.filter((r) => r.channel === channel);
}

export interface SupplierBreakdown {
  name: string;
  invoiceAccount: string;
  count: number;
  amountByCurrency: string;
}

// builds the per-supplier table for the overdue P2W card — sorted by count so the worst offenders are first
export function supplierBreakdown(rows: InvoiceRow[]): SupplierBreakdown[] {
  const map = new Map<string, { name: string; rows: InvoiceRow[] }>();
  rows.forEach((r) => {
    if (!map.has(r.invoiceAccount)) map.set(r.invoiceAccount, { name: r.name, rows: [] });
    map.get(r.invoiceAccount)!.rows.push(r);
  });
  return [...map.entries()]
    .map(([invoiceAccount, { name, rows: supplierRows }]) => ({
      name,
      invoiceAccount,
      count: supplierRows.length,
      amountByCurrency: formatAmountsByCurrency(supplierRows),
    }))
    .sort((a, b) => b.count - a.count);
}
