'use client';

import { ActionsTabs } from './ActionsTabs';
import type { ActionItem } from '../../types/actions';

interface ActionsSidePanelProps {
  actions: ActionItem[];
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onAddOpenPoint: (item: ActionItem) => void;
}

// Version B: always-visible right panel — the caller is responsible for shrinking the main
// content area to make room for it (see Dashboard.tsx).
export function ActionsSidePanel({ actions, onSave, onAddOpenPoint }: ActionsSidePanelProps) {
  return (
    <div className="w-[360px] shrink-0 border-l border-[#e9e3df] bg-white flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#e9e3df] shrink-0">
        <h2 className="text-sm font-semibold text-[#403833]">Actions</h2>
      </div>
      <ActionsTabs actions={actions} onSave={onSave} onAddOpenPoint={onAddOpenPoint} />
    </div>
  );
}
