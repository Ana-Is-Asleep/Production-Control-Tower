'use client';

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

export function LeadTimeDrillPanel({ title, rows, onClose }: LeadTimeDrillPanelProps) {
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
            {rows.map((r) => (
              <tr key={r.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                <td className="px-4 py-2.5 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
                <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{r.supplier}</td>
                <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{r.categories.join(', ')}</td>
                <td className="px-4 py-2.5 text-[#58524e]">{r.channel}</td>
                <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(r.orderDate)}</td>
                <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateMedium(r.endDate)}</td>
                <td className="px-4 py-2.5 text-[#403833] font-semibold">{r.leadDays}d</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{targetCell(r.leadDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
