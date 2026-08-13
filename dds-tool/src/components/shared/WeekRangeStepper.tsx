'use client';

import { shiftISOWeek } from '../../lib/dateUtils';
import { WEEK_RANGE_DEFAULT } from '../../hooks/useFilters';

interface WeekRangeStepperProps {
  min: number;
  max: number;
  value: { start: number; end: number };
  onChange: (value: { start: number; end: number }) => void;
  curWeek: number;
  curYear: number;
  className?: string;
}

function weekLabelFor(curWeek: number, curYear: number, offset: number): string {
  const { week } = shiftISOWeek(curWeek, curYear, offset);
  return `W${String(week).padStart(2, '0')}`;
}

function WeekSelect({ value, min, max, onChange, curWeek, curYear }: {
  value: number; min: number; max: number; onChange: (n: number) => void; curWeek: number; curYear: number;
}) {
  const options: number[] = [];
  for (let n = min; n <= max; n++) options.push(n);

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-[11px] font-semibold text-[#403833] border border-[#e9e3df] rounded px-1.5 py-1 bg-white hover:border-brand cursor-pointer"
    >
      {options.map((n) => (
        <option key={n} value={n}>{weekLabelFor(curWeek, curYear, n)}</option>
      ))}
    </select>
  );
}

// Two independent dropdowns instead of a dual-thumb slider — full flexibility (any exact
// start/end week), but a select is far easier to hit precisely than dragging two overlapping
// native range-input thumbs. A reset button restores the default range in one click.
export function WeekRangeStepper({ min, max, value, onChange, curWeek, curYear, className = '' }: WeekRangeStepperProps) {
  const isDefault = value.start === WEEK_RANGE_DEFAULT.start && value.end === WEEK_RANGE_DEFAULT.end;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <WeekSelect
        value={value.start}
        min={min}
        max={value.end}
        onChange={(n) => onChange({ start: n, end: value.end })}
        curWeek={curWeek}
        curYear={curYear}
      />
      <span className="text-[#c8c0bb]">→</span>
      <WeekSelect
        value={value.end}
        min={value.start}
        max={max}
        onChange={(n) => onChange({ start: value.start, end: n })}
        curWeek={curWeek}
        curYear={curYear}
      />
      {!isDefault && (
        <button
          onClick={() => onChange(WEEK_RANGE_DEFAULT)}
          title="Reset to default range"
          className="text-[11px] text-[#9c9794] hover:text-brand transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
