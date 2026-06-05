export interface InvoiceRow {
  invoice: string;
  invoiceAccount: string;
  name: string;
  reasonCode: string;
  importedInvoiceAmount: number;
  dueDate: Date | null;
  invoiceStatus: string;
  postingStatus: string;
  currency: string;
  archived: boolean;
  costCenter: string;
  // computed after parsing
  channel: 'Online' | 'Offline' | null;
  effectiveDueDate: Date | null;
}

export interface InvoiceKPIs {
  // Card 1: Overdue Pending Approval (P2W)
  overdueP2w: InvoiceRow[];
  // Card 2: Total Pending (all statuses incl. Draft + MissingGR)
  totalPending: InvoiceRow[];
  // Card 3: Due by end of this week
  dueByEndOfWeek: InvoiceRow[];
  // Card 4: Approved but not paid
  approvedNotPaid: InvoiceRow[];
  approvedNotPaidOverdue: InvoiceRow[];
  approvedNotPaidNotYetDue: InvoiceRow[];
}

export type InvoiceChannel = 'All' | 'Online' | 'Offline';
