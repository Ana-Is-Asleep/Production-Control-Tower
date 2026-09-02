'use client';

import { COLOR } from '../../lib/statusColors';
import type { LTKpis } from '../../lib/leadTimeAnalytics';

interface LeadTimeKpiStripProps {
  kpis: LTKpis;
}

function fmtDays(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)}`;
}

function fmtSigned(v: number | null): string {
  if (v === null) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

function Card({ label, value, unit, sub, color }: { label: string; value: string; unit: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1 truncate">{label}</p>
      <p className="font-extrabold text-2xl leading-none truncate text-[#403833]">
        {value}<span className="text-sm font-semibold text-[#9c9794]"> {unit}</span>
      </p>
      <p className="text-[10px] mt-1 truncate font-semibold" style={{ color }}>{sub}</p>
    </div>
  );
}

export function LeadTimeKpiStrip({ kpis }: LeadTimeKpiStripProps) {
  const vsTargetColor = kpis.vsTargetDays === null ? COLOR.muted : kpis.vsTargetDays <= 0 ? COLOR.pass : COLOR.fail;
  const trendColor = kpis.trendVsPrevDays === null ? COLOR.muted : kpis.trendVsPrevDays < 0 ? COLOR.pass : kpis.trendVsPrevDays > 0 ? COLOR.fail : COLOR.muted;

  return (
    <div className="flex gap-2">
      <Card
        label="Current Lead Time"
        value={fmtDays(kpis.currentLeadTime)}
        unit="days"
        sub={`Latest ${kpis.currentBucketLabel}`}
        color={COLOR.muted}
      />
      <Card
        label="vs 30-Day Target"
        value={fmtSigned(kpis.vsTargetDays)}
        unit="days"
        sub={kpis.vsTargetDays === null ? '' : kpis.vsTargetDays <= 0 ? 'At or under target' : 'Above target'}
        color={vsTargetColor}
      />
      <Card
        label="Trend vs Previous Period"
        value={fmtSigned(kpis.trendVsPrevDays)}
        unit="days"
        sub={kpis.trendVsPrevDays === null ? '' : kpis.trendVsPrevDays < 0 ? 'Improving' : kpis.trendVsPrevDays > 0 ? 'Worse' : 'Flat'}
        color={trendColor}
      />
      <Card
        label="Periods Meeting Target"
        value={String(kpis.pctPeriodsUnderTarget)}
        unit="%"
        sub={`${kpis.periodsUnderTarget} of ${kpis.periodsPresent} periods`}
        color={COLOR.muted}
      />
    </div>
  );
}
