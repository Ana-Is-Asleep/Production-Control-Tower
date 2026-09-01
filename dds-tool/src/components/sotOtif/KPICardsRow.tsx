'use client';

import type { LucideIcon } from 'lucide-react';
import { CalendarCheck2, Clock, HelpCircle, Timer } from 'lucide-react';
import { COLOR } from '../../lib/statusColors';

interface KPICardsRowProps {
  sotPct: number | null;
  otifPct: number | null;
  sotTarget: number;
  otifTarget: number;
  totalPOs: number;
  onTimeCount: number;
  lateCount: number;
  notSotPredictedCount: number;
  avgDelayDays: number | null;
  weekLabel: string | null;
  // Mode B (single supplier) only — a single lighter inline strip instead of the icon-card row, so
  // it reads as supporting information rather than a second hero row under the supplier header bar.
  compact?: boolean;
}

function pctLabel(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-3 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wide text-[#9c9794]">{label}</span>
      <span className="text-sm font-bold" style={{ color: valueColor ?? COLOR.navy }}>{value}</span>
    </div>
  );
}

type IconTint = 'brand' | 'pass' | 'fail' | 'neutral';

const ICON_TINT_BG: Record<IconTint, string> = {
  brand: 'bg-brand-dim text-brand',
  pass: 'bg-pass-bg text-pass',
  fail: 'bg-fail-bg text-fail',
  neutral: 'bg-[#f5f2ee] text-[#7b7571]',
};

function IconStatCard({ icon: Icon, tint, label, value, sub }: { icon: LucideIcon; tint: IconTint; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] px-3 py-2.5 flex-1 min-w-0 flex items-center gap-2.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ICON_TINT_BG[tint]}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-[#9c9794] truncate">{label}</p>
        <p className="text-lg font-extrabold leading-none text-[#403833] mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-[#9c9794] truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// The context-aware KPI strip directly under the persistent chart — reflects whatever week +
// supplier scope is currently selected (full period when no week is picked). SOT/OTIF themselves
// are shown as boxed cards beside the chart now (see SotOtifDrilldown), so this row covers the
// supporting volume/timing metrics instead.
export function KPICardsRow({ totalPOs, onTimeCount, lateCount, notSotPredictedCount, avgDelayDays, weekLabel, sotTarget, otifTarget, sotPct, otifPct, compact }: KPICardsRowProps) {
  if (compact) {
    return (
      <div className="mx-4 mb-2 shrink-0 bg-[#fbfaf9] rounded-lg border border-[#e9e3df] flex items-center divide-x divide-[#e9e3df] py-1.5">
        <StatItem label={`SOT ${sotTarget}%`} value={pctLabel(sotPct)} valueColor={sotPct === null ? COLOR.muted : sotPct >= sotTarget ? COLOR.pass : COLOR.fail} />
        <StatItem label={`OTIF ${otifTarget}%`} value={pctLabel(otifPct)} valueColor={otifPct === null ? COLOR.muted : otifPct >= otifTarget ? COLOR.pass : COLOR.fail} />
        <StatItem label="Total POs" value={String(totalPOs)} />
        <StatItem label="On time" value={String(onTimeCount)} valueColor={COLOR.pass} />
        <StatItem label="Late" value={String(lateCount)} valueColor={lateCount > 0 ? COLOR.fail : COLOR.muted} />
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-4 pb-2 pt-2 shrink-0">
      <IconStatCard icon={CalendarCheck2} tint="brand" label="POs in Scope" value={String(totalPOs)} sub={weekLabel ?? undefined} />
      <IconStatCard icon={Clock} tint="pass" label="On Time (OTIF)" value={String(onTimeCount)} />
      <IconStatCard icon={Clock} tint="fail" label="Late" value={String(lateCount)} />
      <IconStatCard icon={HelpCircle} tint="neutral" label="Not SOT Predicted" value={String(notSotPredictedCount)} />
      <IconStatCard icon={Timer} tint="brand" label="Avg Delay (Late POs)" value={avgDelayDays !== null ? `${avgDelayDays} days` : '—'} />
      <div className="rounded-lg border border-[#e9e3df] px-4 py-2.5 flex flex-col items-center justify-center shrink-0 w-[100px]" style={{ background: '#f0ede9' }}>
        <p className="text-[9px] uppercase tracking-widest text-[#9c9794]">Target</p>
        <p className="text-lg font-extrabold text-[#403833] mt-0.5">{sotTarget}%</p>
      </div>
    </div>
  );
}
