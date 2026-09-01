'use client';

import { useMemo } from 'react';
import { Users, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import type { BacklogPORow, ExpectedByWeek, SupplierBacklogSummary } from '../../lib/backlogAggregation';

interface BacklogKeyInsightsProps {
  rows: BacklogPORow[];
  noEsdCount: number;
  supplierSummary: SupplierBacklogSummary[];
  expectedCount: number;
  expectedByWeek: ExpectedByWeek[];
}

const MAX_INSIGHTS = 4;

// Interprets the current-state data rather than repeating the KPI cards already visible above —
// current-state only, no week-over-week trend claims (the live, mutate-in-place data source can't
// support a genuine "vs last week" figure).
export function BacklogKeyInsights({ rows, noEsdCount, supplierSummary, expectedCount, expectedByWeek }: BacklogKeyInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof Users; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const total = rows.length;

    if (supplierSummary.length && total > 0) {
      const top = supplierSummary[0];
      items.push({ icon: Users, tone: 'neutral', text: `${top.pctOfBacklog}% of current backlog is concentrated at ${top.supplier}.` });
    }

    if (total > 0) {
      const recentShare = Math.round((rows.filter((r) => r.ageBucket === 'recent').length / total) * 100);
      items.push({ icon: Clock, tone: recentShare >= 50 ? 'pass' : 'neutral', text: `${recentShare}% of current backlog is less than 2 weeks old.` });
    }

    if (noEsdCount > 0) {
      items.push({ icon: AlertTriangle, tone: 'fail', text: `${noEsdCount} PO${noEsdCount > 1 ? 's have' : ' has'} no ESD and therefore no expected clearance date.` });
    }

    const oldestSupplier = [...supplierSummary].sort((a, b) => b.avgAgeDays - a.avgAgeDays)[0];
    if (oldestSupplier && oldestSupplier.count >= 3) {
      items.push({ icon: TrendingUp, tone: 'warn', text: `${oldestSupplier.supplier} has the oldest significant backlog, averaging ${oldestSupplier.avgAgeDays} days.` });
    }

    if (items.length < MAX_INSIGHTS && expectedCount > 0) {
      items.push({ icon: AlertTriangle, tone: 'warn', text: `${expectedCount} additional PO${expectedCount > 1 ? 's are' : ' is'} already expected to enter backlog based on current bookings.` });
    }

    if (items.length < MAX_INSIGHTS && expectedByWeek.length > 0) {
      const largest = expectedByWeek.reduce((a, b) => (b.count > a.count ? b : a));
      if (largest.count > 0) {
        items.push({ icon: TrendingUp, tone: 'neutral', text: `${largest.count} POs are expected to enter backlog in ${largest.label}, the largest upcoming concentration.` });
      }
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [rows, noEsdCount, supplierSummary, expectedCount, expectedByWeek]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">No backlog in scope.</p>
      ) : (
        <div className="space-y-3 flex-1">
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
