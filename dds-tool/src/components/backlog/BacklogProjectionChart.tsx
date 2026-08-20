'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { COLOR } from '../../lib/statusColors';
import type { ProjectionWeek } from '../../lib/backlogAggregation';

interface BacklogProjectionChartProps {
  weeks: ProjectionWeek[];
}

// Running backlog level (stock, not one-time clearances): offset 0-1 use real ASD data as it
// stands today, offsets 2+ assume on-schedule clearance per booked ESD — shown with a lighter
// fill so it reads as projected rather than observed.
export function BacklogProjectionChart({ weeks }: BacklogProjectionChartProps) {
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeks} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
            itemStyle={{ color: '#f9f7f6' }}
            formatter={(value) => [`${value} POs`, 'Backlog']}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {weeks.map((w) => (
              <Cell key={w.label} fill={COLOR.brand} fillOpacity={w.offset >= 2 ? 0.45 : 0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
