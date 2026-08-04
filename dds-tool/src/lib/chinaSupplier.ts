import type { VendorMappingEntry } from '../app/api/vendor-mapping/route';

// A vendor is "China-origin" if its vendor_code maps to a location_code ending in "_CN".
export function buildChinaSupplierLookup(mapping: VendorMappingEntry[]): (vendorCode: string) => boolean {
  const chinaCodes = new Set(
    mapping.filter((m) => m.locationCode.toUpperCase().endsWith('_CN')).map((m) => m.vendorCode)
  );
  return (vendorCode: string) => (vendorCode ? chinaCodes.has(vendorCode) : false);
}
