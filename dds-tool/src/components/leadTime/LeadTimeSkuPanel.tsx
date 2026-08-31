'use client';

import { useMemo } from 'react';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { COLOR } from '../../lib/statusColors';
import { LT_TARGET_DAYS, computeSupplierSeries, type LTBucket, type LTPeriod } from '../../lib/leadTimeAnalytics';
import type { PurchaseLine } from '../../types';

// Fixed hue assignment, never cycled — same convention as CATEGORY_PALETTE elsewhere in the app,
// just sized for up to 8 suppliers per card.
const SUPPLIER_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#2f9e44', '#4a3aa7', '#0d366b'];

interface LeadTimeSkuPanelProps {
  title: string;
  subtitle: string;
  categoryBadge?: string;
  lines: PurchaseLine[];
  buckets: LTBucket[];
  period: LTPeriod;
  onBarClick: (bucketKey: string, supplier: string) => void;
}

export function LeadTimeSkuPanel({ title, subtitle, categoryBadge, lines, buckets, period, onBarClick }: LeadTimeSkuPanelProps) {
  const series = useMemo(() => computeSupplierSeries(lines, buckets, period), [lines, buckets, period]);

  const chartData = series.points.map((p) => ({
    label: p.label,
    bucketKey: p.bucketKey,
    target: LT_TARGET_DAYS,
    ...p.bySupplier,
  }));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-bold text-[#403833]">{title}</h3>
        {categoryBadge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f2ee] text-[#58524e]">{categoryBadge}</span>}
        <span className="text-xs text-[#9c9794]">
          {subtitle}{series.totalSuppliers > series.suppliers.length ? ` · top ${series.suppliers.length} of ${series.totalSuppliers} suppliers` : ''}
        </span>
      </div>
      <p className="text-[11px] text-[#9c9794] mb-2">Lead time per PO (latest ASD minus Order Date). Click a bar to list the PO lines behind that period.</p>
      {series.suppliers.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-8 text-center">No lines for this selection in the current window.</p>
      ) : (
        <div style={{ height: 260 }}>
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
              <Legend verticalAlign="top" align="right" iconSize={8} type="scroll" formatter={(v) => <span style={{ color: COLOR.muted, fontSize: 11 }}>{v}</span>} />
              {series.suppliers.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={s}
                  fill={SUPPLIER_PALETTE[i % SUPPLIER_PALETTE.length]}
                  fillOpacity={0.85}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={30}
                  onClick={(data: unknown) => {
                    const bk = (data as { payload?: { bucketKey?: string } } | undefined)?.payload?.bucketKey;
                    if (bk) onBarClick(bk, s);
                  }}
                  style={{ cursor: 'pointer' }}
                />
              ))}
              <Line dataKey="target" name="Target (30d)" stroke={COLOR.fail} strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
