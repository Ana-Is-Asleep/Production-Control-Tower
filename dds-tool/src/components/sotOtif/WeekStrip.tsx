'use client';

import { aggregateSOTRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { sotTierColor } from '../../lib/poAggregation';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface WeekStripProps {
  lines: PurchaseLine[]; // single-supplier lines across the full week range
  weeksInRange: WeekInRange[];
  isChinaSupplier: IsChinaSupplier;
  today: Date;
  selectedWeek: WeekInRange | null;
  onSelectWeek: (week: WeekInRange) => void;
}

// Mode B — one tile per week for the selected supplier. Clicking a tile drives the PO list below.
export function WeekStrip({ lines, weeksInRange, isChinaSupplier, today, selectedWeek, onSelectWeek }: WeekStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 shrink-0">
      {weeksInRange.map((w) => {
        const weekLines = lines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === w.week && getISOWeekYear(l.pgrd) === w.year);
        const poCount = new Set(weekLines.map((l) => l.po)).size;
        const sotPct = poCount > 0 ? aggregateSOTRate(weekLines, isChinaSupplier, today) : null;
        const { bg, text } = sotTierColor(sotPct);
        const isSelected = selectedWeek?.label === w.label && selectedWeek?.year === w.year;

        return (
          <button
            key={`${w.year}-${w.week}`}
            onClick={() => onSelectWeek(w)}
            className={`shrink-0 w-20 rounded-lg border px-2 py-2 text-center transition-all ${isSelected ? 'border-brand ring-2 ring-brand/30' : 'border-[#e9e3df] hover:border-brand'}`}
            style={{ background: poCount > 0 ? bg : '#fff' }}
          >
            <p className="text-[10px] font-semibold text-[#403833]">{w.label}</p>
            <p className="text-sm font-extrabold" style={{ color: poCount > 0 ? text : '#c8c0bb' }}>
              {sotPct === null ? '—' : `${sotPct}%`}
            </p>
            <p className="text-[9px] text-[#9c9794] mt-0.5">{poCount} PO{poCount === 1 ? '' : 's'}</p>
          </button>
        );
      })}
    </div>
  );
}
