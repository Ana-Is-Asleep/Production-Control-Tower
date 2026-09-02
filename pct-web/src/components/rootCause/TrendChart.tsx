'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { REASON_CATEGORY_LABELS, type ReasonCategory } from '../../lib/reasonClassification';
import { COLOR } from '../../lib/statusColors';
import { CATEGORY_PALETTE } from './categoryPalette';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PORootCauseRow } from '../../lib/rootCauseAggregation';

interface TrendChartProps {
  rows: PORootCauseRow[];
  weeksInRange: WeekInRange[];
  categoryOrder: ReasonCategory[];
  onBarClick: (week: string, category: ReasonCategory) => void;
}

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
  color?: string;
}

function NonZeroTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const present = payload.filter((p) => (p.value ?? 0) > 0);
  if (present.length === 0) return null;
  return (
    <div style={{ background: COLOR.navy, borderRadius: 8, fontSize: 11, padding: '8px 10px', maxWidth: 240 }}>
      <p style={{ color: COLOR.brandSoft, fontWeight: 700, margin: 0, marginBottom: 4 }}>{label}</p>
      {present.map((p) => (
        <p key={p.dataKey} style={{ color: '#f9f7f6', margin: 0 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: p.color, marginRight: 6 }} />
          {REASON_CATEGORY_LABELS[p.dataKey as ReasonCategory] ?? String(p.dataKey)}: {p.value} POs
        </p>
      ))}
    </div>
  );
}

// Trend mode's main visual — the full stacked-by-week bar chart, scaled up from the compact
// dashboard card version. Clicking a segment filters the table below (handled by the caller).
export function TrendChart({ rows, weeksInRange, categoryOrder, onBarClick }: TrendChartProps) {
  const chartData = weeksInRange.map((week) => {
    const row: Record<string, number | string> = { weekLabel: week.label };
    categoryOrder.forEach((cat) => {
      row[cat] = rows.filter((r) => r.week?.label === week.label && r.finalCategory === cat).length;
    });
    return row;
  });

  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
          <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<NonZeroTooltip />} />
          <Legend
            verticalAlign="top" align="right" iconSize={8}
            formatter={(v) => <span style={{ color: COLOR.muted, fontSize: 11 }}>{REASON_CATEGORY_LABELS[v as ReasonCategory] ?? String(v)}</span>}
          />
          {categoryOrder.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="reasons"
              fill={CATEGORY_PALETTE[cat]}
              fillOpacity={0.85}
              onClick={(data: unknown) => {
                const week = (data as { payload?: { weekLabel?: string } } | undefined)?.payload?.weekLabel;
                if (week) onBarClick(week, cat);
              }}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
