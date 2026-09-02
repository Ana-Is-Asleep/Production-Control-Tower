'use client';

import type { AgeBand } from '../../lib/backlogAggregation';

interface BacklogAgeBreakdownProps {
  bands: AgeBand[];
}

// <2wk = green, 2-4wk = orange, 4-6wk = amber/darker orange, 6wk+ = red.
const BAND_COLORS = ['#15803d', '#ff7700', '#c2650a', '#dc2626'];

// How long current backlog POs have already been in backlog (Today - PGRD) — NOT when they're
// expected to ship (that's the ESD-based clearance forecast elsewhere on the page). One horizontal
// segmented distribution rather than four independent bar charts, so recency vs aging reads at a
// glance.
export function BacklogAgeBreakdown({ bands }: BacklogAgeBreakdownProps) {
  const total = bands.reduce((s, b) => s + b.count, 0);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Backlog Age Breakdown</p>
      <p className="text-[11px] text-[#9c9794] mb-3">How long current backlog POs have already been in backlog</p>

      {total === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No backlog in scope</p>
      ) : (
        <>
          <div className="flex h-9 rounded-lg overflow-hidden">
            {bands.map((b, i) => {
              const pct = Math.round((b.count / total) * 100);
              if (pct === 0) return null;
              return (
                <div key={b.label} className="flex items-center justify-center text-xs font-bold text-white" style={{ width: `${pct}%`, background: BAND_COLORS[i] }}>
                  {pct >= 8 ? `${pct}%` : ''}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {bands.map((b, i) => (
              <div key={b.label}>
                <p className="text-sm font-extrabold leading-none" style={{ color: BAND_COLORS[i] }}>{b.count} <span className="text-[10px] text-[#9c9794] font-semibold">POs</span></p>
                <p className="text-[10px] text-[#7b7571] mt-1">{b.label} in backlog</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
