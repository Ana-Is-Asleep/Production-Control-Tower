'use client';

interface RangeSliderProps {
  min: number;
  max: number;
  value: { start: number; end: number };
  onChange: (value: { start: number; end: number }) => void;
  formatLabel?: (n: number) => string;
  className?: string;
}

// Reusable two-thumb range slider: two overlaid <input type="range"> elements, styled with
// Tailwind arbitrary values to match the existing brand aesthetic. No new npm dependency.
export function RangeSlider({ min, max, value, onChange, formatLabel = (n) => String(n), className = '' }: RangeSliderProps) {
  const span = max - min || 1;
  const startPct = ((value.start - min) / span) * 100;
  const endPct = ((value.end - min) / span) * 100;

  const handleStart = (n: number) => onChange({ start: Math.min(n, value.end), end: value.end });
  const handleEnd = (n: number) => onChange({ start: value.start, end: Math.max(n, value.start) });

  const thumbClass =
    'pointer-events-none absolute inset-0 w-full appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none ' +
    '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full ' +
    '[&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white ' +
    '[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 ' +
    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:border-2 ' +
    '[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="text-[11px] font-semibold text-[#58524e] w-8 text-right shrink-0">{formatLabel(value.start)}</span>
      <div className="relative h-4 flex-1 min-w-[120px]">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 rounded-full bg-[#e9e3df]" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-brand"
          style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value.start}
          onChange={(e) => handleStart(Number(e.target.value))}
          className={thumbClass}
          aria-label="Week range start"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value.end}
          onChange={(e) => handleEnd(Number(e.target.value))}
          className={thumbClass}
          aria-label="Week range end"
        />
      </div>
      <span className="text-[11px] font-semibold text-[#58524e] w-8 shrink-0">{formatLabel(value.end)}</span>
    </div>
  );
}
