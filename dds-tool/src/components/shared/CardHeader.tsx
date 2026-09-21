'use client';

interface CardHeaderProps {
  title: string;
  infoText?: string; // no longer rendered — Ana asked to remove the info icons entirely rather than keep them as tooltips
  subtitle?: string;
  total?: number;
  drillDownLabel?: string;
}

// Shared title/subtitle/total pattern for every dashboard card — title (with "Drill down →" at
// the far right, since every card is a Link), and an optional subtitle + right-aligned "Total N"
// on the row below.
export function CardHeader({ title, subtitle, total, drillDownLabel = 'Drill down →' }: CardHeaderProps) {
  return (
    <div className="shrink-0">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold text-[#403833]">{title}</p>
        <p className="text-[9px] text-brand font-semibold shrink-0">{drillDownLabel}</p>
      </div>
      {(subtitle || total !== undefined) && (
        <div className="flex items-center justify-between mt-0.5">
          {subtitle ? <p className="text-[10px] text-[#7b7571] truncate">{subtitle}</p> : <span />}
          {total !== undefined && (
            <p className="text-[10px] text-[#7b7571] font-medium shrink-0">Total <span className="text-xs font-bold text-[#403833]">{total}</span></p>
          )}
        </div>
      )}
    </div>
  );
}
