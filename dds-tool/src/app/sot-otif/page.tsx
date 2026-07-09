'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { NavTabs } from '../../components/shared/NavTabs';
import { Seg } from '../../components/shared/Seg';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI, computeExpectedSOT } from '../../lib/kpiFormulas';
import { categorizeSKU } from '../../lib/skuUtils';
import { formatDateShort, getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

const REASON_LABELS: Record<string, string> = {
  supplier_delay: 'Supplier delay', capacity_constraints: 'Capacity constraints',
  material_shortage: 'Material shortage', quality_issues: 'Quality issues',
  documentation_issue: 'Documentation issue', transit_delay: 'Transit delay',
  booking_not_made: 'Booking not made', data_issue: 'Data issue', other: 'Other',
};

type GroupBy = 'supplier' | 'po' | 'line';
type DrillView = 'backlog' | 'detail';

// Show the week number when ESD is booked — "clears W{n}"
function clearWeekLabel(l: PurchaseLine): string | null {
  if (!l.esd) return null;
  return `W${String(getISOWeek(l.esd)).padStart(2, '0')}`;
}

function statusBadge(l: PurchaseLine) {
  const kpi = computeKPI(l);
  if (l.asd) {
    // shipped
    return kpi.sotResult
      ? <span className="text-[10px] font-medium text-pass bg-[#dcfce7] px-2 py-0.5 rounded-full">Shipped on time</span>
      : <span className="text-[10px] font-medium text-fail bg-[#fee2e2] px-2 py-0.5 rounded-full">Late</span>;
  }
  // not yet shipped — backlog
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

function VendorDropdown({ vendors, selected, onChange }: { vendors: string[]; selected: string[]; onChange: (v: string[]) => void }) {
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
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-64 py-1 max-h-64 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
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

export default function SOTOTIFPage() {
  const { allLines, annotations, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);

  const [_groupBy, setGroupBy] = useState<GroupBy>('supplier');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [clickedWeek, setClickedWeek] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<DrillView>('backlog');

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
    let lines = selectedVendors.length === 0 ? sourceLines : sourceLines.filter(l => selectedVendors.includes(l.supplier));
    if (selectedCat !== 'All') lines = lines.filter(l => categorizeSKU(l.sku) === selectedCat);
    return lines;
  }, [sourceLines, selectedVendors, selectedCat]);

  const enriched = useMemo(() => filteredLines.map(l => ({ line: l, kpi: computeKPI(l), expectedSot: computeExpectedSOT(l) })), [filteredLines]);

  const allVendors = useMemo(() => [...new Set(weeklyLines.map(l => l.supplier))].sort(), [weeklyLines]);

  // Vendor-level aggregation
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

  // PO-level aggregation (one row per distinct PO)
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

  // Chart data — vendor-filtered if needed
  const chartData = useMemo(() => {
    if (selectedVendors.length === 0) return kpis.weeklyTrend;
    return kpis.weeklyTrend.map(w => {
      const wLines = accumulatingLines.filter(l =>
        selectedVendors.includes(l.supplier) && l.pgrd && getISOWeek(l.pgrd) === parseInt(w.weekLabel.replace('W', ''))
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
  }, [kpis.weeklyTrend, selectedVendors, accumulatingLines]);

  // Overall KPIs for filtered set
  const filteredSotPct = useMemo(() => {
    const ev = enriched.filter(r => r.kpi.sotResult !== null);
    return ev.length > 0 ? Math.round(ev.filter(r => r.kpi.sotResult).length / ev.length * 100) : kpis.sotPct;
  }, [enriched, kpis.sotPct]);

  const filteredOtifPct = useMemo(() => {
    const ev = enriched.filter(r => r.kpi.otif !== null);
    return ev.length > 0 ? Math.round(ev.filter(r => r.kpi.otif).length / ev.length * 100) : kpis.otifPct;
  }, [enriched, kpis.otifPct]);

  // Root cause: only annotated lines in full detail
  const annotatedFailing = useMemo(() =>
    kpis.failingLines.filter(l => !!annotations[`${l.po}-${l.line}`]?.reason),
    [kpis.failingLines, annotations]
  );
  const unannotatedCount = kpis.failingLines.length - annotatedFailing.length;

  // Backlog detail for clicked week
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

  return (
    <div className="min-h-screen bg-[#f5f2ee] page-enter">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-bold text-brand text-xl shrink-0 tracking-tight">emma<span className="text-[#403833]">.</span></span>
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        <div className="flex-1" />
        <VendorDropdown vendors={allVendors} selected={selectedVendors} onChange={setSelectedVendors} />
        <span className="text-xs bg-[#f4f1ef] border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] font-medium shrink-0">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-4 space-y-4 max-w-6xl mx-auto">

        {/* category filter */}
        <Seg
          options={[{ value: 'All', label: 'All categories' }, ...SKU_CATEGORIES.map(c => ({ value: c, label: c }))]}
          value={selectedCat}
          onChange={v => setSelectedCat(v as SKUCategory | 'All')}
        />

        {/* compact KPI strip */}
        <div className="flex gap-3">
          {[
            { label: 'SOT', pct: filteredSotPct },
            { label: 'OTIF', pct: filteredOtifPct },
          ].map(({ label, pct }) => {
            const onTarget = pct !== null && pct >= 90;
            const color = pct === null ? '#c8c0bb' : onTarget ? '#15803d' : '#dc2626';
            return (
              <div key={label} className="bg-white rounded-lg border border-[#e9e3df] px-5 py-3 flex items-center gap-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-semibold mb-0.5" style={{ color }}>{label} · target 90%</p>
                  <p className="kpi-number font-extrabold text-4xl leading-none" style={{ color }}>
                    {pct !== null ? `${pct}%` : '—'}
                  </p>
                </div>
                {pct !== null && (
                  <p className="text-sm font-semibold" style={{ color }}>
                    {onTarget ? '↑' : '↓'} {Math.abs(pct - 90)}pp vs target
                  </p>
                )}
              </div>
            );
          })}
          <div className="bg-white rounded-lg border border-[#e9e3df] px-5 py-3 flex items-center gap-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] font-semibold mb-0.5">Lines evaluated</p>
              <p className="kpi-number font-extrabold text-4xl leading-none text-[#403833]">
                {enriched.filter(r => r.kpi.sotResult !== null).length}
              </p>
            </div>
            <p className="text-xs text-[#9c9794]">with ASD<br/>in period</p>
          </div>
          <div className="bg-white rounded-lg border border-[#e9e3df] px-5 py-3 flex items-center gap-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] font-semibold mb-0.5">Failing lines</p>
              {(() => {
                const n = enriched.filter(r => r.kpi.sotFail || r.kpi.otifFail).length;
                return (
                  <>
                    <p className={`kpi-number font-extrabold text-4xl leading-none ${n === 0 ? 'text-pass' : 'text-fail'}`}>{n}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${n === 0 ? 'text-pass' : 'text-fail'}`}>{n === 0 ? 'all on track' : 'SOT or OTIF miss'}</p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* trend chart */}
        <div className="bg-white rounded-lg p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">SOT & OTIF Trend by PGRD Week</p>
              <p className="text-xs text-[#b5aaa5] mt-0.5">
                Click a week to drill down · Bars = PO status (left axis) · Lines = % performance (right axis)
              </p>
            </div>
            {clickedWeek && (
              <button onClick={() => setClickedWeek(null)} className="text-xs text-[#9c9794] hover:text-fail transition-colors shrink-0">
                Clear {clickedWeek} ✕
              </button>
            )}
          </div>

          {/* chart legend key — plain text descriptions */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 mt-2">
            {[
              { color: '#34A853', label: 'Shipped on time (POs)' },
              { color: '#F59E0B', label: 'This-week backlog (POs)' },
              { color: '#DC2626', label: 'Accumulated past backlog (POs)' },
              { color: '#86efac', label: 'Expected on track — future (POs)', dashed: false },
              { color: '#FF8900', label: 'SOT %', line: true },
              { color: '#15803d', label: 'OTIF %', line: true, dashed: true },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.line
                  ? <span className="w-5 h-0.5 rounded" style={{ background: item.color, borderTop: item.dashed ? `2px dashed ${item.color}` : undefined }} />
                  : <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                }
                <span className="text-[10px] text-[#7b7571]">{item.label}</span>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 40, left: -10, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9e3df" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pos" tick={{ fill: '#9c9794', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'POs', angle: -90, position: 'insideLeft', fill: '#c8c0bb', fontSize: 10, dy: 20 }} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fill: '#9c9794', fontSize: 10 }} unit="%" axisLine={false} tickLine={false} />
              <ReferenceLine yAxisId="pct" y={90} stroke="#c8c0bb" strokeDasharray="5 3" label={{ value: '90% target', position: 'insideTopRight', fill: '#c8c0bb', fontSize: 9 }} />

              {/* stacked bars */}
              <Bar yAxisId="pos" dataKey="posShipped"      stackId="pos" fill="#34A853" name="Shipped on time"        radius={[0,0,0,0]} />
              <Bar yAxisId="pos" dataKey="posBacklog"      stackId="pos" fill="#F59E0B" name="This-week backlog"      radius={[0,0,0,0]} />
              <Bar yAxisId="pos" dataKey="pastPOBacklog"   stackId="pos" fill="#DC2626" name="Accumulated past backlog" radius={[0,0,0,0]} />
              <Bar yAxisId="pos" dataKey="posPredictedSOT" stackId="pos" fill="#86efac" name="Expected on track"      radius={[3,3,0,0]} />

              {/* performance lines */}
              <Line yAxisId="pct" dataKey="sotPct"  stroke="#FF8900" strokeWidth={2.5} dot={{ r: 3, fill: '#FF8900', strokeWidth: 0 }} activeDot={{ r: 5 }} name="SOT %" connectNulls={false} />
              <Line yAxisId="pct" dataKey="otifPct" stroke="#15803d" strokeWidth={2}   strokeDasharray="6 3" dot={{ r: 3, fill: '#15803d', strokeWidth: 0 }} name="OTIF %" connectNulls={false} />

              <Tooltip
                contentStyle={{ background: '#403833', border: 'none', borderRadius: 8, fontSize: 11, padding: '8px 12px' }}
                labelStyle={{ color: '#ffa236', fontWeight: 700, marginBottom: 4 }}
                itemStyle={{ color: '#f9f7f6' }}
                formatter={(value, name) => {
                  const n = String(name);
                  return [n.includes('%') ? `${value}%` : `${value} POs`, n];
                }}
              />
              {clickedWeek && (
                <ReferenceArea yAxisId="pct" x1={clickedWeek} x2={clickedWeek} fill="rgba(255,137,0,0.12)" stroke="#FF8900" strokeOpacity={0.5} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* drill-down panel — only shows when a week is selected */}
        {clickedWeek && (
          <div className="space-y-3">
            {/* week banner + view toggle */}
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

            {/* Backlog view */}
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

            {/* SOT+OTIF detail view */}
            {drillView === 'detail' && (
              <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="px-5 py-3 border-b border-[#f4f1ef] flex items-center justify-between">
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
        )}

        {/* breakdown table — always visible, filtered by week if one is selected */}
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

          {/* By Vendor */}
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

          {/* By PO */}
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

          {/* By Line */}
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

        {/* root causes — only annotated lines in detail */}
        {kpis.failingLines.length > 0 && (
          <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#f4f1ef] flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">
                Root Causes — {annotatedFailing.length}/{kpis.failingLines.length} annotated
              </p>
            </div>
            <div className="p-4 space-y-2">
              {/* Missing annotation summary card */}
              {unannotatedCount > 0 && (
                <div className="rounded-lg border border-[#fecaca] bg-[#fef9f9] px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-fail">{unannotatedCount} line{unannotatedCount > 1 ? 's' : ''} missing annotation</p>
                    <p className="text-xs text-[#b5aaa5] mt-0.5">Add root cause comments via "Prepare for Meeting"</p>
                  </div>
                  <span className="text-2xl font-extrabold text-[#fecaca]">{unannotatedCount}</span>
                </div>
              )}
              {/* Annotated lines */}
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
      </div>
    </div>
  );
}
