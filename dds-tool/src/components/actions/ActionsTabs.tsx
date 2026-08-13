'use client';

import { useState } from 'react';
import { ActionCard } from './ActionCard';
import type { ActionItem, ActionType } from '../../types/actions';

interface ActionsTabsProps {
  actions: ActionItem[];
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onAddOpenPoint: (item: ActionItem) => void;
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

export function ActionsTabs({ actions, onSave, onAddOpenPoint }: ActionsTabsProps) {
  const [tab, setTab] = useState<ActionType>('flag');
  const [draftingNew, setDraftingNew] = useState(false);

  const flags = actions.filter((a) => a.type === 'flag').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openPoints = actions.filter((a) => a.type === 'open_point').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = tab === 'flag' ? flags : openPoints;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-[#e9e3df] shrink-0">
        <button
          onClick={() => setTab('flag')}
          className={`flex-1 text-xs font-semibold py-2.5 border-b-2 transition-colors ${tab === 'flag' ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'}`}
        >
          Flags ({flags.length})
        </button>
        <button
          onClick={() => setTab('open_point')}
          className={`flex-1 text-xs font-semibold py-2.5 border-b-2 transition-colors ${tab === 'open_point' ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'}`}
        >
          Open Points ({openPoints.length})
        </button>
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
          <ActionCard key={a.id} action={a} onSave={(patch) => onSave(a.id, patch)} />
        ))}
      </div>
    </div>
  );
}
