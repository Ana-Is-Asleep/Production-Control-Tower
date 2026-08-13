// 12-category taxonomy for PO loss-reason root-cause classification (line-level, before
// PO-level aggregation in poReasonAggregation.ts). Keys are stable identifiers used in code;
// labels are the human-readable form shown in the UI.
export const REASON_CATEGORIES = [
  'component_supply_delay',
  'production_capacity_constraint',
  'holiday_plant_shutdown',
  'transport_warehouse_slot_capacity',
  'truck_rounding_pallet_configuration_error',
  'po_reshuffling_erp_issue',
  'it_issue',
  'forecast_order_quantity_mismatch',
  'quality_issue',
  'machine_production_issue',
  'administrative_planning_error',
  'other_unclear',
] as const;

export type ReasonCategory = typeof REASON_CATEGORIES[number];

export const REASON_CATEGORY_LABELS: Record<ReasonCategory, string> = {
  component_supply_delay: 'Component Supply Delay',
  production_capacity_constraint: 'Production Capacity Constraint',
  holiday_plant_shutdown: 'Holiday/Plant Shutdown',
  transport_warehouse_slot_capacity: 'Transport/Warehouse Slot Capacity',
  truck_rounding_pallet_configuration_error: 'Truck Rounding/Pallet Configuration Error',
  po_reshuffling_erp_issue: 'PO Reshuffling/Rescheduling/ERP System Issue',
  it_issue: 'IT Issue',
  forecast_order_quantity_mismatch: 'Forecast/Order Quantity Mismatch',
  quality_issue: 'Quality Issue',
  machine_production_issue: 'Machine/Production Issue',
  administrative_planning_error: 'Administrative/Planning Error',
  other_unclear: 'Other/Unclear',
};

// Tie-break priority when quantity-weighted majority is tied — upstream/root causes first,
// since they're typically the actual driver even when a downstream symptom is also logged.
export const CATEGORY_PRIORITY: ReasonCategory[] = [
  'component_supply_delay',
  'production_capacity_constraint',
  'quality_issue',
  'machine_production_issue',
  'holiday_plant_shutdown',
  'forecast_order_quantity_mismatch',
  'truck_rounding_pallet_configuration_error',
  'transport_warehouse_slot_capacity',
  'po_reshuffling_erp_issue',
  'it_issue',
  'administrative_planning_error',
  'other_unclear',
];

export type ComponentType = 'Cover/Textile' | 'Fabric' | 'Springs/Metal' | 'TPE';

export function isReasonCategory(v: string): v is ReasonCategory {
  return (REASON_CATEGORIES as readonly string[]).includes(v);
}

export interface ClassifiedReason {
  category: ReasonCategory;
  cleaned_summary: string;
  componentType?: ComponentType | null;
  secondaryCategory?: ReasonCategory | null;
  secondaryComponentType?: ComponentType | null;
  supplierTag?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  // set when this line's text only pointed at another line ("reason in line 10000") and its
  // category was inherited from that referenced line rather than classified directly
  resolutionNote?: 'resolved_from_line_reference' | null;
}

// normalizes raw free text before hashing so trivial whitespace/case differences hit the same cache entry
export function normalizeReason(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Filters out junk loss-reason text that doesn't actually describe a delay/issue — bare numbers,
// single characters, or other noise from the BC export — so it never reaches the AI classifier
// and never gets force-bucketed into "other_unclear", inflating the Root Cause counts.
export function isSubstantiveReason(raw: string): boolean {
  const normalized = normalizeReason(raw);
  if (normalized.length < 4) return false;
  if (/^\d+([.,]\d+)?$/.test(normalized)) return false; // bare number, e.g. "30"
  if (/^[^a-z]*$/.test(normalized)) return false; // no letters at all (punctuation/digits only)
  return true;
}

// Detects text that only points at another line in the same PO instead of describing an actual
// cause — e.g. "reason in line 10000", "see line 20000", "same as line 1", "as per line 3".
// When matched, the referenced line's own classification should be used instead (rule 6),
// tagged with resolutionNote: 'resolved_from_line_reference'.
export function extractLineReference(raw: string): number | null {
  const normalized = normalizeReason(raw);
  const m = normalized.match(/(?:reason in|see|same as|as per|refer(?:s)? to)\s+line\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

// Basic string hash (djb2 variant) — no crypto dependency needed, this is only a cache key.
export function hashReason(raw: string): string {
  const normalized = normalizeReason(raw);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

// Deterministic keyword-based classifier — used only when the AI call is unavailable/fails.
// Rules are ordered by specificity/priority; the first match wins.
const KEYWORD_RULES: { category: ReasonCategory; componentType?: ComponentType; patterns: RegExp[] }[] = [
  { category: 'component_supply_delay', componentType: 'Cover/Textile', patterns: [/cover/, /textile/, /mattress bag/] },
  { category: 'component_supply_delay', componentType: 'Fabric', patterns: [/fabric/] },
  { category: 'component_supply_delay', componentType: 'Springs/Metal', patterns: [/spring/, /\bl&p\b/, /metal/] },
  { category: 'component_supply_delay', componentType: 'TPE', patterns: [/\btpe\b/] },
  { category: 'component_supply_delay', patterns: [/not receiv/, /no receiv/, /haven'?t receiv/, /didn'?t receiv/, /did not receiv/, /only received/, /missing (unit|item|piece|box|pallet)/, /short(age)?/] },
  { category: 'quality_issue', patterns: [/damag/, /defect/, /broken/, /overturned/, /poor condition/, /mauvais état/, /robbery/, /stolen/, /theft/, /quality/] },
  { category: 'machine_production_issue', patterns: [/machine/, /equipment/, /technical issue/] },
  { category: 'production_capacity_constraint', patterns: [/over ?capacity/, /capacity/, /overbook/, /understaff/, /capacidad/] },
  { category: 'holiday_plant_shutdown', patterns: [/holiday/, /shutdown/, /plant closure/, /shut down/] },
  { category: 'truck_rounding_pallet_configuration_error', patterns: [/truck rounding/, /pallet quantity/, /wrong multiple/, /lack of space/, /not enough space/, /truck.*(full|space)/, /exceed(ed)? the capacity of the truck/] },
  { category: 'transport_warehouse_slot_capacity', patterns: [/no (inbound )?slot/, /no available slot/, /frigo/, /cooling (ctnr|container|unit)/] },
  { category: 'po_reshuffling_erp_issue', patterns: [/reshuffl/, /reschuffl/, /rescheduling/, /reorganization/, /moved to po/, /erp/] },
  { category: 'it_issue', patterns: [/\bit issue/, /system(s)? (down|failure|error)/] },
  { category: 'forecast_order_quantity_mismatch', patterns: [/forecast/, /fcast/, /order.*higher than/, /confirmed \d+ in file/] },
  { category: 'administrative_planning_error', patterns: [/lead ?time/, /received later/, /missed in po placement/, /planning error/] },
];

export function classifyReasonByKeywords(raw: string): ClassifiedReason {
  const normalized = normalizeReason(raw);
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.length === 0) continue;
    if (rule.patterns.some((p) => p.test(normalized))) {
      return { category: rule.category, cleaned_summary: raw.trim(), componentType: rule.componentType ?? null };
    }
  }
  return { category: 'other_unclear', cleaned_summary: raw.trim() };
}
