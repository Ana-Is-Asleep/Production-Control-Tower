'use client';

import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { AnnotationRow } from '../shared/AnnotationRow';
import type { WeeklyKPIPoint, PurchaseLine, AnnotationEntry } from '../../types';
import { computeKPI } from '../../lib/kpiFormulas';
import { formatDateShort } from '../../lib/dateUtils';

interface SOTOTIFCardProps {
  sotPct: number | null;
  otifPct: number | null;
  weeklyTrend: WeeklyKPIPoint[];
  failingLines: PurchaseLine[];
  annotations: Record<string, AnnotationEntry>;
  onUpdateAnnotation: (key: string, data: Partial<AnnotationEntry>) => void;
  tmComment: string;
  setTmComment: (v: string) => void;
  tmName: string;
  setTmName: (v: string) => void;
  weeklyLines: PurchaseLine[];
}

export function SOTOTIFCard({
  sotPct, otifPct, weeklyTrend, failingLines,
  annotations, onUpdateAnnotation, tmComment, setTmComment, tmName, setTmName, weeklyLines,
}: SOTOTIFCardProps) {
  const [expanded, setExpanded] = useState(false);

  const sotVariant = sotPct === null ? 'neutral' : sotPct >= 90 ? 'pass' : 'fail';
  const otifVariant = otifPct === null ? 'neutral' : otifPct >= 90 ? 'pass' : 'warn';

  const sotDelta = sotPct !== null ? sotPct - 90 : null;
  const otifDelta = otifPct !== null ? otifPct - 90 : null;

  const sotAnnotated = failingLines
    .filter((l) => computeKPI(l).sotFail)
    .filter((l) => annotations[`${l.po}-${l.line}`]?.reason).length;
  const sotTotal = failingLines.filter((l) => computeKPI(l).sotFail).length;

  const otifAnnotated = failingLines
    .filter((l) => computeKPI(l).otifFail)
    .filter((l) => annotations[`${l.po}-${l.line}`]?.reason).length;
  const otifTotal = failingLines.filter((l) => computeKPI(l).otifFail).length;

  return (
    <Card className="h-full">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">SOT + OTIF</h3>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted hover:text-dark transition-colors"
          >
            {expanded ? '? Collapse' : '? Expand'}
          </button>
        </div>

        <div className="flex items-end gap-8 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-sans text-4xl font-bold text-dark">
                {sotPct !== null ? `${sotPct}%` : '—'}
              </span>
              <Badge variant={sotVariant}>SOT</Badge>
            </div>
            {sotDelta !== null && (
              <span className={`text-xs font-medium ${sotDelta >= 0 ? 'text-pass' : 'text-fail'}`}>
                {sotDelta >= 0 ? '?' : '?'} {Math.abs(sotDelta)}pp vs target
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-sans text-4xl font-bold text-dark">
                {otifPct !== null ? `${otifPct}%` : '—'}
              </span>
              <Badge variant={otifVariant}>OTIF</Badge>
            </div>
            {otifDelta !== null && (
              <span className={`text-xs font-medium ${otifDelta >= 0 ? 'text-pass' : 'text-warn'}`}>
                {otifDelta >= 0 ? '?' : '?'} {Math.abs(otifDelta)}pp vs target
              </span>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={weeklyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2D8C6" vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fill: '#8A7E74', fontSize: 11 }} axisLine={false} tickLine={false} />
            {/* left axis: SOT% / OTIF% lines */}
            <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: '#8A7E74', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
            {/* right axis: PO count bars — hidden ticks, just for scale */}
            <YAxis yAxisId="pos" orientation="right" tick={false} axisLine={false} tickLine={false} />
            <ReferenceLine yAxisId="pct" y={90} stroke="#8A7E74" strokeDasharray="4 4" />

            {/* stacked bars: accumulated ? backlog ? shipped/predicted */}
            <Bar yAxisId="pos" dataKey="pastPOBacklog"   stackId="a" fill="#DC3545" name="Accumulated"    radius={[0,0,0,0]} />
            <Bar yAxisId="pos" dataKey="posBacklog"      stackId="a" fill="#F59E0B" name="Backlog"         radius={[0,0,0,0]} />
            <Bar yAxisId="pos" dataKey="posShipped"      stackId="a" fill="#34A853" name="Shipped"         radius={[3,3,0,0]} />
            <Bar yAxisId="pos" dataKey="posPredictedSOT" stackId="a" fill="#34A85366" name="Pred. on track" radius={[3,3,0,0]} />

            {/* performance lines — dots are hollow for future (predicted) weeks */}
            <Line
              yAxisId="pct" dataKey="otifPct" stroke="#34A853" strokeWidth={2} connectNulls={false} name="OTIF%"
              dot={(p: { cx?: number; cy?: number; payload: { isFuture: boolean } }) => {
                const cx = p.cx ?? 0; const cy = p.cy ?? 0;
                return p.payload.isFuture
                  ? <circle key={cx} cx={cx} cy={cy} r={3} fill="white" stroke="#34A853" strokeWidth={2} />
                  : <circle key={cx} cx={cx} cy={cy} r={3} fill="#34A853" />;
              }}
            />
            <Line
              yAxisId="pct" dataKey="sotPct" stroke="#FF8900" strokeWidth={2.5} connectNulls={false} name="SOT%" activeDot={{ r: 5 }}
              dot={(p: { cx?: number; cy?: number; payload: { isFuture: boolean } }) => {
                const cx = p.cx ?? 0; const cy = p.cy ?? 0;
                return p.payload.isFuture
                  ? <circle key={cx} cx={cx} cy={cy} r={3} fill="white" stroke="#FF8900" strokeWidth={2} />
                  : <circle key={cx} cx={cx} cy={cy} r={3} fill="#FF8900" />;
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconSize={8}
              formatter={(v) => <span style={{ color: '#8A7E74', fontSize: 10 }}>{v}</span>}
            />
            <Tooltip
              contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#FFA236', fontWeight: 600 }}
              formatter={(value, name) => {
                if (name === 'SOT%' || name === 'OTIF%') return [`${value}%`, name];
                return [value, name];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {expanded && (
        <div className="border-t border-border p-5 space-y-6">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">PGRD Week Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-navy text-white">
                    {['PGRD Week', 'Lines', 'Qty Ordered', 'Qty Shipped', 'SOT%', 'OTIF%'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold uppercase text-[11px] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeklyTrend.filter((w) => !w.isFuture && w.totalLines > 0).map((w) => (
                    <tr key={w.isoWeek} className={`border-b border-border ${w.isCurrent ? 'bg-brand-dim' : ''}`}>
                      <td className="px-3 py-2 font-medium">{w.weekLabel}</td>
                      <td className="px-3 py-2">{w.totalLines}</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">—</td>
                      <td className={`px-3 py-2 font-medium ${(w.sotPct ?? 0) >= 90 ? 'text-pass' : 'text-fail'}`}>
                        {w.sotPct !== null ? `${w.sotPct}%` : '—'}
                      </td>
                      <td className={`px-3 py-2 font-medium ${(w.otifPct ?? 0) >= 90 ? 'text-pass' : 'text-warn'}`}>
                        {w.otifPct !== null ? `${w.otifPct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {failingLines.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">Annotations</h4>
                <div className="flex gap-4 text-xs text-muted">
                  <span>SOT: <span className={sotAnnotated === sotTotal ? 'text-pass font-medium' : 'text-fail font-medium'}>{sotAnnotated}/{sotTotal}</span></span>
                  <span>OTIF: <span className={otifAnnotated === otifTotal ? 'text-pass font-medium' : 'text-warn font-medium'}>{otifAnnotated}/{otifTotal}</span></span>
                </div>
              </div>
              <div className="space-y-2">
                {failingLines.map((line) => {
                  const kpi = computeKPI(line);
                  return (
                    <AnnotationRow
                      key={`${line.po}-${line.line}`}
                      line={line}
                      sotFail={kpi.sotFail}
                      otifFail={kpi.otifFail}
                      entry={annotations[`${line.po}-${line.line}`]}
                      onUpdate={onUpdateAnnotation}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">TM Comments</h4>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="TM Name"
                value={tmName}
                onChange={(e) => setTmName(e.target.value)}
                className="w-full text-sm border border-border rounded px-3 py-2 focus:outline-none focus:border-brand"
              />
              <textarea
                rows={3}
                placeholder="TM meeting notes..."
                value={tmComment}
                onChange={(e) => setTmComment(e.target.value)}
                className="w-full text-sm border border-border rounded px-3 py-2 focus:outline-none focus:border-brand resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
