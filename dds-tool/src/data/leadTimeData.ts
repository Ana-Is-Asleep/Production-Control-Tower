import type { SKUCategory } from '../lib/skuUtils';

export interface AgreedLeadTime {
  supplierCode: string;
  category: SKUCategory;
  agreedLT: number; // days from order to supplier shipment
}

// sample agreed lead times — will be replaced by file upload when Airtable integration is ready
// supplier codes are [ABBREVIATION]_[COUNTRY] and need to be mapped to BC vendor names
export const AGREED_LEAD_TIMES: AgreedLeadTime[] = [
  // Mattresses
  { supplierCode: 'AQ_PT',    category: 'Mattresses', agreedLT: 46 },
  { supplierCode: 'FX_PT',    category: 'Mattresses', agreedLT: 39 },
  { supplierCode: 'IK_PL',    category: 'Mattresses', agreedLT: 25 },
  { supplierCode: 'BA_GB',    category: 'Mattresses', agreedLT: 25 },
  { supplierCode: 'CT_DE',    category: 'Mattresses', agreedLT: 25 },
  { supplierCode: 'SI_IT',    category: 'Mattresses', agreedLT: 25 },
  { supplierCode: 'KF_IE',    category: 'Mattresses', agreedLT: 46 },
  { supplierCode: 'XP_CN',    category: 'Mattresses', agreedLT: 25 },
  { supplierCode: 'SNX1_CN',  category: 'Mattresses', agreedLT: 39 },
  // Accessories
  { supplierCode: 'KALN_BG',  category: 'Accessories', agreedLT: 32 },
  { supplierCode: 'MI_ES',    category: 'Accessories', agreedLT: 60 },
  { supplierCode: 'BA_GB',    category: 'Accessories', agreedLT: 25 },
  { supplierCode: 'JCTN_PL',  category: 'Accessories', agreedLT: 39 },
  { supplierCode: 'SNX1_CN',  category: 'Accessories', agreedLT: 39 },
  { supplierCode: 'SI_IT',    category: 'Accessories', agreedLT: 32 },
  { supplierCode: 'LM_DE',    category: 'Accessories', agreedLT: 18 },
  { supplierCode: 'HANG_CN',  category: 'Accessories', agreedLT: 60 },
  { supplierCode: 'VELA_ES',  category: 'Accessories', agreedLT: 39 },
  // Beds
  { supplierCode: 'XP_CN',    category: 'Beds', agreedLT: 46 },
  { supplierCode: 'KUKA_CN',  category: 'Beds', agreedLT: 53 },
  { supplierCode: 'PADV_LT',  category: 'Beds', agreedLT: 60 },
  { supplierCode: 'RF_DE',    category: 'Beds', agreedLT: 39 },
  { supplierCode: 'HAOX_CN',  category: 'Beds', agreedLT: 53 },
  { supplierCode: 'FENN_EE',  category: 'Beds', agreedLT: 39 },
  { supplierCode: 'MD_ES',    category: 'Beds', agreedLT: 32 },
];

export const TARGET_LT = 30; // days — always 30, applies to all suppliers

// average agreed LT by category (used when supplier code can't be matched)
export function avgAgreedLTByCategory(category: SKUCategory): number {
  const rows = AGREED_LEAD_TIMES.filter((r) => r.category === category);
  if (rows.length === 0) return TARGET_LT;
  return Math.round(rows.reduce((s, r) => s + r.agreedLT, 0) / rows.length);
}
