// App-wide Data Dictionary — read-only reference. Every entry below is either copied verbatim
// from an existing code comment describing an approved calculation, or a raw field already
// documented in rawDataColumns.ts. Nothing here is invented: if a definition doesn't already
// exist in the codebase, it isn't included (see the KPI governance note in ActionsPage/Sidebar —
// this dictionary can't be edited by normal users and doesn't define new business logic).

import { PO_COLUMNS, LINE_COLUMNS, type DictEntry } from './rawDataColumns';
import { SOT_TARGET, OTIF_TARGET } from './kpiFormulas';
import { URGENT_WINDOW_DAYS } from './missingEsdAggregation';

export type DictCategory = 'KPI' | 'Date Field' | 'Calculated Field' | 'PO / Line Field' | 'Status';

export interface AppDictEntry {
  label: string;
  category: DictCategory;
  description: string;
  source: string;
  target?: string;
}

function categoryFor(e: DictEntry): DictCategory {
  if (e.type === 'Date') return 'Date Field';
  if (e.type === 'Calculated') return 'Calculated Field';
  return 'PO / Line Field';
}

// rawDataColumns.ts already documents every raw/calculated PO & Line field with real source
// column names — reused here as-is rather than redocumented, deduped since PO/Line share labels.
const fieldEntries: AppDictEntry[] = (() => {
  const seen = new Map<string, AppDictEntry>();
  [...PO_COLUMNS, ...LINE_COLUMNS].forEach((c) => {
    if (c.dict.type === 'Text' && (c.dict.label === 'Status')) return; // covered separately below, with real status values
    if (!seen.has(c.dict.label)) {
      seen.set(c.dict.label, { label: c.dict.label, category: categoryFor(c.dict), description: c.dict.description, source: c.dict.source });
    }
  });
  return [...seen.values()];
})();

const kpiEntries: AppDictEntry[] = [
  {
    label: 'SOT (Shipped On Time)',
    category: 'KPI',
    description: 'Per line: on-time if the relevant ship date is on/before the threshold week. Past-PGRD week: compares ASD. Future-PGRD week: compares ESD (no ESD yet = undetermined, doesn’t count either way). China suppliers: threshold is PGRD minus 1 week. A past-PGRD-week line with no ASD at all is a hard SOT failure.',
    source: 'Calculated — kpiFormulas.ts computeSOTLine()',
    target: `${SOT_TARGET}%`,
  },
  {
    label: 'OTIF (On Time In Full)',
    category: 'KPI',
    description: 'Per line: on-time = EGRD ≤ PGRD (China: EGRD ≤ PGRD minus 1 week), always PGRD vs EGRD with no past/future switching. In-full = Confirmed Qty ≥ Ordered Qty (exact, no tolerance). OTIF = on-time AND in-full.',
    source: 'Calculated — kpiFormulas.ts computeOTIFLine()',
    target: `${OTIF_TARGET}%`,
  },
  {
    label: 'Backlog',
    category: 'KPI',
    description: 'A PO is in backlog when its PGRD is in the past and it still has no ASD (Actual Shipping Date) recorded — it hasn’t shipped even though its planned-ready week has already closed.',
    source: 'Calculated — kpiFormulas.ts isBacklog()',
  },
  {
    label: 'Missing ESD',
    category: 'KPI',
    description: `A PO qualifies when every one of its lines is missing an ESD (Expected Shipping Date). Urgency: EGRD in the past = Overdue; EGRD within the next ${URGENT_WINDOW_DAYS} days = Needing Action; further out (or no EGRD) = Watchlist.`,
    source: 'Calculated — missingEsdAggregation.ts computeMissingEsdRows()/urgencyFor()',
  },
  {
    label: 'Lead Time',
    category: 'KPI',
    description: 'Production lead time = Order Date → Actual Shipping Date (only available once a line has shipped). Planned LT = Order Date → PGRD. Expected LT = Order Date → EGRD. Agreed LT is looked up per SKU category; target LT is a fixed constant applied to everyone.',
    source: 'Calculated — leadTimeUtils.ts computeLeadTime()',
  },
];

const statusEntries: AppDictEntry[] = [
  {
    label: 'PO Status',
    category: 'Status',
    description: 'Raw status text from the BC export (Confirmed Status if present, else Status) — free text, not a normalized/fixed set of values in the underlying data.',
    source: 'Status / Confirmed Status',
  },
  {
    label: 'Action Status: Open',
    category: 'Status',
    description: 'A Flag or Open Point that has not yet been resolved.',
    source: 'types/actions.ts ActionStatus',
  },
  {
    label: 'Action Status: In Progress',
    category: 'Status',
    description: 'A Flag or Open Point that someone is actively working on.',
    source: 'types/actions.ts ActionStatus',
  },
  {
    label: 'Action Status: Blocked',
    category: 'Status',
    description: 'A Flag or Open Point that cannot progress until something else is resolved.',
    source: 'types/actions.ts ActionStatus',
  },
  {
    label: 'Action Status: Closed',
    category: 'Status',
    description: 'A Flag or Open Point that has been resolved. Closing requires a Resolution Reason, kept separate from the original reason it was raised.',
    source: 'types/actions.ts ActionStatus',
  },
];

export const APP_DICT_ENTRIES: AppDictEntry[] = [...kpiEntries, ...fieldEntries, ...statusEntries];
