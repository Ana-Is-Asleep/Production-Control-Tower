'use client';

import { KpiBox } from '../shared/KpiBox';
import type { QtyRateResult } from '../../lib/kpiFormulas';

interface SupplierKpiStripProps {
  weekLabel: string | null;
  sotTarget: number;
  otifTarget: number;
  onTimeCount: number;
  lateCount: number;
  otifOnCount: number;
  otifOffCount: number;
  sotQty: QtyRateResult;
  otifQty: QtyRateResult;
}

function pctLabel(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

function ratePct(on: number, total: number): number | null {
  return total > 0 ? Math.round((on / total) * 100) : null;
}

function shareLabel(count: number, total: number, unit: string): string {
  return total > 0 ? `${Math.round((count / total) * 100)}% of ${unit}` : '—';
}

// Selected-week KPI deep dive (Mode B) — every metric shown both by PO count and by requested
// quantity, since a handful of large POs slipping can read very differently from "POs" alone. The
// four cards' order/labels match the SOT/OTIF Detail mockup (Ana, Sep 2026 feedback batch).
export function SupplierKpiStrip({
  weekLabel, sotTarget, otifTarget, onTimeCount, lateCount, otifOnCount, otifOffCount, sotQty, otifQty,
}: SupplierKpiStripProps) {
  const titleSuffix = weekLabel ? ` – ${weekLabel}` : '';
  const totalSotPOs = onTimeCount + lateCount;
  const totalOtifPOs = otifOnCount + otifOffCount;
  const sotPOsPct = ratePct(onTimeCount, totalSotPOs);
  const otifPOsPct = ratePct(otifOnCount, totalOtifPOs);
  const lateQty = sotQty.totalQty - sotQty.onQty;
  const notOtifQty = otifQty.totalQty - otifQty.onQty;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr] gap-3 shrink-0">
      <div className="bg-white rounded-lg border border-[#e9e3df] p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-bold text-[#403833] mb-2">SOT{titleSuffix}</p>
        <div className="grid grid-cols-2 gap-2">
          <KpiBox
            label="Shipped on time (POs)"
            value={pctLabel(sotPOsPct)}
            valueClassName={`text-xl ${sotPOsPct === null ? 'text-[#c8c0bb]' : sotPOsPct >= sotTarget ? 'text-pass' : 'text-fail'}`}
            tint={sotPOsPct === null ? 'neutral' : sotPOsPct >= sotTarget ? 'pass' : 'fail'}
            sub={<span className="text-[10px] text-[#9c9794]">{onTimeCount} / {totalSotPOs} POs</span>}
          />
          <KpiBox
            label="Shipped on time (Qty)"
            value={pctLabel(sotQty.pct)}
            valueClassName={`text-xl ${sotQty.pct === null ? 'text-[#c8c0bb]' : sotQty.pct >= sotTarget ? 'text-pass' : 'text-fail'}`}
            tint={sotQty.pct === null ? 'neutral' : sotQty.pct >= sotTarget ? 'pass' : 'fail'}
            sub={<span className="text-[10px] text-[#9c9794]">{sotQty.onQty.toLocaleString()} / {sotQty.totalQty.toLocaleString()}</span>}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-bold text-[#403833] mb-2">OTIF{titleSuffix}</p>
        <div className="grid grid-cols-2 gap-2">
          <KpiBox
            label="In scope on time (POs)"
            value={pctLabel(otifPOsPct)}
            valueClassName={`text-xl ${otifPOsPct === null ? 'text-[#c8c0bb]' : otifPOsPct >= otifTarget ? 'text-pass' : 'text-fail'}`}
            tint={otifPOsPct === null ? 'neutral' : otifPOsPct >= otifTarget ? 'pass' : 'fail'}
            sub={<span className="text-[10px] text-[#9c9794]">{otifOnCount} / {totalOtifPOs} POs</span>}
          />
          <KpiBox
            label="In scope on time (Qty)"
            value={pctLabel(otifQty.pct)}
            valueClassName={`text-xl ${otifQty.pct === null ? 'text-[#c8c0bb]' : otifQty.pct >= otifTarget ? 'text-pass' : 'text-fail'}`}
            tint={otifQty.pct === null ? 'neutral' : otifQty.pct >= otifTarget ? 'pass' : 'fail'}
            sub={<span className="text-[10px] text-[#9c9794]">{otifQty.onQty.toLocaleString()} / {otifQty.totalQty.toLocaleString()}</span>}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-bold text-[#403833] mb-2">Not shipped on time{titleSuffix}</p>
        <div className="grid grid-cols-2 gap-2">
          <KpiBox
            label="POs"
            value={lateCount}
            valueClassName={`text-xl ${lateCount > 0 ? 'text-fail' : 'text-[#403833]'}`}
            tint={lateCount > 0 ? 'fail' : 'neutral'}
            sub={<span className="text-[10px] text-[#9c9794]">{shareLabel(lateCount, totalSotPOs, 'POs')}</span>}
          />
          <KpiBox
            label="Qty"
            value={lateQty.toLocaleString()}
            valueClassName={`text-xl ${lateQty > 0 ? 'text-fail' : 'text-[#403833]'}`}
            tint={lateQty > 0 ? 'fail' : 'neutral'}
            sub={<span className="text-[10px] text-[#9c9794]">{shareLabel(lateQty, sotQty.totalQty, 'qty')}</span>}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-bold text-[#403833] mb-2">Not OTIF{titleSuffix}</p>
        <div className="grid grid-cols-2 gap-2">
          <KpiBox
            label="POs"
            value={otifOffCount}
            valueClassName={`text-xl ${otifOffCount > 0 ? 'text-fail' : 'text-[#403833]'}`}
            tint={otifOffCount > 0 ? 'fail' : 'neutral'}
            sub={<span className="text-[10px] text-[#9c9794]">{shareLabel(otifOffCount, totalOtifPOs, 'POs')}</span>}
          />
          <KpiBox
            label="Qty"
            value={notOtifQty.toLocaleString()}
            valueClassName={`text-xl ${notOtifQty > 0 ? 'text-fail' : 'text-[#403833]'}`}
            tint={notOtifQty > 0 ? 'fail' : 'neutral'}
            sub={<span className="text-[10px] text-[#9c9794]">{shareLabel(notOtifQty, otifQty.totalQty, 'qty')}</span>}
          />
        </div>
      </div>
    </div>
  );
}
