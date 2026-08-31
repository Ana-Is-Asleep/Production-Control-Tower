'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import { COLOR } from '../../lib/statusColors';
import type { AgeBand } from '../../lib/backlogAggregation';

interface BacklogAgeBreakdownProps {
  bands: AgeBand[];
}

const BAND_COLORS = [COLOR.pass, COLOR.brand, COLOR.warn, COLOR.fail];

// Fills the card's full height (the card is stretched to match its sibling in the grid row) so
// the bars scale to the available space instead of sitting cramped inside a fixed-height box with
// dead space below.
export function BacklogAgeBreakdown({ bands }: BacklogAgeBreakdownProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col h-full" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3 shrink-0">Age Breakdown</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bands} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip
              contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
              labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
              itemStyle={{ color: '#f9f7f6' }}
              formatter={(value) => [`${value} POs`, 'Backlog']}
              cursor={{ fill: COLOR.border, fillOpacity: 0.3 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={72}>
              {bands.map((b, i) => (
                <Cell key={b.label} fill={BAND_COLORS[i] ?? COLOR.muted} />
              ))}
              <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700, fill: COLOR.navy }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
