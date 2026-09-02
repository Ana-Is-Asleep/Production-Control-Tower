'use client';

import { KpiBox } from '../shared/KpiBox';

interface SupplierKpiStripProps {
  weekLabel: string | null;
  posInScope: number;
  sotPct: number | null;
  otifPct: number | null;
  sotTarget: number;
  otifTarget: number;
  onTimeCount: number;
  lateCount: number;
  otifOnCount: number;
  otifOffCount: number;
}

function pctLabel(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

function pctOf(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}% of POs` : '—';
}

function targetHelper(pct: number | null, target: number): string {
  if (pct === null) return 'No data yet';
  const diff = Math.abs(pct - target);
  if (diff === 0) return 'On target';
  return `${diff}pp ${pct < target ? 'below' : 'above'} target`;
}

// Mode B's KPI row — the benchmark for SOT/OTIF is the 90% target, not a delta vs the previous
// week (that comparison is deliberately not built anywhere in this redesign yet).
export function SupplierKpiStrip({ weekLabel, posInScope, sotPct, otifPct, sotTarget, otifTarget, onTimeCount, lateCount, otifOnCount, otifOffCount }: SupplierKpiStripProps) {
  return (
    <div className="flex gap-2 px-4 pb-2 pt-2 shrink-0 flex-wrap">
      <div className="rounded-lg border border-brand px-3 py-2 shrink-0 w-[130px]" style={{ background: '#fff7ed' }}>
        <p className="text-[10px] font-semibold text-brand uppercase tracking-wide truncate">{weekLabel ? `${weekLabel} selected` : 'Full period'}</p>
        <p className="text-lg font-extrabold text-[#403833] leading-none mt-1">{posInScope}</p>
        <p className="text-[10px] text-[#9c9794] mt-0.5">POs in scope</p>
      </div>
      <KpiBox
        label={`SOT · ${sotTarget}% target`}
        value={pctLabel(sotPct)}
        valueClassName={`text-xl ${sotPct === null ? 'text-[#c8c0bb]' : sotPct >= sotTarget ? 'text-pass' : 'text-fail'}`}
        tint={sotPct === null ? 'neutral' : sotPct >= sotTarget ? 'pass' : 'fail'}
        sub={<span className="text-[10px] text-[#9c9794]">{targetHelper(sotPct, sotTarget)}</span>}
        className="w-[130px]"
      />
      <KpiBox
        label={`OTIF · ${otifTarget}% target`}
        value={pctLabel(otifPct)}
        valueClassName={`text-xl ${otifPct === null ? 'text-[#c8c0bb]' : otifPct >= otifTarget ? 'text-pass' : 'text-fail'}`}
        tint={otifPct === null ? 'neutral' : otifPct >= otifTarget ? 'pass' : 'fail'}
        sub={<span className="text-[10px] text-[#9c9794]">{targetHelper(otifPct, otifTarget)}</span>}
        className="w-[130px]"
      />
      <KpiBox label="Shipped On Time" value={onTimeCount} valueClassName="text-xl text-pass" sub={<span className="text-[10px] text-[#9c9794]">{pctOf(onTimeCount, posInScope)}</span>} className="w-[130px]" />
      <KpiBox label="Not Shipped On Time" value={lateCount} valueClassName={`text-xl ${lateCount > 0 ? 'text-fail' : 'text-[#403833]'}`} tint={lateCount > 0 ? 'fail' : 'neutral'} sub={<span className="text-[10px] text-[#9c9794]">{pctOf(lateCount, posInScope)}</span>} className="w-[130px]" />
      <KpiBox label="OTIF" value={otifOnCount} valueClassName="text-xl text-pass" sub={<span className="text-[10px] text-[#9c9794]">{pctOf(otifOnCount, posInScope)}</span>} className="w-[110px]" />
      <KpiBox label="Not OTIF" value={otifOffCount} valueClassName={`text-xl ${otifOffCount > 0 ? 'text-fail' : 'text-[#403833]'}`} tint={otifOffCount > 0 ? 'fail' : 'neutral'} sub={<span className="text-[10px] text-[#9c9794]">{pctOf(otifOffCount, posInScope)}</span>} className="w-[110px]" />
    </div>
  );
}
