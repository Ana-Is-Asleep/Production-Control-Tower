'use client';

import { useState, useMemo } from 'react';
import { SlideOver } from '../shared/SlideOver';
import { Seg } from '../shared/Seg';
import { computeKPIs, filterByChannel, formatAmountsByCurrency, supplierBreakdown } from '../../lib/invoiceUtils';
import type { InvoiceChannel, InvoiceRow } from '../../types/invoice';
import { formatDateMedium } from '../../lib/dateUtils';

// Calculation logic here is untouched from the old src/app/invoices/page.tsx — only the shell
// changed (inline card + SlideOver deep-dive instead of a dedicated route).

function AmountPill({ rows, className = '' }: { rows: InvoiceRow[]; className?: string }) {
  const amt = formatAmountsByCurrency(rows);
  if (amt === '—') return null;
  return <span className={`text-xs text-[#7b7571] ${className}`}>{amt}</span>;
}

interface InvoicesSectionProps {
  invoices: InvoiceRow[];
  supplierFilter: string[];
}

export function InvoicesSection({ invoices, supplierFilter }: InvoicesSectionProps) {
  const [channel, setChannel] = useState<InvoiceChannel>('All');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const scoped = useMemo(() => {
    if (supplierFilter.length === 0) return invoices;
    return invoices.filter((r) => supplierFilter.some((s) => r.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.name.toLowerCase())));
  }, [invoices, supplierFilter]);

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

  return (
    <>
      <div onClick={() => setOpen(true)} className="kpi-card bg-white rounded-lg border border-[#e9e3df] p-4 cursor-pointer h-full flex flex-col overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
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
                  <p className={`kpi-number font-extrabold text-2xl leading-none ${c.color}`}>{c.rows.length}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Invoices" width="w-[1000px]">
        <div className="p-5 space-y-5">
          <Seg
            options={[{ value: 'All', label: 'All' }, { value: 'Online', label: 'Online' }, { value: 'Offline', label: 'Offline' }]}
            value={channel}
            onChange={(v) => setChannel(v as InvoiceChannel)}
          />

          <div className="grid grid-cols-4 gap-4">
            {CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${expandedCard === card.id ? card.border : 'border-[#e9e3df]'}`}
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794] mb-2">{card.label}</p>
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
      </SlideOver>
    </>
  );
}
