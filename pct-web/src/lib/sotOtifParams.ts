import { WEEK_RANGE_DEFAULT, type ActiveFilters } from '../hooks/useFilters';
import type { Channel } from './channelUtils';
import type { SKUCategory } from './skuUtils';

// Builds the drill-down URL from the overview's current filters, so "Drill down" always lands
// on a URL that reproduces the exact scope the user was looking at.
export function buildSotOtifHref(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  return `/sot-otif?${params.toString()}`;
}

export interface SotOtifUrlState {
  filters: ActiveFilters;
  selectedWeek: string | null;
}

// Reads the same params back out — used to hydrate the drill-down page on load/refresh, and to
// keep the URL in sync as filters/selected week change. Typed structurally (just needs `.get`) so
// it accepts both URLSearchParams and Next's ReadonlyURLSearchParams from useSearchParams().
export function parseSotOtifParams(params: { get(key: string): string | null }): SotOtifUrlState {
  const ws = Number(params.get('ws'));
  const we = Number(params.get('we'));
  const sup = params.get('sup');
  const ch = params.get('ch');
  const cat = params.get('cat');
  const week = params.get('week');

  return {
    filters: {
      weekRange: {
        start: Number.isFinite(ws) ? ws : WEEK_RANGE_DEFAULT.start,
        end: Number.isFinite(we) ? we : WEEK_RANGE_DEFAULT.end,
      },
      suppliers: sup ? sup.split(',').filter(Boolean) : [],
      channels: ch ? (ch.split(',').filter(Boolean) as Channel[]) : [],
      categories: cat ? (cat.split(',').filter(Boolean) as SKUCategory[]) : [],
    },
    selectedWeek: week || null,
  };
}

export function buildSotOtifParams(filters: ActiveFilters, selectedWeek: string | null): URLSearchParams {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  if (selectedWeek) params.set('week', selectedWeek);
  return params;
}
