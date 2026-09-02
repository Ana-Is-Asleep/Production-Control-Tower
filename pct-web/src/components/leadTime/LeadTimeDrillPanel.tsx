'use client';

import { Fragment, useState } from 'react';
import { formatDateMedium } from '../../lib/dateUtils';
import { LT_TARGET_DAYS, type DrillRow } from '../../lib/leadTimeAnalytics';

interface LeadTimeDrillPanelProps {
  title: string;
  rows: DrillRow[];
  onClose: () => void;
}

function targetCell(leadDays: number) {
  const delta = leadDays - LT_TARGET_DAYS;
  if (delta === 0) return <span className="text-pass font-semibold">On target</span>;
  if (delta > 0) return <span className="text-fail font-semibold">{delta}d late</span>;
  return <span className="text-pass font-semibold">{-delta}d early</span>;
}

function LineDetail({ row }: { row: DrillRow }) {
  const hasLineData = row.lines.some((l) => l.sku);
  if (!hasLineData) return null;

  return (
    <div className="bg-[#f9f7f6] px-4 py-2 border-t border-[#e9e3df]">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[#9c9794]">
            <th className="text-left font-semibold uppercase tracking-wide pb-1">SKU</th>
            <th className="text-right font-semibold uppercase tracking-wide pb-1">Qty</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1 pl-3">Order Date</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1">ASD</th>
            <th className="text-left font-semibold uppercase tracking-wide pb-1">Lead Time</th>
          </tr>
        </thead>
        <tbody>
          {row.lines.map((l) => {
            const lineLead = l.orderDate && l.asd ? Math.round((l.asd.getTime() - l.orderDate.getTime()) / 86400000) : null;
            return (
              <tr key={l.line} className="border-t border-[#e9e3df]">
                <td className="py-1 text-[#403833]">{l.sku || '—'}</td>
                <td className="py-1 text-right text-[#58524e]">{l.qty}</td>
                <td className="py-1 pl-3 text-[#58524e] whitespace-nowrap">{formatDateMedium(l.orderDate)}</td>
                <td className="py-1 text-[#58524e] whitespace-nowrap">{formatDateMedium(l.asd)}</td>
                <td className="py-1 text-[#58524e] whitespace-nowrap">{lineLead !== null ? `${lineLead}d` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LeadTimeDrillPanel({ title, rows, onClose }: LeadTimeDrillPanelProps) {
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-[#e9e3df]" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="px-5 py-3 border-b border-[#f4f1ef] flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">{title} — {rows.length} POs</p>
        <button onClick={onClose} className="text-xs text-brand font-semibold hover:underline">Close ✕</button>
      </div>
      <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#403833] text-white">
              {['PO', 'Supplier', 'Category', 'Channel', 'Order Date', 'ASD', 'PO Lead', 'vs Target'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-[#9c9794]">No POs in this period</td></tr>
            )}
            {rows.map((r) => {
              const hasLineData = r.lines.some((l) => l.sku);
              const isExpanded = expandedPO === r.po;
              return (
                <Fragment key={r.po}>
                  <tr
                    onClick={() => hasLineData && setExpandedPO(isExpanded ? null : r.po)}
                    className={`border-b border-[#e9e3df] hover:bg-[#f9f7f6] ${hasLineData ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-[#403833] whitespace-nowrap">
                      {hasLineData && <span className="text-[#9c9794] mr-1">{isExpanded ? '▾' : '▸'}</span>}
                      {r.po}
                    </td>
                    <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{r.supplier}</td>
                    <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{r.categories.join(', ')}</td>
                    <td className="px-4 py-2.5 text-[#58524e]">{r.channel}</td>
                    <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(r.orderDate)}</td>
                    <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(r.endDate)}</td>
                    <td className="px-4 py-2.5 text-[#403833] font-semibold">{r.leadDays}d</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{targetCell(r.leadDays)}</td>
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
    </div>
  );
}
