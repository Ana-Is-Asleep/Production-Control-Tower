'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI, computeExpectedSOT } from '../../lib/kpiFormulas';
import { categorizeSKU } from '../../lib/skuUtils';
import { formatDateShort, getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

const REASON_LABELS: Record<string, string> = {
  supplier_delay: 'Supplier delay', capacity_constraints: 'Capacity constraints',
  material_shortage: 'Material shortage', quality_issues: 'Quality issues',
  documentation_issue: 'Documentation issue', transit_delay: 'Transit delay',
  booking_not_made: 'Booking not made', data_issue: 'Data issue', other: 'Other',
};

type GroupBy = 'supplier' | 'po';

function VendorDropdown({ vendors, selected, onChange }: { vendors: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const label = selected.length === 0 ? 'All vendors' : selected.length === 1 ? selected[0] : `${selected.length} vendors`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium ${selected.length > 0 ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}>
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="opacity-40 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#F0F0F0] rounded-xl shadow-lg z-50 w-64 py-1 max-h-64 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#555] hover:bg-[#F9F9F9]'}`}>
            All vendors {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#F5F5F5] my-1" />
          {vendors.map((v) => (
            <button key={v} onClick={() => toggle(v)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#F9F9F9]">
              <span className={selected.includes(v) ? 'text-[#111] font-medium' : 'text-[#555]'}>{v}</span>
              {selected.includes(v) && <span className="text-brand">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SOTOTIFPage() {
  const router = useRouter();
  const { allLines, annotations, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);
  const [_groupBy, setGroupBy] = useState<GroupBy>('supplier');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [clickedWeek, setClickedWeek] = useState<string | null>(null);

  // clicking a week on the chart filters the breakdown to that week's lines
  const handleChartClick = (data: Record<string, unknown>) => {
    if (data?.activeLabel) {
      const label = String(data.activeLabel);
      setClickedWeek((prev) => prev === label ? null : label);
      setExpandedVendor(null);
    }
  };

  const sourceLines = useMemo(() => {
    if (clickedWeek) {
      const weekNum = parseInt(clickedWeek.replace('W', ''));
      return (allD2cLines ?? weeklyLines).filter((l) =>
        l.pgrd && getISOWeek(l.pgrd) === weekNum
      );
    }
    return weeklyLines;
  }, [weeklyLines, allD2cLines, clickedWeek]);

  const filteredLines = useMemo(() =>
    selectedVendors.length === 0 ? sourceLines : sourceLines.filter((l) => selectedVendors.includes(l.supplier)),
    [sourceLines, selectedVendors]
  );

  const enriched = useMemo(() => filteredLines.map((l) => ({ line: l, kpi: computeKPI(l), expectedSot: computeExpectedSOT(l) })), [filteredLines]);

  const allVendors = useMemo(() => [...new Set(weeklyLines.map((l) => l.supplier))].sort(), [weeklyLines]);

  // by vendor: aggregate SOT/OTIF per vendor with distinct PO count
  const bySupplier = useMemo(() => {
    const map = new Map<string, {
      pos: Set<string>; sotPass: number; sotEval: number; otifPass: number; otifEval: number;
      failingLines: PurchaseLine[];
    }>();
    enriched.forEach(({ line, kpi }) => {
      const s = line.supplier;
      if (!map.has(s)) map.set(s, { pos: new Set(), sotPass: 0, sotEval: 0, otifPass: 0, otifEval: 0, failingLines: [] });
      const e = map.get(s)!;
      e.pos.add(line.po);
      if (kpi.sotResult !== null) { e.sotEval++; if (kpi.sotResult) e.sotPass++; }
      if (kpi.otif !== null) { e.otifEval++; if (kpi.otif) e.otifPass++; }
      if (kpi.sotFail || kpi.otifFail) e.failingLines.push(line);
    });
    return [...map.entries()].map(([supplier, v]) => ({
      supplier,
      poCount: v.pos.size,
      sotPct: v.sotEval > 0 ? Math.round((v.sotPass / v.sotEval) * 100) : null,
      otifPct: v.otifEval > 0 ? Math.round((v.otifPass / v.otifEval) * 100) : null,
      failingLines: v.failingLines,
    })).sort((a, b) => (a.sotPct ?? 100) - (b.sotPct ?? 100));
  }, [enriched]);

  // auto-switch to PO view when only one vendor has data — no point comparing vendors
  const groupBy: GroupBy = bySupplier.length <= 1 ? 'po' : _groupBy;

  // chart: filter to selected vendors if any
  const chartData = useMemo(() => {
    if (selectedVendors.length === 0) return kpis.weeklyTrend;
    // recalculate trend for filtered vendors
    return kpis.weeklyTrend.map((w) => {
      const wLines = accumulatingLines.filter((l) =>
        selectedVendors.includes(l.supplier) && l.pgrd && getISOWeek(l.pgrd) === parseInt(w.weekLabel.replace('W', ''))
      );
      if (wLines.length === 0) return { ...w, sotPct: null, otifPct: null };
      const kpis_ = wLines.map(computeKPI);
      const sot = kpis_.filter((k) => k.sotResult !== null);
      const otif = kpis_.filter((k) => k.otif !== null);
      return {
        ...w,
        sotPct: sot.length > 0 ? Math.round(sot.filter((k) => k.sotResult).length / sot.length * 100) : null,
        otifPct: otif.length > 0 ? Math.round(otif.filter((k) => k.otif).length / otif.length * 100) : null,
      };
    });
  }, [kpis.weeklyTrend, selectedVendors, accumulatingLines]);

  // overall KPIs for filtered set
  const filteredSotPct = useMemo(() => {
    const ev = enriched.filter((r) => r.kpi.sotResult !== null);
    return ev.length > 0 ? Math.round(ev.filter((r) => r.kpi.sotResult).length / ev.length * 100) : kpis.sotPct;
  }, [enriched, kpis.sotPct]);
  const filteredOtifPct = useMemo(() => {
    const ev = enriched.filter((r) => r.kpi.otif !== null);
    return ev.length > 0 ? Math.round(ev.filter((r) => r.kpi.otif).length / ev.length * 100) : kpis.otifPct;
  }, [enriched, kpis.otifPct]);

  return (
    <div className="min-h-screen bg-[#F4F4F6] page-enter">
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">← Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">SOT + OTIF</span>
        <div className="flex-1" />
        <VendorDropdown vendors={allVendors} selected={selectedVendors} onChange={setSelectedVendors} />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-5 space-y-4 max-w-6xl mx-auto">
        {/* hero numbers */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'SOT', pct: filteredSotPct, goodColor: '#34A853', badColor: '#DC3545' },
            { label: 'OTIF', pct: filteredOtifPct, goodColor: '#34A853', badColor: '#F59E0B' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl px-7 py-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">{item.label} · target 90%</p>
              <p className="kpi-number text-8xl font-bold leading-none"
                style={{ color: item.pct === null ? '#DDD' : item.pct >= 90 ? item.goodColor : item.badColor }}>
                {item.pct !== null ? `${item.pct}%` : '—'}
              </p>
              {item.pct !== null && (
                <p className="text-sm font-semibold mt-2" style={{ color: item.pct >= 90 ? item.goodColor : item.badColor }}>
                  {item.pct >= 90 ? '↑' : '↓'} {Math.abs(item.pct - 90)}pp vs target
                </p>
              )}
            </div>
          ))}
        </div>

        {/* trend chart */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-1">Trend by PGRD Week</p>
          <p className="text-xs text-[#CCC] mb-5">Future SOT% estimated from ESD vs PGRD · click a week to filter breakdown</p>
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: -10, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: '#AAA', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: '#AAA', fontSize: 12 }} unit="%" axisLine={false} tickLine={false} />
              <YAxis yAxisId="pos" orientation="right" tick={{ fill: '#CCC', fontSize: 11 }} axisLine={false} tickLine={false} />
              <ReferenceLine yAxisId="pct" y={90} stroke="#FF8900" strokeDasharray="5 3" strokeOpacity={0.4} label={{ value: '90%', position: 'insideTopRight', fill: '#FF8900', fontSize: 10 }} />

              {/* stacked bars using emma palette — cream (SOT), orange (week backlog), dark burnt (past backlog) */}
              <Bar yAxisId="pos" dataKey="posSOT"        stackId="pos" fill="rgba(255,200,120,0.25)" name="PO Requested - SOT"    radius={[0,0,0,0]} />
              <Bar yAxisId="pos" dataKey="posBacklog"    stackId="pos" fill="#FFA236"                name="PO Requested - Backlog" radius={[0,0,0,0]} />
              <Bar yAxisId="pos" dataKey="pastPOBacklog" stackId="pos" fill="#7C3D12"               name="Past PO Backlog"         radius={[3,3,0,0]} />

              <Line yAxisId="pct" dataKey="otifPct" stroke="#34A853" strokeWidth={2.5} dot={{ r: 4, fill: '#34A853', strokeWidth: 0 }} name="OTIF %" connectNulls={false} />
              <Line yAxisId="pct" dataKey="sotPct"  stroke="#FF8900" strokeWidth={2.5} dot={{ r: 4, fill: '#FF8900', strokeWidth: 0 }} activeDot={{ r: 6 }} name="SOT %" connectNulls={false} />

              <Legend verticalAlign="bottom" align="center" iconType="square" iconSize={8} wrapperStyle={{ paddingTop: 16 }}
                formatter={(value) => <span style={{ color: '#555', fontSize: 11 }}>{value}</span>} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #F0F0F0', borderRadius: 10, fontSize: 12, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}
                labelStyle={{ color: '#FF8900', fontWeight: 700, marginBottom: 6 }}
                formatter={(value, name) => {
                  const n = String(name);
                  const color = n === 'SOT %' ? '#FF8900' : n === 'OTIF %' ? '#34A853' : n === 'Past PO Backlog' ? '#7C3D12' : n === 'PO Requested - Backlog' ? '#FFA236' : '#AAA';
                  const label = n === 'SOT %' || n === 'OTIF %' ? `${value}%` : `${value} POs`;
                  return [<span style={{ color }}>{label}</span>, n];
                }}
              />
              {clickedWeek && (
                <ReferenceArea yAxisId="pct" x1={clickedWeek} x2={clickedWeek} fill="rgba(255,137,0,0.10)" stroke="#FF8900" strokeOpacity={0.4} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* backlog detail — only shown when clicking the bars */}
        {clickedWeek && (() => {
          const weekNum = parseInt(clickedWeek.replace('W', ''));
          const wasUnshippedAsOf = (l: PurchaseLine) => !l.asd || getISOWeek(l.asd) > weekNum || getISOWeekYear(l.asd) > lastYear;
          const allSrc = allD2cLines ?? accumulatingLines;

          // group by supplier
          const groupBySupplier = (lines: PurchaseLine[]) => {
            const map = new Map<string, Set<string>>();
            lines.forEach(l => {
              if (!map.has(l.supplier)) map.set(l.supplier, new Set());
              map.get(l.supplier)!.add(l.po);
            });
            return [...map.entries()].map(([supplier, pos]) => ({ supplier, pos: [...pos] })).sort((a, b) => b.pos.length - a.pos.length);
          };

          const weekBacklogLines = allSrc.filter(l =>
            l.pgrd && getISOWeek(l.pgrd) === weekNum && getISOWeekYear(l.pgrd) === lastYear && wasUnshippedAsOf(l)
          );
          const pastBacklogLines = allSrc.filter(l =>
            l.pgrd && l.pgrd.getFullYear() >= 2026 &&
            (getISOWeekYear(l.pgrd) < lastYear || (getISOWeekYear(l.pgrd) === lastYear && getISOWeek(l.pgrd) < weekNum)) &&
            wasUnshippedAsOf(l)
          );

          const weekGroups = groupBySupplier(weekBacklogLines);
          const pastGroups = groupBySupplier(pastBacklogLines);
          const totalWeek = new Set(weekBacklogLines.map(l => l.po)).size;
          const totalPast = new Set(pastBacklogLines.map(l => l.po)).size;

          if (!totalWeek && !totalPast) return null;

          const BacklogGroup = ({ groups, total, title, color, dotColor }: { groups: { supplier: string; pos: string[] }[]; total: number; title: string; color: string; dotColor: string }) => (
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: dotColor }} />
                <p className="text-[11px] uppercase tracking-widest text-[#AAA]">{title}</p>
              </div>
              <p className="kpi-number font-extrabold text-5xl mb-4" style={{ color }}>{total}</p>
              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {groups.map(g => (
                  <div key={g.supplier}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-[#333]">{g.supplier}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: dotColor }}>{g.pos.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.pos.map(po => <span key={po} className="text-[10px] text-[#888] font-mono bg-[#F7F7F7] px-1.5 py-0.5 rounded">{po}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

          return (
            <div className="grid grid-cols-2 gap-4">
              {totalWeek > 0 && <BacklogGroup groups={weekGroups} total={totalWeek} title={`PO Requested - Backlog (${clickedWeek})`} color="#FFA236" dotColor="#FFA236" />}
              {totalPast > 0 && <BacklogGroup groups={pastGroups} total={totalPast} title={`Past PO Backlog (by ${clickedWeek})`} color="#7C3D12" dotColor="#7C3D12" />}
            </div>
          );
        })()}

        {/* breakdown */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">
                Breakdown — {clickedWeek ?? `W${String(lastWeek).padStart(2, '0')}`}
              </p>
              {clickedWeek && (
                <button onClick={() => setClickedWeek(null)} className="text-[10px] text-brand hover:text-brand-soft font-medium">
                  Clear ✕
                </button>
              )}
            </div>
            {bySupplier.length > 1 && (
              <div className="flex gap-1 bg-[#F5F5F5] p-0.5 rounded-lg">
                {(['supplier', 'po'] as GroupBy[]).map((g) => (
                  <button key={g} onClick={() => setGroupBy(g)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${groupBy === g ? 'bg-white text-[#111] shadow-sm' : 'text-[#888]'}`}>
                    By {g === 'po' ? 'PO' : 'Vendor'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {groupBy === 'supplier' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['Vendor', 'POs', 'SOT%', 'OTIF%', 'Failing'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySupplier.map((row) => (
                  <Fragment key={row.supplier}>
                    <tr
                      onClick={() => setExpandedVendor(expandedVendor === row.supplier ? null : row.supplier)}
                      className={`border-b border-[#F7F7F7] cursor-pointer transition-colors ${expandedVendor === row.supplier ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]'}`}
                    >
                      <td className="px-4 py-3 font-medium text-[#111]">
                        <span className="flex items-center gap-2">
                          <span className="text-[#CCC] text-xs">{expandedVendor === row.supplier ? '▾' : '▸'}</span>
                          {row.supplier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#555]">{row.poCount}</td>
                      <td className="px-4 py-3">
                        {row.sotPct !== null
                          ? <span className={`font-bold ${row.sotPct >= 90 ? 'text-pass' : row.sotPct >= 70 ? 'text-warn' : 'text-fail'}`}>{row.sotPct}%</span>
                          : <span className="text-[#CCC]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.otifPct !== null
                          ? <span className={`font-bold ${row.otifPct >= 90 ? 'text-pass' : row.otifPct >= 70 ? 'text-warn' : 'text-fail'}`}>{row.otifPct}%</span>
                          : <span className="text-[#CCC]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.failingLines.length > 0
                          ? <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">{row.failingLines.length}</span>
                          : <span className="text-pass text-xs font-medium">✓</span>}
                      </td>
                    </tr>
                    {expandedVendor === row.supplier && row.failingLines.length > 0 && (
                      <tr className="bg-[#FFFBF5]">
                        <td colSpan={5} className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#AAA] mb-2">Failing POs — {row.failingLines.length} lines</p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[#AAA] border-b border-[#F0F0F0]">
                                {['PO', 'SKU', 'Category', 'PGRD', 'ESD', 'Exp. SOT', 'SOT', 'OTIF', 'BC Reason'].map((h) => (
                                  <th key={h} className="py-1.5 pr-4 text-left font-medium uppercase text-[10px] tracking-wide">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {row.failingLines.map((l) => {
                                const kpi = computeKPI(l);
                                const expSot = computeExpectedSOT(l);
                                return (
                                  <tr key={`${l.po}-${l.line}`} className="border-b border-[#F5F5F5] last:border-0">
                                    <td className="py-1.5 pr-4 font-semibold text-[#111]">{l.po}</td>
                                    <td className="py-1.5 pr-4 font-mono text-[#555]">{l.sku}</td>
                                    <td className="py-1.5 pr-4 text-[#888]">{categorizeSKU(l.sku)}</td>
                                    <td className="py-1.5 pr-4 text-[#555]">{formatDateShort(l.pgrd)}</td>
                                    <td className="py-1.5 pr-4">
                                      {l.esd
                                        ? <span className="text-[#555]">{formatDateShort(l.esd)}</span>
                                        : <span className="text-fail">No ESD</span>}
                                    </td>
                                    <td className="py-1.5 pr-4">
                                      {expSot === null ? <span className="text-[#CCC]">—</span>
                                        : expSot ? <span className="text-pass font-medium">On track</span>
                                        : <span className="text-fail font-medium">At risk</span>}
                                    </td>
                                    <td className="py-1.5 pr-4">
                                      {kpi.sotResult === null ? <span className="text-[#CCC]">—</span>
                                        : kpi.sotResult ? <span className="text-pass font-bold">✓</span>
                                        : <span className="text-fail font-bold">✗</span>}
                                    </td>
                                    <td className="py-1.5 pr-4">
                                      {kpi.otif === null ? <span className="text-[#CCC]">—</span>
                                        : kpi.otif ? <span className="text-pass font-bold">✓</span>
                                        : <span className="text-warn font-bold">✗</span>}
                                    </td>
                                    <td className="py-1.5 pr-4">
                                      {l.lossReasonCode
                                        ? <span className="text-[10px] bg-[#FEF3C7] text-warn-text px-2 py-0.5 rounded-full">{l.lossReasonCode}</span>
                                        : <span className="text-[#CCC]">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    {expandedVendor === row.supplier && row.failingLines.length === 0 && (
                      <tr className="bg-[#F9FFF9]">
                        <td colSpan={5} className="px-4 py-3 text-xs text-pass font-medium">✓ No failing lines for this vendor</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {groupBy === 'po' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['PO', 'SKU', 'Category', 'Vendor', 'Dest.', 'PGRD', 'ASD', 'ESD', 'Exp. SOT', 'SOT', 'OTIF'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(({ line: l, kpi, expectedSot }) => (
                  <tr key={`${l.po}-${l.line}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
                    <td className="px-3 py-2.5 font-semibold text-[#111] whitespace-nowrap">{l.po}</td>
                    <td className="px-3 py-2.5 text-[#555] font-mono text-xs">{l.sku}</td>
                    <td className="px-3 py-2.5 text-xs text-[#888]">{categorizeSKU(l.sku)}</td>
                    <td className="px-3 py-2.5 text-[#555]">{l.supplier}</td>
                    <td className="px-3 py-2.5 text-[#555]">{l.destination}</td>
                    <td className="px-3 py-2.5 text-[#555] whitespace-nowrap">{formatDateShort(l.pgrd)}</td>
                    <td className="px-3 py-2.5 text-[#555] whitespace-nowrap">{formatDateShort(l.asd)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {l.esd ? <span className="text-[#555]">{formatDateShort(l.esd)}</span>
                        : <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full">No ESD</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {expectedSot === null ? <span className="text-[#CCC]">—</span>
                        : expectedSot ? <span className="text-pass text-xs font-medium">On track</span>
                        : <span className="text-fail text-xs font-medium">At risk</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {kpi.sotResult === null ? <span className="text-[#CCC]">—</span>
                        : kpi.sotResult ? <span className="text-pass font-bold">✓</span>
                        : <span className="text-fail font-bold">✗</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {kpi.otif === null ? <span className="text-[#CCC]">—</span>
                        : kpi.otif ? <span className="text-pass font-bold">✓</span>
                        : <span className="text-warn font-bold">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* root causes */}
        {kpis.failingLines.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-4 border-b border-[#F5F5F5]">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Root Causes — {kpis.failingLines.filter((l) => annotations[`${l.po}-${l.line}`]?.reason).length}/{kpis.failingLines.length} annotated</p>
            </div>
            <div className="p-5 space-y-2">
              {kpis.failingLines.map((line) => {
                const key = `${line.po}-${line.line}`;
                const kpi = computeKPI(line);
                const entry = annotations[key];
                return (
                  <div key={key} className={`rounded-xl border p-3.5 ${entry?.reason ? 'border-[#E8E8E8]' : 'border-[#FECACA] bg-[#FFFAFA]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#111]">{line.po}</span>
                          <span className="text-xs font-mono text-[#888]">{line.sku}</span>
                          <span className="text-xs text-[#AAA]">{line.supplier}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-[#CCC]">
                          <span>PGRD {formatDateShort(line.pgrd)}</span>
                          {line.asd && <span>ASD {formatDateShort(line.asd)}</span>}
                          {line.esd && <span>ESD {formatDateShort(line.esd)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {kpi.sotFail && <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">SOT</span>}
                        {kpi.otifFail && <span className="text-[10px] bg-[#FEF3C7] text-warn px-2 py-0.5 rounded-full font-medium">OTIF</span>}
                      </div>
                    </div>
                    {entry?.reason
                      ? <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs bg-[#F5F5F5] text-[#555] px-3 py-1 rounded-full font-medium">{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                          {(entry.tmComment || entry.scmComment) && <span className="text-xs text-[#888] italic">&ldquo;{entry.tmComment || entry.scmComment}&rdquo;</span>}
                        </div>
                      : <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {line.lossReasonCode && (
                            <span className="text-xs bg-[#FEF3C7] text-warn-text px-3 py-0.5 rounded-full font-medium">
                              BC: {line.lossReasonCode}
                            </span>
                          )}
                          <p className="text-xs text-[#CCC]">No annotation — add via Prepare for Meeting</p>
                        </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
