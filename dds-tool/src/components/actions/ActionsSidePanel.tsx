'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ActionsTabs, type StatusFilter } from './ActionsTabs';
import { buildActionsHref } from '../../lib/actionsParams';
import type { ActiveFilters } from '../../hooks/useFilters';
import type { ActionItem, ActionType } from '../../types/actions';

interface ActionsSidePanelProps {
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

// Version B: always-visible right panel — the caller is responsible for shrinking the main
// content area to make room for it (see Dashboard.tsx). tab/statusFilter are controlled by the
// parent (shared with ActionsBadgeDrawer) so switching between Badge and Panel modes never
// resets your place.
export function ActionsSidePanel({
  actions, onSave, onAddOpenPoint, filteredPOs, allSuppliers, filters, tab, onTabChange, statusFilter, onStatusFilterChange,
}: ActionsSidePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  // open (non-closed) actions per supplier — flags respect the same supplier/channel/category
  // filters as the rest of the dashboard; open points without a supplier are excluded here since
  // there's nothing to group them by
  const bySupplier = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of actions) {
      if (a.status === 'closed') continue;
      if (a.type === 'flag' && a.poReference && !filteredPOs.has(a.poReference)) continue;
      if (!a.supplierName) continue;
      counts.set(a.supplierName, (counts.get(a.supplierName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [actions, filteredPOs]);

  const visible = expanded ? bySupplier : bySupplier.slice(0, 5);

  return (
    <div className="w-[360px] shrink-0 border-l border-[#e9e3df] bg-white flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#e9e3df] shrink-0">
        <h2 className="text-sm font-semibold text-[#403833]">Actions</h2>
      </div>
      <button
        onClick={() => router.push(buildActionsHref(filters.suppliers, filters.weekRange))}
        className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand border-b border-[#e9e3df] py-2.5 hover:bg-[#fff7ed] transition-colors shrink-0"
      >
        View all actions <ArrowRight size={13} />
      </button>

      {bySupplier.length > 0 && (
        <div className="px-4 py-3 border-b border-[#e9e3df] shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-2">Open actions by supplier</p>
          <div className="space-y-1">
            {visible.map(([supplier, count]) => (
              <div key={supplier} className="flex items-center justify-between text-xs">
                <span className="text-[#403833] truncate mr-2">{supplier}</span>
                <span className="font-semibold text-brand shrink-0">{count}</span>
              </div>
            ))}
          </div>
          {bySupplier.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-[#9c9794] hover:text-brand mt-1.5"
            >
              {expanded ? 'Show less' : `Show all (${bySupplier.length})`}
            </button>
          )}
        </div>
      )}

      <ActionsTabs
        actions={actions} onSave={onSave} onAddOpenPoint={onAddOpenPoint} filteredPOs={filteredPOs} allSuppliers={allSuppliers}
        tab={tab} onTabChange={onTabChange} statusFilter={statusFilter} onStatusFilterChange={onStatusFilterChange}
      />
    </div>
  );
}
