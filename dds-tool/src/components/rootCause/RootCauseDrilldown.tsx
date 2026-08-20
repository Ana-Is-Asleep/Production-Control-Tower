'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { isSubstantiveReason, type ReasonCategory } from '../../lib/reasonClassification';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import {
  computePORootCauseRows, computeLineDetailRows, computeRootCauseKPIs,
  rankCategories, buildSupplierCategoryMatrix, computeTrendDirection,
  type PORootCauseRow,
} from '../../lib/rootCauseAggregation';
import { formatFilterSummary } from '../../lib/filterSummary';
import { parseRootCauseParams, buildRootCauseParams, type RootCauseMode } from '../../lib/rootCauseParams';
import { KPIStrip } from './KPIStrip';
import { TrendChart } from './TrendChart';
import { SnapshotStrip } from './SnapshotStrip';
import { ParetoRanking } from './ParetoRanking';
import { SupplierHeatmap } from './SupplierHeatmap';
import { GroupedTable } from './GroupedTable';
import { LineDetailTable } from './LineDetailTable';

interface TableFilter {
  week?: string;
  category?: ReasonCategory;
  supplier?: string;
}

export function RootCauseDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initial = useMemo(() => parseRootCauseParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  // read-only: this page inherits the dashboard's filters, it never changes them
  const { filters, weekRangeLines, weeksInRange } = useFilters(allLines, initial.filters);

  const [mode, setMode] = useState<RootCauseMode>(initial.mode);
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null);

  useEffect(() => {
    const params = buildRootCauseParams(filters, mode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, mode, pathname]);

  const linesWithReasons = useMemo(() => weekRangeLines.filter((l) => isSubstantiveReason(l.lossReasonCode)), [weekRangeLines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));

  const allRangeRows = useMemo(
    () => computePORootCauseRows(weekRangeLines, classifications, weeksInRange),
    [weekRangeLines, classifications, weeksInRange]
  );
  const allRangeLineRows = useMemo(
    () => computeLineDetailRows(weekRangeLines, classifications, weeksInRange),
    [weekRangeLines, classifications, weeksInRange]
  );

  const isSingleSupplier = filters.suppliers.length === 1;
  const snapshotWeek = weeksInRange.find((w) => w.isCurrent) ?? weeksInRange[weeksInRange.length - 1];
  const actualWeeks = weeksInRange.filter((w) => !w.isFuture);

  // scope rows/lines for the current mode
  const scopeRows: PORootCauseRow[] = useMemo(() => {
    if (mode === 'trend') return allRangeRows;
    return allRangeRows.filter((r) => r.week?.label === snapshotWeek?.label);
  }, [mode, allRangeRows, snapshotWeek]);

  const scopeLineRows = useMemo(() => {
    if (mode === 'trend') return allRangeLineRows;
    return allRangeLineRows.filter((r) => r.week?.label === snapshotWeek?.label);
  }, [mode, allRangeLineRows, snapshotWeek]);

  const scopeLines = useMemo(() => {
    if (mode === 'trend') return weekRangeLines;
    if (!snapshotWeek) return [];
    return weekRangeLines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === snapshotWeek.week && getISOWeekYear(l.pgrd) === snapshotWeek.year);
  }, [mode, weekRangeLines, snapshotWeek]);

  const kpis = useMemo(() => computeRootCauseKPIs(scopeRows, mode === 'trend' ? weekRangeLines : scopeLines), [scopeRows, mode, weekRangeLines, scopeLines]);

  // trend arrow: Snapshot compares the snapshot week to the week right before it; Trend compares
  // the first half of the inherited range to the second half
  const { trendDirection, trendCaption } = useMemo(() => {
    if (mode === 'snapshot' && snapshotWeek) {
      const priorWeek = weeksInRange.find((w) => w.offset === snapshotWeek.offset - 1);
      const currentCount = allRangeRows.filter((r) => r.week?.label === snapshotWeek.label).length;
      const priorCount = priorWeek ? allRangeRows.filter((r) => r.week?.label === priorWeek.label).length : 0;
      return {
        trendDirection: computeTrendDirection(currentCount, priorCount),
        trendCaption: priorWeek ? `${snapshotWeek.label} vs ${priorWeek.label} (${currentCount} vs ${priorCount})` : 'No prior week to compare',
      };
    }
    const mid = Math.floor(actualWeeks.length / 2);
    const firstHalf = actualWeeks.slice(0, mid);
    const secondHalf = actualWeeks.slice(mid);
    const firstCount = allRangeRows.filter((r) => r.week && firstHalf.some((w) => w.label === r.week!.label)).length;
    const secondCount = allRangeRows.filter((r) => r.week && secondHalf.some((w) => w.label === r.week!.label)).length;
    return {
      trendDirection: computeTrendDirection(secondCount, firstCount),
      trendCaption: `First half vs second half of range (${firstCount} vs ${secondCount})`,
    };
  }, [mode, snapshotWeek, weeksInRange, allRangeRows, actualWeeks]);

  const categoryOrder = useMemo(() => rankCategories(scopeRows).map((r) => r.category), [scopeRows]);
  const paretoRanking = useMemo(() => rankCategories(scopeRows), [scopeRows]);
  const heatmapMatrix = useMemo(() => buildSupplierCategoryMatrix(scopeRows), [scopeRows]);

  // client-side filter applied to the table when a chart segment / pareto bar / heatmap cell is clicked
  const filteredLineRows = useMemo(() => {
    if (!tableFilter) return scopeLineRows;
    return scopeLineRows.filter((r) =>
      (!tableFilter.week || r.week?.label === tableFilter.week) &&
      (!tableFilter.category || r.aiCategory === tableFilter.category) &&
      (!tableFilter.supplier || r.supplier === tableFilter.supplier)
    );
  }, [scopeLineRows, tableFilter]);

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
        <p className="text-sm text-[#9c9794]">Go back to the overview and upload your Business Central exports.</p>
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
        <span className="text-[#403833] text-sm font-semibold shrink-0">Root Cause Detail</span>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-xs text-[#7b7571] truncate">Filtered by: {formatFilterSummary(filters)}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 shrink-0">
          {(['snapshot', 'trend'] as RootCauseMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                mode === m ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
              }`}
            >
              {m === 'snapshot' ? 'Last Completed Week (Snapshot)' : 'All Weeks (Trend)'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <KPIStrip kpis={kpis} trend={trendDirection} trendCaption={trendCaption} />

        <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">
            {mode === 'trend' ? 'Loss Reasons by Week' : `Recent Weeks — ${snapshotWeek?.label ?? ''} highlighted`}
          </p>
          {mode === 'trend' ? (
            <TrendChart
              rows={allRangeRows}
              weeksInRange={weeksInRange}
              categoryOrder={categoryOrder}
              onBarClick={(week, category) => setTableFilter({ week, category })}
            />
          ) : snapshotWeek ? (
            <SnapshotStrip
              rows={allRangeRows}
              contextWeeks={actualWeeks.slice(-6)}
              snapshotWeek={snapshotWeek}
              onSelectWeek={(week) => setTableFilter({ week })}
              onSelectWeekCategory={(week, category) => setTableFilter({ week, category })}
            />
          ) : null}
        </div>

        {!isSingleSupplier ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <ParetoRanking ranking={paretoRanking} onSelectCategory={(category) => setTableFilter({ category })} title="Root Cause Pareto" />
              <SupplierHeatmap matrix={heatmapMatrix} onSelectCell={(supplier, category) => setTableFilter({ supplier, category })} />
            </div>
            {tableFilter && (
              <button onClick={() => setTableFilter(null)} className="text-xs text-brand hover:underline">
                Clear table filter ✕
              </button>
            )}
            <GroupedTable rows={filteredLineRows} />
          </>
        ) : (
          <>
            <ParetoRanking ranking={paretoRanking} onSelectCategory={(category) => setTableFilter({ category })} title="Root Cause Ranking" />
            {tableFilter && (
              <button onClick={() => setTableFilter(null)} className="text-xs text-brand hover:underline">
                Clear table filter ✕
              </button>
            )}
            <LineDetailTable rows={filteredLineRows} />
          </>
        )}
      </div>
    </div>
  );
}
