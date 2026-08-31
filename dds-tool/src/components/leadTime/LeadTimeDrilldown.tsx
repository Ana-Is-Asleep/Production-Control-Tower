'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { getChannel } from '../../lib/channelUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { lastCompletedWeek, shiftISOWeek, weekRangeFor } from '../../lib/dateUtils';
import { formatFilterSummary } from '../../lib/filterSummary';
import {
  parseLeadTimeParams, buildLeadTimeParams, type LTTab, type LTChannel,
} from '../../lib/leadTimeParams';
import {
  buildBuckets, computeOverviewSeries, computeLTKpis, computeHeatmap, computeDrillRows,
  skuGroupOf, skuVariationOf, type LTPeriod, type LTView, type LTHeatmapRows, type LTPOSet, type DrillRow,
} from '../../lib/leadTimeAnalytics';
import { LeadTimeKpiStrip } from './LeadTimeKpiStrip';
import { LeadTimeTrendChart } from './LeadTimeTrendChart';
import { LeadTimeHeatmap } from './LeadTimeHeatmap';
import { LeadTimeSkuPanel } from './LeadTimeSkuPanel';
import { LeadTimeDrillPanel } from './LeadTimeDrillPanel';
import { MultiCheckDropdown } from './MultiCheckDropdown';
import type { PurchaseLine } from '../../types';

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

  // read-only: inherits the dashboard's Supplier/Category filters; Week Range and Channel are
  // ignored here — this page manages its own date range and its own Channel toggle
  const { filters, filteredLines, allSuppliers } = useFilters(allLines, initial.filters);

  const [tab, setTab] = useState<LTTab>(initial.tab);
  const [period, setPeriod] = useState<LTPeriod>(initial.period);
  const [channel, setChannel] = useState<LTChannel>(initial.channel);
  const [view, setView] = useState<LTView>(initial.view);
  const [viewCategory, setViewCategory] = useState<SKUCategory>(initial.viewCategory);
  const [viewSupplier, setViewSupplier] = useState<string | null>(initial.viewSupplier);
  const [heatmapRows, setHeatmapRows] = useState<LTHeatmapRows>(initial.heatmapRows);
  const [heatmapPOs, setHeatmapPOs] = useState<LTPOSet>(initial.heatmapPOs);
  const [skuGroups, setSkuGroups] = useState<string[]>([]);
  const [skuVariations, setSkuVariations] = useState<string[]>([]);
  const [skuQuery, setSkuQuery] = useState('');
  const [drill, setDrill] = useState<DrillSelection | null>(null);

  useEffect(() => {
    const params = buildLeadTimeParams({ filters, tab, period, channel, view, viewCategory, viewSupplier, heatmapRows, heatmapPOs });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tab, period, channel, view, viewCategory, viewSupplier, heatmapRows, heatmapPOs, pathname]);

  const channelScoped = useMemo(
    () => (channel === 'All' ? filteredLines : filteredLines.filter((l) => getChannel(l.destination) === channel)),
    [filteredLines, channel]
  );

  // default window: 12 weeks back through 4 weeks ahead of the last completed week — same
  // forward horizon used by the other drill-down pages
  const buckets = useMemo(() => {
    const { week, year } = lastCompletedWeek();
    const from = shiftISOWeek(week, year, -12);
    const to = shiftISOWeek(week, year, 4);
    return buildBuckets(weekRangeFor(from.week, from.year).start, weekRangeFor(to.week, to.year).end, period);
  }, [period]);

  const isSingleSupplier = view === 'Supplier';
  const resolvedSupplier = viewSupplier ?? allSuppliers[0] ?? null;

  const { scopedLines, categories }: { scopedLines: PurchaseLine[]; categories: SKUCategory[] } = useMemo(() => {
    if (view === 'Category') {
      return { scopedLines: channelScoped.filter((l) => categorizeSKU(l.sku) === viewCategory), categories: [viewCategory] };
    }
    if (view === 'Supplier') {
      const lines = resolvedSupplier ? channelScoped.filter((l) => l.supplier === resolvedSupplier) : [];
      const present = new Set(lines.map((l) => categorizeSKU(l.sku)));
      return { scopedLines: lines, categories: SKU_CATEGORIES.filter((c) => present.has(c)) };
    }
    return { scopedLines: channelScoped, categories: SKU_CATEGORIES };
  }, [channelScoped, view, viewCategory, resolvedSupplier]);

  const overview = useMemo(() => computeOverviewSeries(scopedLines, buckets, period, categories), [scopedLines, buckets, period, categories]);
  const kpis = useMemo(() => computeLTKpis(overview), [overview]);
  const heatmap = useMemo(() => computeHeatmap(scopedLines, buckets, period, heatmapRows, heatmapPOs), [scopedLines, buckets, period, heatmapRows, heatmapPOs]);

  const skuBase = channelScoped;
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

  const filterSummary = formatFilterSummary(filters);

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
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-[#403833] hover:text-brand transition-colors shrink-0">
          <span>←</span> Overview
        </Link>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">Production Lead Time</span>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-xs text-[#7b7571] truncate">Filtered by: {filterSummary}</span>
        <div className="flex-1" />
        <Seg options={[{ value: 'overview', label: 'Lead Time Overview' }, { value: 'sku', label: 'SKU Group vs Suppliers' }]} value={tab} onChange={(v) => { setTab(v); setDrill(null); }} />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-wrap items-end gap-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Period</span>
            <Seg options={[{ value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' }, { value: 'quarters', label: 'Quarters' }]} value={period} onChange={setPeriod} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Channel</span>
            <Seg options={[{ value: 'All', label: 'All' }, { value: 'Online', label: 'Online' }, { value: 'Offline', label: 'Offline' }]} value={channel} onChange={setChannel} />
          </div>
          {tab === 'overview' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">View</span>
                <Seg options={[{ value: 'General', label: 'General' }, { value: 'Category', label: 'Category' }, { value: 'Supplier', label: 'Supplier' }]} value={view} onChange={setView} />
              </div>
              {view === 'Category' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Category</span>
                  <select value={viewCategory} onChange={(e) => setViewCategory(e.target.value as SKUCategory)} className="text-sm border border-[#e9e3df] rounded-lg px-3 py-2 min-w-[180px]">
                    {SKU_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {view === 'Supplier' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Supplier</span>
                  <select value={resolvedSupplier ?? ''} onChange={(e) => setViewSupplier(e.target.value)} className="text-sm border border-[#e9e3df] rounded-lg px-3 py-2 min-w-[220px]">
                    {allSuppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {tab === 'overview' ? (
          <>
            <LeadTimeKpiStrip kpis={kpis} />

            <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <LeadTimeTrendChart
                points={overview}
                categories={categories}
                onBarClick={(bucketKey, category) => {
                  const bucket = buckets.find((b) => b.key === bucketKey);
                  if (!bucket) return;
                  setDrill({ title: `${category} — ${bucket.label}`, rows: computeDrillRows(scopedLines, bucket, period, { by: 'Category', value: category }) });
                }}
              />
            </div>

            <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex flex-wrap items-end gap-5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Heatmap Rows</span>
                  <Seg options={[{ value: 'Category', label: 'Category' }, { value: 'Supplier', label: 'Supplier' }]} value={heatmapRows} onChange={setHeatmapRows} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Heatmap PO Set</span>
                  <Seg options={[{ value: 'all', label: 'All POs' }, { value: 'delayed', label: 'Delayed POs' }]} value={heatmapPOs} onChange={setHeatmapPOs} />
                </div>
              </div>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] pt-1">Heatmap · Lead Time vs 30-Day Target</p>
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
                Pick one or more SKU groups (or type a specific SKU) to compare suppliers.
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
  );
}
