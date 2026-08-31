'use client';

import Link from 'next/link';
import { TopGraphChart } from './TopGraphChart';
import type { TopGraphPoint } from '../../hooks/useKPIs';

interface TopGraphSectionProps {
  points: TopGraphPoint[];
  sotTarget: number;
  otifTarget: number;
  drillDownHref: string;
}

function pctLabel(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

// "Drill down" now navigates to the full-screen /sot-otif view instead of opening a side panel —
// see TopGraphChart.tsx for the actual chart, reused verbatim on that page.
export function TopGraphSection({ points, sotTarget, otifTarget, drillDownHref }: TopGraphSectionProps) {
  const latestPast = [...points].reverse().find((p) => !p.isFuture);
  const currentSOT = latestPast?.sotPastPct ?? null;
  const currentOTIF = latestPast?.otifPastPct ?? null;

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-end mb-3 shrink-0">
        <p className="text-xs text-brand font-semibold">Drill down →</p>
      </div>
      <div className="flex-1 min-h-0 flex items-stretch gap-5">
        <div className="flex flex-col justify-center gap-4 shrink-0">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">SOT · {sotTarget}% target</p>
            <p className={`kpi-number font-extrabold text-4xl leading-none ${currentSOT === null ? 'text-[#c8c0bb]' : currentSOT >= sotTarget ? 'text-pass' : 'text-fail'}`}>
              {pctLabel(currentSOT)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">OTIF · {otifTarget}% target</p>
            <p className={`kpi-number font-extrabold text-4xl leading-none ${currentOTIF === null ? 'text-[#c8c0bb]' : currentOTIF >= otifTarget ? 'text-pass' : 'text-fail'}`}>
              {pctLabel(currentOTIF)}
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0 min-w-0">
          <TopGraphChart points={points} />
        </div>
      </div>
    </Link>
  );
}
