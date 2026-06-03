'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../context/DataContext';
import { useFilters, type ActiveFilters } from '../hooks/useFilters';
import { useKPIs } from '../hooks/useKPIs';
import { UploadPanel } from './upload/UploadPanel';
import { PrepareModal } from './PrepareModal';
import { SKU_CATEGORIES, type SKUCategory } from '../lib/skuUtils';
import { summariseLeadTimes } from '../lib/leadTimeUtils';
import type { PurchaseLine } from '../types';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1',
  'Mattresses': '#FF8900',
  'Accessories': '#34A853',
  'Comps/Other': '#8A8A8A',
};

function VendorDropdown({ allSuppliers, selected, onChange }: { allSuppliers: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = selected.length === 0 ? 'All vendors' : selected.length === 1 ? selected[0] : `${selected.length} vendors`;
  const toggle = (s: string) => onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`filter-pill flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium ${selected.length > 0 ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <span className="opacity-50 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#F0F0F0] rounded-xl shadow-lg z-50 w-72 py-1 max-h-72 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#555] hover:bg-[#F9F9F9]'}`}>
            All vendors {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#F5F5F5] my-1" />
          {allSuppliers.map((s) => (
            <button key={s} onClick={() => toggle(s)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#F9F9F9]">
              <span className={selected.includes(s) ? 'text-[#111] font-medium' : 'text-[#555]'}>{s}</span>
              {selected.includes(s) && <span className="text-brand text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const router = useRouter();
  const { allLines, setAllLines, resetAnnotations, isAnnotated } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);

  const { filters, setFilters, weeklyLines, accumulatingLines, allD2cLines, allSuppliers, availableWeeks, lastWeek, lastYear } = useFilters(allLines);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);

  const allAnnotated = useMemo(() => {
    if (kpis.failingLines.length === 0) return allLines.length > 0;
    return kpis.failingLines.every((l) => isAnnotated(`${l.po}-${l.line}`));
  }, [kpis.failingLines, isAnnotated, allLines.length]);

  const handleLoad = (lines: PurchaseLine[]) => {
    setAllLines(lines);
    resetAnnotations();
  };

  const toggleSupplier = (s: string) => {
    const next = filters.suppliers.includes(s) ? filters.suppliers.filter((x) => x !== s) : [...filters.suppliers, s];
    setFilters({ ...filters, suppliers: next });
  };

  const toggleCategory = (c: SKUCategory) => {
    const next = filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c];
    setFilters({ ...filters, categories: next });
  };

  const hasData = allLines.length > 0;
  const sotDelta = kpis.sotPct !== null ? kpis.sotPct - 90 : null;
  const otifDelta = kpis.otifPct !== null ? kpis.otifPct - 90 : null;
  const backlogTotal = kpis.backlogSummary.critical.length + kpis.backlogSummary.recent.length + kpis.backlogSummary.atRisk.length;
  const annotatedCount = kpis.failingLines.filter((l) => isAnnotated(`${l.po}-${l.line}`)).length;
  // not booked = unique POs, not lines
  const notBookedPOs = [...new Set(kpis.notBookedLines.map((l) => l.po))];
  const ltSummary = useMemo(() => summariseLeadTimes(weeklyLines), [weeklyLines]);

  return (
    <div className="min-h-screen w-full bg-[#F4F4F6]">
      {/* header */}
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-serif font-bold text-brand text-xl shrink-0">emma.</span>
        <span className="text-[#E0E0E0]">|</span>
        <span className="text-[#111] text-sm font-semibold shrink-0">DDS · P2W EU D2C</span>
        <div className="flex-1" />
        {hasData && (
          <>
            <span className="text-xs text-[#888] font-medium shrink-0">W{String(lastWeek).padStart(2, '0')} {lastYear}</span>
            <button onClick={() => setUploadOpen(true)} className="filter-pill text-xs border border-[#E0E0E0] rounded-lg px-3 py-1.5 text-[#555] hover:border-brand hover:text-brand">
              ↑ Upload
            </button>
            <button
              onClick={() => setPrepareOpen(true)}
              className={`filter-pill flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${allAnnotated ? 'bg-pass text-white' : 'bg-[#111] text-white hover:bg-[#333]'}`}
            >
              {allAnnotated
                ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Ready ✓</>
                : <>Prepare for Meeting {kpis.failingLines.length > 0 && <span className="bg-white/20 text-white text-xs rounded-full px-1.5">{annotatedCount}/{kpis.failingLines.length}</span>}</>
              }
            </button>
          </>
        )}
      </header>

      {/* empty state */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4 page-enter">
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#111]">No data loaded</p>
            <p className="text-[#999] text-sm mt-2">Upload your Business Central exports to begin the review.</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="bg-brand text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-brand-soft transition-colors"
          >
            Upload BC Files
          </button>
          {/* ghost cards */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-3xl opacity-[0.07] pointer-events-none select-none mt-4">
            {['SOT + OTIF', 'Backlog', 'Not Booked'].map((label) => (
              <div key={label} className="bg-[#F5F5F5] rounded-2xl p-8">
                <p className="text-xs uppercase tracking-widest text-[#AAA] mb-3">{label}</p>
                <p className="font-serif text-6xl font-bold text-[#DDD]">—</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* dashboard */}
      {hasData && (
        <div className="page-enter">
          {/* filter bar */}
          <div className="px-6 py-3 border-b border-[#F7F7F7] flex items-center gap-3">
            <VendorDropdown
              allSuppliers={allSuppliers}
              selected={filters.suppliers}
              onChange={(s) => setFilters({ ...filters, suppliers: s })}
            />
            <span className="text-[#E0E0E0]">|</span>
            {/* category pills — only 4 so these stay as pills */}
            {SKU_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium whitespace-nowrap ${filters.categories.includes(c) ? 'text-white border-transparent' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
                style={filters.categories.includes(c) ? { background: CATEGORY_COLORS[c] } : {}}
              >
                {c}
              </button>
            ))}
            <span className="text-[#E0E0E0]">|</span>
            {/* week filter */}
            <select
              value={filters.pgrdWeek ?? ''}
              onChange={(e) => setFilters({ ...filters, pgrdWeek: e.target.value ? Number(e.target.value) : null })}
              className="filter-pill text-xs px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-[#555] bg-white focus:outline-none focus:border-[#111] font-medium"
            >
              <option value="">All weeks</option>
              {availableWeeks.map((w) => (
                <option key={w} value={w}>W{String(w).padStart(2, '0')}</option>
              ))}
            </select>
            {(filters.suppliers.length > 0 || filters.categories.length > 0 || filters.pgrdWeek !== null) && (
              <button onClick={() => setFilters({ suppliers: [], categories: [], pgrdWeek: null })} className="text-xs text-[#AAA] hover:text-fail transition-colors">
                Clear ✕
              </button>
            )}
          </div>

          <div className="p-5 space-y-4">

            {/* SOT + OTIF — full width hero card */}
            <div onClick={() => router.push('/sot-otif')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-6 cursor-pointer" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start gap-10">
                {/* numbers left */}
                <div className="flex gap-10 shrink-0">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">SOT · target 90%</p>
                    <p className={`kpi-number font-extrabold text-8xl leading-none ${kpis.sotPct === null ? 'text-[#DDD]' : kpis.sotPct >= 90 ? 'text-pass' : 'text-fail'}`}>
                      {kpis.sotPct !== null ? `${kpis.sotPct}%` : '—'}
                    </p>
                    {sotDelta !== null && (
                      <p className={`text-sm font-semibold mt-2 ${sotDelta >= 0 ? 'text-pass' : 'text-fail'}`}>
                        {sotDelta >= 0 ? '↑' : '↓'} {Math.abs(sotDelta)}pp vs target
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">OTIF · target 90%</p>
                    <p className={`kpi-number font-extrabold text-8xl leading-none ${kpis.otifPct === null ? 'text-[#DDD]' : kpis.otifPct >= 90 ? 'text-pass' : 'text-warn'}`}>
                      {kpis.otifPct !== null ? `${kpis.otifPct}%` : '—'}
                    </p>
                    {otifDelta !== null && (
                      <p className={`text-sm font-semibold mt-2 ${otifDelta >= 0 ? 'text-pass' : 'text-warn'}`}>
                        {otifDelta >= 0 ? '↑' : '↓'} {Math.abs(otifDelta)}pp vs target
                      </p>
                    )}
                  </div>
                </div>
                {/* chart right — takes remaining space */}
                <div className="flex-1 h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={kpis.weeklyTrend} margin={{ top: 4, right: 40, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#F0F0F0" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: '#AAA', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                      <YAxis yAxisId="pos" orientation="right" tick={{ fill: '#CCC', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <ReferenceLine yAxisId="pct" y={90} stroke="#E0E0E0" strokeDasharray="4 4" />
                      <Bar yAxisId="pos" dataKey="totalPOs" fill="rgba(100,116,239,0.10)" radius={[2, 2, 0, 0]} name="POs" />
                      <Line yAxisId="pct" dataKey="otifPct" stroke="#34A853" strokeWidth={2.5} dot={{ r: 3, fill: '#34A853', strokeWidth: 0 }} name="OTIF %" connectNulls={false} />
                      <Line yAxisId="pct" dataKey="sotPct" stroke="#FF8900" strokeWidth={2.5} dot={{ r: 3, fill: '#FF8900', strokeWidth: 0 }} activeDot={{ r: 5 }} name="SOT %" connectNulls={false} />
                      <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#FF8900', fontWeight: 700 }} formatter={(v, n) => [String(n) === 'POs' ? `${v} POs` : `${v}%`, n]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p className="text-xs text-brand font-semibold mt-4">Drill down →</p>
            </div>

            {/* secondary row: Backlog, Not Booked, SKU, Invoices */}
            <div className="grid grid-cols-4 gap-4">
              <div onClick={() => router.push('/backlog')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Backlog</p>
                <div className="space-y-3">
                  {[
                    { label: 'Critical', count: new Set(kpis.backlogSummary.critical.map(l => l.po)).size, color: 'text-fail', sub: '>14d no ASD' },
                    { label: 'Recent',   count: new Set(kpis.backlogSummary.recent.map(l => l.po)).size,   color: 'text-warn', sub: '≤14d' },
                    { label: 'At Risk',  count: new Set(kpis.backlogSummary.atRisk.map(l => l.po)).size,   color: 'text-brand', sub: 'ESD>PGRD' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-baseline justify-between">
                      <div>
                        <span className="text-xs font-medium text-[#555]">{item.label}</span>
                        <span className="text-[10px] text-[#CCC] ml-1">{item.sub}</span>
                      </div>
                      <span className={`kpi-number font-extrabold text-3xl ${item.color}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-brand font-semibold mt-4">Drill down →</p>
              </div>

              <div onClick={() => router.push('/not-booked')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Not Booked</p>
                <p className={`kpi-number font-extrabold text-6xl leading-none mb-1 ${notBookedPOs.length === 0 ? 'text-pass' : 'text-fail'}`}>
                  {notBookedPOs.length}
                </p>
                <p className="text-xs text-[#888]">POs without ESD</p>
                <p className="text-xs text-brand font-semibold mt-4">Drill down →</p>
              </div>

              <div onClick={() => router.push('/sku')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">SKU Deep Dive</p>
                <p className="kpi-number font-extrabold text-6xl leading-none text-[#111]">{weeklyLines.length}</p>
                <p className="text-xs text-[#999] mt-1">lines this week</p>
                {kpis.failingLines.length > 0 && (
                  <span className="inline-block mt-3 text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">{kpis.failingLines.length} failing</span>
                )}
                <p className="text-xs text-brand font-semibold mt-3">Drill down →</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Invoices</p>
                <div className="space-y-3">
                  {[{ l: 'Overdue', v: '3', c: 'text-fail' }, { l: 'P2W', v: '1', c: 'text-warn' }, { l: 'On time', v: '14', c: 'text-pass' }].map((r) => (
                    <div key={r.l} className="flex items-baseline justify-between">
                      <span className="text-xs text-[#888]">{r.l}</span>
                      <span className={`kpi-number font-extrabold text-3xl ${r.c}`}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* pickup distribution — full width */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">Pickup Distribution</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart
                  data={['Mon','Tue','Wed','Thu','Fri'].map((day, i) => ({
                    day,
                    pickups: weeklyLines.filter((l) => l.asd && l.asd.getDay() === i + 1).length,
                  }))}
                  margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
                >
                  <XAxis dataKey="day" tick={{ fill: '#AAA', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pickups" fill="#FF8900" radius={[4, 4, 0, 0]} name="Pickups" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* lead times cluster */}
            <div onClick={() => router.push('/lead-times')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-6 cursor-pointer" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Lead Times</p>
                  <p className="text-xs text-[#CCC] mt-0.5">Order date → PGRD / EGRD / ASD · {ltSummary.totalEvaluable} shipped POs evaluated</p>
                </div>
                <p className="text-xs text-brand font-semibold">Drill down →</p>
              </div>
              <div className="grid grid-cols-6 gap-4">
                {/* avg LT comparison */}
                {[
                  { label: 'Planned LT', sub: 'Order → PGRD', value: ltSummary.avgPlannedLT, color: '#6366F1' },
                  { label: 'Expected LT', sub: 'Order → EGRD', value: ltSummary.avgExpectedLT, color: '#FF8900' },
                  { label: 'Actual LT', sub: 'Order → ASD', value: ltSummary.avgActualLT, color: ltSummary.avgActualLT !== null && ltSummary.avgActualLT <= ltSummary.avgAgreedLT ? '#34A853' : '#DC3545' },
                  { label: 'Agreed LT', sub: 'From file', value: ltSummary.avgAgreedLT, color: '#8A8A8A' },
                  { label: 'Target LT', sub: 'Always 30d', value: 30, color: '#8A8A8A' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col">
                    <span className="kpi-number font-extrabold text-4xl leading-none" style={{ color: item.color }}>
                      {item.value !== null ? `${item.value}d` : '—'}
                    </span>
                    <span className="text-xs font-semibold text-[#555] mt-2">{item.label}</span>
                    <span className="text-[10px] text-[#CCC] mt-0.5">{item.sub}</span>
                  </div>
                ))}
                {/* early / late column */}
                <div className="flex flex-col gap-2">
                  <div className={`rounded-xl px-3 py-2 ${ltSummary.earlyCount > 0 ? 'bg-[#F0FFF4]' : 'bg-[#F7F7F7]'}`}>
                    <p className="text-[10px] uppercase tracking-widest text-[#AAA]">Early</p>
                    <p className="font-extrabold text-xl text-pass">{ltSummary.earlyCount}</p>
                    {ltSummary.avgDaysEarly !== null && (
                      <p className="text-[10px] text-pass">avg {ltSummary.avgDaysEarly}d vs agreed</p>
                    )}
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${ltSummary.lateCount > 0 ? 'bg-[#FFF5F5]' : 'bg-[#F7F7F7]'}`}>
                    <p className="text-[10px] uppercase tracking-widest text-[#AAA]">Late</p>
                    <p className="font-extrabold text-xl text-fail">{ltSummary.lateCount}</p>
                    {ltSummary.avgDaysLate !== null && (
                      <p className="text-[10px] text-fail">avg +{ltSummary.avgDaysLate}d vs agreed</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
      {prepareOpen && <PrepareModal onClose={() => setPrepareOpen(false)} failingLines={kpis.failingLines} />}
    </div>
  );
}
