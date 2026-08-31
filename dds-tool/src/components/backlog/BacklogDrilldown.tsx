'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { isSubstantiveReason } from '../../lib/reasonClassification';
import { formatFilterSummary } from '../../lib/filterSummary';
import { parseBacklogParams, buildBacklogParams } from '../../lib/backlogParams';
import {
  computeBacklogRows, computeExpectedRows, computeAgeBands, computeProjectionSeries, findOutliers,
  computeSupplierBacklogSummary, buildInsight, computeEtaEstimate, anchorWeek,
} from '../../lib/backlogAggregation';
import { BacklogKpiStrip } from './BacklogKpiStrip';
import { BacklogProjectionChart } from './BacklogProjectionChart';
import { BacklogAgeBreakdown } from './BacklogAgeBreakdown';
import { BacklogSupplierRanking } from './BacklogSupplierRanking';
import { BacklogOutlierCallout } from './BacklogOutlierCallout';
import { BacklogGroupedTable } from './BacklogGroupedTable';
import { BacklogTable } from './BacklogTable';

export function BacklogDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initialFilters = useMemo(() => parseBacklogParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  // read-only: this page inherits the dashboard's filters, it never changes them. Backlog
  // deliberately uses filteredLines (supplier/channel/category only), NOT weekRangeLines — the
  // same precedent the existing dashboard card already follows, since backlog needs full PGRD
  // history regardless of the narrow global week-range slider.
  const { filters, filteredLines } = useFilters(allLines, initialFilters);

  useEffect(() => {
    const params = buildBacklogParams(filters);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pathname]);

  const linesWithReasons = useMemo(() => filteredLines.filter((l) => isSubstantiveReason(l.lossReasonCode)), [filteredLines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));

  const { week: curWeek, year: curYear } = useMemo(() => anchorWeek(), []);

  const rows = useMemo(() => computeBacklogRows(filteredLines, classifications), [filteredLines, classifications]);
  const recentRows = useMemo(() => rows.filter((r) => r.ageBucket === 'recent'), [rows]);
  const accumulatedRows = useMemo(() => rows.filter((r) => r.ageBucket === 'accumulated'), [rows]);
  const noEsdRows = useMemo(() => rows.filter((r) => !r.hasEsd), [rows]);
  const expectedRows = useMemo(() => computeExpectedRows(filteredLines), [filteredLines]);
  const avgAgeDays = useMemo(() => (rows.length ? Math.round(rows.reduce((s, r) => s + r.ageDays, 0) / rows.length) : 0), [rows]);

  const ageBands = useMemo(() => computeAgeBands(rows), [rows]);
  const projection = useMemo(() => computeProjectionSeries(filteredLines, curWeek, curYear), [filteredLines, curWeek, curYear]);
  const outliers = useMemo(() => findOutliers(rows, curWeek, curYear), [rows, curWeek, curYear]);
  const supplierSummary = useMemo(() => computeSupplierBacklogSummary(rows), [rows]);
  const insight = useMemo(() => buildInsight(rows, curWeek, curYear), [rows, curWeek, curYear]);
  const eta = useMemo(() => computeEtaEstimate(filteredLines, noEsdRows.length, curWeek, curYear), [filteredLines, noEsdRows.length, curWeek, curYear]);

  const isSingleSupplier = filters.suppliers.length === 1;

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
        <p className="text-sm text-[#9c9794]">Go back to the overview and upload your data export.</p>
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
        <span className="text-[#403833] text-sm font-semibold shrink-0">Backlog Detail</span>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-xs text-[#7b7571] truncate">Filtered by: {formatFilterSummary(filters)}</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {!isSingleSupplier && (
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Insight</p>
            <p className="text-sm text-[#403833]">{insight.narrative}</p>
          </div>
        )}

        <BacklogKpiStrip
          total={rows.length}
          recent={recentRows.length}
          accumulated={accumulatedRows.length}
          avgAgeDays={avgAgeDays}
          noEsdCount={noEsdRows.length}
          expectedCount={expectedRows.length}
        />

        <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Forward Projection — last completed week + next 4 weeks</p>
          <BacklogProjectionChart weeks={projection} />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-2.5 flex-1" style={{ boxShadow: 'var(--shadow-card)' }}>
            <span className="font-semibold text-fail">{noEsdRows.length}</span> POs in backlog with no expectation to clear
            {eta.weeksToClear !== null && (
              <span className="text-[#9c9794]"> — at the current clearance rate (~{eta.avgClearancePerWeek.toFixed(1)}/wk), this would take approximately {eta.weeksToClear} week{eta.weeksToClear === 1 ? '' : 's'} to clear if nothing changes.</span>
            )}
          </div>
        </div>

        <BacklogOutlierCallout outliers={outliers} />

        {!isSingleSupplier ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <BacklogSupplierRanking summary={supplierSummary} />
              <BacklogAgeBreakdown bands={ageBands} />
            </div>
            <BacklogGroupedTable rows={rows} />
          </>
        ) : (
          <>
            <BacklogAgeBreakdown bands={ageBands} />
            <BacklogTable rows={rows} showSupplier={false} />
          </>
        )}
      </div>
    </div>
  );
}
