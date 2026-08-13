'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters, type WeekInRange, type ActiveFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { useVendorMapping } from '../../hooks/useVendorMapping';
import { GlobalFilterBar } from '../shared/GlobalFilterBar';
import { TopGraphChart } from '../sections/TopGraphChart';
import { KPICardsRow } from './KPICardsRow';
import { ScorecardMatrix } from './ScorecardMatrix';
import { RiskRadar } from './RiskRadar';
import { ConcentrationAnalysis } from './ConcentrationAnalysis';
import { WeekStrip } from './WeekStrip';
import { SupplierHeaderBar } from './SupplierHeaderBar';
import { POList } from './POList';
import { rollupByPO } from '../../lib/poAggregation';
import { aggregateSOTRate, aggregateOTIFRate } from '../../lib/kpiFormulas';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { parseSotOtifParams, buildSotOtifParams } from '../../lib/sotOtifParams';

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
  const handleChartWeekClick = (weekLabel: string) => {
    const match = weeksInRange.find((w) => w.label === weekLabel);
    if (match) setSelectedWeek(match);
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
    const defaultWeek = weeksInRange.find((w) => w.isCurrent) ?? weeksInRange[weeksInRange.length - 1];
    setSelectedWeek(defaultWeek);
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

  const scopeRollups = useMemo(() => rollupByPO(kpiLines, isChinaSupplier, today), [kpiLines, isChinaSupplier, today]);
  const scopeSOT = useMemo(() => aggregateSOTRate(kpiLines, isChinaSupplier, today), [kpiLines, isChinaSupplier, today]);
  const scopeOTIF = useMemo(() => aggregateOTIFRate(kpiLines, isChinaSupplier), [kpiLines, isChinaSupplier]);
  const onTimeCount = scopeRollups.filter((r) => r.sot === true).length;
  const lateCount = scopeRollups.filter((r) => r.sot === false).length;

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
        {isModeB && viaScorecard && (
          <>
            <span className="text-[#e9e3df]">|</span>
            <button onClick={handleAllSuppliers} className="text-xs font-medium text-brand hover:underline shrink-0">
              ← All suppliers
            </button>
          </>
        )}
        <span className="text-[#e9e3df]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">SOT / OTIF Detail</span>
      </header>

      <GlobalFilterBar filters={filters} onChange={handleFilterChange} allSuppliers={allSuppliers} curWeek={curWeek} curYear={curYear} />

      {/* Top section — persistent chart + context-aware KPI cards, ~35% of screen height.
          A real flex column (not a hardcoded height subtraction) so the KPI row can never
          overflow the container and spill onto the scrollable section below it. */}
      <div className="shrink-0 flex flex-col overflow-hidden" style={{ height: '35vh' }}>
        <div className="flex-1 min-h-0 px-4 pt-3">
          <TopGraphChart points={kpis.topGraph} onWeekClick={handleChartWeekClick} />
        </div>
        <KPICardsRow
          sotPct={scopeSOT}
          otifPct={scopeOTIF}
          sotTarget={kpis.sotTarget}
          otifTarget={kpis.otifTarget}
          totalPOs={scopeRollups.length}
          onTimeCount={onTimeCount}
          lateCount={lateCount}
          compact={isModeB}
        />
      </div>

      {selectedWeek && (
        <div className="px-4 py-1.5 bg-[#fff7ed] border-y border-brand flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-brand">{selectedWeek.label} selected</span>
          <button onClick={handleDeselectWeek} className="text-xs text-[#9c9794] hover:text-brand underline">
            Clear — view full period
          </button>
        </div>
      )}

      {/* Bottom section — scrollable, ~65% of screen height */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!isModeB ? (
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Supplier Scorecard</p>
              <ScorecardMatrix
                lines={weekRangeLines}
                weeksInRange={weeksInRange}
                isChinaSupplier={isChinaSupplier}
                today={today}
                selectedWeek={selectedWeek}
                onSupplierClick={handleSupplierRowClick}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch" style={{ minHeight: '360px' }}>
              <RiskRadar lines={scopeLines} weeksInRange={weeksInRange} isChinaSupplier={isChinaSupplier} today={today} />
              <ConcentrationAnalysis lines={scopeLines} isChinaSupplier={isChinaSupplier} today={today} />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <SupplierHeaderBar
              supplier={selectedSupplier!}
              lines={weekRangeLines.filter((l) => l.supplier === selectedSupplier)}
              weeksInRange={weeksInRange}
              isChinaSupplier={isChinaSupplier}
              today={today}
            />
            <WeekStrip
              lines={weekRangeLines.filter((l) => l.supplier === selectedSupplier)}
              weeksInRange={weeksInRange}
              isChinaSupplier={isChinaSupplier}
              today={today}
              selectedWeek={selectedWeek}
              onSelectWeek={handleSelectWeek}
            />
            {selectedWeek ? (
              <POList rollups={supplierWeekRollups} today={today} />
            ) : (
              <p className="text-xs text-[#9c9794] px-1">Select a week above to see its POs</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
