'use client';

import { useMemo } from 'react';
import { aggregateSOTRate, aggregateOTIFRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { rollupByPO } from '../../lib/poAggregation';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface SupplierHeaderBarProps {
  supplier: string;
  lines: PurchaseLine[]; // this supplier's lines across the full selected period (not week-narrowed)
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
}

interface WeekPoint {
  week: WeekInRange;
  pct: number | null;
}

function computeTrendSentence(weekPoints: WeekPoint[]): string {
  const withData = weekPoints.filter((w): w is { week: WeekInRange; pct: number } => w.pct !== null);
  if (withData.length === 0) return 'Mixed performance';

  const avg = (arr: WeekPoint[]) => {
    const vals = arr.filter((w): w is { week: WeekInRange; pct: number } => w.pct !== null);
    return vals.length ? vals.reduce((s, w) => s + w.pct, 0) / vals.length : null;
  };

  const last2Avg = avg(weekPoints.slice(-2));
  const prior2Avg = avg(weekPoints.slice(-4, -2));
  if (last2Avg !== null && prior2Avg !== null) {
    const diff = last2Avg - prior2Avg;
    if (diff <= -10) return `Declining — SOT dropped ${Math.round(-diff)}pp over the last 4 weeks`;
    if (diff >= 10) return `Recovering — SOT up ${Math.round(diff)}pp vs prior 4 weeks`;
  }

  const pcts = withData.map((w) => w.pct);
  const swing = Math.max(...pcts) - Math.min(...pcts);
  if (swing > 20) return `Volatile — SOT swings ${Math.round(swing)}pp week to week`;

  let maxStreak = 0;
  let curStreak = 0;
  for (const w of weekPoints) {
    if (w.pct !== null && w.pct < 50) {
      curStreak += 1;
      maxStreak = Math.max(maxStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }
  if (maxStreak >= 4) return `Stable underperformer — below 50% for ${maxStreak} consecutive weeks`;

  const last4WithData = weekPoints.slice(-4).filter((w): w is { week: WeekInRange; pct: number } => w.pct !== null);
  const onTrackCount = last4WithData.filter((w) => w.pct >= 90).length;
  if (onTrackCount >= 3) return `On track — SOT at or above 90% in ${onTrackCount} of the last 4 weeks`;

  return 'Mixed performance';
}

export function SupplierHeaderBar({ supplier, lines, weeksInRange, isChinaSupplier, today }: SupplierHeaderBarProps) {
  const { overallSOT, overallOTIF, totalPOs, trendSentence, worst, best } = useMemo(() => {
    const rollups = rollupByPO(lines, isChinaSupplier, today);
    const overallSOT = aggregateSOTRate(lines, isChinaSupplier, today);
    const overallOTIF = aggregateOTIFRate(lines, isChinaSupplier);

    // trend/best/worst are based on actual (non-projected) weeks only — "actual week-over-week data"
    const actualWeeks = weeksInRange.filter((w) => !w.isFuture);
    const weekPoints: WeekPoint[] = actualWeeks.map((w) => {
      const weekLines = lines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === w.week && getISOWeekYear(l.pgrd) === w.year);
      const pct = weekLines.length ? aggregateSOTRate(weekLines, isChinaSupplier, today) : null;
      return { week: w, pct };
    });

    const trendSentence = computeTrendSentence(weekPoints);

    const withData = weekPoints.filter((w): w is { week: WeekInRange; pct: number } => w.pct !== null);
    let worst: WeekPoint | null = null;
    let best: WeekPoint | null = null;
    for (const w of withData) {
      if (!worst || w.pct < worst.pct!) worst = w;
      if (!best || w.pct > best.pct!) best = w;
    }

    return { overallSOT, overallOTIF, totalPOs: rollups.length, trendSentence, worst, best };
  }, [lines, weeksInRange, isChinaSupplier, today]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex items-center gap-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <span className="text-base font-bold text-[#403833] truncate">{supplier}</span>
      </div>

      <div className="w-px h-8 bg-[#e9e3df] shrink-0" />

      <div className="flex items-center gap-5 flex-1 min-w-0">
        <div className="shrink-0">
          <p className="text-[9px] uppercase tracking-widest text-[#9c9794]">SOT</p>
          <p className="text-sm font-bold" style={{ color: overallSOT !== null && overallSOT < 90 ? COLOR.fail : COLOR.navy }}>
            {overallSOT === null ? '—' : `${overallSOT}%`}
          </p>
        </div>
        <div className="shrink-0">
          <p className="text-[9px] uppercase tracking-widest text-[#9c9794]">OTIF</p>
          <p className="text-sm font-bold" style={{ color: overallOTIF !== null && overallOTIF < 90 ? COLOR.fail : COLOR.navy }}>
            {overallOTIF === null ? '—' : `${overallOTIF}%`}
          </p>
        </div>
        <div className="shrink-0">
          <p className="text-[9px] uppercase tracking-widest text-[#9c9794]">Total POs</p>
          <p className="text-sm font-bold text-[#403833]">{totalPOs}</p>
        </div>
        <p className="text-xs italic text-[#9c9794] truncate min-w-0">{trendSentence}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {worst && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#FEE2E2] text-[#991B1B] whitespace-nowrap">
            Worst: {worst.week.label} · {worst.pct}%
          </span>
        )}
        {best && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#DCFCE7] text-[#14532D] whitespace-nowrap">
            Best: {best.week.label} · {best.pct}%
          </span>
        )}
      </div>
    </div>
  );
}
