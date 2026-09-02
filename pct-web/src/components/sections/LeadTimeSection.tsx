'use client';

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MiniLegend } from '../shared/MiniLegend';
import { CardHeader } from '../shared/CardHeader';
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
      to={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <CardHeader
        title="Lead Time"
        infoText="Production lead time (Order Date to Actual Shipping Date) vs the 30-day target"
        subtitle={summary.avgProductionLT !== null ? `${summary.avgProductionLT}d avg production lead time` : undefined}
      />
      {weeklyLTTarget.length === 0 ? (
        <div className="flex-1 flex items-center">
          <p className="text-xs text-[#b5aaa5]">No shipped POs in range</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 mt-3 flex flex-col">
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
                  position={{ y: 0 }}
                  formatter={(value: unknown, name: unknown) => (name === 'Avg LT' ? [`${value}d`, name as string] : [`${value} POs`, name as string])}
                />
                <Bar yAxisId="count" dataKey="withinTarget" name="Within target" stackId="ships" fill={COLOR.pass} fillOpacity={0.85} radius={[0, 0, 0, 0]} />
                <Bar yAxisId="count" dataKey="aboveTarget" name="Above target" stackId="ships" fill={COLOR.fail} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                <Line yAxisId="days" dataKey="avgLT" name="Avg LT" stroke={COLOR.navy} strokeWidth={2} dot={{ r: 4, fill: COLOR.navy, stroke: '#fff', strokeWidth: 1.5 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Link>
  );
}
