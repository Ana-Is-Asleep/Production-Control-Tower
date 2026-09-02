'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import type { PORollup } from '../../lib/poAggregation';

interface KeyInsightsPanelProps {
  rollups: PORollup[];
  avgDelayDays: number | null;
  weekLabel: string | null;
}

// Current-state facts derived from this scope's rollups only — no week-over-week trend claims
// (holding off on trend calculations everywhere, per an earlier decision), so every bullet here
// is something directly countable from the POs currently in view.
export function KeyInsightsPanel({ rollups, avgDelayDays, weekLabel }: KeyInsightsPanelProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const total = rollups.length;
    const late = rollups.filter((r) => r.sot === false);
    const notPredicted = rollups.filter((r) => r.sot === null).length;

    if (total > 0 && late.length > 0) {
      items.push({ icon: AlertTriangle, tone: 'warn', text: `${late.length} of ${total} POs in scope (${Math.round((late.length / total) * 100)}%) missed SOT.` });
    }

    if (late.length > 0) {
      const bySupplier = new Map<string, number>();
      late.forEach((r) => bySupplier.set(r.supplier, (bySupplier.get(r.supplier) ?? 0) + 1));
      const bySupplierSorted = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]);
      const [topSupplier, topCount] = bySupplierSorted[0];
      items.push({ icon: AlertTriangle, tone: 'fail', text: `${topSupplier} has the most late POs (${topCount}).` });

      const topN = bySupplierSorted.slice(0, Math.min(4, bySupplierSorted.length));
      const topNShare = Math.round((topN.reduce((sum, [, c]) => sum + c, 0) / late.length) * 100);
      if (bySupplierSorted.length > topN.length) {
        items.push({ icon: AlertTriangle, tone: 'warn', text: `Top ${topN.length} suppliers represent ${topNShare}% of late POs.` });
      }
    }

    if (avgDelayDays !== null) {
      items.push({ icon: Clock, tone: 'neutral', text: `Late POs are running ${avgDelayDays} days behind PGRD on average.` });
    }

    if (notPredicted > 0) {
      items.push({ icon: Info, tone: 'neutral', text: `${notPredicted} PO${notPredicted > 1 ? 's' : ''} don't have a ship date yet to evaluate SOT.` });
    }

    if (total > 0 && late.length === 0) {
      items.push({ icon: CheckCircle2, tone: 'pass', text: 'Every PO in scope shipped on time.' });
    }

    return items;
  }, [rollups, avgDelayDays]);

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
      {weekLabel && (
        <div className="bg-[#f5f2ee] rounded-lg px-3 py-2 mt-3 flex items-start gap-2">
          <Info size={13} className="text-[#9c9794] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#7b7571]">All metrics refer to POs in scope for {weekLabel}.</p>
        </div>
      )}
    </div>
  );
}
