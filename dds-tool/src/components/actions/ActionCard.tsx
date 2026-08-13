'use client';

import { useState } from 'react';
import type { ActionItem, ActionStatus } from '../../types/actions';
import { SCM_EMAILS } from '../../lib/scmEmails';
import { isoWeekLabel, getISOWeekYear } from '../../lib/dateUtils';

const STATUS_STYLES: Record<ActionStatus, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: '#FEE2E2', text: '#991B1B' },
  in_progress: { label: 'In Progress', bg: '#FEF3C7', text: '#92400E' },
  blocked: { label: 'Blocked', bg: '#e9e3df', text: '#58524e' },
  closed: { label: 'Closed', bg: '#DCFCE7', text: '#14532D' },
};

const STATUS_OPTIONS: ActionStatus[] = ['open', 'in_progress', 'blocked', 'closed'];

function StatusBadge({ status }: { status: ActionStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

interface ActionCardProps {
  action: ActionItem;
  onSave: (patch: Partial<ActionItem>) => void;
  startInEdit?: boolean;
  onDiscard?: () => void; // only used for an unsaved "add open point" draft
}

export function ActionCard({ action, onSave, startInEdit = false, onDiscard }: ActionCardProps) {
  const [editing, setEditing] = useState(startInEdit);
  const [draft, setDraft] = useState<ActionItem>(action);

  const createdDate = new Date(action.createdAt);
  const createdLabel = isNaN(createdDate.getTime()) ? '' : `${isoWeekLabel(createdDate)} ${getISOWeekYear(createdDate)}`;

  if (!editing) {
    return (
      <div
        onClick={() => { setDraft(action); setEditing(true); }}
        className="bg-white border border-[#e9e3df] rounded-lg p-3 cursor-pointer hover:border-brand transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#403833] truncate">
              {action.supplierName || 'No supplier'}{action.poReference ? ` · ${action.poReference}` : ''}
            </p>
            <p className="text-xs text-[#58524e] mt-0.5 line-clamp-2">{action.description || '—'}</p>
          </div>
          <StatusBadge status={action.status} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-[#9c9794] gap-2">
          <span className="truncate">{action.owner || 'No owner'}</span>
          <span className="shrink-0">{createdLabel}</span>
        </div>
        {action.comment && <p className="text-[11px] text-[#7b7571] mt-1.5 line-clamp-2">{action.comment}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white border border-brand rounded-lg p-3 space-y-2">
      {action.type === 'open_point' ? (
        <>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Describe the open point…"
            className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1.5 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <input
              value={draft.supplierName ?? ''}
              onChange={(e) => setDraft({ ...draft, supplierName: e.target.value })}
              placeholder="Supplier (optional)"
              className="flex-1 min-w-0 text-xs border border-[#e9e3df] rounded px-2 py-1"
            />
            <input
              value={draft.poReference ?? ''}
              onChange={(e) => setDraft({ ...draft, poReference: e.target.value })}
              placeholder="PO (optional)"
              className="w-28 text-xs border border-[#e9e3df] rounded px-2 py-1"
            />
          </div>
        </>
      ) : (
        <div>
          <p className="text-xs font-semibold text-[#403833]">
            {action.supplierName || 'No supplier'}{action.poReference ? ` · ${action.poReference}` : ''}
          </p>
          <p className="text-xs text-[#58524e] mt-0.5">{action.description}</p>
        </div>
      )}

      <div className="flex gap-2">
        <select
          value={draft.owner}
          onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
          className="flex-1 min-w-0 text-[11px] border border-[#e9e3df] rounded px-1.5 py-1"
        >
          <option value="">No owner</option>
          {SCM_EMAILS.map((email) => <option key={email} value={email}>{email}</option>)}
        </select>
        <select
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as ActionStatus })}
          className="text-[11px] border border-[#e9e3df] rounded px-1.5 py-1"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
        </select>
      </div>

      <textarea
        value={draft.comment}
        onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
        placeholder="Comment…"
        className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1.5 resize-none"
        rows={2}
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={() => { if (onDiscard) onDiscard(); else setEditing(false); }}
          className="text-[11px] text-[#9c9794] hover:text-[#403833] px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          className="text-[11px] font-semibold text-white bg-brand rounded px-3 py-1 hover:bg-brand-soft transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
