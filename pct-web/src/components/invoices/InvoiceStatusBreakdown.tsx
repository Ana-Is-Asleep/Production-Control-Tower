'use client';

import { formatAmountsByCurrency } from '../../lib/invoiceUtils';
import type { InvoiceKPIs, InvoiceRow } from '../../types/invoice';

interface InvoiceStatusBreakdownProps {
  kpis: InvoiceKPIs;
  contextLabel: string;
  onSelectSegment: (label: string, rows: InvoiceRow[]) => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  'Overdue – Pending Approval': '#dc2626',
  'Pending (Not Yet Due)': '#ea580c',
  'Missing GR': '#f59e0b',
  'Approved – Awaiting Payment': '#15803d',
  Draft: '#9c9794',
};

// Replaces supplier-vs-supplier comparison once exactly one supplier is selected — a portfolio
// breakdown of that supplier's own invoices instead.
export function InvoiceStatusBreakdown({ kpis, contextLabel, onSelectSegment }: InvoiceStatusBreakdownProps) {
  const pendingNotYetDue = kpis.totalPending.filter((r) => !kpis.overdueP2w.includes(r) && !kpis.missingGR.includes(r));
  const draft = kpis.totalPending.filter((r) => r.invoiceStatus === 'Draft');
  const pendingNotYetDueNonDraft = pendingNotYetDue.filter((r) => r.invoiceStatus !== 'Draft');

  const segments = [
    { label: 'Overdue – Pending Approval', rows: kpis.overdueP2w },
    { label: 'Pending (Not Yet Due)', rows: pendingNotYetDueNonDraft },
    { label: 'Missing GR', rows: kpis.missingGR },
    { label: 'Approved – Awaiting Payment', rows: kpis.approvedNotPaid },
    { label: 'Draft', rows: draft },
  ];

  const total = kpis.totalPending.length + kpis.approvedNotPaid.length;
  let cursor = 0;
  const gradientStops = segments
    .filter((s) => s.rows.length > 0)
    .map((s) => {
      const start = cursor;
      cursor += (s.rows.length / Math.max(1, total)) * 360;
      return `${SEGMENT_COLORS[s.label]} ${start}deg ${cursor}deg`;
    })
    .join(', ');

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Invoice Status Breakdown</p>
      <p className="text-[11px] text-[#9c9794] mb-3">All invoices for {contextLabel}</p>

      {total === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No invoices in scope for {contextLabel}.</p>
      ) : (
        <div className="flex-1 flex items-center gap-4">
          <div className="rounded-full shrink-0 flex items-center justify-center" style={{ width: 92, height: 92, background: gradientStops ? `conic-gradient(${gradientStops})` : '#f5f2ee' }}>
            <div className="rounded-full bg-white flex flex-col items-center justify-center" style={{ width: 60, height: 60 }}>
              <p className="text-lg font-extrabold leading-none text-[#403833]">{total}</p>
              <p className="text-[9px] text-[#9c9794]">invoices</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {segments.map((s) => (
              <button
                key={s.label}
                onClick={() => s.rows.length > 0 && onSelectSegment(s.label, s.rows)}
                disabled={s.rows.length === 0}
                className="flex items-center justify-between text-xs w-full text-left disabled:cursor-default hover:bg-[#f9f7f6] rounded px-1 -mx-1 py-0.5"
              >
                <span className="flex items-center gap-1.5 text-[#58524e]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[s.label] }} />
                  {s.label}
                </span>
                <span className="font-semibold text-right" style={{ color: s.rows.length > 0 ? SEGMENT_COLORS[s.label] : '#c8c0bb' }}>
                  {s.rows.length} ({total ? Math.round((s.rows.length / total) * 100) : 0}%)
                </span>
              </button>
            ))}
            {kpis.overdueP2w.length + pendingNotYetDueNonDraft.length + kpis.missingGR.length + kpis.approvedNotPaid.length + draft.length > 0 && (
              <p className="text-[10px] text-[#9c9794] pt-1">{formatAmountsByCurrency([...kpis.totalPending, ...kpis.approvedNotPaid])} total across all statuses.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
