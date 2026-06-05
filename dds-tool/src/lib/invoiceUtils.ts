import { addDays, startOfISOWeek, endOfISOWeek, isBefore, isAfter, parseISO } from 'date-fns';
import type { InvoiceRow, InvoiceKPIs, InvoiceChannel } from '../types/invoice';

// pretty please don't touch this table without checking with Ana :)
// source: SCF programme enrolment list, updated manually when suppliers join/leave
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

// SCF due date recalculation:
// Group A: Real due date = Due date - terms + 18
// Group B: Real due date = Due date - terms + 8
export function computeEffectiveDueDate(row: InvoiceRow): Date | null {
  if (!row.dueDate) return null;
  const scf = SCF_SUPPLIERS[row.invoiceAccount];
  if (!scf) return row.dueDate; // non-SCF supplier, use as-is
  const offset = scf.group === 'A' ? 18 : 8;
  return addDays(row.dueDate, -scf.termsDays + offset);
}

// end of the current ISO week (Sunday)
function endOfCurrentWeek(): Date {
  return endOfISOWeek(new Date());
}

export function computeKPIs(rows: InvoiceRow[]): InvoiceKPIs {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = endOfCurrentWeek();
  weekEnd.setHours(23, 59, 59, 999);

  // card 1: overdue pending approval (P2W) — excludes MISSINGGR
  const overdueP2w = rows.filter((r) =>
    r.invoiceStatus === 'Submitted, but not Approved' &&
    r.reasonCode !== 'MISSINGGR' &&
    r.effectiveDueDate !== null &&
    isBefore(r.effectiveDueDate, today)
  );

  // card 2: all pending (incl. Draft and MISSINGGR, no date filter)
  const totalPending = rows.filter((r) =>
    r.invoiceStatus === 'Submitted, but not Approved' ||
    r.invoiceStatus === 'Draft'
  );

  // card 3: due by end of this week — submitted + not approved, eff due date <= sunday
  const dueByEndOfWeek = rows.filter((r) =>
    r.invoiceStatus === 'Submitted, but not Approved' &&
    r.effectiveDueDate !== null &&
    (isBefore(r.effectiveDueDate, weekEnd) || r.effectiveDueDate <= weekEnd)
  );

  // card 4: approved but not paid
  const approvedNotPaid = rows.filter((r) => r.invoiceStatus === 'Approved, but not paid');
  const approvedNotPaidOverdue = approvedNotPaid.filter((r) =>
    r.effectiveDueDate !== null && isBefore(r.effectiveDueDate, today)
  );
  const approvedNotPaidNotYetDue = approvedNotPaid.filter((r) =>
    r.effectiveDueDate === null || !isBefore(r.effectiveDueDate, today)
  );

  return { overdueP2w, totalPending, dueByEndOfWeek, approvedNotPaid, approvedNotPaidOverdue, approvedNotPaidNotYetDue };
}

// group amounts by currency for display: "EUR 45,230 / GBP 12,100"
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

// apply channel filter at render time
export function filterByChannel(rows: InvoiceRow[], channel: InvoiceChannel): InvoiceRow[] {
  if (channel === 'All') return rows;
  return rows.filter((r) => r.channel === channel);
}

// supplier breakdown for card 1
export interface SupplierBreakdown {
  name: string;
  invoiceAccount: string;
  count: number;
  amountByCurrency: string;
}

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
