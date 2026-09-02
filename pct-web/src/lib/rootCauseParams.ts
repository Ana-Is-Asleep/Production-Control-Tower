import { WEEK_RANGE_DEFAULT, type ActiveFilters } from '../hooks/useFilters';
import type { Channel } from './channelUtils';
import type { SKUCategory } from './skuUtils';

export type RootCauseMode = 'trend' | 'snapshot';

// Builds the drill-down URL from the dashboard's current filters — mirrors sotOtifParams.ts's
// convention so both drill-downs encode filter state the same way.
export function buildRootCauseHref(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  return `/root-cause?${params.toString()}`;
}

export interface RootCauseUrlState {
  filters: ActiveFilters;
  mode: RootCauseMode;
}

export function parseRootCauseParams(params: { get(key: string): string | null }): RootCauseUrlState {
  const ws = Number(params.get('ws'));
  const we = Number(params.get('we'));
  const sup = params.get('sup');
  const ch = params.get('ch');
  const cat = params.get('cat');
  const mode = params.get('mode');

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
    mode: mode === 'trend' ? 'trend' : 'snapshot',
  };
}

export function buildRootCauseParams(filters: ActiveFilters, mode: RootCauseMode): URLSearchParams {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  params.set('mode', mode);
  return params;
}
