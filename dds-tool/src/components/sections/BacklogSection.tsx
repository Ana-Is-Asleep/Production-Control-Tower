'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { differenceInCalendarWeeks } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { weekOf } from '../../lib/kpiFormulas';
import { isoWeekKey } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { PurchaseLine } from '../../types';

interface BacklogSectionProps {
  lines: PurchaseLine[]; // filteredLines — NOT restricted to the global weekRange
  drillDownHref: string;
}

interface BacklogPO {
  po: string;
  supplier: string;
  pgrd: Date;
  esd: Date | null;
}

function groupByPO(lines: PurchaseLine[]): Map<string, PurchaseLine[]> {
  const map = new Map<string, PurchaseLine[]>();
  lines.forEach((l) => {
    if (!map.has(l.po)) map.set(l.po, []);
    map.get(l.po)!.push(l);
  });
  return map;
}

export function BacklogSection({ lines, drillDownHref }: BacklogSectionProps) {
  const today = useMemo(() => new Date(), []);

  const { recentCount, accumulatedCount, expectedCount, noEsdCount, clearance, outliers } = useMemo(() => {
    const byPO = groupByPO(lines);
    const recent: BacklogPO[] = [];
    const accumulated: BacklogPO[] = [];
    const expected: BacklogPO[] = [];

    byPO.forEach((poLines, po) => {
      const pgrd = poLines.find((l) => l.pgrd)?.pgrd;
      if (!pgrd) return;
      const supplier = poLines[0].supplier;
      const esd = poLines.find((l) => l.esd)?.esd ?? null;
      const hasAnyASD = poLines.some((l) => l.asd);
      const isPast = weekOf(pgrd) < weekOf(today);
      const isFuture = weekOf(pgrd) > weekOf(today);

      if (isPast && !hasAnyASD) {
        const weeksAgo = differenceInCalendarWeeks(weekOf(today), weekOf(pgrd), { weekStartsOn: 1 });
        const entry: BacklogPO = { po, supplier, pgrd, esd };
        if (weeksAgo <= 2) recent.push(entry);
        else accumulated.push(entry);
      }

      if (isFuture && esd && esd > pgrd) {
        expected.push({ po, supplier, pgrd, esd });
      }
    });

    const currentBacklog = [...recent, ...accumulated];
    const noEsdCount = currentBacklog.filter((p) => !p.esd).length;
    const withEsd = currentBacklog.filter((p) => p.esd).sort((a, b) => a.esd!.getTime() - b.esd!.getTime());

    const byWeek = new Map<string, { weekLabel: string; pos: BacklogPO[] }>();
    withEsd.forEach((p) => {
      const key = isoWeekKey(p.esd!);
      if (!byWeek.has(key)) byWeek.set(key, { weekLabel: `W${key.split('-W')[1]}`, pos: [] });
      byWeek.get(key)!.pos.push(p);
    });
    const sortedWeeks = [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

    const threshold = Math.ceil(withEsd.length * 0.9);
    let cumulative = 0;
    const clearance: { weekLabel: string; count: number }[] = [];
    const outliers: BacklogPO[] = [];
    for (const [, { weekLabel, pos }] of sortedWeeks) {
      if (cumulative >= threshold && clearance.length > 0) {
        outliers.push(...pos);
      } else {
        clearance.push({ weekLabel, count: pos.length });
        cumulative += pos.length;
      }
    }

    return { recentCount: recent.length, accumulatedCount: accumulated.length, expectedCount: expected.length, noEsdCount, clearance, outliers };
  }, [lines, today]);

  const maxClearance = Math.max(1, ...clearance.map((c) => c.count));

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Backlog</p>
        <p className="text-[10px] text-brand font-semibold">Drill down →</p>
      </div>
      <div className="grid grid-cols-3 gap-2 shrink-0">
        {([
          { label: 'Recent', color: 'text-warn', value: recentCount },
          { label: 'Accumulated', color: 'text-fail', value: accumulatedCount },
          { label: 'Expected', color: 'text-brand', value: expectedCount },
        ]).map((c) => (
          <div key={c.label} className="text-left rounded-lg px-2 py-1">
            <p className="text-[9px] uppercase tracking-widest text-[#9c9794] truncate">{c.label}</p>
            <p className={`kpi-number font-extrabold text-xl leading-none mt-0.5 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 mt-1">
        {clearance.length === 0 ? (
          <div className="h-full flex items-center">
            <p className="text-[11px] text-[#b5aaa5]">No ESD-booked backlog to project a clearance date for.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={clearance} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
              <Tooltip
                contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
                labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
                itemStyle={{ color: '#f9f7f6' }}
                formatter={(value) => [`${value} POs`, 'Clearing']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {clearance.map((c) => (
                  <Cell key={c.weekLabel} fill={COLOR.brand} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[10px] text-[#9c9794] pt-1.5 border-t border-[#f4f1ef] shrink-0">
        <span className="font-semibold text-fail">{noEsdCount}</span> with no expectation to clear
        {outliers.length > 0 && <span> · {outliers.length} far outlier{outliers.length > 1 ? 's' : ''}</span>}
      </p>
    </Link>
  );
}
