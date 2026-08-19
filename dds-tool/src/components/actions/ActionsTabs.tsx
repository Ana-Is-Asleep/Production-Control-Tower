'use client';

import { useState } from 'react';
import { ActionCard } from './ActionCard';
import type { ActionItem, ActionType } from '../../types/actions';

export type StatusFilter = 'open' | 'all';

interface ActionsTabsProps {
  actions: ActionItem[];
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onAddOpenPoint: (item: ActionItem) => void;
  // PO numbers that survive the dashboard's supplier/channel/category filters (deliberately NOT
  // the week-range filter — flags evaluate their own date rule independent of the selected week).
  // Open points aren't tied to uploaded PO data, so they're never filtered by this.
  filteredPOs: Set<string>;
  allSuppliers: string[];
  // tab and statusFilter are controlled from Dashboard.tsx so the Badge and Panel Actions views
  // stay in sync — switching between them keeps your place instead of resetting to Flags/Open.
  tab: ActionType;
  onTabChange: (t: ActionType) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
}

function blankOpenPoint(): ActionItem {
  return {
    id: '',
    type: 'open_point',
    description: '',
    owner: '',
    comment: '',
    status: 'open',
    createdAt: '',
    updatedAt: '',
  };
}

export function ActionsTabs({
  actions, onSave, onAddOpenPoint, filteredPOs, allSuppliers,
  tab, onTabChange, statusFilter, onStatusFilterChange,
}: ActionsTabsProps) {
  const [draftingNew, setDraftingNew] = useState(false);

  const matchesStatus = (a: ActionItem) => statusFilter === 'all' || a.status !== 'closed';

  const flags = actions
    .filter((a) => a.type === 'flag' && (!a.poReference || filteredPOs.has(a.poReference)) && matchesStatus(a))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openPoints = actions
    .filter((a) => a.type === 'open_point' && matchesStatus(a))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = tab === 'flag' ? flags : openPoints;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-[#e9e3df] shrink-0">
        <button
          onClick={() => onTabChange('flag')}
          className={`flex-1 text-xs font-semibold py-2.5 border-b-2 transition-colors ${tab === 'flag' ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'}`}
        >
          Flags ({flags.length})
        </button>
        <button
          onClick={() => onTabChange('open_point')}
          className={`flex-1 text-xs font-semibold py-2.5 border-b-2 transition-colors ${tab === 'open_point' ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'}`}
        >
          Open Points ({openPoints.length})
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#e9e3df] shrink-0">
        {(['open', 'all'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => onStatusFilterChange(f)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              statusFilter === f ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
            }`}
          >
            {f === 'open' ? 'Open' : 'All (incl. closed)'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {tab === 'open_point' && !draftingNew && (
          <button
            onClick={() => setDraftingNew(true)}
            className="w-full text-xs font-semibold text-brand border border-dashed border-brand rounded-lg py-2 hover:bg-brand-dim transition-colors"
          >
            + Add open point
          </button>
        )}
        {tab === 'open_point' && draftingNew && (
          <ActionCard
            action={blankOpenPoint()}
            startInEdit
            onDiscard={() => setDraftingNew(false)}
            allSuppliers={allSuppliers}
            onSave={(patch) => {
              const now = new Date().toISOString();
              onAddOpenPoint({ ...blankOpenPoint(), ...patch, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
              setDraftingNew(false);
            }}
          />
        )}

        {list.length === 0 && !(tab === 'open_point' && draftingNew) && (
          <p className="text-xs text-[#9c9794] text-center py-6">{tab === 'flag' ? 'No flags' : 'No open points'}</p>
        )}
        {list.map((a) => (
          <ActionCard key={a.id} action={a} onSave={(patch) => onSave(a.id, patch)} allSuppliers={allSuppliers} />
        ))}
      </div>
    </div>
  );
}
