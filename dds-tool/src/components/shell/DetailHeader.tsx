'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatFilterSummary } from '../../lib/filterSummary';
import type { ActiveFilters } from '../../hooks/useFilters';

interface DetailHeaderProps {
  title: string;
  filters: ActiveFilters;
  rightActions?: ReactNode;
  centerContent?: ReactNode; // e.g. the orange Actions badge — placed in its own grid column so it reads as "top middle" without ever overlapping the left/right content on narrow screens
}

// Standardized detail-page header (per Ana's "make them all match Root Cause Detail" request) —
// a single compact line: back link, page title, and a read-only summary of whatever the
// dashboard's global filters currently are. Filters are edited on the Dashboard/overview, not
// re-editable here — this just reflects what's already active. A 3-column grid (not absolute
// positioning) keeps centerContent from ever overlapping the left/right content when the window
// is narrow — the outer columns shrink and the "Filtered by" text truncates instead.
export function DetailHeader({ title, filters, rightActions, centerContent }: DetailHeaderProps) {
  return (
    <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-[#403833] hover:text-brand transition-colors shrink-0">
          <span>←</span> Overview
        </Link>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">{title}</span>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-xs text-[#7b7571] truncate">Filtered by: {formatFilterSummary(filters)}</span>
      </div>
      <div className="flex justify-center">{centerContent}</div>
      <div className="flex items-center gap-2 justify-end min-w-0">{rightActions}</div>
    </header>
  );
}
