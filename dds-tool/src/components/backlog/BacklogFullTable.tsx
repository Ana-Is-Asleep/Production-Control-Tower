'use client';

import { useMemo, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateShort } from '../../lib/dateUtils';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import type { BacklogPORow, ExpectedPORow } from '../../lib/backlogAggregation';

interface BacklogFullTableProps {
  rows: BacklogPORow[];
  expectedRows: ExpectedPORow[];
  today: Date;
}

type RowType = 'current' | 'expected';

interface UnifiedRow {
  type: RowType;
  po: string;
  supplier: string;
  warehouse: string;
  pgrd: Date;
  egrd: Date | null;
  esd: Date | null;
  qty: number;
  noEsd: boolean;
  overdueDays: number | null; // current backlog rows whose EGRD has already passed
  ageDays: number | null; // current backlog only
  dueInDays: number | null; // expected backlog only — days until PGRD
}

type QuickFilter = 'all' | 'current' | 'expected' | 'overdue' | 'noEsd';

const ROWS_PER_PAGE = 25;

// The evidence table behind the strategic (no supplier/channel filter) view — Current Backlog and
// Expected Future Backlog rows shown side by side (tagged by Type, never merged into one count),
// built directly from the same BacklogPORow/ExpectedPORow populations the cards above already use.
export function BacklogFullTable({ rows, expectedRows, today }: BacklogFullTableProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [page, setPage] = useState(1);

  const unified = useMemo((): UnifiedRow[] => {
    const current: UnifiedRow[] = rows.map((r) => ({
      type: 'current',
      po: r.po,
      supplier: r.supplier,
      warehouse: r.warehouse,
      pgrd: r.pgrd,
      egrd: r.egrd,
      esd: r.esd,
      qty: r.qtyConfirmed,
      noEsd: !r.hasEsd,
      overdueDays: r.egrd && r.egrd < today ? differenceInCalendarDays(today, r.egrd) : null,
      ageDays: r.ageDays,
      dueInDays: null,
    }));
    const expected: UnifiedRow[] = expectedRows.map((r) => ({
      type: 'expected',
      po: r.po,
      supplier: r.supplier,
      warehouse: r.warehouse,
      pgrd: r.pgrd,
      egrd: null,
      esd: r.esd,
      qty: 0,
      noEsd: false,
      overdueDays: null,
      ageDays: null,
      dueInDays: differenceInCalendarDays(r.pgrd, today),
    }));
    return [...current, ...expected];
  }, [rows, expectedRows, today]);

  const counts = useMemo(() => ({
    current: unified.filter((r) => r.type === 'current').length,
    expected: unified.filter((r) => r.type === 'expected').length,
    overdue: unified.filter((r) => r.overdueDays !== null).length,
    noEsd: unified.filter((r) => r.noEsd).length,
  }), [unified]);

  const filtered = useMemo(() => {
    let result = unified;
    if (filter === 'current') result = result.filter((r) => r.type === 'current');
    if (filter === 'expected') result = result.filter((r) => r.type === 'expected');
    if (filter === 'overdue') result = result.filter((r) => r.overdueDays !== null);
    if (filter === 'noEsd') result = result.filter((r) => r.noEsd);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.po.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q) || r.warehouse.toLowerCase().includes(q));
    }
    return result;
  }, [unified, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  const handleExport = () => {
    const header = ['Type', 'PO Number', 'Supplier', 'Warehouse', 'PGRD', 'EGRD', 'ESD', 'Qty Confirmed', 'Age (days)', 'Days Overdue', 'Days Until PGRD'];
    const dataRows = filtered.map((r) => [
      r.type === 'current' ? 'Current Backlog' : 'Expected Backlog',
      r.po,
      r.supplier,
      r.warehouse,
      formatDateShort(r.pgrd),
      r.egrd ? formatDateShort(r.egrd) : '—',
      r.esd ? formatDateShort(r.esd) : '—',
      r.qty,
      r.ageDays ?? '—',
      r.overdueDays ?? '—',
      r.dueInDays ?? '—',
    ]);
    downloadWorkbook('Backlog Detail', [{ name: 'Backlog', rows: [header, ...dataRows] }]);
  };

  const quickFilters: { key: QuickFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: unified.length },
    { key: 'current', label: 'Current Backlog', count: counts.current },
    { key: 'expected', label: 'Expected Backlog', count: counts.expected },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'noEsd', label: 'No ESD', count: counts.noEsd },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 p-3 border-b border-[#e9e3df] flex-wrap">
        <p className="text-sm font-bold text-[#403833] mr-1">Backlog Data</p>
        <div className="flex items-center gap-2 border border-[#e9e3df] rounded-lg px-2.5 h-8 flex-1 min-w-[220px] max-w-xs">
          <Search size={14} className="text-[#9c9794]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search PO number, supplier, warehouse…"
            className="text-xs outline-none w-full text-[#403833] placeholder:text-[#9c9794]"
          />
        </div>
        {quickFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => { setPage(1); setFilter(f.key); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#403833] rounded-lg px-2.5 h-8 hover:bg-[#58524e] ml-auto"
        >
          <Download size={13} /> Export
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#403833] text-white">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO Number</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Warehouse</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PGRD</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">EGRD</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">ESD</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty Confirmed</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Type</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Age / Overdue</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
            )}
            {pageRows.map((r) => (
              <tr key={`${r.type}-${r.po}`} className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6]">
                <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.supplier}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.warehouse}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.egrd ? formatDateShort(r.egrd) : '—'}</td>
                <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.esd ? formatDateShort(r.esd) : '—'}</td>
                <td className="px-3 py-2 text-right text-[#403833] font-semibold">{r.qty ? r.qty.toLocaleString() : '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.type === 'current' ? 'bg-fail-bg text-fail' : 'bg-[#fff7ed] text-brand'}`}>
                    {r.type === 'current' ? 'Current Backlog' : 'Expected Backlog'}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: r.overdueDays !== null ? '#dc2626' : '#58524e' }}>
                  {r.type === 'current'
                    ? `${r.ageDays}d in backlog${r.overdueDays !== null ? ` · ${r.overdueDays}d overdue` : ''}`
                    : `in ${r.dueInDays}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
