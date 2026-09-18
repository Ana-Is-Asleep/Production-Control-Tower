'use client';

import { useState } from 'react';
import { useActions } from '../../hooks/useActions';
import { ActionsBadgeDrawer } from './ActionsBadgeDrawer';
import type { ActionBucket, ActionType } from '../../types/actions';
import type { StatusFilter } from './ActionsTabs';
import type { ActiveFilters } from '../../hooks/useFilters';

interface GlobalActionsBadgeProps {
  filteredPOs: Set<string>;
  allSuppliers: string[];
  filters: ActiveFilters;
  // When set, only that dashboard section's flags count/show — e.g. the Missing ESD page passes
  // 'missing_esd' so its badge only reflects flags relevant to Missing ESD, not every flag.
  bucketFilter?: ActionBucket;
  // Lets the host page mirror the drawer's open/closed state so it can shrink its own layout
  // (header + content) while the drawer is open — otherwise the fixed-right drawer panel covers
  // whatever's underneath it instead of the page compacting to make room.
  onOpenChange?: (open: boolean) => void;
}

// Drop this into any page (not just the Dashboard) to get the same orange "N open actions"
// floating badge + drawer — Ana: "How are SCMs going to deep dive flagged POs without going
// through the dashboard?" Each mount owns its own tab/status/open state but reads the same
// localStorage-backed actions via useActions(), so they always agree on what's open.
export function GlobalActionsBadge({ filteredPOs, allSuppliers, filters, bucketFilter, onOpenChange }: GlobalActionsBadgeProps) {
  const { actions, updateAction, addAction } = useActions();
  const [tab, setTab] = useState<ActionType>('flag');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };

  return (
    <ActionsBadgeDrawer
      actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers} filters={filters}
      tab={tab} onTabChange={setTab} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
      open={open} onOpenChange={setOpen} bucketFilter={bucketFilter}
    />
  );
}
