'use client';

import { useMemo } from 'react';
import type { IsChinaSupplier } from '../../lib/kpiFormulas';
import { rollupByPO, computeTrend, type PORollup } from '../../lib/poAggregation';
import { aggregateSOTRate } from '../../lib/kpiFormulas';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface RiskRadarProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getWeek(l: PurchaseLine) {
  return l.pgrd ? { week: getISOWeek(l.pgrd), year: getISOWeekYear(l.pgrd) } : null;
}

interface SupplierRisk {
  supplier: string;
  missingPGRDCount: number;
  avgDelayWeeks: number | null;
  recentSOT: number | null;
  trend: 'up' | 'down' | 'flat';
}

// Panel A — Forward Risk. Just one signal: POs already booked (have an ESD) but that ESD lands
// after the PGRD — already known to miss, regardless of how far out. Ranked by count, worst first.
export function RiskRadar({ lines, weeksInRange, isChinaSupplier, today }: RiskRadarProps) {
  const rows = useMemo(() => {
    const recentCutoff = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const bySupplier = new Map<string, PORollup[]>();
    for (const r of rollupByPO(lines, isChinaSupplier, today)) {
      if (!bySupplier.has(r.supplier)) bySupplier.set(r.supplier, []);
      bySupplier.get(r.supplier)!.push(r);
    }

    const result: SupplierRisk[] = [];

    for (const [supplier, rollups] of bySupplier) {
      const missingPGRD = rollups.filter((r) => r.esd && r.pgrd && r.esd > r.pgrd);
      if (missingPGRD.length === 0) continue;

      const delaysWeeks = missingPGRD
        .filter((r) => r.esd && r.pgrd)
        .map((r) => (r.esd!.getTime() - r.pgrd!.getTime()) / MS_PER_WEEK);
      const avgDelayWeeks = delaysWeeks.length ? delaysWeeks.reduce((s, n) => s + n, 0) / delaysWeeks.length : null;

      const supplierLines = lines.filter((l) => l.supplier === supplier);
      const recentLines = supplierLines.filter((l) => l.pgrd && l.pgrd >= recentCutoff && l.pgrd <= today);
      const recentSOT = aggregateSOTRate(recentLines, isChinaSupplier, today);
      const trend = computeTrend(weeksInRange, supplierLines, isChinaSupplier, today, getWeek);

      result.push({ supplier, missingPGRDCount: missingPGRD.length, avgDelayWeeks, recentSOT, trend });
    }

    return result.sort((a, b) => b.missingPGRDCount - a.missingPGRDCount);
  }, [lines, weeksInRange, today, isChinaSupplier]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Forward Risk</p>
      <p className="text-[10px] text-[#b5aaa5] mb-3">POs already confirmed to ship after PGRD.</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No suppliers at risk</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {rows.map((r) => (
            <div key={r.supplier} className="rounded-lg bg-white border border-[#e9e3df] px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-[#403833] truncate block">{r.supplier}</span>
                  <p className="text-[11px] text-[#7b7571] mt-0.5">
                    Recent SOT: {r.recentSOT === null ? '—' : `${r.recentSOT}%`}{' '}
                    <span className={r.trend === 'up' ? 'text-pass' : r.trend === 'down' ? 'text-fail' : 'text-[#9c9794]'}>
                      {r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                  <span className="text-xs font-semibold whitespace-nowrap">
                    <span style={{ color: COLOR.warn }}>{r.missingPGRDCount}</span> missing PGRD
                  </span>
                  {r.avgDelayWeeks !== null && (
                    <span className="text-[11px] text-[#7b7571] whitespace-nowrap">
                      Avg {r.avgDelayWeeks.toFixed(1)} wks delay
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
