import type { InvoiceChannel } from '../types/invoice';

// Invoices doesn't share the standard ActiveFilters shape (no week range/category concept here) —
// it only inherits the dashboard's Supplier filter, plus its own page-level Channel toggle.
export interface InvoicesUrlState {
  suppliers: string[];
  channel: InvoiceChannel;
}

export function buildInvoicesHref(suppliers: string[]): string {
  const params = new URLSearchParams();
  if (suppliers.length) params.set('sup', suppliers.join(','));
  return `/invoices?${params.toString()}`;
}

export function parseInvoicesParams(params: { get(key: string): string | null }): InvoicesUrlState {
  const sup = params.get('sup');
  const channel = params.get('channel');
  return {
    suppliers: sup ? sup.split(',').filter(Boolean) : [],
    channel: channel === 'Online' || channel === 'Offline' ? channel : 'All',
  };
}

export function buildInvoicesParams(suppliers: string[], channel: InvoiceChannel): URLSearchParams {
  const params = new URLSearchParams();
  if (suppliers.length) params.set('sup', suppliers.join(','));
  params.set('channel', channel);
  return params;
}
