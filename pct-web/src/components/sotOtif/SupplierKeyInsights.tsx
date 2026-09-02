'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, TrendingDown, CheckCircle2 } from 'lucide-react';
import type { ConsistencyStats } from '../../lib/poAggregation';

interface SupplierKeyInsightsProps {
  weekLabel: string | null;
  sotPct: number | null;
  otifPct: number | null;
  sotTarget: number;
  otifTarget: number;
  lateCount: number;
  posInScope: number;
  consistency: ConsistencyStats;
}

const MAX_INSIGHTS = 4;

// Interprets performance rather than restating the KPI numbers already visible above — mixes
// selected-week facts with the historical consistency read, same current-state-only convention
// as the rest of this redesign (no week-over-week deltas).
export function SupplierKeyInsights({ weekLabel, sotPct, otifPct, sotTarget, otifTarget, lateCount, posInScope, consistency }: SupplierKeyInsightsProps) {
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
      items.push({
        icon: consistency.weeksMeetingTarget <= consistency.completedWeeksCount / 2 ? AlertTriangle : CheckCircle2,
        tone: consistency.weeksMeetingTarget <= consistency.completedWeeksCount / 2 ? 'warn' : 'pass',
        text: `The supplier has met the SOT target in only ${consistency.weeksMeetingTarget} of ${consistency.completedWeeksCount} completed weeks in the selected period.`,
      });
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [weekLabel, sotPct, otifPct, sotTarget, otifTarget, lateCount, posInScope, consistency]);

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
