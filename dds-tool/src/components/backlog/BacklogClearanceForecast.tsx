'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
import { COLOR } from '../../lib/statusColors';
import type { ClearanceForecastPoint } from '../../lib/backlogAggregation';

interface BacklogClearanceForecastProps {
  points: ClearanceForecastPoint[];
}

// A forward projection of ONLY today's Current Backlog population, based on each PO's own ESD —
// never mixes in Expected Future Backlog (that's a different question: what's not backlog yet vs.
// when today's backlog clears). The floor the curve settles at is the no-ESD count, since those
// POs have no known clearance date and are shown as a separate callout below, not folded into the
// last forecast week.
export function BacklogClearanceForecast({ points }: BacklogClearanceForecastProps) {
  const last = points[points.length - 1];
  const floor = last?.noEsdRemaining ?? 0;
  const totalToday = points[0]?.remaining ?? 0;
  const expectedToClear = totalToday - floor;
  const pctExpectedToClear = totalToday ? Math.round((expectedToClear / totalToday) * 100) : 0;

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] shrink-0">Backlog Clearance Forecast</p>
      <p className="text-[11px] text-[#9c9794] mb-2 shrink-0">Based on ESD — when we expect the current backlog to clear</p>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="backlogClearanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.brand} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLOR.brand} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
            <Tooltip
              contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
              labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
              itemStyle={{ color: '#f9f7f6' }}
              formatter={(v) => [`${v} POs remaining`, 'Backlog']}
            />
            <Area type="stepAfter" dataKey="remaining" stroke={COLOR.brand} strokeWidth={2} fill="url(#backlogClearanceFill)" dot={{ r: 4, fill: COLOR.brand, stroke: '#fff', strokeWidth: 1.5 }}>
              <LabelList dataKey="remaining" position="top" style={{ fontSize: 12, fontWeight: 700, fill: COLOR.navy }} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap shrink-0">
        <span className="text-[11px] px-2 py-1 rounded-md bg-pass-bg text-pass font-semibold flex items-center gap-1">
          ✓ {expectedToClear} of {totalToday} current backlog POs ({pctExpectedToClear}%) have an ESD and are expected to clear by {last?.label ?? '—'}.
        </span>
        {floor > 0 && (
          <span className="text-[11px] px-2 py-1 rounded-md bg-fail-bg text-fail font-semibold border border-dashed border-fail">
            {floor} POs — No Expected Clearance (no ESD available)
          </span>
        )}
      </div>
    </div>
  );
}
