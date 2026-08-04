export interface PurchaseHeader {
  po: string;
  orderDate: Date | null;
  purchaser: string;
  supplier: string;
  vendorShipmentNo: string;
}

export interface PurchaseLine {
  po: string;
  line: number;
  sku: string;
  destination: string;
  pgrd: Date | null;
  egrd: Date | null;
  qty: number;
  cqty: number;
  asd: Date | null;   // Actual Shipping Date
  esd: Date | null;   // Expected Shipping Date (col 6 in default / col 36 in extended) — for SOT calc
  edd: Date | null;   // Expected Delivery Date from Shiptify (col 17 in default / col 33 in extended) — empty = not booked
  status: string;
  confirmedStatus: string;
  lossReasonCode: string;
  supplier: string;
  vendorCode: string; // BC "Buy-from Vendor No." — used to look up China-origin via Airtable vendor mapping
  purchaser: string;
  orderDate: Date | null;
}

export interface KPIResult {
  sotResult: boolean | null;
  sotFail: boolean;
  otif: boolean | null;
  ot: boolean | null;
  inFull: boolean | null;
  otifFail: boolean;
}

export type BacklogType = 'backlog-critical' | 'backlog-recent' | 'future-backlog' | 'on-track' | 'shipped';

export interface WeeklyKPIPoint {
  isoWeek: string;
  weekLabel: string;
  sotPct: number | null;
  otifPct: number | null;
  totalLines: number;
  totalPOs: number;
  posShipped: number;        // POs with PGRD=W that have an ASD in week W (SOT YES or NO)
  posBacklog: number;        // POs with PGRD=W not yet shipped by end of week W
  pastPOBacklog: number;     // POs from earlier PGRD weeks still unshipped as of week W (accumulated)
  posPredictedSOT: number;   // future weeks only: POs with PGRD=W and ESD ≤ PGRD (on track)
  isCurrent: boolean;
  isFuture: boolean;
}

export interface BacklogSummary {
  critical: PurchaseLine[];     // backlog >14 days
  recent: PurchaseLine[];       // backlog ≤14 days
  futureBacklog: PurchaseLine[]; // not yet overdue but flagged
}

export interface ActionItem {
  id: string;
  title: string;
  createdAt: Date;
  status: 'open' | 'in_progress' | 'done';
  linkedPO?: string;
  assignedTo: string;
}
