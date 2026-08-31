'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MiniLegend } from '../shared/MiniLegend';
import { summariseLeadTimes, computeWeeklyLTTargetSplit } from '../../lib/leadTimeUtils';
import { COLOR } from '../../lib/statusColors';
import type { PurchaseLine } from '../../types';

interface LeadTimeSectionProps {
  lines: PurchaseLine[];
  drillDownHref: string;
}

export function LeadTimeSection({ lines, drillDownHref }: LeadTimeSectionProps) {
  const weeklyLTTarget = useMemo(() => computeWeeklyLTTargetSplit(lines), [lines]);
  const summary = useMemo(() => summariseLeadTimes(lines), [lines]);

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Lead Time</p>
          <span className={`text-xs font-semibold ${summary.avgProductionLT !== null && summary.avgProductionLT <= summary.avgAgreedLT ? 'text-pass' : 'text-fail'}`}>
            {summary.avgProductionLT !== null ? `${summary.avgProductionLT}d avg` : '—'}
          </span>
        </div>
        <p className="text-[10px] text-brand font-semibold">Drill down →</p>
      </div>
      {weeklyLTTarget.length === 0 ? (
        <div className="flex-1 flex items-center">
          <p className="text-xs text-[#b5aaa5]">No shipped POs in range</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 mt-1 flex flex-col">
          <MiniLegend
            className="mb-1 shrink-0"
            items={[
              { label: 'Within target', color: COLOR.pass, type: 'bar' },
              { label: 'Above target', color: COLOR.fail, type: 'bar' },
              { label: 'Avg LT', color: COLOR.navy, type: 'line' },
            ]}
          />
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyLTTarget} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis yAxisId="count" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                <YAxis yAxisId="days" orientation="right" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} unit="d" width={26} />
                <Tooltip
                  contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
                  labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
                  itemStyle={{ color: '#f9f7f6' }}
                  formatter={(value: unknown, name: unknown) => (name === 'Avg LT' ? [`${value}d`, name as string] : [`${value} POs`, name as string])}
                />
                <Bar yAxisId="count" dataKey="withinTarget" name="Within target" stackId="ships" fill={COLOR.pass} fillOpacity={0.85} />
                <Bar yAxisId="count" dataKey="aboveTarget" name="Above target" stackId="ships" fill={COLOR.fail} fillOpacity={0.85} />
                <Line yAxisId="days" dataKey="avgLT" name="Avg LT" stroke={COLOR.navy} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Link>
  );
}
