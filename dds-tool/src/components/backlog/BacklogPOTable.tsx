'use client';

import { Fragment, useMemo, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateShort } from '../../lib/dateUtils';
import type { BacklogPORow } from '../../lib/backlogAggregation';

interface BacklogPOTableProps {
  rows: BacklogPORow[];
  today: Date;
  activeSku: string | null;
  onClearSku: () => void;
  showEsdPassedOnly: boolean;
  onClearEsdPassedOnly: () => void;
}

const TOP_N = 20;

type EsdStatus = { label: string; tone: 'fail' | 'warn' | 'neutral' };

// Every backlog row here has no ASD by definition (that's what makes it backlog), so "Shipped"
// never actually appears — only whether an ESD exists and, if so, whether it's already slipped.
function esdStatus(r: BacklogPORow, today: Date): EsdStatus {
  if (!r.esd) return { label: 'No ESD', tone: 'neutral' };
  if (r.esd < today) return { label: 'ESD passed — ASD missing', tone: 'fail' };
  return { label: 'ESD in future', tone: 'warn' };
}

function delayVsEgrd(r: BacklogPORow, today: Date): number | null {
  if (!r.egrd || r.egrd >= today) return null;
  return differenceInCalendarDays(today, r.egrd);
}

function LineDetail({ row }: { row: BacklogPORow }) {
  const hasLineData = row.lines.some((l) => l.sku);
  if (!hasLineData) return null;

  return (
    <div className="bg-[#f9f7f6] px-4 py-2 border-t border-[#e9e3df]">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[#9c9794]">
            <th className="text-left font-semibold uppercase tracking-wide pb-1">SKU</th>
            <th className="text-right font-semibold uppercase tracking-wide pb-1">Qty ordered</th>
            <th className="text-right font-semibold uppercase tracking-wide pb-1">Qty confirmed</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1 pl-3">PGRD</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1">EGRD</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1">ESD</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {row.lines.map((l) => (
            <tr key={l.line} className="border-t border-[#e9e3df]">
              <td className="py-1 text-[#403833]">{l.sku || '—'}</td>
              <td className="py-1 text-right text-[#58524e]">{l.qty}</td>
              <td className="py-1 text-right text-[#58524e]">{l.cqty}</td>
              <td className="py-1 pl-3 text-[#58524e] whitespace-nowrap">{formatDateShort(l.pgrd)}</td>
              <td className="py-1 text-[#58524e] whitespace-nowrap">{formatDateShort(l.egrd)}</td>
              <td className="py-1 text-[#58524e] whitespace-nowrap">{l.esd ? formatDateShort(l.esd) : '—'}</td>
              <td className="py-1 text-[#58524e]">{l.confirmedStatus || l.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE_COLOR: Record<EsdStatus['tone'], string> = { fail: '#dc2626', warn: '#c2650a', neutral: '#7b7571' };

// The evidence layer under the supplier's strategic backlog view — kept explicit (four separate
// date columns, never collapsed into one) per spec, with expandable rows for SKU-level detail
// rather than a separate page.
export function BacklogPOTable({ rows, today, activeSku, onClearSku, showEsdPassedOnly, onClearEsdPassedOnly }: BacklogPOTableProps) {
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let result = rows;
    if (activeSku) result = result.filter((r) => r.lines.some((l) => l.sku === activeSku));
    if (showEsdPassedOnly) result = result.filter((r) => r.esdPassedNoAsd);
    return result;
  }, [rows, activeSku, showEsdPassedOnly]);

  const visible = showAll ? filtered : filtered.slice(0, TOP_N);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden flex flex-col h-full" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="px-4 pt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-bold text-[#403833]">Backlog PO Details</p>
          <span className="text-xs text-[#9c9794]">{filtered.length} PO{filtered.length === 1 ? '' : 's'} in backlog</span>
        </div>
        <div className="flex items-center gap-2">
          {activeSku && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fff7ed] text-brand border border-brand/30 flex items-center gap-1.5">
              SKU: {activeSku}
              <button onClick={onClearSku} className="hover:underline">✕</button>
            </span>
          )}
          {showEsdPassedOnly && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-fail-bg text-fail flex items-center gap-1.5">
              ESD passed — no ASD
              <button onClick={onClearEsdPassedOnly} className="hover:underline">✕</button>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#403833] text-white sticky top-0">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO Number</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PGRD</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">EGRD</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ESD</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ASD</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ESD Status</th>
              <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Days in Backlog</th>
              <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Delay (vs EGRD)</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
            )}
            {visible.map((r) => {
              const status = esdStatus(r, today);
              const delay = delayVsEgrd(r, today);
              const isExpanded = expandedPO === r.po;
              const hasLineData = r.lines.some((l) => l.sku);
              return (
                <Fragment key={r.po}>
                  <tr
                    onClick={() => hasLineData && setExpandedPO(isExpanded ? null : r.po)}
                    className={`border-b border-[#f4f1ef] hover:bg-[#f9f7f6] transition-colors bg-white ${hasLineData ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">
                      {hasLineData && <span className="text-[#9c9794] mr-1">{isExpanded ? '▾' : '▸'}</span>}
                      {r.po}
                    </td>
                    <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
                    <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.egrd)}</td>
                    <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.esd ? formatDateShort(r.esd) : '—'}</td>
                    <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">—</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: TONE_COLOR[status.tone] }}>{status.label}</td>
                    <td className="px-3 py-2 text-center font-semibold text-[#403833]">{r.ageDays}d</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: delay !== null ? '#dc2626' : '#c8c0bb' }}>{delay !== null ? `${delay}d` : '—'}</td>
                  </tr>
                  {isExpanded && hasLineData && (
                    <tr><td colSpan={8} className="p-0"><LineDetail row={r} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > TOP_N && (
        <div className="px-4 py-2.5 border-t border-[#e9e3df] shrink-0">
          <button onClick={() => setShowAll((v) => !v)} className="text-xs text-brand font-semibold hover:underline">
            {showAll ? 'Show top 20 only' : `View all backlog POs (${filtered.length}) →`}
          </button>
        </div>
      )}
    </div>
  );
}
