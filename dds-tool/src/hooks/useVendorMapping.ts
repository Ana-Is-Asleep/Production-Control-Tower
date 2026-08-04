'use client';

import { useEffect, useMemo, useState } from 'react';
import type { VendorMappingEntry } from '../app/api/vendor-mapping/route';
import { buildChinaSupplierLookup } from '../lib/chinaSupplier';

// module-level cache so the mapping is only fetched once per page load, no matter how many
// components call this hook
let cachedMapping: VendorMappingEntry[] | null = null;
let inFlight: Promise<VendorMappingEntry[]> | null = null;

async function loadMapping(): Promise<VendorMappingEntry[]> {
  if (cachedMapping) return cachedMapping;
  if (!inFlight) {
    inFlight = fetch('/api/vendor-mapping')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('vendor-mapping fetch failed'))))
      .then((data: VendorMappingEntry[]) => {
        cachedMapping = data;
        return data;
      })
      .catch((err) => {
        console.error('useVendorMapping: failed to load vendor mapping', err);
        inFlight = null; // allow a future retry
        return [];
      });
  }
  return inFlight;
}

// Fetches the vendor -> location mapping once, and exposes isChinaSupplier(vendorCode).
// Defaults to "not China" (false) for any vendor not found, or while the mapping is still
// loading, or if Airtable is briefly unavailable — this must never block/crash the dashboard.
export function useVendorMapping() {
  const [mapping, setMapping] = useState<VendorMappingEntry[]>(cachedMapping ?? []);
  const [loading, setLoading] = useState(!cachedMapping);

  useEffect(() => {
    let cancelled = false;
    if (cachedMapping) {
      setMapping(cachedMapping);
      setLoading(false);
      return;
    }
    loadMapping().then((data) => {
      if (!cancelled) {
        setMapping(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const isChinaSupplier = useMemo(() => buildChinaSupplierLookup(mapping), [mapping]);

  return { mapping, loading, isChinaSupplier };
}
