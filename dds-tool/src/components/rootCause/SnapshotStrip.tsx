'use client';

import { ROOT_CAUSE_REASON_LABELS, type RootCauseReason } from '../../types/actions';
import { ROOT_CAUSE_REASON_PALETTE } from './categoryPalette';
import type { WeekInRange } from '../../hooks/useFilters';
import type { RootCauseSubmissionRow } from '../../lib/rootCauseSubmissions';

interface SnapshotStripProps {
  rows: RootCauseSubmissionRow[]; // full inherited-range rows, for context around the snapshot week
  contextWeeks: WeekInRange[]; // last ~4-6 weeks including the snapshot week
  highlightedWeek: string; // whichever week is actively selected (defaults to snapshotWeek, but
  // tracks the last-clicked tile — previously this stayed pinned to snapshotWeek even after
  // clicking a different week, making earlier weeks look unclickable even though the table filter
  // underneath it was in fact updating.
  onSelectWeek: (week: string) => void;
  onSelectWeekCategory: (week: string, category: RootCauseReason) => void;
}

// Snapshot mode's main visual — a small context strip instead of the full trend chart, with the
// snapshot (last completed) week visually emphasized against its recent neighbors. The whole tile
// is clickable (filters the table to that week, all reasons) — the thin colored segments
// underneath are a *finer* drill-in on top of that, not the only way to interact with a week.
export function SnapshotStrip({ rows, contextWeeks, highlightedWeek, onSelectWeek, onSelectWeekCategory }: SnapshotStripProps) {
  const maxCount = Math.max(
    1,
    ...contextWeeks.map((w) => rows.filter((r) => r.week?.label === w.label).length)
  );

  return (
    <div className="flex gap-2 overflow-x-auto">
      {contextWeeks.map((w) => {
        const weekRows = rows.filter((r) => r.week?.label === w.label);
        const isSnapshot = w.label === highlightedWeek;
        const byCategory = new Map<RootCauseReason, number>();
        for (const r of weekRows) {
          if (!r.reason) continue;
          byCategory.set(r.reason, (byCategory.get(r.reason) ?? 0) + 1);
        }
        const stack = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

        return (
          <button
            key={w.label}
            onClick={() => onSelectWeek(w.label)}
            className={`shrink-0 w-24 rounded-lg border px-2 py-2 text-left cursor-pointer hover:border-brand transition-colors ${isSnapshot ? 'border-brand ring-2 ring-brand/30' : 'border-[#e9e3df]'}`}
            style={{ background: isSnapshot ? '#fff7ed' : '#fff' }}
          >
            <p className={`text-[10px] font-semibold text-center ${isSnapshot ? 'text-brand' : 'text-[#9c9794]'}`}>{w.label}</p>
            <p className="text-lg font-extrabold text-center text-[#403833] leading-none mt-1">{weekRows.length}</p>
            <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-[#f5f2ee]">
              {stack.map(([cat, count]) => (
                <span
                  key={cat}
                  role="button"
                  title={`${ROOT_CAUSE_REASON_LABELS[cat]}: ${count}`}
                  onClick={(e) => { e.stopPropagation(); onSelectWeekCategory(w.label, cat); }}
                  style={{ width: `${(count / maxCount) * 100}%`, background: ROOT_CAUSE_REASON_PALETTE[cat] }}
                  className="h-full"
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
