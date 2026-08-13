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

// Panel B — Concentration. "Late" = SOT No (shipped after PGRD or not shipped at all), same
// definition rollupByPO already produces. Top 5 suppliers by late-PO count, each bar's width is
// that supplier's share of ALL late POs (not just share among the top 5), so the proportions read
// correctly against the callout stat above them.
export function ConcentrationAnalysis({ lines, isChinaSupplier, today }: ConcentrationAnalysisProps) {
  const { top5, totalLate, topSupplier, topSupplierPct } = useMemo(() => {
    const rollups = rollupByPO(lines, isChinaSupplier, today);
    const lateRollups = rollups.filter((r) => r.sot === false);
    const totalLate = lateRollups.length;

    const bySupplier = new Map<string, number>();
    for (const r of lateRollups) {
      bySupplier.set(r.supplier, (bySupplier.get(r.supplier) ?? 0) + 1);
    }
    const sorted = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5).map(([supplier, count]) => ({
      supplier,
      count,
      pct: totalLate > 0 ? Math.round((count / totalLate) * 100) : 0,
    }));

    return {
      top5,
      totalLate,
      topSupplier: top5[0]?.supplier ?? null,
      topSupplierPct: top5[0]?.pct ?? 0,
    };
  }, [lines, isChinaSupplier, today]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full overflow-hidden flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">Concentration</p>
      <p className="text-[10px] text-[#b5aaa5] mb-3">Share of all late POs by supplier.</p>
      {totalLate === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No late POs in scope</p>
      ) : (
        <>
          <p className="text-sm text-[#403833] mb-4">
            <span className="font-extrabold text-brand text-3xl align-middle mr-1.5">{topSupplierPct}%</span>
            of all late POs come from <span className="font-semibold">{topSupplier}</span>
          </p>
          <div className="flex-1 min-h-0 flex flex-col justify-center gap-3">
            {top5.map((s, i) => (
              <div key={s.supplier} className="flex items-center gap-2">
                <span className="text-xs text-[#403833] w-32 shrink-0 truncate" title={s.supplier}>{s.supplier}</span>
                <div className="flex-1 h-5 bg-[#f5f2ee] rounded-r-md overflow-hidden relative min-w-0">
                  <div
                    className="h-full rounded-r-md"
                    style={{
                      width: `${Math.max(s.pct, 3)}%`,
                      background: i === 0 ? '#FF8900' : 'rgba(255,137,0,0.45)',
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-[#58524e] w-24 shrink-0 text-right whitespace-nowrap">
                  {s.count} POs · {s.pct}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
