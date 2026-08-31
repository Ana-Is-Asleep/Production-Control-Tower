'use client';

import { useMemo, useState } from 'react';
import { formatDateShort } from '../../lib/dateUtils';
import type { BacklogPORow } from '../../lib/backlogAggregation';

interface BacklogTableProps {
  rows: BacklogPORow[];
  showSupplier?: boolean;
}

type SortKey = 'po' | 'supplier' | 'warehouse' | 'pgrd' | 'egrd' | 'esd' | 'status' | 'qty' | 'age' | 'rootCause';

interface ColumnDef {
  key: SortKey;
  header: string;
  align?: 'left' | 'center';
}

const COLUMNS: ColumnDef[] = [
  { key: 'po', header: 'PO' },
  { key: 'supplier', header: 'Supplier' },
  { key: 'warehouse', header: 'Warehouse' },
  { key: 'pgrd', header: 'PGRD' },
  { key: 'egrd', header: 'EGRD' },
  { key: 'esd', header: 'ESD' },
  { key: 'status', header: 'Status' },
  { key: 'qty', header: 'Confirmed Qty', align: 'center' },
  { key: 'age', header: 'Age (days)', align: 'center' },
  { key: 'rootCause', header: 'Root Cause' },
];

function compareValues(a: BacklogPORow, b: BacklogPORow, key: SortKey): number {
  switch (key) {
    case 'po': return a.po.localeCompare(b.po);
    case 'supplier': return a.supplier.localeCompare(b.supplier);
    case 'warehouse': return a.warehouse.localeCompare(b.warehouse);
    case 'pgrd': return a.pgrd.getTime() - b.pgrd.getTime();
    case 'egrd': return (a.egrd?.getTime() ?? 0) - (b.egrd?.getTime() ?? 0);
    case 'esd': return (a.esd?.getTime() ?? 0) - (b.esd?.getTime() ?? 0);
    case 'status': return Number(a.esdPassedNoAsd) - Number(b.esdPassedNoAsd);
    case 'qty': return a.qtyConfirmed - b.qtyConfirmed;
    case 'age': return a.ageDays - b.ageDays;
    case 'rootCause': return (a.rootCauseLabel ?? '').localeCompare(b.rootCauseLabel ?? '');
  }
}

export function BacklogTable({ rows, showSupplier = true }: BacklogTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('age');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const cmp = [...rows].sort((a, b) => compareValues(a, b, sortKey));
    return sortDir === 'asc' ? cmp : cmp.reverse();
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const columns = showSupplier ? COLUMNS : COLUMNS.filter((c) => c.key !== 'supplier');

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-[#544a44] transition-colors ${col.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {col.header}
                {sortKey === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
          )}
          {sorted.map((r) => (
            <tr key={r.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors">
              <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
              {showSupplier && <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.supplier}</td>}
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.warehouse}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.egrd)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {r.esd ? <span className="text-[#58524e]">{formatDateShort(r.esd)}</span> : <span className="text-fail font-semibold">Not booked</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {r.esdPassedNoAsd && <span className="text-fail font-semibold text-[10px] uppercase tracking-wide">ESD passed, no ASD</span>}
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
