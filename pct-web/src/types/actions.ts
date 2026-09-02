export type ActionType = 'flag' | 'open_point';
export type ActionStatus = 'open' | 'in_progress' | 'blocked' | 'closed';

export interface CommentLogEntry {
  text: string;
  at: string; // ISO date string
}

export interface ActionItem {
  id: string;
  type: ActionType;
  ruleKey?: string;         // only for flags — identifies which rule triggered it
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
}
