'use client';

import { REASON_CATEGORY_LABELS } from '../../lib/reasonClassification';
import { CATEGORY_PALETTE } from './categoryPalette';
import type { CategoryRanking } from '../../lib/rootCauseAggregation';
import type { ReasonCategory } from '../../lib/reasonClassification';

interface ParetoRankingProps {
  ranking: CategoryRanking[];
  onSelectCategory: (category: ReasonCategory) => void;
  title?: string;
}

// Horizontal bar ranking of root causes by total impact — used as the Pareto view when multiple
// suppliers are in scope, and as the simple ranked list when exactly one supplier is (no supplier
// dimension needed at n=1, so the same component works for both per the spec).
export function ParetoRanking({ ranking, onSelectCategory, title = 'Root Cause Ranking' }: ParetoRankingProps) {
  const maxPct = ranking[0]?.pct ?? 0;

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">{title}</p>
      {ranking.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No flagged POs in scope</p>
      ) : (
        <div className="space-y-3">
          {ranking.map((r) => (
            <button key={r.category} onClick={() => onSelectCategory(r.category)} className="w-full text-left">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-[#403833] truncate">{REASON_CATEGORY_LABELS[r.category]}</span>
                <span className="text-xs font-semibold text-[#58524e] shrink-0">{r.count} POs · {r.pct}%</span>
              </div>
              <div className="h-3 bg-[#f5f2ee] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max((r.pct / Math.max(maxPct, 1)) * 100, 3)}%`, background: CATEGORY_PALETTE[r.category] }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
