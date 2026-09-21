'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getISOWeek, getISOWeekYear, currentISOWeek, shiftISOWeek } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import { CardHeader } from '../shared/CardHeader';
import type { PurchaseLine } from '../../types';

interface MissingESDSectionProps {
  lines: PurchaseLine[];
  drillDownHref: string;
}

interface WeekRow {
  weekLabel: string;
  offset: number;
  count: number;
}

// Missing ESD is a current-state/forward-risk view (matches the detail page: not scoped to the
// global week-range filter), so this card always looks at a fixed window anchored to TODAY rather
// than whatever historical range is selected elsewhere on the dashboard — otherwise the dark/light
// urgency split could never show its "light" (>3 weeks out) half whenever the global range's
// forward edge didn't happen to extend past +3 (its default doesn't).
const WEEKS_BEHIND = 2;
const WEEKS_AHEAD = 6;

export function MissingESDSection({ lines, drillDownHref }: MissingESDSectionProps) {
  const rows = useMemo((): WeekRow[] => {
    const { week: curWeek, year: curYear } = currentISOWeek();
    const offsets = Array.from({ length: WEEKS_BEHIND + WEEKS_AHEAD + 1 }, (_, i) => i - WEEKS_BEHIND);
    return offsets.map((offset) => {
      const { week, year } = shiftISOWeek(curWeek, curYear, offset);
      // Missing ESD's baseline date is EGRD, not PGRD (confirmed by Ana) — same field the detail
      // page's urgency buckets (computeEgrdWeekBuckets) key off of.
      const weekLines = lines.filter((l) => l.egrd && getISOWeek(l.egrd) === week && getISOWeekYear(l.egrd) === year);
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

      return { weekLabel: `W${String(week).padStart(2, '0')}`, offset, count };
    });
  }, [lines]);

  const totalMissing = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-3 py-2.5 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <CardHeader
        title="Missing ESD"
        infoText="POs with no Expected Shipping Date booked yet"
        subtitle="Open POs without ESD"
        total={totalMissing}
      />
      <p className="text-[9px] text-[#b5aaa5] mt-0.5 shrink-0">X-axis: EGRD week</p>
      <div className="flex-1 min-h-0 mt-0.5" style={{ minHeight: 50 }}>
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
                <Cell key={r.weekLabel} fill={r.count === 0 ? COLOR.border : r.offset <= 3 ? COLOR.fail : '#f3a8a8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Link>
  );
}
