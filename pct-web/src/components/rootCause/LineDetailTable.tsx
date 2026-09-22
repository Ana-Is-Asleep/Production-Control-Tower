'use client';

import { formatDateShort } from '../../lib/dateUtils';
import { ROOT_CAUSE_REASON_LABELS } from '../../types/actions';
import type { RootCauseSubmissionRow } from '../../lib/rootCauseSubmissions';

interface LineDetailTableProps {
  rows: RootCauseSubmissionRow[];
}

// Primary panel for the single-supplier deep-dive — one row per flagged (missed-SOT) PO, showing
// the SCM-submitted root cause and status instead of the old AI-classified free-text reason.
export function LineDetailTable({ rows }: LineDetailTableProps) {
  const sorted = [...rows].sort((a, b) => (b.week?.offset ?? 0) - (a.week?.offset ?? 0));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">PO</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Week</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Ship Date</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Qty</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Root Cause</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Status</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Detail</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={7} className="text-center py-6 text-[#9c9794]">No flagged POs match the current selection</td></tr>
          )}
          {sorted.map((r) => (
            <tr key={r.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors">
              <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.week?.label ?? '—'}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(r.shipDate)}</td>
              <td className="px-3 py-2 text-center text-[#58524e]">{r.qty}</td>
              <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{r.reason ? ROOT_CAUSE_REASON_LABELS[r.reason] : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {r.reason ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-pass">Submitted</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fail">Pending</span>
                )}
              </td>
              <td className="px-3 py-2 text-[#58524e]">
                {r.missingComponent ? `Missing: ${r.missingComponent}` : r.coverPoNumber ? `Cover PO: ${r.coverPoNumber}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
