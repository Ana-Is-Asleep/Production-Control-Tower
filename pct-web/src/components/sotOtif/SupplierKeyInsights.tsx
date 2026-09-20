'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, TrendingDown, CheckCircle2 } from 'lucide-react';
import type { ConsistencyStats } from '../../lib/poAggregation';
import type { NextWeekProjection } from './KeyInsightsPanel';

interface SupplierKeyInsightsProps {
  weekLabel: string | null;
  sotPct: number | null;
  otifPct: number | null;
  sotTarget: number;
  otifTarget: number;
  lateCount: number;
  posInScope: number;
  consistency: ConsistencyStats;
  // Nearest upcoming week's projected SOT/OTIF for this supplier — same ESD-based projection
  // that drives the chart's dashed "projected" line, just surfaced as text here too.
  projection?: NextWeekProjection | null;
  // Every upcoming week's projection, in order — scanned to say when the supplier is expected to
  // cross back over (or fall below) the SOT target, rather than just the immediate next week.
  futureProjections?: NextWeekProjection[];
}

const MAX_INSIGHTS = 6;

// Interprets performance rather than restating the KPI numbers already visible above — mixes
// selected-week facts with the historical consistency read, same current-state-only convention
// as the rest of this redesign (no week-over-week deltas).
export function SupplierKeyInsights({ weekLabel, sotPct, otifPct, sotTarget, otifTarget, lateCount, posInScope, consistency, projection, futureProjections }: SupplierKeyInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const week = weekLabel ?? 'the selected period';

    if (sotPct !== null) {
      const diff = Math.abs(sotPct - sotTarget);
      if (sotPct < sotTarget) {
        items.push({ icon: TrendingDown, tone: 'fail', text: `SOT fell to ${sotPct}% in ${week} and remains ${diff}pp below the ${sotTarget}% target.` });
      } else {
        items.push({ icon: CheckCircle2, tone: 'pass', text: `SOT reached ${sotPct}% in ${week}, ${diff}pp above the ${sotTarget}% target.` });
      }
    }

    if (sotPct !== null && otifPct !== null && sotPct !== otifPct) {
      const stronger = otifPct > sotPct ? 'OTIF' : 'SOT';
      const strongerPct = otifPct > sotPct ? otifPct : sotPct;
      const weaker = otifPct > sotPct ? 'SOT' : 'OTIF';
      const weakerTarget = weaker === 'SOT' ? sotTarget : otifTarget;
      const diff = Math.abs(strongerPct - weakerTarget);
      const belowOrAbove = strongerPct < weakerTarget ? 'below' : 'above';
      items.push({ icon: Clock, tone: 'neutral', text: `${stronger} remains stronger than ${weaker} at ${strongerPct}%, only ${diff}pp ${belowOrAbove} target.` });
    }

    if (lateCount > 0 && posInScope > 0) {
      items.push({ icon: AlertTriangle, tone: 'warn', text: `${lateCount} of ${posInScope} POs were not shipped on time in ${week}.` });
    }

    if (consistency.completedWeeksCount > 0) {
      // A flat 0-for-N record reads oddly as a plain ratio ("met it in 0 of 7 weeks") — since it
      // has never once happened in the period, call out that it isn't expected to going forward
      // either, rather than implying it's just a coin-flip that hasn't landed yet.
      const text = consistency.weeksMeetingTarget === 0
        ? `The supplier has not met the SOT target in any of the ${consistency.completedWeeksCount} completed weeks in the selected period, and isn't expected to do so going forward.`
        : `The supplier has met the SOT target in only ${consistency.weeksMeetingTarget} of ${consistency.completedWeeksCount} completed weeks in the selected period.`;
      items.push({
        icon: consistency.weeksMeetingTarget <= consistency.completedWeeksCount / 2 ? AlertTriangle : CheckCircle2,
        tone: consistency.weeksMeetingTarget <= consistency.completedWeeksCount / 2 ? 'warn' : 'pass',
        text,
      });
    }

    if (projection && (projection.sotPct !== null || projection.otifPct !== null)) {
      const parts: string[] = [];
      if (projection.sotPct !== null) parts.push(`${projection.sotPct}% SOT`);
      if (projection.otifPct !== null) parts.push(`${projection.otifPct}% OTIF`);
      const belowTarget = (projection.sotPct !== null && projection.sotPct < sotTarget)
        || (projection.otifPct !== null && projection.otifPct < otifTarget);
      items.push({
        icon: belowTarget ? AlertTriangle : CheckCircle2,
        tone: belowTarget ? 'warn' : 'pass',
        text: `Based on currently booked ship dates, ${projection.weekLabel} is projected to reach ${parts.join(' and ')}.`,
      });
    }

    // Scans the same projected-weeks run used above to say WHEN the trend is expected to cross
    // the SOT target, rather than just whether next week looks good — currently on-target
    // suppliers get a heads-up if the projection dips back below; currently-missing suppliers get
    // told when (or whether) the projection has them recovering.
    if (sotPct !== null && futureProjections && futureProjections.length > 0) {
      if (sotPct >= sotTarget) {
        const dip = futureProjections.find((p) => p.sotPct !== null && p.sotPct < sotTarget);
        if (dip) {
          items.push({ icon: AlertTriangle, tone: 'warn', text: `The supplier is expected to fall back below the SOT target in ${dip.weekLabel}.` });
        }
      } else {
        const recovery = futureProjections.find((p) => p.sotPct !== null && p.sotPct >= sotTarget);
        if (recovery) {
          items.push({ icon: CheckCircle2, tone: 'pass', text: `The supplier is expected to be back on the SOT target by ${recovery.weekLabel}.` });
        } else {
          const lastWeek = futureProjections[futureProjections.length - 1];
          items.push({ icon: AlertTriangle, tone: 'fail', text: `The supplier is not expected to reach the SOT target through ${lastWeek.weekLabel}.` });
        }
      }
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [weekLabel, sotPct, otifPct, sotTarget, otifTarget, lateCount, posInScope, consistency, projection, futureProjections]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">No data to summarize yet.</p>
      ) : (
        <div className="space-y-2.5 flex-1">
          {insights.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-2 text-xs text-[#403833]">
                <Icon size={14} className={`shrink-0 mt-0.5 ${toneColor[item.tone]}`} />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
