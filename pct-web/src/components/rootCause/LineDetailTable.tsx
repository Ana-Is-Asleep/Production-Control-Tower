'use client';

import { Fragment, useState } from 'react';
import { formatDateShort } from '../../lib/dateUtils';
import { REASON_CATEGORY_LABELS } from '../../lib/reasonClassification';
import type { LineDetailRow } from '../../lib/rootCauseAggregation';

interface LineDetailTableProps {
  rows: LineDetailRow[];
}

const TRUNCATE_AT = 60;

// Primary panel for the single-supplier deep-dive — real line-level grain (this app's actual data
// shape), one row per PO line. The raw supplier free-text reason is truncated by default and
// expands per row on click, since it's the field most likely to run long.
export function LineDetailTable({ rows }: LineDetailTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const sorted = [...rows].sort((a, b) => (b.week?.offset ?? 0) - (a.week?.offset ?? 0));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Line</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Week</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Category</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Ship Date</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">AI Root Cause</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier Reason</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={8} className="text-center py-6 text-[#9c9794]">No lines match the current selection</td></tr>
          )}
          {sorted.map((r) => {
            const key = `${r.po}-${r.line}`;
            const isLong = r.rawReason.length > TRUNCATE_AT;
            const isExpanded = expandedKey === key;
            return (
              <Fragment key={key}>
                <tr className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors">
                  <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
                  <td className="px-3 py-2 text-center text-[#58524e]">{r.line}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.week?.label ?? '—'}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.skuCategory}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.shipDate)}</td>
                  <td className="px-3 py-2 text-center text-[#58524e]">{r.qty}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.aiCategory ? REASON_CATEGORY_LABELS[r.aiCategory] : '—'}</td>
                  <td className="px-3 py-2 text-[#58524e]">
                    {isLong && !isExpanded ? (
                      <button onClick={() => setExpandedKey(key)} className="text-left hover:text-brand">
                        {r.rawReason.slice(0, TRUNCATE_AT)}… <span className="text-brand font-semibold">more</span>
                      </button>
                    ) : (
                      <span>
                        {r.rawReason}
                        {isLong && (
                          <button onClick={() => setExpandedKey(null)} className="text-brand font-semibold ml-1">less</button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
