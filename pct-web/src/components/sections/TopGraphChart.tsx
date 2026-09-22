'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { MiniLegend, type MiniLegendItem } from '../shared/MiniLegend';
import { BAR_TOTAL, BAR_SHIPPED, BAR_ACCUMULATED_BACKLOG, LINE_SOT, LINE_OTIF, COLOR } from '../../lib/statusColors';
import type { TopGraphPoint } from '../../hooks/useKPIs';

interface TopGraphChartProps {
  points: TopGraphPoint[];
  // clicking a bar/point on the chart selects that week — only wired up on the drill-down page
  onWeekClick?: (weekLabel: string) => void;
  // 'right' stacks the legend in a column beside the chart instead of wrapping above it — used by
  // the compact overview card so the chart itself gets more height; the full-width drill-down
  // keeps the legend on top (default), where the extra width is better spent on the chart.
  legendPosition?: 'top' | 'right';
}

// The actual SOT/OTIF chart, pulled out of TopGraphSection so it can be reused verbatim both in
// the compact overview card and full-width at the top of the full-screen drill-down.
export function TopGraphChart({ points, onWeekClick, legendPosition = 'top' }: TopGraphChartProps) {
  // Bar order matches stacking order (bottom to top): Backlog Accumulated sits right after Not
  // Shipped in the legend to mirror how it reads in the stack, rather than trailing after the
  // SOT/OTIF/Target lines it has nothing to do with.
  const legendItems: MiniLegendItem[] = [
    { label: 'POs Requested – Shipped', color: BAR_SHIPPED, type: 'bar' },
    { label: 'POs Requested – Not Shipped', color: BAR_TOTAL, type: 'bar' },
    { label: 'Backlog Accumulated', color: BAR_ACCUMULATED_BACKLOG, type: 'bar' },
    { label: 'SOT %', color: LINE_SOT, type: 'line' },
    { label: 'OTIF %', color: LINE_OTIF, type: 'line' },
    { label: 'Target (90%)', color: COLOR.muted, type: 'dashed-line' },
  ];

  const chart = (
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
        <ReferenceLine yAxisId="pct" y={90} stroke={COLOR.fail} strokeWidth={1.5} strokeDasharray="4 4" />
        <Bar yAxisId="pos" dataKey="pastAccumulatedBacklog" stackId="poStack" fill={BAR_ACCUMULATED_BACKLOG} radius={[0, 0, 4, 4]} name="Backlog Accumulated" />
        <Bar yAxisId="pos" dataKey="shippedPOs" stackId="poStack" fill={BAR_SHIPPED} radius={[0, 0, 0, 0]} name="POs Requested – Shipped" />
        <Bar yAxisId="pos" dataKey="backlogPOs" stackId="poStack" fill={BAR_TOTAL} radius={[4, 4, 0, 0]} name="POs Requested – Not Shipped" />
        <Line yAxisId="pct" dataKey="sotPastPct" stroke={LINE_SOT} strokeWidth={2} dot={{ r: 4, fill: LINE_SOT, stroke: '#fff', strokeWidth: 1.5 }} name="SOT % (actual)" connectNulls />
        <Line yAxisId="pct" dataKey="sotFuturePct" stroke={LINE_SOT} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: LINE_SOT, stroke: '#fff', strokeWidth: 1.5 }} name="SOT % (projected)" connectNulls />
        <Line yAxisId="pct" dataKey="otifPastPct" stroke={LINE_OTIF} strokeWidth={2} dot={{ r: 4, fill: LINE_OTIF, stroke: '#fff', strokeWidth: 1.5 }} name="OTIF % (actual)" connectNulls />
        <Line yAxisId="pct" dataKey="otifFuturePct" stroke={LINE_OTIF} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: LINE_OTIF, stroke: '#fff', strokeWidth: 1.5 }} name="OTIF % (projected)" connectNulls />
        <Tooltip
          contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
          labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
          itemStyle={{ color: '#f9f7f6' }}
          formatter={(v, n) => { const s = String(n); return [s.includes('%') ? `${v}%` : `${v} POs`, s]; }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (legendPosition === 'right') {
    return (
      <div className="flex h-full gap-2">
        <div className="flex-1 min-h-0 min-w-0">{chart}</div>
        <div className="w-[128px] shrink-0 flex flex-col justify-start pt-2 gap-2 border-l border-[#f4f1ef] pl-2">
          <MiniLegend items={legendItems} vertical />
          <div className="text-[9px] text-[#b5aaa5] leading-snug">
            <p className="italic">(dashed = projected)</p>
            <p>X-axis: PGRD week</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mb-1 shrink-0">
        <MiniLegend items={legendItems} />
        <span className="text-[10px] text-[#b5aaa5] italic">(dashed = projected)</span>
        <span className="text-[10px] text-[#b5aaa5]">· X-axis: PGRD week</span>
      </div>
      <div className="flex-1 min-h-0">{chart}</div>
    </div>
  );
}
