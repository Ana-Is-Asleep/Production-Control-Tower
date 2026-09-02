import type { VendorMappingEntry } from '../types/vendorMapping';
import staticMapping from './vendorMapping.static.json';

// Static JSON asset today, real JSON API later — set VITE_VENDOR_MAPPING_API_URL to point this
// at a real endpoint (e.g. a small serverless function that still talks to Airtable) without
// touching useVendorMapping or anything else that consumes loadVendorMapping().
//
// vendorMapping.static.json currently ships EMPTY — it needs to be regenerated from the real
// Airtable "1st Mile Data" / md_locations table (see the original Next.js route this replaced:
// src/app/api/vendor-mapping/route.ts) before this has any real vendor→location data. Until
// then, isChinaSupplier() will just default every vendor to "not China", which is the same
// safe fallback the original route's caller already used for a temporarily-unavailable mapping.
export async function loadVendorMapping(): Promise<VendorMappingEntry[]> {
  const apiUrl = import.meta.env.VITE_VENDOR_MAPPING_API_URL as string | undefined;
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl);
      if (res.ok) return (await res.json()) as VendorMappingEntry[];
    } catch (err) {
      console.error('loadVendorMapping: API fetch failed, falling back to static snapshot', err);
    }
  }
  return staticMapping as VendorMappingEntry[];
}
