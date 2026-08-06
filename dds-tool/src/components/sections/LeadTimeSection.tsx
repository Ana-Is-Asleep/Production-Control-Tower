'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid } from 'recharts';
import { SlideOver } from '../shared/SlideOver';
import { Seg } from '../shared/Seg';
import { computeLeadTime, summariseLeadTimes, computeWeeklyLT } from '../../lib/leadTimeUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';
import { TARGET_LT } from '../../data/leadTimeData';
import type { PurchaseLine } from '../../types';

// Calculation logic (leadTimeUtils, leadTimeData) is untouched from the old
// src/app/lead-times/page.tsx — only the shell changed (inline card + SlideOver instead of
// a dedicated route + its own useFilters call). `lines` is already scoped to the active
// global weekRange/supplier/channel/category filters, replacing the old fixed 10-week window.

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  Beds: '#6469aa', Mattresses: '#FF8900', Accessories: '#34A853', 'Comps/Other': '#8A8A8A',
};

interface LeadTimeSectionProps {
  lines: PurchaseLine[];
}

export function LeadTimeSection({ lines }: LeadTimeSectionProps) {
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => (selectedCat === 'All' ? lines : lines.filter((l) => categorizeSKU(l.sku) === selectedCat)),
    [lines, selectedCat]
  );

  const weeklyLT = useMemo(() => computeWeeklyLT(lines), [lines]);
  const summary = useMemo(() => summariseLeadTimes(filtered), [filtered]);

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
    const avg = (arr: number[]) => (arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null);
    return [...map.entries()].map(([vendor, v]) => ({
      vendor: vendor.length > 20 ? vendor.substring(0, 18) + '…' : vendor,
      planned: avg(v.planned), expected: avg(v.expected), actual: avg(v.production), agreed: v.agreedLT, target: TARGET_LT,
      vsAgreed: avg(v.production) !== null ? (avg(v.production) as number) - v.agreedLT : null,
    })).filter((r) => r.actual !== null && r.actual > 0).sort((a, b) => (b.vsAgreed ?? 0) - (a.vsAgreed ?? 0));
  }, [filtered]);

  const detailByPO = useMemo(() => {
    const map = new Map<string, { po: string; vendor: string; category: SKUCategory; orderDate: Date | null; pgrd: Date | null; asd: Date | null; lts: ReturnType<typeof computeLeadTime>[] }>();
    filtered.forEach((l) => {
      const r = computeLeadTime(l);
      if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, category: categorizeSKU(l.sku), orderDate: l.orderDate, pgrd: l.pgrd, asd: l.asd, lts: [] });
      map.get(l.po)!.lts.push(r);
    });
    const avgN = (arr: (number | null)[]) => { const v = arr.filter((n): n is number => n != null); return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : null; };
    return [...map.values()].map((g) => ({
      po: g.po, vendor: g.vendor, category: g.category, orderDate: g.orderDate, pgrd: g.pgrd, asd: g.asd,
      plannedLT: avgN(g.lts.map((r) => r.plannedLT)), productionLT: avgN(g.lts.map((r) => r.productionLT)),
      agreedLT: g.lts[0]?.agreedLT ?? TARGET_LT, vsAgreed: avgN(g.lts.map((r) => r.vsAgreed)), vsTarget: avgN(g.lts.map((r) => r.vsTarget)),
    })).filter((g) => g.productionLT != null || g.plannedLT != null);
  }, [filtered]);

  return (
    <>
      <div onClick={() => setOpen(true)} className="kpi-card bg-white rounded-lg border border-[#e9e3df] p-4 cursor-pointer flex items-center justify-between h-full overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Production Lead Time</p>
          <p className={`kpi-number font-extrabold text-3xl leading-none ${summary.avgProductionLT !== null && summary.avgProductionLT <= summary.avgAgreedLT ? 'text-pass' : 'text-fail'}`}>
            {summary.avgProductionLT !== null ? `${summary.avgProductionLT}d` : '—'}
          </p>
        </div>
        <p className="text-xs text-brand font-semibold">Drill down →</p>
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Lead Time" width="w-[1000px]">
        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Seg options={[{ value: 'All', label: 'All' }, ...SKU_CATEGORIES.map((c) => ({ value: c, label: c }))]} value={selectedCat} onChange={(v) => setSelectedCat(v as SKUCategory | 'All')} />
            <Seg options={[{ value: 'summary', label: 'Summary' }, { value: 'detail', label: 'Detail' }]} value={view} onChange={(v) => setView(v as 'summary' | 'detail')} />
          </div>

          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Avg Planned LT', value: summary.avgPlannedLT, color: '#6469aa' },
              { label: 'Avg Expected LT', value: summary.avgExpectedLT, color: '#FF8900' },
              { label: 'Avg Production LT', value: summary.avgProductionLT, color: summary.avgProductionLT !== null && summary.avgProductionLT <= summary.avgAgreedLT ? '#34A853' : '#DC3545' },
              { label: 'Avg Agreed LT', value: summary.avgAgreedLT, color: '#8A8A8A' },
              { label: 'Target LT', value: TARGET_LT, color: '#8A8A8A' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-[#e9e3df] p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1">{item.label}</p>
                <p className="kpi-number font-extrabold text-3xl leading-none" style={{ color: item.color }}>{item.value !== null ? `${item.value}d` : '—'}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-2">Early POs</p>
              <p className="kpi-number font-extrabold text-3xl text-pass">{summary.earlyCount}</p>
            </div>
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-2">Late POs</p>
              <p className="kpi-number font-extrabold text-3xl text-fail">{summary.lateCount}</p>
            </div>
          </div>

          {weeklyLT.length > 0 && (
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Production Lead Time — by week</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyLT} margin={{ top: 4, right: 16, left: -10, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9e3df" vertical={false} />
                  <XAxis dataKey="weekLabel" tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} unit="d" domain={[0, 'auto']} />
                  <ReferenceLine y={TARGET_LT} stroke="#DC3545" strokeDasharray="5 4" strokeWidth={1.5} />
                  <Tooltip contentStyle={{ background: '#403833', border: 'none', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#FF8900', fontWeight: 700 }} itemStyle={{ color: '#f9f7f6' }} formatter={(v: unknown, n: unknown) => [`${Number(v)}d`, String(n)]} />
                  {selectedCat === 'All' ? (
                    <>
                      <Bar dataKey="Mattresses" fill="#FF8900" fillOpacity={0.82} radius={[3, 3, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="Beds" fill="#6469aa" fillOpacity={0.82} radius={[3, 3, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="Accessories" fill="#34A853" fillOpacity={0.82} radius={[3, 3, 0, 0]} maxBarSize={22} />
                    </>
                  ) : (
                    <Bar dataKey={selectedCat} fill={selectedCat === 'Mattresses' ? '#FF8900' : selectedCat === 'Beds' ? '#6469aa' : '#34A853'} radius={[3, 3, 0, 0]} maxBarSize={30} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === 'summary' && byVendor.length > 0 && (
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Avg Lead Time by Vendor</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byVendor} margin={{ top: 4, right: 20, left: -10, bottom: 60 }}>
                  <XAxis dataKey="vendor" tick={{ fill: '#9c9794', fontSize: 11 }} angle={-40} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} unit="d" />
                  <ReferenceLine y={TARGET_LT} stroke="#F59E0B" strokeDasharray="4 4" />
                  <Tooltip contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, n: unknown) => [`${Number(v)}d`, String(n)]} />
                  <Legend verticalAlign="top" align="right" iconSize={8} formatter={(v) => <span style={{ color: '#58524e', fontSize: 11 }}>{v}</span>} />
                  <Bar dataKey="actual" fill="#FF8900" fillOpacity={0.82} radius={[3, 3, 0, 0]} name="Production LT" />
                  <Bar dataKey="agreed" fill="rgba(100,116,239,0.3)" radius={[3, 3, 0, 0]} name="Agreed LT" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === 'detail' && (
            <div className="bg-white rounded-lg overflow-hidden border border-[#e9e3df]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr className="bg-[#403833] text-white">
                      {['PO', 'Category', 'Vendor', 'Order Date', 'PGRD', 'ASD', 'Planned LT', 'Production LT', 'Agreed LT', 'vs Agreed', 'vs Target'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailByPO.map((r) => (
                      <tr key={r.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                        <td className="px-4 py-3 font-semibold text-[#403833] whitespace-nowrap">{r.po}</td>
                        <td className="px-4 py-3"><span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[r.category] }}>{r.category}</span></td>
                        <td className="px-4 py-3 text-[#58524e]">{r.vendor}</td>
                        <td className="px-4 py-3 text-[#58524e] whitespace-nowrap">{formatDateShort(r.orderDate)}</td>
                        <td className="px-4 py-3 text-[#58524e] whitespace-nowrap">{formatDateShort(r.pgrd)}</td>
                        <td className="px-4 py-3 text-[#58524e] whitespace-nowrap">{r.asd ? formatDateShort(r.asd) : <span className="text-[#b5aaa5]">—</span>}</td>
                        <td className="px-4 py-3 text-[#58524e]">{r.plannedLT != null ? `${r.plannedLT}d` : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[#403833]">{r.productionLT != null ? `${r.productionLT}d` : <span className="text-[#b5aaa5]">—</span>}</td>
                        <td className="px-4 py-3 text-[#7b7571]">{r.agreedLT}d</td>
                        <td className="px-4 py-3">{r.vsAgreed == null ? <span className="text-[#b5aaa5]">—</span> : r.vsAgreed < 0 ? <span className="text-pass font-semibold">{r.vsAgreed}d</span> : r.vsAgreed > 0 ? <span className="text-fail font-semibold">+{r.vsAgreed}d</span> : <span className="text-[#7b7571]">On time</span>}</td>
                        <td className="px-4 py-3">{r.vsTarget == null ? <span className="text-[#b5aaa5]">—</span> : r.vsTarget < 0 ? <span className="text-pass font-semibold">{r.vsTarget}d</span> : r.vsTarget > 0 ? <span className="text-fail font-semibold">+{r.vsTarget}d</span> : <span className="text-[#7b7571]">On time</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SlideOver>
    </>
  );
}
