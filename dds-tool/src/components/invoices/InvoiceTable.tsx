'use client';

import { useMemo, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateShort } from '../../lib/dateUtils';
import type { InvoiceRow } from '../../types/invoice';

interface InvoiceTableProps {
  rows: InvoiceRow[];
  limit?: number; // when set, shows only the first N rows (a preview, not the full drill-down)
}

function daysLabel(row: InvoiceRow, today: Date): { text: string; days: number | null } {
  if (!row.effectiveDueDate) return { text: '—', days: null };
  const days = differenceInCalendarDays(today, row.effectiveDueDate);
  if (days === 0) return { text: 'Due today', days };
  if (days > 0) return { text: `${days} days overdue`, days };
  return { text: `Due in ${-days} days`, days };
}

function operationalStatus(row: InvoiceRow, days: number | null): { label: string; className: string } {
  if (row.reasonCode === 'MISSINGGR' && (row.invoiceStatus === 'Submitted, but not Approved' || row.invoiceStatus === 'Draft')) {
    return { label: 'Missing GR', className: 'bg-warn-bg text-warn' };
  }
  if (row.invoiceStatus === 'Submitted, but not Approved') {
    if (days !== null && days > 0) return { label: 'Overdue', className: 'bg-fail-bg text-fail' };
    if (days !== null && days >= -7) return { label: 'Due Soon', className: 'bg-[#FFE3C2] text-[#c2650a]' };
    return { label: 'Pending Approval', className: 'bg-[#f5f2ee] text-[#7b7571]' };
  }
  if (row.invoiceStatus === 'Approved, but not paid') {
    return days !== null && days > 0 ? { label: 'Overdue', className: 'bg-fail-bg text-fail' } : { label: 'Approved', className: 'bg-pass-bg text-pass' };
  }
  if (row.invoiceStatus === 'Draft') return { label: 'Draft', className: 'bg-[#f5f2ee] text-[#7b7571]' };
  return { label: row.invoiceStatus || '—', className: 'bg-[#f5f2ee] text-[#7b7571]' };
}

type SortKey = 'days' | 'amount';

export function InvoiceTable({ rows, limit }: InvoiceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const today = useMemo(() => new Date(), []);

  const sorted = useMemo(() => {
    const withDays = rows.map((r) => ({ row: r, ...daysLabel(r, today) }));
    withDays.sort((a, b) => {
      if (sortKey === 'amount') return b.row.importedInvoiceAmount - a.row.importedInvoiceAmount;
      // most overdue first; rows with no effective due date sort last
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return b.days - a.days;
    });
    return withDays;
  }, [rows, sortKey, today]);

  const visible = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#403833] text-white">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Invoice</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Supplier</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Channel</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Invoice Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Posting Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Reason Code</th>
              <th onClick={() => setSortKey('amount')} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833] cursor-pointer">Amount</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Effective Due Date</th>
              <th onClick={() => setSortKey('days')} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833] cursor-pointer">Days to/from Due ↕</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap sticky top-0 bg-[#403833]">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={10} className="text-center py-6 text-[#9c9794]">No invoices match the current filters</td></tr>
            )}
            {visible.map(({ row, text, days }) => {
              const status = operationalStatus(row, days);
              return (
                <tr key={`${row.invoice}-${row.invoiceAccount}`} className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6]">
                  <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{row.invoice}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{row.name}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{row.channel ?? '—'}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{row.invoiceStatus || '—'}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{row.postingStatus || '—'}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{row.reasonCode || '—'}</td>
                  <td className="px-3 py-2 text-right text-[#403833] font-semibold whitespace-nowrap">{row.currency} {row.importedInvoiceAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(row.effectiveDueDate)}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: days !== null && days > 0 ? '#dc2626' : '#15803d' }}>{text}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {limit && rows.length > limit && (
        <div className="px-3 py-2 border-t border-[#e9e3df] text-[11px] text-[#9c9794]">Showing {limit} of {rows.length} invoices</div>
      )}
    </div>
  );
}
