'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ActionsTabs, type StatusFilter } from './ActionsTabs';
import { buildActionsHref } from '../../lib/actionsParams';
import type { ActiveFilters } from '../../hooks/useFilters';
import type { ActionItem, ActionType } from '../../types/actions';

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
}

// Version A: a persistent bottom-right badge that opens a right-side drawer. No backdrop —
// the rest of the page stays visible and interactive while the drawer is open. tab/statusFilter
// are controlled by the parent (shared with ActionsSidePanel) so switching between Badge and
// Panel modes never resets your place.
export function ActionsBadgeDrawer({
  actions, onSave, onAddOpenPoint, filteredPOs, allSuppliers, filters, tab, onTabChange, statusFilter, onStatusFilterChange,
}: ActionsBadgeDrawerProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const openCount = actions.filter(
    (a) => a.status !== 'closed' && (a.type === 'open_point' || !a.poReference || filteredPOs.has(a.poReference))
  ).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-1.5 px-4 py-2.5 rounded-full font-semibold text-xs transition-transform hover:scale-105 ${openCount > 0 ? 'bg-brand text-white' : 'bg-pass text-white'}`}
        style={{ boxShadow: 'var(--shadow-card-hover)' }}
      >
        {openCount > 0 ? `⚠ ${openCount} open action${openCount === 1 ? '' : 's'}` : '✓ No open actions'}
      </button>

      {open && (
        <div
          className="fixed inset-y-0 right-0 z-50 w-[400px] max-w-full bg-white flex flex-col"
          style={{ boxShadow: 'var(--shadow-slide)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9e3df] shrink-0">
            <h2 className="text-sm font-semibold text-[#403833]">Actions</h2>
            <button onClick={() => setOpen(false)} className="text-[#9c9794] hover:text-[#403833] text-lg leading-none">✕</button>
          </div>
          <button
            onClick={() => { setOpen(false); router.push(buildActionsHref(filters.suppliers, filters.weekRange)); }}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand border-b border-[#e9e3df] py-2.5 hover:bg-[#fff7ed] transition-colors shrink-0"
          >
            View all actions <ArrowRight size={13} />
          </button>
          <ActionsTabs
            actions={actions} onSave={onSave} onAddOpenPoint={onAddOpenPoint} filteredPOs={filteredPOs} allSuppliers={allSuppliers}
            tab={tab} onTabChange={onTabChange} statusFilter={statusFilter} onStatusFilterChange={onStatusFilterChange}
          />
        </div>
      )}
    </>
  );
}
