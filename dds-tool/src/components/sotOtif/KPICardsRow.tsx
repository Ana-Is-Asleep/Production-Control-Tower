'use client';

import { COLOR } from '../../lib/statusColors';

interface KPICardsRowProps {
  sotPct: number | null;
  otifPct: number | null;
  sotTarget: number;
  otifTarget: number;
  totalPOs: number;
  onTimeCount: number;
  lateCount: number;
}

function pctLabel(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

function Card({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1 truncate">{label}</p>
      <p className="font-extrabold text-2xl leading-none" style={{ color: valueColor ?? COLOR.navy }}>{value}</p>
      {sub && <p className="text-[10px] text-[#9c9794] mt-1">{sub}</p>}
    </div>
  );
}

// The context-aware KPI strip directly under the persistent chart — reflects whatever week +
// supplier scope is currently selected (full period when no week is picked).
export function KPICardsRow({ sotPct, otifPct, sotTarget, otifTarget, totalPOs, onTimeCount, lateCount }: KPICardsRowProps) {
  return (
    <div className="flex gap-2 px-4 pb-2 shrink-0">
      <Card
        label={`SOT · ${sotTarget}% target`}
        value={pctLabel(sotPct)}
        valueColor={sotPct === null ? COLOR.muted : sotPct >= sotTarget ? COLOR.pass : COLOR.fail}
      />
      <Card
        label={`OTIF · ${otifTarget}% target`}
        value={pctLabel(otifPct)}
        valueColor={otifPct === null ? COLOR.muted : otifPct >= otifTarget ? COLOR.pass : COLOR.fail}
      />
      <Card label="Total POs in scope" value={String(totalPOs)} />
      <Card label="On time" value={String(onTimeCount)} valueColor={COLOR.pass} />
      <Card label="Late" value={String(lateCount)} valueColor={lateCount > 0 ? COLOR.fail : COLOR.muted} />
    </div>
  );
}
