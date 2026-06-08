'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { getISOWeek } from '../../lib/dateUtils';
import { categorizeSKU, type SKUCategory } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type RowStatus = 'shipped' | 'expected';

interface PickupPO {
  po: string;
  vendor: string;
  destination: string;
  lines: PurchaseLine[];
  categories: SKUCategory[];
  date: Date;
  dayOfWeek: number;
  status: RowStatus;
}

export default function PickupsPage() {
  const router = useRouter();
  const { allLines, globalFilters } = useData();
  const { weeklyLines, lastWeek, activeWeek, lastYear } = useFilters(allLines, globalFilters);
  const [filterDay, setFilterDay] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<RowStatus | 'all'>('all');

  // group by PO, one row per PO per pickup date
  const allPOs = useMemo((): PickupPO[] => {
    const map = new Map<string, PickupPO>();
    for (const line of weeklyLines) {
      const pickupDate = line.asd ?? line.esd;
      // only include pickups that actually happen in the active week
      if (!pickupDate || getISOWeek(pickupDate) !== activeWeek) continue;
      const status: RowStatus = line.asd ? 'shipped' : 'expected';
      const key = `${line.po}||${status}`;
      if (!map.has(key)) {
        map.set(key, {
          po: line.po,
          vendor: line.supplier,
          destination: line.destination,
          lines: [],
          categories: [],
          date: pickupDate,
          dayOfWeek: pickupDate.getDay(),
          status,
        });
      }
      const entry = map.get(key)!;
      entry.lines.push(line);
      const cat = categorizeSKU(line.sku);
      if (!entry.categories.includes(cat)) entry.categories.push(cat);
    }
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [weeklyLines]);

  const filtered = useMemo(() => {
    let r = allPOs;
    if (filterDay !== null) r = r.filter((p) => p.dayOfWeek === filterDay);
    if (filterStatus !== 'all') r = r.filter((p) => p.status === filterStatus);
    return r;
  }, [allPOs, filterDay, filterStatus]);

  // chart Mon–Fri
  const chartData = useMemo(() =>
    [1,2,3,4,5].map((dow) => ({
      day: DAYS[dow],
      dow,
      shipped:  allPOs.filter((p) => p.dayOfWeek === dow && p.status === 'shipped').length,
      expected: allPOs.filter((p) => p.dayOfWeek === dow && p.status === 'expected').length,
    })),
    [allPOs]
  );

  const totalShipped  = allPOs.filter((p) => p.status === 'shipped').length;
  const totalExpected = allPOs.filter((p) => p.status === 'expected').length;

  // group filtered rows by day for the table
  const byDay = useMemo(() => {
    const days = [1,2,3,4,5].map((dow) => ({
      dow,
      label: DAYS_FULL[dow],
      rows: filtered.filter((p) => p.dayOfWeek === dow),
    })).filter((d) => d.rows.length > 0);
    return days;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#F4F4F6] page-enter">
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">← Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Pickups</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">
        {/* hero */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total POs', value: allPOs.length, sub: 'this week', color: 'text-[#111]' },
            { label: 'Shipped', value: totalShipped, sub: 'ASD confirmed', color: 'text-pass' },
            { label: 'Expected', value: totalExpected, sub: 'ESD predicted', color: 'text-brand' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">{item.label}</p>
              <p className={`kpi-number font-extrabold text-6xl ${item.color}`}>{item.value}</p>
              <p className="text-xs text-[#888] mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* chart — click day to filter */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Pickups by Day</p>
            <p className="text-[10px] text-[#CCC]">Click a bar to filter · solid = shipped · light = expected</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              onClick={(d) => {
                if (!d?.activePayload?.[0]) return;
                const dow = (d.activePayload[0].payload as { dow: number }).dow;
                setFilterDay(filterDay === dow ? null : dow);
              }}
              style={{ cursor: 'pointer' }}
            >
              <XAxis dataKey="day" tick={{ fill: '#AAA', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [`${v} POs`, n === 'shipped' ? 'Shipped' : 'Expected']}
              />
              <Bar dataKey="shipped" stackId="a" name="shipped" radius={[0,0,0,0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.day} fill={filterDay === entry.dow ? '#cc6d00' : '#FF8900'} />
                ))}
                <LabelList dataKey="shipped" position="inside" style={{ fill: 'white', fontSize: 11, fontWeight: 700 }}
                  formatter={(v: unknown) => Number(v) > 0 ? Number(v) : ''} />
              </Bar>
              <Bar dataKey="expected" stackId="a" name="expected" radius={[4,4,0,0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.day} fill={filterDay === entry.dow ? 'rgba(255,137,0,0.45)' : 'rgba(255,137,0,0.2)'} />
                ))}
                <LabelList dataKey="expected" position="top" style={{ fill: '#FF8900', fontSize: 11, fontWeight: 700 }}
                  formatter={(v: unknown) => Number(v) > 0 ? `+${Number(v)}` : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* filters */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#F5F5F5] p-0.5 rounded-lg">
            {(['all', 'shipped', 'expected'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${filterStatus === s ? 'bg-white text-[#111] shadow-sm' : 'text-[#888]'}`}>
                {s === 'all' ? 'All' : s === 'shipped' ? '✓ Shipped' : '~ Expected'}
              </button>
            ))}
          </div>
          {filterDay !== null && (
            <button onClick={() => setFilterDay(null)} className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
              {DAYS_FULL[filterDay]} <span className="opacity-70">✕</span>
            </button>
          )}
          <span className="ml-auto text-xs text-[#AAA]">{filtered.length} POs</span>
        </div>

        {/* table grouped by day */}
        {byDay.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center text-[#CCC]" style={{ boxShadow: 'var(--shadow-card)' }}>
            No pickups for selected filters
          </div>
        )}

        {byDay.map((dayGroup) => (
          <div key={dayGroup.dow} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#F5F5F5] flex items-center gap-3">
              <span className="text-sm font-semibold text-[#111]">{dayGroup.label}</span>
              <span className="text-xs text-[#AAA]">{formatDateShort(dayGroup.rows[0].date)}</span>
              <span className="ml-auto text-xs text-[#AAA]">{dayGroup.rows.length} POs</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#F0F0F0]">
                  {['PO', 'Category', 'Vendor', 'Destination', 'Lines', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#AAA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayGroup.rows.map((row, i) => (
                  <tr key={`${row.po}-${i}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-[#111]">{row.po}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {row.categories.map((c) => (
                          <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[c] }}>{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#555]">{row.vendor}</td>
                    <td className="px-4 py-2.5 text-[#555]">{row.destination}</td>
                    <td className="px-4 py-2.5 text-[#888] text-xs">{row.lines.length}</td>
                    <td className="px-4 py-2.5">
                      {row.status === 'shipped'
                        ? <span className="text-xs bg-[#DCFCE7] text-pass px-2 py-0.5 rounded-full font-medium">Shipped</span>
                        : <span className="text-xs bg-[#FFF3E0] text-brand px-2 py-0.5 rounded-full font-medium">Expected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
