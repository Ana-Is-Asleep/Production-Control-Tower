import { WEEK_RANGE_DEFAULT, type ActiveFilters } from '../hooks/useFilters';
import type { Channel } from './channelUtils';
import type { SKUCategory } from './skuUtils';

export type UrgencyFilter = 'urgent' | 'watchlist';

// Builds the drill-down URL from the dashboard's current filters — mirrors sotOtifParams.ts's
// convention so every drill-down encodes filter state the same way.
export function buildMissingEsdHref(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  return `/missing-esd?${params.toString()}`;
}

export interface MissingEsdUrlState {
  filters: ActiveFilters;
  urgency: UrgencyFilter;
}

export function parseMissingEsdParams(params: { get(key: string): string | null }): MissingEsdUrlState {
  const ws = Number(params.get('ws'));
  const we = Number(params.get('we'));
  const sup = params.get('sup');
  const ch = params.get('ch');
  const cat = params.get('cat');
  const urgency = params.get('urgency');

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
    urgency: urgency === 'watchlist' ? 'watchlist' : 'urgent',
  };
}

export function buildMissingEsdParams(filters: ActiveFilters, urgency: UrgencyFilter): URLSearchParams {
  const params = new URLSearchParams();
  params.set('ws', String(filters.weekRange.start));
  params.set('we', String(filters.weekRange.end));
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.channels.length) params.set('ch', filters.channels.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  params.set('urgency', urgency);
  return params;
}
