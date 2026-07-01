'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid, ReferenceLine } from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { getISOWeek, lastCompletedWeek, formatDateShort } from '../../lib/dateUtils';
import { categorizeSKU, type SKUCategory } from '../../lib/skuUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PickupsPage() {
  const router = useRouter();
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear, activeWeek } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);

  // always use the real next week for bars, not affected by week filter
  const { week: realLastWeek } = lastCompletedWeek();
  const nextWeek = realLastWeek + 1;

  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // SOT trend past weeks for the avg line
  const pastWeekNums = useMemo(() =>
    kpis.weeklyTrend.filter(w => !w.isFuture).map(w => parseInt(w.weekLabel.replace('W', ''))),
    [kpis.weeklyTrend]
  );

  // chart data: bars = upcoming (next real week), line = historical avg
  const chartData = useMemo(() =>
    [1,2,3,4,5].map((dow) => {
      const upcoming = new Set(
        allD2cLines.filter(l => !l.asd && l.esd && l.esd.getDay() === dow && getISOWeek(l.esd) === nextWeek).map(l => l.po)
      ).size;
      const avgPerWeek = pastWeekNums.map(w =>
        new Set(accumulatingLines.filter(l => l.asd && l.asd.getDay() === dow && getISOWeek(l.asd) === w).map(l => l.po)).size
      );
      const avg = pastWeekNums.length > 0
        ? Math.round(avgPerWeek.reduce((s, n) => s + n, 0) / pastWeekNums.length * 10) / 10
        : 0;
      return { day: DOW[dow], dow, upcoming, avg };
    }),
    [allD2cLines, accumulatingLines, nextWeek, pastWeekNums]
  );

  const totalUpcoming = chartData.reduce((s, d) => s + d.upcoming, 0);
  const overallAvg = pastWeekNums.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.avg, 0) / 5 * 10) / 10
    : 0;

  // upcoming POs per day for the table
  const upcomingByDay = useMemo(() => {
    const map = new Map<number, Map<string, { po: string; vendor: string; destination: string; lines: PurchaseLine[]; cats: SKUCategory[] }>>();
    for (const line of allD2cLines) {
      if (line.asd || !line.esd) continue;
      if (getISOWeek(line.esd) !== nextWeek) continue;
      const dow = line.esd.getDay();
      if (!map.has(dow)) map.set(dow, new Map());
      const dayMap = map.get(dow)!;
      if (!dayMap.has(line.po)) dayMap.set(line.po, { po: line.po, vendor: line.supplier, destination: line.destination, lines: [], cats: [] });
      const entry = dayMap.get(line.po)!;
      entry.lines.push(line);
      const cat = categorizeSKU(line.sku);
      if (!entry.cats.includes(cat)) entry.cats.push(cat);
    }
    return [1,2,3,4,5].map(dow => ({
      dow,
      label: DOW_FULL[dow],
      pos: [...(map.get(dow)?.values() ?? [])],
    })).filter(d => d.pos.length > 0);
  }, [allD2cLines, nextWeek]);

  return (
    <div className="min-h-screen bg-[#F4F4F6] page-enter">
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">&larr; Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Pickups</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          Upcoming W{String(nextWeek).padStart(2,'0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">
        {/* KPI cards */}
        {(() => {
          const totalExpected = Math.round(overallAvg * 5);
          const delta = totalUpcoming - totalExpected;
          const busiestDay = chartData.reduce((a, b) => a.upcoming >= b.upcoming ? a : b, chartData[0]);
          return (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-[#F0F0F0] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#AAA] mb-2">Upcoming W{String(nextWeek).padStart(2,'0')}</p>
                <p className="text-[26px] font-bold leading-none text-[#111] tracking-tight">
                  {totalUpcoming}<span className="text-[13px] font-semibold text-[#AAA] ml-1">POs</span>
                </p>
                <p className="text-[12px] font-semibold mt-1.5 text-[#888]">ESD bookings next week</p>
              </div>
              <div className="bg-white rounded-xl border border-[#F0F0F0] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#AAA] mb-2">Historical avg / week</p>
                <p className="text-[26px] font-bold leading-none text-[#111] tracking-tight">
                  {totalExpected}<span className="text-[13px] font-semibold text-[#AAA] ml-1">POs</span>
                </p>
                <p className="text-[12px] font-semibold mt-1.5 text-[#888]">{overallAvg}/day · {pastWeekNums.length} weeks avg</p>
              </div>
              <div className="bg-white rounded-xl border border-[#F0F0F0] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#AAA] mb-2">vs average</p>
                <p className={`text-[26px] font-bold leading-none tracking-tight ${delta === 0 ? 'text-[#111]' : delta > 0 ? 'text-fail' : 'text-pass'}`}>
                  {delta > 0 ? '+' : ''}{delta}<span className="text-[13px] font-semibold text-[#AAA] ml-1">POs</span>
                </p>
                <p className={`text-[12px] font-semibold mt-1.5 ${delta > 0 ? 'text-fail' : delta < 0 ? 'text-pass' : 'text-[#888]'}`}>
                  {delta > 0 ? 'busier than avg week' : delta < 0 ? 'quieter than avg week' : 'same as avg week'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#F0F0F0] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#AAA] mb-2">Busiest day</p>
                <p className="text-[26px] font-bold leading-none text-[#111] tracking-tight">
                  {busiestDay?.upcoming > 0 ? busiestDay.day : '—'}<span className="text-[13px] font-semibold text-[#AAA] ml-1">{busiestDay?.upcoming > 0 ? `${busiestDay.upcoming} POs` : ''}</span>
                </p>
                <p className="text-[12px] font-semibold mt-1.5 text-[#888]">{busiestDay?.upcoming > 0 ? 'highest pickup day' : 'no bookings yet'}</p>
              </div>
            </div>
          );
        })()}

        {/* main chart */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-1">
            Upcoming W{String(nextWeek).padStart(2,'0')} vs Historical Average
          </p>
          <p className="text-[10px] text-[#CCC] mb-5">
            Bars = ESD bookings for W{String(nextWeek).padStart(2,'0')} &middot; Dashed line = avg across W{String(pastWeekNums[0]).padStart(2,'0')}–W{String(pastWeekNums[pastWeekNums.length-1]).padStart(2,'0')}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 16, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#F5F5F5" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#AAA', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [`${v}`, n === 'upcoming' ? `W${nextWeek} upcoming` : 'Historical avg']} />
              <Bar dataKey="upcoming" fill="#FF8900" radius={[4,4,0,0]} name="upcoming">
                <LabelList dataKey="upcoming" position="top" style={{ fill: '#888', fontSize: 12, fontWeight: 700 }}
                  formatter={(v: unknown) => Number(v) > 0 ? Number(v) : ''} />
              </Bar>
              <Line dataKey="avg" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }}
                strokeDasharray="5 3" name="avg" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* upcoming POs table per day */}
        {upcomingByDay.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Upcoming W{String(nextWeek).padStart(2,'0')} — by day</p>
            {upcomingByDay.map(dayGroup => (
              <div key={dayGroup.dow} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="px-5 py-3 border-b border-[#F5F5F5] flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#111]">{dayGroup.label}</span>
                  <span className="text-xs text-[#AAA]">{dayGroup.pos.length} POs</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F9F9F9] border-b border-[#F0F0F0]">
                      {['PO', 'Category', 'Vendor', 'Destination', 'Lines'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#AAA]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayGroup.pos.map((p, i) => (
                      <Fragment key={p.po}>
                        <tr
                          className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] cursor-pointer"
                          onClick={() => setExpandedDay(expandedDay === dayGroup.dow * 1000 + i ? null : dayGroup.dow * 1000 + i)}
                        >
                          <td className="px-4 py-2.5 font-semibold text-[#111]">
                            <span className="flex items-center gap-2">
                              <span className="text-[#CCC] text-xs">{expandedDay === dayGroup.dow * 1000 + i ? '▾' : '▸'}</span>
                              {p.po}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {p.cats.map(c => (
                                <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[c] }}>{c}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-[#555]">{p.vendor}</td>
                          <td className="px-4 py-2.5 text-[#555]">{p.destination}</td>
                          <td className="px-4 py-2.5 text-xs text-[#888]">{p.lines.length}</td>
                        </tr>
                        {expandedDay === dayGroup.dow * 1000 + i && (
                          <tr className="bg-[#FFFBF5]">
                            <td colSpan={5} className="px-6 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[#AAA] border-b border-[#F0F0F0]">
                                    {['SKU', 'Category', 'ESD', 'PGRD'].map(h => (
                                      <th key={h} className="py-1.5 pr-6 text-left font-medium uppercase text-[10px] tracking-wide">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.lines.map(l => (
                                    <tr key={`${l.po}-${l.line}`} className="border-b border-[#F5F5F5] last:border-0">
                                      <td className="py-1.5 pr-6 font-mono text-[#555]">{l.sku}</td>
                                      <td className="py-1.5 pr-6">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[categorizeSKU(l.sku)] }}>{categorizeSKU(l.sku)}</span>
                                      </td>
                                      <td className="py-1.5 pr-6 text-[#555]">{formatDateShort(l.esd)}</td>
                                      <td className="py-1.5 pr-6 text-[#888]">{formatDateShort(l.pgrd)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {upcomingByDay.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center text-[#CCC]" style={{ boxShadow: 'var(--shadow-card)' }}>
            No ESD bookings found for W{String(nextWeek).padStart(2,'0')}
          </div>
        )}
      </div>
    </div>
  );
}
