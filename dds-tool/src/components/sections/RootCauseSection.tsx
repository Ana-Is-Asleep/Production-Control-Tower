'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SlideOver } from '../shared/SlideOver';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { REASON_CATEGORIES, type ReasonCategory } from '../../lib/reasonClassification';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import { COLOR } from '../../lib/statusColors';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface RootCauseSectionProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
}

const CATEGORY_PALETTE: Record<ReasonCategory, string> = {
  supplier_capacity: '#FF8900',
  material_shortage: '#6469aa',
  quality_issue: '#dc2626',
  documentation_delay: '#F59E0B',
  transit_delay: '#34A853',
  booking_not_made: '#8A8A8A',
  carrier_issue: '#0891b2',
  customs_delay: '#a855f7',
  other: '#9c9794',
};

interface WeekCategoryDetail {
  count: number;
  suppliers: Map<string, number>;
  raw: { reason: string; supplier: string; po: string }[];
}

function emptyDetail(): WeekCategoryDetail {
  return { count: 0, suppliers: new Map(), raw: [] };
}

export function RootCauseSection({ lines, weeksInRange }: RootCauseSectionProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ week: string; category: ReasonCategory } | null>(null);

  const linesWithReasons = useMemo(() => lines.filter((l) => l.lossReasonCode.trim()), [lines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));

  const { chartData, detailByWeekCategory, categoryOrder, categoryTotals, totalFlagged } = useMemo(() => {
    const detail = new Map<string, WeekCategoryDetail>();
    const categoryTotals: Record<string, number> = {};

    for (const week of weeksInRange) {
      for (const cat of REASON_CATEGORIES) {
        detail.set(`${week.label}__${cat}`, emptyDetail());
      }
    }

    let totalFlagged = 0;
    for (const line of linesWithReasons) {
      if (!line.pgrd) continue;
      const week = weeksInRange.find((w) => w.week === getISOWeek(line.pgrd!) && w.year === getISOWeekYear(line.pgrd!));
      if (!week) continue;
      const reason = line.lossReasonCode.trim();
      const category = classifications[reason]?.category ?? 'other';
      const key = `${week.label}__${category}`;
      const d = detail.get(key) ?? emptyDetail();
      d.count += 1;
      d.suppliers.set(line.supplier, (d.suppliers.get(line.supplier) ?? 0) + 1);
      d.raw.push({ reason, supplier: line.supplier, po: line.po });
      detail.set(key, d);
      categoryTotals[category] = (categoryTotals[category] ?? 0) + 1;
      totalFlagged += 1;
    }

    const categoryOrder = [...REASON_CATEGORIES].sort((a, b) => (categoryTotals[b] ?? 0) - (categoryTotals[a] ?? 0));

    const chartData = weeksInRange.map((week) => {
      const row: Record<string, number | string> = { weekLabel: week.label };
      categoryOrder.forEach((cat) => { row[cat] = detail.get(`${week.label}__${cat}`)?.count ?? 0; });
      return row;
    });

    return { chartData, detailByWeekCategory: detail, categoryOrder, categoryTotals, totalFlagged };
  }, [linesWithReasons, weeksInRange, classifications]);

  const topCategory = categoryOrder.find((c) => (categoryTotals[c] ?? 0) > 0);
  const selectedDetail = selected ? detailByWeekCategory.get(`${selected.week}__${selected.category}`) : null;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col justify-between h-full"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between">
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Root Cause</p>
          <p className="text-[10px] text-brand font-semibold">Drill down →</p>
        </div>
        {totalFlagged === 0 ? (
          <p className="text-xs text-[#b5aaa5] mt-2">No flagged loss reasons in range</p>
        ) : (
          <div className="mt-1">
            <p className="kpi-number font-extrabold text-3xl leading-none text-[#403833]">{totalFlagged}</p>
            <p className="text-[10px] text-[#9c9794] mt-1">POs with a loss reason this range</p>
            {topCategory && (
              <p className="text-xs mt-2">
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: CATEGORY_PALETTE[topCategory] }} />
                <span className="font-semibold text-[#403833]">{topCategory.replace(/_/g, ' ')}</span>
                <span className="text-[#9c9794]"> — top cause ({categoryTotals[topCategory]})</span>
              </p>
            )}
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
                <Tooltip
                  contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '8px 10px', maxWidth: 260 }}
                  labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
                  itemStyle={{ color: '#f9f7f6' }}
                  formatter={(value, name) => {
                    const cat = String(name) as ReasonCategory;
                    return [`${value} POs`, cat.replace(/_/g, ' ')];
                  }}
                />
                <Legend
                  verticalAlign="top" align="right" iconSize={8}
                  formatter={(v) => <span style={{ color: COLOR.muted, fontSize: 11 }}>{String(v).replace(/_/g, ' ')}</span>}
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
                {selected!.category.replace(/_/g, ' ')} — {selected!.week}
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
