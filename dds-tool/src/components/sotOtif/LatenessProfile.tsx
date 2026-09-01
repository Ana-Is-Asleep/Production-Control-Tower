'use client';

import { useMemo } from 'react';
import type { PORollup } from '../../lib/poAggregation';

interface LatenessProfileProps {
  rollups: PORollup[];
  weekLabel: string | null;
}

type Bucket = 'on_time' | 'late_1_3' | 'late_4_7' | 'late_gt_7';

const BUCKET_META: Record<Bucket, { label: string; color: string; bg: string }> = {
  on_time: { label: 'On Time', color: '#15803d', bg: '#DCFCE7' },
  late_1_3: { label: '1–3 days late', color: '#b45309', bg: '#FEF3C7' },
  late_4_7: { label: '4–7 days late', color: '#c2650a', bg: '#FFE3C2' },
  late_gt_7: { label: '> 7 days late', color: '#dc2626', bg: '#FEE2E2' },
};

// Describes the severity of lateness for the POs in the selected week only — not a lead-time
// analysis, just how far past PGRD the ones that did ship actually landed. A PO with no ship
// date yet (sot still undetermined) can't be bucketed and is left out of the total.
function bucketFor(r: PORollup): Bucket | null {
  const shipDate = r.asd ?? r.esd;
  if (!shipDate || !r.pgrd) return null;
  const days = Math.round((shipDate.getTime() - r.pgrd.getTime()) / 86400000);
  if (days <= 0) return 'on_time';
  if (days <= 3) return 'late_1_3';
  if (days <= 7) return 'late_4_7';
  return 'late_gt_7';
}

export function LatenessProfile({ rollups, weekLabel }: LatenessProfileProps) {
  const { counts, total } = useMemo(() => {
    const c: Record<Bucket, number> = { on_time: 0, late_1_3: 0, late_4_7: 0, late_gt_7: 0 };
    let t = 0;
    for (const r of rollups) {
      const b = bucketFor(r);
      if (!b) continue;
      c[b] += 1;
      t += 1;
    }
    return { counts: c, total: t };
  }, [rollups]);

  const buckets = (['on_time', 'late_1_3', 'late_4_7', 'late_gt_7'] as Bucket[]).map((key) => ({
    key,
    ...BUCKET_META[key],
    count: counts[key],
    pct: total ? Math.round((counts[key] / total) * 100) : 0,
  }));

  // simple donut via conic-gradient — no chart lib needed for a single static snapshot
  let cursor = 0;
  const gradientStops = buckets
    .filter((b) => b.count > 0)
    .map((b) => {
      const start = cursor;
      cursor += (b.count / Math.max(1, total)) * 360;
      return `${b.color} ${start}deg ${cursor}deg`;
    })
    .join(', ');

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Lateness Profile</p>
      <p className="text-[11px] text-[#9c9794] mb-3">Selected week{weekLabel ? `, ${weekLabel}` : ''}{total ? ` · ${total} POs` : ''}</p>

      {total === 0 ? (
        <p className="text-xs text-[#9c9794]">No shipped POs to profile in the selected week.</p>
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
            {buckets.map((b) => (
              <div key={b.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[#58524e]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                  {b.label}
                </span>
                <span className="font-semibold" style={{ color: b.count > 0 ? b.color : '#c8c0bb' }}>{b.count} <span className="text-[#9c9794] font-normal">({b.pct}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
