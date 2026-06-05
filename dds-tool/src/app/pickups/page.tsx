'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type RowStatus = 'shipped' | 'expected';

interface PickupRow {
  line: PurchaseLine;
  date: Date;
  dayOfWeek: number;
  status: RowStatus;
}

export default function PickupsPage() {
  const router = useRouter();
  const { allLines } = useData();
  const { weeklyLines, lastWeek, lastYear } = useFilters(allLines);
  const [filterDay, setFilterDay] = useState<number | null>(null); // 1=Mon..5=Fri
  const [filterStatus, setFilterStatus] = useState<RowStatus | 'all'>('all');

  // build pickup rows: shipped (ASD) + expected (ESD, no ASD)
  const allRows = useMemo((): PickupRow[] => {
    const rows: PickupRow[] = [];
    for (const line of weeklyLines) {
      if (line.asd) {
        rows.push({ line, date: line.asd, dayOfWeek: line.asd.getDay(), status: 'shipped' });
      } else if (line.esd) {
        rows.push({ line, date: line.esd, dayOfWeek: line.esd.getDay(), status: 'expected' });
      }
    }
    return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [weeklyLines]);

  const filtered = useMemo(() => {
    let r = allRows;
    if (filterDay !== null) r = r.filter((row) => row.dayOfWeek === filterDay);
    if (filterStatus !== 'all') r = r.filter((row) => row.status === filterStatus);
    return r;
  }, [allRows, filterDay, filterStatus]);

  // chart data Mon–Fri
  const chartData = useMemo(() =>
    [1,2,3,4,5].map((dow) => ({
      day: DAYS_SHORT[dow],
      shipped:  allRows.filter((r) => r.dayOfWeek === dow && r.status === 'shipped').length,
      expected: allRows.filter((r) => r.dayOfWeek === dow && r.status === 'expected').length,
    })),
    [allRows]
  );

  const totalShipped  = allRows.filter((r) => r.status === 'shipped').length;
  const totalExpected = allRows.filter((r) => r.status === 'expected').length;

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

      <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
        {/* hero numbers */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">Total this week</p>
            <p className="kpi-number font-extrabold text-6xl text-[#111]">{allRows.length}</p>
            <p className="text-xs text-[#888] mt-1">PO lines with ASD or ESD</p>
          </div>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">Shipped</p>
            <p className="kpi-number font-extrabold text-6xl text-pass">{totalShipped}</p>
            <p className="text-xs text-[#888] mt-1">ASD confirmed this week</p>
          </div>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">Expected</p>
            <p className="kpi-number font-extrabold text-6xl text-brand">{totalExpected}</p>
            <p className="text-xs text-[#888] mt-1">ESD predicted, not yet shipped</p>
          </div>
        </div>

        {/* chart + day filter */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">By Day — click a bar to filter the table</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              onClick={(d) => {
                if (!d?.activeLabel) return;
                const dow = DAYS_SHORT.indexOf(String(d.activeLabel));
                setFilterDay(filterDay === dow ? null : dow);
              }}
              style={{ cursor: 'pointer' }}
            >
              <XAxis dataKey="day" tick={{ fill: '#AAA', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [`${v} POs`, n === 'shipped' ? 'Shipped' : 'Expected']} />
              <Bar dataKey="shipped" stackId="a" fill="#FF8900" radius={[0,0,0,0]} name="shipped">
                <LabelList dataKey="shipped" position="inside" style={{ fill: 'white', fontSize: 11, fontWeight: 700 }}
                  formatter={(v: number) => v > 0 ? v : ''} />
              </Bar>
              <Bar dataKey="expected" stackId="a" fill="rgba(255,137,0,0.3)" radius={[4,4,0,0]} name="expected">
                <LabelList dataKey="expected" position="top" style={{ fill: '#FF8900', fontSize: 11, fontWeight: 700 }}
                  formatter={(v: number) => v > 0 ? `+${v}` : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-[#F5F5F5] p-0.5 rounded-lg">
            {(['all', 'shipped', 'expected'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium capitalize transition-all ${filterStatus === s ? 'bg-white text-[#111] shadow-sm' : 'text-[#888]'}`}>
                {s === 'all' ? 'All' : s === 'shipped' ? '✓ Shipped' : '~ Expected'}
              </button>
            ))}
          </div>
          {filterDay !== null && (
            <button onClick={() => setFilterDay(null)} className="text-xs text-brand font-medium">
              {DAYS[filterDay]} ✕
            </button>
          )}
          <span className="ml-auto text-xs text-[#AAA]">{filtered.length} lines</span>
        </div>

        {/* table */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-white">
                {['PO', 'SKU', 'Category', 'Vendor', 'Destination', 'Date', 'Day', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const cat = categorizeSKU(row.line.sku);
                return (
                  <tr key={`${row.line.po}-${row.line.line}-${i}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2.5 font-semibold text-[#111]">{row.line.po}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#555]">{row.line.sku}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[cat] }}>{cat}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[#555]">{row.line.supplier}</td>
                    <td className="px-4 py-2.5 text-[#555]">{row.line.destination}</td>
                    <td className="px-4 py-2.5 text-[#555] whitespace-nowrap">{formatDateShort(row.date)}</td>
                    <td className="px-4 py-2.5 text-[#555]">{DAYS[row.dayOfWeek]}</td>
                    <td className="px-4 py-2.5">
                      {row.status === 'shipped'
                        ? <span className="text-xs bg-[#DCFCE7] text-pass px-2 py-0.5 rounded-full font-medium">Shipped</span>
                        : <span className="text-xs bg-[#FFF3E0] text-brand px-2 py-0.5 rounded-full font-medium">Expected</span>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#CCC]">No pickups for selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
