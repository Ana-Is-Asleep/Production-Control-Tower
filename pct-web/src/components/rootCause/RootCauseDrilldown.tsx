'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useActions } from '../../hooks/useActions';
import { computeTrendDirection } from '../../lib/rootCauseAggregation';
import {
  computeRootCauseSubmissionRows, computeSubmissionKPIs,
  rankReasons, buildSupplierReasonMatrix,
  type RootCauseSubmissionRow,
} from '../../lib/rootCauseSubmissions';
import { Sidebar } from '../shell/Sidebar';
import { DetailHeader } from '../shell/DetailHeader';
import { GlobalActionsBadge } from '../actions/GlobalActionsBadge';
import { ROOT_CAUSE_REASON_LABELS, type RootCauseReason } from '../../types/actions';
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
  category?: RootCauseReason;
  supplier?: string;
}

export function RootCauseDrilldown() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initial = useMemo(() => parseRootCauseParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { filters, setFilters, weekRangeLines, weeksInRange, allSuppliers, curWeek, curYear } = useFilters(allLines, initial.filters);
  const { actions } = useActions();

  const [mode, setMode] = useState<RootCauseMode>(initial.mode);
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    const params = buildRootCauseParams(filters, mode);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, mode, location.pathname]);

  const filteredPOs = useMemo(() => new Set(weekRangeLines.map((l) => l.po)), [weekRangeLines]);
  const allRangeRows: RootCauseSubmissionRow[] = useMemo(
    () => computeRootCauseSubmissionRows(actions, weekRangeLines, weeksInRange, filteredPOs),
    [actions, weekRangeLines, weeksInRange, filteredPOs]
  );

  const isSingleSupplier = filters.suppliers.length === 1;
  const snapshotWeek = weeksInRange.find((w) => w.isCurrent) ?? weeksInRange[weeksInRange.length - 1];
  const actualWeeks = weeksInRange.filter((w) => !w.isFuture);

  // scope rows for the current mode — one row per flagged (missed-SOT) PO, used for both the
  // charts and the tables below (the SCM answer is at PO grain, so there's no separate line-level
  // row type the way the old AI-classified pipeline needed)
  const scopeRows: RootCauseSubmissionRow[] = useMemo(() => {
    if (mode === 'trend') return allRangeRows;
    return allRangeRows.filter((r) => r.week?.label === snapshotWeek?.label);
  }, [mode, allRangeRows, snapshotWeek]);

  const kpis = useMemo(() => computeSubmissionKPIs(scopeRows), [scopeRows]);

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

  const categoryOrder = useMemo(() => rankReasons(scopeRows).map((r) => r.category), [scopeRows]);
  const paretoRanking = useMemo(() => rankReasons(scopeRows), [scopeRows]);
  const heatmapMatrix = useMemo(() => buildSupplierReasonMatrix(scopeRows), [scopeRows]);

  // client-side filter applied to the table when a chart segment / pareto bar / heatmap cell is clicked
  const filteredLineRows = useMemo(() => {
    if (!tableFilter) return scopeRows;
    return scopeRows.filter((r) =>
      (!tableFilter.week || r.week?.label === tableFilter.week) &&
      (!tableFilter.category || r.reason === tableFilter.category) &&
      (!tableFilter.supplier || r.supplier === tableFilter.supplier)
    );
  }, [scopeRows, tableFilter]);

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your Business Central exports.</p>
          <Link to="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
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
        <DetailHeader
          title="Root Cause Detail"
          filters={filters}
          onChange={setFilters}
          allSuppliers={allSuppliers}
          curWeek={curWeek}
          curYear={curYear}
          centerContent={<GlobalActionsBadge filteredPOs={new Set(weekRangeLines.map((l) => l.po))} allSuppliers={allSuppliers} filters={filters} bucketFilter="root_cause" onOpenChange={setActionsOpen} />}
          rightActions={
            <div className="flex items-center gap-1">
              {(['snapshot', 'trend'] as RootCauseMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    mode === m ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
                  }`}
                >
                  {m === 'snapshot' ? 'Last Completed Week (Snapshot)' : 'All Weeks (Trend)'}
                </button>
              ))}
            </div>
          }
        />

      {/* Header stays full width above — only this content area reserves space for the Actions
          drawer (which starts below the header, not overlapping it). */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 transition-[padding] duration-150" style={{ paddingRight: actionsOpen ? 340 : undefined }}>
        <KPIStrip kpis={kpis} trend={trendDirection} trendCaption={trendCaption} />

        <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">
            {mode === 'trend' ? 'Root Causes by Week' : `Recent Weeks — ${(tableFilter?.week ?? snapshotWeek?.label) ?? ''} highlighted`}
          </p>
          <p className="text-[10px] text-[#b5aaa5] mb-3 normal-case tracking-normal">X-axis: PGRD week</p>
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
              highlightedWeek={tableFilter?.week ?? snapshotWeek.label}
              onSelectWeek={(week) => setTableFilter({ week })}
              onSelectWeekCategory={(week, category) => setTableFilter({ week, category })}
            />
          ) : null}
        </div>

        {!isSingleSupplier ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <ParetoRanking ranking={paretoRanking} onSelectCategory={(category) => setTableFilter({ category })} title="Root Cause Pareto" />
              <SupplierHeatmap matrix={heatmapMatrix} labels={ROOT_CAUSE_REASON_LABELS} onSelectCell={(supplier, category) => setTableFilter({ supplier, category })} />
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
    </div>
  );
}
