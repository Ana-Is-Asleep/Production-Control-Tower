'use client';

import { shiftISOWeek } from '../../lib/dateUtils';

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

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Earlier week"
        className="w-5 h-5 flex items-center justify-center rounded border border-[#e9e3df] text-[#58524e] hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-[#e9e3df] disabled:hover:text-[#58524e]"
      >
        −
      </button>
      <span className="text-[11px] font-semibold text-[#403833] w-9 text-center tabular-nums">{label}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Later week"
        className="w-5 h-5 flex items-center justify-center rounded border border-[#e9e3df] text-[#58524e] hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-[#e9e3df] disabled:hover:text-[#58524e]"
      >
        +
      </button>
    </div>
  );
}

// Two independent +/- steppers instead of a dual-thumb slider — same full flexibility (any
// exact start/end week), but each thumb is its own button instead of two overlapping
// <input type="range"> elements fighting for the same drag gesture, which is hard to grab
// precisely once the handles are close together.
export function WeekRangeStepper({ min, max, value, onChange, curWeek, curYear, className = '' }: WeekRangeStepperProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Stepper
        value={value.start}
        min={min}
        max={value.end}
        onChange={(n) => onChange({ start: n, end: value.end })}
        label={weekLabelFor(curWeek, curYear, value.start)}
      />
      <span className="text-[#c8c0bb]">→</span>
      <Stepper
        value={value.end}
        min={value.start}
        max={max}
        onChange={(n) => onChange({ start: value.start, end: n })}
        label={weekLabelFor(curWeek, curYear, value.end)}
      />
    </div>
  );
}
