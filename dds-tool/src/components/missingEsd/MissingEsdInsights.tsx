'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, PackageSearch, CheckCircle2 } from 'lucide-react';
import { computeEgrdWeekBuckets, computeSupplierExposure, EGRD_NEEDING_ACTION_WEEKS, type MissingEsdRow } from '../../lib/missingEsdAggregation';

interface MissingEsdInsightsProps {
  rows: MissingEsdRow[];
  curWeek: number;
  curYear: number;
}

const MAX_INSIGHTS = 4;

// Current-state facts only, no week-over-week comparisons — none of this is tracked historically,
// so every bullet here interprets the current scope rather than restating a KPI number.
export function MissingEsdInsights({ rows, curWeek, curYear }: MissingEsdInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const buckets = computeEgrdWeekBuckets(rows, curWeek, curYear);
    const overdue = buckets[0].count;
    const upcomingNeeding = buckets.slice(1, 1 + EGRD_NEEDING_ACTION_WEEKS).reduce((s, b) => s + b.count, 0);

    if (overdue > 0) {
      items.push({ icon: AlertTriangle, tone: 'fail', text: `${overdue} PO${overdue > 1 ? 's are' : ' is'} already overdue and require immediate attention.` });
    }
    if (upcomingNeeding > 0) {
      items.push({ icon: Clock, tone: 'warn', text: `${upcomingNeeding} additional PO${upcomingNeeding > 1 ? 's' : ''} have EGRD within the next 3 weeks.` });
    }

    const upcomingWeekBuckets = buckets.filter((b) => b.key.startsWith('w'));
    const largestUpcoming = upcomingWeekBuckets.reduce((a, b) => (b.count > a.count ? b : a), upcomingWeekBuckets[0]);
    if (largestUpcoming && largestUpcoming.count > 0) {
      items.push({ icon: Clock, tone: 'neutral', text: `The largest concentration of upcoming missing ESD sits in ${largestUpcoming.label} with ${largestUpcoming.count} POs.` });
    }

    const needingActionRows = rows.filter((r) => r.urgency !== 'watchlist');
    const { top } = computeSupplierExposure(needingActionRows, 1);
    if (top.length && needingActionRows.length > 0 && top[0].needingAction > 0) {
      const share = Math.round((top[0].needingAction / needingActionRows.length) * 100);
      items.push({ icon: PackageSearch, tone: 'neutral', text: `${share}% of all Needing Action POs belong to ${top[0].supplier}.` });
    }

    if (rows.length === 0) {
      items.push({ icon: CheckCircle2, tone: 'pass', text: 'No open POs are missing ESD in the current scope.' });
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [rows, curWeek, curYear]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">No POs in scope to summarize.</p>
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
