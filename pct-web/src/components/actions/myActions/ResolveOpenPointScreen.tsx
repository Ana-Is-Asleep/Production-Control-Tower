'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ActionItem, ActionStatus } from '../../../types/actions';
import { daysOpen } from '../../../lib/actionsUtils';
import { formatDateMedium } from '../../../lib/dateUtils';

const STATUS_OPTIONS: ActionStatus[] = ['open', 'in_progress', 'blocked', 'closed'];
const STATUS_LABELS: Record<ActionStatus, string> = { open: 'Open', in_progress: 'In Progress', blocked: 'Blocked', closed: 'Closed' };

interface ResolveOpenPointScreenProps {
  queue: ActionItem[];
  currentId: string;
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onSelect: (id: string) => void;
  onNext: () => void; // advance past the last item -> final "all caught up" screen
  onPrevious: () => void;
}

// Same guided one-at-a-time pattern as ResolvePOScreen, but for Open Points — a required status
// update instead of a root cause, and no PO/PGRD data to show (Open Points may not belong to one).
export function ResolveOpenPointScreen({ queue, currentId, onSave, onSelect, onNext, onPrevious }: ResolveOpenPointScreenProps) {
  const index = queue.findIndex((a) => a.id === currentId);
  const action = queue[index];
  const [status, setStatus] = useState<ActionStatus>(action?.status ?? 'open');
  const [update, setUpdate] = useState('');
  const [showError, setShowError] = useState(false);
  const today = new Date();

  useEffect(() => {
    setStatus(action?.status ?? 'open');
    setUpdate('');
    setShowError(false);
  }, [action]);

  if (!action) return null;

  const handleSaveAndNext = () => {
    if (!update.trim()) { setShowError(true); return; }
    onSave(action.id, { status, comment: update.trim() });
    if (index >= queue.length - 1) onNext();
    else onSelect(queue[index + 1].id);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 py-3 border-b border-[#e9e3df] bg-white flex items-center gap-2">
        <span className="text-xs text-[#9c9794]">Open Point {index + 1} of {queue.length}</span>
      </div>

      <div className="p-6 max-w-xl space-y-5">
        <div>
          <p className="text-lg font-extrabold text-[#403833]">{action.description}</p>
          <p className="text-xs text-[#9c9794] mt-1">
            Open for {daysOpen(action, today) ?? '—'} days
            {action.dueDate && <> · Deadline {formatDateMedium(new Date(action.dueDate))}</>}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">What&apos;s the latest update? *</label>
            <textarea
              value={update}
              onChange={(e) => { setUpdate(e.target.value); setShowError(false); }}
              placeholder="Add an update…"
              rows={3}
              className={`w-full text-xs border rounded-lg px-2.5 py-2 resize-none ${showError ? 'border-fail' : 'border-[#e9e3df]'}`}
            />
            {showError && <p className="text-[10px] text-fail mt-1">An update is required to continue.</p>}
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ActionStatus)} className="w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-2">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={onPrevious} disabled={index === 0} className="flex items-center gap-1.5 text-xs font-semibold text-[#7b7571] border border-[#e9e3df] rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#403833] transition-colors">
            <ChevronLeft size={14} /> Previous
          </button>
          <button onClick={handleSaveAndNext} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-4 py-2 hover:bg-brand-soft transition-colors">
            Save &amp; Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
