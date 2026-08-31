'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { MiniLegend } from '../shared/MiniLegend';
import { BAR_TOTAL, BAR_SHIPPED, LINE_SOT, LINE_OTIF, COLOR } from '../../lib/statusColors';
import type { TopGraphPoint } from '../../hooks/useKPIs';

interface TopGraphChartProps {
  points: TopGraphPoint[];
  // clicking a bar/point on the chart selects that week — only wired up on the drill-down page
  onWeekClick?: (weekLabel: string) => void;
}

// The actual SOT/OTIF chart, pulled out of TopGraphSection so it can be reused verbatim both in
// the compact overview card and full-width at the top of the full-screen drill-down.
export function TopGraphChart({ points, onWeekClick }: TopGraphChartProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-2 shrink-0">
        <MiniLegend
          items={[
            { label: 'POs SOT or Expected SOT', color: BAR_SHIPPED, type: 'bar' },
            { label: 'POs Requested', color: BAR_TOTAL, type: 'bar' },
            { label: 'SOT %', color: LINE_SOT, type: 'line' },
            { label: 'OTIF %', color: LINE_OTIF, type: 'line' },
          ]}
        />
        <span className="text-[10px] text-[#b5aaa5] italic">(dashed = projected)</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 4, left: -10, bottom: 0 }}
            onClick={onWeekClick ? (e) => { const label = (e as unknown as { activeLabel?: string } | undefined)?.activeLabel; if (label) onWeekClick(label); } : undefined}
            style={onWeekClick ? { cursor: 'pointer' } : undefined}
          >
            <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fill: COLOR.muted, fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
            <YAxis yAxisId="pos" orientation="left" tick={{ fill: COLOR.muted, fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
            <ReferenceLine yAxisId="pct" y={90} stroke={COLOR.border} strokeDasharray="4 4" />
            <Bar yAxisId="pos" dataKey="shippedPOs" stackId="poStack" fill={BAR_SHIPPED} radius={[0, 0, 0, 0]} name="POs SOT or Expected SOT" />
            <Bar yAxisId="pos" dataKey="backlogPOs" stackId="poStack" fill={BAR_TOTAL} radius={[2, 2, 0, 0]} name="POs Requested" />
            <Line yAxisId="pct" dataKey="sotPastPct" stroke={LINE_SOT} strokeWidth={2} dot={{ r: 3, fill: LINE_SOT, stroke: '#fff', strokeWidth: 1.5 }} name="SOT % (actual)" connectNulls />
            <Line yAxisId="pct" dataKey="sotFuturePct" stroke={LINE_SOT} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: LINE_SOT, stroke: '#fff', strokeWidth: 1.5 }} name="SOT % (projected)" connectNulls />
            <Line yAxisId="pct" dataKey="otifPastPct" stroke={LINE_OTIF} strokeWidth={2} dot={{ r: 3, fill: LINE_OTIF, stroke: '#fff', strokeWidth: 1.5 }} name="OTIF % (actual)" connectNulls />
            <Line yAxisId="pct" dataKey="otifFuturePct" stroke={LINE_OTIF} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: LINE_OTIF, stroke: '#fff', strokeWidth: 1.5 }} name="OTIF % (projected)" connectNulls />
            <Tooltip
              contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
              labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
              itemStyle={{ color: '#f9f7f6' }}
              formatter={(v, n) => { const s = String(n); return [s.includes('%') ? `${v}%` : `${v} POs`, s]; }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
