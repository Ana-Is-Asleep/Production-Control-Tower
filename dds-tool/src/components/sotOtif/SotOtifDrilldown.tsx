'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical, Maximize2, MoreHorizontal, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters, type WeekInRange, type ActiveFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { useVendorMapping } from '../../hooks/useVendorMapping';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { KpiBox } from '../shared/KpiBox';
import { TopGraphChart } from '../sections/TopGraphChart';
import { KPICardsRow } from './KPICardsRow';
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
import { aggregateSOTRate, aggregateOTIFRate } from '../../lib/kpiFormulas';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { parseSotOtifParams, buildSotOtifParams } from '../../lib/sotOtifParams';

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

  const { filters, setFilters, weekRangeLines, weeksInRange, allSuppliers, curWeek, curYear } =
    useFilters(allLines, initial.filters);

  const [selectedWeek, setSelectedWeek] = useState<WeekInRange | null>(
    () => weeksInRange.find((w) => w.label === initial.selectedWeek) ?? null
  );
  // true only when Mode B was reached by clicking a scorecard row — controls the
  // "← All suppliers" breadcrumb so it doesn't show up when the supplier was picked via the filter
  const [viaScorecard, setViaScorecard] = useState(false);
  const [scorecardShowAll, setScorecardShowAll] = useState(false);

  const today = useMemo(() => new Date(), []);
  const kpis = useKPIs(weekRangeLines, weeksInRange, isChinaSupplier);

  // keep the URL in sync so the view is shareable and survives a refresh (the uploaded data
  // itself does not persist across a hard reload — only the filter/selection state does)
  useEffect(() => {
    const params = buildSotOtifParams(filters, selectedWeek?.label ?? null);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedWeek, pathname]);

  const handleFilterChange = (f: ActiveFilters) => {
    setFilters(f);
    if (f.suppliers.length !== 1) setViaScorecard(false);
  };

  const handleSupplierRowClick = (supplier: string) => {
    setFilters({ ...filters, suppliers: [supplier] });
    setViaScorecard(true);
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

  const scopeRollups = useMemo(() => rollupByPO(kpiLines, isChinaSupplier, today), [kpiLines, isChinaSupplier, today]);
  const scopeSOT = useMemo(() => aggregateSOTRate(kpiLines, isChinaSupplier, today), [kpiLines, isChinaSupplier, today]);
  const scopeOTIF = useMemo(() => aggregateOTIFRate(kpiLines, isChinaSupplier), [kpiLines, isChinaSupplier]);
  const onTimeCount = scopeRollups.filter((r) => r.sot === true).length;
  const lateCount = scopeRollups.filter((r) => r.sot === false).length;
  const otifOnCount = scopeRollups.filter((r) => r.otif === true).length;
  const otifOffCount = scopeRollups.filter((r) => r.otif === false).length;
  // "Not SOT Predicted" — POs where SOT is still undetermined (future PGRD week with no ESD yet
  // to project from), i.e. computeSOTLine's null case. Not a new calculation, just a new count
  // over the same per-PO rollup result already computed above.
  const notSotPredictedCount = scopeRollups.filter((r) => r.sot === null).length;
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

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <PageHeader
          breadcrumb={
            isModeB
              ? [{ label: 'Overview', href: '/' }, { label: 'SOT / OTIF Detail' }]
              : [{ label: 'Dashboard', href: '/' }, { label: 'SOT / OTIF Performance' }]
          }
          filters={filters}
          onChange={handleFilterChange}
          allSuppliers={allSuppliers}
          curWeek={curWeek}
          curYear={curYear}
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

      {/* Top section — persistent chart + context-aware KPI cards, ~35% of screen height.
          A real flex column (not a hardcoded height subtraction) so the KPI row can never
          overflow the container and spill onto the scrollable section below it. */}
      <div className="shrink-0 flex flex-col overflow-hidden" style={{ height: '38vh' }}>
        {!isModeB ? (
          <div className="flex-1 min-h-0 px-4 pt-3 flex gap-3">
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
                  <Maximize2 size={14} />
                  <MoreHorizontal size={14} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <TopGraphChart points={kpis.topGraph} onWeekClick={handleChartWeekClick} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 px-4 pt-3 flex gap-3">
            <SupplierInfoCard
              supplier={selectedSupplier ?? ''}
              categories={filters.categories}
              channels={filters.channels}
              weekLabelStart={weeksInRange[0]?.label ?? ''}
              weekLabelEnd={weeksInRange[weeksInRange.length - 1]?.label ?? ''}
              weekCount={weeksInRange.length}
            />
            <div className="flex-1 min-h-0 min-w-0 bg-white rounded-lg border border-[#e9e3df] p-3 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between shrink-0 mb-2">
                <p className="text-sm font-bold text-[#403833]">SOT &amp; OTIF Evolution</p>
                <div className="flex items-center gap-2 text-[#9c9794]">
                  <span className="text-[11px] font-medium px-2 py-1 rounded-md border border-[#e9e3df]">Weekly</span>
                  <Maximize2 size={14} />
                  <MoreHorizontal size={14} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <TopGraphChart points={kpis.topGraph} onWeekClick={handleChartWeekClick} />
              </div>
            </div>
          </div>
        )}
        {!isModeB ? (
          <KPICardsRow
            sotTarget={kpis.sotTarget}
            totalPOs={scopeRollups.length}
            onTimeCount={onTimeCount}
            lateCount={lateCount}
            notSotPredictedCount={notSotPredictedCount}
            avgDelayDays={avgDelayDays}
            weekLabel={kpiWeekLabel}
          />
        ) : (
          <SupplierKpiStrip
            weekLabel={selectedWeek?.label ?? null}
            posInScope={scopeRollups.length}
            sotPct={scopeSOT}
            otifPct={scopeOTIF}
            sotTarget={kpis.sotTarget}
            otifTarget={kpis.otifTarget}
            onTimeCount={onTimeCount}
            lateCount={lateCount}
            otifOnCount={otifOnCount}
            otifOffCount={otifOffCount}
          />
        )}
      </div>

      {selectedWeek && (
        <div className="px-4 py-1.5 bg-[#fff7ed] border-y border-brand flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-brand">{selectedWeek.label} selected</span>
          <button onClick={handleDeselectWeek} className="text-xs text-[#9c9794] hover:text-brand underline">
            Clear — view full period
          </button>
        </div>
      )}

      {/* Bottom section — fills remaining height; the 3-panel row scrolls internally per-card
          so "About the metrics" always stays on screen instead of being pushed below the fold. */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!isModeB ? (
          <div className="p-4 h-full flex flex-col gap-4">
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_1fr] gap-4 items-stretch">
              <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-sm font-bold text-[#403833]">Performance by Week</p>
                  <span className="text-xs text-brand font-semibold">View data</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PerformanceByWeekTable lines={weekRangeLines} weeksInRange={weeksInRange} isChinaSupplier={isChinaSupplier} today={today} />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-sm font-bold text-[#403833]">Supplier Scorecard <span className="text-[11px] font-medium text-[#9c9794]">(Top {Math.min(10, allSuppliers.length)} by volume)</span></p>
                  {allSuppliers.length > 10 && (
                    <button onClick={() => setScorecardShowAll((v) => !v)} className="text-xs text-brand font-semibold hover:underline shrink-0">
                      {scorecardShowAll ? 'Show top 10 only' : `View all (${allSuppliers.length})`}
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
                    showAll={scorecardShowAll}
                  />
                </div>
              </div>
              <KeyInsightsPanel rollups={scopeRollups} avgDelayDays={avgDelayDays} weekLabel={kpiWeekLabel} />
            </div>
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4 shrink-0" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm font-bold text-[#403833]">About the metrics</p>
                <Info size={13} className="text-[#9c9794]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-[11px] text-[#7b7571]">
                <p><span className="font-semibold text-[#403833]">SOT %</span> — share of POs shipped on or before their Shipment On Time date.</p>
                <p><span className="font-semibold text-[#403833]">OTIF %</span> — share of POs delivered on or before their Committed Delivery Date (EGRD), in full.</p>
                <p><span className="font-semibold text-[#403833]">Target</span> — strategic target for both SOT and OTIF is {kpis.sotTarget}%.</p>
                <p><span className="font-semibold text-[#403833]">POs in Last Completed Week</span> — all metrics on this page refer to {kpiWeekLabel ?? 'the selected period'}.</p>
                <div className="bg-[#fff7ed] rounded-md px-2.5 py-2">Percentages are calculated based on POs in scope for the selected period.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              <SupplierKeyInsights
                weekLabel={selectedWeek?.label ?? null}
                sotPct={scopeSOT}
                otifPct={scopeOTIF}
                sotTarget={kpis.sotTarget}
                otifTarget={kpis.otifTarget}
                lateCount={lateCount}
                posInScope={scopeRollups.length}
                consistency={consistencyStats}
              />
              <PerformanceConsistency stats={consistencyStats} periodLabel={periodLabel} />
              <LatenessProfile rollups={supplierWeekRollups} weekLabel={selectedWeek?.label ?? null} />
            </div>

            <WeekStrip
              lines={weekRangeLines.filter((l) => l.supplier === selectedSupplier)}
              weeksInRange={weeksInRange}
              isChinaSupplier={isChinaSupplier}
              today={today}
              selectedWeek={selectedWeek}
              onSelectWeek={handleSelectWeek}
            />
            {selectedWeek ? (
              <POList rollups={supplierWeekRollups} today={today} weekLabel={selectedWeek.label} />
            ) : (
              <p className="text-xs text-[#9c9794] px-1">Select a week above to see its POs</p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
