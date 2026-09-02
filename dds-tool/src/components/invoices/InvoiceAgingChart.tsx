'use client';

import { formatAmountsByCurrency, type AgingBucket } from '../../lib/invoiceUtils';

interface InvoiceAgingChartProps {
  buckets: AgingBucket[];
  onSelectBucket: (label: string) => void;
}

// Increasing urgency, left to right — green (not yet due) through red (>30 days overdue). A
// stacked/segmented bar rather than a donut since the progression itself is the point.
const BUCKET_COLORS = ['#15803d', '#f59e0b', '#ea580c', '#dc2626', '#991b1b'];

export function InvoiceAgingChart({ buckets, onSelectBucket }: InvoiceAgingChartProps) {
  const total = buckets.reduce((s, b) => s + b.rows.length, 0);
  const maxCount = Math.max(1, ...buckets.map((b) => b.rows.length));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="text-sm font-bold text-[#403833]">Pending Approval Aging (by Effective Due Date)</p>
      </div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {buckets.map((b, i) => (
          <span key={b.label} className="flex items-center gap-1 text-[10px] text-[#7b7571]">
            <span className="w-2 h-2 rounded-full" style={{ background: BUCKET_COLORS[i] }} /> {b.label}
          </span>
        ))}
      </div>

      {total === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No invoices awaiting approval in scope.</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${buckets.length}, 1fr) 90px`, rowGap: 8 }}>
          <span />
          {buckets.map((b) => <span key={b.label} className="text-[10px] font-semibold text-[#9c9794] text-center">{b.rows.length}</span>)}
          <span />

          <span className="text-[11px] font-semibold text-[#7b7571] self-center">Invoices</span>
          {buckets.map((b, i) => (
            <button
              key={b.label}
              onClick={() => b.rows.length > 0 && onSelectBucket(b.label)}
              disabled={b.rows.length === 0}
              className="h-7 rounded flex items-center justify-center text-[11px] font-bold text-white disabled:cursor-default"
              style={{ background: b.rows.length > 0 ? BUCKET_COLORS[i] : '#f5f2ee', opacity: b.rows.length ? Math.max(0.35, b.rows.length / maxCount) : 1 }}
              title={`${b.label}: ${b.rows.length} invoices`}
            >
              {b.rows.length > 0 ? b.rows.length : ''}
            </button>
          ))}
          <span className="text-[11px] font-semibold text-[#403833] self-center text-right">{total} invoices</span>

          <span className="text-[11px] font-semibold text-[#7b7571] self-center">Amount</span>
          {buckets.map((b) => <span key={b.label} className="text-[11px] text-[#58524e] text-center self-center">{b.amountByCurrency}</span>)}
          <span className="text-[11px] font-semibold text-[#403833] self-center text-right">{formatAmountsByCurrency(buckets.flatMap((b) => b.rows))}</span>
        </div>
      )}
    </div>
  );
}
