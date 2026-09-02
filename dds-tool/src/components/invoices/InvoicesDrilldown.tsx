'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters, DEFAULT_FILTERS } from '../../hooks/useFilters';
import { parseInvoicesParams, buildInvoicesParams } from '../../lib/invoicesParams';
import {
  computeKPIs, filterByChannel, filterBySupplierNames, computeAgingBuckets, computeDueDateOutlook,
  computeSupplierExposure, formatAmountsByCurrency,
} from '../../lib/invoiceUtils';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { LargeModal } from '../shared/LargeModal';
import { InvoiceTable } from './InvoiceTable';
import { InvoiceInsights } from './InvoiceInsights';
import { InvoiceAgingChart } from './InvoiceAgingChart';
import { InvoiceDueDateOutlook } from './InvoiceDueDateOutlook';
import { InvoiceSupplierExposure } from './InvoiceSupplierExposure';
import { InvoiceOverdueBySupplier } from './InvoiceOverdueBySupplier';
import { InvoiceStatusBreakdown } from './InvoiceStatusBreakdown';
import { InvoiceDataQualityModal } from './InvoiceDataQualityModal';
import type { InvoiceChannel, InvoiceRow } from '../../types/invoice';

interface DrillSelection {
  title: string;
  rows: InvoiceRow[];
}

function KpiCard({ label, count, amount, sub, tint, onClick }: { label: string; count: number; amount: string; sub: string; tint: 'fail' | 'warn' | 'neutral' | 'pass'; onClick: () => void }) {
  const tintClass: Record<string, string> = {
    fail: 'bg-fail-bg text-fail', warn: 'bg-warn-bg text-warn', neutral: 'bg-[#f5f2ee] text-[#403833]', pass: 'bg-pass-bg text-pass',
  };
  return (
    <button onClick={onClick} disabled={count === 0} className="bg-white rounded-lg border border-[#e9e3df] p-4 text-left hover:border-[#403833] transition-colors disabled:hover:border-[#e9e3df] flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-1">{label}</p>
      <p className={`inline-block text-2xl font-extrabold leading-none px-1.5 py-0.5 rounded ${count > 0 ? tintClass[tint] : 'text-[#403833]'}`}>{count}</p>
      <span className="text-xs text-[#9c9794] ml-1">invoices</span>
      <p className="text-sm font-semibold text-[#403833] mt-1">{amount}</p>
      <p className="text-[10px] text-[#9c9794] mt-1.5">{sub}</p>
      {count > 0 && <p className="text-[10px] text-brand font-semibold mt-1.5">View all →</p>}
    </button>
  );
}

export function InvoicesDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines, invoices, invoiceMeta } = useData();

  const initial = useMemo(() => parseInvoicesParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const initialFilters = useMemo(() => ({
    ...DEFAULT_FILTERS,
    suppliers: initial.suppliers,
    channels: initial.channel === 'All' ? [] : [initial.channel as 'Online' | 'Offline'],
  }), [initial]);

  const { filters, setFilters, allSuppliers, curWeek, curYear } = useFilters(allLines, initialFilters);
  const [drill, setDrill] = useState<DrillSelection | null>(null);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [dataQualityOpen, setDataQualityOpen] = useState(false);

  const channel: InvoiceChannel = filters.channels.length === 1 ? filters.channels[0] : 'All';

  useEffect(() => {
    const params = buildInvoicesParams(filters.suppliers, channel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.suppliers, channel, pathname]);

  const isModeB = filters.suppliers.length === 1;
  const selectedSupplier = isModeB ? filters.suppliers[0] : null;

  const scoped = useMemo(() => filterByChannel(filterBySupplierNames(invoices, filters.suppliers), channel), [invoices, filters.suppliers, channel]);
  const kpis = useMemo(() => computeKPIs(scoped), [scoped]);
  const aging = useMemo(() => computeAgingBuckets(scoped), [scoped]);
  const outlook = useMemo(() => computeDueDateOutlook(kpis.totalPending), [kpis.totalPending]);
  const supplierExposure = useMemo(() => (isModeB ? [] : computeSupplierExposure(kpis)), [isModeB, kpis]);

  const exportScope = () => {
    const rows: (string | number)[][] = [['Invoice', 'Supplier', 'Channel', 'Invoice Status', 'Posting Status', 'Reason Code', 'Amount', 'Currency', 'Due Date', 'Effective Due Date']];
    scoped.forEach((r) => rows.push([
      r.invoice, r.name, r.channel ?? '—', r.invoiceStatus, r.postingStatus, r.reasonCode,
      r.importedInvoiceAmount, r.currency, r.dueDate?.toLocaleDateString() ?? '—', r.effectiveDueDate?.toLocaleDateString() ?? '—',
    ]));
    downloadWorkbook('Invoicing Detail', [{ name: 'Invoices', rows }]);
  };

  if (invoices.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No invoice data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your invoices export.</p>
          <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
            ← Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f2ee] flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Invoicing Detail' }]}
          filters={filters}
          onChange={setFilters}
          allSuppliers={allSuppliers}
          curWeek={curWeek}
          curYear={curYear}
          showWeekRange={false}
          showCategory={false}
          rightActions={
            <>
              <button onClick={exportScope} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-2.5 h-8 hover:bg-brand-soft transition-colors">
                <Download size={13} />
                Export
              </button>
              <button
                title="Data Quality / more options"
                onClick={() => setDataQualityOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e9e3df] text-[#7b7571] hover:border-[#403833] transition-colors"
              >
                <MoreVertical size={15} />
              </button>
            </>
          }
        />

        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9c9794]">
            <Info size={12} />
            Effective Due Date considers the SCF-adjusted payment terms where applicable — not the raw Due Date.
          </div>

          <div className="flex flex-wrap gap-3">
            <KpiCard
              label="Overdue – Pending Approval" count={kpis.overdueP2w.length} amount={formatAmountsByCurrency(kpis.overdueP2w)}
              sub="Past effective due date and still awaiting approval" tint="fail"
              onClick={() => setDrill({ title: 'Overdue – Pending Approval', rows: kpis.overdueP2w })}
            />
            <KpiCard
              label="Total Pending" count={kpis.totalPending.length} amount={formatAmountsByCurrency(kpis.totalPending)}
              sub="All invoices still requiring processing" tint="warn"
              onClick={() => setDrill({ title: 'Total Pending', rows: kpis.totalPending })}
            />
            <KpiCard
              label="Due by End of Week" count={kpis.dueByEndOfWeek.length} amount={formatAmountsByCurrency(kpis.dueByEndOfWeek)}
              sub="Pending approval and due by Sunday" tint="neutral"
              onClick={() => setDrill({ title: 'Due by End of Week', rows: kpis.dueByEndOfWeek })}
            />
            <KpiCard
              label="Missing GR" count={kpis.missingGR.length} amount={formatAmountsByCurrency(kpis.missingGR)}
              sub={kpis.missingGROverdue.length > 0 ? `${kpis.missingGROverdue.length} already past effective due date` : 'Blocked pending goods receipt'} tint="warn"
              onClick={() => setDrill({ title: 'Missing GR', rows: kpis.missingGR })}
            />
          </div>

          <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">Approved – Awaiting Payment</p>
            <div className="flex items-center gap-8 flex-wrap">
              <button onClick={() => setDrill({ title: 'Approved – Awaiting Payment (Overdue)', rows: kpis.approvedNotPaidOverdue })} disabled={kpis.approvedNotPaidOverdue.length === 0} className="text-left">
                <p className="text-[10px] text-[#9c9794] uppercase tracking-wide">Overdue</p>
                <p className="text-xl font-extrabold text-fail">{kpis.approvedNotPaidOverdue.length} <span className="text-xs font-semibold text-[#9c9794]">invoices</span></p>
                <p className="text-xs text-[#58524e]">{formatAmountsByCurrency(kpis.approvedNotPaidOverdue)}</p>
              </button>
              <button onClick={() => setDrill({ title: 'Approved – Awaiting Payment (Not Yet Due)', rows: kpis.approvedNotPaidNotYetDue })} disabled={kpis.approvedNotPaidNotYetDue.length === 0} className="text-left">
                <p className="text-[10px] text-[#9c9794] uppercase tracking-wide">Not Yet Due</p>
                <p className="text-xl font-extrabold text-pass">{kpis.approvedNotPaidNotYetDue.length} <span className="text-xs font-semibold text-[#9c9794]">invoices</span></p>
                <p className="text-xs text-[#58524e]">{formatAmountsByCurrency(kpis.approvedNotPaidNotYetDue)}</p>
              </button>
              <button onClick={() => setDrill({ title: 'Approved – Awaiting Payment (Total)', rows: kpis.approvedNotPaid })} disabled={kpis.approvedNotPaid.length === 0} className="text-left ml-auto">
                <p className="text-[10px] text-[#9c9794] uppercase tracking-wide">Total Awaiting Payment</p>
                <p className="text-lg font-bold text-[#403833]">{kpis.approvedNotPaid.length} invoices · {formatAmountsByCurrency(kpis.approvedNotPaid)}</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <InvoiceInsights kpis={kpis} supplierExposure={supplierExposure} contextLabel={selectedSupplier ?? ''} />
            {isModeB ? (
              <InvoiceStatusBreakdown kpis={kpis} contextLabel={selectedSupplier!} onSelectSegment={(title, rows) => setDrill({ title, rows })} />
            ) : (
              <InvoiceOverdueBySupplier suppliers={supplierExposure} onSelectSupplier={(s) => setFilters({ ...filters, suppliers: [s] })} />
            )}
          </div>

          <InvoiceAgingChart buckets={aging} onSelectBucket={(label) => {
            const bucket = aging.find((b) => b.label === label);
            if (bucket) setDrill({ title: `Pending Approval Aging — ${label}`, rows: bucket.rows });
          }} />

          <InvoiceDueDateOutlook buckets={outlook} onSelectBucket={(label) => {
            const bucket = outlook.find((b) => b.label === label);
            if (bucket) setDrill({ title: `Due Date Outlook — ${label}`, rows: bucket.rows });
          }} />

          {!isModeB && (
            <InvoiceSupplierExposure
              suppliers={supplierExposure}
              onSelectSupplier={(s) => setFilters({ ...filters, suppliers: [s] })}
              showAll={showAllSuppliers}
              onToggleShowAll={() => setShowAllSuppliers((v) => !v)}
            />
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-[#403833]">Invoice Details{selectedSupplier ? ` — ${selectedSupplier}` : ''}</p>
              <p className="text-[11px] text-[#9c9794]">{scoped.length} invoices in scope</p>
            </div>
            <InvoiceTable rows={scoped} limit={10} />
            {scoped.length > 10 && (
              <button onClick={() => setDrill({ title: `Invoice Details${selectedSupplier ? ` — ${selectedSupplier}` : ''}`, rows: scoped })} className="text-xs text-brand font-semibold hover:underline mt-2">
                View all invoices ({scoped.length}) →
              </button>
            )}
          </div>
        </div>
      </div>

      {drill && (
        <LargeModal
          title={drill.title}
          onClose={() => setDrill(null)}
          rightActions={
            <button
              onClick={() => {
                const rows: (string | number)[][] = [['Invoice', 'Supplier', 'Channel', 'Invoice Status', 'Amount', 'Currency', 'Effective Due Date']];
                drill.rows.forEach((r) => rows.push([r.invoice, r.name, r.channel ?? '—', r.invoiceStatus, r.importedInvoiceAmount, r.currency, r.effectiveDueDate?.toLocaleDateString() ?? '—']));
                downloadWorkbook(drill.title, [{ name: 'Invoices', rows }]);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors"
            >
              <Download size={13} /> Export
            </button>
          }
        >
          <p className="text-xs text-[#9c9794] mb-3">{drill.rows.length} invoices{selectedSupplier ? ` · ${selectedSupplier}` : ''}{channel !== 'All' ? ` · ${channel}` : ''}</p>
          <InvoiceTable rows={drill.rows} />
        </LargeModal>
      )}

      {dataQualityOpen && <InvoiceDataQualityModal meta={invoiceMeta} onClose={() => setDataQualityOpen(false)} />}
    </div>
  );
}
