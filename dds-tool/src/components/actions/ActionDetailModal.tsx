'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ActionItem, ActionStatus } from '../../types/actions';
import { SCM_EMAILS, emailToDisplayName } from '../../lib/scmEmails';
import { daysOpen, reasonBucket } from '../../lib/actionsUtils';
import { formatDateMedium } from '../../lib/dateUtils';

const STATUS_OPTIONS: ActionStatus[] = ['open', 'in_progress', 'blocked', 'closed'];
const STATUS_LABELS: Record<ActionStatus, string> = { open: 'Open', in_progress: 'In Progress', blocked: 'Blocked', closed: 'Closed' };

interface ActionDetailModalProps {
  action: ActionItem;
  onSave: (patch: Partial<ActionItem>) => void;
  onClose: () => void;
}

// Full read/write detail view for one action — the row-click destination on the full Actions
// page. Unlike the lightweight ActionCard (drawer/panel), this always shows Created/Closed/Time
// Open and the complete comment history, and keeps Resolution Reason distinct from ongoing
// comments per the "never overwrite the original reason" requirement.
export function ActionDetailModal({ action, onSave, onClose }: ActionDetailModalProps) {
  const [draft, setDraft] = useState<ActionItem>(action);
  const [newComment, setNewComment] = useState('');
  const [showError, setShowError] = useState(false);

  const isClosing = draft.status === 'closed';
  const resolutionReasonMissing = isClosing && !draft.resolutionReason?.trim() && !action.resolutionReason?.trim();
  const today = new Date();

  const handleSave = () => {
    if (resolutionReasonMissing) { setShowError(true); return; }
    const patch: Partial<ActionItem> = { ...draft };
    if (newComment.trim()) patch.comment = newComment.trim();
    onSave(patch);
    onClose();
  };

  const history = [...(action.commentLog ?? [])].reverse();

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9e3df] shrink-0">
          <div>
            <p className="text-sm font-bold text-[#403833]">{action.type === 'flag' ? 'Flag' : 'Open Point'}{action.poReference ? ` · ${action.poReference}` : ''}</p>
            <p className="text-[11px] text-[#9c9794]">{action.supplierName || 'No supplier'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#f5f2ee] text-[#7b7571]"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Reason</p>
            <p className="text-xs text-[#403833]">{action.description || '—'}</p>
            <p className="text-[10px] text-[#9c9794] mt-1">{reasonBucket(action)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">Created</p><p className="text-[#403833] mt-0.5">{formatDateMedium(new Date(action.createdAt))}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">Closed</p><p className="text-[#403833] mt-0.5">{action.closedAt ? formatDateMedium(new Date(action.closedAt)) : '—'}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">Time Open</p><p className="text-[#403833] mt-0.5">{daysOpen(action, today) ?? '—'} days</p></div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">Owner / POC</p>
              <select value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} className="mt-0.5 w-full text-xs border border-[#e9e3df] rounded px-1.5 py-1">
                <option value="">No owner</option>
                {SCM_EMAILS.map((e) => <option key={e} value={e}>{emailToDisplayName(e)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Status</p>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ActionStatus })} className="text-xs border border-[#e9e3df] rounded px-2 py-1.5">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {isClosing && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Resolution Reason</p>
              <textarea
                value={draft.resolutionReason ?? action.resolutionReason ?? ''}
                onChange={(e) => { setDraft({ ...draft, resolutionReason: e.target.value }); setShowError(false); }}
                placeholder="Required to close — why/how was this resolved?"
                rows={2}
                className={`w-full text-xs border rounded px-2 py-1.5 resize-none ${showError && resolutionReasonMissing ? 'border-fail' : 'border-[#e9e3df]'}`}
              />
              {showError && resolutionReasonMissing && <p className="text-[10px] text-fail mt-1">A resolution reason is required to close this item.</p>}
            </div>
          )}

          {!isClosing && action.resolutionReason && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Resolution Reason (previous)</p>
              <p className="text-xs text-[#403833]">{action.resolutionReason}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Comment history</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
              {history.length === 0 && <p className="text-xs text-[#9c9794]">No comments yet.</p>}
              {history.map((c, i) => (
                <div key={i} className="bg-[#f9f7f6] rounded px-2.5 py-1.5">
                  <p className="text-xs text-[#403833]">{c.text}</p>
                  <p className="text-[10px] text-[#9c9794] mt-0.5">{formatDateMedium(new Date(c.at))}</p>
                </div>
              ))}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1.5 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#e9e3df] shrink-0">
          <button onClick={onClose} className="text-xs font-semibold text-[#9c9794] hover:text-[#403833] px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} className="text-xs font-semibold text-white bg-brand rounded-lg px-4 py-1.5 hover:bg-brand-soft transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}
