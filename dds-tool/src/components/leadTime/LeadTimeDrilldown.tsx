'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical, Maximize2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { SKU_CATEGORIES, categorizeSKU, type SKUCategory } from '../../lib/skuUtils';
import { lastCompletedWeek, shiftISOWeek, weekRangeFor } from '../../lib/dateUtils';
import {
  parseLeadTimeParams, buildLeadTimeParams, type LTTab,
} from '../../lib/leadTimeParams';
import {
  buildBuckets, computeOverviewSeries, computeLTKpis, computeHeatmap, computeDrillRows,
  computePeriodsSummary, computeLeadTimeDistribution, skuGroupOf, skuVariationOf, LT_TARGET_DAYS,
  type LTPeriod, type LTHeatmapRows, type LTPOSet, type DrillRow,
} from '../../lib/leadTimeAnalytics';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { LargeModal } from '../shared/LargeModal';
import { LeadTimeKpiStrip } from './LeadTimeKpiStrip';
import { LeadTimeTrendChart } from './LeadTimeTrendChart';
import { LeadTimeHeatmap } from './LeadTimeHeatmap';
import { LeadTimeSkuPanel } from './LeadTimeSkuPanel';
import { LeadTimeDrillPanel } from './LeadTimeDrillPanel';
import { LeadTimeInsights } from './LeadTimeInsights';
import { LeadTimeDistribution } from './LeadTimeDistribution';
import { LeadTimeRecentPeriods } from './LeadTimeRecentPeriods';
import { MultiCheckDropdown } from './MultiCheckDropdown';

interface DrillSelection {
  title: string;
  rows: DrillRow[];
}

function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex bg-[#f9f7f6] border border-[#e9e3df] rounded-full p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${value === o.value ? 'bg-[#403833] text-white' : 'text-[#7b7571] hover:text-[#403833]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LeadTimeDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initial = useMemo(() => parseLeadTimeParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  // filteredLines already applies the global Supplier/Category/Channel filters (see useFilters.ts) —
  // this page only adds its own Period (Weeks/Months/Quarters) + From/To window on top, since no
  // global equivalent exists for that.
  const { filters, setFilters, filteredLines, allSuppliers, curWeek, curYear } = useFilters(allLines, initial.filters);

  const [tab, setTab] = useState<LTTab>(initial.tab);
  const [period, setPeriod] = useState<LTPeriod>(initial.period);
  const [heatmapRows, setHeatmapRows] = useState<LTHeatmapRows>(initial.heatmapRows);
  const [heatmapPOs, setHeatmapPOs] = useState<LTPOSet>(initial.heatmapPOs);
  const [skuGroups, setSkuGroups] = useState<string[]>([]);
  const [skuVariations, setSkuVariations] = useState<string[]>([]);
  const [skuQuery, setSkuQuery] = useState('');
  const [drill, setDrill] = useState<DrillSelection | null>(null);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [chartViewData, setChartViewData] = useState(false);

  const isModeB = filters.suppliers.length === 1;
  const selectedSupplier = isModeB ? filters.suppliers[0] : null;

  // the heatmap's Supplier row-dimension is meaningless once we're already looking at one supplier
  useEffect(() => {
    if (isModeB && heatmapRows === 'Supplier') setHeatmapRows('Category');
  }, [isModeB, heatmapRows]);

  useEffect(() => {
    const params = buildLeadTimeParams({
      filters, tab, period, channel: 'All', view: isModeB ? 'Supplier' : 'General',
      viewCategory: filters.categories[0] ?? 'Mattresses', viewSupplier: selectedSupplier, heatmapRows, heatmapPOs,
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tab, period, heatmapRows, heatmapPOs, pathname, isModeB, selectedSupplier]);

  const categories: SKUCategory[] = filters.categories.length ? filters.categories : SKU_CATEGORIES;
  const scopedLines = filteredLines;

  // default window: 12 periods back through 4 ahead of the last completed week — same forward
  // horizon used by the other drill-down pages, just expressed in whatever period granularity is active
  const buckets = useMemo(() => {
    const { week, year } = lastCompletedWeek();
    const from = shiftISOWeek(week, year, -12);
    const to = shiftISOWeek(week, year, 4);
    return buildBuckets(weekRangeFor(from.week, from.year).start, weekRangeFor(to.week, to.year).end, period);
  }, [period]);

  const overview = useMemo(() => computeOverviewSeries(scopedLines, buckets, period, categories), [scopedLines, buckets, period, categories]);
  const kpis = useMemo(() => computeLTKpis(overview), [overview]);
  const heatmap = useMemo(() => computeHeatmap(scopedLines, buckets, period, heatmapRows, heatmapPOs), [scopedLines, buckets, period, heatmapRows, heatmapPOs]);
  const periodsSummary = useMemo(() => computePeriodsSummary(scopedLines, buckets, period), [scopedLines, buckets, period]);

  const latestCompletedBucket = useMemo(() => {
    const withData = periodsSummary.filter((p) => p.poCount > 0);
    return withData.length ? buckets.find((b) => b.key === withData[withData.length - 1].bucketKey) ?? null : null;
  }, [periodsSummary, buckets]);
  const distribution = useMemo(
    () => (latestCompletedBucket ? computeLeadTimeDistribution(scopedLines, latestCompletedBucket, period) : null),
    [scopedLines, latestCompletedBucket, period]
  );

  const skuBase = scopedLines;
  const skuGroupOptions = useMemo(() => [...new Set(skuBase.map((l) => skuGroupOf(l.sku)))].sort(), [skuBase]);
  const skuVariationOptions = useMemo(() => [...new Set(skuBase.map((l) => skuVariationOf(l.sku)))].sort(), [skuBase]);

  const skuScopes = useMemo(() => {
    const q = skuQuery.trim().toUpperCase();
    if (q) {
      const lines = skuBase.filter((l) => { const s = l.sku.toUpperCase(); return s === q || s.startsWith(q); });
      return [{ title: `SKU ${skuQuery.trim()}`, subtitle: `${lines.length.toLocaleString()} lines matched`, categoryBadge: undefined, lines }];
    }
    const vset = skuVariations.length ? new Set(skuVariations) : null;
    return skuGroups.map((g) => {
      const lines = skuBase.filter((l) => skuGroupOf(l.sku) === g && (!vset || vset.has(skuVariationOf(l.sku))));
      const cat = lines.length ? categorizeSKU(lines[0].sku) : undefined;
      return {
        title: g,
        subtitle: `${lines.length.toLocaleString()} lines${vset ? ` (variations: ${skuVariations.join(', ')})` : ''}`,
        categoryBadge: cat,
        lines,
      };
    });
  }, [skuBase, skuQuery, skuGroups, skuVariations]);

  const exportOverviewExcel = () => {
    const rows: (string | number)[][] = [['Period', 'Overall Lead Time (d)', ...categories]];
    overview.forEach((p) => rows.push([p.label, p.overall ?? '—', ...categories.map((c) => p.byCategory[c] ?? '—')]));
    downloadWorkbook('Lead Time Evolution', [{ name: 'Lead Time Evolution', rows }]);
  };

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
    <div className="min-h-screen w-full bg-[#f5f2ee] flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Lead Time Detail' }]}
          filters={filters}
          onChange={setFilters}
          allSuppliers={allSuppliers}
          curWeek={curWeek}
          curYear={curYear}
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

        <div className="px-5 pt-3 flex items-center justify-between border-b border-[#e9e3df] flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {([['overview', 'Lead Time Overview'], ['sku', isModeB ? 'Product Analysis' : 'SKU & Supplier Analysis']] as [LTTab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setDrill(null); }}
                className={`text-sm font-semibold px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                  tab === key ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-wrap items-end justify-between gap-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex flex-wrap items-end gap-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Period</span>
                <Seg options={[{ value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' }, { value: 'quarters', label: 'Quarters' }]} value={period} onChange={setPeriod} />
              </div>
            </div>
            <p className="text-[11px] text-[#9c9794]">
              Lead time = Actual Ship Date (latest across PO lines) − Order Date
            </p>
          </div>

          {tab === 'overview' ? (
            <>
              <LeadTimeKpiStrip kpis={kpis} />

              <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-[#403833]">Lead Time Evolution{selectedSupplier ? ` — ${selectedSupplier}` : ''}</p>
                    <p className="text-[11px] text-[#9c9794]">Average lead time (days) per {period === 'weeks' ? 'week' : period === 'months' ? 'month' : 'quarter'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setChartViewData(true)} className="text-xs font-semibold text-[#403833] border border-[#e9e3df] rounded-lg px-2.5 py-1.5 hover:border-[#403833] transition-colors">View data</button>
                    <button onClick={() => setChartExpanded(true)} title="Expand chart" aria-label="Expand chart" className="text-[#9c9794] hover:text-[#403833] transition-colors">
                      <Maximize2 size={15} />
                    </button>
                  </div>
                </div>
                <LeadTimeTrendChart
                  points={overview}
                  categories={categories}
                  onBarClick={(bucketKey, category) => {
                    const bucket = buckets.find((b) => b.key === bucketKey);
                    if (!bucket) return;
                    setDrill({ title: `${category} — ${bucket.label}`, rows: computeDrillRows(scopedLines, bucket, period, { by: 'Category', value: category }) });
                  }}
                />
                <p className="text-[11px] text-[#9c9794] mt-2">Click a bar to view the underlying POs.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <LeadTimeInsights kpis={kpis} overview={overview} categories={categories} contextLabel={selectedSupplier ?? ''} />
                {distribution && <LeadTimeDistribution distribution={distribution} />}
              </div>

              <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div className="flex flex-wrap items-end gap-5">
                    {!isModeB && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Rows</span>
                        <Seg options={[{ value: 'Category', label: 'Category' }, { value: 'Supplier', label: 'Supplier' }]} value={heatmapRows} onChange={setHeatmapRows} />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">PO Set</span>
                      <Seg options={[{ value: 'all', label: 'All POs' }, { value: 'delayed', label: 'Delayed POs only' }]} value={heatmapPOs} onChange={setHeatmapPOs} />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#403833]">Lead Time vs Target ({LT_TARGET_DAYS}d)</p>
                  <p className="text-[11px] text-[#9c9794]">Difference to target in days. Negative = better than target.</p>
                </div>
                <LeadTimeHeatmap
                  data={heatmap}
                  buckets={buckets}
                  onSelectCell={(bucketKey, rowKey) => {
                    const bucket = buckets.find((b) => b.key === bucketKey);
                    if (!bucket) return;
                    setDrill({ title: `${rowKey} — ${bucket.label}`, rows: computeDrillRows(scopedLines, bucket, period, { by: heatmapRows, value: rowKey }) });
                  }}
                />
              </div>

              <LeadTimeRecentPeriods
                periods={periodsSummary}
                getDrillRows={(bucketKey) => {
                  const bucket = buckets.find((b) => b.key === bucketKey);
                  return bucket ? computeDrillRows(scopedLines, bucket, period) : [];
                }}
              />
            </>
          ) : (
            <>
              <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-wrap items-end gap-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <MultiCheckDropdown label="SKU Group (first 5)" emptyLabel="Select SKU groups" options={skuGroupOptions} selected={skuGroups} onChange={setSkuGroups} />
                <MultiCheckDropdown label="SKU Variation (last 3)" emptyLabel="All variations" options={skuVariationOptions} selected={skuVariations} onChange={setSkuVariations} />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Specific SKU (overrides above)</span>
                  <input value={skuQuery} onChange={(e) => setSkuQuery(e.target.value)} placeholder="e.g. EMAHE140200AAA" className="text-sm border border-[#e9e3df] rounded-lg px-3 py-2 min-w-[220px]" />
                </div>
              </div>

              {skuScopes.length === 0 ? (
                <div className="bg-white rounded-lg border border-[#e9e3df] p-6 text-center text-sm text-[#9c9794]" style={{ boxShadow: 'var(--shadow-card)' }}>
                  Pick one or more SKU groups (or type a specific SKU) to analyze {isModeB ? `${selectedSupplier}'s products` : 'products across suppliers'}.
                </div>
              ) : (
                skuScopes.map((scope) => (
                  <LeadTimeSkuPanel
                    key={scope.title}
                    title={scope.title}
                    subtitle={scope.subtitle}
                    categoryBadge={scope.categoryBadge}
                    lines={scope.lines}
                    buckets={buckets}
                    period={period}
                    onBarClick={(bucketKey, supplier) => {
                      const bucket = buckets.find((b) => b.key === bucketKey);
                      if (!bucket) return;
                      setDrill({ title: `${scope.title} — ${supplier} — ${bucket.label}`, rows: computeDrillRows(scope.lines, bucket, period, { by: 'Supplier', value: supplier }) });
                    }}
                  />
                ))
              )}
            </>
          )}

          {drill && <LeadTimeDrillPanel title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} />}
        </div>
      </div>

      {chartExpanded && (
        <LargeModal title={`Lead Time Evolution${selectedSupplier ? ` — ${selectedSupplier}` : ''}`} onClose={() => setChartExpanded(false)}>
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
            <div style={{ height: '70vh' }}>
              <LeadTimeTrendChart
                points={overview}
                categories={categories}
                onBarClick={(bucketKey, category) => {
                  const bucket = buckets.find((b) => b.key === bucketKey);
                  if (!bucket) return;
                  setDrill({ title: `${category} — ${bucket.label}`, rows: computeDrillRows(scopedLines, bucket, period, { by: 'Category', value: category }) });
                  setChartExpanded(false);
                }}
              />
            </div>
          </div>
        </LargeModal>
      )}

      {chartViewData && (
        <LargeModal
          title="Lead Time Evolution — Data"
          onClose={() => setChartViewData(false)}
          rightActions={
            <button onClick={exportOverviewExcel} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors">
              <Download size={13} /> Export Excel
            </button>
          }
        >
          <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#403833] text-white">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Period</th>
                  <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide">Overall</th>
                  {categories.map((c) => <th key={c} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {overview.map((p) => (
                  <tr
                    key={p.bucketKey}
                    onClick={() => {
                      const bucket = buckets.find((b) => b.key === p.bucketKey);
                      if (!bucket) return;
                      setDrill({ title: p.label, rows: computeDrillRows(scopedLines, bucket, period) });
                      setChartViewData(false);
                    }}
                    className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6] cursor-pointer"
                  >
                    <td className="px-3 py-2 font-semibold text-[#403833]">{p.label}</td>
                    <td className="px-3 py-2 text-center text-[#403833]">{p.overall ?? '—'}</td>
                    {categories.map((c) => <td key={c} className="px-3 py-2 text-center text-[#58524e]">{p.byCategory[c] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LargeModal>
      )}
    </div>
  );
}
