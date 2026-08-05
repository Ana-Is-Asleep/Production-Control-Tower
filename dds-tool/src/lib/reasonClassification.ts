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

// Filters out junk loss-reason text that doesn't actually describe a delay/issue — bare numbers,
// single characters, or other noise from the BC export — so it never reaches the AI classifier
// and never gets force-bucketed into "other", inflating the Root Cause counts.
export function isSubstantiveReason(raw: string): boolean {
  const normalized = normalizeReason(raw);
  if (normalized.length < 4) return false;
  if (/^\d+([.,]\d+)?$/.test(normalized)) return false; // bare number, e.g. "30"
  if (/^[^a-z]*$/.test(normalized)) return false; // no letters at all (punctuation/digits only)
  return true;
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

// Deterministic keyword-based classifier — no AI dependency, no API key, no network call, no cost.
// Rules are ordered by specificity/priority; the first match wins. Built from the real raw loss-reason
// text seen in production exports (damaged packaging, quantity shortfalls, missing labels, etc.).
const KEYWORD_RULES: { category: ReasonCategory; patterns: RegExp[] }[] = [
  {
    category: 'quality_issue',
    patterns: [/damag/, /defect/, /broken/, /overturned/, /poor condition/, /mauvais état/, /robbery/, /stolen/, /theft/],
  },
  {
    category: 'material_shortage',
    patterns: [
      /not receiv/, /no receiv/, /haven'?t receiv/, /didn'?t receiv/, /did not receiv/,
      /only received/, /instead of/, /missing (unit|item|piece|box|pallet)/, /short(age)?/, /we do not receiv/,
    ],
  },
  {
    category: 'documentation_delay',
    patterns: [/without (supplier )?label/, /without identification/, /no label/, /missing (document|paperwork|invoice)/, /packing list/],
  },
  {
    category: 'customs_delay',
    patterns: [/customs/, /duty/, /duties/, /clearance/],
  },
  {
    category: 'carrier_issue',
    patterns: [/carrier/, /courier/, /driver/, /not in truck/, /wrong truck/],
  },
  {
    category: 'booking_not_made',
    patterns: [/not booked/, /no booking/, /booking not made/, /shiptify/],
  },
  {
    category: 'transit_delay',
    patterns: [/transit/, /in truck/, /delay(ed)?/, /late/, /held up/, /traffic/, /route/],
  },
  {
    category: 'supplier_capacity',
    patterns: [/capacity/, /overbook/, /factory/, /production (delay|issue)/, /understaff/],
  },
  {
    category: 'transit_delay',
    patterns: [/transferred to (the )?new po/, /po-e-\d+/i],
  },
];

export function classifyReasonByKeywords(raw: string): ClassifiedReason {
  const normalized = normalizeReason(raw);
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(normalized))) {
      return { category: rule.category, cleaned_summary: raw.trim() };
    }
  }
  return { category: 'other', cleaned_summary: raw.trim() };
}
