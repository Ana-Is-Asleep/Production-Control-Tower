'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { computeLeadTime, summariseLeadTimes } from '../../lib/leadTimeUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';
import { TARGET_LT } from '../../data/leadTimeData';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

export default function LeadTimesPage() {
  const router = useRouter();
  const { allLines } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines);
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');
  const [view, setView] = useState<'summary' | 'detail'>('summary');

  const scopeLines = accumulatingLines; // use accumulating so we have more shipped data

  const filtered = useMemo(() =>
    selectedCat === 'All' ? scopeLines : scopeLines.filter((l) => categorizeSKU(l.sku) === selectedCat),
    [scopeLines, selectedCat]
  );

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
      vsAgreed: avg(v.actual) !== null ? (avg(v.actual) as number) - v.agreedLT : null,
    })).filter((r) => r.actual !== null && r.actual > 0).sort((a, b) => (b.vsAgreed ?? 0) - (a.vsAgreed ?? 0));
  }, [filtered]);

  // detail table
  const detailRows = useMemo(() =>
    filtered.map(computeLeadTime).filter((r) => r.productionLT !== null || r.plannedLT !== null),
    [filtered]
  );

  return (
    <div className="min-h-screen bg-[#F4F4F6] page-enter">
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">← Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Lead Times</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
        {/* filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSelectedCat('All')}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${selectedCat === 'All' ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}>
            All categories
          </button>
          {SKU_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setSelectedCat(c)}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all"
              style={selectedCat === c ? { background: CATEGORY_COLORS[c], color: 'white', borderColor: CATEGORY_COLORS[c] } : { borderColor: '#E0E0E0', color: '#555' }}>
              {c}
            </button>
          ))}
          <span className="text-[#E0E0E0] mx-1">|</span>
          <div className="flex gap-1 bg-[#F5F5F5] p-0.5 rounded-lg">
            {(['summary', 'detail'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all capitalize ${view === v ? 'bg-white text-[#111] shadow-sm' : 'text-[#888]'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* hero summary */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Avg Planned LT', sub: 'Order → PGRD', value: summary.avgPlannedLT, color: '#6366F1' },
            { label: 'Avg Expected LT', sub: 'Order → EGRD', value: summary.avgExpectedLT, color: '#FF8900' },
            { label: 'Avg Production LT', sub: 'Order → ASD', value: summary.avgProductionLT, color: summary.avgProductionLT !== null && summary.avgProductionLT <= summary.avgAgreedLT ? '#34A853' : '#DC3545' },
            { label: 'Avg Agreed LT', sub: 'From file', value: summary.avgAgreedLT, color: '#8A8A8A' },
            { label: 'Target LT', sub: 'Always 30d', value: 30, color: '#8A8A8A' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">{item.label}</p>
              <p className="kpi-number font-extrabold text-5xl leading-none" style={{ color: item.color }}>
                {item.value !== null ? `${item.value}d` : '—'}
              </p>
              <p className="text-[10px] text-[#CCC] mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* early / late breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Early POs</p>
            <div className="flex items-end gap-6">
              <div>
                <p className="kpi-number font-extrabold text-5xl text-pass">{summary.earlyCount}</p>
                <p className="text-xs text-[#888] mt-1">POs arrived early vs agreed LT</p>
              </div>
              {summary.avgDaysEarly !== null && (
                <div>
                  <p className="kpi-number font-extrabold text-3xl text-pass">{summary.avgDaysEarly}d</p>
                  <p className="text-xs text-[#888] mt-1">avg days early vs agreed</p>
                </div>
              )}
              {summary.avgDaysEarlyVsTarget !== null && (
                <div>
                  <p className={`kpi-number font-extrabold text-3xl ${(summary.avgDaysEarlyVsTarget ?? 0) <= 0 ? 'text-pass' : 'text-fail'}`}>
                    {(summary.avgDaysEarlyVsTarget ?? 0) <= 0 ? '' : '+'}{summary.avgDaysEarlyVsTarget}d
                  </p>
                  <p className="text-xs text-[#888] mt-1">vs 30d target</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Late POs</p>
            <div className="flex items-end gap-6">
              <div>
                <p className="kpi-number font-extrabold text-5xl text-fail">{summary.lateCount}</p>
                <p className="text-xs text-[#888] mt-1">POs arrived late vs agreed LT</p>
              </div>
              {summary.avgDaysLate !== null && (
                <div>
                  <p className="kpi-number font-extrabold text-3xl text-fail">+{summary.avgDaysLate}d</p>
                  <p className="text-xs text-[#888] mt-1">avg days late vs agreed</p>
                </div>
              )}
              {summary.avgDaysLateVsTarget !== null && (
                <div>
                  <p className={`kpi-number font-extrabold text-3xl ${(summary.avgDaysLateVsTarget ?? 0) <= 0 ? 'text-pass' : 'text-fail'}`}>
                    {(summary.avgDaysLateVsTarget ?? 0) > 0 ? '+' : ''}{summary.avgDaysLateVsTarget}d
                  </p>
                  <p className="text-xs text-[#888] mt-1">vs 30d target</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* by vendor chart */}
        {view === 'summary' && byVendor.length > 0 && (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">Avg Lead Time by Vendor</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byVendor} margin={{ top: 4, right: 20, left: -10, bottom: 60 }}>
                <XAxis dataKey="vendor" tick={{ fill: '#AAA', fontSize: 11 }} angle={-40} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} unit="d" />
                <ReferenceLine y={TARGET_LT} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '30d target', position: 'right', fill: '#F59E0B', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }} formatter={(v, n) => [`${v}d`, n]} />
                <Legend verticalAlign="top" align="right" iconSize={8} formatter={(v) => <span style={{ color: '#555', fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="actual" fill="#FF8900" radius={[3, 3, 0, 0]} name="Production LT" />
                <Bar dataKey="agreed" fill="rgba(100,116,239,0.3)" radius={[3, 3, 0, 0]} name="Agreed LT" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* detail table */}
        {view === 'detail' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['PO', 'SKU', 'Category', 'Vendor', 'Order Date', 'PGRD', 'EGRD', 'ASD', 'Planned LT', 'Expected LT', 'Production LT', 'Agreed LT', 'vs Agreed', 'vs Target'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailRows.map((r) => {
                  const cat = categorizeSKU(r.line.sku);
                  return (
                    <tr key={`${r.line.po}-${r.line.line}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
                      <td className="px-3 py-2 font-semibold text-[#111] whitespace-nowrap">{r.line.po}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#555]">{r.line.sku}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[cat] }}>{cat}</span>
                      </td>
                      <td className="px-3 py-2 text-[#555]">{r.line.supplier}</td>
                      <td className="px-3 py-2 text-[#555] whitespace-nowrap">{formatDateShort(r.line.orderDate)}</td>
                      <td className="px-3 py-2 text-[#555] whitespace-nowrap">{formatDateShort(r.line.pgrd)}</td>
                      <td className="px-3 py-2 text-[#555] whitespace-nowrap">{formatDateShort(r.line.egrd)}</td>
                      <td className="px-3 py-2 text-[#555] whitespace-nowrap">{r.line.asd ? formatDateShort(r.line.asd) : <span className="text-[#CCC]">—</span>}</td>
                      <td className="px-3 py-2 text-[#555]">{r.plannedLT !== null ? `${r.plannedLT}d` : '—'}</td>
                      <td className="px-3 py-2 text-[#555]">{r.expectedLT !== null ? `${r.expectedLT}d` : '—'}</td>
                      <td className="px-3 py-2 font-semibold">{r.productionLT !== null ? `${r.productionLT}d` : <span className="text-[#CCC]">—</span>}</td>
                      <td className="px-3 py-2 text-[#888]">{r.agreedLT}d</td>
                      <td className="px-3 py-2">
                        {r.vsAgreed === null ? <span className="text-[#CCC]">—</span>
                          : r.vsAgreed < 0 ? <span className="text-pass font-semibold">{r.vsAgreed}d</span>
                          : r.vsAgreed > 0 ? <span className="text-fail font-semibold">+{r.vsAgreed}d</span>
                          : <span className="text-[#888]">On time</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.vsTarget === null ? <span className="text-[#CCC]">—</span>
                          : r.vsTarget < 0 ? <span className="text-pass font-semibold">{r.vsTarget}d</span>
                          : r.vsTarget > 0 ? <span className="text-fail font-semibold">+{r.vsTarget}d</span>
                          : <span className="text-[#888]">On time</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
