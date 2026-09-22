'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useActions } from '../../hooks/useActions';
import { useData } from '../../context/DataContext';
import { rootCauseMissing } from '../../lib/actionsUtils';
import { emailToDisplayName } from '../../lib/scmEmails';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { ROOT_CAUSE_REASONS, ROOT_CAUSE_REASON_LABELS, type ActionItem, type RootCauseReason } from '../../types/actions';
import type { PurchaseLine } from '../../types';

interface RootCauseActionQueueProps {
  lines: PurchaseLine[]; // same scope as the rest of the page — used only to look up each PO's PGRD for grouping, and to auto-fill a component supplier from a typed PO number
  filteredPOs: Set<string>;
}

interface WeekGroup {
  key: string;
  label: string;
  sortKey: number;
  items: ActionItem[];
}

const ROWS_PER_PAGE = 25;

function QueueRow({ action, onSave, allLines }: { action: ActionItem; onSave: (patch: Partial<ActionItem>) => void; allLines: PurchaseLine[] }) {
  const [draft, setDraft] = useState<ActionItem>(action);
  const incomplete = rootCauseMissing(draft);
  const dirty = draft.rootCauseReason !== action.rootCauseReason
    || draft.missingComponent !== action.missingComponent
    || draft.missingComponentSupplier !== action.missingComponentSupplier
    || draft.missingComponentPoNumber !== action.missingComponentPoNumber
    || draft.coverPoNumber !== action.coverPoNumber;

  const handleComponentPoChange = (value: string) => {
    const match = value.toUpperCase().startsWith('PO-') ? allLines.find((l) => l.po.toUpperCase() === value.toUpperCase()) : undefined;
    setDraft((d) => ({ ...d, missingComponentPoNumber: value, ...(match ? { missingComponentSupplier: match.supplier } : {}) }));
  };

  const handleResolve = () => {
    if (incomplete) return;
    onSave({ ...draft, status: 'closed' });
  };

  return (
    <tr className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6] align-top">
      <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{action.poReference}</td>
      <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{action.supplierName || '—'}</td>
      <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{action.owner ? emailToDisplayName(action.owner) : '—'}</td>
      <td className="px-3 py-2 min-w-[160px]">
        <select
          value={draft.rootCauseReason ?? ''}
          onChange={(e) => {
            const value = (e.target.value || undefined) as RootCauseReason | undefined;
            setDraft({ ...draft, rootCauseReason: value, missingComponent: undefined, missingComponentSupplier: undefined, missingComponentPoNumber: undefined, coverPoNumber: undefined });
          }}
          className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1"
        >
          <option value="">Select a root cause…</option>
          {ROOT_CAUSE_REASONS.map((r) => <option key={r} value={r}>{ROOT_CAUSE_REASON_LABELS[r]}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 min-w-[220px]">
        {draft.rootCauseReason === 'components_delay' && (
          <div className="flex flex-col gap-1">
            <input
              value={draft.missingComponent ?? ''}
              onChange={(e) => setDraft({ ...draft, missingComponent: e.target.value })}
              placeholder="Which component? (required)"
              className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1"
            />
            <input
              value={draft.missingComponentPoNumber ?? ''}
              onChange={(e) => handleComponentPoChange(e.target.value)}
              placeholder="Component supplier PO # (optional)"
              className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1"
            />
            <input
              value={draft.missingComponentSupplier ?? ''}
              onChange={(e) => setDraft({ ...draft, missingComponentSupplier: e.target.value })}
              placeholder="Component supplier (optional)"
              className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1"
            />
          </div>
        )}
        {draft.rootCauseReason === 'covers' && (
          <input
            value={draft.coverPoNumber ?? ''}
            onChange={(e) => setDraft({ ...draft, coverPoNumber: e.target.value })}
            placeholder="Cover supplier PO # (required)"
            className="w-full text-xs border border-[#e9e3df] rounded px-2 py-1"
          />
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={handleResolve}
          disabled={incomplete}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${incomplete ? 'bg-[#f5f2ee] text-[#c8c0bb] cursor-not-allowed' : dirty ? 'bg-brand text-white hover:bg-brand-soft' : 'bg-pass-bg text-pass'}`}
        >
          Resolve
        </button>
      </td>
    </tr>
  );
}

// The SCM-facing queue that actually produces the Root Cause data going forward: every PO that
// missed SOT (rule R002, raised on the SOT/OTIF page) needs a manually-selected root cause before
// it can be closed. A table, not cards — this queue routinely holds hundreds of POs, so density
// matters far more than the card-per-item treatment used in the general Actions drawer. Grouped by
// PGRD week (collapsed by default, since a single week's cohort alone can run to a hundred rows).
export function RootCauseActionQueue({ lines, filteredPOs }: RootCauseActionQueueProps) {
  const { actions, updateAction } = useActions();
  const { allLines } = useData();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const pgrdByPO = useMemo(() => {
    const map = new Map<string, Date>();
    lines.forEach((l) => { if (l.pgrd && !map.has(l.po)) map.set(l.po, l.pgrd); });
    return map;
  }, [lines]);

  const groups = useMemo((): WeekGroup[] => {
    const pending = actions.filter((a) =>
      a.type === 'flag' && a.ruleKey === 'R002' && a.status !== 'closed' &&
      (!a.poReference || filteredPOs.has(a.poReference))
    );

    const byWeek = new Map<string, WeekGroup>();
    pending.forEach((a) => {
      const pgrd = a.poReference ? pgrdByPO.get(a.poReference) : undefined;
      const key = pgrd ? `${getISOWeekYear(pgrd)}-${String(getISOWeek(pgrd)).padStart(2, '0')}` : 'unknown';
      const label = pgrd ? `PGRD W${String(getISOWeek(pgrd)).padStart(2, '0')} ${getISOWeekYear(pgrd)}` : 'PGRD unknown';
      if (!byWeek.has(key)) byWeek.set(key, { key, label, items: [], sortKey: pgrd ? pgrd.getTime() : Infinity });
      byWeek.get(key)!.items.push(a);
    });

    return [...byWeek.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [actions, filteredPOs, pgrdByPO]);

  const totalPending = groups.reduce((s, g) => s + g.items.length, 0);

  const toggleWeek = (key: string) => setExpandedWeeks((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-2" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-[#403833]">POs Needing a Root Cause</p>
          <p className="text-[11px] text-[#9c9794]">POs that missed SOT, awaiting a root cause — grouped by PGRD week</p>
        </div>
        <span className="text-xs font-semibold text-[#7b7571] shrink-0">{totalPending} pending</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-4 text-center">No POs pending a root cause.</p>
      ) : (
        <div className="divide-y divide-[#f4f1ef]">
          {groups.map((g) => {
            const expanded = expandedWeeks.has(g.key);
            const visibleCount = visibleCounts[g.key] ?? ROWS_PER_PAGE;
            const visible = g.items.slice(0, visibleCount);
            return (
              <div key={g.key} className="py-1.5">
                <button
                  onClick={() => toggleWeek(g.key)}
                  className="w-full flex items-center justify-between gap-1 text-xs font-bold text-[#403833] py-1 hover:text-brand transition-colors"
                >
                  <span className="flex items-center gap-1.5">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {g.label}</span>
                  <span className="text-[11px] font-semibold text-[#9c9794]">{g.items.length} POs</span>
                </button>
                {expanded && (
                  <>
                    <div className="overflow-x-auto mt-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#403833] text-white">
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO Number</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Owner</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Root Cause</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Detail</th>
                            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((a) => (
                            <Fragment key={a.id}>
                              <QueueRow action={a} allLines={allLines} onSave={(patch) => updateAction(a.id, patch)} />
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {g.items.length > visibleCount && (
                      <button
                        onClick={() => setVisibleCounts((c) => ({ ...c, [g.key]: (c[g.key] ?? ROWS_PER_PAGE) + ROWS_PER_PAGE }))}
                        className="text-xs text-brand font-semibold hover:underline mt-2"
                      >
                        Show {Math.min(ROWS_PER_PAGE, g.items.length - visibleCount)} more (of {g.items.length}) →
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
