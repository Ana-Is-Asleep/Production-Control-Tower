'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatDateShort } from '../../lib/dateUtils';
import type { MissingEsdRow } from '../../lib/missingEsdAggregation';

interface MissingEsdTableProps {
  rows: MissingEsdRow[];
}

type QuickFilter = 'all' | 'overdue' | 'due_lt_1wk' | 'due_1_3wk' | 'due_3_6wk' | 'due_gt_6wk';

function bucketFor(row: MissingEsdRow): QuickFilter {
  const d = row.daysUntilEgrd;
  if (d === null) return 'due_gt_6wk';
  if (d <= 0) return 'overdue';
  if (d <= 7) return 'due_lt_1wk';
  if (d <= 21) return 'due_1_3wk';
  if (d <= 42) return 'due_3_6wk';
  return 'due_gt_6wk';
}

function statusLabel(row: MissingEsdRow): string {
  if (row.daysUntilEgrd === null) return 'No EGRD';
  if (row.daysUntilEgrd < 0) return 'Overdue';
  if (row.daysUntilEgrd === 0) return 'Due today';
  if (row.daysUntilEgrd <= 7) return 'Due in 1 week';
  if (row.daysUntilEgrd <= 21) return 'Due in 1-3 weeks';
  return 'Due later';
}

function statusColor(urgency: MissingEsdRow['urgency']) {
  if (urgency === 'overdue') return { text: '#dc2626', dot: '#dc2626' };
  if (urgency === 'due_soon') return { text: '#c2650a', dot: '#f59e0b' };
  return { text: '#7b7571', dot: '#c8c0bb' };
}

function daysLabel(row: MissingEsdRow): string {
  if (row.daysUntilEgrd === null) return '—';
  if (row.daysUntilEgrd === 0) return 'Due today';
  if (row.daysUntilEgrd < 0) return `${Math.abs(row.daysUntilEgrd)} days overdue`;
  return `${row.daysUntilEgrd} days until EGRD`;
}

const ROWS_PER_PAGE = 25;

const QUICK_FILTERS: { key: QuickFilter; label: (n: number) => string }[] = [
  { key: 'all', label: (n) => `All (${n})` },
  { key: 'overdue', label: (n) => `Overdue (${n})` },
  { key: 'due_lt_1wk', label: (n) => `Due in < 1 week (${n})` },
  { key: 'due_1_3wk', label: (n) => `Due in 1-3 weeks (${n})` },
];

export function MissingEsdTable({ rows }: MissingEsdTableProps) {
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [page, setPage] = useState(1);

  const bucketCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = { all: rows.length, overdue: 0, due_lt_1wk: 0, due_1_3wk: 0, due_3_6wk: 0, due_gt_6wk: 0 };
    rows.forEach((r) => { counts[bucketFor(r)] += 1; });
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (quickFilter !== 'all' && bucketFor(r) !== quickFilter) return false;
      if (!q) return true;
      return r.po.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q) || r.warehouse.toLowerCase().includes(q);
    });
  }, [rows, search, quickFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 p-3 border-b border-[#e9e3df] flex-wrap">
        <div className="flex items-center gap-2 border border-[#e9e3df] rounded-lg px-2.5 h-8 flex-1 min-w-[220px] max-w-xs">
          <Search size={14} className="text-[#9c9794]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search PO number, supplier, warehouse..."
            className="text-xs outline-none w-full text-[#403833] placeholder:text-[#9c9794]"
          />
        </div>
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setQuickFilter(f.key); setPage(1); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
              quickFilter === f.key ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
            }`}
          >
            {f.label(bucketCounts[f.key])}
          </button>
        ))}
        <span className="text-xs text-[#9c9794] ml-auto whitespace-nowrap">{filtered.length} POs</span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO Number</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Warehouse</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PGRD</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">EGRD</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty Confirmed</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Status</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Days Overdue / Until EGRD</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 && (
            <tr><td colSpan={8} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
          )}
          {pageRows.map((r) => {
            const color = statusColor(r.urgency);
            return (
              <tr key={r.po} className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6]">
                <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.supplier}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.warehouse}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: color.text }}>{formatDateShort(r.egrd)}</td>
                <td className="px-3 py-2 text-center text-[#403833] font-semibold">{r.qtyConfirmed.toLocaleString()}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: color.text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color.dot }} />
                    {statusLabel(r)}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: color.text }}>{daysLabel(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#e9e3df] text-xs text-[#7b7571]">
        <span>Showing {filtered.length === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1} to {Math.min(safePage * ROWS_PER_PAGE, filtered.length)} of {filtered.length} POs</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded border border-[#e9e3df] disabled:opacity-40">«</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded flex items-center justify-center font-semibold ${p === safePage ? 'bg-[#403833] text-white' : 'border border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'}`}
              >
                {p}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded border border-[#e9e3df] disabled:opacity-40">»</button>
          </div>
        )}
      </div>
    </div>
  );
}
