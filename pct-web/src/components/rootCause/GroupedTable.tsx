'use client';

import { Fragment, useMemo, useState } from 'react';
import { formatDateShort } from '../../lib/dateUtils';
import { ROOT_CAUSE_REASON_LABELS, type RootCauseReason } from '../../types/actions';
import type { RootCauseSubmissionRow } from '../../lib/rootCauseSubmissions';

interface GroupedTableProps {
  rows: RootCauseSubmissionRow[]; // already filtered to whatever scope/click-filter is active
}

interface Group {
  key: string;
  supplier: string;
  category: RootCauseReason;
  rows: RootCauseSubmissionRow[];
  totalQty: number;
}

// Grouped by supplier x submitted root cause — the data grain is now one row per PO (the SCM
// answers at the PO level, not per line), so "Lines" from the old AI-classified table is now "POs".
export function GroupedTable({ rows }: GroupedTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const groups = useMemo((): Group[] => {
    const byKey = new Map<string, Group>();
    for (const r of rows) {
      if (!r.reason) continue;
      const key = `${r.supplier}__${r.reason}`;
      if (!byKey.has(key)) byKey.set(key, { key, supplier: r.supplier, category: r.reason, rows: [], totalQty: 0 });
      const g = byKey.get(key)!;
      g.rows.push(r);
      g.totalQty += r.qty;
    }
    return [...byKey.values()].sort((a, b) => b.rows.length - a.rows.length);
  }, [rows]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Root Cause</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">POs</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr><td colSpan={4} className="text-center py-6 text-[#9c9794]">No submitted root causes match the current selection</td></tr>
          )}
          {groups.map((g) => {
            const isExpanded = expandedKey === g.key;
            return (
              <Fragment key={g.key}>
                <tr
                  onClick={() => setExpandedKey(isExpanded ? null : g.key)}
                  className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">
                    <span className="text-[#9c9794] mr-1">{isExpanded ? '▾' : '▸'}</span>{g.supplier}
                  </td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{ROOT_CAUSE_REASON_LABELS[g.category]}</td>
                  <td className="px-3 py-2 text-center text-[#403833] font-semibold">{g.rows.length}</td>
                  <td className="px-3 py-2 text-center text-[#403833] font-semibold">{g.totalQty.toLocaleString()}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="bg-[#f9f7f6] px-4 py-2 border-t border-[#e9e3df]">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-[#9c9794]">
                              <th className="text-left font-semibold uppercase tracking-wide pb-1">PO</th>
                              <th className="text-left font-semibold uppercase tracking-wide pb-1">Week</th>
                              <th className="text-left font-semibold uppercase tracking-wide pb-1">Ship Date</th>
                              <th className="text-right font-semibold uppercase tracking-wide pb-1">Qty</th>
                              <th className="text-left font-semibold uppercase tracking-wide pb-1 pl-3">Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((r) => (
                              <tr key={r.po} className="border-t border-[#e9e3df]">
                                <td className="py-1 text-[#403833] whitespace-nowrap">{r.po}</td>
                                <td className="py-1 text-[#58524e] whitespace-nowrap">{r.week?.label ?? '—'}</td>
                                <td className="py-1 text-[#58524e] whitespace-nowrap">{formatDateShort(r.shipDate)}</td>
                                <td className="py-1 text-right text-[#58524e]">{r.qty}</td>
                                <td className="py-1 pl-3 text-[#58524e]">
                                  {r.missingComponent ? `Missing: ${r.missingComponent}` : r.coverPoNumber ? `Cover PO: ${r.coverPoNumber}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
