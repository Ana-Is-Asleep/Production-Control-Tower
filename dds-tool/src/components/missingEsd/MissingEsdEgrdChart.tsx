'use client';

import { computeEgrdWeekBuckets, EGRD_NEEDING_ACTION_WEEKS, type MissingEsdRow } from '../../lib/missingEsdAggregation';

interface MissingEsdEgrdChartProps {
  rows: MissingEsdRow[];
  curWeek: number;
  curYear: number;
  selectedBucketKeys: string[] | null;
  onSelectBucket: (key: string | null) => void;
}

function barColor(bucketKey: string, group: 'needing' | 'not_urgent'): string {
  if (bucketKey === 'overdue') return '#dc2626';
  if (group === 'needing') return '#ff7700';
  return '#d9d2ca';
}

// The main visualization on the page: current missing-ESD POs grouped by the week of their
// EGRD, so urgency (color) and timing (which week) show up in one chart instead of a separate
// urgency-only bar. Clicking a bar filters the PO table below to that exact week/overdue bucket.
export function MissingEsdEgrdChart({ rows, curWeek, curYear, selectedBucketKeys, onSelectBucket }: MissingEsdEgrdChartProps) {
  const buckets = computeEgrdWeekBuckets(rows, curWeek, curYear);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const dividerIndex = 1 + EGRD_NEEDING_ACTION_WEEKS; // after "Overdue" + N needing-action weeks

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">POs Missing ESD by EGRD Week</p>
      <p className="text-[11px] text-[#9c9794] mb-2">Current missing ESD POs grouped by the week of their EGRD</p>
      <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide mb-3">
        <span className="flex items-center gap-1 text-fail"><span className="w-2 h-2 rounded-full bg-fail" /> Needing Action ≤ 3 weeks</span>
        <span className="flex items-center gap-1 text-[#9c9794]"><span className="w-2 h-2 rounded-full bg-[#d9d2ca]" /> Not Urgent &gt; 3 weeks</span>
      </div>

      <div className="flex-1 min-h-0 flex items-end gap-1.5 relative" style={{ minHeight: 160 }}>
        {buckets.map((b, i) => {
          const isSelected = selectedBucketKeys !== null && selectedBucketKeys.length === 1 && selectedBucketKeys[0] === b.key;
          return (
            <div key={b.key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end relative">
              {i === dividerIndex && <span className="absolute -left-[7px] top-0 bottom-6 w-px bg-[#e9e3df]" />}
              <span className="text-[11px] font-bold text-[#403833] mb-1">{b.count}</span>
              <button
                title={`${b.label}: ${b.count} POs`}
                onClick={() => onSelectBucket(isSelected ? null : b.key)}
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(4, (b.count / maxCount) * 100)}%`,
                  background: barColor(b.key, b.group),
                  outline: isSelected ? '2px solid #403833' : 'none',
                  outlineOffset: isSelected ? '1px' : undefined,
                  opacity: selectedBucketKeys !== null && !selectedBucketKeys.includes(b.key) ? 0.55 : 1,
                }}
              />
              <span className="text-[10px] text-[#7b7571] mt-1.5 whitespace-nowrap">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
