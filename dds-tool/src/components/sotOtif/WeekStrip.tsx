'use client';

import { aggregateSOTRate, type IsChinaSupplier } from '../../lib/kpiFormulas';
import { sotTierPalette } from '../../lib/poAggregation';
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
// Tile background always reflects that week's own SOT% tier (performance status); selection is a
// separate, fixed-color signal (brand-orange border + top indicator + shadow) so the two states
// never get confused with each other. A week with no POs gets a neutral grey tile with no
// percentage shown at all, since there's nothing to report.
export function WeekStrip({ lines, weeksInRange, isChinaSupplier, today, selectedWeek, onSelectWeek }: WeekStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 shrink-0">
      {weeksInRange.map((w) => {
        const weekLines = lines.filter((l) => l.pgrd && getISOWeek(l.pgrd) === w.week && getISOWeekYear(l.pgrd) === w.year);
        const poCount = new Set(weekLines.map((l) => l.po)).size;
        const sotPct = poCount > 0 ? aggregateSOTRate(weekLines, isChinaSupplier, today) : null;
        const palette = sotTierPalette(sotPct);
        const isSelected = selectedWeek?.label === w.label && selectedWeek?.year === w.year;

        return (
          <button
            key={`${w.year}-${w.week}`}
            onClick={() => onSelectWeek(w)}
            className="relative shrink-0 w-20 rounded-lg text-center transition-all"
            style={{
              background: palette.lightBg,
              border: isSelected ? '2px solid #ff7700' : '2px solid transparent',
              boxShadow: isSelected ? '0 3px 8px rgba(255,119,0,0.25)' : 'none',
            }}
          >
            {isSelected && <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand" />}
            <p className="text-[10px] font-semibold pt-2 text-[#9c9794]">{w.label}</p>
            {poCount > 0 && (
              <p className="text-base font-extrabold" style={{ color: palette.lightText }}>
                {sotPct}%
              </p>
            )}
            <p className={`text-[9px] pb-2 text-[#9c9794] ${poCount > 0 ? '' : 'pt-1.5'}`}>
              {poCount > 0 ? `${poCount} PO${poCount === 1 ? '' : 's'}` : 'No POs'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
