'use client';

import { useData } from '../../context/DataContext';

export function GlobalFilterBadge() {
  const { globalFilters, setGlobalFilters } = useData();
  const suppliers = globalFilters?.suppliers ?? [];
  const categories = globalFilters?.categories ?? [];
  const hasFilter = suppliers.length > 0 || categories.length > 0;

  if (!hasFilter) return null;

  const parts: string[] = [];
  if (suppliers.length === 1) parts.push(suppliers[0]);
  else if (suppliers.length > 1) parts.push(`${suppliers.length} suppliers`);
  if (categories.length === 1) parts.push(categories[0]);
  else if (categories.length > 1) parts.push(`${categories.length} categories`);

  const clear = () => setGlobalFilters({ ...globalFilters, suppliers: [], categories: [] });

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#403833] text-white text-xs font-semibold px-4 py-2.5 rounded-full"
      style={{ boxShadow: '0 4px 20px rgba(64,56,51,0.30)' }}
    >
      <span className="w-2 h-2 rounded-full bg-brand animate-pulse shrink-0" />
      <span>Filtered: {parts.join(' · ')}</span>
      <button
        onClick={clear}
        className="ml-1 flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-full transition-all text-[11px] font-semibold"
      >
        × clear filter
      </button>
    </div>
  );
}
