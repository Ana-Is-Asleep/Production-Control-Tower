'use client';

import { useState } from 'react';
import { ActionsTabs } from './ActionsTabs';
import type { ActionItem } from '../../types/actions';

interface ActionsBadgeDrawerProps {
  actions: ActionItem[];
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onAddOpenPoint: (item: ActionItem) => void;
}

// Version A: a persistent bottom-right badge that opens a right-side drawer. No backdrop —
// the rest of the page stays visible and interactive while the drawer is open.
export function ActionsBadgeDrawer({ actions, onSave, onAddOpenPoint }: ActionsBadgeDrawerProps) {
  const [open, setOpen] = useState(false);
  const openCount = actions.filter((a) => a.status !== 'closed').length;

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
          <ActionsTabs actions={actions} onSave={onSave} onAddOpenPoint={onAddOpenPoint} />
        </div>
      )}
    </>
  );
}
