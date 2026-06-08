export type SKUCategory = 'Beds' | 'Mattresses' | 'Accessories' | 'Comps/Other';

// SKU structure: first char = region prefix (e.g. E = Europe), then chars 2-3 = product category code
// e.g. EBDSF090200AAZ → mid(2,2) = "BD" → Beds
// this matches the Tableau formula used in the source reporting
export function categorizeSKU(sku: string): SKUCategory {
  const s = sku.toUpperCase();
  const mid22 = s.substring(1, 3); // chars at position 2-3 (1-indexed), same as MID([SKU], 2, 2)

  // pretty please don't add codes here without checking the full SKU taxonomy :)
  // source: supply chain product categorisation mapping doc
  if (mid22 === 'BD' || s.startsWith('EAC')) return 'Beds';
  if (['MA', 'TP', 'CR', 'CL', 'AC'].includes(mid22)) return 'Mattresses';
  if (['BL', 'DV', 'PW', 'HG', 'SS'].includes(mid22)) return 'Accessories';
  return 'Comps/Other';
}

// order matters here — category pills in the UI follow this sequence
export const SKU_CATEGORIES: SKUCategory[] = ['Beds', 'Mattresses', 'Accessories', 'Comps/Other'];
