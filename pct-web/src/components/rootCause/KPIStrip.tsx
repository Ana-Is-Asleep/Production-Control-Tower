'use client';

import { COLOR } from '../../lib/statusColors';
import { REASON_CATEGORY_LABELS } from '../../lib/reasonClassification';
import type { RootCauseKPIs, TrendDirection } from '../../lib/rootCauseAggregation';

interface KPIStripProps {
  kpis: RootCauseKPIs;
  trend: TrendDirection;
  trendCaption: string;
}

function Card({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1 truncate">{label}</p>
      <p className="font-extrabold text-2xl leading-none truncate" style={{ color: valueColor ?? COLOR.navy }}>{value}</p>
      {sub && <p className="text-[10px] text-[#9c9794] mt-1 truncate">{sub}</p>}
    </div>
  );
}

// "up" = more flagged POs than the comparison period (worse, red); "down" = fewer (better,
// green); "flat" = no meaningful change.
function trendColor(trend: TrendDirection) {
  if (trend === 'up') return COLOR.fail;
  if (trend === 'down') return COLOR.pass;
  return COLOR.muted;
}
function trendArrow(trend: TrendDirection) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

export function KPIStrip({ kpis, trend, trendCaption }: KPIStripProps) {
  return (
    <div className="flex gap-2">
      <Card label="Affected lines" value={String(kpis.affectedLines)} />
      <Card label="Qty affected" value={kpis.qtyAffected.toLocaleString()} />
      <Card
        label="Top root cause"
        value={kpis.topCategory ? REASON_CATEGORY_LABELS[kpis.topCategory] : '—'}
        sub={kpis.topCategory ? `${kpis.topCategoryShare}% of flagged POs` : undefined}
      />
      <Card
        label="Trend"
        value={`${trendArrow(trend)} ${trend === 'flat' ? 'Flat' : trend === 'up' ? 'Worsening' : 'Improving'}`}
        valueColor={trendColor(trend)}
        sub={trendCaption}
      />
    </div>
  );
}
