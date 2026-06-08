'use client';

import { useState, useMemo } from 'react';
import { getISOWeek, getISOWeekYear, lastCompletedWeek } from '../lib/dateUtils';
import { categorizeSKU, type SKUCategory } from '../lib/skuUtils';
import type { PurchaseLine } from '../types';

// only D2C warehouses — don't add others without checking with the team
const D2C = ['DS0_FR', 'GXO1_FR', 'LN_IT', 'DS_ES', 'DSV1_UK', 'MS_IE', 'HA_DE'];

export interface ActiveFilters {
  suppliers: string[];
  categories: SKUCategory[];
  pgrdWeek: number | null;
}

function applyFilters(lines: PurchaseLine[], suppliers: string[], categories: SKUCategory[]) {
  let result = lines;
  if (suppliers.length) result = result.filter(l => suppliers.includes(l.supplier));
  if (categories.length) result = result.filter(l => categories.includes(categorizeSKU(l.sku)));
  return result;
}

export function useFilters(allLines: PurchaseLine[], initialFilters?: ActiveFilters) {
  const [filters, setFilters] = useState<ActiveFilters>(
    initialFilters ?? { suppliers: [], categories: [], pgrdWeek: null }
  );

  const { week: lastWeek, year: lastYear } = lastCompletedWeek();

  // hard filters first — D2C locations only, 2026 PGRDs only
  const d2c = useMemo(
    () => allLines.filter(l => D2C.includes(l.destination) && l.pgrd?.getFullYear() === 2026),
    [allLines]
  );

  // week filter overrides the default last-completed-week
  const activeWeek = filters.pgrdWeek ?? lastWeek;

  const rawWeekly = useMemo(
    () => d2c.filter(l => l.pgrd && getISOWeek(l.pgrd) === activeWeek && l.pgrd.getFullYear() === 2026),
    [d2c, activeWeek]
  );

  // accumulating = W01 through last completed week, for trend charts and backlog
  const rawAccumulating = useMemo(
    () => d2c.filter(l => l.pgrd && l.pgrd.getFullYear() === lastYear && getISOWeek(l.pgrd) <= lastWeek),
    [d2c, lastWeek, lastYear]
  );

  const weeklyLines      = useMemo(() => applyFilters(rawWeekly,      filters.suppliers, filters.categories), [rawWeekly,      filters.suppliers, filters.categories]);
  const accumulatingLines= useMemo(() => applyFilters(rawAccumulating,filters.suppliers, filters.categories), [rawAccumulating,filters.suppliers, filters.categories]);
  const allD2cLines      = useMemo(() => applyFilters(d2c,            filters.suppliers, filters.categories), [d2c,            filters.suppliers, filters.categories]);

  const allSuppliers = useMemo(() => [...new Set(d2c.map(l => l.supplier))].sort(), [d2c]);
  const availableWeeks = useMemo(() => {
    const weeks = new Set(d2c.map(l => l.pgrd ? getISOWeek(l.pgrd) : null).filter(Boolean) as number[]);
    return [...weeks].sort((a, b) => a - b);
  }, [d2c]);

  return {
    filters, setFilters,
    weeklyLines, accumulatingLines, allD2cLines,
    allSuppliers, availableWeeks,
    lastWeek,   // always the real last completed week — used for dropdown default label
    activeWeek, // the currently viewed week — may differ when user picks a specific week
    lastYear,
  };
}
