'use client';

import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI } from '../../lib/kpiFormulas';
import { categorizeSKU } from '../../lib/skuUtils';
import { formatDateShort } from '../../lib/dateUtils';

const REASON_LABELS: Record<string, string> = {
  supplier_delay: 'Supplier delay',
  capacity_constraints: 'Capacity constraints',
  material_shortage: 'Material shortage',
  quality_issues: 'Quality issues',
  documentation_issue: 'Documentation issue',
  transit_delay: 'Transit delay',
  booking_not_made: 'Booking not made',
  data_issue: 'Data issue',
  other: 'Other',
};

export default function SOTOTIFPage() {
  const router = useRouter();
  const { allLines, annotations, tmComment, tmName } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines);
  const kpis = useKPIs(weeklyLines, accumulatingLines);

  return (
    <div className="min-h-screen bg-white page-enter">
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">← Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">SOT + OTIF</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* hero numbers */}
        <div className="grid grid-cols-2 gap-5">
          {[
            { label: 'SOT', pct: kpis.sotPct, good: 'text-pass', bad: 'text-fail' },
            { label: 'OTIF', pct: kpis.otifPct, good: 'text-pass', bad: 'text-warn' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-[#F0F0F0] p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">{item.label}</p>
              <p className={`kpi-number font-serif text-8xl font-bold ${item.pct === null ? 'text-[#E0E0E0]' : item.pct >= 90 ? item.good : item.bad}`}>
                {item.pct !== null ? `${item.pct}%` : '—'}
              </p>
              {item.pct !== null && (
                <p className={`text-sm font-medium mt-2 ${item.pct >= 90 ? item.good : item.bad}`}>
                  {item.pct >= 90 ? '↑' : '↓'} {Math.abs(item.pct - 90)}pp vs 90% target
                </p>
              )}
            </div>
          ))}
        </div>

        {/* trend chart */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">10-Week Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={kpis.weeklyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: '#CCC', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#CCC', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
              <ReferenceLine y={90} stroke="#E8E8E8" strokeDasharray="4 4" />
              <Bar dataKey="sotOutOfTarget" fill="rgba(255,137,0,0.08)" radius={[3, 3, 0, 0]} />
              <Line dataKey="otifPct" stroke="#34A853" strokeWidth={2} dot={{ r: 3, fill: '#34A853' }} connectNulls={false} />
              <Line dataKey="sotPct" stroke="#FF8900" strokeWidth={2.5} dot={{ r: 3, fill: '#FF8900' }} activeDot={{ r: 5 }} connectNulls={false} />
              <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#FF8900', fontWeight: 600 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* failing lines with root causes */}
        {kpis.failingLines.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Root Causes — {kpis.failingLines.length} lines</p>
            {kpis.failingLines.map((line) => {
              const key = `${line.po}-${line.line}`;
              const kpi = computeKPI(line);
              const entry = annotations[key];
              const hasReason = !!entry?.reason;

              return (
                <div key={key} className={`rounded-xl border p-4 transition-all ${hasReason ? 'border-[#E0E0E0] bg-white' : 'border-[#FEE2E2] bg-[#FFFAFA]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#111]">{line.po}</span>
                        <span className="text-xs text-[#888]">{line.sku}</span>
                        <span className="text-[10px] text-[#CCC]">{categorizeSKU(line.sku)}</span>
                        <span className="text-xs text-[#AAA]">{line.supplier}</span>
                        <span className="text-xs text-[#AAA]">{line.destination}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-[#AAA]">
                        <span>PGRD {formatDateShort(line.pgrd)}</span>
                        {line.asd && <span>ASD {formatDateShort(line.asd)}</span>}
                        {line.esd ? <span>ESD {formatDateShort(line.esd)}</span> : <span className="text-fail">No ESD</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {kpi.sotFail && <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">SOT</span>}
                      {kpi.otifFail && <span className="text-[10px] bg-[#FEF3C7] text-warn px-2 py-0.5 rounded-full font-medium">OTIF</span>}
                    </div>
                  </div>

                  {hasReason ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs bg-[#F5F5F5] text-[#555] px-3 py-1 rounded-full font-medium">
                        {REASON_LABELS[entry.reason] ?? entry.reason}
                      </span>
                      {entry.tmComment && <span className="text-xs text-[#888] italic">&ldquo;{entry.tmComment}&rdquo;</span>}
                      {entry.scmComment && <span className="text-xs text-[#888] italic">&ldquo;{entry.scmComment}&rdquo;</span>}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-fail">No root cause added — use &ldquo;Prepare for Meeting&rdquo;</p>
                  )}
                </div>
              );
            })}

            {tmComment && (
              <div className="mt-2 p-4 bg-[#F9F9F9] rounded-xl border border-[#F0F0F0]">
                <p className="text-xs text-[#AAA] uppercase tracking-widest mb-1">TM Notes{tmName ? ` — ${tmName}` : ''}</p>
                <p className="text-sm text-[#555]">{tmComment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
