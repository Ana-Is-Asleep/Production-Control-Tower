'use client';

import { useMemo, useState } from 'react';
import { differenceInCalendarWeeks } from 'date-fns';
import { DataTable, type Column } from '../shared/DataTable';
import { SlideOver } from '../shared/SlideOver';
import { weekOf } from '../../lib/kpiFormulas';
import { isoWeekKey, formatDateShort } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

interface BacklogSectionProps {
  lines: PurchaseLine[]; // filteredLines — NOT restricted to the global weekRange
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

export function BacklogSection({ lines }: BacklogSectionProps) {
  const [detailGroup, setDetailGroup] = useState<'recent' | 'accumulated' | 'expected' | null>(null);
  const today = useMemo(() => new Date(), []);

  const { recent, accumulated, expected, noEsdCount, clearance, outliers } = useMemo(() => {
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

      // Backlog definition: PGRD in the past AND ASD still empty.
      if (isPast && !hasAnyASD) {
        const weeksAgo = differenceInCalendarWeeks(weekOf(today), weekOf(pgrd), { weekStartsOn: 1 });
        const entry: BacklogPO = { po, supplier, pgrd, esd };
        if (weeksAgo <= 2) recent.push(entry);
        else accumulated.push(entry);
      }

      // Expected backlog: PGRD in the future but ESD already booked for a date AFTER PGRD.
      if (isFuture && esd && esd > pgrd) {
        expected.push({ po, supplier, pgrd, esd });
      }
    });

    const currentBacklog = [...recent, ...accumulated];
    const noEsdCount = currentBacklog.filter((p) => !p.esd).length;
    const withEsd = currentBacklog.filter((p) => p.esd).sort((a, b) => a.esd!.getTime() - b.esd!.getTime());

    // Dynamic clearance window: cover weeks until ~90% of ESD-booked backlog clears;
    // flag anything beyond that as an outlier footnote rather than stretching the table.
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

    return { recent, accumulated, expected, noEsdCount, clearance, outliers };
  }, [lines, today]);

  const groupData: Record<'recent' | 'accumulated' | 'expected', BacklogPO[]> = { recent, accumulated, expected };

  const columns: Column<BacklogPO>[] = [
    { key: 'po', header: 'PO', render: (r) => r.po },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier },
    { key: 'pgrd', header: 'PGRD', render: (r) => formatDateShort(r.pgrd) },
    { key: 'esd', header: 'ESD', render: (r) => r.esd ? formatDateShort(r.esd) : <span className="text-fail font-semibold">Not booked</span> },
  ];

  return (
    <>
      <div className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Backlog</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {([
            { key: 'recent' as const, label: 'Recent backlog', sub: 'PGRD within last 2 weeks', color: 'text-warn' },
            { key: 'accumulated' as const, label: 'Accumulated backlog', sub: 'PGRD older than 2 weeks', color: 'text-fail' },
            { key: 'expected' as const, label: 'Expected backlog', sub: 'ESD booked after PGRD (forward-looking)', color: 'text-brand' },
          ]).map((c) => (
            <button
              key={c.key}
              onClick={() => setDetailGroup(c.key)}
              className="text-left border border-[#e9e3df] rounded-lg p-3 hover:border-brand transition-colors"
            >
              <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">{c.label}</p>
              <p className={`kpi-number font-extrabold text-3xl leading-none mt-1 ${c.color}`}>{groupData[c.key].length}</p>
              <p className="text-[10px] text-[#b5aaa5] mt-1">{c.sub}</p>
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-2">Clearance breakdown — by ESD week</p>
          {clearance.length === 0 ? (
            <p className="text-xs text-[#b5aaa5]">No ESD-booked backlog to project.</p>
          ) : (
            <div className="flex items-end gap-3 flex-wrap">
              {clearance.map((c) => (
                <div key={c.weekLabel} className="text-center">
                  <div className="w-10 bg-brand rounded-t" style={{ height: `${8 + c.count * 6}px` }} />
                  <p className="text-[10px] text-[#7b7571] mt-1">{c.weekLabel}</p>
                  <p className="text-[10px] font-semibold text-[#403833]">{c.count}</p>
                </div>
              ))}
            </div>
          )}
          {outliers.length > 0 && (
            <p className="text-[10px] text-[#b5aaa5] mt-2">
              * {outliers.length} PO{outliers.length > 1 ? 's' : ''} with ESD far beyond the bulk clearance window (not shown above): {outliers.map((o) => o.po).join(', ')}
            </p>
          )}
        </div>

        <p className="text-xs text-[#9c9794] mt-4 pt-3 border-t border-[#f4f1ef]">
          <span className="font-semibold text-fail">{noEsdCount}</span> POs in backlog with no expectation to clear
        </p>
      </div>

      <SlideOver
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        title={detailGroup ? `Backlog — ${detailGroup}` : ''}
        width="w-[760px]"
      >
        {detailGroup && <DataTable columns={columns} data={groupData[detailGroup]} rowKey={(r) => r.po} />}
      </SlideOver>
    </>
  );
}
