'use client';

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatFilterSummary } from '../../lib/filterSummary';
import type { ActiveFilters } from '../../hooks/useFilters';

interface DetailHeaderProps {
  title: string;
  filters: ActiveFilters;
  rightActions?: ReactNode;
  centerContent?: ReactNode; // e.g. the orange Actions badge — absolutely centered so it reads as "top middle" regardless of how wide the left/right content is
}

// Standardized detail-page header (per Ana's "make them all match Root Cause Detail" request) —
// a single compact line: back link, page title, and a read-only summary of whatever the
// dashboard's global filters currently are. Filters are edited on the Dashboard/overview, not
// re-editable here — this just reflects what's already active.
export function DetailHeader({ title, filters, rightActions, centerContent }: DetailHeaderProps) {
  return (
    <header className="relative bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 shrink-0">
      <Link to="/" className="flex items-center gap-1.5 text-sm font-semibold text-[#403833] hover:text-brand transition-colors shrink-0">
        <span>←</span> Overview
      </Link>
      <span className="text-[#e9e3df]">|</span>
      <span className="text-[#403833] text-sm font-semibold shrink-0">{title}</span>
      <span className="text-[#e9e3df]">|</span>
      <span className="text-xs text-[#7b7571] truncate">Filtered by: {formatFilterSummary(filters)}</span>
      <div className="flex-1" />
      {rightActions && <div className="flex items-center gap-2 shrink-0">{rightActions}</div>}
      {centerContent && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {centerContent}
        </div>
      )}
    </header>
  );
}
