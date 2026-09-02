'use client';

import { useMemo } from 'react';
import { Clock, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import type { BacklogPORow, ExpectedByWeek, SkuBacklogRow } from '../../lib/backlogAggregation';

interface BacklogSupplierInsightsProps {
  rows: BacklogPORow[];
  noEsdCount: number;
  avgAgeDays: number;
  expectedCount: number;
  skus: SkuBacklogRow[];
  expectedByWeek: ExpectedByWeek[];
}

const MAX_INSIGHTS = 5;

// Interprets this one supplier's backlog rather than repeating the KPI cards above — current-state
// only, same convention as the generic Backlog page's insights.
export function BacklogSupplierInsights({ rows, noEsdCount, avgAgeDays, expectedCount, skus, expectedByWeek }: BacklogSupplierInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof Clock; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const total = rows.length;

    if (total > 0) {
      const recentShare = Math.round((rows.filter((r) => r.ageBucket === 'recent').length / total) * 100);
      items.push({ icon: Clock, tone: recentShare >= 50 ? 'pass' : 'neutral', text: `${recentShare}% of this supplier's backlog is less than 2 weeks old.` });
    }

    items.push({ icon: Clock, tone: 'neutral', text: `Average backlog age is ${avgAgeDays} days.` });

    if (noEsdCount > 0) {
      items.push({ icon: AlertTriangle, tone: 'fail', text: `${noEsdCount} PO${noEsdCount > 1 ? 's have' : ' has'} no ESD and therefore no expected clearance date.` });
    }

    if (expectedCount > 0) {
      items.push({ icon: TrendingUp, tone: 'warn', text: `${expectedCount} additional PO${expectedCount > 1 ? 's are' : ' is'} already expected to enter backlog based on current bookings.` });
    }

    if (skus.length && total > 0) {
      const top = skus[0];
      if (top.pctOfBacklog >= 20) {
        items.push({ icon: Package, tone: 'neutral', text: `${top.sku} represents ${top.pctOfBacklog}% of this supplier's backlog.` });
      }
    }

    if (items.length < MAX_INSIGHTS && expectedByWeek.length > 0) {
      const largest = expectedByWeek.reduce((a, b) => (b.count > a.count ? b : a));
      if (largest.count > 0) {
        items.push({ icon: TrendingUp, tone: 'neutral', text: `${largest.count} POs are expected to enter backlog in ${largest.label}, the largest upcoming concentration.` });
      }
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [rows, noEsdCount, avgAgeDays, expectedCount, skus, expectedByWeek]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">No backlog in scope.</p>
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
