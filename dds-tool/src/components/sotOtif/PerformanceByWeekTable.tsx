'use client';

import { useMemo } from 'react';
import { rollupByPO } from '../../lib/poAggregation';
import { aggregateSOTRate, aggregateOTIFRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface PerformanceByWeekTableProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
}

function cellTint(pct: number | null): string {
  if (pct === null) return 'text-[#c8c0bb]';
  if (pct >= 80) return 'text-pass bg-pass-bg';
  if (pct >= 60) return 'text-warn bg-warn-bg';
  return 'text-fail bg-fail-bg';
}

// Same weeks shown on the chart above, collapsed into a compact SOT%/OTIF%/volume grid — lets you
// scan every week's numbers at once rather than reading them off the chart one point at a time.
export function PerformanceByWeekTable({ lines, weeksInRange, isChinaSupplier, today }: PerformanceByWeekTableProps) {
  const columns = useMemo(() => {
    return weeksInRange.map((week) => {
      const weekLines = lines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === week.week && getISOWeekYear(l.pgrd) === week.year);
      const sot = aggregateSOTRate(weekLines, isChinaSupplier, today);
      const otif = aggregateOTIFRate(weekLines, isChinaSupplier);
      const posInScope = rollupByPO(weekLines, isChinaSupplier, today).length;
      return { label: week.label, isLatest: week.isCurrent, sot, otif, posInScope };
    });
  }, [lines, weeksInRange, isChinaSupplier, today]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] whitespace-nowrap sticky left-0 bg-white">Metric</th>
              {columns.map((c) => (
                <th key={c.label} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] whitespace-nowrap text-center">
                  {c.label}{c.isLatest ? ' (Latest)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#f4f1ef]">
              <td className="px-2 py-1.5 font-semibold text-[#403833] whitespace-nowrap sticky left-0 bg-white">SOT %</td>
              {columns.map((c) => (
                <td key={c.label} className="px-1 py-1">
                  <div className={`rounded px-2 py-1 text-center font-semibold ${cellTint(c.sot)}`}>{c.sot === null ? '—' : `${c.sot}%`}</div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-[#f4f1ef]">
              <td className="px-2 py-1.5 font-semibold text-[#403833] whitespace-nowrap sticky left-0 bg-white">OTIF %</td>
              {columns.map((c) => (
                <td key={c.label} className="px-1 py-1">
                  <div className={`rounded px-2 py-1 text-center font-semibold ${cellTint(c.otif)}`}>{c.otif === null ? '—' : `${c.otif}%`}</div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-[#f4f1ef]">
              <td className="px-2 py-1.5 font-semibold text-[#403833] whitespace-nowrap sticky left-0 bg-white">POs in Scope</td>
              {columns.map((c) => (
                <td key={c.label} className="px-1 py-1 text-center text-[#58524e]">{c.posInScope}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-[#7b7571]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-fail-bg" /> &lt; 60%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-warn-bg" /> 60% – 79%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-pass-bg" /> ≥ 80%</span>
      </div>
    </div>
  );
}
