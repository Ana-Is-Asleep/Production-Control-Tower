'use client';

import type { BacklogPORow, ExpectedByWeek } from '../../lib/backlogAggregation';

interface BacklogTopCardsProps {
  rows: BacklogPORow[];
  recentCount: number;
  accumulatedCount: number;
  noEsdCount: number;
  expectedCount: number;
  expectedByWeek: ExpectedByWeek[];
  avgAgeDays: number;
}

function pct(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

// Current Backlog and Expected Future Backlog are two different populations and must never be
// combined into one number — Current Backlog's 210 is the dominant figure, with Recent/
// Accumulated/No ESD shown as its composition (not as three separate equal-weight KPI cards).
export function BacklogTopCards({
  rows, recentCount, accumulatedCount, noEsdCount, expectedCount, expectedByWeek, avgAgeDays,
}: BacklogTopCardsProps) {
  const total = rows.length;

  // Within each age bucket, how many have no ESD at all vs. an ESD that's already slipped
  // (esdPassedNoAsd — same field the PO table's "ESD passed — ASD missing" status already uses),
  // so "Recent"/"Critical" isn't just a raw count but shows what's actually driving it.
  const recentRows = rows.filter((r) => r.ageBucket === 'recent');
  const criticalRows = rows.filter((r) => r.ageBucket === 'accumulated');
  const recentNoEsd = recentRows.filter((r) => !r.hasEsd).length;
  const recentEsdPast = recentRows.filter((r) => r.esdPassedNoAsd).length;
  const criticalNoEsd = criticalRows.filter((r) => !r.hasEsd).length;
  const criticalEsdPast = criticalRows.filter((r) => r.esdPassedNoAsd).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr] gap-3">
      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Current Backlog</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{total} <span className="text-sm font-semibold text-[#9c9794]">POs</span></p>
        <p className="text-[11px] text-[#9c9794] mt-1 mb-3">PGRD has passed and PO not yet shipped</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">
              <th className="text-left pb-1"></th>
              <th className="text-right pb-1 pl-2">Total</th>
              <th className="text-right pb-1 pl-2">No ESD</th>
              <th className="text-right pb-1 pl-2">ESD in the past</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#f4f1ef]">
              <td className="py-1 font-semibold text-brand">Recent (≤1wk)</td>
              <td className="py-1 text-right font-bold text-[#403833]">{recentCount}</td>
              <td className="py-1 text-right text-[#58524e]">{recentNoEsd}</td>
              <td className="py-1 text-right text-[#58524e]">{recentEsdPast}</td>
            </tr>
            <tr className="border-t border-[#f4f1ef]">
              <td className="py-1 font-semibold text-fail">Critical (&gt;1wk)</td>
              <td className="py-1 text-right font-bold text-[#403833]">{accumulatedCount}</td>
              <td className="py-1 text-right text-[#58524e]">{criticalNoEsd}</td>
              <td className="py-1 text-right text-[#58524e]">{criticalEsdPast}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] text-[#9c9794] mt-2">{noEsdCount} of {total} POs ({pct(noEsdCount, total)}%) have no ESD at all.</p>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Expected Future Backlog</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{expectedCount} <span className="text-sm font-semibold text-[#9c9794]">POs</span></p>
        <p className="text-[11px] text-[#9c9794] mt-1 mb-3">Not backlog yet</p>
        <p className="text-[10px] text-[#9c9794] mb-1.5">Expected to enter backlog (based on PGRD week)</p>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          {expectedByWeek.map((w) => (
            <div key={w.label} className="text-center">
              <p className="text-sm font-extrabold leading-none text-[#403833]">{w.count}</p>
              <p className="text-[9px] text-[#9c9794] mt-0.5">{w.label}</p>
            </div>
          ))}
          {expectedByWeek.length === 0 && <span className="text-[11px] text-[#9c9794]">None in the upcoming window</span>}
        </div>
        <div className="bg-[#fff7ed] rounded-md px-2.5 py-2 text-[10px] text-[#7b7571] leading-snug">
          These POs have a future PGRD, but their ESD is already later than PGRD. If the current booking remains unchanged, they are expected to enter backlog.
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Avg Age</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{avgAgeDays}d</p>
        <p className="text-[11px] text-[#9c9794] mt-2">Average age of current backlog POs</p>
        <p className="text-[10px] text-[#c8c0bb] mt-auto pt-2">Calculated from today to PGRD</p>
      </div>
    </div>
  );
}
