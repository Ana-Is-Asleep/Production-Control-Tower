'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { COLOR } from '../../lib/statusColors';
import type { AgeBand } from '../../lib/backlogAggregation';

interface BacklogAgeBreakdownProps {
  bands: AgeBand[];
}

const BAND_COLORS = [COLOR.pass, COLOR.brand, '#eda100', COLOR.fail];

export function BacklogAgeBreakdown({ bands }: BacklogAgeBreakdownProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Age Breakdown</p>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bands} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip
              contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
              labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
              itemStyle={{ color: '#f9f7f6' }}
              formatter={(value) => [`${value} POs`, 'Backlog']}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {bands.map((b, i) => (
                <Cell key={b.label} fill={BAND_COLORS[i] ?? COLOR.muted} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
