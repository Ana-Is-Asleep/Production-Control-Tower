'use client';

import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { CATEGORY_COLORS, COLOR } from '../../lib/statusColors';
import { LT_TARGET_DAYS, type OverviewPoint } from '../../lib/leadTimeAnalytics';
import type { SKUCategory } from '../../lib/skuUtils';

interface LeadTimeTrendChartProps {
  points: OverviewPoint[];
  categories: SKUCategory[];
  onBarClick: (bucketKey: string, category: SKUCategory) => void;
}

export function LeadTimeTrendChart({ points, categories, onBarClick }: LeadTimeTrendChartProps) {
  const chartData = points.map((p) => ({
    label: p.label,
    bucketKey: p.bucketKey,
    overall: p.overall,
    target: LT_TARGET_DAYS,
    ...p.byCategory,
  }));

  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="d" />
          <Tooltip
            contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
            itemStyle={{ color: '#f9f7f6' }}
            formatter={(v: unknown) => (v === null ? ['—', ''] : [`${v}d`, ''])}
          />
          <Legend verticalAlign="top" align="right" iconSize={8} formatter={(v) => <span style={{ color: COLOR.muted, fontSize: 11 }}>{v}</span>} />
          {categories.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              name={cat}
              fill={CATEGORY_COLORS[cat]}
              fillOpacity={0.85}
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
              onClick={(data: unknown) => {
                const bk = (data as { payload?: { bucketKey?: string } } | undefined)?.payload?.bucketKey;
                if (bk) onBarClick(bk, cat);
              }}
              style={{ cursor: 'pointer' }}
            />
          ))}
          <Line dataKey="overall" name="Overall (by PO)" stroke={COLOR.muted} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
          <Line dataKey="target" name="Target (30d)" stroke={COLOR.fail} strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
