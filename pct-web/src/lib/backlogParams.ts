import { WEEK_RANGE_DEFAULT, type ActiveFilters } from '../hooks/useFilters';
import type { Channel } from './channelUtils';
import type { SKUCategory } from './skuUtils';

// Builds the drill-down URL from the dashboard's current filters — mirrors sotOtifParams.ts's
// convention. No page-level mode/toggle param: the Backlog page's view fully adapts on the
// inherited Supplier filter's cardinality, there's nothing extra to encode.
export function buildBacklogHref(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  return `/backlog?${params.toString()}`;
}

export function parseBacklogParams(params: { get(key: string): string | null }): ActiveFilters {
  const ws = Number(params.get('ws'));
  const we = Number(params.get('we'));
  const sup = params.get('sup');
  const ch = params.get('ch');
  const cat = params.get('cat');

  return {
    weekRange: {
      start: Number.isFinite(ws) ? ws : WEEK_RANGE_DEFAULT.start,
      end: Number.isFinite(we) ? we : WEEK_RANGE_DEFAULT.end,
    },
    suppliers: sup ? sup.split(',').filter(Boolean) : [],
    channels: ch ? (ch.split(',').filter(Boolean) as Channel[]) : [],
    categories: cat ? (cat.split(',').filter(Boolean) as SKUCategory[]) : [],
  };
}

export function buildBacklogParams(filters: ActiveFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  return params;
}
