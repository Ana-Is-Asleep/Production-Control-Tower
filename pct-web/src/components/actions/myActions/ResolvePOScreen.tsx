'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Target } from 'lucide-react';
import type { ActionItem, ActionStatus, RootCauseReason } from '../../../types/actions';
import { ROOT_CAUSE_REASONS, ROOT_CAUSE_REASON_LABELS } from '../../../types/actions';
import { needsRootCause, rootCauseMissing } from '../../../lib/actionsUtils';
import { progressBucket } from '../../../lib/myActionsUtils';
import { isSubstantiveReason } from '../../../lib/reasonClassification';
import { formatDateMedium } from '../../../lib/dateUtils';
import { useData } from '../../../context/DataContext';
import { POTimeline } from './POTimeline';
import type { PurchaseLine } from '../../../types';

// Spelled out per-rule with this PO's own dates, rather than the generic rule label — "EGRD in
// the past with no booking" alone didn't make clear WHAT the SCM was being asked to do about it
// (R001 just needs a booking, no root cause; R002 needs a root cause to close). Falls back to the
// stored description for any future rule this doesn't know about yet.
function explainAction(action: ActionItem, poLine: PurchaseLine | undefined, rootCauseRequired: boolean): { headline: string; detail: string } {
  if (action.ruleKey === 'R001') {
    const egrd = poLine?.egrd ? formatDateMedium(poLine.egrd) : null;
    return {
      headline: 'EGRD passed with no shipment booked',
      detail: `${egrd ? `Expected Goods Ready Date was ${egrd} — already past — and no` : 'No'} Expected Shipping Date (ESD) has been booked yet for this PO. Book the shipment, then update the status below — no root cause needed here.`,
    };
  }
  if (action.ruleKey === 'R002') {
    return {
      headline: 'Missed SOT target',
      detail: 'This PO’s PGRD week closed without shipping on time. Select the root cause below to close this flag.',
    };
  }
  return { headline: action.description, detail: rootCauseRequired ? 'Root cause required.' : '' };
}

const STATUS_OPTIONS: ActionStatus[] = ['open', 'in_progress', 'blocked', 'closed'];
const STATUS_LABELS: Record<ActionStatus, string> = { open: 'Open', in_progress: 'In Progress', blocked: 'Blocked', closed: 'Closed' };
const STATUS_DOT: Record<ActionStatus, string> = { open: 'bg-fail', in_progress: 'bg-warn', blocked: 'bg-[#9c9794]', closed: 'bg-pass' };

interface ResolvePOScreenProps {
  queue: ActionItem[]; // live items (fresh from the store), in stable queue order
  currentId: string;
  weekLabel: string;
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onSelect: (id: string) => void;
  onNext: () => void; // advance past the last item -> completion screen
  onPrevious: () => void;
}

// Focused, one-PO-at-a-time resolution screen — the guided workflow's core. Root cause is always
// required here (not just to close, per ActionDetailModal's rule) since the entire point of this
// flow is collecting the SCM's answer; Status is free to leave as anything.
export function ResolvePOScreen({ queue, currentId, weekLabel, onSave, onSelect, onNext, onPrevious }: ResolvePOScreenProps) {
  const { allLines } = useData();
  const index = queue.findIndex((a) => a.id === currentId);
  const action = queue[index];
  const [draft, setDraft] = useState<ActionItem | null>(action ?? null);
  const [newComment, setNewComment] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    setDraft(action ?? null);
    setNewComment('');
    setShowError(false);
  }, [action]);

  const poLines = useMemo(() => allLines.filter((l) => l.po === action?.poReference), [allLines, action]);
  const poLine = poLines[0];
  // The supplier's own free-text reason from the raw BC export — shown as reference context only
  // (this is the OLD, unclassified data source; it never feeds the Root Cause graph anymore), so
  // the SCM can see what the supplier said before picking their own structured answer below.
  const supplierReasons = useMemo(() => {
    const set = new Set<string>();
    poLines.forEach((l) => { const r = l.lossReasonCode.trim(); if (isSubstantiveReason(r)) set.add(r); });
    return [...set];
  }, [poLines]);

  const completedCount = queue.filter((a) => progressBucket(a.status) === 'completed').length;

  if (!action || !draft) return null;

  const rootCauseRequired = needsRootCause(action);
  const incomplete = rootCauseRequired && rootCauseMissing(draft);
  const explanation = explainAction(action, poLine, rootCauseRequired);

  const handleComponentPoChange = (value: string) => {
    const match = value.toUpperCase().startsWith('PO-') ? allLines.find((l) => l.po.toUpperCase() === value.toUpperCase()) : undefined;
    setDraft((d) => d && ({ ...d, missingComponentPoNumber: value, ...(match ? { missingComponentSupplier: match.supplier } : {}) }));
  };

  const commit = () => {
    if (incomplete) { setShowError(true); return false; }
    const patch: Partial<ActionItem> = { ...draft };
    if (newComment.trim()) patch.comment = newComment.trim();
    onSave(action.id, patch);
    return true;
  };

  const handleSaveAndNext = () => {
    if (!commit()) return;
    if (index >= queue.length - 1) onNext();
    else onSelect(queue[index + 1].id);
  };

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Compact queue — always visible so Save & Next progress and direct jumps both work from
          the same place, per spec point 4. */}
      <div className="w-60 shrink-0 border-r border-[#e9e3df] bg-white flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#f4f1ef] shrink-0">
          <p className="text-xs font-bold text-[#403833]">{weekLabel} Actions</p>
          <p className="text-[10px] text-[#9c9794] mt-0.5">{completedCount} of {queue.length} completed</p>
          <div className="h-1.5 bg-[#f5f2ee] rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-brand transition-all" style={{ width: `${queue.length ? (completedCount / queue.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {queue.map((a, i) => {
            const bucket = progressBucket(a.status);
            const isCurrent = a.id === currentId;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f4f1ef] transition-colors ${isCurrent ? 'bg-[#fff7ed]' : 'hover:bg-[#f9f7f6]'}`}
              >
                {bucket === 'completed' ? (
                  <CheckCircle2 size={14} className="text-pass shrink-0" />
                ) : isCurrent ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-brand shrink-0" />
                ) : (
                  <Circle size={14} className="text-[#d6cfc9] shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold truncate ${isCurrent ? 'text-brand' : 'text-[#403833]'}`}>{a.poReference || `#${i + 1}`}</span>
                  <span className="block text-[10px] text-[#9c9794] truncate">{STATUS_LABELS[a.status]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-3 border-b border-[#e9e3df] bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onPrevious} disabled={index === 0} className="p-1 rounded hover:bg-[#f5f2ee] disabled:opacity-30 disabled:cursor-not-allowed text-[#7b7571]">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[#9c9794]">{index + 1} of {queue.length}</span>
            <button
              onClick={() => (index < queue.length - 1 ? onSelect(queue[index + 1].id) : undefined)}
              disabled={index >= queue.length - 1}
              className="p-1 rounded hover:bg-[#f5f2ee] disabled:opacity-30 disabled:cursor-not-allowed text-[#7b7571]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 max-w-2xl space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold text-[#403833]">{action.poReference}</p>
              <p className="text-xs text-[#9c9794] mt-0.5">{action.supplierName || 'No supplier'}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1.5 ${draft.status === 'closed' ? 'bg-pass-bg text-pass-text' : 'bg-fail-bg text-fail-text'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[draft.status]}`} />
              {STATUS_LABELS[draft.status]}
            </span>
          </div>

          <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
            <POTimeline line={poLine} />
          </div>

          <div className="bg-[#fff7ed] border border-brand/20 rounded-lg p-4 flex items-start gap-3">
            <Target size={16} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">Why this action exists</p>
              <p className="text-sm font-bold text-[#403833] mt-0.5">{explanation.headline}</p>
              {explanation.detail && <p className="text-xs text-[#7b7571] mt-1 leading-relaxed">{explanation.detail}</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3">
            <p className="text-xs font-bold text-[#403833]">Resolve action</p>

            {supplierReasons.length > 0 && (
              <div className="bg-[#f5f2ee] rounded-lg px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Supplier&apos;s stated reason (from file)</p>
                {supplierReasons.map((r, i) => (
                  <p key={i} className="text-xs text-[#58524e]">{r}</p>
                ))}
              </div>
            )}

            {rootCauseRequired && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Root cause *</label>
                <select
                  value={draft.rootCauseReason ?? ''}
                  onChange={(e) => {
                    const value = (e.target.value || undefined) as RootCauseReason | undefined;
                    setDraft({ ...draft, rootCauseReason: value, missingComponent: undefined, coverPoNumber: undefined });
                    setShowError(false);
                  }}
                  className={`w-full text-xs border rounded-lg px-2.5 py-2 ${showError && incomplete ? 'border-fail' : 'border-[#e9e3df]'}`}
                >
                  <option value="">Select a root cause…</option>
                  {ROOT_CAUSE_REASONS.map((r) => <option key={r} value={r}>{ROOT_CAUSE_REASON_LABELS[r]}</option>)}
                </select>
                {draft.rootCauseReason === 'components_delay' && (
                  <div className="mt-2 space-y-2">
                    <input
                      value={draft.missingComponent ?? ''}
                      onChange={(e) => { setDraft({ ...draft, missingComponent: e.target.value }); setShowError(false); }}
                      placeholder="Which component is missing? (required)"
                      className={`w-full text-xs border rounded-lg px-2.5 py-2 ${showError && incomplete ? 'border-fail' : 'border-[#e9e3df]'}`}
                    />
                    <input
                      value={draft.missingComponentPoNumber ?? ''}
                      onChange={(e) => handleComponentPoChange(e.target.value)}
                      placeholder="Component supplier's PO number (optional)"
                      className="w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-2"
                    />
                    <input
                      value={draft.missingComponentSupplier ?? ''}
                      onChange={(e) => setDraft({ ...draft, missingComponentSupplier: e.target.value })}
                      placeholder="Component supplier (optional)"
                      className="w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-2"
                    />
                  </div>
                )}
                {draft.rootCauseReason === 'covers' && (
                  <input
                    value={draft.coverPoNumber ?? ''}
                    onChange={(e) => { setDraft({ ...draft, coverPoNumber: e.target.value }); setShowError(false); }}
                    placeholder="Cover supplier's PO number (delayed)"
                    className={`mt-2 w-full text-xs border rounded-lg px-2.5 py-2 ${showError && incomplete ? 'border-fail' : 'border-[#e9e3df]'}`}
                  />
                )}
                {showError && incomplete && <p className="text-[10px] text-fail mt-1">A root cause is required to continue.</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Additional details</label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add any relevant details…"
                  rows={3}
                  className="w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-2 resize-none"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Status</label>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as ActionStatus })}
                    className="w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-2"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Deadline</label>
                  <input
                    type="date"
                    value={draft.dueDate ? draft.dueDate.slice(0, 10) : ''}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-2"
                  />
                </div>
              </div>
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
    </div>
  );
}
