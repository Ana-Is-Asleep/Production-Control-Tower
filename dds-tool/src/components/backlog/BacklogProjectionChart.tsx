'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts';
import { COLOR } from '../../lib/statusColors';
import type { ProjectionWeek } from '../../lib/backlogAggregation';

interface BacklogProjectionChartProps {
  weeks: ProjectionWeek[];
}

// Running backlog level (stock, not one-time clearances), split by status per week. Offsets 0-1
// use real ASD data as it stands today; offsets 2+ additionally assume on-schedule clearance per
// booked ESD, since those weeks haven't happened yet — each PO's Recent/Accumulated/Expected
// status is recomputed as of that future week, not carried forward from today's classification.
export function BacklogProjectionChart({ weeks }: BacklogProjectionChartProps) {
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeks} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
            itemStyle={{ color: '#f9f7f6' }}
          />
          <Legend
            verticalAlign="top" align="right" iconSize={8}
            formatter={(v) => <span style={{ color: COLOR.muted, fontSize: 11 }}>{v}</span>}
          />
          <Bar dataKey="recent" stackId="s" fill={COLOR.brand} fillOpacity={0.9} name="Recent" />
          <Bar dataKey="accumulated" stackId="s" fill={COLOR.fail} fillOpacity={0.85} name="Accumulated" />
          <Bar dataKey="expected" stackId="s" fill={COLOR.muted} fillOpacity={0.5} name="Expected" radius={[2, 2, 0, 0]}>
            <LabelList dataKey="stackTotal" position="top" style={{ fontSize: 11, fontWeight: 700, fill: COLOR.navy }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
