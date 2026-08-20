'use client';

import { formatDateShort } from '../../lib/dateUtils';
import type { BacklogPORow } from '../../lib/backlogAggregation';

interface BacklogTableProps {
  rows: BacklogPORow[];
  showSupplier?: boolean;
}

export function BacklogTable({ rows, showSupplier = true }: BacklogTableProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO</th>
            {showSupplier && <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>}
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Warehouse</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PGRD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">EGRD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ESD</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Confirmed Qty</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Age (days)</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Root Cause</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={showSupplier ? 9 : 8} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors">
              <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
              {showSupplier && <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.supplier}</td>}
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.warehouse}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.egrd)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {r.esd ? (
                  <span className={r.esdPassedNoAsd ? 'text-fail font-semibold' : 'text-[#58524e]'}>
                    {formatDateShort(r.esd)}
                    {r.esdPassedNoAsd && <span className="ml-1 text-[10px] uppercase tracking-wide">ESD passed, no ASD</span>}
                  </span>
                ) : (
                  <span className="text-fail font-semibold">Not booked</span>
                )}
              </td>
              <td className="px-3 py-2 text-center text-[#403833] font-semibold">{r.qtyConfirmed.toLocaleString()}</td>
              <td className="px-3 py-2 text-center text-[#403833] font-semibold">{r.ageDays}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.rootCauseLabel ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
