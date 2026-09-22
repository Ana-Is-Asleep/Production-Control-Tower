'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ActionsTabs, type StatusFilter } from './ActionsTabs';
import { buildActionsHref } from '../../lib/actionsParams';
import type { ActiveFilters } from '../../hooks/useFilters';
import type { ActionBucket, ActionItem, ActionType } from '../../types/actions';

interface ActionsBadgeDrawerProps {
  actions: ActionItem[];
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onAddOpenPoint: (item: ActionItem) => void;
  filteredPOs: Set<string>;
  allSuppliers: string[];
  filters: ActiveFilters; // carried over to the full Actions page's initial filters via "View all actions"
  tab: ActionType;
  onTabChange: (t: ActionType) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  open: boolean; // lifted to Dashboard so it can shrink the main content area while the drawer is open, instead of the drawer floating over (and potentially hiding) dashboard cards
  onOpenChange: (open: boolean) => void;
  bucketFilter?: ActionBucket; // when mounted on a specific dashboard detail page, only that bucket's flags show
}

// A badge that opens a right-side drawer. No backdrop — the rest of the page stays interactive
// while the drawer is open, and the caller shrinks the content area's width so dashboard cards on
// the right edge are never hidden behind it. The trigger renders inline wherever this component
// is mounted (e.g. centered in a page header). The drawer panel itself is portaled to
// document.body — several pages wrap their content in elements with a `transform` (e.g. the
// `.page-enter` animation), and CSS makes any transformed ancestor the containing block for a
// `position: fixed` descendant, which broke the "slide over from the right edge of the viewport"
// behavior and made the panel render as a small box near the trigger instead. Portaling sidesteps
// that regardless of what animations/transforms get added to ancestors later. tab/statusFilter
// are controlled by the parent so re-mounting this component never resets your place.
export function ActionsBadgeDrawer({
  actions, onSave, onAddOpenPoint, filteredPOs, allSuppliers, filters, tab, onTabChange, statusFilter, onStatusFilterChange, open, onOpenChange, bucketFilter,
}: ActionsBadgeDrawerProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const openCount = actions.filter(
    (a) => a.status !== 'closed' && (a.type === 'open_point' || !a.poReference || filteredPOs.has(a.poReference))
           && (!bucketFilter || a.type === 'open_point' || a.bucket === bucketFilter)
  ).length;

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs transition-transform hover:scale-105 shrink-0 ${openCount > 0 ? 'bg-brand text-white' : 'bg-pass text-white'}`}
        style={{ boxShadow: 'var(--shadow-card-hover)' }}
      >
        Action points
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-y-0 right-0 z-50 w-[400px] max-w-full bg-white flex flex-col"
          style={{ boxShadow: 'var(--shadow-slide)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9e3df] shrink-0">
            <h2 className="text-sm font-semibold text-[#403833]">Actions</h2>
            <button onClick={() => onOpenChange(false)} className="text-[#9c9794] hover:text-[#403833] text-lg leading-none">✕</button>
          </div>
          <button
            onClick={() => { onOpenChange(false); router.push(buildActionsHref(filters.suppliers, filters.weekRange)); }}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand border-b border-[#e9e3df] py-2.5 hover:bg-[#fff7ed] transition-colors shrink-0"
          >
            View all actions <ArrowRight size={13} />
          </button>
          <ActionsTabs
            actions={actions} onSave={onSave} onAddOpenPoint={onAddOpenPoint} filteredPOs={filteredPOs} allSuppliers={allSuppliers}
            tab={tab} onTabChange={onTabChange} statusFilter={statusFilter} onStatusFilterChange={onStatusFilterChange}
            bucketFilter={bucketFilter}
          />
        </div>,
        document.body
      )}
    </>
  );
}
