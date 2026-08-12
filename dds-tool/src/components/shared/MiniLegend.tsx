'use client';

export interface MiniLegendItem {
  label: string;
  color: string;
  // 'bar' = filled swatch, 'line'/'dashed-line' = stroke swatch matching the chart's line style
  type?: 'bar' | 'line' | 'dashed-line';
}

// Compact, wrapping legend for the small overview cards — Recharts' built-in <Legend> either
// takes too much vertical space or can't distinguish solid vs dashed lines, so screenshots of
// these cards need this instead to be self-explanatory without hovering.
export function MiniLegend({ items, className }: { items: MiniLegendItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className ?? ''}`}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[10px] text-[#7b7571] font-medium whitespace-nowrap">
          {it.type === 'line' || it.type === 'dashed-line' ? (
            <svg width="14" height="8" className="shrink-0" aria-hidden>
              <line
                x1="0" y1="4" x2="14" y2="4"
                stroke={it.color} strokeWidth={2}
                strokeDasharray={it.type === 'dashed-line' ? '3 2' : undefined}
              />
            </svg>
          ) : (
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
