'use client';

import type { SupplierBacklogSummary } from '../../lib/backlogAggregation';

interface BacklogSupplierRankingProps {
  summary: SupplierBacklogSummary[];
}

// Ranked by current backlog count — no trend/chronic-vs-spike claim, since a genuine week-over-week
// comparison isn't computable from this live, mutate-in-place data source (see
// computeSupplierBacklogSummary's comment).
export function BacklogSupplierRanking({ summary }: BacklogSupplierRankingProps) {
  const top = summary.slice(0, 10);
  const maxCount = Math.max(1, ...top.map((s) => s.count));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Supplier Ranking — Current Backlog</p>
      {top.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No backlog in scope</p>
      ) : (
        <div className="space-y-3">
          {top.map((s) => (
            <div key={s.supplier}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-[#403833] truncate">{s.supplier}</span>
                <span className="text-xs font-semibold text-[#58524e] shrink-0">
                  {s.count} POs · avg {s.avgAgeDays}d{s.noEsdCount > 0 ? ` · ${s.noEsdCount} no-ESD` : ''}
                </span>
              </div>
              <div className="h-3 bg-[#f5f2ee] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max((s.count / maxCount) * 100, 3)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
