'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { currentISOWeek } from '../../lib/dateUtils';
import { parseBacklogParams, buildBacklogParams } from '../../lib/backlogParams';
import {
  computeBacklogRows, computeExpectedRows, computeAgeBands, computeClearanceForecast,
  computeExpectedByPgrdWeek, findOutliers, computeSupplierBacklogSummary, anchorWeek,
} from '../../lib/backlogAggregation';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { BacklogTopCards } from './BacklogTopCards';
import { BacklogClearanceForecast } from './BacklogClearanceForecast';
import { BacklogKeyInsights } from './BacklogKeyInsights';
import { BacklogAgeBreakdown } from './BacklogAgeBreakdown';
import { BacklogSupplierRanking } from './BacklogSupplierRanking';
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

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <PageHeader
          breadcrumb={[{ label: 'Overview', href: '/' }, { label: 'Backlog Detail' }]}
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

          <div style={{ flex: '3 1 220px' }} className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch min-h-0">
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

          <div style={{ flex: '2 1 160px' }} className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch min-h-0">
            <BacklogSupplierRanking summary={supplierSummary} />
            <BacklogAgeBreakdown bands={ageBands} />
          </div>
        </div>
      </div>
    </div>
  );
}
