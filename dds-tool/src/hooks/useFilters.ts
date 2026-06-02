'use client';

import { useState, useMemo } from 'react';
import { getISOWeek, getISOWeekYear } from '../lib/dateUtils';
import { lastCompletedWeek } from '../lib/dateUtils';
import { categorizeSKU, type SKUCategory } from '../lib/skuUtils';
import type { PurchaseLine } from '../types';

// only these warehouses are in scope for P2W EU D2C — don't add others without checking with the team
const D2C_LOCATIONS = ['DS0_FR', 'GXO1_FR', 'LN_IT', 'DS_ES', 'DSV1_UK', 'MS_IE', 'HA_DE'];

export interface ActiveFilters {
  suppliers: string[];
  categories: SKUCategory[];
  pgrdWeek: number | null;
}

export function useFilters(allLines: PurchaseLine[]) {
  const [filters, setFilters] = useState<ActiveFilters>({
    suppliers: [],
    categories: [],
    pgrdWeek: null,
  });

  const { week: lastWeek, year: lastYear } = lastCompletedWeek();

  // hard filters applied before anything else — D2C locations only, 2026 PGRDs only
  const d2cLines = useMemo(
    () => allLines.filter((l) => D2C_LOCATIONS.includes(l.destination) && l.pgrd !== null && l.pgrd.getFullYear() === 2026),
    [allLines]
  );

  // weekly scope = just the last completed week, used for SOT/OTIF scoring and annotations
  const weeklyLines = useMemo(
    () => d2cLines.filter((l) => l.pgrd !== null && getISOWeek(l.pgrd) === lastWeek && getISOWeekYear(l.pgrd) === lastYear),
    [d2cLines, lastWeek, lastYear]
  );

  // accumulating scope = W01 through last completed week, used for backlog and trend chart
  const accumulatingLines = useMemo(
    () => d2cLines.filter((l) => { if (!l.pgrd) return false; return getISOWeekYear(l.pgrd) === lastYear && getISOWeek(l.pgrd) <= lastWeek; }),
    [d2cLines, lastWeek, lastYear]
  );

  const applyFilters = (lines: PurchaseLine[]) => {
    let result = lines;
    if (filters.suppliers.length > 0) result = result.filter((l) => filters.suppliers.includes(l.supplier));
    if (filters.categories.length > 0) result = result.filter((l) => filters.categories.includes(categorizeSKU(l.sku)));
    if (filters.pgrdWeek !== null) result = result.filter((l) => l.pgrd && getISOWeek(l.pgrd) === filters.pgrdWeek);
    return result;
  };

  const allSuppliers = useMemo(() => [...new Set(d2cLines.map((l) => l.supplier))].sort(), [d2cLines]);

  const availableWeeks = useMemo(() => {
    const weeks = new Set(accumulatingLines.map((l) => l.pgrd ? getISOWeek(l.pgrd) : null).filter(Boolean) as number[]);
    return [...weeks].sort((a, b) => a - b);
  }, [accumulatingLines]);

  return {
    filters,
    setFilters,
    weeklyLines: applyFilters(weeklyLines),
    accumulatingLines: applyFilters(accumulatingLines),
    allSuppliers,
    availableWeeks,
    lastWeek,
    lastYear,
  };
}
