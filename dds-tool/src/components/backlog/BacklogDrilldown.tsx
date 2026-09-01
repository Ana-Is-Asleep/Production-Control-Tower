'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { currentISOWeek } from '../../lib/dateUtils';
import { parseBacklogParams, buildBacklogParams } from '../../lib/backlogParams';
import {
  computeBacklogRows, computeExpectedRows, computeAgeBands, computeClearanceForecast,
  computeExpectedByPgrdWeek, findOutliers, computeSupplierBacklogSummary, computeBacklogBySKU, anchorWeek,
} from '../../lib/backlogAggregation';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { SupplierInfoCard } from '../sotOtif/SupplierInfoCard';
import { BacklogTopCards } from './BacklogTopCards';
import { BacklogClearanceForecast } from './BacklogClearanceForecast';
import { BacklogKeyInsights } from './BacklogKeyInsights';
import { BacklogSupplierInsights } from './BacklogSupplierInsights';
import { BacklogAgeBreakdown } from './BacklogAgeBreakdown';
import { BacklogSupplierRanking } from './BacklogSupplierRanking';
import { BacklogBySku } from './BacklogBySku';
import { BacklogEsdPassedCallout } from './BacklogEsdPassedCallout';
import { BacklogPOTable } from './BacklogPOTable';
import { BacklogOutlierCallout } from './BacklogOutlierCallout';

export function BacklogDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initialFilters = useMemo(() => parseBacklogParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Backlog is a current-state view (Today vs PGRD/ESD), not a snapshot: filteredLines
  // (supplier/channel/category only) is used instead of weekRangeLines, so there's no PGRD
  // week-range restriction here — same precedent as the dashboard card and Missing ESD.
  const { filters, setFilters, filteredLines, allSuppliers, curWeek: sotCurWeek, curYear: sotCurYear } =
    useFilters(allLines, initialFilters);

  useEffect(() => {
    const params = buildBacklogParams(filters);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pathname]);

  const today = useMemo(() => new Date(), []);
  // the literal current ISO week (not "last completed") — the clearance forecast and Expected
  // Future Backlog breakdown are both forward-looking from today, not a lagged scoring anchor
  const { week: curWeek, year: curYear } = useMemo(() => currentISOWeek(), []);
  const { week: lastCompletedWk, year: lastCompletedYr } = useMemo(() => anchorWeek(), []);

  const rows = useMemo(() => computeBacklogRows(filteredLines, today), [filteredLines, today]);
  const recentRows = useMemo(() => rows.filter((r) => r.ageBucket === 'recent'), [rows]);
  const accumulatedRows = useMemo(() => rows.filter((r) => r.ageBucket === 'accumulated'), [rows]);
  const noEsdRows = useMemo(() => rows.filter((r) => !r.hasEsd), [rows]);
  const expectedRows = useMemo(() => computeExpectedRows(filteredLines, today), [filteredLines, today]);
  const avgAgeDays = useMemo(() => (rows.length ? Math.round(rows.reduce((s, r) => s + r.ageDays, 0) / rows.length) : 0), [rows]);

  const ageBands = useMemo(() => computeAgeBands(rows), [rows]);
  const forecast = useMemo(() => computeClearanceForecast(rows, curWeek, curYear), [rows, curWeek, curYear]);
  const expectedByWeek = useMemo(() => computeExpectedByPgrdWeek(expectedRows, curWeek, curYear), [expectedRows, curWeek, curYear]);
  const outliers = useMemo(() => findOutliers(rows, lastCompletedWk, lastCompletedYr), [rows, lastCompletedWk, lastCompletedYr]);
  const supplierSummary = useMemo(() => computeSupplierBacklogSummary(rows), [rows]);

  const isModeB = filters.suppliers.length === 1;
  const selectedSupplier = isModeB ? filters.suppliers[0] : null;
  const skuRows = useMemo(() => (isModeB ? computeBacklogBySKU(rows) : []), [isModeB, rows]);

  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [showEsdPassedOnly, setShowEsdPassedOnly] = useState(false);
  // clear the SKU/ESD-passed table filters when the supplier changes (or Mode B is left) so a
  // stale filter from a previous supplier can't silently carry over
  useEffect(() => {
    setSelectedSku(null);
    setShowEsdPassedOnly(false);
  }, [selectedSupplier]);

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your data export.</p>
          <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
            ← Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  // Mode B (single-supplier deep dive) scrolls naturally as one normal page — Mode A (the
  // multi-supplier strategic view) stays viewport-locked/compact. Sidebar is sticky so it stays
  // pinned in both cases.
  return (
    <div className={isModeB ? 'min-h-screen w-full bg-[#f5f2ee] flex' : 'h-screen w-full bg-[#f5f2ee] flex overflow-hidden'}>
      <Sidebar />
      <div className={isModeB ? 'flex-1 min-w-0 flex flex-col' : 'flex-1 min-w-0 flex flex-col overflow-hidden'}>
        <PageHeader
          breadcrumb={
            isModeB
              ? [{ label: 'Dashboard', href: '/' }, { label: 'Backlog Detail', href: '/backlog' }, { label: 'Supplier Detail' }]
              : [{ label: 'Dashboard', href: '/' }, { label: 'Backlog Detail' }]
          }
          filters={filters}
          onChange={setFilters}
          allSuppliers={allSuppliers}
          curWeek={sotCurWeek}
          curYear={sotCurYear}
          showWeekRange={false}
          rightActions={
            <>
              <button
                title="Export (coming soon)"
                disabled
                className="flex items-center gap-1.5 text-xs font-semibold text-[#7b7571] border border-[#e9e3df] rounded-lg px-2.5 h-8 opacity-60 cursor-not-allowed"
              >
                <Download size={13} />
                Export
              </button>
              <button
                title="More options (coming soon)"
                disabled
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e9e3df] text-[#7b7571] opacity-60 cursor-not-allowed"
              >
                <MoreVertical size={15} />
              </button>
            </>
          }
        />

        {isModeB && (
          <div className="px-5 py-1.5 bg-white border-b border-[#e9e3df] shrink-0 flex items-center justify-between">
            <span className="text-xs font-semibold text-pass flex items-center gap-1">✓ Supplier selected</span>
            <button onClick={() => setFilters({ ...filters, suppliers: [] })} className="text-xs font-medium text-brand hover:underline">
              Clear supplier
            </button>
          </div>
        )}

        {!isModeB ? (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-3">
            <div className="shrink-0">
              <BacklogTopCards
                rows={rows}
                recentCount={recentRows.length}
                accumulatedCount={accumulatedRows.length}
                noEsdCount={noEsdRows.length}
                expectedCount={expectedRows.length}
                expectedByWeek={expectedByWeek}
                avgAgeDays={avgAgeDays}
                expectedClearanceCount={rows.length - noEsdRows.length}
              />
            </div>

            <div style={{ flex: '3 1 220px' }} className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch min-h-0 overflow-hidden">
              <div className="lg:col-span-2 min-h-0">
                <BacklogClearanceForecast points={forecast} />
              </div>
              <BacklogKeyInsights
                rows={rows}
                noEsdCount={noEsdRows.length}
                supplierSummary={supplierSummary}
                expectedCount={expectedRows.length}
                expectedByWeek={expectedByWeek}
              />
            </div>

            {outliers.length > 0 && <div className="shrink-0"><BacklogOutlierCallout outliers={outliers} /></div>}

            <div style={{ flex: '2 1 160px' }} className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch min-h-0 overflow-hidden">
              <BacklogSupplierRanking summary={supplierSummary} />
              <BacklogAgeBreakdown bands={ageBands} />
            </div>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-3">
            <div className="flex gap-3">
              <SupplierInfoCard
                supplier={selectedSupplier ?? ''}
                categories={filters.categories}
                channels={filters.channels}
              />
              <div className="flex-1 min-w-0">
                <BacklogTopCards
                  rows={rows}
                  recentCount={recentRows.length}
                  accumulatedCount={accumulatedRows.length}
                  noEsdCount={noEsdRows.length}
                  expectedCount={expectedRows.length}
                  expectedByWeek={expectedByWeek}
                  avgAgeDays={avgAgeDays}
                  expectedClearanceCount={rows.length - noEsdRows.length}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch" style={{ minHeight: 320 }}>
              <div className="lg:col-span-2">
                <BacklogClearanceForecast points={forecast} />
              </div>
              <BacklogSupplierInsights
                rows={rows}
                noEsdCount={noEsdRows.length}
                avgAgeDays={avgAgeDays}
                expectedCount={expectedRows.length}
                skus={skuRows}
                expectedByWeek={expectedByWeek}
              />
            </div>

            {outliers.length > 0 && <BacklogOutlierCallout outliers={outliers} />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              <BacklogAgeBreakdown bands={ageBands} />
              <BacklogEsdPassedCallout
                count={rows.filter((r) => r.esdPassedNoAsd).length}
                onViewList={() => setShowEsdPassedOnly(true)}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3 items-start">
              <BacklogPOTable
                rows={rows}
                today={today}
                activeSku={selectedSku}
                onClearSku={() => setSelectedSku(null)}
                showEsdPassedOnly={showEsdPassedOnly}
                onClearEsdPassedOnly={() => setShowEsdPassedOnly(false)}
              />
              <BacklogBySku skus={skuRows} selectedSku={selectedSku} onSelectSku={setSelectedSku} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
