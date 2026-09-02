'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { LT_TARGET_DAYS, type LTKpis, type OverviewPoint } from '../../lib/leadTimeAnalytics';
import type { SKUCategory } from '../../lib/skuUtils';

interface LeadTimeInsightsProps {
  kpis: LTKpis;
  overview: OverviewPoint[];
  categories: SKUCategory[];
  contextLabel: string; // e.g. supplier name, or '' for the general/multi-supplier view
}

const MAX_INSIGHTS = 4;

// Interprets the currently filtered dataset — current-state + trend-vs-previous-period only
// (both already computed by computeLTKpis), no root-cause claims (that's a different page).
export function LeadTimeInsights({ kpis, overview, categories, contextLabel }: LeadTimeInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof TrendingUp; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const subject = contextLabel ? `${contextLabel}'s average` : 'Average';

    if (kpis.trendVsPrevDays !== null && kpis.currentLeadTime !== null) {
      const improved = kpis.trendVsPrevDays < 0;
      items.push({
        icon: improved ? TrendingDown : TrendingUp,
        tone: improved ? 'pass' : 'fail',
        text: `${subject} lead time ${improved ? 'improved' : 'worsened'} by ${Math.abs(kpis.trendVsPrevDays).toFixed(1)} days compared with the previous period${
          kpis.vsTargetDays !== null && kpis.vsTargetDays > 0 ? `, but remains ${kpis.vsTargetDays.toFixed(1)} days above the ${LT_TARGET_DAYS}-day target` : ''
        }.`,
      });
    } else if (kpis.vsTargetDays !== null) {
      items.push({
        icon: kpis.vsTargetDays <= 0 ? CheckCircle2 : AlertTriangle,
        tone: kpis.vsTargetDays <= 0 ? 'pass' : 'fail',
        text: `${subject} lead time is ${Math.abs(kpis.vsTargetDays).toFixed(1)} days ${kpis.vsTargetDays <= 0 ? 'below' : 'above'} the ${LT_TARGET_DAYS}-day target.`,
      });
    }

    // largest contributor to above-target lead time, among the currently visible category series
    if (categories.length > 1) {
      const latest = [...overview].reverse().find((p) => categories.some((c) => p.byCategory[c] !== null && p.byCategory[c] !== undefined));
      if (latest) {
        const worst = categories
          .map((c) => ({ c, v: latest.byCategory[c] ?? null }))
          .filter((x): x is { c: SKUCategory; v: number } => x.v !== null)
          .sort((a, b) => b.v - a.v)[0];
        if (worst && worst.v > LT_TARGET_DAYS) {
          items.push({ icon: AlertTriangle, tone: 'warn', text: `${worst.c} is currently the largest contributor to above-target lead time.` });
        }
      }
    }

    if (kpis.periodsPresent > 0) {
      const aboveShare = kpis.periodsPresent - kpis.periodsUnderTarget;
      if (aboveShare > 0) {
        items.push({ icon: AlertTriangle, tone: 'warn', text: `${aboveShare} of the last ${kpis.periodsPresent} completed periods were above target.` });
      } else {
        items.push({ icon: CheckCircle2, tone: 'pass', text: `All of the last ${kpis.periodsPresent} completed periods met the ${LT_TARGET_DAYS}-day target.` });
      }
    }

    // a category that's stayed consistently under target across every completed period shown
    if (categories.length > 1) {
      const consistentlyGood = categories.find((c) => {
        const vals = overview.map((p) => p.byCategory[c]).filter((v): v is number => v !== null && v !== undefined);
        return vals.length >= 3 && vals.every((v) => v <= LT_TARGET_DAYS);
      });
      if (consistentlyGood && items.length < MAX_INSIGHTS) {
        const streak = overview.filter((p) => p.byCategory[consistentlyGood] !== null && p.byCategory[consistentlyGood] !== undefined).length;
        items.push({ icon: CheckCircle2, tone: 'pass', text: `${consistentlyGood} has remained at or below target for the last ${streak} completed periods.` });
      }
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [kpis, overview, categories, contextLabel]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights{contextLabel ? ` — ${contextLabel}` : ''}</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">Not enough completed periods to summarize yet.</p>
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
