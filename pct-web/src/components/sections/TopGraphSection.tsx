'use client';

import { Link } from 'react-router-dom';
import { TopGraphChart } from './TopGraphChart';
import { CardHeader } from '../shared/CardHeader';
import { KpiBox } from '../shared/KpiBox';
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
      to={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <CardHeader
        title="SOT & OTIF Performance"
        infoText="Shipped On Time and On Time In Full performance vs. the 90% target"
        subtitle="Evolution vs. 90% target"
      />
      <div className="flex-1 min-h-0 flex items-stretch gap-5 mt-3">
        <div className="flex flex-col justify-center gap-3 shrink-0 w-[150px]">
          <KpiBox
            label={`SOT · ${sotTarget}% target`}
            value={pctLabel(currentSOT)}
            valueClassName={`text-3xl ${currentSOT === null ? 'text-[#c8c0bb]' : currentSOT >= sotTarget ? 'text-pass' : 'text-fail'}`}
            tint={currentSOT === null ? 'neutral' : currentSOT >= sotTarget ? 'pass' : 'fail'}
          />
          <KpiBox
            label={`OTIF · ${otifTarget}% target`}
            value={pctLabel(currentOTIF)}
            valueClassName={`text-3xl ${currentOTIF === null ? 'text-[#c8c0bb]' : currentOTIF >= otifTarget ? 'text-pass' : 'text-fail'}`}
            tint={currentOTIF === null ? 'neutral' : currentOTIF >= otifTarget ? 'pass' : 'fail'}
          />
        </div>
        <div className="flex-1 min-h-0 min-w-0">
          <TopGraphChart points={points} />
        </div>
      </div>
    </Link>
  );
}
