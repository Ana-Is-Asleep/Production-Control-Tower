'use client';

import { useMemo } from 'react';
import { aggregateSOTRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { computeTrend } from '../../lib/poAggregation';
import { formatDateShort, getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface RiskRadarProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
}

function getWeek(l: PurchaseLine) {
  return l.pgrd ? { week: getISOWeek(l.pgrd), year: getISOWeekYear(l.pgrd) } : null;
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// Mode A, Section 2 — upcoming misses, not historical ones: a supplier shows up here either
// because they have unbooked POs due soon, or because their very recent performance has already
// slipped below 70%, both signals that the next few weeks are at risk.
export function RiskRadar({ lines, weeksInRange, isChinaSupplier, today }: RiskRadarProps) {
  const rows = useMemo(() => {
    const cutoff = new Date(today.getTime() + FOUR_WEEKS_MS);
    const recentCutoff = new Date(today.getTime() - TWO_WEEKS_MS);

    const bySupplier = new Map<string, PurchaseLine[]>();
    for (const l of lines) {
      if (!bySupplier.has(l.supplier)) bySupplier.set(l.supplier, []);
      bySupplier.get(l.supplier)!.push(l);
    }

    const result: {
      supplier: string;
      atRiskCount: number;
      earliestEGRD: Date | null;
      last2WeekSOT: number | null;
    }[] = [];

    for (const [supplier, supplierLines] of bySupplier) {
      const atRiskLines = supplierLines.filter((l) => l.egrd && l.egrd >= today && l.egrd <= cutoff && !l.esd);
      const recentLines = supplierLines.filter((l) => l.pgrd && l.pgrd >= recentCutoff && l.pgrd <= today);
      const last2WeekSOT = aggregateSOTRate(recentLines, isChinaSupplier, today);

      const qualifies = atRiskLines.length > 0 || (last2WeekSOT !== null && last2WeekSOT < 70);
      if (!qualifies) continue;

      const atRiskPOs = new Set(atRiskLines.map((l) => l.po));
      const earliestEGRD = atRiskLines.reduce<Date | null>((min, l) => {
        if (!l.egrd) return min;
        return !min || l.egrd < min ? l.egrd : min;
      }, null);

      result.push({ supplier, atRiskCount: atRiskPOs.size, earliestEGRD, last2WeekSOT });
    }

    return result.sort((a, b) => (a.last2WeekSOT ?? 100) - (b.last2WeekSOT ?? 100));
  }, [lines, today, isChinaSupplier]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Forward Risk</p>
      <p className="text-[10px] text-[#b5aaa5] mb-3">Upcoming misses — not historical</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No suppliers at risk</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {rows.map((r) => {
            const supplierLines = lines.filter((l) => l.supplier === r.supplier);
            const trend = computeTrend(weeksInRange, supplierLines, isChinaSupplier, today, getWeek);
            return (
              <div key={r.supplier} className="border border-[#e9e3df] rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#403833] truncate">{r.supplier}</span>
                  <span className={`text-xs font-semibold ${r.last2WeekSOT !== null && r.last2WeekSOT < 70 ? 'text-fail' : 'text-[#9c9794]'}`}>
                    {r.last2WeekSOT === null ? '—' : `${r.last2WeekSOT}%`}{' '}
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-[#7b7571]">
                  <span>{r.atRiskCount} PO{r.atRiskCount === 1 ? '' : 's'} at risk</span>
                  <span>Earliest EGRD: {r.earliestEGRD ? formatDateShort(r.earliestEGRD) : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
