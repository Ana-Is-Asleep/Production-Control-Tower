'use client';

import type { SupplierExposureRow } from '../../lib/invoiceUtils';

interface InvoiceSupplierExposureProps {
  suppliers: SupplierExposureRow[];
  onSelectSupplier: (supplier: string) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
}

const TOP_N = 5;

// No decorative bar beside the supplier name — the reclaimed width goes to the name column, and
// the "Overdue Amount by Supplier" chart above already shows relative concentration visually.
export function InvoiceSupplierExposure({ suppliers, onSelectSupplier, showAll, onToggleShowAll }: InvoiceSupplierExposureProps) {
  const visible = showAll ? suppliers : suppliers.slice(0, TOP_N);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="px-4 pt-3 pb-2">
        <p className="text-sm font-bold text-[#403833]">Supplier Exposure — Pending Invoices</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] border-b border-[#e9e3df]">
              <th className="px-4 py-1.5 text-left">Supplier</th>
              <th className="px-3 py-1.5 text-left">Invoice Account</th>
              <th className="px-3 py-1.5 text-center">Pending Invoices</th>
              <th className="px-3 py-1.5 text-center">Pending Amount</th>
              <th className="px-3 py-1.5 text-center">Overdue Invoices</th>
              <th className="px-3 py-1.5 text-center">Overdue Amount</th>
              <th className="px-3 py-1.5 text-center">Missing GR</th>
              <th className="px-3 py-1.5 text-center">Oldest Overdue</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-[#9c9794]">No pending invoices in scope</td></tr>
            )}
            {visible.map((s) => (
              <tr key={s.invoiceAccount} onClick={() => onSelectSupplier(s.supplier)} className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6] cursor-pointer">
                <td className="px-4 py-2 font-semibold text-[#403833] whitespace-nowrap">{s.supplier}</td>
                <td className="px-3 py-2 text-[#9c9794] whitespace-nowrap">{s.invoiceAccount}</td>
                <td className="px-3 py-2 text-center text-[#403833]">{s.pendingCount}</td>
                <td className="px-3 py-2 text-center text-[#58524e] whitespace-nowrap">{s.pendingAmountByCurrency}</td>
                <td className="px-3 py-2 text-center font-semibold" style={{ color: s.overdueCount > 0 ? '#dc2626' : '#c8c0bb' }}>{s.overdueCount}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap" style={{ color: s.overdueCount > 0 ? '#dc2626' : '#c8c0bb' }}>{s.overdueAmountByCurrency}</td>
                <td className="px-3 py-2 text-center" style={{ color: s.missingGRCount > 0 ? '#c2650a' : '#c8c0bb' }}>{s.missingGRCount}</td>
                <td className="px-3 py-2 text-center text-[#58524e]">{s.oldestOverdueDays !== null ? `${s.oldestOverdueDays} days` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {suppliers.length > TOP_N && (
        <div className="px-4 py-2.5 border-t border-[#e9e3df]">
          <button onClick={onToggleShowAll} className="text-xs text-brand font-semibold hover:underline">
            {showAll ? 'Show top 5 only' : `View all suppliers (${suppliers.length}) →`}
          </button>
        </div>
      )}
    </div>
  );
}
