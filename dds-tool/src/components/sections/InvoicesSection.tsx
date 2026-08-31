'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { computeKPIs, filterBySupplierNames, formatAmountsByCurrency } from '../../lib/invoiceUtils';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
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

  // Total Pending grouped by the ISO week its (effective) due date falls in — gives the compact
  // card a trend to show instead of just the four static counts, capped to the most recent weeks
  // so a long backlog of old due dates doesn't stretch the x-axis.
  const weeklyPending = useMemo(() => {
    const map = new Map<string, { weekLabel: string; year: number; week: number; count: number }>();
    kpis.totalPending.forEach((r) => {
      if (!r.effectiveDueDate) return;
      const week = getISOWeek(r.effectiveDueDate);
      const year = getISOWeekYear(r.effectiveDueDate);
      const key = `${year}-${week}`;
      if (!map.has(key)) map.set(key, { weekLabel: `W${String(week).padStart(2, '0')}`, year, week, count: 0 });
      map.get(key)!.count += 1;
    });
    return [...map.values()].sort((a, b) => (a.year - b.year) || (a.week - b.week)).slice(-10);
  }, [kpis.totalPending]);

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
        <div className="flex-1 min-h-0 mt-3 flex flex-col">
          <div className="grid grid-cols-4 gap-3 w-full shrink-0">
            {CARDS.map((c) => (
              <div key={c.id} className="flex flex-col">
                <p className="text-[10px] text-[#9c9794] truncate">{c.label}</p>
                <p className={`kpi-number font-extrabold text-2xl leading-none mt-1.5 ${c.color}`}>{c.count}</p>
                {showAmount && <p className="text-[10px] text-[#7b7571] truncate mt-0.5">{formatAmountsByCurrency(c.rows)}</p>}
              </div>
            ))}
          </div>
          {weeklyPending.length > 0 && (
            <div className="flex-1 min-h-0 mt-4">
              <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1">Total Pending — by due week</p>
              <div style={{ height: 'calc(100% - 18px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyPending} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
                    <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                    <Tooltip
                      contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
                      labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
                      itemStyle={{ color: '#f9f7f6' }}
                      formatter={(value) => [`${value} invoices`, 'Pending']}
                    />
                    <Bar dataKey="count" fill={COLOR.warn} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
