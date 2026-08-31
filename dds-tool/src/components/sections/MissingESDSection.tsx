'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface MissingESDSectionProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  drillDownHref: string;
}

interface WeekRow {
  weekLabel: string;
  offset: number;
  isFuture: boolean;
  count: number;
}

export function MissingESDSection({ lines, weeksInRange, drillDownHref }: MissingESDSectionProps) {
  const rows = useMemo((): WeekRow[] => {
    return weeksInRange.map((week) => {
      const weekLines = lines.filter(
        (l) => l.pgrd && getISOWeek(l.pgrd) === week.week && getISOWeekYear(l.pgrd) === week.year
      );
      const byPO = new Map<string, PurchaseLine[]>();
      weekLines.forEach((l) => {
        if (!byPO.has(l.po)) byPO.set(l.po, []);
        byPO.get(l.po)!.push(l);
      });

      let count = 0;
      byPO.forEach((poLines) => {
        const noESD = poLines.every((l) => !l.esd);
        const totalQty = poLines.reduce((s, l) => s + l.cqty, 0);
        if (noESD && totalQty > 1) count += 1;
      });

      return { weekLabel: week.label, offset: week.offset, isFuture: week.isFuture, count };
    });
  }, [lines, weeksInRange]);

  const totalMissing = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#403833]">Missing ESD</p>
          <span className={`text-xs font-semibold ${totalMissing === 0 ? 'text-pass' : 'text-[#7b7571]'}`}>{totalMissing}</span>
        </div>
        <p className="text-[10px] text-brand font-semibold">Drill down →</p>
      </div>
      <div className="flex-1 min-h-0 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip
              contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
              labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
              itemStyle={{ color: '#f9f7f6' }}
              formatter={(value) => [`${value} POs`, 'Missing ESD']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {rows.map((r) => (
                <Cell key={r.weekLabel} fill={r.count > 0 ? COLOR.fail : COLOR.border} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Link>
  );
}
