'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, PackageSearch, CheckCircle2 } from 'lucide-react';
import { computeUrgencyProfile, computeSupplierExposure, type MissingEsdRow } from '../../lib/missingEsdAggregation';

interface MissingEsdInsightsProps {
  rows: MissingEsdRow[];
}

// Current-state facts only, same convention as the SOT/OTIF Key Insights panel — no
// week-over-week comparisons, since none of this is tracked historically.
export function MissingEsdInsights({ rows }: MissingEsdInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const buckets = computeUrgencyProfile(rows);
    const overdue = buckets[0].count;
    const dueSoon = buckets[1].count + buckets[2].count;

    if (overdue > 0) {
      items.push({ icon: AlertTriangle, tone: 'fail', text: `${overdue} PO${overdue > 1 ? 's are' : ' is'} already overdue and require immediate action.` });
    }
    if (dueSoon > 0) {
      items.push({ icon: Clock, tone: 'warn', text: `${dueSoon} additional PO${dueSoon > 1 ? 's' : ''} will become overdue within the next 3 weeks if no ESD is confirmed.` });
    }

    const { top } = computeSupplierExposure(rows);
    const needingActionTotal = rows.filter((r) => r.urgency !== 'watchlist').length;
    if (top.length && needingActionTotal > 0) {
      const share = Math.round((top[0].needingAction / needingActionTotal) * 100);
      if (top[0].needingAction > 0) {
        items.push({ icon: PackageSearch, tone: 'neutral', text: `${share}% of Needing Action POs are concentrated at ${top[0].supplier}.` });
      }
    }

    const due1to3 = buckets[2].count;
    if (due1to3 > 0) {
      items.push({ icon: Clock, tone: 'neutral', text: `The largest volume due in the next 1–3 weeks: ${due1to3} POs.` });
    }

    if (rows.length === 0) {
      items.push({ icon: CheckCircle2, tone: 'pass', text: 'No open POs are missing ESD in the current scope.' });
    }

    return items;
  }, [rows]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">No POs in scope to summarize.</p>
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
