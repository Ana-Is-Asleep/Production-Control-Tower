'use client';

import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useAnnotations } from '../../hooks/useAnnotations';
import { useKPIs } from '../../hooks/useKPIs';
import { AnnotationRow } from '../../components/shared/AnnotationRow';
import { computeKPI } from '../../lib/kpiFormulas';
import { formatDateShort } from '../../lib/dateUtils';
import type { AnnotationEntry } from '../../types';

export default function SOTOTIFPage() {
  const router = useRouter();
  const { allLines } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines);
  const annotations = useAnnotations();
  const kpis = useKPIs(weeklyLines, accumulatingLines);

  const sotAnnotated = kpis.failingLines.filter((l) => computeKPI(l).sotFail && annotations.entries[`${l.po}-${l.line}`]?.reason).length;
  const sotTotal = kpis.failingLines.filter((l) => computeKPI(l).sotFail).length;
  const otifAnnotated = kpis.failingLines.filter((l) => computeKPI(l).otifFail && annotations.entries[`${l.po}-${l.line}`]?.reason).length;
  const otifTotal = kpis.failingLines.filter((l) => computeKPI(l).otifFail).length;

  return (
    <div className="min-h-screen bg-white page-enter">
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors flex items-center gap-1.5">
          ← Dashboard
        </button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">SOT + OTIF</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* hero numbers */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#F0F0F0] p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">SOT</p>
            <p className="font-serif text-7xl font-bold text-[#111]">
              {kpis.sotPct !== null ? `${kpis.sotPct}%` : '—'}
            </p>
            <p className={`text-sm font-medium mt-2 ${(kpis.sotPct ?? 0) >= 90 ? 'text-pass' : 'text-fail'}`}>
              {kpis.sotPct !== null ? `${kpis.sotPct >= 90 ? '↑' : '↓'} ${Math.abs(kpis.sotPct - 90)}pp vs 90% target` : 'No data'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">OTIF</p>
            <p className="font-serif text-7xl font-bold text-[#111]">
              {kpis.otifPct !== null ? `${kpis.otifPct}%` : '—'}
            </p>
            <p className={`text-sm font-medium mt-2 ${(kpis.otifPct ?? 0) >= 90 ? 'text-pass' : 'text-warn'}`}>
              {kpis.otifPct !== null ? `${kpis.otifPct >= 90 ? '↑' : '↓'} ${Math.abs(kpis.otifPct - 90)}pp vs 90% target` : 'No data'}
            </p>
          </div>
        </div>

        {/* 10-week trend chart */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-5">10-Week Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={kpis.weeklyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: '#AAA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#AAA', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
              <ReferenceLine y={90} stroke="#DDDDDD" strokeDasharray="4 4" />
              <Bar dataKey="sotOutOfTarget" fill="rgba(255,137,0,0.10)" radius={[3, 3, 0, 0]} />
              <Line dataKey="otifPct" stroke="#34A853" strokeWidth={2} dot={{ r: 3, fill: '#34A853' }} connectNulls={false} />
              <Line dataKey="sotPct" stroke="#FF8900" strokeWidth={2.5} dot={{ r: 3, fill: '#FF8900' }} activeDot={{ r: 5 }} connectNulls={false} />
              <Tooltip contentStyle={{ background: '#111', border: 'none', color: 'white', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#FF8900', fontWeight: 600 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* week breakdown table */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-6 py-4 border-b border-[#F0F0F0]">
            <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Week Breakdown</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-white">
                {['Week', 'Lines', 'SOT%', 'OTIF%', 'SOT Fails'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpis.weeklyTrend.filter((w) => !w.isFuture && w.totalLines > 0).map((w) => (
                <tr key={w.isoWeek} className={`border-b border-[#F7F7F7] ${w.isCurrent ? 'bg-[#FFFBF5]' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-[#111]">{w.weekLabel}</td>
                  <td className="px-4 py-2.5 text-[#555]">{w.totalLines}</td>
                  <td className={`px-4 py-2.5 font-semibold ${(w.sotPct ?? 0) >= 90 ? 'text-pass' : 'text-fail'}`}>{w.sotPct !== null ? `${w.sotPct}%` : '—'}</td>
                  <td className={`px-4 py-2.5 font-semibold ${(w.otifPct ?? 0) >= 90 ? 'text-pass' : 'text-warn'}`}>{w.otifPct !== null ? `${w.otifPct}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-[#555]">{w.sotOutOfTarget}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* annotations */}
        {kpis.failingLines.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Annotations</p>
              <div className="flex gap-4 text-xs text-[#888]">
                <span>SOT: <span className={sotAnnotated === sotTotal ? 'text-pass font-semibold' : 'text-fail font-semibold'}>{sotAnnotated}/{sotTotal}</span></span>
                <span>OTIF: <span className={otifAnnotated === otifTotal ? 'text-pass font-semibold' : 'text-warn font-semibold'}>{otifAnnotated}/{otifTotal}</span></span>
              </div>
            </div>
            <div className="space-y-2">
              {kpis.failingLines.map((line) => {
                const kpi = computeKPI(line);
                return (
                  <AnnotationRow
                    key={`${line.po}-${line.line}`}
                    line={line}
                    sotFail={kpi.sotFail}
                    otifFail={kpi.otifFail}
                    entry={annotations.entries[`${line.po}-${line.line}`]}
                    onUpdate={(key, data) => {
                      if (annotations.entries[key]) annotations.updateAnnotation(key, data);
                      else annotations.addAnnotation(key, data);
                    }}
                  />
                );
              })}
            </div>
            <div className="space-y-2 pt-2">
              <input type="text" placeholder="TM Name" value={annotations.tmName} onChange={(e) => annotations.setTmName(e.target.value)}
                className="w-full text-sm border border-[#EBEBEB] rounded-lg px-3 py-2 focus:outline-none focus:border-brand" />
              <textarea rows={3} placeholder="TM meeting notes..." value={annotations.tmComment} onChange={(e) => annotations.setTmComment(e.target.value)}
                className="w-full text-sm border border-[#EBEBEB] rounded-lg px-3 py-2 focus:outline-none focus:border-brand resize-none" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
