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
  asd: Date | null;
  esd: Date | null;
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
