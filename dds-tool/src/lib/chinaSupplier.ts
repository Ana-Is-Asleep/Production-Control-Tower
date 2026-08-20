import type { VendorMappingEntry } from '../app/api/vendor-mapping/route';

// LOMO_DE is a stated exception — despite its "_DE" suffix, it's treated as China-origin too.
const CHINA_LOCATION_EXCEPTIONS = ['LOMO_DE'];

// A vendor is "China-origin" if its vendor_code maps to a location_code ending in "_CN", or is
// one of the stated exceptions above.
export function buildChinaSupplierLookup(mapping: VendorMappingEntry[]): (vendorCode: string) => boolean {
  const chinaCodes = new Set(
    mapping
      .filter((m) => {
        const loc = m.locationCode.toUpperCase();
        return loc.endsWith('_CN') || CHINA_LOCATION_EXCEPTIONS.includes(loc);
      })
      .map((m) => m.vendorCode)
  );
  return (vendorCode: string) => (vendorCode ? chinaCodes.has(vendorCode) : false);
}
