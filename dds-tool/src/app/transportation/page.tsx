'use client';

import { useState, useMemo, Fragment } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid } from 'recharts';
import { NavTabs } from '../../components/shared/NavTabs';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { getISOWeek, lastCompletedWeek, formatDateShort } from '../../lib/dateUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6469aa', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function KpiCard({ label, value, unit, sub, deltaColor }: { label: string; value: string | number; unit?: string; sub?: string; deltaColor?: 'pass' | 'fail' | 'neutral' }) {
  const subColor = deltaColor === 'pass' ? 'text-pass' : deltaColor === 'fail' ? 'text-fail' : 'text-[#7b7571]';
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794] mb-2">{label}</p>
      <p className="text-[26px] font-bold leading-none text-[#403833] tracking-tight">
        {value}{unit && <span className="text-[13px] font-semibold text-[#9c9794] ml-1">{unit}</span>}
      </p>
      {sub && <p className={`text-[12px] font-semibold mt-1.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794]">{children}</span>
      <div className="flex-1 h-px bg-[#e9e3df]" />
    </div>
  );
}

export default function TransportationPage() {
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);

  // ── Not Booked state ──────────────────────────────────────────────────────
  const notBookedLines = kpis.notBookedLines;
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');

  const byPO = useMemo(() => {
    const map = new Map<string, { po: string; vendor: string; destination: string; pgrd: Date | null; lines: PurchaseLine[] }>();
    for (const l of notBookedLines) {
      if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, destination: l.destination, pgrd: l.pgrd, lines: [] });
      map.get(l.po)!.lines.push(l);
    }
    return [...map.values()].sort((a, b) => (a.pgrd?.getTime() ?? 0) - (b.pgrd?.getTime() ?? 0));
  }, [notBookedLines]);

  const catCounts = useMemo(() => {
    const counts: Record<SKUCategory, Set<string>> = { Beds: new Set(), Mattresses: new Set(), Accessories: new Set(), 'Comps/Other': new Set() };
    for (const l of notBookedLines) counts[categorizeSKU(l.sku)].add(l.po);
    return counts;
  }, [notBookedLines]);

  const totalPOs      = byPO.length;
  const totalNBLines  = notBookedLines.length;
  const activePOs     = new Set(accumulatingLines.map(l => l.po)).size;
  const pctUnbooked   = activePOs > 0 ? Math.round(totalPOs / activePOs * 100) : 0;
  const mostUrgentPgrd = byPO[0]?.pgrd;

  const filteredPOs = useMemo(() =>
    selectedCat === 'All' ? byPO : byPO.filter(g => g.lines.some(l => categorizeSKU(l.sku) === selectedCat)),
    [byPO, selectedCat]
  );

  // ── Pickups state ─────────────────────────────────────────────────────────
  const { week: realLastWeek } = lastCompletedWeek();
  const nextWeek = realLastWeek + 1;
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const pastWeekNums = useMemo(() =>
    kpis.weeklyTrend.filter(w => !w.isFuture).map(w => parseInt(w.weekLabel.replace('W', ''))),
    [kpis.weeklyTrend]
  );

  const chartData = useMemo(() =>
    [1, 2, 3, 4, 5].map((dow) => {
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
  const overallAvg    = pastWeekNums.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.avg, 0) / 5 * 10) / 10
    : 0;
  const totalExpected = Math.round(overallAvg * 5);
  const delta         = totalUpcoming - totalExpected;
  const busiestDay    = chartData.reduce((a, b) => a.upcoming >= b.upcoming ? a : b, chartData[0]);

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
    return [1, 2, 3, 4, 5].map(dow => ({
      dow,
      label: DOW_FULL[dow],
      pos: [...(map.get(dow)?.values() ?? [])],
    })).filter(d => d.pos.length > 0);
  }, [allD2cLines, nextWeek]);

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

      <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">

        {/* ── NOT BOOKED ─────────────────────────────────────────────────── */}
        <SectionLabel>Not Booked — POs missing pickup booking</SectionLabel>

        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="POs not booked"
            value={totalPOs}
            sub={totalPOs === 0 ? 'All POs have pickup booked' : `${totalNBLines} lines affected`}
            deltaColor={totalPOs === 0 ? 'pass' : 'fail'}
          />
          <KpiCard
            label="% of active POs"
            value={pctUnbooked}
            unit="%"
            sub={pctUnbooked === 0 ? 'clean' : `out of ${activePOs} active POs`}
            deltaColor={pctUnbooked === 0 ? 'pass' : 'fail'}
          />
          <KpiCard
            label="Most urgent PGRD"
            value={mostUrgentPgrd ? formatDateShort(mostUrgentPgrd) ?? '—' : '—'}
            sub={mostUrgentPgrd ? 'Earliest unbooked delivery' : 'No unbooked POs'}
            deltaColor={mostUrgentPgrd ? 'fail' : 'pass'}
          />
          <KpiCard
            label="By category"
            value={`${catCounts.Beds.size}B · ${catCounts.Mattresses.size}M · ${catCounts.Accessories.size}A`}
            sub="Beds · Mattresses · Accessories"
            deltaColor="neutral"
          />
        </div>

        {/* category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCat('All')}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${selectedCat === 'All' ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}>
            All categories
          </button>
          {SKU_CATEGORIES.map((c) => (
            <button key={c}
              onClick={() => setSelectedCat(c)}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all"
              style={selectedCat === c
                ? { background: CATEGORY_COLORS[c], color: '#f9f7f6', borderColor: CATEGORY_COLORS[c] }
                : { borderColor: '#e9e3df', color: '#58524e' }}>
              {c}
              {catCounts[c].size > 0 && <span className="ml-1.5 text-[10px] opacity-70">{catCounts[c].size}</span>}
            </button>
          ))}
          <span className="ml-auto text-xs text-[#9c9794]">{filteredPOs.length} PO{filteredPOs.length !== 1 ? 's' : ''}</span>
        </div>

        {filteredPOs.length > 0 ? (
          <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#e9e3df]">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">POs missing pickup booking — click to expand lines</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#403833] text-white">
                  {['PO', 'Vendor', 'Destination', 'PGRD', 'Category', 'Lines'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map((group) => {
                  const cats = [...new Set(group.lines.map(l => categorizeSKU(l.sku)))];
                  return (
                    <Fragment key={group.po}>
                      <tr
                        onClick={() => setExpandedPO(expandedPO === group.po ? null : group.po)}
                        className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#403833]">
                          <span className="flex items-center gap-2">
                            <span className="text-[#b5aaa5] text-xs">{expandedPO === group.po ? '▾' : '▸'}</span>
                            {group.po}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#58524e]">{group.vendor}</td>
                        <td className="px-4 py-3 text-[#58524e]">{group.destination}</td>
                        <td className="px-4 py-3 text-[#58524e] whitespace-nowrap">{formatDateShort(group.pgrd)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {cats.map(c => (
                              <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[c] }}>{c}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">
                            {group.lines.length} line{group.lines.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>
                      {expandedPO === group.po && (
                        <tr className="bg-[#faf7f3]">
                          <td colSpan={6} className="px-6 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[#9c9794] border-b border-[#e9e3df]">
                                  {['Line', 'SKU', 'Category', 'PGRD', 'Qty'].map((h) => (
                                    <th key={h} className="py-1.5 pr-6 text-left font-medium uppercase text-[10px] tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.lines.map((l) => {
                                  const cat = categorizeSKU(l.sku);
                                  return (
                                    <tr key={`${l.po}-${l.line}`} className="border-b border-[#f4f1ef] last:border-0">
                                      <td className="py-1.5 pr-6 text-[#7b7571]">{l.line}</td>
                                      <td className="py-1.5 pr-6 font-mono text-[#58524e]">{l.sku}</td>
                                      <td className="py-1.5 pr-6">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[cat] }}>{cat}</span>
                                      </td>
                                      <td className="py-1.5 pr-6 text-[#7b7571]">{formatDateShort(l.pgrd)}</td>
                                      <td className="py-1.5 pr-6 text-[#7b7571]">{l.qty}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center text-[#b5aaa5]" style={{ boxShadow: 'var(--shadow-card)' }}>
            {totalPOs === 0 ? 'All POs have pickup booked' : 'No POs match the selected category'}
          </div>
        )}

        {/* ── UPCOMING PICKUPS ───────────────────────────────────────────── */}
        <SectionLabel>Upcoming Pickups — W{String(nextWeek).padStart(2, '0')} ESD bookings</SectionLabel>

        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label={`Upcoming W${String(nextWeek).padStart(2, '0')}`}
            value={totalUpcoming}
            unit="POs"
            sub="ESD bookings next week"
            deltaColor="neutral"
          />
          <KpiCard
            label="Historical avg / week"
            value={totalExpected}
            unit="POs"
            sub={`${overallAvg}/day · ${pastWeekNums.length} weeks avg`}
            deltaColor="neutral"
          />
          <KpiCard
            label="vs average"
            value={`${delta > 0 ? '+' : ''}${delta}`}
            unit="POs"
            sub={delta > 0 ? 'busier than avg week' : delta < 0 ? 'quieter than avg week' : 'same as avg week'}
            deltaColor={delta === 0 ? 'neutral' : delta > 0 ? 'fail' : 'pass'}
          />
          <KpiCard
            label="Busiest day"
            value={busiestDay?.upcoming > 0 ? busiestDay.day : '—'}
            unit={busiestDay?.upcoming > 0 ? `${busiestDay.upcoming} POs` : undefined}
            sub={busiestDay?.upcoming > 0 ? 'highest pickup day' : 'no bookings yet'}
            deltaColor="neutral"
          />
        </div>

        <div className="bg-white rounded-lg p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">
            Upcoming W{String(nextWeek).padStart(2, '0')} vs Historical Average
          </p>
          <p className="text-[10px] text-[#b5aaa5] mb-5">
            Bars = ESD bookings for W{String(nextWeek).padStart(2, '0')} &middot; Dashed line = avg across W{String(pastWeekNums[0]).padStart(2, '0')}–W{String(pastWeekNums[pastWeekNums.length - 1]).padStart(2, '0')}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 16, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#f4f1ef" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#9c9794', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [`${v}`, n === 'upcoming' ? `W${nextWeek} upcoming` : 'Historical avg']}
              />
              <Bar dataKey="upcoming" fill="#FF8900" fillOpacity={0.82} radius={[4, 4, 0, 0]} name="upcoming">
                <LabelList dataKey="upcoming" position="top" style={{ fill: '#7b7571', fontSize: 12, fontWeight: 700 }}
                  formatter={(v: unknown) => Number(v) > 0 ? Number(v) : ''} />
              </Bar>
              <Line dataKey="avg" stroke="#6469aa" strokeWidth={2.5} dot={{ r: 4, fill: '#6469aa', strokeWidth: 0 }}
                strokeDasharray="5 3" name="avg" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {upcomingByDay.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">W{String(nextWeek).padStart(2, '0')} — by day</p>
            {upcomingByDay.map(dayGroup => (
              <div key={dayGroup.dow} className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="px-5 py-3 border-b border-[#f4f1ef] flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#403833]">{dayGroup.label}</span>
                  <span className="text-xs text-[#9c9794]">{dayGroup.pos.length} POs</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f9f7f6] border-b border-[#e9e3df]">
                      {['PO', 'Category', 'Vendor', 'Destination', 'Lines'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayGroup.pos.map((p, i) => (
                      <Fragment key={p.po}>
                        <tr
                          className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] cursor-pointer"
                          onClick={() => setExpandedDay(expandedDay === dayGroup.dow * 1000 + i ? null : dayGroup.dow * 1000 + i)}
                        >
                          <td className="px-4 py-2.5 font-semibold text-[#403833]">
                            <span className="flex items-center gap-2">
                              <span className="text-[#b5aaa5] text-xs">{expandedDay === dayGroup.dow * 1000 + i ? '▾' : '▸'}</span>
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
                          <td className="px-4 py-2.5 text-[#58524e]">{p.vendor}</td>
                          <td className="px-4 py-2.5 text-[#58524e]">{p.destination}</td>
                          <td className="px-4 py-2.5 text-xs text-[#7b7571]">{p.lines.length}</td>
                        </tr>
                        {expandedDay === dayGroup.dow * 1000 + i && (
                          <tr className="bg-[#faf7f3]">
                            <td colSpan={5} className="px-6 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[#9c9794] border-b border-[#e9e3df]">
                                    {['SKU', 'Category', 'ESD', 'PGRD'].map(h => (
                                      <th key={h} className="py-1.5 pr-6 text-left font-medium uppercase text-[10px] tracking-wide">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.lines.map(l => (
                                    <tr key={`${l.po}-${l.line}`} className="border-b border-[#f4f1ef] last:border-0">
                                      <td className="py-1.5 pr-6 font-mono text-[#58524e]">{l.sku}</td>
                                      <td className="py-1.5 pr-6">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[categorizeSKU(l.sku)] }}>{categorizeSKU(l.sku)}</span>
                                      </td>
                                      <td className="py-1.5 pr-6 text-[#58524e]">{formatDateShort(l.esd)}</td>
                                      <td className="py-1.5 pr-6 text-[#7b7571]">{formatDateShort(l.pgrd)}</td>
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
          <div className="bg-white rounded-lg p-8 text-center text-[#b5aaa5]" style={{ boxShadow: 'var(--shadow-card)' }}>
            No ESD bookings found for W{String(nextWeek).padStart(2, '0')}
          </div>
        )}
      </div>
    </div>
  );
}
