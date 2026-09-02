'use client';

import type { SupplierExposureRow } from '../../lib/invoiceUtils';

interface InvoiceOverdueBySupplierProps {
  suppliers: SupplierExposureRow[];
  onSelectSupplier: (supplier: string) => void;
}

const TOP_N = 5;

// This bar DOES encode something explicit (share of total overdue amount by count-proxy — see
// computeSupplierExposure's sort-rank caveat), unlike the plain per-row bar the Backlog/Lead Time
// redesigns removed for carrying no information.
export function InvoiceOverdueBySupplier({ suppliers, onSelectSupplier }: InvoiceOverdueBySupplierProps) {
  const ranked = [...suppliers].filter((s) => s.overdueCount > 0).slice(0, TOP_N);
  const maxCount = Math.max(1, ...ranked.map((s) => s.overdueCount));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Overdue Amount by Supplier</p>
      <p className="text-[10px] text-[#9c9794] mb-3">Bar length reflects overdue invoice count (amounts span multiple currencies, so a single numeric scale isn&apos;t meaningful).</p>
      {ranked.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center flex-1">No overdue invoices in scope.</p>
      ) : (
        <div className="space-y-3 flex-1">
          {ranked.map((s) => (
            <button key={s.invoiceAccount} onClick={() => onSelectSupplier(s.supplier)} className="w-full text-left group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#403833] group-hover:text-brand transition-colors truncate">{s.supplier}</span>
                <span className="text-xs font-semibold text-[#58524e] shrink-0 ml-2">{s.overdueAmountByCurrency}</span>
              </div>
              <div className="h-2.5 bg-[#f5f2ee] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-fail" style={{ width: `${Math.max((s.overdueCount / maxCount) * 100, 4)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
