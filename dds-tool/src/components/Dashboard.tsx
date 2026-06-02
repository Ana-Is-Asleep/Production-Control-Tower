'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../context/DataContext';
import { useFilters, type ActiveFilters } from '../hooks/useFilters';
import { useKPIs } from '../hooks/useKPIs';
import { UploadPanel } from './upload/UploadPanel';
import { PrepareModal } from './PrepareModal';
import { SKU_CATEGORIES, type SKUCategory } from '../lib/skuUtils';
import type { PurchaseLine } from '../types';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1',
  'Mattresses': '#FF8900',
  'Accessories': '#34A853',
  'Comps/Other': '#8A8A8A',
};

export function Dashboard() {
  const router = useRouter();
  const { allLines, setAllLines, resetAnnotations, isAnnotated } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);

  const { filters, setFilters, weeklyLines, accumulatingLines, allSuppliers, availableWeeks, lastWeek, lastYear } = useFilters(allLines);
  const kpis = useKPIs(weeklyLines, accumulatingLines);

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

  return (
    <div className="min-h-screen w-full bg-white">
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
            <p className="font-serif text-6xl font-bold text-[#111] leading-tight">Ready when<br />you are.</p>
            <p className="text-[#999] text-base mt-4">Upload your Business Central exports to see this week&apos;s data.</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="bg-brand text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-brand-soft transition-colors shadow-sm"
          >
            ↑ Upload BC Files
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
          <div className="px-6 py-3 border-b border-[#F7F7F7] flex items-center gap-2 flex-wrap">
            {/* vendor pills */}
            <button
              onClick={() => setFilters({ ...filters, suppliers: [] })}
              className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium ${filters.suppliers.length === 0 ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
            >
              All vendors
            </button>
            {allSuppliers.map((s) => (
              <button
                key={s}
                onClick={() => toggleSupplier(s)}
                className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium ${filters.suppliers.includes(s) ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
              >
                {s}
              </button>
            ))}
            <span className="text-[#E0E0E0] mx-1">|</span>
            {/* category pills */}
            {SKU_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium ${filters.categories.includes(c) ? 'text-white border-transparent' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
                style={filters.categories.includes(c) ? { background: CATEGORY_COLORS[c] } : {}}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {/* primary KPI cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* SOT + OTIF */}
              <div onClick={() => router.push('/sot-otif')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">SOT + OTIF</p>
                <div className="flex items-end gap-8 mb-5">
                  <div>
                    <p className={`kpi-number font-serif text-6xl font-bold ${kpis.sotPct === null ? 'text-[#DDD]' : kpis.sotPct >= 90 ? 'text-pass' : 'text-fail'}`}>
                      {kpis.sotPct !== null ? `${kpis.sotPct}%` : '—'}
                    </p>
                    <p className="text-xs text-[#999] mt-1 uppercase tracking-wide">SOT</p>
                    {sotDelta !== null && (
                      <p className={`text-xs font-semibold mt-0.5 ${sotDelta >= 0 ? 'text-pass' : 'text-fail'}`}>
                        {sotDelta >= 0 ? '↑' : '↓'} {Math.abs(sotDelta)}pp
                      </p>
                    )}
                  </div>
                  <div>
                    <p className={`kpi-number font-serif text-6xl font-bold ${kpis.otifPct === null ? 'text-[#DDD]' : kpis.otifPct >= 90 ? 'text-pass' : 'text-warn'}`}>
                      {kpis.otifPct !== null ? `${kpis.otifPct}%` : '—'}
                    </p>
                    <p className="text-xs text-[#999] mt-1 uppercase tracking-wide">OTIF</p>
                    {otifDelta !== null && (
                      <p className={`text-xs font-semibold mt-0.5 ${otifDelta >= 0 ? 'text-pass' : 'text-warn'}`}>
                        {otifDelta >= 0 ? '↑' : '↓'} {Math.abs(otifDelta)}pp
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-[90px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={kpis.weeklyTrend} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#F5F5F5" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={{ fill: '#CCC', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} hide />
                      <ReferenceLine y={90} stroke="#E8E8E8" strokeDasharray="3 3" />
                      <Bar dataKey="sotOutOfTarget" fill="rgba(255,137,0,0.08)" radius={[2, 2, 0, 0]} />
                      <Line dataKey="otifPct" stroke="#34A853" strokeWidth={2} dot={false} connectNulls={false} />
                      <Line dataKey="sotPct" stroke="#FF8900" strokeWidth={2.5} dot={false} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-brand font-semibold mt-3">Drill down →</p>
              </div>

              {/* Backlog */}
              <div onClick={() => router.push('/backlog')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">Backlog</p>
                <div className="space-y-4 mb-5">
                  {[
                    { label: 'Critical', count: kpis.backlogSummary.critical.length, color: 'text-fail', dot: 'bg-fail', sub: '>14d no ASD' },
                    { label: 'Recent', count: kpis.backlogSummary.recent.length, color: 'text-warn', dot: 'bg-warn', sub: '≤14d no ASD' },
                    { label: 'At Risk', count: kpis.backlogSummary.atRisk.length, color: 'text-brand', dot: 'bg-brand', sub: 'ESD > PGRD' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                        <span className="text-sm text-[#555]">{item.label}</span>
                        <span className="text-xs text-[#CCC]">{item.sub}</span>
                      </div>
                      <span className={`kpi-number font-serif text-4xl font-bold ${item.color}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
                {backlogTotal === 0 && (
                  <div className="text-xs text-pass font-semibold bg-[#F0FFF4] rounded-lg px-3 py-2">✓ All clear</div>
                )}
                <p className="text-xs text-brand font-semibold mt-3">Drill down →</p>
              </div>

              {/* Not Booked */}
              <div onClick={() => router.push('/not-booked')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">Not Booked</p>
                <p className={`kpi-number font-serif text-8xl font-bold leading-none mb-2 ${notBookedPOs.length === 0 ? 'text-pass' : 'text-fail'}`}>
                  {notBookedPOs.length}
                </p>
                <p className="text-sm text-[#888]">POs without pickup booking</p>
                {notBookedPOs.length === 0 && (
                  <p className="text-xs text-pass font-semibold mt-3">✓ All POs booked</p>
                )}
                <p className="text-xs text-brand font-semibold mt-4">Drill down →</p>
              </div>
            </div>

            {/* secondary row */}
            <div className="grid grid-cols-4 gap-4">
              <div onClick={() => router.push('/sku')} className="kpi-card bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">SKU Deep Dive</p>
                <p className="kpi-number font-serif text-5xl font-bold text-[#111]">{weeklyLines.length}</p>
                <p className="text-xs text-[#999] mt-1">lines this week</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {kpis.failingLines.length > 0 && (
                    <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">{kpis.failingLines.length} failing</span>
                  )}
                </div>
                <p className="text-xs text-brand font-semibold mt-3">Drill down →</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">Invoices</p>
                <div className="space-y-2">
                  {[{ l: 'Overdue', v: '3', c: 'text-fail' }, { l: 'P2W', v: '1', c: 'text-warn' }, { l: 'On time', v: '14', c: 'text-pass' }].map((r) => (
                    <div key={r.l} className="flex justify-between items-center">
                      <span className="text-xs text-[#888]">{r.l}</span>
                      <span className={`font-serif text-2xl font-bold ${r.c}`}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 col-span-2" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">Pickup Distribution</p>
                <div className="flex items-end gap-2 h-16">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
                    const count = weeklyLines.filter((l) => l.asd && l.asd.getDay() === i + 1).length;
                    const max = Math.max(1, ...([0,1,2,3,4].map((j) => weeklyLines.filter((l) => l.asd && l.asd.getDay() === j + 1).length)));
                    return (
                      <div key={day} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-brand rounded-t transition-all" style={{ height: `${Math.max(4, (count / max) * 48)}px`, opacity: count === 0 ? 0.12 : 0.85 }} />
                        <span className="text-[10px] text-[#CCC]">{day}</span>
                      </div>
                    );
                  })}
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
