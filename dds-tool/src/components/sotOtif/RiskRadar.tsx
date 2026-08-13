'use client';

import { useMemo } from 'react';
import type { IsChinaSupplier } from '../../lib/kpiFormulas';
import { rollupByPO, computeTrend, type PORollup } from '../../lib/poAggregation';
import { aggregateSOTRate } from '../../lib/kpiFormulas';
import { getISOWeek, getISOWeekYear, isoWeekLabel } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface RiskRadarProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getWeek(l: PurchaseLine) {
  return l.pgrd ? { week: getISOWeek(l.pgrd), year: getISOWeekYear(l.pgrd) } : null;
}

type Severity = 'critical' | 'high' | 'watch';

const SEVERITY_STYLE: Record<Severity, { border: string; label: string; labelColor: string }> = {
  critical: { border: COLOR.fail, label: 'Critical', labelColor: COLOR.fail },
  high: { border: COLOR.warn, label: 'High', labelColor: COLOR.warn },
  watch: { border: '#d5cdc6', label: 'Watch', labelColor: COLOR.muted },
};

interface SupplierRisk {
  supplier: string;
  severity: Severity;
  unbookedCount: number;
  lateBookedCount: number;
  avgDelayWeeks: number | null;
  affectedWeeks: string[];
  recentSOT: number | null;
  trend: 'up' | 'down' | 'flat';
}

// Panel A — Forward Risk. Two independent risk signals, both PGRD/EGRD-based (SOT-only, no OTIF):
// (1) unbooked: no ESD yet, and EGRD is either already past or within the next 90 days — beyond
//     90 days out there's nothing actionable yet, so those are excluded entirely.
// (2) booked-but-late: has an ESD, but it lands after the PGRD — already known to miss.
export function RiskRadar({ lines, weeksInRange, isChinaSupplier, today }: RiskRadarProps) {
  const rows = useMemo(() => {
    const horizon = new Date(today.getTime() + NINETY_DAYS_MS);
    const recentCutoff = new Date(today.getTime() - TWO_WEEKS_MS);

    const bySupplier = new Map<string, PORollup[]>();
    for (const r of rollupByPO(lines, isChinaSupplier, today)) {
      if (!bySupplier.has(r.supplier)) bySupplier.set(r.supplier, []);
      bySupplier.get(r.supplier)!.push(r);
    }

    const result: SupplierRisk[] = [];

    for (const [supplier, rollups] of bySupplier) {
      const unbooked = rollups.filter((r) => !r.esd && r.egrd && r.egrd <= horizon);
      const lateBooked = rollups.filter((r) => r.esd && r.pgrd && r.esd > r.pgrd);
      if (unbooked.length === 0 && lateBooked.length === 0) continue;

      const hasOverdueUnbooked = unbooked.some((r) => r.egrd && r.egrd < today);

      const delaysWeeks = lateBooked
        .filter((r) => r.esd && r.pgrd)
        .map((r) => (r.esd!.getTime() - r.pgrd!.getTime()) / MS_PER_WEEK);
      const avgDelayWeeks = delaysWeeks.length ? delaysWeeks.reduce((s, n) => s + n, 0) / delaysWeeks.length : null;

      let severity: Severity;
      if (hasOverdueUnbooked || (avgDelayWeeks !== null && avgDelayWeeks > 3)) {
        severity = 'critical';
      } else if (unbooked.length > 0 || (avgDelayWeeks !== null && avgDelayWeeks >= 1)) {
        severity = 'high';
      } else {
        severity = 'watch';
      }

      const affectedWeekSet = new Set<string>();
      for (const r of [...unbooked, ...lateBooked]) {
        if (r.pgrd) affectedWeekSet.add(isoWeekLabel(r.pgrd));
      }
      const affectedWeeks = [...affectedWeekSet].sort();

      const supplierLines = lines.filter((l) => l.supplier === supplier);
      const recentLines = supplierLines.filter((l) => l.pgrd && l.pgrd >= recentCutoff && l.pgrd <= today);
      const recentSOT = aggregateSOTRate(recentLines, isChinaSupplier, today);
      const trend = computeTrend(weeksInRange, supplierLines, isChinaSupplier, today, getWeek);

      result.push({
        supplier,
        severity,
        unbookedCount: unbooked.length,
        lateBookedCount: lateBooked.length,
        avgDelayWeeks,
        affectedWeeks,
        recentSOT,
        trend,
      });
    }

    return result.sort((a, b) => (b.unbookedCount + b.lateBookedCount) - (a.unbookedCount + a.lateBookedCount));
  }, [lines, weeksInRange, today, isChinaSupplier]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Forward Risk</p>
      <p className="text-[10px] text-[#b5aaa5] mb-3">
        Unbooked POs with EGRD in the past or within 90 days, plus POs already confirmed to ship after PGRD.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No suppliers at risk</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {rows.map((r) => {
            const s = SEVERITY_STYLE[r.severity];
            return (
              <div
                key={r.supplier}
                className="rounded-lg bg-white border border-[#e9e3df] px-3 py-2.5"
                style={{ borderLeftWidth: 4, borderLeftColor: s.border, boxShadow: '0 1px 2px rgba(44,40,37,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#403833] truncate">{r.supplier}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide shrink-0" style={{ color: s.labelColor }}>{s.label}</span>
                    </div>
                    <p className="text-[11px] text-[#7b7571] mt-0.5">
                      Recent SOT: {r.recentSOT === null ? '—' : `${r.recentSOT}%`}{' '}
                      <span className={r.trend === 'up' ? 'text-pass' : r.trend === 'down' ? 'text-fail' : 'text-[#9c9794]'}>
                        {r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'}
                      </span>
                    </p>
                    {r.affectedWeeks.length > 0 && (
                      <p className="text-[10px] text-[#9c9794] mt-1 truncate">{r.affectedWeeks.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    <span className="text-xs font-semibold whitespace-nowrap">
                      <span className="mr-1">🔴</span>
                      <span style={{ color: COLOR.fail }}>{r.unbookedCount}</span> unbooked
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap">
                      <span className="mr-1">🟠</span>
                      <span style={{ color: COLOR.warn }}>{r.lateBookedCount}</span> will miss PGRD
                    </span>
                    {r.lateBookedCount > 0 && r.avgDelayWeeks !== null && (
                      <span className="text-[11px] text-[#7b7571] whitespace-nowrap">
                        ⏱ Avg {r.avgDelayWeeks.toFixed(1)} wks late
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
