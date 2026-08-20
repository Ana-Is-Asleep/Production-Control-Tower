'use client';

import { useState, useMemo } from 'react';
import { lastCompletedWeek, shiftISOWeek, getISOWeek, getISOWeekYear } from '../lib/dateUtils';
import { categorizeSKU, type SKUCategory } from '../lib/skuUtils';
import { getChannel, type Channel } from '../lib/channelUtils';
import { useVendorMapping } from './useVendorMapping';
import { isSameSiteLocation } from '../lib/locationUtils';
import type { PurchaseLine } from '../types';

export const WEEK_RANGE_MIN = -13;
export const WEEK_RANGE_MAX = 5;
export const WEEK_RANGE_DEFAULT: { start: number; end: number } = { start: -7, end: 3 };

// hard floor: ignore anything with a PGRD before 2026 — keeps old/legacy PO history out of every
// section (including the AI Root Cause classifier, which shouldn't waste calls categorizing stale data)
const DATA_FLOOR = new Date(2026, 0, 1);

// Component/packaging suppliers that should be treated as Comps/Other regardless of what an
// individual SKU categorizes as — both hit the same coincidence: a real SKU starting with "EAC"
// (categorizeSKU's Beds rule, meant for actual bed-frame SKUs) that isn't actually a bed product.
const EXCLUDED_COMPONENT_VENDOR_CODES = [
  '9700148', // BekaertDeslee NV — SKU "EACON200200CAA"
  '9700016', // Komminform GmbH & Co. KG — SKUs "EACCU999999AAA"/"EACCU999999AAB" (spare packaging/stickers)
];

export interface ActiveFilters {
  weekRange: { start: number; end: number }; // offsets from current ISO week, bounded [-13, 5]
  suppliers: string[];
  channels: Channel[];
  categories: SKUCategory[];
}

export const DEFAULT_FILTERS: ActiveFilters = {
  weekRange: WEEK_RANGE_DEFAULT,
  suppliers: [],
  channels: [],
  categories: [],
};

export interface WeekInRange {
  offset: number;
  week: number;
  year: number;
  weekStart: Date;
  label: string;
  isCurrent: boolean;
  isFuture: boolean;
}

function applyFilters(lines: PurchaseLine[], filters: ActiveFilters) {
  let result = lines;
  if (filters.suppliers.length) result = result.filter(l => filters.suppliers.includes(l.supplier));
  if (filters.channels.length) result = result.filter(l => filters.channels.includes(getChannel(l.destination)));
  if (filters.categories.length) result = result.filter(l => filters.categories.includes(categorizeSKU(l.sku)));
  return result;
}

export function useFilters(rawLines: PurchaseLine[], initialFilters?: ActiveFilters) {
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters ?? DEFAULT_FILTERS);
  const { mapping } = useVendorMapping();

  // vendor's own site location code (e.g. "AQ_PT"), looked up via the Airtable vendor mapping —
  // used below to drop internal same-site transfers (pickup site == delivery site), which aren't
  // real inbound purchases
  const vendorLocationByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mapping) if (m.vendorCode && m.locationCode) map.set(m.vendorCode, m.locationCode);
    return map;
  }, [mapping]);

  // drop anything with PGRD before 2026, Comps/Other SKUs (out of scope for this version), and
  // same-site "transfers" (vendor's own location == the PO's destination, or a same-site variant
  // like AQ_PT -> AQO1_PT) — none of these are real inbound purchases, before it reaches any
  // section/calculation
  const allLines = useMemo(
    () => rawLines.filter(l => {
      if (!l.pgrd || l.pgrd < DATA_FLOOR) return false;
      if (categorizeSKU(l.sku) === 'Comps/Other') return false;
      if (EXCLUDED_COMPONENT_VENDOR_CODES.includes(l.vendorCode)) return false;
      const pickup = vendorLocationByCode.get(l.vendorCode);
      if (pickup && isSameSiteLocation(pickup, l.destination)) return false;
      return true;
    }),
    [rawLines, vendorLocationByCode]
  );

  // anchor offset 0 to the last fully completed week, not the in-progress current week —
  // otherwise SOT/OTIF for the still-open week looks artificially low (most POs haven't shipped yet)
  const { week: curWeek, year: curYear } = useMemo(() => lastCompletedWeek(), []);

  // every week (offset, week, year) covered by the active weekRange filter
  const weeksInRange = useMemo((): WeekInRange[] => {
    const weeks: WeekInRange[] = [];
    for (let offset = filters.weekRange.start; offset <= filters.weekRange.end; offset++) {
      const { week, year, weekStart } = shiftISOWeek(curWeek, curYear, offset);
      weeks.push({
        offset, week, year, weekStart,
        label: `W${String(week).padStart(2, '0')}`,
        isCurrent: offset === 0,
        isFuture: offset > 0,
      });
    }
    return weeks;
  }, [filters.weekRange, curWeek, curYear]);

  const weekKeySet = useMemo(
    () => new Set(weeksInRange.map(w => `${w.year}-${w.week}`)),
    [weeksInRange]
  );

  // lines matching supplier/channel/category selections, regardless of week — used by sections
  // that need a different week window than the global range (e.g. Backlog clearance table)
  const filteredLines = useMemo(() => applyFilters(allLines, filters), [allLines, filters]);

  // filteredLines further restricted to the active weekRange (by PGRD week)
  const weekRangeLines = useMemo(
    () => filteredLines.filter(l => l.pgrd && weekKeySet.has(`${getISOWeekYear(l.pgrd)}-${getISOWeek(l.pgrd)}`)),
    [filteredLines, weekKeySet]
  );

  const allSuppliers = useMemo(() => [...new Set(allLines.map(l => l.supplier).filter(Boolean))].sort(), [allLines]);

  return {
    filters, setFilters,
    filteredLines,
    weekRangeLines,
    weeksInRange,
    allSuppliers,
    curWeek, curYear,
  };
}
