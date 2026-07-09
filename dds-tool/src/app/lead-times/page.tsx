'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid } from 'recharts';
import { NavTabs } from '../../components/shared/NavTabs';
import { Seg } from '../../components/shared/Seg';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { computeLeadTime, summariseLeadTimes, computeWeeklyLT } from '../../lib/leadTimeUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';
import { TARGET_LT } from '../../data/leadTimeData';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6469aa', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

export default function LeadTimesPage() {
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');
  const [view, setView] = useState<'summary' | 'detail'>('summary');

  const scopeLines = accumulatingLines;

  const filtered = useMemo(() =>
    selectedCat === 'All' ? scopeLines : scopeLines.filter((l) => categorizeSKU(l.sku) === selectedCat),
    [scopeLines, selectedCat]
  );

  // weekly trend — all categories so the chart always shows all bars even when a cat filter is active
  const weeklyLT = useMemo(() => computeWeeklyLT(accumulatingLines), [accumulatingLines]);

  const summary = useMemo(() => summariseLeadTimes(filtered), [filtered]);

  // per-vendor chart data
  const byVendor = useMemo(() => {
    const map = new Map<string, { planned: number[]; expected: number[]; production: number[]; agreedLT: number }>();
    filtered.forEach((l) => {
      const r = computeLeadTime(l);
      if (!map.has(l.supplier)) map.set(l.supplier, { planned: [], expected: [], production: [], agreedLT: r.agreedLT });
      const e = map.get(l.supplier)!;
      if (r.plannedLT !== null) e.planned.push(r.plannedLT);
      if (r.expectedLT !== null) e.expected.push(r.expectedLT);
      if (r.productionLT !== null) e.production.push(r.productionLT);
    });
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;
    return [...map.entries()].map(([vendor, v]) => ({
      vendor: vendor.length > 20 ? vendor.substring(0, 18) + '…' : vendor,
      fullVendor: vendor,
      planned: avg(v.planned),
      expected: avg(v.expected),
      actual: avg(v.production),
      agreed: v.agreedLT,
      target: TARGET_LT,
      vsAgreed: avg(v.production) !== null ? (avg(v.production) as number) - v.agreedLT : null,
    })).filter((r) => r.actual !== null && r.actual > 0).sort((a, b) => (b.vsAgreed ?? 0) - (a.vsAgreed ?? 0));
  }, [filtered]);

  // group by PO for detail table — one row per PO, average LTs across lines
  const detailByPO = useMemo(() => {
    const map = new Map<string, { po: string; vendor: string; category: SKUCategory; orderDate: Date | null; pgrd: Date | null; asd: Date | null; lts: ReturnType<typeof computeLeadTime>[] }>();
    filtered.forEach(l => {
      const r = computeLeadTime(l);
      if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, category: categorizeSKU(l.sku), orderDate: l.orderDate, pgrd: l.pgrd, asd: l.asd, lts: [] });
      map.get(l.po)!.lts.push(r);
    });
    const avgN = (arr: (number | null)[]) => { const v = arr.filter((n): n is number => n != null); return v.length ? Math.round(v.reduce((s,n)=>s+n,0)/v.length) : null; };
    return [...map.values()].map(g => ({
      po: g.po, vendor: g.vendor, category: g.category,
      orderDate: g.orderDate, pgrd: g.pgrd, asd: g.asd,
      plannedLT:    avgN(g.lts.map(r => r.plannedLT)),
      expectedLT:   avgN(g.lts.map(r => r.expectedLT)),
      productionLT: avgN(g.lts.map(r => r.productionLT)),
      agreedLT:     g.lts[0]?.agreedLT ?? TARGET_LT,
      vsAgreed:     avgN(g.lts.map(r => r.vsAgreed)),
      vsTarget:     avgN(g.lts.map(r => r.vsTarget)),
      lineCount:    g.lts.length,
    })).filter(g => g.productionLT != null || g.plannedLT != null);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#f5f2ee] page-enter">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-bold text-brand text-xl shrink-0 tracking-tight">emma<span className="text-[#403833]">.</span></span>
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        <div className="flex-1" />
        <span className="text-xs bg-[#f4f1ef] border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] font-medium shrink-0">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
        {/* filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Seg
            options={[
              { value: 'All', label: 'All' },
              ...SKU_CATEGORIES.map(c => ({ value: c, label: c })),
            ]}
            value={selectedCat}
            onChange={(v) => setSelectedCat(v as SKUCategory | 'All')}
          />
          <Seg
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'detail', label: 'Detail' },
            ]}
            value={view}
            onChange={(v) => setView(v as 'summary' | 'detail')}
          />
        </div>

        {/* hero summary */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Avg Planned LT', sub: 'Order → PGRD', value: summary.avgPlannedLT, color: '#6469aa' },
            { label: 'Avg Expected LT', sub: 'Order → EGRD', value: summary.avgExpectedLT, color: '#FF8900' },
            { label: 'Avg Production LT', sub: 'Order → ASD', value: summary.avgProductionLT, color: summary.avgProductionLT !== null && summary.avgProductionLT <= summary.avgAgreedLT ? '#34A853' : '#DC3545' },
            { label: 'Avg Agreed LT', sub: 'From file', value: summary.avgAgreedLT, color: '#8A8A8A' },
            { label: 'Target LT', sub: 'Always 30d', value: 30, color: '#8A8A8A' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-2">{item.label}</p>
              <p className="kpi-number font-extrabold text-5xl leading-none" style={{ color: item.color }}>
                {item.value !== null ? `${item.value}d` : '—'}
              </p>
              <p className="text-[10px] text-[#b5aaa5] mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* early / late breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-4">Early POs</p>
            <div className="flex items-end gap-6">
              <div>
                <p className="kpi-number font-extrabold text-5xl text-pass">{summary.earlyCount}</p>
                <p className="text-xs text-[#7b7571] mt-1">POs arrived early vs agreed LT</p>
              </div>
              {summary.avgDaysEarly !== null && (
                <div>
                  <p className="kpi-number font-extrabold text-3xl text-pass">{summary.avgDaysEarly}d</p>
                  <p className="text-xs text-[#7b7571] mt-1">avg days early vs agreed</p>
                </div>
              )}
              {summary.avgDaysEarlyVsTarget !== null && (
                <div>
                  <p className={`kpi-number font-extrabold text-3xl ${(summary.avgDaysEarlyVsTarget ?? 0) <= 0 ? 'text-pass' : 'text-fail'}`}>
                    {(summary.avgDaysEarlyVsTarget ?? 0) <= 0 ? '' : '+'}{summary.avgDaysEarlyVsTarget}d
                  </p>
                  <p className="text-xs text-[#7b7571] mt-1">vs 30d target</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-4">Late POs</p>
            <div className="flex items-end gap-6">
              <div>
                <p className="kpi-number font-extrabold text-5xl text-fail">{summary.lateCount}</p>
                <p className="text-xs text-[#7b7571] mt-1">POs arrived late vs agreed LT</p>
              </div>
              {summary.avgDaysLate !== null && (
                <div>
                  <p className="kpi-number font-extrabold text-3xl text-fail">+{summary.avgDaysLate}d</p>
                  <p className="text-xs text-[#7b7571] mt-1">avg days late vs agreed</p>
                </div>
              )}
              {summary.avgDaysLateVsTarget !== null && (
                <div>
                  <p className={`kpi-number font-extrabold text-3xl ${(summary.avgDaysLateVsTarget ?? 0) <= 0 ? 'text-pass' : 'text-fail'}`}>
                    {(summary.avgDaysLateVsTarget ?? 0) > 0 ? '+' : ''}{summary.avgDaysLateVsTarget}d
                  </p>
                  <p className="text-xs text-[#7b7571] mt-1">vs 30d target</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* weekly trend by category — main chart, matches HTML design */}
        {weeklyLT.length > 0 && (
          <div className="bg-white rounded-lg p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Production Lead Time by Week</p>
              <div className="flex items-center gap-2">
                {[{k:'Mattresses',c:'#FF8900'},{k:'Beds',c:'#6469aa'},{k:'Accessories',c:'#34A853'}].map(({k,c}) => (
                  <span key={k} className="flex items-center gap-1.5 text-[11px] text-[#58524e]">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
                    {k}
                  </span>
                ))}
                <span className="flex items-center gap-1.5 text-[11px] text-[#DC3545] ml-2">
                  <span className="inline-block w-5 border-t-2 border-dashed border-[#DC3545]" />
                  30d target
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={selectedCat === 'All' ? weeklyLT : weeklyLT} margin={{ top: 4, right: 24, left: -10, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e9e3df" vertical={false} />
                <XAxis dataKey="weekLabel" tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} unit="d" domain={[0, 'auto']} />
                <ReferenceLine y={TARGET_LT} stroke="#DC3545" strokeDasharray="5 4" strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{ background: '#403833', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#FF8900', fontWeight: 700 }}
                  itemStyle={{ color: '#f9f7f6' }}
                  formatter={(v: unknown, n: unknown) => [`${Number(v)}d`, String(n)]}
                />
                {selectedCat === 'All' ? (
                  <>
                    <Bar dataKey="Mattresses"  fill="#FF8900" radius={[3,3,0,0]} maxBarSize={22} name="Mattresses" />
                    <Bar dataKey="Beds"        fill="#6469aa" radius={[3,3,0,0]} maxBarSize={22} name="Beds" />
                    <Bar dataKey="Accessories" fill="#34A853" radius={[3,3,0,0]} maxBarSize={22} name="Accessories" />
                  </>
                ) : (
                  <Bar dataKey={selectedCat} fill={CATEGORY_COLORS[selectedCat]} radius={[3,3,0,0]} maxBarSize={30} name={selectedCat} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* by vendor chart */}
        {view === 'summary' && byVendor.length > 0 && (
          <div className="bg-white rounded-lg p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-5">Avg Lead Time by Vendor</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byVendor} margin={{ top: 4, right: 20, left: -10, bottom: 60 }}>
                <XAxis dataKey="vendor" tick={{ fill: '#9c9794', fontSize: 11 }} angle={-40} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} unit="d" />
                <ReferenceLine y={TARGET_LT} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '30d target', position: 'right', fill: '#F59E0B', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, n: unknown) => [`${Number(v)}d`, String(n)]} />
                <Legend verticalAlign="top" align="right" iconSize={8} formatter={(v) => <span style={{ color: '#58524e', fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="actual" fill="#FF8900" radius={[3, 3, 0, 0]} name="Production LT" />
                <Bar dataKey="agreed" fill="rgba(100,116,239,0.3)" radius={[3, 3, 0, 0]} name="Agreed LT" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* detail table — one row per PO */}
        {view === 'detail' && (
          <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#403833] text-white">
                  {['PO', 'Category', 'Vendor', 'Order Date', 'PGRD', 'ASD', 'Planned LT', 'Production LT', 'Agreed LT', 'vs Agreed', 'vs Target', 'Lines'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailByPO.map((r) => (
                  <tr key={r.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                    <td className="px-3 py-2.5 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[r.category] }}>{r.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#58524e]">{r.vendor}</td>
                    <td className="px-3 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateShort(r.orderDate)}</td>
                    <td className="px-3 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
                    <td className="px-3 py-2.5 text-[#58524e] whitespace-nowrap">{r.asd ? formatDateShort(r.asd) : <span className="text-[#b5aaa5]">—</span>}</td>
                    <td className="px-3 py-2.5 text-[#58524e]">{r.plannedLT != null ? `${r.plannedLT}d` : '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#403833]">{r.productionLT != null ? `${r.productionLT}d` : <span className="text-[#b5aaa5]">—</span>}</td>
                    <td className="px-3 py-2.5 text-[#7b7571]">{r.agreedLT}d</td>
                    <td className="px-3 py-2.5">
                      {r.vsAgreed == null ? <span className="text-[#b5aaa5]">—</span>
                        : r.vsAgreed < 0 ? <span className="text-pass font-semibold">{r.vsAgreed}d</span>
                        : r.vsAgreed > 0 ? <span className="text-fail font-semibold">+{r.vsAgreed}d</span>
                        : <span className="text-[#7b7571]">On time</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.vsTarget == null ? <span className="text-[#b5aaa5]">—</span>
                        : r.vsTarget < 0 ? <span className="text-pass font-semibold">{r.vsTarget}d</span>
                        : r.vsTarget > 0 ? <span className="text-fail font-semibold">+{r.vsTarget}d</span>
                        : <span className="text-[#7b7571]">On time</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#b5aaa5]">{r.lineCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
