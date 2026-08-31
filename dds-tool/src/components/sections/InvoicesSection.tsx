'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { computeKPIs, filterBySupplierNames } from '../../lib/invoiceUtils';
import type { InvoiceRow } from '../../types/invoice';

interface InvoicesSectionProps {
  invoices: InvoiceRow[];
  supplierFilter: string[];
  drillDownHref: string;
}

export function InvoicesSection({ invoices, supplierFilter, drillDownHref }: InvoicesSectionProps) {
  const scoped = useMemo(() => filterBySupplierNames(invoices, supplierFilter), [invoices, supplierFilter]);
  const kpis = useMemo(() => computeKPIs(scoped), [scoped]);

  const CARDS = [
    { id: 1, label: 'Overdue – Pending Approval', count: kpis.overdueP2w.length, color: 'text-fail' },
    { id: 2, label: 'Total Pending', count: kpis.totalPending.length, color: 'text-warn' },
    { id: 3, label: 'Due by End of Week', count: kpis.dueByEndOfWeek.length, color: 'text-brand' },
    { id: 4, label: 'Approved, Awaiting Payment', count: kpis.approvedNotPaid.length, color: 'text-pass' },
  ];

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] p-4 cursor-pointer h-full flex flex-col overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Invoices</p>
        <p className="text-[10px] text-brand font-semibold">Drill down →</p>
      </div>
      {invoices.length === 0 ? (
        <div className="flex-1 flex items-center">
          <p className="text-xs text-[#b5aaa5]">Upload invoice file to see data</p>
        </div>
      ) : (
        <div className="flex-1 flex items-center">
          <div className="grid grid-cols-4 gap-3 w-full">
            {CARDS.map((c) => (
              <div key={c.id}>
                <p className="text-[10px] text-[#9c9794] truncate">{c.label}</p>
                <p className={`kpi-number font-extrabold text-2xl leading-none ${c.color}`}>{c.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}
