'use client';

import { COLOR } from '../../lib/statusColors';

interface KpiCard {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}

function Card({ label, value, sub, valueColor }: KpiCard) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1 truncate">{label}</p>
      <p className="font-extrabold text-2xl leading-none truncate" style={{ color: valueColor ?? COLOR.navy }}>{value}</p>
      {sub && <p className="text-[10px] text-[#9c9794] mt-1 truncate">{sub}</p>}
    </div>
  );
}

interface BacklogKpiStripProps {
  total: number;
  recent: number;
  accumulated: number;
  avgAgeDays: number;
  noEsdCount: number;
  expectedCount: number;
}

// No week-over-week trend card here — the data source can't support a genuine "vs last week"
// figure (see computeSupplierBacklogSummary's comment), so this strip only shows current-state facts.
export function BacklogKpiStrip({ total, recent, accumulated, avgAgeDays, noEsdCount, expectedCount }: BacklogKpiStripProps) {
  return (
    <div className="flex gap-2">
      <Card label="Total Backlog" value={String(total)} />
      <Card label="Recent (≤2wk)" value={String(recent)} valueColor={COLOR.brand} />
      <Card label="Accumulated (>2wk)" value={String(accumulated)} valueColor={COLOR.fail} />
      <Card label="Avg Age" value={`${avgAgeDays}d`} />
      <Card label="No-ESD" value={String(noEsdCount)} valueColor={COLOR.fail} />
      <Card label="Expected" value={String(expectedCount)} sub="Future PGRD, ESD booked after it" />
    </div>
  );
}
