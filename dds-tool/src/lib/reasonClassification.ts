// Fixed closed set of root-cause categories the AI classifier maps free-text loss reasons into.
export const REASON_CATEGORIES = [
  'supplier_capacity',
  'material_shortage',
  'quality_issue',
  'documentation_delay',
  'transit_delay',
  'booking_not_made',
  'carrier_issue',
  'customs_delay',
  'other',
] as const;

export type ReasonCategory = typeof REASON_CATEGORIES[number];

export function isReasonCategory(v: string): v is ReasonCategory {
  return (REASON_CATEGORIES as readonly string[]).includes(v);
}

export interface ClassifiedReason {
  category: ReasonCategory;
  cleaned_summary: string;
}

// normalizes raw free text before hashing so trivial whitespace/case differences hit the same cache entry
export function normalizeReason(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
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
