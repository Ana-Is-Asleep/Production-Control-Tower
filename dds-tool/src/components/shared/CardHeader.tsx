'use client';

import { Info } from 'lucide-react';

interface CardHeaderProps {
  title: string;
  infoText?: string;
  subtitle?: string;
  total?: number;
  drillDownLabel?: string;
}

// Shared title/subtitle/total pattern for every dashboard card — title + info icon on the top
// row (with "Drill down →" at the far right, since every card is a Link), and an optional
// subtitle + right-aligned "Total N" on the row below.
export function CardHeader({ title, infoText, subtitle, total, drillDownLabel = 'Drill down →' }: CardHeaderProps) {
  return (
    <div className="shrink-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-[#403833]">{title}</p>
          {infoText && <Info size={13} className="text-[#9c9794]" aria-label={infoText} />}
        </div>
        <p className="text-[10px] text-brand font-semibold shrink-0">{drillDownLabel}</p>
      </div>
      {(subtitle || total !== undefined) && (
        <div className="flex items-center justify-between mt-1">
          {subtitle ? <p className="text-[11px] text-[#7b7571]">{subtitle}</p> : <span />}
          {total !== undefined && (
            <p className="text-xs text-[#7b7571] font-medium shrink-0">Total <span className="text-sm font-bold text-[#403833]">{total}</span></p>
          )}
        </div>
      )}
    </div>
  );
}
