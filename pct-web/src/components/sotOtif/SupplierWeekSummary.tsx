'use client';

function pctLabel(v: number | null) {
  return v === null ? '—' : `${v}%`;
}

interface SupplierWeekSummaryProps {
  weekLabel: string;
  isAverage: boolean; // true when showing the full range's average rather than one specific week
  sotPct: number | null;
  sotTarget: number;
  sotOnCount: number;
  sotTotalCount: number;
  otifPct: number | null;
  otifTarget: number;
  otifOnCount: number;
  otifTotalCount: number;
}

// Compact SOT/OTIF summary next to the Evolution chart, replacing the old full-width KPI deep dive
// row (Ana: "the little screen that now has the supplier and the filters next the main graph").
// When a week is selected this reads as that week's numbers; when nothing is selected it falls
// back to the full range's average instead of quietly narrowing to the last completed week — the
// "(avg)" suffix makes sure the numbers never look like a single week's result when they aren't.
export function SupplierWeekSummary({
  weekLabel, isAverage, sotPct, sotTarget, sotOnCount, sotTotalCount, otifPct, otifTarget, otifOnCount, otifTotalCount,
}: SupplierWeekSummaryProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-3 flex flex-col gap-2.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Week</p>
        <p className="text-sm font-bold text-[#403833] truncate mt-0.5">{weekLabel}{isAverage ? ' (avg)' : ''}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">SOT · {sotTarget}% target</p>
        <p className={`text-lg font-extrabold leading-none mt-0.5 ${sotPct === null ? 'text-[#c8c0bb]' : sotPct >= sotTarget ? 'text-pass' : 'text-fail'}`}>
          {pctLabel(sotPct)}
        </p>
        <p className="text-[10px] text-[#9c9794] mt-0.5">{sotOnCount} / {sotTotalCount} shipped on time</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">OTIF · {otifTarget}% target</p>
        <p className={`text-lg font-extrabold leading-none mt-0.5 ${otifPct === null ? 'text-[#c8c0bb]' : otifPct >= otifTarget ? 'text-pass' : 'text-fail'}`}>
          {pctLabel(otifPct)}
        </p>
        <p className="text-[10px] text-[#9c9794] mt-0.5">{otifOnCount} / {otifTotalCount} in scope on time</p>
      </div>
    </div>
  );
}
