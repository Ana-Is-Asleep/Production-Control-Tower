import type { ActiveFilters } from '../hooks/useFilters';

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// Pure function — one summary line reflecting active global filters in plain language,
// e.g. "Online · Mattresses · All Suppliers · Weeks -7/+3"
export function formatFilterSummary(filters: ActiveFilters): string {
  const parts: string[] = [];

  if (filters.channels.length === 0 || filters.channels.length === 2) {
    parts.push('All Channels');
  } else {
    parts.push(filters.channels[0]);
  }

  if (filters.categories.length === 0) {
    parts.push('All Categories');
  } else if (filters.categories.length === 1) {
    parts.push(filters.categories[0]);
  } else {
    parts.push(`${filters.categories.length} Categories`);
  }

  if (filters.suppliers.length === 0) {
    parts.push('All Suppliers');
  } else if (filters.suppliers.length === 1) {
    parts.push(filters.suppliers[0]);
  } else {
    parts.push(`${filters.suppliers.length} Suppliers`);
  }

  parts.push(`Weeks ${signed(filters.weekRange.start)}/${signed(filters.weekRange.end)}`);

  return parts.join(' · ');
}
