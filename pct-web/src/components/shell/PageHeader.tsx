'use client';

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, RotateCcw } from 'lucide-react';
import { WeekRangeStepper } from '../shared/WeekRangeStepper';
import { VendorDropdown } from '../shared/VendorDropdown';
import { CategoryDropdown } from '../shared/CategoryDropdown';
import { ChannelDropdown } from '../shared/ChannelDropdown';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { CATEGORY_COLORS } from '../../lib/statusColors';
import { WEEK_RANGE_MIN, WEEK_RANGE_MAX, DEFAULT_FILTERS, type ActiveFilters } from '../../hooks/useFilters';
import type { Channel } from '../../lib/channelUtils';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumb?: Breadcrumb[]; // omit for the main dashboard, which just shows the title
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  allSuppliers: string[];
  curWeek: number;
  curYear: number;
  rightActions?: ReactNode; // page-specific buttons (Upload/Actions-toggle on the dashboard, Export/etc. on drill-downs)
  showWeekRange?: boolean; // false for pages that are current-state only (e.g. Missing ESD) — no snapshot/history selector
  showCategory?: boolean; // false where no reliable category concept exists on the underlying data (e.g. Invoices)
}

const CHANNELS: Channel[] = ['Offline', 'Online'];

// Page title (+ optional breadcrumb) and filter controls, shared by the main dashboard and every
// full-page drill-down so they all look and behave the same way — same underlying filter state/
// logic as before (WeekRangeStepper, VendorDropdown, and the channel/category toggle functions
// are untouched), just recomposed into one header block with the dropdown affordances layered on
// top of the existing pill toggles.
export function PageHeader({ breadcrumb, filters, onChange, allSuppliers, curWeek, curYear, rightActions, showWeekRange = true, showCategory = true }: PageHeaderProps) {
  const toggleChannel = (c: Channel) => {
    const next = filters.channels.includes(c) ? filters.channels.filter((x) => x !== c) : [...filters.channels, c];
    onChange({ ...filters, channels: next });
  };
  const toggleCategory = (c: SKUCategory) => {
    const next = filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };

  return (
    <div className="bg-white border-b border-[#e9e3df] px-5 py-2.5 shrink-0">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="shrink-0">
          <h1 className="text-base font-bold text-[#403833] tracking-tight">Production Control Tower</h1>
          {breadcrumb && (
            <div className="flex items-center gap-1.5 text-xs text-[#9c9794] mt-0.5">
              {breadcrumb.map((b, i) => (
                <span key={b.label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[#d6cfc9]">›</span>}
                  {b.href ? (
                    <Link to={b.href} className="hover:text-brand transition-colors">{b.label}</Link>
                  ) : (
                    <span className="text-[#403833] font-medium">{b.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {showWeekRange && (
            <div className="flex items-center gap-2 bg-white border border-[#e9e3df] rounded-lg px-2.5 h-8">
              <Calendar size={14} className="text-[#7b7571]" />
              <WeekRangeStepper min={WEEK_RANGE_MIN} max={WEEK_RANGE_MAX} value={filters.weekRange} onChange={(weekRange) => onChange({ ...filters, weekRange })} curWeek={curWeek} curYear={curYear} />
            </div>
          )}
          <VendorDropdown allSuppliers={allSuppliers} selected={filters.suppliers} onChange={(s) => onChange({ ...filters, suppliers: s })} />
          {showCategory && <CategoryDropdown selected={filters.categories} onChange={(c) => onChange({ ...filters, categories: c })} />}
          <ChannelDropdown selected={filters.channels} onChange={(c) => onChange({ ...filters, channels: c })} />

          {rightActions && (
            <>
              <span className="w-px h-5 bg-[#e9e3df] mx-1" />
              {rightActions}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2">
        {CHANNELS.map((c) => (
          <button
            key={c}
            onClick={() => toggleChannel(c)}
            className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium whitespace-nowrap ${filters.channels.includes(c) ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
          >
            {c}
          </button>
        ))}
        {showCategory && (
          <>
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
          </>
        )}
        {(filters.suppliers.length > 0 || filters.channels.length > 0 || filters.categories.length > 0 ||
          filters.weekRange.start !== DEFAULT_FILTERS.weekRange.start || filters.weekRange.end !== DEFAULT_FILTERS.weekRange.end) && (
          <button onClick={() => onChange(DEFAULT_FILTERS)} className="flex items-center gap-1 text-xs text-[#9c9794] hover:text-fail transition-colors ml-auto">
            <RotateCcw size={12} /> Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
