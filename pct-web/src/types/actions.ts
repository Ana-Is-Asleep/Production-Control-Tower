export type ActionType = 'flag' | 'open_point';
export type ActionStatus = 'open' | 'in_progress' | 'blocked' | 'closed';
// Which dashboard section a flag relates to, so Actions can be clustered/filtered by bucket (e.g.
// only show Missing ESD's own flags on the Missing ESD page). Open Points have no bucket — they
// aren't tied to a specific dashboard rule.
export type ActionBucket = 'missing_esd' | 'sot_otif' | 'backlog' | 'root_cause' | 'invoicing' | 'lead_time';

// Manually-selected root cause for an R002 (missed SOT) flag — replaces free-text/AI-classified
// loss reasons as the source of truth for why a specific PO shipped late, per Ana's request that
// the Root Cause graph be driven by SCM-provided answers rather than inferred from data.
export const ROOT_CAUSE_REASONS = [
  'capacity_issues',
  'components_delay',
  'covers',
  'transport_issues',
  'container_availability',
  'inbound_capacity',
] as const;
export type RootCauseReason = typeof ROOT_CAUSE_REASONS[number];
export const ROOT_CAUSE_REASON_LABELS: Record<RootCauseReason, string> = {
  capacity_issues: 'Capacity Issues',
  components_delay: 'Components Delay',
  covers: 'Covers',
  transport_issues: 'Transport Issues',
  container_availability: 'Container Availability',
  inbound_capacity: 'Inbound Capacity',
};

export interface CommentLogEntry {
  text: string;
  at: string; // ISO date string
}

export interface ActionItem {
  id: string;
  type: ActionType;
  ruleKey?: string;         // only for flags — identifies which rule triggered it
  bucket?: ActionBucket;    // only for flags — which dashboard section this relates to
  poReference?: string;
  supplierCode?: string;
  supplierName?: string;
  description: string;      // auto-generated for flags, user-written for open points — the ORIGINAL reason this item was raised, never overwritten when closed
  owner: string;             // email address, picked from the SCM list
  comment: string;           // latest ongoing comment text (kept for backward-compat display)
  commentLog?: CommentLogEntry[]; // full comment history — every comment ever entered, oldest first
  resolutionReason?: string; // why/how this item was closed — distinct from `description` (why it was raised) and from ongoing `comment`s. Set only when status becomes 'closed'.
  status: ActionStatus;
  createdAt: string;         // ISO date string, set on creation, never changes
  updatedAt: string;         // ISO date string, updated on every edit
  closedAt?: string;         // ISO date string, set the moment status first becomes 'closed'; cleared if reopened
  dueDate?: string;          // ISO date string — optional target resolution date, set manually (mainly for Open Points, which have no auto-derived urgency the way rule-based Flags do)
  rootCauseReason?: RootCauseReason; // required to close an R002 (missed SOT) flag
  missingComponent?: string;         // only when rootCauseReason === 'components_delay' — which component is missing (mandatory)
  missingComponentSupplier?: string; // only when rootCauseReason === 'components_delay' — the component supplier (optional; auto-filled from missingComponentPoNumber when possible)
  missingComponentPoNumber?: string; // only when rootCauseReason === 'components_delay' — the component supplier's PO number (optional)
  coverPoNumber?: string;            // only when rootCauseReason === 'covers' — the delayed cover-supplier PO number
}
