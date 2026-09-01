'use client';

import { useMemo, useState } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { aggregateSOTRate, aggregateOTIFRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { sotTier, sotTierColor, computeTrend, type Trend } from '../../lib/poAggregation';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface ScorecardMatrixProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
  selectedWeek: WeekInRange | null;
  onSupplierClick: (supplier: string) => void;
}

const TOP_N = 10;

function getWeek(l: PurchaseLine) {
  return l.pgrd ? { week: getISOWeek(l.pgrd), year: getISOWeekYear(l.pgrd) } : null;
}

function linesForWeek(lines: PurchaseLine[], week: WeekInRange) {
  return lines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === week.week && getISOWeekYear(l.pgrd) === week.year);
}

function TrendArrow({ trend }: { trend: Trend }) {
  if (trend === 'up') return <span className="text-pass">↑</span>;
  if (trend === 'down') return <span className="text-fail">↓</span>;
  return <span className="text-[#9c9794]">→</span>;
}

function VsTargetIcon({ pct }: { pct: number | null }) {
  const tier = sotTier(pct);
  if (tier === 'good') return <Check size={14} className="text-pass inline" />;
  if (tier === 'warn') return <Minus size={14} className="text-warn inline" />;
  if (tier === 'bad') return <X size={14} className="text-fail inline" />;
  return <span className="text-[#c8c0bb]">—</span>;
}

// Mode A, Section 1 — the strategic scorecard: every supplier's SOT%/OTIF%/trend at a glance,
// ranked by PO volume (top 10, expandable) rather than by SOT rate, so the suppliers actually
// worth a conversation aren't buried behind low-volume outliers. Narrows to a single week's
// SOT%/OTIF% (no trend, since there's only one data point) when a week is selected above.
export function ScorecardMatrix({ lines, weeksInRange, isChinaSupplier, today, selectedWeek, onSupplierClick }: ScorecardMatrixProps) {
  const [showAll, setShowAll] = useState(false);
  const suppliers = useMemo(() => [...new Set(lines.map((l) => l.supplier))].filter(Boolean), [lines]);

  const rows = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierLines = lines.filter((l) => l.supplier === supplier);
      const summaryScope = selectedWeek ? linesForWeek(supplierLines, selectedWeek) : supplierLines;
      const overallSOT = aggregateSOTRate(summaryScope, isChinaSupplier, today);
      const overallOTIF = aggregateOTIFRate(summaryScope, isChinaSupplier);
      const trend = computeTrend(weeksInRange, supplierLines, isChinaSupplier, today, getWeek);
      const posInScope = new Set(summaryScope.map((l) => l.po)).size;
      return { supplier, overallSOT, overallOTIF, trend, posInScope };
    }).sort((a, b) => b.posInScope - a.posInScope);
  }, [suppliers, lines, selectedWeek, weeksInRange, isChinaSupplier, today]);

  const visibleRows = showAll ? rows : rows.slice(0, TOP_N);

  if (suppliers.length === 0) {
    return <p className="text-xs text-[#9c9794] py-6 text-center">No suppliers in scope</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#403833] text-white">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Supplier</th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">POs in Scope</th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
                {selectedWeek ? 'SOT %' : 'Overall SOT'}
              </th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
                {selectedWeek ? 'OTIF %' : 'Overall OTIF'}
              </th>
              <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">vs Target (OTIF)</th>
              {!selectedWeek && <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Trend</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr
                key={r.supplier}
                onClick={() => onSupplierClick(r.supplier)}
                className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{r.supplier}</td>
                <td className="px-2 py-2 text-center text-[#58524e]">{r.posInScope}</td>
                <td className="px-2 py-2 text-center font-semibold" style={{ color: sotTierColor(r.overallSOT).text }}>
                  {r.overallSOT === null ? '—' : `${r.overallSOT}%`}
                </td>
                <td className="px-2 py-2 text-center font-semibold" style={{ color: sotTierColor(r.overallOTIF).text }}>
                  {r.overallOTIF === null ? '—' : `${r.overallOTIF}%`}
                </td>
                <td className="px-2 py-2 text-center"><VsTargetIcon pct={r.overallOTIF} /></td>
                {!selectedWeek && <td className="px-2 py-2 text-center"><TrendArrow trend={r.trend} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > TOP_N && (
        <button onClick={() => setShowAll((v) => !v)} className="text-xs text-brand font-semibold hover:underline mt-2">
          {showAll ? 'Show top 10 only' : `View all (${rows.length})`}
        </button>
      )}
    </div>
  );
}
