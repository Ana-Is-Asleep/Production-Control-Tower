'use client';

import { formatDateMedium } from '../../../lib/dateUtils';
import type { PurchaseLine } from '../../../types';

interface POTimelineProps {
  line: PurchaseLine | undefined;
}

const STOPS: { key: keyof PurchaseLine; label: string; caption: string }[] = [
  { key: 'pgrd', label: 'PGRD', caption: 'Planned Goods Ready Date' },
  { key: 'egrd', label: 'EGRD', caption: 'Expected Goods Ready Date' },
  { key: 'esd', label: 'ESD', caption: 'Expected Shipping Date' },
  { key: 'asd', label: 'ASD', caption: 'Actual Shipping Date' },
];

// Read-only — these dates come straight from the source PO data and are never editable here, so
// deliberately rendered as a plain timeline rather than anything that looks like a form field.
export function POTimeline({ line }: POTimelineProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794] mb-3">PO timeline (from source systems)</p>
      <div className="grid grid-cols-4 gap-2 relative">
        <div className="absolute top-[5px] left-[12.5%] right-[12.5%] h-px bg-[#e9e3df]" />
        {STOPS.map((stop) => {
          const value = line?.[stop.key] as Date | null | undefined;
          return (
            <div key={stop.key} className="relative flex flex-col items-center text-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#403833] border-2 border-white shrink-0 z-10" style={{ boxShadow: '0 0 0 1px #e9e3df' }} />
              <p className="text-[10px] font-bold text-[#403833] mt-2">{stop.label}</p>
              <p className="text-xs font-semibold text-[#403833] mt-1">{formatDateMedium(value ?? null)}</p>
              <p className="text-[10px] text-[#9c9794] mt-0.5 leading-tight">{stop.caption}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
