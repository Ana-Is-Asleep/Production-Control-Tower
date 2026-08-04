'use client';

import { RangeSlider } from './RangeSlider';
import { VendorDropdown } from './VendorDropdown';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { CATEGORY_COLORS } from '../../lib/statusColors';
import { WEEK_RANGE_MIN, WEEK_RANGE_MAX, DEFAULT_FILTERS, type ActiveFilters } from '../../hooks/useFilters';
import type { Channel } from '../../lib/channelUtils';

interface GlobalFilterBarProps {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  allSuppliers: string[];
}

const CHANNELS: Channel[] = ['Offline', 'D2C'];

export function GlobalFilterBar({ filters, onChange, allSuppliers }: GlobalFilterBarProps) {
  const toggleChannel = (c: Channel) => {
    const next = filters.channels.includes(c) ? filters.channels.filter((x) => x !== c) : [...filters.channels, c];
    onChange({ ...filters, channels: next });
  };
  const toggleCategory = (c: SKUCategory) => {
    const next = filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };
  const hasActive = filters.suppliers.length > 0 || filters.channels.length > 0 || filters.categories.length > 0 ||
    filters.weekRange.start !== DEFAULT_FILTERS.weekRange.start || filters.weekRange.end !== DEFAULT_FILTERS.weekRange.end;

  return (
    <div className="px-4 py-2.5 border-b border-[#e9e3df] flex items-center gap-3 flex-wrap bg-white">
      <RangeSlider
        min={WEEK_RANGE_MIN}
        max={WEEK_RANGE_MAX}
        value={filters.weekRange}
        onChange={(weekRange) => onChange({ ...filters, weekRange })}
        formatLabel={(n) => (n >= 0 ? `+${n}` : `${n}`)}
        className="w-[220px]"
      />
      <span className="text-[#e9e3df]">|</span>
      <VendorDropdown allSuppliers={allSuppliers} selected={filters.suppliers} onChange={(s) => onChange({ ...filters, suppliers: s })} />
      <span className="text-[#e9e3df]">|</span>
      {CHANNELS.map((c) => (
        <button
          key={c}
          onClick={() => toggleChannel(c)}
          className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium whitespace-nowrap ${filters.channels.includes(c) ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
        >
          {c}
        </button>
      ))}
      <span className="text-[#e9e3df]">|</span>
      {SKU_CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => toggleCategory(c)}
          className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium whitespace-nowrap ${filters.categories.includes(c) ? 'text-white border-transparent' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
          style={filters.categories.includes(c) ? { background: CATEGORY_COLORS[c] } : {}}
        >
          {c}
        </button>
      ))}
      {hasActive && (
        <button onClick={() => onChange(DEFAULT_FILTERS)} className="text-xs text-[#9c9794] hover:text-fail transition-colors ml-auto">
          Clear ✕
        </button>
      )}
    </div>
  );
}
