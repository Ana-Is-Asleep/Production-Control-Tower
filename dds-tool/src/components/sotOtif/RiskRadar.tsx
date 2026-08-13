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
// actually measured against. A PO qualifies as at-risk two ways: (1) PGRD in the next 4 weeks with
// no ESD booked yet, so on-time status can't even be confirmed, or (2) already booked but the ESD
// is after the PGRD, meaning it's already known it'll land in backlog. A supplier only appears
// here if they have at least one such PO, ranked by how many they have, worst first. Recent SOT%
// is shown only as secondary context — it never decides inclusion or ordering.
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
      const atRiskLines = supplierLines.filter((l) => {
        if (!l.pgrd || l.pgrd < today || l.pgrd > cutoff) return false;
        if (!l.esd) return true; // no booking at all
        return l.esd > l.pgrd; // booked, but already known to land after PGRD — will be backlog
      });
      if (atRiskLines.length === 0) continue; // nothing unbooked or already-known-late = nothing to chase here

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
        SOT risk only: POs with a PGRD in the next 4 weeks that either have no booking yet, or are
        already booked to ship after their PGRD (heading for backlog). Ranked by count, worst first.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No POs at risk with a PGRD in the next 4 weeks</p>
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
                    {r.atRiskCount} PO{r.atRiskCount === 1 ? '' : 's'} at risk
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
