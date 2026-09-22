'use client';

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, RotateCcw } from 'lucide-react';
import { formatFilterSummary } from '../../lib/filterSummary';
import { WeekRangeStepper } from '../shared/WeekRangeStepper';
import { VendorDropdown } from '../shared/VendorDropdown';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { CATEGORY_COLORS } from '../../lib/statusColors';
import { WEEK_RANGE_MIN, WEEK_RANGE_MAX, DEFAULT_FILTERS, type ActiveFilters } from '../../hooks/useFilters';
import type { Channel } from '../../lib/channelUtils';

interface DetailHeaderProps {
  title: string;
  filters: ActiveFilters;
  rightActions?: ReactNode;
  centerContent?: ReactNode; // e.g. the orange Actions badge — placed in its own grid column so it reads as "top middle" without ever overlapping the left/right content when the window is narrow
  // When provided (together with allSuppliers/curWeek/curYear), the header also renders the same
  // live, editable filter controls as the Dashboard's PageHeader, alongside (not instead of) the
  // read-only "Filtered by: ..." summary — Ana: detail pages should let you adjust filters without
  // bouncing back to the Overview first. Pages that don't pass these just show the summary alone.
  onChange?: (f: ActiveFilters) => void;
  allSuppliers?: string[];
  curWeek?: number;
  curYear?: number;
  showWeekRange?: boolean;
  showCategory?: boolean;
}

const CHANNELS: Channel[] = ['Offline', 'Online'];

// Standardized detail-page header (per Ana's "make them all match Root Cause Detail" request) —
// a single compact line: back link, page title, and the read-only "Filtered by: ..." summary,
// always shown regardless of whether live filter controls are also wired up (Ana: wants both, not
// one replacing the other). Left/center columns size to their own content instead of an equal 1fr
// share — with both flanking columns at 1fr, the filters column was capped to match the
// much-narrower left column's width and got starved into wrapping, even with room to spare on the
// title side. Filters get every leftover pixel instead.
export function DetailHeader({
  title, filters, rightActions, centerContent, onChange, allSuppliers, curWeek, curYear, showWeekRange = true, showCategory = true,
}: DetailHeaderProps) {
  const live = !!onChange && !!allSuppliers && curWeek !== undefined && curYear !== undefined;

  const toggleChannel = (c: Channel) => {
    if (!onChange) return;
    const next = filters.channels.includes(c) ? filters.channels.filter((x) => x !== c) : [...filters.channels, c];
    onChange({ ...filters, channels: next });
  };
  const toggleCategory = (c: SKUCategory) => {
    if (!onChange) return;
    const next = filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };

  return (
    <header className="bg-white border-b border-[#e9e3df] px-5 py-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <Link to="/" className="flex items-center gap-1.5 text-sm font-semibold text-[#403833] hover:text-brand transition-colors shrink-0">
          <span>←</span> Overview
        </Link>
        <span className="text-[#e9e3df] shrink-0">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0 whitespace-nowrap">{title}</span>
        <span className="text-[#e9e3df] shrink-0">|</span>
        <span className="text-xs text-[#7b7571] truncate min-w-0">Filtered by: {formatFilterSummary(filters)}</span>
      </div>

      <div className="flex justify-center">{centerContent}</div>

      {live ? (
        <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
          {showWeekRange && (
            <div className="flex items-center gap-2 bg-white border border-[#e9e3df] rounded-lg px-2.5 h-8">
              <Calendar size={14} className="text-[#7b7571]" />
              <WeekRangeStepper
                min={WEEK_RANGE_MIN}
                max={WEEK_RANGE_MAX}
                value={filters.weekRange}
                onChange={(weekRange) => onChange!({ ...filters, weekRange })}
                curWeek={curWeek!}
                curYear={curYear!}
              />
            </div>
          )}
          <VendorDropdown allSuppliers={allSuppliers!} selected={filters.suppliers} onChange={(s) => onChange!({ ...filters, suppliers: s })} />

          {rightActions && (
            <>
              <span className="w-px h-5 bg-[#e9e3df] mx-1" />
              {rightActions}
            </>
          )}

          <span className="w-px h-5 bg-[#e9e3df] mx-1" />

          {CHANNELS.map((c) => (
            <button
              key={c}
              onClick={() => toggleChannel(c)}
              className={`filter-pill text-xs px-2 py-1 min-w-[74px] text-center rounded-full border font-medium whitespace-nowrap ${filters.channels.includes(c) ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
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
                  className={`filter-pill text-xs px-2 py-1 min-w-[74px] text-center rounded-full border font-medium whitespace-nowrap ${filters.categories.includes(c) ? 'text-white border-transparent' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
                  style={filters.categories.includes(c) ? { background: CATEGORY_COLORS[c] } : {}}
                >
                  {c}
                </button>
              ))}
            </>
          )}
          {(filters.suppliers.length > 0 || filters.channels.length > 0 || filters.categories.length > 0 ||
            filters.weekRange.start !== DEFAULT_FILTERS.weekRange.start || filters.weekRange.end !== DEFAULT_FILTERS.weekRange.end) && (
            <button onClick={() => onChange!(DEFAULT_FILTERS)} className="flex items-center gap-1 text-xs text-[#9c9794] hover:text-fail transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 justify-end min-w-0">{rightActions}</div>
      )}
    </header>
  );
}
