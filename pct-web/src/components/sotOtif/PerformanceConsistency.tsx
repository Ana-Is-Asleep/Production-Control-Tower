'use client';

import type { ConsistencyStats } from '../../lib/poAggregation';

interface PerformanceConsistencyProps {
  stats: ConsistencyStats;
  periodLabel: string;
}

function pct(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

// Is this supplier reliably meeting expectations, or is performance volatile? Answers that with
// consistency-against-target over the selected historical period — deliberately not a "trend vs
// previous 4 weeks" calculation, and only counts weeks that have actually completed.
export function PerformanceConsistency({ stats, periodLabel }: PerformanceConsistencyProps) {
  const { weeksMeetingTarget, weeksBelowTarget, completedWeeksCount, avgSOT, avgOTIF, bestWeek, worstWeek } = stats;
  const meetingPct = completedWeeksCount ? Math.round((weeksMeetingTarget / completedWeeksCount) * 100) : 0;
  const belowPct = completedWeeksCount ? Math.round((weeksBelowTarget / completedWeeksCount) * 100) : 0;

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Performance Consistency</p>
      <p className="text-[11px] text-[#9c9794] mb-3">Selected evaluation period, {periodLabel}</p>

      {completedWeeksCount === 0 ? (
        <p className="text-xs text-[#9c9794]">No completed weeks in the selected period yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-pass-bg px-2.5 py-2">
              <p className="text-xl font-extrabold leading-none text-pass">{weeksMeetingTarget}</p>
              <p className="text-[10px] text-pass font-semibold mt-0.5">{meetingPct}%</p>
              <p className="text-[10px] text-[#7b7571] mt-1">Weeks meeting SOT target</p>
            </div>
            <div className="rounded-lg bg-fail-bg px-2.5 py-2">
              <p className="text-xl font-extrabold leading-none text-fail">{weeksBelowTarget}</p>
              <p className="text-[10px] text-fail font-semibold mt-0.5">{belowPct}%</p>
              <p className="text-[10px] text-[#7b7571] mt-1">Weeks below SOT target</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-[#f5f2ee] px-2.5 py-2">
              <p className="text-lg font-extrabold leading-none text-[#403833]">{pct(avgSOT)}</p>
              <p className="text-[10px] text-[#7b7571] mt-1">Average SOT (completed weeks)</p>
            </div>
            <div className="rounded-lg bg-[#f5f2ee] px-2.5 py-2">
              <p className="text-lg font-extrabold leading-none text-[#403833]">{pct(avgOTIF)}</p>
              <p className="text-[10px] text-[#7b7571] mt-1">Average OTIF (completed weeks)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="rounded-lg border border-[#e9e3df] px-2.5 py-2">
              <p className="text-[10px] text-[#9c9794] uppercase tracking-wide">Best Week</p>
              {bestWeek ? (
                <p className="text-sm font-bold text-pass mt-0.5">{bestWeek.label} <span className="text-[#403833] font-semibold">{pct(bestWeek.sot)}</span></p>
              ) : <p className="text-sm text-[#c8c0bb] mt-0.5">—</p>}
            </div>
            <div className="rounded-lg border border-[#e9e3df] px-2.5 py-2">
              <p className="text-[10px] text-[#9c9794] uppercase tracking-wide">Worst Week</p>
              {worstWeek ? (
                <p className="text-sm font-bold text-fail mt-0.5">{worstWeek.label} <span className="text-[#403833] font-semibold">{pct(worstWeek.sot)}</span></p>
              ) : <p className="text-sm text-[#c8c0bb] mt-0.5">—</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
