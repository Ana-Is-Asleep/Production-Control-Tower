'use client';

import type { LeadTimeDistribution as Distribution } from '../../lib/leadTimeAnalytics';

interface LeadTimeDistributionProps {
  distribution: Distribution;
  onSelectBucket?: (label: string) => void;
}

const BUCKET_COLORS = ['#15803d', '#84cc16', '#f59e0b', '#ea580c', '#dc2626'];

export function LeadTimeDistribution({ distribution, onSelectBucket }: LeadTimeDistributionProps) {
  const { total, buckets, bucketLabel } = distribution;

  let cursor = 0;
  const gradientStops = buckets
    .filter((b) => b.count > 0)
    .map((b, i) => {
      const start = cursor;
      cursor += (b.count / Math.max(1, total)) * 360;
      return `${BUCKET_COLORS[buckets.indexOf(b)] ?? '#c8c0bb'} ${start}deg ${cursor}deg`;
    })
    .join(', ');

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Lead Time Distribution</p>
      <p className="text-[11px] text-[#9c9794] mb-3">Distribution of POs by lead time buckets — {bucketLabel}</p>

      {total === 0 ? (
        <p className="text-xs text-[#9c9794] flex-1 flex items-center justify-center">No completed POs in this period.</p>
      ) : (
        <div className="flex-1 flex items-center gap-4">
          <div
            className="rounded-full shrink-0 flex items-center justify-center"
            style={{ width: 92, height: 92, background: gradientStops ? `conic-gradient(${gradientStops})` : '#f5f2ee' }}
          >
            <div className="rounded-full bg-white flex flex-col items-center justify-center" style={{ width: 60, height: 60 }}>
              <p className="text-lg font-extrabold leading-none text-[#403833]">{total}</p>
              <p className="text-[9px] text-[#9c9794]">POs</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {buckets.map((b, i) => (
              <button
                key={b.label}
                onClick={() => onSelectBucket?.(b.label)}
                disabled={b.count === 0 || !onSelectBucket}
                className="flex items-center justify-between text-xs w-full text-left disabled:cursor-default hover:bg-[#f9f7f6] rounded px-1 -mx-1 py-0.5"
              >
                <span className="flex items-center gap-1.5 text-[#58524e]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BUCKET_COLORS[i] }} />
                  {b.label}
                </span>
                <span className="font-semibold" style={{ color: b.count > 0 ? BUCKET_COLORS[i] : '#c8c0bb' }}>{b.count} ({b.pct}%)</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
