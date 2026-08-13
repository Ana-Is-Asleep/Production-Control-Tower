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

// Mode A, Section 2 — focused purely on SOT risk, not OTIF: PGRD (not EGRD) is the date SOT is
// actually measured against, so a PO whose PGRD falls in the next 4 weeks with no ESD booked yet
// is one where SOT can't be confirmed and is at real risk of being missed outright. A supplier
// only appears here if they have at least one such PO, ranked by how many they have, worst first.
// Recent SOT% is shown only as secondary context (chronically-struggling supplier vs. an
// otherwise-reliable one with a booking gap) — it never decides inclusion or ordering.
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
      earliestPGRD: Date | null;
      last2WeekSOT: number | null;
    }[] = [];

    for (const [supplier, supplierLines] of bySupplier) {
      const atRiskLines = supplierLines.filter((l) => l.pgrd && l.pgrd >= today && l.pgrd <= cutoff && !l.esd);
      if (atRiskLines.length === 0) continue; // no unbooked PO due soon = nothing to chase here

      const recentLines = supplierLines.filter((l) => l.pgrd && l.pgrd >= recentCutoff && l.pgrd <= today);
      const last2WeekSOT = aggregateSOTRate(recentLines, isChinaSupplier, today);

      const atRiskPOs = new Set(atRiskLines.map((l) => l.po));
      const earliestPGRD = atRiskLines.reduce<Date | null>((min, l) => {
        if (!l.pgrd) return min;
        return !min || l.pgrd < min ? l.pgrd : min;
      }, null);

      result.push({ supplier, atRiskCount: atRiskPOs.size, earliestPGRD, last2WeekSOT });
    }

    // most unbooked POs first; earliest-due date breaks ties
    return result.sort((a, b) => {
      if (b.atRiskCount !== a.atRiskCount) return b.atRiskCount - a.atRiskCount;
      return (a.earliestPGRD?.getTime() ?? Infinity) - (b.earliestPGRD?.getTime() ?? Infinity);
    });
  }, [lines, today, isChinaSupplier]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Forward Risk</p>
      <p className="text-[10px] text-[#b5aaa5] mb-3">
        SOT risk only: POs with a PGRD in the next 4 weeks that have no shipping booking yet, so
        on-time status can&apos;t be confirmed — chase these before they slip. Ranked by count, worst first.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No unbooked POs with a PGRD in the next 4 weeks</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {rows.map((r) => {
            const supplierLines = lines.filter((l) => l.supplier === r.supplier);
            const trend = computeTrend(weeksInRange, supplierLines, isChinaSupplier, today, getWeek);
            return (
              <div key={r.supplier} className="border border-[#e9e3df] rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#403833] truncate">{r.supplier}</span>
                  <span className="text-sm font-extrabold text-fail shrink-0">
                    {r.atRiskCount} PO{r.atRiskCount === 1 ? '' : 's'} unbooked
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-[#7b7571]">
                  <span>
                    Recent SOT: {r.last2WeekSOT === null ? '—' : `${r.last2WeekSOT}%`}{' '}
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                  </span>
                  <span>Earliest PGRD: {r.earliestPGRD ? formatDateShort(r.earliestPGRD) : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
