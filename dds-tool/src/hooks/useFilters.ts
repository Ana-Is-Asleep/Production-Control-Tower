'use client';

import { useState, useMemo } from 'react';
import { getISOWeek, getISOWeekYear, startOfISOWeek } from '../lib/dateUtils';
import { lastCompletedWeek } from '../lib/dateUtils';
import type { PurchaseLine, FilterState } from '../types';

// only these warehouses are in scope for P2W EU D2C — don't add others without checking with the team
const D2C_LOCATIONS = ['DS0_FR', 'GXO1_FR', 'LN_IT', 'DS_ES', 'DSV1_UK', 'MS_IE', 'HA_DE'];

export function useFilters(allLines: PurchaseLine[]) {
  const [filters, setFilters] = useState<FilterState>({
    suppliers: [],
    timeWindow: 'weekly',
    customStart: null,
    customEnd: null,
    categories: [],
    channels: [],
    production: [],
  });

  const { week: lastWeek, year: lastYear } = lastCompletedWeek();

  // hard filters applied before anything else — D2C locations only, 2026 PGRDs only
  const d2cLines = useMemo(
    () =>
      allLines.filter(
        (l) =>
          D2C_LOCATIONS.includes(l.destination) &&
          l.pgrd !== null &&
          l.pgrd.getFullYear() === 2026
      ),
    [allLines]
  );

  // weekly scope = just the last completed week, used for SOT/OTIF scoring and annotations
  const weeklyLines = useMemo(
    () =>
      d2cLines.filter(
        (l) =>
          l.pgrd !== null &&
          getISOWeek(l.pgrd) === lastWeek &&
          getISOWeekYear(l.pgrd) === lastYear
      ),
    [d2cLines, lastWeek, lastYear]
  );

  // accumulating scope = W01 through last completed week, used for backlog and trend chart
  const accumulatingLines = useMemo(
    () =>
      d2cLines.filter((l) => {
        if (!l.pgrd) return false;
        const w = getISOWeek(l.pgrd);
        const y = getISOWeekYear(l.pgrd);
        return y === lastYear && w <= lastWeek;
      }),
    [d2cLines, lastWeek, lastYear]
  );

  const supplierFilteredWeekly = useMemo(() => {
    if (filters.suppliers.length === 0) return weeklyLines;
    return weeklyLines.filter((l) => filters.suppliers.includes(l.supplier));
  }, [weeklyLines, filters.suppliers]);

  const supplierFilteredAccumulating = useMemo(() => {
    if (filters.suppliers.length === 0) return accumulatingLines;
    return accumulatingLines.filter((l) => filters.suppliers.includes(l.supplier));
  }, [accumulatingLines, filters.suppliers]);

  const allSuppliers = useMemo(
    () => [...new Set(d2cLines.map((l) => l.supplier))].sort(),
    [d2cLines]
  );

  return {
    filters,
    setFilters,
    weeklyLines: supplierFilteredWeekly,
    accumulatingLines: supplierFilteredAccumulating,
    allSuppliers,
    lastWeek,
    lastYear,
  };
}
