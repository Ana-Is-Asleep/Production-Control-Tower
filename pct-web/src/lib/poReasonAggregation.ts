import { CATEGORY_PRIORITY, extractLineReference, type ReasonCategory } from './reasonClassification';

export interface LineForAggregation {
  po: string;
  line: number;
  qty: number;
  rawReason: string;
  // classified category for this line's own raw text, or null if blank/not substantive
  category: ReasonCategory | null;
}

export type ResolutionMethod = 'single_category' | 'quantity_majority' | 'priority_tiebreak' | 'no_reason';

export interface POAggregationResult {
  po: string;
  finalCategory: ReasonCategory | null;
  allCategoriesFound: ReasonCategory[];
  resolutionMethod: ResolutionMethod;
  linesTotal: number;
  linesWithOwnReason: number;
  linesFilledFromSibling: number;
}

// Resolves self-referencing line text ("reason in line 10000", "same as line 1", "affected by
// line 6 in this PO") to the referenced line's own category within the same PO — this always
// overrides whatever category the line itself was independently classified as, since text that
// only points at another line isn't a real root cause on its own (single-level only: if the
// referenced line is itself a reference, its already-resolved category is used, not chased further).
function resolveLineReferences(lines: LineForAggregation[]): LineForAggregation[] {
  const byPO = new Map<string, LineForAggregation[]>();
  for (const l of lines) {
    if (!byPO.has(l.po)) byPO.set(l.po, []);
    byPO.get(l.po)!.push(l);
  }

  return lines.map((l) => {
    const refLine = extractLineReference(l.rawReason);
    if (refLine === null) return l;
    const siblings = byPO.get(l.po) ?? [];
    const referenced = siblings.find((s) => s.line === refLine);
    if (!referenced || referenced.category === null) return l;
    return { ...l, category: referenced.category };
  });
}

// Aggregates line-level classifications into one final root-cause category per PO (Document No.):
// 2a) blank lines inherit any sibling line's category within the same PO
// 2b) if lines disagree, pick the category covering the largest total quantity; ties broken by
//     CATEGORY_PRIORITY (upstream/root causes first)
export function aggregatePOReasons(lines: LineForAggregation[]): Map<string, POAggregationResult> {
  const resolved = resolveLineReferences(lines);

  const byPO = new Map<string, LineForAggregation[]>();
  for (const l of resolved) {
    if (!byPO.has(l.po)) byPO.set(l.po, []);
    byPO.get(l.po)!.push(l);
  }

  const results = new Map<string, POAggregationResult>();
  for (const [po, poLines] of byPO) {
    const linesWithOwnReason = poLines.filter((l) => l.category !== null).length;

    if (linesWithOwnReason === 0) {
      results.set(po, {
        po, finalCategory: null, allCategoriesFound: [], resolutionMethod: 'no_reason',
        linesTotal: poLines.length, linesWithOwnReason: 0, linesFilledFromSibling: 0,
      });
      continue;
    }

    // Step 2a: fill blanks from any sibling line that has a category
    const siblingCategory = poLines.find((l) => l.category !== null)!.category;
    const filled = poLines.map((l) => ({ ...l, category: l.category ?? siblingCategory }));
    const linesFilledFromSibling = poLines.filter((l) => l.category === null).length;

    const allCategoriesFound = [...new Set(filled.map((l) => l.category).filter((c): c is ReasonCategory => c !== null))];

    if (allCategoriesFound.length === 1) {
      results.set(po, {
        po, finalCategory: allCategoriesFound[0], allCategoriesFound, resolutionMethod: 'single_category',
        linesTotal: poLines.length, linesWithOwnReason, linesFilledFromSibling,
      });
      continue;
    }

    // Step 2b: quantity-weighted majority across categories, tie-broken by fixed priority
    const qtyByCategory = new Map<ReasonCategory, number>();
    for (const l of filled) {
      if (!l.category) continue;
      qtyByCategory.set(l.category, (qtyByCategory.get(l.category) ?? 0) + l.qty);
    }
    const maxQty = Math.max(...qtyByCategory.values());
    const topCategories = [...qtyByCategory.entries()].filter(([, q]) => q === maxQty).map(([c]) => c);

    if (topCategories.length === 1) {
      results.set(po, {
        po, finalCategory: topCategories[0], allCategoriesFound, resolutionMethod: 'quantity_majority',
        linesTotal: poLines.length, linesWithOwnReason, linesFilledFromSibling,
      });
    } else {
      const finalCategory = CATEGORY_PRIORITY.find((c) => topCategories.includes(c)) ?? topCategories[0];
      results.set(po, {
        po, finalCategory, allCategoriesFound, resolutionMethod: 'priority_tiebreak',
        linesTotal: poLines.length, linesWithOwnReason, linesFilledFromSibling,
      });
    }
  }

  return results;
}
