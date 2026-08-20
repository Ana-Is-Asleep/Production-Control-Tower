'use client';

import type { SupplierTrend } from '../../lib/backlogAggregation';

interface BacklogSupplierRankingProps {
  trends: SupplierTrend[];
}

const CLASSIFICATION_STYLE: Record<SupplierTrend['classification'], { label: string; color: string; bg: string }> = {
  chronic: { label: 'Chronic', color: '#dc2626', bg: '#FEE2E2' },
  spike: { label: 'Spike', color: '#c2650a', bg: '#FFF3E0' },
  improving: { label: 'Improving', color: '#15803d', bg: '#DCFCE7' },
  stable: { label: 'Stable', color: '#7b7571', bg: '#f5f2ee' },
};

// Ranked by trend direction (net adding vs net clearing week-over-week), not raw backlog count —
// a supplier with a small but growing backlog is a bigger forward risk than one with a large but
// shrinking one.
export function BacklogSupplierRanking({ trends }: BacklogSupplierRankingProps) {
  const top = trends.slice(0, 10);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Supplier Ranking — by Trend</p>
      {top.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No backlog in scope</p>
      ) : (
        <div className="space-y-2">
          {top.map((t) => {
            const style = CLASSIFICATION_STYLE[t.classification];
            return (
              <div key={t.supplier} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#403833] truncate flex-1">{t.supplier}</span>
                <span className="px-2 py-0.5 rounded-full font-semibold" style={{ color: style.color, background: style.bg }}>{style.label}</span>
                <span className={`font-semibold w-14 text-right ${t.netChange > 0 ? 'text-fail' : t.netChange < 0 ? 'text-pass' : 'text-[#7b7571]'}`}>
                  {t.netChange > 0 ? '+' : ''}{t.netChange}
                </span>
                <span className="text-[#9c9794] w-16 text-right">{t.current} total</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
