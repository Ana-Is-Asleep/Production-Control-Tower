'use client';

import { useMemo } from 'react';
import { rollupByPO } from '../../lib/poAggregation';
import type { IsChinaSupplier } from '../../lib/kpiFormulas';
import type { PurchaseLine } from '../../types';

interface ConcentrationAnalysisProps {
  lines: PurchaseLine[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
}

// Mode A, Section 3 — an executive summary, not a table: where is the late-shipment problem
// actually concentrated? Answers that in one glance so the conversation has a clear starting point.
export function ConcentrationAnalysis({ lines, isChinaSupplier, today }: ConcentrationAnalysisProps) {
  const { top3, totalLate, topSupplier, topSupplierPct } = useMemo(() => {
    const rollups = rollupByPO(lines, isChinaSupplier, today);
    const lateRollups = rollups.filter((r) => r.sot === false);
    const totalLate = lateRollups.length;

    const bySupplier = new Map<string, number>();
    for (const r of lateRollups) {
      bySupplier.set(r.supplier, (bySupplier.get(r.supplier) ?? 0) + 1);
    }
    const sorted = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3).map(([supplier, count]) => ({
      supplier,
      count,
      pct: totalLate > 0 ? Math.round((count / totalLate) * 100) : 0,
    }));

    return {
      top3,
      totalLate,
      topSupplier: top3[0]?.supplier ?? null,
      topSupplierPct: top3[0]?.pct ?? 0,
    };
  }, [lines, isChinaSupplier, today]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Concentration</p>
      {totalLate === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No late POs in scope</p>
      ) : (
        <>
          <div className="bg-[#fff7ed] border border-brand rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-[#403833]">
              <span className="font-extrabold text-brand text-base">{topSupplierPct}%</span> of all late POs come from{' '}
              <span className="font-semibold">{topSupplier}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            {top3.map((s) => (
              <div key={s.supplier} className="flex items-center justify-between text-xs">
                <span className="text-[#403833] truncate mr-2">{s.supplier}</span>
                <span className="text-[#7b7571] shrink-0">{s.count} POs ({s.pct}%)</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
