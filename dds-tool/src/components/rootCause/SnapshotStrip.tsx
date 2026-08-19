'use client';

import { REASON_CATEGORY_LABELS, type ReasonCategory } from '../../lib/reasonClassification';
import { CATEGORY_PALETTE } from './categoryPalette';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PORootCauseRow } from '../../lib/rootCauseAggregation';

interface SnapshotStripProps {
  rows: PORootCauseRow[]; // full inherited-range rows, for context around the snapshot week
  contextWeeks: WeekInRange[]; // last ~4-6 weeks including the snapshot week
  snapshotWeek: WeekInRange;
  onSelectWeekCategory: (week: string, category: ReasonCategory) => void;
}

// Snapshot mode's main visual — a small context strip instead of the full trend chart, with the
// snapshot (last completed) week visually emphasized against its recent neighbors.
export function SnapshotStrip({ rows, contextWeeks, snapshotWeek, onSelectWeekCategory }: SnapshotStripProps) {
  const maxCount = Math.max(
    1,
    ...contextWeeks.map((w) => rows.filter((r) => r.week?.label === w.label).length)
  );

  return (
    <div className="flex gap-2 overflow-x-auto">
      {contextWeeks.map((w) => {
        const weekRows = rows.filter((r) => r.week?.label === w.label);
        const isSnapshot = w.label === snapshotWeek.label;
        const byCategory = new Map<ReasonCategory, number>();
        for (const r of weekRows) {
          if (!r.finalCategory) continue;
          byCategory.set(r.finalCategory, (byCategory.get(r.finalCategory) ?? 0) + 1);
        }
        const stack = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

        return (
          <div
            key={w.label}
            className={`shrink-0 w-24 rounded-lg border px-2 py-2 ${isSnapshot ? 'border-brand ring-2 ring-brand/30' : 'border-[#e9e3df]'}`}
            style={{ background: isSnapshot ? '#fff7ed' : '#fff' }}
          >
            <p className={`text-[10px] font-semibold text-center ${isSnapshot ? 'text-brand' : 'text-[#9c9794]'}`}>{w.label}</p>
            <p className="text-lg font-extrabold text-center text-[#403833] leading-none mt-1">{weekRows.length}</p>
            <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-[#f5f2ee]">
              {stack.map(([cat, count]) => (
                <button
                  key={cat}
                  title={`${REASON_CATEGORY_LABELS[cat]}: ${count}`}
                  onClick={() => onSelectWeekCategory(w.label, cat)}
                  style={{ width: `${(count / maxCount) * 100}%`, background: CATEGORY_PALETTE[cat] }}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
