'use client';

import { Fragment, useMemo, useState } from 'react';
import { BacklogTable } from './BacklogTable';
import type { BacklogPORow } from '../../lib/backlogAggregation';

interface BacklogGroupedTableProps {
  rows: BacklogPORow[];
}

interface SupplierGroup {
  supplier: string;
  rows: BacklogPORow[];
  totalQty: number;
  avgAge: number;
  noEsdCount: number;
}

export function BacklogGroupedTable({ rows }: BacklogGroupedTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo((): SupplierGroup[] => {
    const bySupplier = new Map<string, BacklogPORow[]>();
    for (const r of rows) {
      if (!bySupplier.has(r.supplier)) bySupplier.set(r.supplier, []);
      bySupplier.get(r.supplier)!.push(r);
    }
    return [...bySupplier.entries()]
      .map(([supplier, poRows]) => ({
        supplier,
        rows: poRows,
        totalQty: poRows.reduce((s, r) => s + r.qtyConfirmed, 0),
        avgAge: Math.round(poRows.reduce((s, r) => s + r.ageDays, 0) / poRows.length),
        noEsdCount: poRows.filter((r) => !r.hasEsd).length,
      }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [rows]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">POs</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Avg Age (days)</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">No-ESD</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr><td colSpan={5} className="text-center py-6 text-[#9c9794]">No backlog POs match the current selection</td></tr>
          )}
          {groups.map((g) => {
            const isExpanded = expanded === g.supplier;
            return (
              <Fragment key={g.supplier}>
                <tr
                  onClick={() => setExpanded(isExpanded ? null : g.supplier)}
                  className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">
                    <span className="text-[#9c9794] mr-1">{isExpanded ? '▾' : '▸'}</span>{g.supplier}
                  </td>
                  <td className="px-3 py-2 text-center text-[#403833] font-semibold">{g.rows.length}</td>
                  <td className="px-3 py-2 text-center text-[#403833] font-semibold">{g.totalQty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center text-[#58524e]">{g.avgAge}</td>
                  <td className="px-3 py-2 text-center text-[#58524e]">{g.noEsdCount}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <div className="bg-[#f9f7f6] p-2 border-t border-[#e9e3df]">
                        <BacklogTable rows={g.rows} showSupplier={false} />
                      </div>
                    </td>
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
