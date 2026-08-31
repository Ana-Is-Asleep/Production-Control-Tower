'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { computeKPIs, filterBySupplierNames, formatAmountsByCurrency } from '../../lib/invoiceUtils';
import type { InvoiceRow } from '../../types/invoice';

interface InvoicesSectionProps {
  invoices: InvoiceRow[];
  supplierFilter: string[];
  drillDownHref: string;
}

export function InvoicesSection({ invoices, supplierFilter, drillDownHref }: InvoicesSectionProps) {
  const scoped = useMemo(() => filterBySupplierNames(invoices, supplierFilter), [invoices, supplierFilter]);
  const kpis = useMemo(() => computeKPIs(scoped), [scoped]);
  // only worth showing an amount on the compact card when scoped to one supplier — with
  // multiple/no suppliers selected the total spans too many different contexts to be useful at a glance
  const showAmount = supplierFilter.length === 1;

  const CARDS = [
    { id: 1, label: 'Overdue – Pending Approval', count: kpis.overdueP2w.length, rows: kpis.overdueP2w, color: kpis.overdueP2w.length > 0 ? 'text-fail' : 'text-[#403833]' },
    { id: 2, label: 'Total Pending', count: kpis.totalPending.length, rows: kpis.totalPending, color: kpis.totalPending.length > 0 ? 'text-warn' : 'text-[#403833]' },
    { id: 3, label: 'Due by End of Week', count: kpis.dueByEndOfWeek.length, rows: kpis.dueByEndOfWeek, color: 'text-[#403833]' },
    { id: 4, label: 'Approved, Awaiting Payment', count: kpis.approvedNotPaid.length, rows: kpis.approvedNotPaid, color: 'text-pass' },
  ];

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] p-4 cursor-pointer h-full flex flex-col overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#403833]">Invoices</p>
        <p className="text-[10px] text-brand font-semibold">Drill down →</p>
      </div>
      {invoices.length === 0 ? (
        <div className="flex-1 flex items-center">
          <p className="text-xs text-[#b5aaa5]">Upload invoice file to see data</p>
        </div>
      ) : (
        <div className="flex-1 mt-3">
          <div className="grid grid-cols-4 gap-3 w-full h-full">
            {CARDS.map((c) => (
              <div key={c.id} className="flex flex-col">
                <p className="text-[10px] text-[#9c9794] truncate">{c.label}</p>
                <p className={`kpi-number font-extrabold text-2xl leading-none mt-1.5 ${c.color}`}>{c.count}</p>
                {showAmount && <p className="text-[10px] text-[#7b7571] truncate mt-0.5">{formatAmountsByCurrency(c.rows)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}
