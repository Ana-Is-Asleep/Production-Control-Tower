export type SKUCategory = 'Beds' | 'Mattresses' | 'Accessories' | 'Comps/Other';

// Mirrors the spec formula:
//   IF [SKU category] = "BD" OR STARTSWITH([SKU], "EAC") THEN "Beds"
//   ELSEIF [SKU category] IN ("MA","TP","CR","CL","AC") THEN "Mattresses"
//   ELSEIF [SKU category] IN ("BL","DV","PW","HG","SS") THEN "Accessories"
//   ELSE "Comps/Other"
//
// There is no separate "SKU category" column parsed from BC today, so [SKU category] is derived
// the same way the previous implementation did: chars 2-3 (1-indexed) of the SKU string itself,
// i.e. MID([SKU], 2, 2) — e.g. EBDSF090200AAZ → "BD" → Beds.
// Don't add codes here without checking the full SKU taxonomy — source: supply chain product
// categorisation mapping doc.
export function categorizeSKU(sku: string): SKUCategory {
  const s = sku.toUpperCase();
  const skuCategory = s.substring(1, 3); // MID([SKU], 2, 2)

  if (skuCategory === 'BD' || s.startsWith('EAC')) return 'Beds';
  if (['MA', 'TP', 'CR', 'CL', 'AC'].includes(skuCategory)) return 'Mattresses';
  if (['BL', 'DV', 'PW', 'HG', 'SS'].includes(skuCategory)) return 'Accessories';
  return 'Comps/Other';
}

// order matters here — category pills in the UI follow this sequence
export const SKU_CATEGORIES: SKUCategory[] = ['Beds', 'Mattresses', 'Accessories', 'Comps/Other'];
