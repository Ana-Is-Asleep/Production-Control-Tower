'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI } from '../../lib/kpiFormulas';
import { categorizeSKU } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';

const REASON_LABELS: Record<string, string> = {
  supplier_delay: 'Supplier delay', capacity_constraints: 'Capacity constraints',
  material_shortage: 'Material shortage', quality_issues: 'Quality issues',
  documentation_issue: 'Documentation issue', transit_delay: 'Transit delay',
  booking_not_made: 'Booking not made', data_issue: 'Data issue', other: 'Other',
};

type GroupBy = 'supplier' | 'po';

function GroupedTable({ lines, groupBy }: { lines: ReturnType<typeof computeKPI> extends infer K ? { line: Parameters<typeof computeKPI>[0]; kpi: K }[] : never; groupBy: GroupBy }) {
  return null;
}

export default function SOTOTIFPage() {
  const router = useRouter();
  const { allLines, annotations, tmComment, tmName } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear, filters } = useFilters(allLines);
  const kpis = useKPIs(weeklyLines, accumulatingLines);
  const [groupBy, setGroupBy] = useState<GroupBy>('supplier');

  const enriched = useMemo(() => weeklyLines.map((l) => ({ line: l, kpi: computeKPI(l) })), [weeklyLines]);

  // group by supplier: show SOT/OTIF aggregated per vendor
  const bySupplier = useMemo(() => {
    const map = new Map<string, { total: number; sotPass: number; sotEval: number; otifPass: number; otifEval: number; fails: number }>();
    enriched.forEach(({ line, kpi }) => {
      const s = line.supplier;
      if (!map.has(s)) map.set(s, { total: 0, sotPass: 0, sotEval: 0, otifPass: 0, otifEval: 0, fails: 0 });
      const e = map.get(s)!;
      e.total++;
      if (kpi.sotResult !== null) { e.sotEval++; if (kpi.sotResult) e.sotPass++; }
      if (kpi.otif !== null) { e.otifEval++; if (kpi.otif) e.otifPass++; }
      if (kpi.sotFail || kpi.otifFail) e.fails++;
    });
    return [...map.entries()].map(([supplier, v]) => ({
      supplier, ...v,
      sotPct: v.sotEval > 0 ? Math.round((v.sotPass / v.sotEval) * 100) : null,
      otifPct: v.otifEval > 0 ? Math.round((v.otifPass / v.otifEval) * 100) : null,
    })).sort((a, b) => (a.sotPct ?? 100) - (b.sotPct ?? 100));
  }, [enriched]);

  return (
    <div className="min-h-screen bg-[#F4F4F6] page-enter">
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">← Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">SOT + OTIF</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-6 space-y-5 max-w-6xl mx-auto">
        {/* hero numbers */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'SOT', pct: kpis.sotPct, goodColor: '#34A853', badColor: '#DC3545' },
            { label: 'OTIF', pct: kpis.otifPct, goodColor: '#34A853', badColor: '#F59E0B' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl p-7" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">{item.label} · target 90%</p>
              <p className="kpi-number text-8xl font-extrabold leading-none"
                style={{ color: item.pct === null ? '#DDD' : item.pct >= 90 ? item.goodColor : item.badColor }}>
                {item.pct !== null ? `${item.pct}%` : '—'}
              </p>
              {item.pct !== null && (
                <p className="text-sm font-semibold mt-3" style={{ color: item.pct >= 90 ? item.goodColor : item.badColor }}>
                  {item.pct >= 90 ? '↑' : '↓'} {Math.abs(item.pct - 90)}pp vs target
                </p>
              )}
            </div>
          ))}
        </div>

        {/* trend chart — completed weeks only */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">8-Week Trend</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={kpis.weeklyTrend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: '#AAA', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#AAA', fontSize: 12 }} unit="%" axisLine={false} tickLine={false} />
              <ReferenceLine y={90} stroke="#CCC" strokeDasharray="4 4" label={{ value: '90% target', position: 'right', fill: '#CCC', fontSize: 11 }} />
              <Bar dataKey="sotOutOfTarget" fill="rgba(255,137,0,0.10)" radius={[3, 3, 0, 0]} name="SOT fails" />
              <Line dataKey="otifPct" stroke="#34A853" strokeWidth={2.5} dot={{ r: 4, fill: '#34A853', strokeWidth: 0 }} name="OTIF %" connectNulls={false} />
              <Line dataKey="sotPct" stroke="#FF8900" strokeWidth={2.5} dot={{ r: 4, fill: '#FF8900', strokeWidth: 0 }} activeDot={{ r: 6 }} name="SOT %" connectNulls={false} />
              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8}
                formatter={(value) => <span style={{ color: '#555', fontSize: 12 }}>{value}</span>} />
              <Tooltip
                contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 10, fontSize: 12, padding: '8px 12px' }}
                labelStyle={{ color: '#FF8900', fontWeight: 700, marginBottom: 4 }}
                formatter={(value, name) => [`${value}%`, name]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* grouping toggle + table */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Breakdown</p>
            <div className="flex gap-1 bg-[#F5F5F5] p-0.5 rounded-lg">
              {(['supplier', 'po'] as GroupBy[]).map((g) => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all capitalize ${groupBy === g ? 'bg-white text-[#111] shadow-sm' : 'text-[#888]'}`}>
                  By {g === 'po' ? 'PO' : 'Vendor'}
                </button>
              ))}
            </div>
          </div>

          {groupBy === 'supplier' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['Vendor', 'Lines', 'SOT%', 'OTIF%', 'Failing'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySupplier.map((row) => (
                  <tr key={row.supplier} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-medium text-[#111]">{row.supplier}</td>
                    <td className="px-4 py-3 text-[#555]">{row.total}</td>
                    <td className="px-4 py-3">
                      {row.sotPct !== null
                        ? <span className={`font-bold ${row.sotPct >= 90 ? 'text-pass' : 'text-fail'}`}>{row.sotPct}%</span>
                        : <span className="text-[#CCC]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.otifPct !== null
                        ? <span className={`font-bold ${row.otifPct >= 90 ? 'text-pass' : 'text-warn'}`}>{row.otifPct}%</span>
                        : <span className="text-[#CCC]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.fails > 0
                        ? <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">{row.fails}</span>
                        : <span className="text-pass text-xs">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['PO', 'SKU', 'Category', 'Vendor', 'Dest.', 'PGRD', 'ASD', 'EDD', 'SOT', 'OTIF'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(({ line: l, kpi }) => (
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
                        : <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full">No EDD</span>}
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

        {/* failing lines with root causes */}
        {kpis.failingLines.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-4 border-b border-[#F5F5F5]">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Root Causes — {kpis.failingLines.length} failing lines</p>
            </div>
            <div className="p-5 space-y-3">
              {kpis.failingLines.map((line) => {
                const key = `${line.po}-${line.line}`;
                const kpi = computeKPI(line);
                const entry = annotations[key];
                return (
                  <div key={key} className={`rounded-xl border p-4 ${entry?.reason ? 'border-[#E8E8E8]' : 'border-[#FECACA] bg-[#FFFAFA]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#111]">{line.po}</span>
                          <span className="text-xs font-mono text-[#888]">{line.sku}</span>
                          <span className="text-xs text-[#AAA]">{line.supplier}</span>
                          <span className="text-xs text-[#AAA]">{line.destination}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-[#CCC]">
                          <span>PGRD {formatDateShort(line.pgrd)}</span>
                          {line.asd && <span>ASD {formatDateShort(line.asd)}</span>}
                          {line.esd ? <span>EDD {formatDateShort(line.esd)}</span> : <span className="text-fail">No EDD</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {kpi.sotFail && <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">SOT</span>}
                        {kpi.otifFail && <span className="text-[10px] bg-[#FEF3C7] text-warn px-2 py-0.5 rounded-full font-medium">OTIF</span>}
                      </div>
                    </div>
                    {entry?.reason && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs bg-[#F5F5F5] text-[#555] px-3 py-1 rounded-full font-medium">
                          {REASON_LABELS[entry.reason] ?? entry.reason}
                        </span>
                        {entry.tmComment && <span className="text-xs text-[#888] italic">&ldquo;{entry.tmComment}&rdquo;</span>}
                        {entry.scmComment && <span className="text-xs text-[#888] italic">&ldquo;{entry.scmComment}&rdquo;</span>}
                      </div>
                    )}
                    {!entry?.reason && (
                      <p className="mt-1.5 text-xs text-[#CCC]">No root cause — add via Prepare for Meeting</p>
                    )}
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
