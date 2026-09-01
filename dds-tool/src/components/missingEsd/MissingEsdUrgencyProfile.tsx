'use client';

import { Info } from 'lucide-react';
import { computeUrgencyProfile, type MissingEsdRow } from '../../lib/missingEsdAggregation';

interface MissingEsdUrgencyProfileProps {
  rows: MissingEsdRow[];
}

const BUCKET_COLOR: Record<string, string> = {
  overdue: '#dc2626',
  due_lt_1wk: '#ea580c',
  due_1_3wk: '#f59e0b',
  due_3_6wk: '#d9d2ca',
  due_gt_6wk: '#c8c0bb',
};

export function MissingEsdUrgencyProfile({ rows }: MissingEsdUrgencyProfileProps) {
  const buckets = computeUrgencyProfile(rows);
  const total = rows.length;
  const needingAction = buckets[0].count + buckets[1].count + buckets[2].count;
  const notUrgent = buckets[3].count + buckets[4].count;

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-[#403833]">Urgency Profile <span className="text-[11px] font-medium text-[#9c9794]">(All {total} POs missing ESD)</span></p>
        <Info size={14} className="text-[#9c9794]" />
      </div>

      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#7b7571] mb-1">
        <span className="text-fail">Needing Action (≤ 3 weeks)</span>
        <span>Not Urgent (&gt; 3 weeks)</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden">
        {buckets.map((b) => (
          <div key={b.key} style={{ width: total ? `${(b.count / total) * 100}%` : 0, background: BUCKET_COLOR[b.key] }} title={`${b.label}: ${b.count}`} />
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2 mt-3 text-center">
        {buckets.map((b) => (
          <div key={b.key}>
            <p className="text-lg font-extrabold leading-none" style={{ color: BUCKET_COLOR[b.key] }}>{b.count}</p>
            <p className="text-[10px] text-[#7b7571] mt-1">{b.label}</p>
            <p className="text-[10px] text-[#9c9794]">{total ? Math.round((b.count / total) * 100) : 0}%</p>
          </div>
        ))}
      </div>

      <div className="flex mt-3 rounded-lg overflow-hidden text-xs font-semibold">
        <div className="flex-1 bg-fail-bg text-fail text-center py-2">{needingAction} POs ({total ? Math.round((needingAction / total) * 100) : 0}%) need action</div>
        <div className="flex-1 bg-[#f5f2ee] text-[#7b7571] text-center py-2">{notUrgent} POs ({total ? Math.round((notUrgent / total) * 100) : 0}%) not urgent</div>
      </div>
    </div>
  );
}
