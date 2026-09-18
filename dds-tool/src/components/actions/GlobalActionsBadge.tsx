'use client';

import { useState } from 'react';
import { useActions } from '../../hooks/useActions';
import { ActionsBadgeDrawer } from './ActionsBadgeDrawer';
import type { ActionType } from '../../types/actions';
import type { StatusFilter } from './ActionsTabs';
import type { ActiveFilters } from '../../hooks/useFilters';

interface GlobalActionsBadgeProps {
  filteredPOs: Set<string>;
  allSuppliers: string[];
  filters: ActiveFilters;
}

// Drop this into any page (not just the Dashboard) to get the same orange "N open actions"
// floating badge + drawer — Ana: "How are SCMs going to deep dive flagged POs without going
// through the dashboard?" Each mount owns its own tab/status/open state but reads the same
// localStorage-backed actions via useActions(), so they always agree on what's open.
export function GlobalActionsBadge({ filteredPOs, allSuppliers, filters }: GlobalActionsBadgeProps) {
  const { actions, updateAction, addAction } = useActions();
  const [tab, setTab] = useState<ActionType>('flag');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [open, setOpen] = useState(false);

  return (
    <ActionsBadgeDrawer
      actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers} filters={filters}
      tab={tab} onTabChange={setTab} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
      open={open} onOpenChange={setOpen}
    />
  );
}
