'use client';

import { useMemo } from 'react';
import { aggregateSOTRate, aggregateOTIFRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { sotTierColor, computeTrend, rollupByPO, type Trend } from '../../lib/poAggregation';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { REASON_CATEGORY_LABELS, type ReasonCategory } from '../../lib/reasonClassification';
import type { PORootCauseRow } from '../../lib/rootCauseAggregation';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface ScorecardMatrixProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
  selectedWeek: WeekInRange | null;
  onSupplierClick: (supplier: string) => void;
  showAll: boolean;
  // PO-level root-cause classifications for the full range in view — joined against each
  // supplier's own (week-scoped) late POs by PO number, so a PO's classification never has to be
  // recomputed per supplier.
  rootCauseRows: PORootCauseRow[];
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

// Only ever built from POs that missed SOT — a PO with no substantive loss-reason text yet (still
// "Pending" in the Root Cause dashboard's own terms) simply isn't counted in `causes` at all,
// which is what lets "Not provided" mean something distinct from "no causes exist".
function RootCauseCell({ lateCount, causes }: { lateCount: number; causes: { category: ReasonCategory; count: number }[] }) {
  if (lateCount === 0) return <span className="text-[#c8c0bb]">—</span>;
  if (causes.length === 0) return <span className="text-[10px] italic text-[#b5aaa5] whitespace-nowrap">Not provided</span>;

  const shown = causes.slice(0, 2);
  const rest = causes.slice(2);
  return (
    <div className="flex flex-col items-start gap-1">
      {shown.map((c) => (
        <span key={c.category} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f5f2ee] text-[#58524e] whitespace-nowrap">
          {REASON_CATEGORY_LABELS[c.category]}
        </span>
      ))}
      {rest.length > 0 && (
        <span
          className="text-[10px] font-semibold text-[#9c9794] cursor-default"
          title={rest.map((c) => REASON_CATEGORY_LABELS[c.category]).join(', ')}
        >
          +{rest.length} more
        </span>
      )}
    </div>
  );
}

// Mode A, Section 1 — the strategic scorecard: every supplier's SOT%/OTIF%/trend at a glance,
// ranked by PO volume (top 10, expandable) rather than by SOT rate, so the suppliers actually
// worth a conversation aren't buried behind low-volume outliers. Narrows to a single week's
// SOT%/OTIF% (no trend, since there's only one data point) when a week is selected above.
export function ScorecardMatrix({ lines, weeksInRange, isChinaSupplier, today, selectedWeek, onSupplierClick, showAll, rootCauseRows }: ScorecardMatrixProps) {
  const suppliers = useMemo(() => [...new Set(lines.map((l) => l.supplier))].filter(Boolean), [lines]);

  const categoryByPO = useMemo(() => {
    const m = new Map<string, ReasonCategory>();
    rootCauseRows.forEach((r) => { if (r.finalCategory) m.set(r.po, r.finalCategory); });
    return m;
  }, [rootCauseRows]);

  const rows = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierLines = lines.filter((l) => l.supplier === supplier);
      const summaryScope = selectedWeek ? linesForWeek(supplierLines, selectedWeek) : supplierLines;
      const overallSOT = aggregateSOTRate(summaryScope, isChinaSupplier, today);
      const overallOTIF = aggregateOTIFRate(summaryScope, isChinaSupplier);
      const trend = computeTrend(weeksInRange, supplierLines, isChinaSupplier, today, getWeek);
      const posInScope = new Set(summaryScope.map((l) => l.po)).size;

      // Root cause: only POs that missed SOT (majority-vote per PO, same rollup the PO table
      // and Backlog/Actions use) count toward "causes" — never the whole supplier's PO list.
      const lateRollups = rollupByPO(summaryScope, isChinaSupplier, today).filter((r) => r.sot === false);
      const causeCounts = new Map<ReasonCategory, number>();
      lateRollups.forEach((r) => {
        const category = categoryByPO.get(r.po);
        if (category) causeCounts.set(category, (causeCounts.get(category) ?? 0) + 1);
      });
      const causes = [...causeCounts.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      return { supplier, overallSOT, overallOTIF, trend, posInScope, lateCount: lateRollups.length, causes };
    }).sort((a, b) => b.posInScope - a.posInScope);
  }, [suppliers, lines, selectedWeek, weeksInRange, isChinaSupplier, today, categoryByPO]);

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
              <th
                className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                title="Most frequent causes among this supplier's POs that missed SOT. Only POs with a submitted, classified loss reason count."
              >
                Main Root Cause(s) ⓘ
              </th>
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
                <td className="px-2 py-2 text-left"><RootCauseCell lateCount={r.lateCount} causes={r.causes} /></td>
                {!selectedWeek && <td className="px-2 py-2 text-center"><TrendArrow trend={r.trend} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
