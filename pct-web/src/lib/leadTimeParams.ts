import { WEEK_RANGE_DEFAULT, type ActiveFilters } from '../hooks/useFilters';
import type { SKUCategory } from './skuUtils';
import type { LTPeriod, LTView, LTHeatmapRows, LTPOSet } from './leadTimeAnalytics';

export type LTTab = 'overview' | 'sku';
export type LTChannel = 'All' | 'Online' | 'Offline';

export interface LeadTimeUrlState {
  filters: ActiveFilters; // inherited Supplier/Category (Week Range/Channel are ignored by this page)
  tab: LTTab;
  period: LTPeriod;
  channel: LTChannel; // page-owned, independent of the dashboard's global channel filter
  view: LTView;
  viewCategory: SKUCategory;
  viewSupplier: string | null;
  heatmapRows: LTHeatmapRows;
  heatmapPOs: LTPOSet;
}

// Builds the drill-down URL from the dashboard's current filters — mirrors the other drill-downs'
// convention, though this page only actually reads suppliers/categories from it.
export function buildLeadTimeHref(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  if (filters.suppliers.length) params.set('sup', filters.suppliers.join(','));
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  return `/lead-time?${params.toString()}`;
}

export function parseLeadTimeParams(params: { get(key: string): string | null }): LeadTimeUrlState {
  const sup = params.get('sup');
  const cat = params.get('cat');
  const tab = params.get('tab');
  const period = params.get('period');
  const channel = params.get('channel');
  const view = params.get('view');
  const viewCategory = params.get('viewCategory');
  const viewSupplier = params.get('viewSupplier');
  const heatmapRows = params.get('heatmapRows');
  const heatmapPOs = params.get('heatmapPOs');

  return {
    filters: {
      weekRange: WEEK_RANGE_DEFAULT,
      suppliers: sup ? sup.split(',').filter(Boolean) : [],
      channels: [],
      categories: cat ? (cat.split(',').filter(Boolean) as SKUCategory[]) : [],
    },
    tab: tab === 'sku' ? 'sku' : 'overview',
    period: period === 'months' || period === 'quarters' ? period : 'weeks',
    channel: channel === 'Online' || channel === 'Offline' ? channel : 'All',
    view: view === 'Category' || view === 'Supplier' ? view : 'General',
    viewCategory: viewCategory === 'Beds' || viewCategory === 'Mattresses' || viewCategory === 'Accessories' ? viewCategory : 'Mattresses',
    viewSupplier: viewSupplier || null,
    heatmapRows: heatmapRows === 'Supplier' ? 'Supplier' : 'Category',
    heatmapPOs: heatmapPOs === 'delayed' ? 'delayed' : 'all',
  };
}

export function buildLeadTimeParams(state: Omit<LeadTimeUrlState, 'filters'> & { filters: ActiveFilters }): URLSearchParams {
  const params = new URLSearchParams();
  if (state.filters.suppliers.length) params.set('sup', state.filters.suppliers.join(','));
  if (state.filters.categories.length) params.set('cat', state.filters.categories.join(','));
  params.set('tab', state.tab);
  params.set('period', state.period);
  params.set('channel', state.channel);
  params.set('view', state.view);
  params.set('viewCategory', state.viewCategory);
  if (state.viewSupplier) params.set('viewSupplier', state.viewSupplier);
  params.set('heatmapRows', state.heatmapRows);
  params.set('heatmapPOs', state.heatmapPOs);
  return params;
}
