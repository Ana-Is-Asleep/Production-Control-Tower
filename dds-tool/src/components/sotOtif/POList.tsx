'use client';

import { Fragment, useMemo, useState } from 'react';
import { formatDateShort } from '../../lib/dateUtils';
import type { PORollup } from '../../lib/poAggregation';

type POFilter = 'not_sot' | 'sot' | 'not_otif' | 'otif' | 'awaiting_confirmation';

const FILTER_OPTIONS: { key: POFilter; label: string }[] = [
  { key: 'not_sot', label: 'Not shipped on time' },
  { key: 'sot', label: 'Shipped on time' },
  { key: 'not_otif', label: 'Not OTIF' },
  { key: 'otif', label: 'OTIF' },
  { key: 'awaiting_confirmation', label: 'ASD pending confirmation' },
];

// Booking exists (ESD filled) and that booked date has already passed with no confirmed ASD yet —
// not just any unconfirmed booking, only ones that are already overdue for confirmation.
function isAwaitingConfirmation(r: PORollup, today: Date) {
  return !!r.esd && r.esd < today && !r.asd;
}

function matchesFilter(r: PORollup, f: POFilter, today: Date): boolean {
  if (f === 'not_sot') return r.sot === false;
  if (f === 'sot') return r.sot === true;
  if (f === 'not_otif') return r.otif === false;
  if (f === 'otif') return r.otif === true;
  return isAwaitingConfirmation(r, today);
}

// Sort priority: late with no ASD at all first (worst), then late but at least shipped, then
// everything else (on time / undetermined) last.
function sortRank(r: PORollup): number {
  if (r.sot === false && !r.asd) return 0;
  if (r.sot === false && r.asd) return 1;
  return 2;
}

// Day offsets purely for display, derived from fields the rollup already carries — not a new
// SOT/OTIF calculation. SOT Days: ship date vs PGRD (the same anchor the SOT rule uses). Delay
// Days: EGRD vs PGRD (the same anchor the OTIF week-comparison rule uses), just expressed in days.
function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function dayOffsetLabel(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return '0d';
  return days > 0 ? `+${days}d` : `${days}d`;
}

function StatusPill({ ok, yesLabel, noLabel }: { ok: boolean | null; yesLabel: string; noLabel: string }) {
  if (ok === null) return <span className="text-[#b5aaa5]">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ok ? 'bg-pass-bg text-pass' : 'bg-fail-bg text-fail'}`}>
      {ok ? yesLabel : noLabel}
    </span>
  );
}

function LineDetail({ rollup }: { rollup: PORollup }) {
  const [showAll, setShowAll] = useState(false);
  const hasLineData = rollup.lines.some((l) => l.sku);
  if (!hasLineData) return null;

  const visible = showAll ? rollup.lines : rollup.lines.slice(0, 5);

  return (
    <div className="bg-[#f9f7f6] px-4 py-2 border-t border-[#e9e3df]">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[#9c9794]">
            <th className="text-left font-semibold uppercase tracking-wide pb-1">SKU</th>
            <th className="text-right font-semibold uppercase tracking-wide pb-1">Qty ordered</th>
            <th className="text-right font-semibold uppercase tracking-wide pb-1">Qty confirmed</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1 pl-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((l) => (
            <tr key={l.line} className="border-t border-[#e9e3df]">
              <td className="py-1 text-[#403833]">{l.sku || '—'}</td>
              <td className="py-1 text-right text-[#58524e]">{l.qty}</td>
              <td className="py-1 text-right text-[#58524e]">{l.cqty}</td>
              <td className="py-1 pl-3 text-[#58524e]">{l.confirmedStatus || l.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rollup.lines.length > 5 && (
        <button onClick={() => setShowAll((v) => !v)} className="text-[10px] text-brand font-semibold mt-1.5">
          {showAll ? 'Show fewer lines' : `Show all ${rollup.lines.length} lines`}
        </button>
      )}
    </div>
  );
}

interface POListProps {
  rollups: PORollup[];
  today: Date;
  weekLabel: string | null;
}

export function POList({ rollups, today, weekLabel }: POListProps) {
  const [activeFilters, setActiveFilters] = useState<Set<POFilter>>(new Set());
  const [search, setSearch] = useState('');
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const toggleFilter = (f: POFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const visible = useMemo(() => {
    let result = rollups;
    if (activeFilters.size > 0) {
      result = result.filter((r) => [...activeFilters].some((f) => matchesFilter(r, f, today)));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.po.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => sortRank(a) - sortRank(b));
  }, [rollups, activeFilters, search, today]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="px-4 pt-3 flex items-baseline gap-2">
        <p className="text-sm font-bold text-[#403833]">POs in Selected Week{weekLabel ? ` (${weekLabel})` : ''}</p>
        <span className="text-xs text-[#9c9794]">{rollups.length} PO{rollups.length === 1 ? '' : 's'}</span>
      </div>
      <div className="p-4 border-b border-[#e9e3df] flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => toggleFilter(opt.key)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium whitespace-nowrap transition-colors ${
              activeFilters.has(opt.key) ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PO number…"
          className="ml-auto text-xs border border-[#e9e3df] rounded-lg px-3 py-1.5 w-48"
        />
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO Number</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PGRD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">EGRD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ESD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ASD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Destination</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">SOT Status</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">SOT Days</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">OTIF Status</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Delay Days</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr><td colSpan={10} className="text-center py-6 text-[#9c9794]">No POs match the current filters</td></tr>
          )}
          {visible.map((r) => {
            const hasLineData = r.lines.some((l) => l.sku);
            const isExpanded = expandedPO === r.po;
            const sotDays = daysBetween(r.asd ?? r.esd, r.pgrd);
            const delayDays = daysBetween(r.egrd, r.pgrd);
            return (
              <Fragment key={r.po}>
                <tr
                  onClick={() => hasLineData && setExpandedPO(isExpanded ? null : r.po)}
                  className={`border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors bg-white ${hasLineData ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">
                    {hasLineData && <span className="text-[#9c9794] mr-1">{isExpanded ? '▾' : '▸'}</span>}
                    {r.po}
                  </td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.egrd)}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.esd ? formatDateShort(r.esd) : '—'}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.asd ? formatDateShort(r.asd) : '—'}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">
                    {r.destination}
                    {isAwaitingConfirmation(r, today) && (
                      <span className="ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] whitespace-nowrap">
                        ASD pending confirmation
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center"><StatusPill ok={r.sot} yesLabel="SOT" noLabel="Not SOT" /></td>
                  <td className="px-3 py-2 text-center text-[#58524e] font-semibold whitespace-nowrap">{dayOffsetLabel(sotDays)}</td>
                  <td className="px-3 py-2 text-center"><StatusPill ok={r.otif} yesLabel="OTIF" noLabel="Not OTIF" /></td>
                  <td className="px-3 py-2 text-center text-[#58524e] font-semibold whitespace-nowrap">{dayOffsetLabel(delayDays)}</td>
                </tr>
                {isExpanded && hasLineData && (
                  <tr>
                    <td colSpan={10} className="p-0"><LineDetail rollup={r} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
