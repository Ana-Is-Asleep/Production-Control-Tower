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

function applySupplierCategoryFilter(lines: PurchaseLine[], suppliers: string[], categories: SKUCategory[]): PurchaseLine[] {
  let result = lines;
  if (suppliers.length > 0) result = result.filter((l) => suppliers.includes(l.supplier));
  if (categories.length > 0) result = result.filter((l) => categories.includes(categorizeSKU(l.sku)));
  return result;
}

export function useFilters(allLines: PurchaseLine[]) {
  const [filters, setFilters] = useState<ActiveFilters>({
    suppliers: [],
    categories: [],
    pgrdWeek: null,
  });

  const { week: lastWeek, year: lastYear } = lastCompletedWeek();

  // D2C lines only, 2026 only
  const d2cLines = useMemo(
    () => allLines.filter((l) => D2C_LOCATIONS.includes(l.destination) && l.pgrd !== null && l.pgrd.getFullYear() === 2026),
    [allLines]
  );

  // active week: selected week overrides last completed week
  const activeWeek = filters.pgrdWeek ?? lastWeek;

  // raw weekly lines for the active week (before supplier/category filter)
  const rawWeeklyLines = useMemo(
    () => d2cLines.filter((l) => l.pgrd !== null && getISOWeek(l.pgrd) === activeWeek && l.pgrd.getFullYear() === 2026),
    [d2cLines, activeWeek]
  );

  // raw accumulating lines W01 → lastWeek (trend/backlog always uses lastWeek, not activeWeek)
  const rawAccumulatingLines = useMemo(
    () => d2cLines.filter((l) => { if (!l.pgrd) return false; return l.pgrd.getFullYear() === lastYear && getISOWeek(l.pgrd) <= lastWeek; }),
    [d2cLines, lastWeek, lastYear]
  );

  // apply supplier + category filters — each has its own memo so React sees the dep change
  const weeklyLines = useMemo(
    () => applySupplierCategoryFilter(rawWeeklyLines, filters.suppliers, filters.categories),
    [rawWeeklyLines, filters.suppliers, filters.categories]
  );

  const accumulatingLines = useMemo(
    () => applySupplierCategoryFilter(rawAccumulatingLines, filters.suppliers, filters.categories),
    [rawAccumulatingLines, filters.suppliers, filters.categories]
  );

  const allD2cLines = useMemo(
    () => applySupplierCategoryFilter(d2cLines, filters.suppliers, filters.categories),
    [d2cLines, filters.suppliers, filters.categories]
  );

  const allSuppliers = useMemo(() => [...new Set(d2cLines.map((l) => l.supplier))].sort(), [d2cLines]);

  const availableWeeks = useMemo(() => {
    const weeks = new Set(d2cLines.map((l) => l.pgrd ? getISOWeek(l.pgrd) : null).filter(Boolean) as number[]);
    return [...weeks].sort((a, b) => a - b);
  }, [d2cLines]);

  return {
    filters,
    setFilters,
    weeklyLines,
    accumulatingLines,
    allD2cLines,
    allSuppliers,
    availableWeeks,
    lastWeek,      // always the real last completed week — used for the default dropdown label
    activeWeek,    // the week currently being viewed (may differ when user picks a specific week)
    lastYear,
  };
}
