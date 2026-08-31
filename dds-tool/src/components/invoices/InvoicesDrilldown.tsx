'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { Seg } from '../shared/Seg';
import { formatDateMedium } from '../../lib/dateUtils';
import { parseInvoicesParams, buildInvoicesParams } from '../../lib/invoicesParams';
import { computeKPIs, filterByChannel, filterBySupplierNames, formatAmountsByCurrency, supplierBreakdown } from '../../lib/invoiceUtils';
import type { InvoiceChannel, InvoiceRow } from '../../types/invoice';

function AmountPill({ rows, className = '' }: { rows: InvoiceRow[]; className?: string }) {
  const amt = formatAmountsByCurrency(rows);
  if (amt === '—') return null;
  return <span className={`text-xs text-[#7b7571] ${className}`}>{amt}</span>;
}

export function InvoicesDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { invoices } = useData();

  const initial = useMemo(() => parseInvoicesParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [channel, setChannel] = useState<InvoiceChannel>(initial.channel);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // supplier list is inherited (read-only) from the dashboard's global filter at the time of
  // drill-in — this page has no control to change it, only the page-level Channel toggle
  const suppliers = initial.suppliers;

  useEffect(() => {
    const params = buildInvoicesParams(suppliers, channel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, pathname]);

  const scoped = useMemo(() => filterBySupplierNames(invoices, suppliers), [invoices, suppliers]);
  const filtered = useMemo(() => filterByChannel(scoped, channel), [scoped, channel]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const breakdown = useMemo(() => supplierBreakdown(kpis.overdueP2w), [kpis.overdueP2w]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const CARDS = [
    { id: 1, label: 'Overdue – Pending Approval', sub: 'Submitted, not approved · not MISSINGGR · past due', rows: kpis.overdueP2w, color: 'text-fail', border: 'border-fail' },
    { id: 2, label: 'Total Pending', sub: 'Submitted + Draft · all reason codes · any due date', rows: kpis.totalPending, color: 'text-warn', border: 'border-warn' },
    { id: 3, label: 'Due by End of Week', sub: 'Submitted · effective due date ≤ this Sunday', rows: kpis.dueByEndOfWeek, color: 'text-brand', border: 'border-brand' },
    {
      id: 4, label: 'Approved, Awaiting Payment', sub: 'Approved but not paid', rows: kpis.approvedNotPaid, color: 'text-pass', border: 'border-pass',
      split: { overdue: kpis.approvedNotPaidOverdue, notYetDue: kpis.approvedNotPaidNotYetDue },
    },
  ];

  const filterSummary = suppliers.length === 0 ? 'All Suppliers' : suppliers.length === 1 ? suppliers[0] : `${suppliers.length} Suppliers`;

  if (invoices.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[#403833]">No invoice data loaded</p>
        <p className="text-sm text-[#9c9794]">Go back to the overview and upload your invoices export.</p>
        <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
          ← Back to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex flex-col overflow-hidden">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-[#403833] hover:text-brand transition-colors shrink-0">
          <span>←</span> Overview
        </Link>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">Invoices Detail</span>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-xs text-[#7b7571] truncate">Filtered by: {filterSummary}</span>
        <div className="flex-1" />
        <Seg
          options={[{ value: 'All', label: 'All' }, { value: 'Online', label: 'Online' }, { value: 'Offline', label: 'Offline' }]}
          value={channel}
          onChange={(v) => setChannel(v as InvoiceChannel)}
        />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {CARDS.map((card) => (
            <div
              key={card.id}
              onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
              className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${expandedCard === card.id ? card.border : 'border-[#e9e3df]'}`}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794] mb-1">{card.label}</p>
              <p className="text-[10px] text-[#b5aaa5] mb-2">{card.sub}</p>
              {card.id === 4 && card.split ? (
                <div>
                  <p className={`text-[26px] font-bold leading-none tracking-tight ${card.color}`}>{card.rows.length}</p>
                  <div className="mt-1.5 flex gap-3 text-[12px] font-semibold">
                    <span className="text-fail">{card.split.overdue.length} overdue</span>
                    <span className="text-pass">{card.split.notYetDue.length} not yet due</span>
                  </div>
                  <AmountPill rows={card.rows} className="block mt-1" />
                </div>
              ) : (
                <>
                  <p className={`text-[26px] font-bold leading-none tracking-tight ${card.color}`}>{card.rows.length}</p>
                  <AmountPill rows={card.rows} className="block mt-1.5" />
                  <p className="text-[12px] font-semibold mt-1 text-[#9c9794]">{expandedCard === card.id ? 'click to hide' : 'click to expand'}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {expandedCard !== null && (() => {
          const card = CARDS.find((c) => c.id === expandedCard)!;
          return (
            <div className="bg-white rounded-lg overflow-hidden border border-[#e9e3df]">
              <div className="px-5 py-3 border-b border-[#f4f1ef] flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">{card.label} — {card.rows.length} invoices</p>
                <AmountPill rows={card.rows} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#403833] text-white">
                      {['Invoice', 'Supplier', 'Amount', 'Currency', 'Effective Due Date', 'Status', 'Reason'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {card.rows.slice(0, 200).map((r, i) => (
                      <tr key={`${r.invoice}-${i}`} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                        <td className="px-4 py-2.5 font-semibold text-[#403833]">{r.invoice}</td>
                        <td className="px-4 py-2.5 text-[#58524e]">{r.name}</td>
                        <td className="px-4 py-2.5 text-[#58524e] text-right">{r.importedInvoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-[#58524e]">{r.currency}</td>
                        <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">
                          {r.effectiveDueDate ? <span className={r.effectiveDueDate < today ? 'text-fail font-medium' : ''}>{formatDateMedium(r.effectiveDueDate)}</span> : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#58524e]">{r.invoiceStatus}</td>
                        <td className="px-4 py-2.5 text-xs text-[#7b7571]">{r.reasonCode || '—'}</td>
                      </tr>
                    ))}
                    {card.rows.length > 200 && (
                      <tr><td colSpan={7} className="px-4 py-3 text-xs text-[#9c9794] text-center">Showing first 200 of {card.rows.length} rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {breakdown.length > 0 && (
          <div className="bg-white rounded-lg overflow-hidden border border-[#e9e3df]">
            <div className="px-5 py-4 border-b border-[#f4f1ef]">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Overdue P2W — Breakdown by Supplier</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#403833] text-white">
                  {['Supplier', 'Invoice Account', 'Count', 'Amount'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.invoiceAccount} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                    <td className="px-4 py-2.5 font-medium text-[#403833]">{row.name}</td>
                    <td className="px-4 py-2.5 text-[#7b7571] font-mono text-xs">{row.invoiceAccount}</td>
                    <td className="px-4 py-2.5"><span className="kpi-number font-extrabold text-2xl text-fail">{row.count}</span></td>
                    <td className="px-4 py-2.5 text-[#58524e]">{row.amountByCurrency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
