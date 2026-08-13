export type ActionType = 'flag' | 'open_point';
export type ActionStatus = 'open' | 'in_progress' | 'blocked' | 'closed';

export interface ActionItem {
  id: string;
  type: ActionType;
  ruleKey?: string;         // only for flags — identifies which rule triggered it
  poReference?: string;
  supplierCode?: string;
  supplierName?: string;
  description: string;      // auto-generated for flags, user-written for open points
  owner: string;             // email address, picked from the SCM list
  comment: string;
  status: ActionStatus;
  createdAt: string;         // ISO date string, set on creation, never changes
  updatedAt: string;         // ISO date string, updated on every edit
}
