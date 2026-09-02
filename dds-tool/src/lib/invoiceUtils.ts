import { addDays, addWeeks, differenceInCalendarDays, endOfISOWeek, isBefore } from 'date-fns';
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

  // Card 5: blocked on goods receipt — still pending, but held up by MISSINGGR specifically (the
  // exact inverse of Card 1's exclusion, not a new classification rule)
  const missingGR = rows.filter((r) =>
    (r.invoiceStatus === 'Submitted, but not Approved' || r.invoiceStatus === 'Draft') &&
    r.reasonCode === 'MISSINGGR'
  );
  const missingGROverdue = missingGR.filter((r) => r.effectiveDueDate !== null && isBefore(r.effectiveDueDate, today));

  return { overdueP2w, totalPending, dueByEndOfWeek, approvedNotPaid, approvedNotPaidOverdue, approvedNotPaidNotYetDue, missingGR, missingGROverdue };
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

// dashboard's global Supplier filter uses PurchaseLine supplier names, which don't always match
// the invoice file's Name field exactly — fuzzy substring match in both directions as a bridge
export function filterBySupplierNames(rows: InvoiceRow[], supplierNames: string[]): InvoiceRow[] {
  if (supplierNames.length === 0) return rows;
  return rows.filter((r) =>
    supplierNames.some((s) => r.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.name.toLowerCase()))
  );
}

export interface AgingBucket {
  label: string;
  rows: InvoiceRow[];
  amountByCurrency: string;
}

const AGING_RANGES: { label: string; min: number; max: number | null }[] = [
  { label: 'Not yet due', min: -Infinity, max: 0 },
  { label: '1–7 days overdue', min: 1, max: 7 },
  { label: '8–14 days overdue', min: 8, max: 14 },
  { label: '15–30 days overdue', min: 15, max: 30 },
  { label: '> 30 days overdue', min: 31, max: null },
];

// Pending-approval aging — scoped to the same "still awaiting approval, not blocked by Missing GR"
// population Card 1's overdue check draws from, just split by how many days overdue (or not yet
// due) instead of a single before/after-today cut. Rows with no effective due date can't be aged.
export function computeAgingBuckets(rows: InvoiceRow[], today: Date = new Date()): AgingBucket[] {
  const scoped = rows.filter((r) => r.invoiceStatus === 'Submitted, but not Approved' && r.reasonCode !== 'MISSINGGR' && r.effectiveDueDate !== null);
  const buckets: AgingBucket[] = AGING_RANGES.map((r) => ({ label: r.label, rows: [], amountByCurrency: '' }));

  scoped.forEach((r) => {
    const days = differenceInCalendarDays(today, r.effectiveDueDate!);
    const idx = AGING_RANGES.findIndex((rg) => days >= rg.min && (rg.max === null || days <= rg.max));
    if (idx !== -1) buckets[idx].rows.push(r);
  });

  buckets.forEach((b) => { b.amountByCurrency = formatAmountsByCurrency(b.rows); });
  return buckets;
}

export interface DueDateOutlookBucket {
  label: string;
  rows: InvoiceRow[];
  amountByCurrency: string;
}

// Forward-looking pending exposure by effective due date — scoped to the full "still requiring
// processing" population (Card 2's totalPending), so it includes Drafts too, not just the
// awaiting-approval subset the aging chart uses. Overdue rows only ever land in the Overdue
// bucket, never double-counted into a future window.
export function computeDueDateOutlook(rows: InvoiceRow[], today: Date = new Date()): DueDateOutlookBucket[] {
  const thisWeekEnd = endOfISOWeek(today);
  const nextWeekEnd = endOfISOWeek(addWeeks(today, 1));
  const fourWeeksEnd = endOfISOWeek(addWeeks(today, 4));

  const buckets: Record<string, InvoiceRow[]> = { Overdue: [], 'This Week': [], 'Next Week': [], '2–4 Weeks': [], Later: [] };
  rows.forEach((r) => {
    if (!r.effectiveDueDate) return;
    if (isBefore(r.effectiveDueDate, today)) buckets.Overdue.push(r);
    else if (r.effectiveDueDate <= thisWeekEnd) buckets['This Week'].push(r);
    else if (r.effectiveDueDate <= nextWeekEnd) buckets['Next Week'].push(r);
    else if (r.effectiveDueDate <= fourWeeksEnd) buckets['2–4 Weeks'].push(r);
    else buckets.Later.push(r);
  });

  return Object.entries(buckets).map(([label, bRows]) => ({ label, rows: bRows, amountByCurrency: formatAmountsByCurrency(bRows) }));
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

export interface SupplierExposureRow {
  supplier: string;
  invoiceAccount: string;
  pendingCount: number;
  pendingAmountByCurrency: string;
  overdueCount: number;
  overdueAmountByCurrency: string;
  missingGRCount: number;
  oldestOverdueDays: number | null;
}

// Richer per-supplier exposure table — cross-references the SAME already-computed KPI
// populations (totalPending / overdueP2w / missingGR), just grouped by supplier. No new
// classification logic, only aggregation.
export function computeSupplierExposure(kpis: InvoiceKPIs, today: Date = new Date()): SupplierExposureRow[] {
  const bySupplier = new Map<string, { name: string; pending: InvoiceRow[]; overdue: InvoiceRow[]; missingGR: InvoiceRow[] }>();
  const ensure = (r: InvoiceRow) => {
    if (!bySupplier.has(r.invoiceAccount)) bySupplier.set(r.invoiceAccount, { name: r.name, pending: [], overdue: [], missingGR: [] });
    return bySupplier.get(r.invoiceAccount)!;
  };
  kpis.totalPending.forEach((r) => ensure(r).pending.push(r));
  kpis.overdueP2w.forEach((r) => ensure(r).overdue.push(r));
  kpis.missingGR.forEach((r) => ensure(r).missingGR.push(r));

  // Sort rank only — a naive cross-currency sum used purely to order rows, never displayed as a
  // KPI value (the displayed amounts stay per-currency via formatAmountsByCurrency).
  const sortRank = (rows: InvoiceRow[]) => rows.reduce((s, r) => s + r.importedInvoiceAmount, 0);

  return [...bySupplier.entries()]
    .map(([invoiceAccount, g]) => {
      const oldestOverdueDays = g.overdue.length
        ? Math.max(...g.overdue.map((r) => (r.effectiveDueDate ? differenceInCalendarDays(today, r.effectiveDueDate) : 0)))
        : null;
      return {
        supplier: g.name,
        invoiceAccount,
        pendingCount: g.pending.length,
        pendingAmountByCurrency: formatAmountsByCurrency(g.pending),
        overdueCount: g.overdue.length,
        overdueAmountByCurrency: formatAmountsByCurrency(g.overdue),
        missingGRCount: g.missingGR.length,
        oldestOverdueDays,
        _overdueSortRank: sortRank(g.overdue),
      };
    })
    .sort((a, b) => b._overdueSortRank - a._overdueSortRank)
    .map(({ _overdueSortRank, ...row }) => row);
}
