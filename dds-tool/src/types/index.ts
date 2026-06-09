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

export interface AnnotationEntry {
  poLine: string;
  reason: ReasonCode;
  tmComment: string;
  scmComment: string;
  annotatedAt: Date;
}

export type ReasonCode =
  | 'supplier_delay'
  | 'capacity_constraints'
  | 'material_shortage'
  | 'quality_issues'
  | 'documentation_issue'
  | 'transit_delay'
  | 'booking_not_made'
  | 'data_issue'
  | 'other';

export interface WeeklyKPIPoint {
  isoWeek: string;
  weekLabel: string;
  sotPct: number | null;
  otifPct: number | null;
  sotOutOfTarget: number;
  totalLines: number;
  totalPOs: number;
  posSOT: number;          // POs with PGRD=W that shipped on time
  posBacklog: number;      // POs with PGRD=W not yet shipped as of week W
  pastPOBacklog: number;   // POs from earlier weeks still unshipped as of week W
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

export interface FilterState {
  suppliers: string[];
  timeWindow: 'weekly' | 'monthly' | 'quarterly' | 'ytd' | 'custom';
  customStart: Date | null;
  customEnd: Date | null;
  categories: string[];
  channels: string[];
  production: string[];
}
