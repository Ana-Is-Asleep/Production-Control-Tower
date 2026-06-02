export type SKUCategory = 'Beds' | 'Mattresses' | 'Accessories' | 'Comps/Other';

// all categories use MID(sku, 2, 2) = chars at index 1-2 (1-indexed position 2, length 2)
// e.g. EBDSF090200AAZ → mid22 = "BD" → Beds
export function categorizeSKU(sku: string): SKUCategory {
  const s = sku.toUpperCase();
  const mid22 = s.substring(1, 3);

  if (mid22 === 'BD' || s.startsWith('EAC')) return 'Beds';
  if (['MA', 'TP', 'CR', 'CL', 'AC'].includes(mid22)) return 'Mattresses';
  if (['BL', 'DV', 'PW', 'HG', 'SS'].includes(mid22)) return 'Accessories';
  return 'Comps/Other';
}

export const SKU_CATEGORIES: SKUCategory[] = ['Beds', 'Mattresses', 'Accessories', 'Comps/Other'];
