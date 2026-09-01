'use client';

import { Calendar, Upload as UploadIcon, PanelRight } from 'lucide-react';
import { WeekRangeStepper } from '../shared/WeekRangeStepper';
import { VendorDropdown } from '../shared/VendorDropdown';
import { CategoryDropdown } from '../shared/CategoryDropdown';
import { ChannelDropdown } from '../shared/ChannelDropdown';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { CATEGORY_COLORS } from '../../lib/statusColors';
import { WEEK_RANGE_MIN, WEEK_RANGE_MAX, DEFAULT_FILTERS, type ActiveFilters } from '../../hooks/useFilters';
import type { Channel } from '../../lib/channelUtils';

interface PageHeaderProps {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  allSuppliers: string[];
  curWeek: number;
  curYear: number;
  onUpload: () => void;
  actionsUiMode: 'badge' | 'panel';
  onToggleActionsUiMode: () => void;
}

const CHANNELS: Channel[] = ['Offline', 'Online'];

// Page title/subtitle + filter controls, replacing the old top nav bar + separate filter bar —
// same underlying filter state/logic as before (WeekRangeStepper, VendorDropdown, and the
// channel/category toggle functions are untouched), just recomposed into one header block with
// the new dropdown affordances layered on top of the existing pill toggles.
export function PageHeader({ filters, onChange, allSuppliers, curWeek, curYear, onUpload, actionsUiMode, onToggleActionsUiMode }: PageHeaderProps) {
  const toggleChannel = (c: Channel) => {
    const next = filters.channels.includes(c) ? filters.channels.filter((x) => x !== c) : [...filters.channels, c];
    onChange({ ...filters, channels: next });
  };
  const toggleCategory = (c: SKUCategory) => {
    const next = filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };

  return (
    <div className="bg-white border-b border-[#e9e3df] px-7 py-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-[#403833] tracking-tight">Production Control Tower</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 bg-white border border-[#e9e3df] rounded-lg px-3 h-9">
            <Calendar size={15} className="text-[#7b7571]" />
            <WeekRangeStepper min={WEEK_RANGE_MIN} max={WEEK_RANGE_MAX} value={filters.weekRange} onChange={(weekRange) => onChange({ ...filters, weekRange })} curWeek={curWeek} curYear={curYear} />
          </div>
          <VendorDropdown allSuppliers={allSuppliers} selected={filters.suppliers} onChange={(s) => onChange({ ...filters, suppliers: s })} />
          <CategoryDropdown selected={filters.categories} onChange={(c) => onChange({ ...filters, categories: c })} />
          <ChannelDropdown selected={filters.channels} onChange={(c) => onChange({ ...filters, channels: c })} />

          <span className="w-px h-6 bg-[#e9e3df] mx-1" />

          <button
            onClick={onToggleActionsUiMode}
            title="Switch Actions UI variant"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-[#e9e3df] text-[#58524e] hover:border-[#403833] hover:text-[#403833]"
          >
            <PanelRight size={16} />
          </button>
          <button
            onClick={onUpload}
            title="Upload Business Central export"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-[#403833] rounded-lg px-3 h-9 hover:bg-[#58524e]"
          >
            <UploadIcon size={14} />
            Upload
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
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
        {(filters.suppliers.length > 0 || filters.channels.length > 0 || filters.categories.length > 0 ||
          filters.weekRange.start !== DEFAULT_FILTERS.weekRange.start || filters.weekRange.end !== DEFAULT_FILTERS.weekRange.end) && (
          <button onClick={() => onChange(DEFAULT_FILTERS)} className="text-xs text-[#9c9794] hover:text-fail transition-colors ml-auto">
            Clear ✕
          </button>
        )}
      </div>
    </div>
  );
}
