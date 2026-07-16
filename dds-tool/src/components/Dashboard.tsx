'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../context/DataContext';
import { NavTabs } from './shared/NavTabs';
import { useFilters, type ActiveFilters } from '../hooks/useFilters';
import { useKPIs } from '../hooks/useKPIs';
import { UploadPanel } from './upload/UploadPanel';
import { PrepareModal } from './PrepareModal';
import { SKU_CATEGORIES, type SKUCategory } from '../lib/skuUtils';
import { summariseLeadTimes, computeWeeklyLT } from '../lib/leadTimeUtils';
import { getISOWeek } from '../lib/dateUtils';
import { computeKPIs, filterByChannel, formatAmountsByCurrency } from '../lib/invoiceUtils';
import type { PurchaseLine } from '../types';
import type { InvoiceRow, InvoiceChannel } from '../types/invoice';
import {
  ComposedChart, LineChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, LabelList, Legend,
} from 'recharts';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6469aa',
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
        className={`filter-pill flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium ${selected.length > 0 ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <span className="opacity-50 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-72 py-1 max-h-72 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#58524e] hover:bg-[#f9f7f6]'}`}>
            All vendors {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#e9e3df] my-1" />
          {allSuppliers.map((s) => (
            <button key={s} onClick={() => toggle(s)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#f9f7f6]">
              <span className={selected.includes(s) ? 'text-[#403833] font-medium' : 'text-[#58524e]'}>{s}</span>
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
  const { allLines, setAllLines, invoices, setInvoices, globalFilters, setGlobalFilters, resetAnnotations, isAnnotated } = useData();
  const [invoiceChannel, setInvoiceChannel] = useState<InvoiceChannel>('All');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);

  const { filters, setFilters: _setFilters, weeklyLines, accumulatingLines, allD2cLines, allSuppliers, availableWeeks, lastWeek, activeWeek, lastYear } = useFilters(allLines);

  // sync filters to context so drill-down pages inherit them
  const setFilters = useCallback((f: typeof filters) => {
    _setFilters(f);
    setGlobalFilters(f);
  }, [_setFilters, setGlobalFilters]);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);

  const allAnnotated = useMemo(() => {
    if (kpis.failingLines.length === 0) return allLines.length > 0;
    return kpis.failingLines.every((l) => isAnnotated(`${l.po}-${l.line}`));
  }, [kpis.failingLines, isAnnotated, allLines.length]);

  const handleLoad = (lines: PurchaseLine[], inv?: InvoiceRow[]) => {
    setAllLines(lines);
    if (inv) setInvoices(inv);
    resetAnnotations();
  };

  const filteredInvoices = useMemo(() => {
    let rows = filterByChannel(invoices, invoiceChannel);
    // when a vendor filter is active, also filter invoices by supplier name
    if (filters.suppliers.length > 0) {
      rows = rows.filter((r) => filters.suppliers.some((s) => r.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.name.toLowerCase())));
    }
    return rows;
  }, [invoices, invoiceChannel, filters.suppliers]);
  const invoiceKPIs = useMemo(() => computeKPIs(filteredInvoices), [filteredInvoices]);

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
  const backlogTotal = kpis.backlogSummary.critical.length + kpis.backlogSummary.recent.length + kpis.backlogSummary.futureBacklog.length;
  const annotatedCount = kpis.failingLines.filter((l) => isAnnotated(`${l.po}-${l.line}`)).length;
  // not booked = unique POs, not lines
  const notBookedPOs = [...new Set(kpis.notBookedLines.map((l) => l.po))];
  const ltSummary  = useMemo(() => summariseLeadTimes(weeklyLines), [weeklyLines]);
  const [ltCat, setLtCat] = useState<SKUCategory | 'All'>('All');
  const weeklyLT   = useMemo(() => computeWeeklyLT(accumulatingLines), [accumulatingLines]);
  // last 10 weeks for the mini chart
  const ltChartData = useMemo(() => weeklyLT.slice(-10), [weeklyLT]);

  return (
    <div className="min-h-screen w-full bg-[#f5f2ee]">
      {/* header */}
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-bold text-brand text-xl shrink-0 tracking-tight">emma<span className="text-[#403833]">.</span></span>
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        <div className="flex-1" />
        {hasData && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${filters.pgrdWeek !== null ? 'bg-brand text-white' : 'bg-[#f4f1ef] text-[#58524e]'}`}>
            W{String(activeWeek).padStart(2, '0')} {lastYear}
          </span>
        )}
        <button onClick={() => setUploadOpen(true)} className="filter-pill text-xs border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] hover:border-brand hover:text-brand shrink-0">
          ↑ Upload
        </button>
        {hasData && (
          <button
            onClick={() => setPrepareOpen(true)}
            className={`filter-pill flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all shrink-0 ${allAnnotated ? 'bg-pass text-white' : 'bg-[#403833] text-white hover:bg-[#58524e]'}`}
          >
            {allAnnotated
              ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Ready ✓</>
              : <>Prepare {kpis.failingLines.length > 0 && <span className="bg-white/20 text-white text-xs rounded-full px-1.5">{annotatedCount}/{kpis.failingLines.length}</span>}</>
            }
          </button>
        )}
      </header>

      {/* empty state */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4 page-enter">
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#403833]">No data loaded</p>
            <p className="text-[#9c9794] text-sm mt-2">Upload your Business Central exports to begin the review.</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="bg-brand text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors"
          >
            Upload BC Files
          </button>
          {/* ghost cards */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-3xl opacity-[0.07] pointer-events-none select-none mt-4">
            {['SOT + OTIF', 'Backlog', 'Not Booked'].map((label) => (
              <div key={label} className="bg-[#f4f1ef] rounded-lg p-8">
                <p className="text-xs uppercase tracking-widest text-[#9c9794] mb-3">{label}</p>
                <p className="font-sans text-6xl font-bold text-[#c8c0bb]">—</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* dashboard */}
      {hasData && (
        <div className="page-enter">
          {/* filter bar */}
          <div className="px-4 py-2 border-b border-[#e9e3df] flex items-center gap-2.5">
            <VendorDropdown
              allSuppliers={allSuppliers}
              selected={filters.suppliers}
              onChange={(s) => setFilters({ ...filters, suppliers: s })}
            />
            <span className="text-[#e9e3df]">|</span>
            {/* category pills — only 4 so these stay as pills */}
            {SKU_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`filter-pill text-xs px-3 py-1 rounded-full border font-medium whitespace-nowrap ${filters.categories.includes(c) ? 'text-white border-transparent' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
                style={filters.categories.includes(c) ? { background: CATEGORY_COLORS[c] } : {}}
              >
                {c}
              </button>
            ))}
            <span className="text-[#e9e3df]">|</span>
            {/* week filter */}
            <select
              value={filters.pgrdWeek ?? ''}
              onChange={(e) => setFilters({ ...filters, pgrdWeek: e.target.value ? Number(e.target.value) : null })}
              className={`filter-pill text-xs px-3 py-1.5 rounded-lg border font-medium bg-white focus:outline-none ${filters.pgrdWeek !== null ? 'border-[#403833] text-[#403833]' : 'border-[#e9e3df] text-[#58524e]'}`}
            >
              <option value="">W{String(lastWeek).padStart(2, '0')} {lastYear} (current)</option>
              {availableWeeks.filter(w => w !== lastWeek).map((w) => (
                <option key={w} value={w}>W{String(w).padStart(2, '0')}</option>
              ))}
            </select>
            {(filters.suppliers.length > 0 || filters.categories.length > 0 || filters.pgrdWeek !== null) && (
              <button onClick={() => setFilters({ suppliers: [], categories: [], pgrdWeek: null })} className="text-xs text-[#9c9794] hover:text-fail transition-colors">
                Clear ✕
              </button>
            )}
          </div>

          <div className="px-4 pt-2 pb-2 flex flex-col gap-2" style={{ height: 'calc(100vh - 96px)' }}>

            {/* row 1: Performance hero (SOT+OTIF + Backlog) */}
            <div onClick={() => router.push('/performance')} className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex-[3] min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-stretch gap-8 h-full">
                <div className="flex gap-6 shrink-0 items-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1.5">SOT · 90% target</p>
                    <p className={`kpi-number font-extrabold text-5xl leading-none ${kpis.sotPct === null ? 'text-[#c8c0bb]' : kpis.sotPct >= 90 ? 'text-pass' : 'text-fail'}`}>
                      {kpis.sotPct !== null ? `${kpis.sotPct}%` : '—'}
                    </p>
                    {sotDelta !== null && <p className={`text-xs font-semibold mt-1.5 ${sotDelta >= 0 ? 'text-pass' : 'text-fail'}`}>{sotDelta >= 0 ? '↑' : '↓'} {Math.abs(sotDelta)}pp vs target</p>}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1.5">OTIF · 90% target</p>
                    <p className={`kpi-number font-extrabold text-5xl leading-none ${kpis.otifPct === null ? 'text-[#c8c0bb]' : kpis.otifPct >= 90 ? 'text-pass' : 'text-warn'}`}>
                      {kpis.otifPct !== null ? `${kpis.otifPct}%` : '—'}
                    </p>
                    {otifDelta !== null && <p className={`text-xs font-semibold mt-1.5 ${otifDelta >= 0 ? 'text-pass' : 'text-warn'}`}>{otifDelta >= 0 ? '↑' : '↓'} {Math.abs(otifDelta)}pp vs target</p>}
                  </div>
                  <div className="w-px bg-[#e9e3df] self-stretch mx-1 shrink-0" />
                  <div className="flex flex-col justify-center gap-2">
                    <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Backlog</p>
                    {[
                      { label: 'Critical', count: new Set(kpis.backlogSummary.critical.map(l => l.po)).size, color: 'text-fail' },
                      { label: 'Recent',   count: new Set(kpis.backlogSummary.recent.map(l => l.po)).size,   color: 'text-warn' },
                      { label: 'Future',   count: new Set(kpis.backlogSummary.futureBacklog.map(l => l.po)).size, color: 'text-brand' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-baseline justify-between gap-3">
                        <span className="text-xs text-[#9c9794]">{item.label}</span>
                        <span className={`kpi-number font-extrabold text-2xl leading-none ${item.color}`}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-brand font-semibold self-end pb-1">Drill down →</p>
                </div>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={kpis.weeklyTrend} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e9e3df" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: '#9c9794', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                      <YAxis yAxisId="pos" orientation="right" hide />
                      <ReferenceLine yAxisId="pct" y={90} stroke="#d5cdc6" strokeDasharray="4 4" />
                      <defs>
                        <linearGradient id="db-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34A853" stopOpacity={0.78} /><stop offset="100%" stopColor="#34A853" stopOpacity={0.85} /></linearGradient>
                        <linearGradient id="db-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F59E0B" stopOpacity={0.78} /><stop offset="100%" stopColor="#F59E0B" stopOpacity={0.85} /></linearGradient>
                        <linearGradient id="db-red"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#DC2626" stopOpacity={0.78} /><stop offset="100%" stopColor="#DC2626" stopOpacity={0.85} /></linearGradient>
                      </defs>
                      <Bar yAxisId="pos" dataKey="posPredictedSOT" stackId="s" fill="url(#db-green)" fillOpacity={0.82} radius={[0,0,0,0]} />
                      <Bar yAxisId="pos" dataKey="posShipped"      stackId="s" fill="url(#db-green)" fillOpacity={0.82} radius={[0,0,0,0]} />
                      <Bar yAxisId="pos" dataKey="posBacklog"      stackId="s" fill="url(#db-amber)" fillOpacity={0.82} radius={[0,0,0,0]} />
                      <Bar yAxisId="pos" dataKey="pastPOBacklog"   stackId="s" fill="url(#db-red)" fillOpacity={0.82}   radius={[2,2,0,0]} />
                      <Line yAxisId="pct" dataKey="otifPct" stroke="#15803d" strokeWidth={2} dot={{ r: 3, fill: '#15803d', strokeWidth: 0 }} name="OTIF %" connectNulls={false} />
                      <Line yAxisId="pct" dataKey="sotPct"  stroke="#FF8900" strokeWidth={2} dot={{ r: 3, fill: '#FF8900', strokeWidth: 0 }} activeDot={{ r: 4 }} name="SOT %" connectNulls={false} />
                      <Tooltip contentStyle={{ background: '#403833', border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }} labelStyle={{ color: '#ffa236', fontWeight: 700 }} itemStyle={{ color: '#f9f7f6' }} formatter={(v, n) => { const s = String(n); return [s.includes('%') ? `${v}%` : `${v} POs`, s]; }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* row 2: Transportation | Invoices */}
            <div className="grid grid-cols-2 gap-2 flex-[2] min-h-0">

              {/* Transportation: not booked (left) + pickup chart (right) */}
              <div onClick={() => router.push('/transportation')} className="kpi-card bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Transportation</p>
                  <p className="text-[10px] text-brand font-semibold">Drill down →</p>
                </div>
                <div className="flex items-stretch gap-4 flex-1 min-h-0">
                  <div className="flex flex-col justify-center shrink-0">
                    <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1">Not booked</p>
                    <p className={`kpi-number font-extrabold text-4xl leading-none ${notBookedPOs.length === 0 ? 'text-pass' : 'text-fail'}`}>{notBookedPOs.length}</p>
                    <p className="text-[10px] text-[#9c9794] mt-1">POs without ESD</p>
                  </div>
                  <div className="w-px bg-[#e9e3df] shrink-0" />
                  <div className="flex-1 flex flex-col min-w-0">
                    <p className="text-[10px] text-[#b5aaa5] mb-1">W{String(lastWeek + 1).padStart(2, '0')} upcoming · avg line</p>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={[1,2,3,4,5].map((dow, i) => {
                            const days = ['Mon','Tue','Wed','Thu','Fri'];
                            const nextWeek = lastWeek + 1;
                            const upcoming = new Set(allD2cLines.filter(l => !l.asd && l.esd && l.esd.getDay() === dow && getISOWeek(l.esd) === nextWeek).map(l => l.po)).size;
                            const pastWeekNums = kpis.weeklyTrend.filter(w => !w.isFuture && w.isCurrent === false).map(w => parseInt(w.weekLabel.replace('W','')));
                            const avgPerWeek = pastWeekNums.map(w => new Set(accumulatingLines.filter(l => l.asd && l.asd.getDay() === dow && getISOWeek(l.asd) === w).map(l => l.po)).size);
                            const avg = pastWeekNums.length > 0 ? Math.round(avgPerWeek.reduce((s,n) => s+n, 0) / pastWeekNums.length * 10) / 10 : 0;
                            return { day: days[i], upcoming, avg };
                          })}
                          margin={{ top: 8, right: 0, left: -24, bottom: 0 }}
                        >
                          <XAxis dataKey="day" tick={{ fill: '#9c9794', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#9c9794', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 11 }}
                            formatter={(v, n) => [`${v}`, n === 'upcoming' ? 'Upcoming POs' : 'Hist. avg']} />
                          <defs>
                            <linearGradient id="db-orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF8900" stopOpacity={0.78} /><stop offset="100%" stopColor="#FF8900" stopOpacity={0.85} /></linearGradient>
                          </defs>
                          <Bar dataKey="upcoming" fill="url(#db-orange)" fillOpacity={0.82} radius={[3,3,0,0]} name="upcoming">
                            <LabelList dataKey="upcoming" position="top" style={{ fill: '#7b7571', fontSize: 10, fontWeight: 600 }}
                              formatter={(v: unknown) => Number(v) > 0 ? Number(v) : ''} />
                          </Bar>
                          <Line dataKey="avg" stroke="#6469aa" strokeWidth={2} dot={{ r: 3, fill: '#6469aa', strokeWidth: 0 }} name="avg" strokeDasharray="4 4" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div onClick={() => router.push('/invoices')} className="kpi-card bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col justify-between" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Invoices</p>
                  {invoices.length > 0 && (
                    <div className="flex gap-1">
                      {(['All', 'Online', 'Offline'] as InvoiceChannel[]).map((c) => (
                        <button key={c} onClick={(e) => { e.stopPropagation(); setInvoiceChannel(c); }}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-all ${invoiceChannel === c ? 'bg-[#403833] text-white' : 'text-[#9c9794] hover:text-[#58524e]'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {invoices.length === 0 ? (
                  <p className="text-xs text-[#b5aaa5] mt-2">Upload invoice file to see data</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs text-[#777]">Overdue P2W</span>
                        <p className="text-[10px] text-[#b5aaa5]">{formatAmountsByCurrency(invoiceKPIs.overdueP2w)}</p>
                      </div>
                      <span className="kpi-number font-extrabold text-3xl text-fail">{invoiceKPIs.overdueP2w.length}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs text-[#777]">Total Pending</span>
                        <p className="text-[10px] text-[#b5aaa5]">{formatAmountsByCurrency(invoiceKPIs.totalPending)}</p>
                      </div>
                      <span className="kpi-number font-extrabold text-3xl text-warn">{invoiceKPIs.totalPending.length}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs text-[#777]">Approved, Awaiting</span>
                        <p className="text-[10px] text-[#b5aaa5]">{formatAmountsByCurrency(invoiceKPIs.approvedNotPaid)}</p>
                      </div>
                      <span className="kpi-number font-extrabold text-3xl text-pass">{invoiceKPIs.approvedNotPaid.length}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-brand font-semibold mt-2">Drill down →</p>
              </div>
            </div>

            {/* row 3: lead times — weekly bar chart, click to drill down */}
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex-[2] min-h-0 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Production Lead Time</p>
                  {ltSummary.avgProductionLT !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ltSummary.avgProductionLT <= 30 ? 'bg-[#DCFCE7] text-pass' : 'bg-[#FEE2E2] text-fail'}`}>
                      {ltSummary.avgProductionLT}d avg this week
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* category filter pills — stop propagation so they don't trigger navigation */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setLtCat('All'); }}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${ltCat === 'All' ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571]'}`}>
                    All
                  </button>
                  {SKU_CATEGORIES.filter(c => c !== 'Comps/Other').map((c) => (
                    <button key={c}
                      onClick={(e) => { e.stopPropagation(); setLtCat(c); }}
                      className="text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all"
                      style={ltCat === c ? { background: CATEGORY_COLORS[c], color: '#f9f7f6', borderColor: CATEGORY_COLORS[c] } : { borderColor: '#e9e3df', color: '#7b7571' }}>
                      {c}
                    </button>
                  ))}
                  <span className="w-px h-4 bg-[#e9e3df] mx-1" />
                  <button
                    onClick={() => router.push('/lead-times')}
                    className="text-[11px] text-brand font-semibold hover:underline">
                    View all →
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ltChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9e3df" vertical={false} />
                  <XAxis dataKey="weekLabel" tick={{ fill: '#9c9794', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9c9794', fontSize: 10 }} axisLine={false} tickLine={false} unit="d" domain={[0, 'auto']} />
                  <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '30d', position: 'right', fill: '#dc2626', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#403833', border: 'none', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#ffa236', fontWeight: 700 }}
                    itemStyle={{ color: '#f9f7f6' }}
                    formatter={(v: unknown) => [`${Number(v)}d`, '']}
                  />
                  <defs>
                    <linearGradient id="db-lt-orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF8900" stopOpacity={0.78} /><stop offset="100%" stopColor="#FF8900" stopOpacity={0.85} /></linearGradient>
                    <linearGradient id="db-lt-purple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6469aa" stopOpacity={0.78} /><stop offset="100%" stopColor="#6469aa" stopOpacity={0.85} /></linearGradient>
                    <linearGradient id="db-lt-green"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34A853" stopOpacity={0.78} /><stop offset="100%" stopColor="#34A853" stopOpacity={0.85} /></linearGradient>
                  </defs>
                  {ltCat === 'All' ? (
                    <>
                      <Bar dataKey="Mattresses"  fill="url(#db-lt-orange)" fillOpacity={0.82} radius={[3,3,0,0]} maxBarSize={20} />
                      <Bar dataKey="Beds"        fill="url(#db-lt-purple)" fillOpacity={0.82} radius={[3,3,0,0]} maxBarSize={20} />
                      <Bar dataKey="Accessories" fill="url(#db-lt-green)" fillOpacity={0.82}  radius={[3,3,0,0]} maxBarSize={20} />
                    </>
                  ) : (
                    <Bar dataKey={ltCat} fill={ltCat === 'Mattresses' ? 'url(#db-lt-orange)' : ltCat === 'Beds' ? 'url(#db-lt-purple)' : 'url(#db-lt-green)'} radius={[3,3,0,0]} maxBarSize={30} />
                  )}
                </BarChart>
              </ResponsiveContainer>
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
