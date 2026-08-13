'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SlideOver } from '../shared/SlideOver';
import { MiniLegend } from '../shared/MiniLegend';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { REASON_CATEGORIES, REASON_CATEGORY_LABELS, isSubstantiveReason, type ReasonCategory } from '../../lib/reasonClassification';
import { aggregatePOReasons, type LineForAggregation } from '../../lib/poReasonAggregation';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface RootCauseSectionProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
}

// Fixed hue assignment (never re-cycled/reordered) — the first 8 are a validated
// colorblind-safe categorical set (each hue chosen to stay distinguishable from its
// neighbors); the last 4 are additional, clearly distinct tones (dark navy, brown,
// slate, neutral gray) since 12 categories exceeds what a single validated set covers.
const CATEGORY_PALETTE: Record<ReasonCategory, string> = {
  production_capacity_constraint: '#2a78d6', // blue
  component_supply_delay: '#eb6834',         // orange
  holiday_plant_shutdown: '#1baf7a',         // aqua
  machine_production_issue: '#eda100',       // yellow
  truck_rounding_pallet_configuration_error: '#e87ba4', // magenta
  po_reshuffling_erp_issue: '#2f9e44',       // green
  transport_warehouse_slot_capacity: '#4a3aa7', // violet
  quality_issue: '#e34948',                  // red
  it_issue: '#0d366b',                       // dark navy
  forecast_order_quantity_mismatch: '#8a5a2b', // brown
  administrative_planning_error: '#64748b',  // slate
  other_unclear: '#9c9794',                  // neutral gray
};

interface WeekCategoryDetail {
  // count of distinct POs whose final (PO-level aggregated) root cause fell into this
  // week/category bucket — not a line count, since a PO can have multiple lines
  poCount: number;
  suppliers: Map<string, number>;
  raw: { reason: string; supplier: string; po: string }[];
}

function emptyDetail(): WeekCategoryDetail {
  return { poCount: 0, suppliers: new Map(), raw: [] };
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
          {REASON_CATEGORY_LABELS[p.dataKey as ReasonCategory] ?? String(p.dataKey)}: {p.value} POs
        </p>
      ))}
    </div>
  );
}

export function RootCauseSection({ lines, weeksInRange }: RootCauseSectionProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ week: string; category: ReasonCategory } | null>(null);

  const linesWithReasons = useMemo(() => lines.filter((l) => isSubstantiveReason(l.lossReasonCode)), [lines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));

  const { chartData, detailByWeekCategory, categoryOrder, totalFlagged } = useMemo(() => {
    const detail = new Map<string, WeekCategoryDetail>();
    const categoryTotals: Record<string, number> = {};

    for (const week of weeksInRange) {
      for (const cat of REASON_CATEGORIES) {
        detail.set(`${week.label}__${cat}`, emptyDetail());
      }
    }

    // line-level classification (or null for blank/non-substantive lines, which Step 2a will
    // fill in from a sibling line in the same PO) feeds the PO-level aggregation — the PO-level
    // result, not the individual line's own reason, is what actually gets counted/charted
    const linesForAgg: LineForAggregation[] = lines.map((l) => {
      const reason = l.lossReasonCode.trim();
      const category = isSubstantiveReason(reason) ? (classifications[reason]?.category ?? null) : null;
      return { po: l.po, line: l.line, qty: l.qty, rawReason: reason, category };
    });
    const poResults = aggregatePOReasons(linesForAgg);

    // representative week/supplier per PO (first line encountered) + the raw reason texts for
    // that PO, so the drill-down can still show real supplier text even though the chart itself
    // now counts POs, not lines
    const poMeta = new Map<string, { week: WeekInRange | undefined; supplier: string; rawReasons: string[] }>();
    for (const line of lines) {
      if (!poMeta.has(line.po)) {
        const week = line.pgrd
          ? weeksInRange.find((w) => w.week === getISOWeek(line.pgrd!) && w.year === getISOWeekYear(line.pgrd!))
          : undefined;
        poMeta.set(line.po, { week, supplier: line.supplier, rawReasons: [] });
      }
      const reason = line.lossReasonCode.trim();
      if (isSubstantiveReason(reason)) poMeta.get(line.po)!.rawReasons.push(reason);
    }

    let totalFlagged = 0;
    for (const [po, result] of poResults) {
      if (!result.finalCategory) continue;
      const meta = poMeta.get(po);
      if (!meta?.week) continue;
      const key = `${meta.week.label}__${result.finalCategory}`;
      const d = detail.get(key) ?? emptyDetail();
      d.poCount += 1;
      d.suppliers.set(meta.supplier, (d.suppliers.get(meta.supplier) ?? 0) + 1);
      meta.rawReasons.forEach((r) => d.raw.push({ reason: r, supplier: meta.supplier, po }));
      detail.set(key, d);
      categoryTotals[result.finalCategory] = (categoryTotals[result.finalCategory] ?? 0) + 1;
      totalFlagged += 1;
    }

    const categoryOrder = [...REASON_CATEGORIES].sort((a, b) => (categoryTotals[b] ?? 0) - (categoryTotals[a] ?? 0));

    const chartData = weeksInRange.map((week) => {
      const row: Record<string, number | string> = { weekLabel: week.label };
      categoryOrder.forEach((cat) => { row[cat] = detail.get(`${week.label}__${cat}`)?.poCount ?? 0; });
      return row;
    });

    return { chartData, detailByWeekCategory: detail, categoryOrder, totalFlagged };
  }, [lines, weeksInRange, classifications]);

  const selectedDetail = selected ? detailByWeekCategory.get(`${selected.week}__${selected.category}`) : null;

  // top 5 categories by count for the period — categoryOrder is already sorted descending by
  // total, and a full legend of all 10 possible categories would overflow the compact card
  const activeCategories = categoryOrder.filter((cat) => chartData.some((d) => (d[cat] as number) > 0)).slice(0, 5);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Root Cause</p>
            {totalFlagged > 0 && <span className="text-xs font-semibold text-[#403833]">{totalFlagged}</span>}
          </div>
          <p className="text-[10px] text-brand font-semibold">Drill down →</p>
        </div>
        {totalFlagged === 0 ? (
          <div className="flex-1 flex items-center">
            <p className="text-xs text-[#b5aaa5]">No flagged loss reasons in range</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 mt-1 flex flex-col">
            <MiniLegend
              className="mb-1 shrink-0"
              items={activeCategories.map((cat) => ({ label: REASON_CATEGORY_LABELS[cat], color: CATEGORY_PALETTE[cat], type: 'bar' as const }))}
            />
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: COLOR.muted, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                <Tooltip content={<NonZeroTooltip />} allowEscapeViewBox={{ x: false, y: false }} wrapperStyle={{ zIndex: 60 }} />
                {categoryOrder.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="reasons"
                    fill={CATEGORY_PALETTE[cat]}
                    fillOpacity={0.85}
                    onClick={(data: unknown) => {
                      const week = (data as { payload?: { weekLabel?: string } } | undefined)?.payload?.weekLabel;
                      if (week) { setSelected({ week, category: cat }); setOpen(true); }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <SlideOver open={open} onClose={() => { setOpen(false); setSelected(null); }} title="Root Cause — Loss Reasons by Week" width="w-[900px]">
        <div className="p-5 space-y-5">
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
                <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<NonZeroTooltip />} />
                <Legend
                  verticalAlign="top" align="right" iconSize={8}
                  formatter={(v) => <span style={{ color: COLOR.muted, fontSize: 11 }}>{REASON_CATEGORY_LABELS[v as ReasonCategory] ?? String(v)}</span>}
                />
                {categoryOrder.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="reasons"
                    fill={CATEGORY_PALETTE[cat]}
                    fillOpacity={0.85}
                    onClick={(data: unknown) => {
                      const week = (data as { payload?: { weekLabel?: string } } | undefined)?.payload?.weekLabel;
                      if (week) setSelected({ week, category: cat });
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {selectedDetail && (
            <div className="border-t border-[#f4f1ef] pt-4 space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">
                {REASON_CATEGORY_LABELS[selected!.category]} — {selected!.week}
              </p>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-2">Top suppliers citing this reason</p>
                <div className="space-y-1">
                  {[...selectedDetail.suppliers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([supplier, count]) => (
                    <div key={supplier} className="flex justify-between text-sm">
                      <span className="text-[#403833]">{supplier}</span>
                      <span className="font-semibold text-[#7b7571]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-2">Raw reasons ({selectedDetail.raw.length})</p>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                  {selectedDetail.raw.map((r, i) => (
                    <div key={i} className="border border-[#e9e3df] rounded-lg px-3 py-2 text-xs">
                      <p className="text-[#403833]">{r.reason}</p>
                      <p className="text-[#9c9794] mt-1">{r.po} · {r.supplier}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SlideOver>
    </>
  );
}
