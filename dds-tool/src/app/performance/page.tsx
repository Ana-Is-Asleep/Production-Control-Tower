'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { NavTabs } from '../../components/shared/NavTabs';
import { Seg } from '../../components/shared/Seg';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import {
  ComposedChart, Bar, Line, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI, computeExpectedSOT, aggregateSOTRate } from '../../lib/kpiFormulas';
import { categorizeSKU } from '../../lib/skuUtils';
import { formatDateShort, getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

const REASON_LABELS: Record<string, string> = {
  supplier_delay: 'Supplier delay', capacity_constraints: 'Capacity constraints',
  material_shortage: 'Material shortage', quality_issues: 'Quality issues',
  documentation_issue: 'Documentation issue', transit_delay: 'Transit delay',
  booking_not_made: 'Booking not made', data_issue: 'Data issue', other: 'Other',
};

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6469aa', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

type GroupBy = 'supplier' | 'po' | 'line';
type DrillView = 'backlog' | 'detail';
type BacklogTab = 'critical' | 'recent' | 'future-backlog';

function clearWeekLabel(l: PurchaseLine): string | null {
  if (!l.esd) return null;
  return `W${String(getISOWeek(l.esd)).padStart(2, '0')}`;
}

function statusBadge(l: PurchaseLine) {
  const kpi = computeKPI(l);
  if (l.asd) {
    return kpi.sotResult
      ? <span className="text-[10px] font-medium text-pass bg-[#dcfce7] px-2 py-0.5 rounded-full">Shipped on time</span>
      : <span className="text-[10px] font-medium text-fail bg-[#fee2e2] px-2 py-0.5 rounded-full">Late</span>;
  }
  const clears = clearWeekLabel(l);
  return <span className="text-[10px] font-medium text-warn bg-[#fef3c7] px-2 py-0.5 rounded-full">
    Backlog{clears ? ` — clears ${clears}` : ' — no booking'}
  </span>;
}

function otifBadge(l: PurchaseLine) {
  const kpi = computeKPI(l);
  if (kpi.otif === null) return <span className="text-[#b5aaa5]">—</span>;
  return kpi.otif
    ? <span className="text-[10px] font-medium text-pass bg-[#dcfce7] px-2 py-0.5 rounded-full">Yes</span>
    : <span className="text-[10px] font-medium text-fail bg-[#fee2e2] px-2 py-0.5 rounded-full">No</span>;
}

function VendorDropdown({ vendors, selected, onChange, align = 'right' }: { vendors: string[]; selected: string[]; onChange: (v: string[]) => void; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const label = selected.length === 0 ? 'All vendors' : selected.length === 1 ? selected[0] : `${selected.length} vendors`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium ${selected.length > 0 ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}>
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="opacity-40 text-[10px]">▾</span>
      </button>
      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-64 py-1 max-h-64 overflow-y-auto`} style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#58524e] hover:bg-[#f9f7f6]'}`}>
            All vendors {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#e9e3df] my-1" />
          {vendors.map((v) => (
            <button key={v} onClick={() => toggle(v)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#f9f7f6]">
              <span className={selected.includes(v) ? 'text-[#403833] font-medium' : 'text-[#58524e]'}>{v}</span>
              {selected.includes(v) && <span className="text-brand">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[10px] uppercase tracking-widest text-[#b5aaa5] font-semibold shrink-0">{children}</span>
      <div className="flex-1 h-px bg-[#e9e3df]" />
    </div>
  );
}

function BacklogTable({ lines }: { lines: PurchaseLine[] }) {
  if (lines.length === 0) return (
    <div className="text-center py-10 text-[#b5aaa5] text-sm">No POs match the current filters</div>
  );
  const grouped = useMemo(() => {
    const map = new Map<string, { lines: PurchaseLine[]; categories: Set<SKUCategory> }>();
    lines.forEach((l) => {
      if (!map.has(l.po)) map.set(l.po, { lines: [], categories: new Set() });
      const g = map.get(l.po)!;
      g.lines.push(l);
      g.categories.add(categorizeSKU(l.sku));
    });
    return [...map.entries()].map(([po, g]) => ({
      po, vendor: g.lines[0].supplier, destination: g.lines[0].destination,
      pgrd: g.lines[0].pgrd, esd: g.lines.find(l => l.esd)?.esd ?? null,
      lineCount: g.lines.length, categories: [...g.categories],
      hasNoEsd: g.lines.some(l => !l.esd),
    }));
  }, [lines]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#403833] text-white">
            {['PO', 'Category', 'Vendor', 'Destination', 'PGRD', 'ESD', 'Lines'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map((g) => (
            <tr key={g.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors">
              <td className="px-4 py-2.5 font-semibold text-[#403833] whitespace-nowrap">{g.po}</td>
              <td className="px-4 py-2.5">
                <div className="flex gap-1 flex-wrap">
                  {g.categories.map((c) => (
                    <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[c] }}>{c}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 text-[#58524e]">{g.vendor}</td>
              <td className="px-4 py-2.5 text-[#58524e]">{g.destination}</td>
              <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateShort(g.pgrd)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {g.hasNoEsd
                  ? <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">No ESD</span>
                  : <span className="text-[#58524e]">{formatDateShort(g.esd)}</span>}
              </td>
              <td className="px-4 py-2.5 text-[#7b7571] text-xs">{g.lineCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PerformancePage() {
  const { allLines, annotations, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);

  // ── SOT+OTIF state ─────────────────────────────────────────────────────────
  const [_groupBy, setGroupBy] = useState<GroupBy>('supplier');
  const [sotVendors, setSotVendors] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [clickedWeek, setClickedWeek] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<DrillView>('backlog');

  // ── Backlog state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<BacklogTab>('critical');
  const [backlogVendors, setBacklogVendors] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SKUCategory[]>([]);

  const { critical, recent, futureBacklog } = kpis.backlogSummary;

  // ── SOT+OTIF derived ────────────────────────────────────────────────────────
  const handleChartClick = (data: Record<string, unknown>) => {
    if (data?.activeLabel) {
      const label = String(data.activeLabel);
      setClickedWeek(prev => prev === label ? null : label);
      setExpandedVendor(null);
    }
  };

  const sourceLines = useMemo(() => {
    if (clickedWeek) {
      const weekNum = parseInt(clickedWeek.replace('W', ''));
      return (allD2cLines ?? weeklyLines).filter(l => l.pgrd && getISOWeek(l.pgrd) === weekNum);
    }
    return weeklyLines;
  }, [weeklyLines, allD2cLines, clickedWeek]);

  const filteredLines = useMemo(() => {
    let lines = sotVendors.length === 0 ? sourceLines : sourceLines.filter(l => sotVendors.includes(l.supplier));
    if (selectedCat !== 'All') lines = lines.filter(l => categorizeSKU(l.sku) === selectedCat);
    return lines;
  }, [sourceLines, sotVendors, selectedCat]);

  const enriched = useMemo(() => filteredLines.map(l => ({ line: l, kpi: computeKPI(l), expectedSot: computeExpectedSOT(l) })), [filteredLines]);

  const allSotVendors = useMemo(() => [...new Set(weeklyLines.map(l => l.supplier))].sort(), [weeklyLines]);

  const bySupplier = useMemo(() => {
    const map = new Map<string, { pos: Set<string>; sotPass: number; sotEval: number; otifPass: number; otifEval: number; failingLines: PurchaseLine[] }>();
    enriched.forEach(({ line, kpi }) => {
      const s = line.supplier;
      if (!map.has(s)) map.set(s, { pos: new Set(), sotPass: 0, sotEval: 0, otifPass: 0, otifEval: 0, failingLines: [] });
      const e = map.get(s)!;
      e.pos.add(line.po);
      if (kpi.sotResult !== null) { e.sotEval++; if (kpi.sotResult) e.sotPass++; }
      if (kpi.otif !== null) { e.otifEval++; if (kpi.otif) e.otifPass++; }
      if (kpi.sotFail || kpi.otifFail) e.failingLines.push(line);
    });
    return [...map.entries()].map(([supplier, v]) => ({
      supplier, poCount: v.pos.size,
      sotPct: v.sotEval > 0 ? Math.round(v.sotPass / v.sotEval * 100) : null,
      otifPct: v.otifEval > 0 ? Math.round(v.otifPass / v.otifEval * 100) : null,
      failingLines: v.failingLines,
    })).sort((a, b) => (a.sotPct ?? 100) - (b.sotPct ?? 100));
  }, [enriched]);

  const byPO = useMemo(() => {
    const map = new Map<string, { lines: PurchaseLine[]; sotPass: number; sotEval: number; otifPass: number; otifEval: number }>();
    enriched.forEach(({ line, kpi }) => {
      if (!map.has(line.po)) map.set(line.po, { lines: [], sotPass: 0, sotEval: 0, otifPass: 0, otifEval: 0 });
      const e = map.get(line.po)!;
      e.lines.push(line);
      if (kpi.sotResult !== null) { e.sotEval++; if (kpi.sotResult) e.sotPass++; }
      if (kpi.otif !== null) { e.otifEval++; if (kpi.otif) e.otifPass++; }
    });
    return [...map.entries()].map(([po, v]) => ({
      po, supplier: v.lines[0]?.supplier ?? '', destination: v.lines[0]?.destination ?? '',
      lineCount: v.lines.length,
      reqQty: v.lines.reduce((s, l) => s + l.qty, 0),
      cqty: v.lines.reduce((s, l) => s + l.cqty, 0),
      pgrd: v.lines[0]?.pgrd,
      asd: v.lines.some(l => l.asd) ? v.lines.find(l => l.asd)?.asd ?? null : null,
      esd: v.lines.some(l => l.esd) ? v.lines.find(l => l.esd)?.esd ?? null : null,
      sotPct: v.sotEval > 0 ? Math.round(v.sotPass / v.sotEval * 100) : null,
      otifPct: v.otifEval > 0 ? Math.round(v.otifPass / v.otifEval * 100) : null,
      lines: v.lines,
    }));
  }, [enriched]);

  const groupBy: GroupBy = bySupplier.length <= 1 ? 'line' : _groupBy;

  const chartData = useMemo(() => {
    const trend = sotVendors.length === 0 ? kpis.weeklyTrend : kpis.weeklyTrend.map(w => {
      const wLines = accumulatingLines.filter(l =>
        sotVendors.includes(l.supplier) && l.pgrd && getISOWeek(l.pgrd) === parseInt(w.weekLabel.replace('W', ''))
      );
      if (!wLines.length) return { ...w, sotPct: null, otifPct: null };
      const ks = wLines.map(computeKPI);
      const sot = ks.filter(k => k.sotResult !== null);
      const otif = ks.filter(k => k.otif !== null);
      return {
        ...w,
        sotPct: sot.length ? Math.round(sot.filter(k => k.sotResult).length / sot.length * 100) : null,
        otifPct: otif.length ? Math.round(otif.filter(k => k.otif).length / otif.length * 100) : null,
      };
    });
    return trend.map(w => ({
      ...w,
      sotPctSolid:  !w.isFuture ? w.sotPct  : null,
      sotPctDash:   (w.isFuture || w.isCurrent) ? w.sotPct  : null,
      otifPctSolid: !w.isFuture ? w.otifPct : null,
      otifPctDash:  (w.isFuture || w.isCurrent) ? w.otifPct : null,
    }));
  }, [kpis.weeklyTrend, sotVendors, accumulatingLines]);

  const today = useMemo(() => new Date(), []);

  const filteredSotPct = useMemo(() =>
    aggregateSOTRate(filteredLines, today) ?? kpis.sotPct,
    [filteredLines, today, kpis.sotPct]
  );

  const filteredOtifPct = useMemo(() => {
    const ev = enriched.filter(r => r.kpi.otif !== null);
    return ev.length > 0 ? Math.round(ev.filter(r => r.kpi.otif).length / ev.length * 100) : kpis.otifPct;
  }, [enriched, kpis.otifPct]);

  const annotatedFailing = useMemo(() =>
    kpis.failingLines.filter(l => !!annotations[`${l.po}-${l.line}`]?.reason),
    [kpis.failingLines, annotations]
  );
  const unannotatedCount = kpis.failingLines.length - annotatedFailing.length;

  const backlogDetail = useMemo(() => {
    if (!clickedWeek) return null;
    const weekNum = parseInt(clickedWeek.replace('W', ''));
    const wasUnshippedAsOf = (l: PurchaseLine) => !l.asd || getISOWeek(l.asd) > weekNum || getISOWeekYear(l.asd) > lastYear;
    const allSrc = allD2cLines ?? accumulatingLines;
    const groupBySupplier = (lines: PurchaseLine[]) => {
      const map = new Map<string, Set<string>>();
      lines.forEach(l => { if (!map.has(l.supplier)) map.set(l.supplier, new Set()); map.get(l.supplier)!.add(l.po); });
      return [...map.entries()].map(([supplier, pos]) => ({ supplier, pos: [...pos] })).sort((a, b) => b.pos.length - a.pos.length);
    };
    const weekBacklogLines = allSrc.filter(l =>
      l.pgrd && getISOWeek(l.pgrd) === weekNum && getISOWeekYear(l.pgrd) === lastYear && wasUnshippedAsOf(l)
    );
    const pastBacklogLines = allSrc.filter(l =>
      l.pgrd && l.pgrd.getFullYear() >= 2026 &&
      (getISOWeekYear(l.pgrd) < lastYear || (getISOWeekYear(l.pgrd) === lastYear && getISOWeek(l.pgrd) < weekNum)) &&
      wasUnshippedAsOf(l)
    );
    return {
      weekGroups: groupBySupplier(weekBacklogLines),
      pastGroups: groupBySupplier(pastBacklogLines),
      totalWeek: new Set(weekBacklogLines.map(l => l.po)).size,
      totalPast: new Set(pastBacklogLines.map(l => l.po)).size,
    };
  }, [clickedWeek, allD2cLines, accumulatingLines, lastYear]);

  // ── Backlog derived ─────────────────────────────────────────────────────────
  const allBacklogLines = [...critical, ...recent, ...futureBacklog];
  const allBacklogVendors = useMemo(() => [...new Set(allBacklogLines.map((l) => l.supplier))].sort(), [critical, recent, futureBacklog]);
  const distinctPOs = (lines: PurchaseLine[]) => new Set(lines.map((l) => l.po)).size;
  const toggleCat = (c: SKUCategory) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const applyBacklogFilters = (lines: PurchaseLine[]) => {
    let result = lines;
    if (backlogVendors.length > 0) result = result.filter(l => backlogVendors.includes(l.supplier));
    if (selectedCategories.length > 0) result = result.filter(l => selectedCategories.includes(categorizeSKU(l.sku)));
    return result;
  };

  const tabLines = applyBacklogFilters(activeTab === 'critical' ? critical : activeTab === 'recent' ? recent : futureBacklog);

  const backlogChartData = useMemo(() => {
    const map = new Map<string, { critical: number; recent: number; futureBacklog: number }>();
    [...critical, ...recent, ...futureBacklog].forEach((l) => {
      if (!map.has(l.supplier)) map.set(l.supplier, { critical: 0, recent: 0, futureBacklog: 0 });
      const e = map.get(l.supplier)!;
      if (critical.includes(l)) e.critical++;
      else if (recent.includes(l)) e.recent++;
      else e.futureBacklog++;
    });
    return [...map.entries()]
      .map(([vendor, v]) => ({ vendor: vendor.split(' ')[0], ...v, total: v.critical + v.recent + v.futureBacklog }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [critical, recent, futureBacklog]);

  const backlogTabs = [
    { key: 'critical' as BacklogTab, label: 'Critical', count: distinctPOs(applyBacklogFilters(critical)), total: distinctPOs(critical), color: 'text-fail', dot: 'bg-fail', border: 'border-fail' },
    { key: 'recent'   as BacklogTab, label: 'Recent',   count: distinctPOs(applyBacklogFilters(recent)),   total: distinctPOs(recent),   color: 'text-warn', dot: 'bg-warn', border: 'border-warn' },
    { key: 'future-backlog' as BacklogTab, label: 'Future Backlog', count: distinctPOs(applyBacklogFilters(futureBacklog)), total: distinctPOs(futureBacklog), color: 'text-brand', dot: 'bg-brand', border: 'border-brand' },
  ];
  const noEsdLines = allBacklogLines.filter(l => !l.esd);
  const noEsdPOs = new Set(noEsdLines.map(l => l.po)).size;

  return (
    <div className="min-h-screen bg-[#f5f2ee] page-enter">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-bold text-brand text-xl shrink-0 tracking-tight">emma<span className="text-[#403833]">.</span></span>
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        <div className="flex-1" />
        <VendorDropdown vendors={allSotVendors} selected={sotVendors} onChange={setSotVendors} />
        <span className="text-xs bg-[#f4f1ef] border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] font-medium shrink-0">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-4 space-y-4 max-w-6xl mx-auto">

        {/* ── SOT + OTIF SECTION ─────────────────────────────────────────────── */}
        <SectionLabel>SOT + OTIF</SectionLabel>

        {/* hero card */}
        <div className="bg-white rounded-xl border border-[#e9e3df] flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-2.5 border-b border-[#e9e3df] flex items-center gap-3">
            <span className="text-[10px] text-[#b5aaa5] font-semibold uppercase tracking-widest shrink-0">Category</span>
            <Seg
              options={[{ value: 'All', label: 'All categories' }, ...SKU_CATEGORIES.map(c => ({ value: c, label: c }))]}
              value={selectedCat}
              onChange={v => setSelectedCat(v as SKUCategory | 'All')}
            />
          </div>

          <div className="flex flex-1">
            <div className="flex flex-col justify-center gap-6 px-7 py-6 shrink-0" style={{ minWidth: 210 }}>
              {([
                { label: 'SOT', pct: filteredSotPct },
                { label: 'OTIF', pct: filteredOtifPct },
              ] as const).map(({ label, pct }) => {
                const onTarget = pct !== null && pct >= 90;
                const color = pct === null ? '#c8c0bb' : onTarget ? '#15803d' : '#dc2626';
                return (
                  <div key={label} className="flex items-stretch gap-3">
                    <div className="w-[3px] rounded-full shrink-0" style={{ background: color }} />
                    <div>
                      <p className="text-[11px] uppercase tracking-widest font-semibold mb-0.5" style={{ color }}>{label}</p>
                      <p className="font-extrabold text-5xl leading-none" style={{ color }}>
                        {pct !== null ? `${pct}%` : '—'}
                      </p>
                      {pct !== null && (
                        <p className="text-xs font-semibold mt-1.5" style={{ color }}>
                          {onTarget ? '↑' : '↓'} {Math.abs(pct - 90)}pp vs 90%
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-5 text-xs text-[#9c9794] pt-3 border-t border-[#e9e3df]">
                <div>
                  <p className="font-semibold text-[#403833] text-sm">{enriched.filter(r => r.kpi.sotResult !== null).length}</p>
                  <p>lines eval.</p>
                </div>
                {(() => {
                  const n = enriched.filter(r => r.kpi.sotFail || r.kpi.otifFail).length;
                  return (
                    <div>
                      <p className={`font-semibold text-sm ${n === 0 ? 'text-pass' : 'text-fail'}`}>{n}</p>
                      <p>failing</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="w-px bg-[#e9e3df] my-4 shrink-0" />

            <div className="flex-1 p-5 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">SOT & OTIF Trend — by PGRD Week</p>
                  <p className="text-[10px] text-[#b5aaa5] mt-0.5">↓ Click any bar or week label to drill down</p>
                </div>
                {clickedWeek && (
                  <button onClick={() => setClickedWeek(null)} className="text-xs text-[#9c9794] hover:text-fail transition-colors shrink-0">
                    Clear {clickedWeek} ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 mt-2">
                {[
                  { color: '#34A853', label: 'Shipped / Predicted on track' },
                  { color: '#F59E0B', label: 'This-week backlog' },
                  { color: '#DC2626', label: 'Accumulated backlog' },
                  { color: '#FF8900', label: 'SOT % (past — solid / future — dashed)', line: true },
                  { color: '#15803d', label: 'OTIF % (past — solid / future — dashed)', line: true, dashed: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    {item.line
                      ? <svg width="18" height="4" className="shrink-0"><line x1="0" y1="2" x2="18" y2="2" stroke={item.color} strokeWidth="2" strokeDasharray={item.dashed ? '5 3' : undefined} /></svg>
                      : <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
                    }
                    <span className="text-[10px] text-[#7b7571]">{item.label}</span>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 52, left: -10, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9e3df" vertical={false} />
                  <XAxis dataKey="weekLabel" tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="pos" tick={{ fill: '#9c9794', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'POs', angle: -90, position: 'insideLeft', fill: '#c8c0bb', fontSize: 10, dy: 20 }} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fill: '#9c9794', fontSize: 10 }} unit="%" axisLine={false} tickLine={false} />
                  <ReferenceLine yAxisId="pct" y={90} stroke="#c8c0bb" strokeDasharray="5 3" label={{ value: '90% target', position: 'insideTopRight', fill: '#c8c0bb', fontSize: 9 }} />
                  <Bar yAxisId="pos" dataKey="posPredictedSOT" stackId="pos" fill="#34A853" fillOpacity={0.72} name="Predicted on track"       radius={[0,0,0,0]} />
                  <Bar yAxisId="pos" dataKey="posShipped"      stackId="pos" fill="#34A853" fillOpacity={0.72} name="Shipped on time"          radius={[0,0,0,0]} />
                  <Bar yAxisId="pos" dataKey="posBacklog"      stackId="pos" fill="#F59E0B" fillOpacity={0.72} name="This-week backlog"        radius={[0,0,0,0]} />
                  <Bar yAxisId="pos" dataKey="pastPOBacklog"   stackId="pos" fill="#DC2626" fillOpacity={0.72} name="Accumulated past backlog" radius={[3,3,0,0]} />
                  <Line yAxisId="pct" dataKey="sotPctDash"  stroke="#FF8900" strokeWidth={2}   strokeDasharray="5 3" name="" connectNulls={false} dot={false} />
                  <Line yAxisId="pct" dataKey="otifPctDash" stroke="#15803d" strokeWidth={1.5} strokeDasharray="5 3" name="" connectNulls={false} dot={false} />
                  <Line
                    yAxisId="pct" dataKey="sotPctSolid" stroke="#FF8900" strokeWidth={2.5} name="SOT %" connectNulls={false} activeDot={{ r: 5 }}
                    dot={(p: { cx?: number; cy?: number; index?: number; value?: number }) => {
                      const cx = p.cx ?? 0; const cy = p.cy ?? 0;
                      const lastIdx = chartData.reduce((acc: number, d, i) => (d.sotPctSolid != null ? i : acc), -1);
                      return (
                        <g key={`sot-s-${p.index}`}>
                          <circle cx={cx} cy={cy} r={3} fill="#FF8900" />
                          {p.index === lastIdx && p.value != null && (
                            <text x={cx + 8} y={cy + 4} fill="#FF8900" fontSize={11} fontWeight={700}>{p.value}%</text>
                          )}
                        </g>
                      );
                    }}
                  />
                  <Line
                    yAxisId="pct" dataKey="otifPctSolid" stroke="#15803d" strokeWidth={2} name="OTIF %" connectNulls={false}
                    dot={(p: { cx?: number; cy?: number; index?: number; value?: number }) => {
                      const cx = p.cx ?? 0; const cy = p.cy ?? 0;
                      const lastIdx = chartData.reduce((acc: number, d, i) => (d.otifPctSolid != null ? i : acc), -1);
                      return (
                        <g key={`otif-s-${p.index}`}>
                          <circle cx={cx} cy={cy} r={3} fill="#15803d" />
                          {p.index === lastIdx && p.value != null && (
                            <text x={cx + 8} y={cy + 4} fill="#15803d" fontSize={11} fontWeight={700}>{p.value}%</text>
                          )}
                        </g>
                      );
                    }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#403833', border: 'none', borderRadius: 8, fontSize: 11, padding: '8px 12px' }}
                    labelStyle={{ color: '#ffa236', fontWeight: 700, marginBottom: 4 }}
                    itemStyle={{ color: '#f9f7f6' }}
                    formatter={(value, name) => {
                      const n = String(name);
                      if (!n) return [null, null];
                      return [n.includes('%') ? `${value}%` : `${value} POs`, n];
                    }}
                  />
                  {clickedWeek && (
                    <ReferenceArea yAxisId="pct" x1={clickedWeek} x2={clickedWeek} fill="rgba(255,137,0,0.12)" stroke="#FF8900" strokeOpacity={0.5} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* drill-down panel */}
        {clickedWeek && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e9e3df]" />
              <span className="text-[10px] uppercase tracking-widest text-[#b5aaa5] font-semibold">Breakdown</span>
              <div className="flex-1 h-px bg-[#e9e3df]" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-brand text-white text-xs font-bold px-3 py-1.5 rounded-full">{clickedWeek}</div>
                <Seg
                  options={[
                    { value: 'backlog', label: 'Backlog breakdown' },
                    { value: 'detail', label: 'SOT + OTIF detail' },
                  ]}
                  value={drillView}
                  onChange={v => setDrillView(v as DrillView)}
                />
                <p className="text-xs text-[#9c9794]">Showing data for {clickedWeek}</p>
              </div>

              {drillView === 'backlog' && backlogDetail && (backlogDetail.totalWeek > 0 || backlogDetail.totalPast > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {backlogDetail.totalWeek > 0 && (
                    <div className="bg-white rounded-lg p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" />
                        <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">This-week backlog — {clickedWeek}</p>
                      </div>
                      <p className="kpi-number font-extrabold text-5xl text-[#F59E0B] mb-4">{backlogDetail.totalWeek}</p>
                      <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                        {backlogDetail.weekGroups.map(g => (
                          <div key={g.supplier}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-[#403833]">{g.supplier}</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F59E0B] text-white">{g.pos.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {g.pos.map(po => <span key={po} className="text-[10px] text-[#7b7571] font-mono bg-[#f4f1ef] px-1.5 py-0.5 rounded">{po}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {backlogDetail.totalPast > 0 && (
                    <div className="bg-white rounded-lg p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
                        <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Accumulated past backlog — by {clickedWeek}</p>
                      </div>
                      <p className="kpi-number font-extrabold text-5xl text-[#DC2626] mb-4">{backlogDetail.totalPast}</p>
                      <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                        {backlogDetail.pastGroups.map(g => (
                          <div key={g.supplier}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-[#403833]">{g.supplier}</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DC2626] text-white">{g.pos.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {g.pos.map(po => <span key={po} className="text-[10px] text-[#7b7571] font-mono bg-[#f4f1ef] px-1.5 py-0.5 rounded">{po}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {drillView === 'backlog' && backlogDetail && backlogDetail.totalWeek === 0 && backlogDetail.totalPast === 0 && (
                <div className="bg-white rounded-lg p-4 text-center text-sm text-pass font-medium border border-[#e9e3df]">
                  ✓ No backlog for {clickedWeek}
                </div>
              )}

              {drillView === 'detail' && (
                <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="px-5 py-3 border-b border-[#f4f1ef]">
                    <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Line detail — {clickedWeek} ({filteredLines.length} lines)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#403833] text-white">
                          {['PO', 'Line', 'SKU', 'Vendor', 'Dest.', 'PGRD', 'ASD', 'ESD', 'Req Qty', 'Conf Qty', 'Status', 'OTIF'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLines.map(l => (
                          <tr key={`${l.po}-${l.line}`} className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6]">
                            <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{l.po}</td>
                            <td className="px-3 py-2 text-[#7b7571]">{l.line}</td>
                            <td className="px-3 py-2 font-mono text-[#58524e]">{l.sku}</td>
                            <td className="px-3 py-2 text-[#58524e] max-w-[120px] truncate">{l.supplier}</td>
                            <td className="px-3 py-2 text-[#58524e]">{l.destination}</td>
                            <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{formatDateShort(l.pgrd)}</td>
                            <td className="px-3 py-2 text-[#58524e] whitespace-nowrap">{l.asd ? formatDateShort(l.asd) : <span className="text-[#c8c0bb]">—</span>}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{l.esd ? formatDateShort(l.esd) : <span className="text-[10px] bg-[#fee2e2] text-fail px-1.5 py-0.5 rounded-full">No ESD</span>}</td>
                            <td className="px-3 py-2 text-right text-[#403833] font-medium">{l.qty.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-[#403833] font-medium">{l.cqty.toLocaleString()}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{statusBadge(l)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{otifBadge(l)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* breakdown table */}
        <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3 border-b border-[#f4f1ef] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">
                Breakdown — {clickedWeek ?? `W${String(lastWeek).padStart(2, '0')}`}
              </p>
              {clickedWeek && (
                <button onClick={() => setClickedWeek(null)} className="text-[10px] text-brand hover:text-brand-soft font-medium">Clear ✕</button>
              )}
            </div>
            <Seg
              options={[
                { value: 'supplier', label: 'By Vendor' },
                { value: 'po', label: 'By PO' },
                { value: 'line', label: 'By Line' },
              ]}
              value={groupBy}
              onChange={v => setGroupBy(v as GroupBy)}
            />
          </div>

          {groupBy === 'supplier' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#403833] text-white">
                  {['Vendor', 'POs', 'SOT%', 'OTIF%', 'Failing'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySupplier.map(row => (
                  <Fragment key={row.supplier}>
                    <tr onClick={() => setExpandedVendor(expandedVendor === row.supplier ? null : row.supplier)}
                      className={`border-b border-[#e9e3df] cursor-pointer transition-colors ${expandedVendor === row.supplier ? 'bg-[#f9f7f6]' : 'hover:bg-[#f9f7f6]'}`}>
                      <td className="px-4 py-2.5 font-medium text-[#403833]">
                        <span className="flex items-center gap-2">
                          <span className="text-[#b5aaa5] text-xs">{expandedVendor === row.supplier ? '▾' : '▸'}</span>
                          {row.supplier}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#58524e]">{row.poCount}</td>
                      <td className="px-4 py-2.5">
                        {row.sotPct !== null
                          ? <span className={`font-bold ${row.sotPct >= 90 ? 'text-pass' : row.sotPct >= 70 ? 'text-warn' : 'text-fail'}`}>{row.sotPct}%</span>
                          : <span className="text-[#b5aaa5]">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.otifPct !== null
                          ? <span className={`font-bold ${row.otifPct >= 90 ? 'text-pass' : row.otifPct >= 70 ? 'text-warn' : 'text-fail'}`}>{row.otifPct}%</span>
                          : <span className="text-[#b5aaa5]">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.failingLines.length > 0
                          ? <span className="text-xs bg-[#fee2e2] text-fail px-2 py-0.5 rounded-full font-medium">{row.failingLines.length}</span>
                          : <span className="text-pass text-xs font-medium">✓</span>}
                      </td>
                    </tr>
                    {expandedVendor === row.supplier && row.failingLines.length > 0 && (
                      <tr className="bg-[#faf7f3]">
                        <td colSpan={5} className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-2">Failing lines — {row.failingLines.length}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[#9c9794] border-b border-[#e9e3df]">
                                  {['PO', 'SKU', 'Category', 'PGRD', 'ESD', 'Req Qty', 'Conf Qty', 'Status', 'OTIF', 'BC Reason'].map(h => (
                                    <th key={h} className="py-1.5 pr-3 text-left font-medium uppercase text-[10px] tracking-wide whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {row.failingLines.map(l => (
                                  <tr key={`${l.po}-${l.line}`} className="border-b border-[#f4f1ef] last:border-0">
                                    <td className="py-1.5 pr-3 font-semibold text-[#403833]">{l.po}</td>
                                    <td className="py-1.5 pr-3 font-mono">{l.sku}</td>
                                    <td className="py-1.5 pr-3 text-[#7b7571]">{categorizeSKU(l.sku)}</td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatDateShort(l.pgrd)}</td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{l.esd ? formatDateShort(l.esd) : <span className="text-fail">No ESD</span>}</td>
                                    <td className="py-1.5 pr-3 text-right">{l.qty.toLocaleString()}</td>
                                    <td className="py-1.5 pr-3 text-right">{l.cqty.toLocaleString()}</td>
                                    <td className="py-1.5 pr-3">{statusBadge(l)}</td>
                                    <td className="py-1.5 pr-3">{otifBadge(l)}</td>
                                    <td className="py-1.5 pr-3">
                                      {l.lossReasonCode
                                        ? <span className="text-[10px] bg-[#fef3c7] text-warn-text px-2 py-0.5 rounded-full">{l.lossReasonCode}</span>
                                        : <span className="text-[#b5aaa5]">—</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedVendor === row.supplier && row.failingLines.length === 0 && (
                      <tr className="bg-[#f0faf3]">
                        <td colSpan={5} className="px-4 py-2.5 text-xs text-pass font-medium">✓ No failing lines for this vendor</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {groupBy === 'po' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#403833] text-white">
                    {['PO', 'Vendor', 'Dest.', 'Lines', 'Req Qty', 'Conf Qty', 'PGRD', 'ESD', 'SOT%', 'OTIF%'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byPO.map(row => (
                    <tr key={row.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                      <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{row.po}</td>
                      <td className="px-3 py-2 text-[#58524e] max-w-[120px] truncate">{row.supplier}</td>
                      <td className="px-3 py-2 text-[#58524e]">{row.destination}</td>
                      <td className="px-3 py-2 text-[#7b7571]">{row.lineCount}</td>
                      <td className="px-3 py-2 text-right text-[#403833] font-medium">{row.reqQty.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[#403833] font-medium">{row.cqty.toLocaleString()}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[#58524e]">{formatDateShort(row.pgrd ?? null)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.esd ? formatDateShort(row.esd) : <span className="text-[10px] bg-[#fee2e2] text-fail px-1.5 py-0.5 rounded-full">No ESD</span>}</td>
                      <td className="px-3 py-2">
                        {row.sotPct !== null
                          ? <span className={`font-bold ${row.sotPct >= 90 ? 'text-pass' : row.sotPct >= 70 ? 'text-warn' : 'text-fail'}`}>{row.sotPct}%</span>
                          : <span className="text-[#b5aaa5]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row.otifPct !== null
                          ? <span className={`font-bold ${row.otifPct >= 90 ? 'text-pass' : row.otifPct >= 70 ? 'text-warn' : 'text-fail'}`}>{row.otifPct}%</span>
                          : <span className="text-[#b5aaa5]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {groupBy === 'line' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#403833] text-white">
                    {['PO', 'Ln', 'SKU', 'Category', 'Vendor', 'Dest.', 'PGRD', 'ASD', 'ESD', 'Req Qty', 'Conf Qty', 'Status', 'OTIF'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(({ line: l }) => (
                    <tr key={`${l.po}-${l.line}`} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                      <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{l.po}</td>
                      <td className="px-3 py-2 text-[#7b7571]">{l.line}</td>
                      <td className="px-3 py-2 font-mono text-[#58524e]">{l.sku}</td>
                      <td className="px-3 py-2 text-[#7b7571]">{categorizeSKU(l.sku)}</td>
                      <td className="px-3 py-2 text-[#58524e] max-w-[120px] truncate">{l.supplier}</td>
                      <td className="px-3 py-2 text-[#58524e]">{l.destination}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[#58524e]">{formatDateShort(l.pgrd)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[#58524e]">{l.asd ? formatDateShort(l.asd) : <span className="text-[#c8c0bb]">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{l.esd ? formatDateShort(l.esd) : <span className="text-[10px] bg-[#fee2e2] text-fail px-1.5 py-0.5 rounded-full">No ESD</span>}</td>
                      <td className="px-3 py-2 text-right text-[#403833] font-medium">{l.qty.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[#403833] font-medium">{l.cqty.toLocaleString()}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{statusBadge(l)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{otifBadge(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* root causes */}
        {kpis.failingLines.length > 0 && (
          <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#f4f1ef]">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">
                Root Causes — {annotatedFailing.length}/{kpis.failingLines.length} annotated
              </p>
            </div>
            <div className="p-4 space-y-2">
              {unannotatedCount > 0 && (
                <div className="rounded-lg border border-[#fecaca] bg-[#fef9f9] px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-fail">{unannotatedCount} line{unannotatedCount > 1 ? 's' : ''} missing annotation</p>
                    <p className="text-xs text-[#b5aaa5] mt-0.5">Add root cause comments via "Prepare for Meeting"</p>
                  </div>
                  <span className="text-2xl font-extrabold text-[#fecaca]">{unannotatedCount}</span>
                </div>
              )}
              {annotatedFailing.map(line => {
                const key = `${line.po}-${line.line}`;
                const kpi = computeKPI(line);
                const entry = annotations[key]!;
                return (
                  <div key={key} className="rounded-lg border border-[#e9e3df] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#403833]">{line.po}</span>
                          <span className="text-xs font-mono text-[#7b7571]">{line.sku}</span>
                          <span className="text-xs text-[#9c9794]">{line.supplier}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-[#b5aaa5]">
                          <span>PGRD {formatDateShort(line.pgrd)}</span>
                          {line.asd && <span>ASD {formatDateShort(line.asd)}</span>}
                          {line.esd && <span>ESD {formatDateShort(line.esd)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {kpi.sotFail && <span className="text-[10px] bg-[#fee2e2] text-fail px-2 py-0.5 rounded-full font-medium">SOT</span>}
                        {kpi.otifFail && <span className="text-[10px] bg-[#fef3c7] text-warn px-2 py-0.5 rounded-full font-medium">OTIF</span>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-[#f4f1ef] text-[#58524e] px-3 py-1 rounded-full font-medium">
                        {REASON_LABELS[entry.reason] ?? entry.reason}
                      </span>
                      {(entry.tmComment || entry.scmComment) && (
                        <span className="text-xs text-[#7b7571] italic">&ldquo;{entry.tmComment || entry.scmComment}&rdquo;</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {annotatedFailing.length === 0 && unannotatedCount === 0 && (
                <p className="text-xs text-pass font-medium px-1">✓ All failing lines have been annotated</p>
              )}
            </div>
          </div>
        )}

        {/* ── BACKLOG SECTION ────────────────────────────────────────────────── */}
        <SectionLabel>Backlog</SectionLabel>

        {/* backlog KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          {backlogTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`text-left bg-white rounded-lg border-2 p-4 transition-all ${activeTab === t.key ? t.border : 'border-[#e9e3df] hover:border-[#e9e3df]'}`}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794]">{t.label}</p>
              </div>
              <p className={`text-[26px] font-bold leading-none tracking-tight ${t.color}`}>{t.count}</p>
              <p className="text-[12px] font-semibold mt-1.5 text-[#9c9794]">
                {t.count !== t.total ? `of ${t.total} total POs` : 'POs'}
              </p>
            </button>
          ))}
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#CCC]" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794]">No ESD</p>
            </div>
            <p className={`text-[26px] font-bold leading-none tracking-tight ${noEsdPOs > 0 ? 'text-fail' : 'text-pass'}`}>{noEsdPOs}</p>
            <p className={`text-[12px] font-semibold mt-1.5 ${noEsdPOs > 0 ? 'text-fail' : 'text-pass'}`}>
              {noEsdPOs > 0 ? 'POs missing pickup booking' : 'all POs have ESD'}
            </p>
          </div>
        </div>

        {/* backlog by vendor chart */}
        {backlogChartData.length > 0 && (
          <div className="bg-white rounded-lg p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-4">Backlog by Vendor</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={backlogChartData} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
                <XAxis dataKey="vendor" tick={{ fill: '#9c9794', fontSize: 11 }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#FF8900', fontWeight: 700 }} />
                <Legend verticalAlign="top" align="right" iconSize={8} formatter={(v) => <span style={{ color: '#58524e', fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="critical" stackId="a" fill="#DC3545" fillOpacity={0.72} name="Critical" radius={[0,0,0,0]} />
                <Bar dataKey="recent" stackId="a" fill="#F59E0B" fillOpacity={0.72} name="Recent" />
                <Bar dataKey="futureBacklog" stackId="a" fill="#FF8900" fillOpacity={0.72} name="Future Backlog" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* backlog filters + table */}
        <div className="flex items-center gap-3 flex-wrap">
          <VendorDropdown vendors={allBacklogVendors} selected={backlogVendors} onChange={setBacklogVendors} align="left" />
          <span className="text-[#e9e3df]">|</span>
          {SKU_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCat(c)}
              className="text-xs px-3 py-1 rounded-full border font-medium transition-all"
              style={selectedCategories.includes(c)
                ? { background: CATEGORY_COLORS[c], color: '#f9f7f6', borderColor: CATEGORY_COLORS[c] }
                : { borderColor: '#e9e3df', color: '#58524e' }}
            >
              {c}
            </button>
          ))}
          {(backlogVendors.length > 0 || selectedCategories.length > 0) && (
            <button
              onClick={() => { setBacklogVendors([]); setSelectedCategories([]); }}
              className="text-xs text-[#9c9794] hover:text-fail transition-colors ml-1"
            >
              Clear filters ✕
            </button>
          )}
          <span className="ml-auto text-xs text-[#9c9794]">{tabLines.length} line{tabLines.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="pb-8">
          <BacklogTable lines={tabLines} />
        </div>

      </div>
    </div>
  );
}
