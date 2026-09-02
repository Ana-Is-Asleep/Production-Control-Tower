'use client';

import { Info } from 'lucide-react';
import type { BacklogPORow, ExpectedByWeek } from '../../lib/backlogAggregation';

interface BacklogTopCardsProps {
  rows: BacklogPORow[];
  recentCount: number;
  accumulatedCount: number;
  noEsdCount: number;
  expectedCount: number;
  expectedByWeek: ExpectedByWeek[];
  avgAgeDays: number;
  expectedClearanceCount: number;
}

function pct(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

// Current Backlog and Expected Future Backlog are two different populations and must never be
// combined into one number — Current Backlog's 210 is the dominant figure, with Recent/
// Accumulated/No ESD shown as its composition (not as three separate equal-weight KPI cards).
export function BacklogTopCards({
  rows, recentCount, accumulatedCount, noEsdCount, expectedCount, expectedByWeek, avgAgeDays, expectedClearanceCount,
}: BacklogTopCardsProps) {
  const total = rows.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr_1fr] gap-3">
      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1 flex items-center gap-1">Current Backlog <Info size={12} /></p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{total} <span className="text-sm font-semibold text-[#9c9794]">POs</span></p>
        <p className="text-[11px] text-[#9c9794] mt-1 mb-3">PGRD has passed and PO not yet shipped</p>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-lg font-extrabold leading-none text-brand">{recentCount}</p>
            <p className="text-[10px] text-[#7b7571] mt-0.5">Recent (≤2wk) · {pct(recentCount, total)}%</p>
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none text-fail">{accumulatedCount}</p>
            <p className="text-[10px] text-[#7b7571] mt-0.5">Accumulated (&gt;2wk) · {pct(accumulatedCount, total)}%</p>
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none text-fail">{noEsdCount}</p>
            <p className="text-[10px] text-[#7b7571] mt-0.5">No ESD · {pct(noEsdCount, total)}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1 flex items-center gap-1">Expected Future Backlog <Info size={12} /></p>
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
          These POs have a future PGRD, but their confirmed ESD is already later than PGRD. If the current booking remains unchanged, they are expected to enter backlog.
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Avg Age</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{avgAgeDays}d</p>
        <p className="text-[11px] text-[#9c9794] mt-2">Average age of current backlog POs</p>
        <p className="text-[10px] text-[#c8c0bb] mt-auto pt-2">Calculated from today to PGRD</p>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Expected Clearance</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{expectedClearanceCount} <span className="text-sm font-semibold text-[#9c9794]">POs</span></p>
        <p className="text-[11px] text-[#9c9794] mt-2">Have a known expected clearance date</p>
        <p className="text-[10px] text-[#c8c0bb] mt-auto pt-2">Based on confirmed ESD</p>
      </div>
    </div>
  );
}
