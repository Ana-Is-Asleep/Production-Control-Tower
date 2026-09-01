'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Download } from 'lucide-react';
import { formatDateShort } from '../../lib/dateUtils';
import { egrdBucketKeyForRow, type MissingEsdRow } from '../../lib/missingEsdAggregation';
import type { UrgencyFilter } from '../../lib/missingEsdParams';

interface MissingEsdTableProps {
  rows: MissingEsdRow[];
  tab: UrgencyFilter;
  curWeek: number;
  curYear: number;
  selectedBucketKeys: string[] | null;
  onSelectBucketKeys: (keys: string[] | null) => void;
}

interface QuickFilter {
  label: string;
  keys: string[];
}

const NEEDING_ACTION_FILTERS: QuickFilter[] = [
  { label: 'Overdue', keys: ['overdue'] },
  { label: 'EGRD this week', keys: ['w0'] },
  { label: 'EGRD next week', keys: ['w1'] },
  { label: 'EGRD in 2-3 weeks', keys: ['w2', 'w3'] },
];

const NOT_URGENT_FILTERS: QuickFilter[] = [
  { label: 'EGRD in 3-6 weeks', keys: ['w3', 'w4', 'w5'] },
  { label: 'EGRD > 6 weeks', keys: ['further'] },
];

function sameKeys(a: string[], b: string[]) {
  return a.length === b.length && a.every((k) => b.includes(k));
}

function statusLabel(row: MissingEsdRow): string {
  if (row.daysUntilEgrd === null) return 'No EGRD';
  if (row.daysUntilEgrd < 0) return 'Overdue';
  if (row.daysUntilEgrd === 0) return 'Due today';
  if (row.daysUntilEgrd <= 7) return 'Due in 1 week';
  if (row.daysUntilEgrd <= 21) return 'Due in 1-3 weeks';
  return 'Not urgent';
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

// Tabs live in the parent (they drive which row set — Needing Action vs Not Urgent — gets
// passed in here); this component only owns search, pagination, and the quick-filter chips,
// which share the same bucket keys as the EGRD-week chart above so a chip and a bar click mean
// exactly the same filter.
export function MissingEsdTable({ rows, tab, curWeek, curYear, selectedBucketKeys, onSelectBucketKeys }: MissingEsdTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const quickFilters = tab === 'urgent' ? NEEDING_ACTION_FILTERS : NOT_URGENT_FILTERS;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedBucketKeys && !selectedBucketKeys.includes(egrdBucketKeyForRow(r, curWeek, curYear))) return false;
      if (!q) return true;
      return r.po.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q) || r.warehouse.toLowerCase().includes(q);
    });
  }, [rows, search, selectedBucketKeys, curWeek, curYear]);

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
        <button
          onClick={() => onSelectBucketKeys(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
            selectedBucketKeys === null ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
          }`}
        >
          All ({rows.length})
        </button>
        {quickFilters.map((f) => {
          const count = rows.filter((r) => f.keys.includes(egrdBucketKeyForRow(r, curWeek, curYear))).length;
          const active = selectedBucketKeys !== null && sameKeys(selectedBucketKeys, f.keys);
          return (
            <button
              key={f.label}
              onClick={() => { setPage(1); onSelectBucketKeys(active ? null : f.keys); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                active ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
        <button title="More filters (coming soon)" disabled className="flex items-center gap-1.5 text-xs font-semibold text-[#7b7571] border border-[#e9e3df] rounded-lg px-2.5 h-8 opacity-60 cursor-not-allowed">
          <SlidersHorizontal size={13} /> More filters
        </button>
        <button title="Export (coming soon)" disabled className="flex items-center gap-1.5 text-xs font-semibold text-[#7b7571] border border-[#e9e3df] rounded-lg px-2.5 h-8 opacity-60 cursor-not-allowed ml-auto">
          <Download size={13} /> Export
        </button>
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
