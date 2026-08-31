'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MiniLegend } from '../shared/MiniLegend';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { REASON_CATEGORIES, REASON_CATEGORY_LABELS, isSubstantiveReason, type ReasonCategory } from '../../lib/reasonClassification';
import { aggregatePOReasons, type LineForAggregation } from '../../lib/poReasonAggregation';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { CATEGORY_PALETTE } from '../rootCause/categoryPalette';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface RootCauseSectionProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  drillDownHref: string;
}

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
  color?: string;
}

// Only lists categories that actually have a count for this week — with 9 possible categories,
// showing every zero entry made the tooltip tall/wide enough to spill past the compact card.
function NonZeroTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const present = payload.filter((p) => (p.value ?? 0) > 0);
  if (present.length === 0) return null;

  return (
    <div style={{ background: COLOR.navy, borderRadius: 8, fontSize: 11, padding: '8px 10px', maxWidth: 220 }}>
      <p style={{ color: COLOR.brandSoft, fontWeight: 700, margin: 0, marginBottom: 4 }}>{label}</p>
      {present.map((p) => (
        <p key={p.dataKey} style={{ color: '#f9f7f6', margin: 0 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: p.color, marginRight: 6 }} />
          {p.dataKey === 'other' ? 'Other' : REASON_CATEGORY_LABELS[p.dataKey as ReasonCategory] ?? String(p.dataKey)}: {p.value} POs
        </p>
      ))}
    </div>
  );
}

export function RootCauseSection({ lines, weeksInRange, drillDownHref }: RootCauseSectionProps) {
  const linesWithReasons = useMemo(() => lines.filter((l) => isSubstantiveReason(l.lossReasonCode)), [lines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));

  const { chartData, topCategories, hasOther, totalFlagged } = useMemo(() => {
    const poCounts = new Map<string, number>();
    for (const week of weeksInRange) {
      for (const cat of REASON_CATEGORIES) poCounts.set(`${week.label}__${cat}`, 0);
    }

    // line-level classification (or null for blank/non-substantive lines, which the PO-level
    // aggregation fills in from a sibling line in the same PO) feeds the PO-level aggregation —
    // the PO-level result, not the individual line's own reason, is what actually gets charted
    const linesForAgg: LineForAggregation[] = lines.map((l) => {
      const reason = l.lossReasonCode.trim();
      const category = isSubstantiveReason(reason) ? (classifications[reason]?.category ?? null) : null;
      return { po: l.po, line: l.line, qty: l.qty, rawReason: reason, category };
    });
    const poResults = aggregatePOReasons(linesForAgg);

    // representative week per PO (first line encountered)
    const poWeek = new Map<string, WeekInRange | undefined>();
    for (const line of lines) {
      if (poWeek.has(line.po)) continue;
      const week = line.pgrd
        ? weeksInRange.find((w) => w.week === getISOWeek(line.pgrd!) && w.year === getISOWeekYear(line.pgrd!))
        : undefined;
      poWeek.set(line.po, week);
    }

    let totalFlagged = 0;
    const categoryTotals: Record<string, number> = {};
    for (const [po, result] of poResults) {
      if (!result.finalCategory) continue;
      const week = poWeek.get(po);
      if (!week) continue;
      const key = `${week.label}__${result.finalCategory}`;
      poCounts.set(key, (poCounts.get(key) ?? 0) + 1);
      categoryTotals[result.finalCategory] = (categoryTotals[result.finalCategory] ?? 0) + 1;
      totalFlagged += 1;
    }

    const categoryOrder = [...REASON_CATEGORIES].sort((a, b) => (categoryTotals[b] ?? 0) - (categoryTotals[a] ?? 0));
    // Cap the compact card at the top 4 categories by volume, with everything else folded into a
    // single neutral "Other" segment — with up to 14 possible categories, showing them all (or even
    // 5) produces several similarly-toned warm colors that are hard to tell apart at this size.
    const topCategories = categoryOrder.filter((cat) => (categoryTotals[cat] ?? 0) > 0).slice(0, 4);
    const otherCategories = categoryOrder.filter((cat) => !topCategories.includes(cat) && (categoryTotals[cat] ?? 0) > 0);
    const hasOther = otherCategories.length > 0;

    const chartData = weeksInRange.map((week) => {
      const row: Record<string, number | string> = { weekLabel: week.label };
      topCategories.forEach((cat) => { row[cat] = poCounts.get(`${week.label}__${cat}`) ?? 0; });
      if (hasOther) {
        row.other = otherCategories.reduce((sum, cat) => sum + (poCounts.get(`${week.label}__${cat}`) ?? 0), 0);
      }
      return row;
    });

    return { chartData, topCategories, hasOther, totalFlagged };
  }, [lines, weeksInRange, classifications]);

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#403833]">Root Cause</p>
          {totalFlagged > 0 && <span className="text-xs font-semibold text-[#7b7571]">{totalFlagged}</span>}
        </div>
        <p className="text-[10px] text-brand font-semibold">Drill down →</p>
      </div>
      {totalFlagged === 0 ? (
        <div className="flex-1 flex items-center">
          <p className="text-xs text-[#b5aaa5]">No flagged loss reasons in range</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 mt-3 flex flex-col">
          <MiniLegend
            className="mb-1 shrink-0"
            items={[
              ...topCategories.map((cat) => ({ label: REASON_CATEGORY_LABELS[cat], color: CATEGORY_PALETTE[cat], type: 'bar' as const })),
              ...(hasOther ? [{ label: 'Other', color: COLOR.muted, type: 'bar' as const }] : []),
            ]}
          />
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
                <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                <Tooltip content={<NonZeroTooltip />} allowEscapeViewBox={{ x: false, y: false }} wrapperStyle={{ zIndex: 60 }} />
                {topCategories.map((cat, i) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="reasons"
                    fill={CATEGORY_PALETTE[cat]}
                    fillOpacity={0.85}
                    radius={!hasOther && i === topCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
                {hasOther && <Bar dataKey="other" stackId="reasons" fill={COLOR.muted} fillOpacity={0.85} radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Link>
  );
}
