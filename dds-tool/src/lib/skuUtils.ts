export type SKUCategory = 'Beds' | 'Mattresses' | 'Accessories' | 'Comps/Other';

// category is derived from SKU structure — mid(2,2) is chars at index 1-2, category is first 2 chars
export function categorizeSKU(sku: string): SKUCategory {
  const s = sku.toUpperCase();
  const mid22 = s.substring(1, 3);
  const cat = s.substring(0, 2);

  if (mid22 === 'BD' || s.startsWith('EAC')) return 'Beds';
  if (['MA', 'TP', 'CR', 'CL', 'AC'].includes(cat)) return 'Mattresses';
  if (['BL', 'DV', 'PW', 'HG', 'SS'].includes(cat)) return 'Accessories';
  return 'Comps/Other';
}

export const SKU_CATEGORIES: SKUCategory[] = ['Beds', 'Mattresses', 'Accessories', 'Comps/Other'];
