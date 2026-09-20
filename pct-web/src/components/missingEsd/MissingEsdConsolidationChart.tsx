'use client';

import { CalendarClock } from 'lucide-react';
import { computeConsolidationRiskByWeek, type ConsolidationRisk } from '../../lib/missingEsdAggregation';
import { formatDateShort } from '../../lib/dateUtils';

interface MissingEsdConsolidationChartProps {
  risks: ConsolidationRisk[];
  curWeek: number;
  curYear: number;
}

// Friday-EGRD consolidation risks (>10 unbooked POs sharing a Friday EGRD — a slip leaves no
// weekend runway before pickup) shown as a small distribution-over-time chart instead of a wall
// of banner text, with the per-supplier detail kept as a compact list underneath the chart.
export function MissingEsdConsolidationChart({ risks, curWeek, curYear }: MissingEsdConsolidationChartProps) {
  if (risks.length === 0) return null;

  const buckets = computeConsolidationRiskByWeek(risks, curWeek, curYear);
  const maxCount = Math.max(1, ...buckets.map((b) => b.poCount));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col sm:flex-row gap-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="sm:w-[220px] shrink-0">
        <p className="text-sm font-bold text-[#403833] flex items-center gap-1.5">
          <CalendarClock size={15} className="text-warn" /> Consolidation Risk
        </p>
        <p className="text-[11px] text-[#9c9794] mb-3">Unbooked POs on a shared Friday EGRD, by week</p>
        <div className="flex items-end gap-2" style={{ height: 64 }}>
          {buckets.map((b) => (
            <div key={b.key} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[11px] font-bold text-[#403833] mb-1">{b.poCount || ''}</span>
              <div
                className="w-full rounded-t"
                style={{ height: `${Math.max(4, (b.poCount / maxCount) * 100)}%`, background: b.poCount > 0 ? '#f59e0b' : '#e9e3df' }}
              />
              <span className="text-[10px] text-[#7b7571] mt-1">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5 sm:border-l border-[#f4f1ef] sm:pl-4 pt-1">
        {risks.map((risk) => (
          <div key={`${risk.supplier}-${risk.egrd.toDateString()}`} className="flex items-start gap-1.5 text-xs text-[#403833]">
            <CalendarClock size={12} className="text-warn shrink-0 mt-0.5" />
            <span>{risk.supplier} — {risk.poCount} unbooked POs due EGRD {formatDateShort(risk.egrd)} (Friday); pickup likely delayed to Monday.</span>
          </div>
        ))}
      </div>
    </div>
  );
}
