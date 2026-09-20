'use client';

import { COLOR } from '../../lib/statusColors';
import { REASON_CATEGORY_LABELS } from '../../lib/reasonClassification';
import type { RootCauseKPIs, TrendDirection } from '../../lib/rootCauseAggregation';

interface KPIStripProps {
  kpis: RootCauseKPIs;
  trend: TrendDirection;
  trendCaption: string;
}

function Card({ label, value, sub, valueColor, wide }: { label: string; value: string; sub?: string; valueColor?: string; wide?: boolean }) {
  return (
    <div className={`bg-white rounded-lg border border-[#e9e3df] px-4 py-3 min-w-0 ${wide ? 'flex-[1.6]' : 'flex-1'}`} style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1 truncate">{label}</p>
      {/* text-value cards (e.g. category names) can run much longer than a number ever would —
          wrap up to 2 lines (breaking mid-word if needed, since compound labels like
          "PO Reshuffling/Rescheduling/ERP System Issue" won't otherwise find a break point) at a
          smaller size, and get extra flex-basis (wide) so they're not squeezed into the same
          share of the row as the plain-number cards next to them. */}
      <p className={`font-extrabold leading-tight line-clamp-2 break-words ${wide ? 'text-lg' : 'text-xl'}`} style={{ color: valueColor ?? COLOR.navy }}>{value}</p>
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
        wide
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
