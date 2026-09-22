'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical, Maximize2 } from 'lucide-react';
import { LargeModal } from '../shared/LargeModal';
import { useData } from '../../context/DataContext';
import { useFilters, type WeekInRange } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { useVendorMapping } from '../../hooks/useVendorMapping';
import { Sidebar } from '../shell/Sidebar';
import { DetailHeader } from '../shell/DetailHeader';
import { GlobalActionsBadge } from '../actions/GlobalActionsBadge';
import { KpiBox } from '../shared/KpiBox';
import { TopGraphChart } from '../sections/TopGraphChart';
import { SupplierInfoCard } from './SupplierInfoCard';
import { SupplierKpiStrip } from './SupplierKpiStrip';
import { ScorecardMatrix } from './ScorecardMatrix';
import { PerformanceByWeekTable } from './PerformanceByWeekTable';
import { KeyInsightsPanel } from './KeyInsightsPanel';
import { SupplierKeyInsights } from './SupplierKeyInsights';
import { PerformanceConsistency } from './PerformanceConsistency';
import { LatenessProfile } from './LatenessProfile';
import { WeekStrip } from './WeekStrip';
import { POList } from './POList';
import { rollupByPO, computeConsistencyStats } from '../../lib/poAggregation';
import { aggregateSOTRate, aggregateOTIFRate, aggregateByQty, computeSOTLine, computeOTIFLine } from '../../lib/kpiFormulas';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { parseSotOtifParams, buildSotOtifParams } from '../../lib/sotOtifParams';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { computePORootCauseRows } from '../../lib/rootCauseAggregation';
import { isSubstantiveReason, type ReasonCategory } from '../../lib/reasonClassification';

function pctLabel(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

export function SotOtifDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();
  const { isChinaSupplier } = useVendorMapping();

  const initial = useMemo(() => parseSotOtifParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { filters, setFilters, filteredLines, weekRangeLines, weeksInRange, allSuppliers, curWeek, curYear } =
    useFilters(allLines, initial.filters);

  const [selectedWeek, setSelectedWeek] = useState<WeekInRange | null>(
    () => weeksInRange.find((w) => w.label === initial.selectedWeek) ?? null
  );
  // true only when Mode B was reached by clicking a scorecard row — controls the
  // "← All suppliers" breadcrumb so it doesn't show up when the supplier was picked via the filter
  const [viaScorecard, setViaScorecard] = useState(false);
  const [scorecardModalOpen, setScorecardModalOpen] = useState(false);
  const [scorecardSearch, setScorecardSearch] = useState('');
  const [chartExpanded, setChartExpanded] = useState(false);
  const [perfWeekModalOpen, setPerfWeekModalOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const kpis = useKPIs(weekRangeLines, filteredLines, weeksInRange, isChinaSupplier);

  // keep the URL in sync so the view is shareable and survives a refresh (the uploaded data
  // itself does not persist across a hard reload — only the filter/selection state does)
  useEffect(() => {
    const params = buildSotOtifParams(filters, selectedWeek?.label ?? null);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedWeek, pathname]);

  const handleSupplierRowClick = (supplier: string) => {
    setFilters({ ...filters, suppliers: [supplier] });
    setViaScorecard(true);
    setScorecardModalOpen(false);
  };

  const handleAllSuppliers = () => {
    setFilters({ ...filters, suppliers: [] });
    setViaScorecard(false);
  };

  const handleSelectWeek = (week: WeekInRange) => setSelectedWeek(week);
  const handleDeselectWeek = () => setSelectedWeek(null);
  // only completed weeks are selectable — a projected/future week has no actual PO outcomes yet
  // for the KPI row, lateness profile, or PO table to describe
  const handleChartWeekClick = (weekLabel: string) => {
    const match = weeksInRange.find((w) => w.label === weekLabel);
    if (match && !match.isFuture) setSelectedWeek(match);
  };

  const isModeB = filters.suppliers.length === 1;
  const selectedSupplier = isModeB ? filters.suppliers[0] : null;

  // Mode B should never load with nothing selected — default to the most recent completed week
  // (falling back to the last week in range if the range doesn't include it) so the PO list
  // appears immediately without the user needing to click a tile first. Only auto-selects ONCE
  // per supplier — otherwise this would immediately re-fire and override a manual "Clear" click,
  // since that also sets selectedWeek to null.
  const autoSelectedForSupplier = useRef<string | null>(null);
  useEffect(() => {
    if (!isModeB || !selectedSupplier) {
      autoSelectedForSupplier.current = null;
      return;
    }
    if (autoSelectedForSupplier.current === selectedSupplier) return;
    autoSelectedForSupplier.current = selectedSupplier;
    if (selectedWeek || weeksInRange.length === 0) return;
    // fall back to the most recent COMPLETED week in range, never a projected one
    const defaultWeek = weeksInRange.find((w) => w.isCurrent) ?? [...weeksInRange].reverse().find((w) => !w.isFuture);
    if (defaultWeek) setSelectedWeek(defaultWeek);
  }, [isModeB, selectedSupplier, selectedWeek, weeksInRange]);

  // scope for Mode A's risk/concentration sections: the selected week's POs, or the full period
  // in view when no week is selected
  const scopeLines = useMemo(() => {
    if (!selectedWeek) return weekRangeLines;
    return weekRangeLines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === selectedWeek.week && getISOWeekYear(l.pgrd) === selectedWeek.year);
  }, [weekRangeLines, selectedWeek]);

  // scope for the KPI strip specifically: the selected week's POs, or the LAST COMPLETED week
  // (not the whole multi-week range) when no week is explicitly selected — the KPI cards are meant
  // to read like "how did we do" not "how did we do averaged across everything in view"
  const kpiLines = useMemo(() => {
    if (selectedWeek) return scopeLines;
    const lastCompleted = weeksInRange.find((w) => w.isCurrent);
    if (!lastCompleted) return scopeLines;
    return weekRangeLines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === lastCompleted.week && getISOWeekYear(l.pgrd) === lastCompleted.year);
  }, [selectedWeek, scopeLines, weekRangeLines, weeksInRange]);
  const kpiWeekLabel = selectedWeek?.label ?? weeksInRange.find((w) => w.isCurrent)?.label ?? null;

  // Every upcoming (not-yet-completed) week's projected SOT/OTIF, in order — same ESD-based
  // projection already driving the chart's dashed "projected" line (useKPIs.ts). Surfaced two
  // ways: the nearest week alone for the "next week" bullet, and the full run for the "back on/
  // off target by week X" bullet, which scans ahead to find where the trend crosses target.
  const futureProjections = useMemo(
    () => kpis.topGraph
      .filter((p) => p.isFuture && !p.isCurrent)
      .map((p) => ({ weekLabel: p.weekLabel, sotPct: p.sotFuturePct, otifPct: p.otifFuturePct })),
    [kpis.topGraph]
  );
  const nextWeekProjection = futureProjections[0] ?? null;

  const scopeRollups = useMemo(() => rollupByPO(kpiLines, isChinaSupplier, today), [kpiLines, isChinaSupplier, today]);
  const onTimeCount = scopeRollups.filter((r) => r.sot === true).length;
  const lateCount = scopeRollups.filter((r) => r.sot === false).length;
  const otifOnCount = scopeRollups.filter((r) => r.otif === true).length;
  const otifOffCount = scopeRollups.filter((r) => r.otif === false).length;
  // Same per-line classification as onTimeCount/otifOnCount above, just weighted by requested
  // quantity instead of PO count — feeds the "by Qty" half of the Mode B KPI deep dive.
  const sotQty = useMemo(
    () => aggregateByQty(kpiLines, (l) => computeSOTLine(l, isChinaSupplier(l.vendorCode), today)),
    [kpiLines, isChinaSupplier, today]
  );
  const otifQty = useMemo(
    () => aggregateByQty(kpiLines, (l) => computeOTIFLine(l, isChinaSupplier(l.vendorCode)).otif),
    [kpiLines, isChinaSupplier]
  );
  // Matches the PO List table's per-PO SOT/OTIF status (majority vote across a PO's lines, same
  // as rollupByPO) instead of aggregateSOTRate/aggregateOTIFRate's per-PO fractional average — the
  // two disagreed whenever a PO's lines split (e.g. 8/9 lines OTIF still counts as "OTIF" in the
  // table but only scored 0.89 in the fractional average), which is what produced "98%" here next
  // to a table where all 4 POs read "OTIF" (should read 100%).
  const scopeSOT = onTimeCount + lateCount > 0 ? Math.round((onTimeCount / (onTimeCount + lateCount)) * 100) : null;
  const scopeOTIF = otifOnCount + otifOffCount > 0 ? Math.round((otifOnCount / (otifOnCount + otifOffCount)) * 100) : null;
  // Avg delay among POs that actually missed SOT: ship date (ASD if shipped, else ESD) minus
  // PGRD, in days — only counted when that gap is positive, since a "late" PO by the SOT week
  // rule could still have a same-week ship date a few days after PGRD's week started.
  const avgDelayDays = useMemo(() => {
    const delays = scopeRollups
      .filter((r) => r.sot === false && r.pgrd)
      .map((r) => {
        const shipDate = r.asd ?? r.esd;
        if (!shipDate) return null;
        return Math.round((shipDate.getTime() - r.pgrd!.getTime()) / 86400000);
      })
      .filter((d): d is number => d !== null && d > 0);
    return delays.length ? Math.round((delays.reduce((s, d) => s + d, 0) / delays.length) * 10) / 10 : null;
  }, [scopeRollups]);

  // Mode A: PO-level root-cause classification for the full range in view — same AI-backed
  // pipeline the Root Cause Detail page uses (useReasonClassification + computePORootCauseRows),
  // reused here rather than re-deriving categories a second way. Feeds the Supplier Scorecard's
  // Main Root Cause(s) column and the Key Insights "most common cause" bullet below.
  const linesWithReasons = useMemo(() => weekRangeLines.filter((l) => isSubstantiveReason(l.lossReasonCode)), [weekRangeLines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));
  const rootCauseRows = useMemo(
    () => computePORootCauseRows(weekRangeLines, classifications, weeksInRange),
    [weekRangeLines, classifications, weeksInRange]
  );
  const topRootCause = useMemo(() => {
    const categoryByPO = new Map<string, ReasonCategory>();
    rootCauseRows.forEach((r) => { if (r.finalCategory) categoryByPO.set(r.po, r.finalCategory); });
    const late = scopeRollups.filter((r) => r.sot === false);
    if (late.length === 0) return null;
    const counts = new Map<ReasonCategory, number>();
    late.forEach((r) => {
      const category = categoryByPO.get(r.po);
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    if (counts.size === 0) return null;
    const [category, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { category, count, share: Math.round((count / late.length) * 100) };
  }, [rootCauseRows, scopeRollups]);

  // Mode B: per-week SOT/OTIF/volume for this supplier across the selected historical range,
  // completed weeks only (a projected week isn't a real outcome yet) — feeds Performance
  // Consistency and the supplier-specific Key Insights below.
  const completedWeekPoints = useMemo(() => {
    if (!isModeB) return [];
    return weeksInRange.filter((w) => !w.isFuture).map((w) => {
      const wLines = weekRangeLines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === w.week && getISOWeekYear(l.pgrd) === w.year);
      const poCount = new Set(wLines.map((l) => l.po)).size;
      return {
        label: w.label,
        sot: poCount > 0 ? aggregateSOTRate(wLines, isChinaSupplier, today) : null,
        otif: poCount > 0 ? aggregateOTIFRate(wLines, isChinaSupplier) : null,
        poCount,
      };
    });
  }, [isModeB, weeksInRange, weekRangeLines, isChinaSupplier, today]);
  const consistencyStats = useMemo(
    () => computeConsistencyStats(completedWeekPoints, kpis.sotTarget),
    [completedWeekPoints, kpis.sotTarget]
  );
  const periodLabel = weeksInRange.length
    ? `${weeksInRange[0].label}–${weeksInRange[weeksInRange.length - 1].label}`
    : '';

  // Mode B: this supplier's rollups for the currently selected week (PO list only loads once a
  // week tile is clicked, per spec)
  const supplierWeekLines = useMemo(() => {
    if (!isModeB || !selectedWeek) return [];
    return weekRangeLines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === selectedWeek.week && getISOWeekYear(l.pgrd) === selectedWeek.year);
  }, [isModeB, selectedWeek, weekRangeLines]);
  const supplierWeekRollups = useMemo(
    () => rollupByPO(supplierWeekLines, isChinaSupplier, today),
    [supplierWeekLines, isChinaSupplier, today]
  );

  // uploaded data lives only in-memory (DataContext) — a direct link or a hard refresh on this
  // page won't have it, so send the user back to upload rather than rendering an empty dashboard
  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your Business Central exports.</p>
          <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
            ← Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  // Mode A (multi-supplier strategic view) stays viewport-locked/compact, no page scroll — same
  // as before. Mode B (single-supplier deep dive) scrolls naturally as one normal page, matching
  // the Backlog/other detail pages' pattern: everything through the analysis row is kept compact
  // enough to fit one screen, and only the PO table (a detail drill-down) falls below the fold.
  // Sidebar is `sticky top-0` so it stays pinned in both cases.
  return (
    <div className={isModeB ? 'min-h-screen w-full bg-[#f5f2ee] flex' : 'h-screen w-full bg-[#f5f2ee] flex overflow-hidden'}>
      <Sidebar />
      <div className={`${isModeB ? 'flex-1 min-w-0 flex flex-col' : 'flex-1 min-w-0 flex flex-col overflow-hidden'} transition-[padding] duration-150`} style={{ paddingRight: actionsOpen ? 416 : undefined }}>
        <DetailHeader
          title={isModeB ? 'SOT / OTIF Detail' : 'SOT / OTIF Performance'}
          filters={filters}
          centerContent={<GlobalActionsBadge filteredPOs={new Set(weekRangeLines.map((l) => l.po))} allSuppliers={allSuppliers} filters={filters} bucketFilter="sot_otif" onOpenChange={setActionsOpen} />}
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

        {isModeB && viaScorecard && (
          <div className="px-5 py-1.5 bg-white border-b border-[#e9e3df] shrink-0">
            <button onClick={handleAllSuppliers} className="text-xs font-medium text-brand hover:underline">
              ← All suppliers
            </button>
          </div>
        )}

      {!isModeB ? (
        <>
          {/* Top section — persistent chart + KPI target cards, kept compact so Performance by
              Week / Supplier Scorecard / Key Insights all fit below on one normal desktop screen
              at 100% zoom. The chart itself is display-only (no onWeekClick) — a week is only
              ever selected via the Performance by Week table below or the Mode B week strip,
              never by clicking the bars directly. */}
          <div className="shrink-0 flex px-4 pt-3 gap-3" style={{ height: 260 }}>
            <div className="flex flex-col gap-2 shrink-0 w-[180px]">
              <KpiBox
                label={`SOT · ${kpis.sotTarget}% target`}
                value={pctLabel(scopeSOT)}
                valueClassName={`text-2xl ${scopeSOT === null ? 'text-[#c8c0bb]' : scopeSOT >= kpis.sotTarget ? 'text-pass' : 'text-fail'}`}
                tint={scopeSOT === null ? 'neutral' : scopeSOT >= kpis.sotTarget ? 'pass' : 'fail'}
              />
              <KpiBox
                label={`OTIF · ${kpis.otifTarget}% target`}
                value={pctLabel(scopeOTIF)}
                valueClassName={`text-2xl ${scopeOTIF === null ? 'text-[#c8c0bb]' : scopeOTIF >= kpis.otifTarget ? 'text-pass' : 'text-fail'}`}
                tint={scopeOTIF === null ? 'neutral' : scopeOTIF >= kpis.otifTarget ? 'pass' : 'fail'}
              />
            </div>
            <div className="flex-1 min-h-0 min-w-0 bg-white rounded-lg border border-[#e9e3df] p-3 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between shrink-0 mb-2">
                <p className="text-sm font-bold text-[#403833]">SOT &amp; OTIF Evolution</p>
                <div className="flex items-center gap-2 text-[#9c9794]">
                  <span className="text-[11px] font-medium px-2 py-1 rounded-md border border-[#e9e3df]">Weekly</span>
                  <button onClick={() => setChartExpanded(true)} title="Expand chart" aria-label="Expand chart" className="hover:text-[#403833] transition-colors">
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <TopGraphChart points={kpis.topGraph} />
              </div>
            </div>
          </div>

          {selectedWeek && (
            <div className="px-4 py-1.5 mt-3 bg-[#fff7ed] border-y border-brand flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-brand">{selectedWeek.label} selected</span>
              <button onClick={handleDeselectWeek} className="text-xs text-[#9c9794] hover:text-brand underline">
                Clear — view full period
              </button>
            </div>
          )}

          {/* Bottom section — Performance by Week / Supplier Scorecard / Key Insights, sharing the
              remaining viewport height so the page never scrolls. Scorecard gets the most width
              (it now carries the Main Root Cause(s) column too), Key Insights the least. */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="p-4 flex flex-col min-h-0 flex-1">
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[35fr_43fr_22fr] gap-4 items-stretch" style={{ gridTemplateRows: 'minmax(0, 1fr)' }}>
                <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <p className="text-sm font-bold text-[#403833]">Performance by Week</p>
                    <button onClick={() => setPerfWeekModalOpen(true)} className="text-xs text-brand font-semibold hover:underline">View data</button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <PerformanceByWeekTable lines={weekRangeLines} weeksInRange={weeksInRange} isChinaSupplier={isChinaSupplier} today={today} onWeekClick={handleChartWeekClick} />
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <p className="text-sm font-bold text-[#403833]">Supplier Scorecard <span className="text-[11px] font-medium text-[#9c9794]">(Top {Math.min(10, allSuppliers.length)} by volume)</span></p>
                    {allSuppliers.length > 10 && (
                      <button onClick={() => setScorecardModalOpen(true)} className="text-xs text-brand font-semibold hover:underline shrink-0">
                        View all ({allSuppliers.length})
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <ScorecardMatrix
                      lines={weekRangeLines}
                      weeksInRange={weeksInRange}
                      isChinaSupplier={isChinaSupplier}
                      today={today}
                      selectedWeek={selectedWeek}
                      onSupplierClick={handleSupplierRowClick}
                      showAll={false}
                      rootCauseRows={rootCauseRows}
                    />
                  </div>
                </div>
                <KeyInsightsPanel
                  rollups={scopeRollups}
                  avgDelayDays={avgDelayDays}
                  weekLabel={null}
                  projection={nextWeekProjection}
                  sotTarget={kpis.sotTarget}
                  otifTarget={kpis.otifTarget}
                  topRootCause={topRootCause}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-3">
          {/* Evolution chart, with the supplier's identity/scope alongside it instead of the plain
              SOT/OTIF % pair — those detailed numbers now live in the KPI deep dive below. Chart
              is display-only (no onWeekClick) — the week strip beneath it is the only way to pick
              a week. */}
          <div className="flex gap-3 shrink-0" style={{ height: 220 }}>
            <SupplierInfoCard
              supplier={selectedSupplier ?? ''}
              categories={filters.categories}
              channels={filters.channels}
              period={{
                weekLabelStart: weeksInRange[0]?.label ?? '',
                weekLabelEnd: weeksInRange[weeksInRange.length - 1]?.label ?? '',
                weekCount: weeksInRange.length,
              }}
            />
            <div className="flex-1 min-h-0 min-w-0 bg-white rounded-lg border border-[#e9e3df] p-3 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between shrink-0 mb-2">
                <p className="text-sm font-bold text-[#403833]">SOT &amp; OTIF Evolution</p>
                <div className="flex items-center gap-2 text-[#9c9794]">
                  <span className="text-[11px] font-medium px-2 py-1 rounded-md border border-[#e9e3df]">Weekly</span>
                  <button onClick={() => setChartExpanded(true)} title="Expand chart" aria-label="Expand chart" className="hover:text-[#403833] transition-colors">
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <TopGraphChart points={kpis.topGraph} />
              </div>
            </div>
          </div>

          {/* Weekly performance selector, directly under the chart — clicking a week updates every
              section below it. */}
          <WeekStrip
            lines={weekRangeLines.filter((l) => l.supplier === selectedSupplier)}
            weeksInRange={weeksInRange}
            isChinaSupplier={isChinaSupplier}
            today={today}
            selectedWeek={selectedWeek}
            onSelectWeek={handleSelectWeek}
          />

          {selectedWeek && (
            <div className="-mt-1.5 flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-brand">{selectedWeek.label} selected</span>
              <button onClick={handleDeselectWeek} className="text-xs text-[#9c9794] hover:text-brand underline">
                Clear — view full period
              </button>
            </div>
          )}

          {/* Selected-week KPI deep dive — PO-level and quantity-level SOT/OTIF side by side. */}
          <SupplierKpiStrip
            weekLabel={kpiWeekLabel}
            sotTarget={kpis.sotTarget}
            otifTarget={kpis.otifTarget}
            onTimeCount={onTimeCount}
            lateCount={lateCount}
            otifOnCount={otifOnCount}
            otifOffCount={otifOffCount}
            sotQty={sotQty}
            otifQty={otifQty}
          />

          {/* Analysis row: Performance Consistency, Lateness Profile, Key Insights — in that order. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch shrink-0" style={{ minHeight: 220 }}>
            <PerformanceConsistency stats={consistencyStats} periodLabel={periodLabel} />
            <LatenessProfile rollups={supplierWeekRollups} weekLabel={selectedWeek?.label ?? null} />
            <SupplierKeyInsights
              weekLabel={selectedWeek?.label ?? null}
              sotPct={scopeSOT}
              otifPct={scopeOTIF}
              sotTarget={kpis.sotTarget}
              otifTarget={kpis.otifTarget}
              lateCount={lateCount}
              posInScope={scopeRollups.length}
              consistency={consistencyStats}
              projection={nextWeekProjection}
              futureProjections={futureProjections}
            />
          </div>

          {/* PO-level detail — only once a week is picked; the one section allowed to sit below
              the fold rather than being squeezed to fit one screen. */}
          {selectedWeek ? (
            <POList rollups={supplierWeekRollups} today={today} weekLabel={selectedWeek.label} />
          ) : (
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-xs text-[#9c9794]">Select a week above to see its POs</p>
            </div>
          )}
        </div>
      )}

      {perfWeekModalOpen && (
        <LargeModal
          title="Performance by Week"
          onClose={() => setPerfWeekModalOpen(false)}
          rightActions={
            <button
              onClick={() => {
                const rows: (string | number)[][] = [['Week', 'POs in Scope', 'SOT %', 'OTIF %']];
                weeksInRange.forEach((w) => {
                  const wLines = weekRangeLines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === w.week && getISOWeekYear(l.pgrd) === w.year);
                  const poCount = rollupByPO(wLines, isChinaSupplier, today).length;
                  rows.push([w.label, poCount, aggregateSOTRate(wLines, isChinaSupplier, today) ?? '—', aggregateOTIFRate(wLines, isChinaSupplier) ?? '—']);
                });
                downloadWorkbook('Performance by Week', [{ name: 'Weekly Performance', rows }]);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors"
            >
              <Download size={13} /> Export Excel
            </button>
          }
        >
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
            <PerformanceByWeekTable
              lines={weekRangeLines}
              weeksInRange={weeksInRange}
              isChinaSupplier={isChinaSupplier}
              today={today}
              onWeekClick={(label) => { handleChartWeekClick(label); setPerfWeekModalOpen(false); }}
            />
          </div>
        </LargeModal>
      )}

      {scorecardModalOpen && (
        <LargeModal title="Supplier Scorecard — All Suppliers" onClose={() => setScorecardModalOpen(false)}>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={scorecardSearch}
              onChange={(e) => setScorecardSearch(e.target.value)}
              placeholder="Search supplier..."
              className="text-xs border border-[#e9e3df] rounded-lg px-3 py-1.5 w-64"
            />
            <span className="text-xs text-[#9c9794]">{allSuppliers.filter((s) => s.toLowerCase().includes(scorecardSearch.toLowerCase())).length} of {allSuppliers.length} suppliers</span>
          </div>
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
            <ScorecardMatrix
              lines={weekRangeLines.filter((l) => l.supplier.toLowerCase().includes(scorecardSearch.toLowerCase()))}
              weeksInRange={weeksInRange}
              isChinaSupplier={isChinaSupplier}
              today={today}
              selectedWeek={selectedWeek}
              onSupplierClick={handleSupplierRowClick}
              showAll
              rootCauseRows={rootCauseRows}
            />
          </div>
        </LargeModal>
      )}

      {chartExpanded && (
        <LargeModal title="SOT & OTIF Evolution" onClose={() => setChartExpanded(false)}>
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col">
            <TopGraphChart points={kpis.topGraph} />
          </div>
        </LargeModal>
      )}
    </div>
  </div>
  );
}
