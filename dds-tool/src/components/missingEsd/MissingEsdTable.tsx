'use client';

import { formatDateShort } from '../../lib/dateUtils';
import type { MissingEsdRow } from '../../lib/missingEsdAggregation';

interface MissingEsdTableProps {
  rows: MissingEsdRow[];
}

function rowStyle(urgency: MissingEsdRow['urgency']) {
  if (urgency === 'overdue') return { background: '#FEE2E2' };
  if (urgency === 'due_soon') return { background: '#FFF3E0' };
  return {};
}

function daysLabel(row: MissingEsdRow): string {
  if (row.daysUntilEgrd === null) return '—';
  if (row.daysUntilEgrd === 0) return 'Due today';
  if (row.daysUntilEgrd < 0) return `${Math.abs(row.daysUntilEgrd)} days overdue`;
  return `${row.daysUntilEgrd} days until EGRD`;
}

function daysColor(urgency: MissingEsdRow['urgency']) {
  if (urgency === 'overdue') return '#dc2626';
  if (urgency === 'due_soon') return '#c2650a';
  return '#7b7571';
}

export function MissingEsdTable({ rows }: MissingEsdTableProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Warehouse</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PGRD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">EGRD</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty Confirmed</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Days Overdue / Until EGRD</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.po} style={rowStyle(r.urgency)} className="border-b border-[#e9e3df]">
              <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.supplier}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.warehouse}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.egrd)}</td>
              <td className="px-3 py-2 text-center text-[#403833] font-semibold">{r.qtyConfirmed.toLocaleString()}</td>
              <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: daysColor(r.urgency) }}>{daysLabel(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
