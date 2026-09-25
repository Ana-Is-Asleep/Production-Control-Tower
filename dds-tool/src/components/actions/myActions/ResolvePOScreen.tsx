'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Circle, Target } from 'lucide-react';
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
  queue: ActionItem[]; // live items (fresh from the store), scoped to the current rule-type batch
  currentId: string;
  weekLabel: string;
  sectionLabel: string; // this batch's rule label, e.g. "EGRD in the past with no booking"
  stepIndex: number; // 1-based — which rule-type batch this is
  stepTotal: number; // how many rule-type batches there are in total this week
  onSave: (id: string, patch: Partial<ActionItem>) => void;
  onSelect: (id: string) => void;
  onNext: () => void; // advance past the last item in this batch -> next batch, or completion screen
  onPrevious: () => void;
}

// Focused, one-PO-at-a-time resolution screen — the guided workflow's core. Root cause is always
// required here (not just to close, per ActionDetailModal's rule) since the entire point of this
// flow is collecting the SCM's answer; Status is free to leave as anything. The queue passed in is
// already scoped to one rule-type batch (see MyActionsPage's poGroups) — Save & Next only ever
// moves within this batch; crossing into the next batch is the caller's job (onNext).
export function ResolvePOScreen({ queue, currentId, weekLabel, sectionLabel, stepIndex, stepTotal, onSave, onSelect, onNext, onPrevious }: ResolvePOScreenProps) {
  const { allLines } = useData();
  const index = queue.findIndex((a) => a.id === currentId);
  const action = queue[index];
  const [draft, setDraft] = useState<ActionItem | null>(action ?? null);
  const [newComment, setNewComment] = useState('');
  const [showError, setShowError] = useState(false);
  const [showLines, setShowLines] = useState(false);

  useEffect(() => {
    setDraft(action ?? null);
    setNewComment('');
    setShowError(false);
    setShowLines(false);
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
  // Non-R002 flags (e.g. R001 "book this shipment") have no structured root cause, but closing one
  // still needs a real explanation of why it happened — "Booked" isn't an answer, it's a status.
  // Same resolution-reason contract ActionCard/ActionDetailModal already enforce elsewhere: only
  // required at the moment of closing, not before.
  const resolutionReasonRequired = !rootCauseRequired;
  const isClosing = draft.status === 'closed';
  const resolutionReasonMissing = resolutionReasonRequired && isClosing && !draft.resolutionReason?.trim();
  const incomplete = (rootCauseRequired && rootCauseMissing(draft)) || resolutionReasonMissing;
  const explanation = explainAction(action, poLine, rootCauseRequired);

  const handleComponentPoChange = (value: string) => {
    const match = value.toUpperCase().startsWith('PO-') ? allLines.find((l) => l.po.toUpperCase() === value.toUpperCase()) : undefined;
    setDraft((d) => d && ({ ...d, missingComponentPoNumber: value, ...(match ? { missingComponentSupplier: match.supplier } : {}) }));
  };

  // Selecting a root cause IS the resolution for an R002 flag (Ana: "root cause selection already
  // is the why for these" — same rule ActionDetailModal documents) — so once it's complete, close
  // the flag automatically instead of making the SCM also flip Status by hand. Clearing it back to
  // incomplete reopens it, so a closed flag never ends up without a valid root cause.
  const updateRootCauseField = (patch: Partial<ActionItem>) => {
    setDraft((d) => {
      if (!d) return d;
      const merged = { ...d, ...patch };
      const stillMissing = rootCauseMissing(merged);
      if (stillMissing) return merged.status === 'closed' ? { ...merged, status: 'open' } : merged;
      return merged.status === 'closed' ? merged : { ...merged, status: 'closed' };
    });
    setShowError(false);
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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Step {stepIndex} of {stepTotal}</p>
          <p className="text-xs font-bold text-[#403833] mt-0.5">{sectionLabel}</p>
          <p className="text-[10px] text-[#9c9794] mt-0.5">{weekLabel} · {completedCount} of {queue.length} completed</p>
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
              <p className="text-xs text-[#9c9794] mt-0.5">
                {action.supplierName || 'No supplier'}
                {poLine?.destination && <> · {poLine.destination}</>}
              </p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1.5 ${draft.status === 'closed' ? 'bg-pass-bg text-pass-text' : 'bg-fail-bg text-fail-text'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[draft.status]}`} />
              {STATUS_LABELS[draft.status]}
            </span>
          </div>

          <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
            <POTimeline line={poLine} />
          </div>

          <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden">
            <button
              onClick={() => setShowLines((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794]">
                SKUs &amp; quantities ({poLines.length} line{poLines.length === 1 ? '' : 's'})
              </span>
              <ChevronDown size={14} className={`text-[#9c9794] transition-transform ${showLines ? 'rotate-180' : ''}`} />
            </button>
            {showLines && (
              <div className="overflow-x-auto border-t border-[#f4f1ef]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#9c9794]">
                      {['SKU', 'Qty Ordered', 'Qty Confirmed', 'PGRD', 'EGRD', 'ESD', 'ASD'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poLines.map((l) => (
                      <tr key={`${l.po}-${l.line}`} className="border-t border-[#f4f1ef]">
                        <td className="px-3 py-1.5 font-semibold text-[#403833] whitespace-nowrap">{l.sku}</td>
                        <td className="px-3 py-1.5 text-[#58524e]">{l.qty.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-[#58524e]">{l.cqty.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(l.pgrd)}</td>
                        <td className="px-3 py-1.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(l.egrd)}</td>
                        <td className="px-3 py-1.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(l.esd)}</td>
                        <td className="px-3 py-1.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(l.asd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                    updateRootCauseField({ rootCauseReason: value, missingComponent: undefined, coverPoNumber: undefined });
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
                      onChange={(e) => updateRootCauseField({ missingComponent: e.target.value })}
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
                    onChange={(e) => updateRootCauseField({ coverPoNumber: e.target.value })}
                    placeholder="Cover supplier's PO number (delayed)"
                    className={`mt-2 w-full text-xs border rounded-lg px-2.5 py-2 ${showError && incomplete ? 'border-fail' : 'border-[#e9e3df]'}`}
                  />
                )}
                {showError && incomplete && <p className="text-[10px] text-fail mt-1">A root cause is required to continue.</p>}
              </div>
            )}

            {resolutionReasonRequired && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Why did this happen?{isClosing ? ' (required to close)' : ''}</label>
                <div className="bg-[#fff7ed] border border-brand/30 rounded-lg px-2.5 py-2 text-[10px] text-[#7b7571] leading-relaxed mb-1.5">
                  <p className="font-semibold text-[#403833] mb-1">Before closing — capture the root cause (5 Whys):</p>
                  1. Why did this happen? → 2. Why did that happen? → 3. Why? → 4. Why? → 5. Why? (root cause)
                </div>
                <textarea
                  value={draft.resolutionReason ?? ''}
                  onChange={(e) => { setDraft({ ...draft, resolutionReason: e.target.value }); setShowError(false); }}
                  placeholder="Required to close — walk through the 5 Whys above (e.g. why wasn't this booked?)"
                  rows={3}
                  className={`w-full text-xs border rounded-lg px-2.5 py-2 resize-none ${showError && resolutionReasonMissing ? 'border-fail' : 'border-[#e9e3df]'}`}
                />
                {showError && resolutionReasonMissing && <p className="text-[10px] text-fail mt-1">A resolution reason is required to close this item — "Booked" isn't a reason.</p>}
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
