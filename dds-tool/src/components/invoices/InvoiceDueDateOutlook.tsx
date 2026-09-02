'use client';

import type { DueDateOutlookBucket } from '../../lib/invoiceUtils';

interface InvoiceDueDateOutlookProps {
  buckets: DueDateOutlookBucket[];
  onSelectBucket: (label: string) => void;
}

const TONE: Record<string, string> = {
  Overdue: 'text-fail',
  'This Week': 'text-warn',
  'Next Week': 'text-[#c2650a]',
  '2–4 Weeks': 'text-[#403833]',
  Later: 'text-[#7b7571]',
};

export function InvoiceDueDateOutlook({ buckets, onSelectBucket }: InvoiceDueDateOutlookProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Invoice Due Date Outlook <span className="text-[11px] font-medium text-[#9c9794]">(by Effective Due Date)</span></p>
      <div className="grid" style={{ gridTemplateColumns: `70px repeat(${buckets.length}, 1fr)`, rowGap: 8 }}>
        <span />
        {buckets.map((b) => (
          <button key={b.label} onClick={() => b.rows.length > 0 && onSelectBucket(b.label)} disabled={b.rows.length === 0} className="text-[11px] font-semibold hover:underline disabled:no-underline disabled:cursor-default" style={{ color: b.rows.length ? undefined : '#c8c0bb' }}>
            <span className={TONE[b.label]}>{b.label}</span>
          </button>
        ))}
        <span className="text-[11px] font-semibold text-[#7b7571] self-center">Invoices</span>
        {buckets.map((b) => (
          <span key={b.label} className={`text-lg font-extrabold text-center ${TONE[b.label]}`}>{b.rows.length}</span>
        ))}
        <span className="text-[11px] font-semibold text-[#7b7571] self-center">Amount</span>
        {buckets.map((b) => (
          <span key={b.label} className="text-[11px] text-[#58524e] text-center">{b.amountByCurrency}</span>
        ))}
      </div>
    </div>
  );
}
