'use client';

import { useState } from 'react';
import { formatDateShort } from '../../lib/dateUtils';
import type { BacklogPORow } from '../../lib/backlogAggregation';

interface BacklogOutlierCalloutProps {
  outliers: BacklogPORow[];
}

export function BacklogOutlierCallout({ outliers }: BacklogOutlierCalloutProps) {
  const [expanded, setExpanded] = useState(false);
  if (outliers.length === 0) return null;

  return (
    <div className="bg-[#FFF3E0] border border-[#f0b95c] rounded-lg px-4 py-2.5 text-sm text-[#403833]">
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left flex items-center justify-between">
        <span>⚠ {outliers.length} PO{outliers.length > 1 ? 's' : ''} with ESD far beyond the projection window</span>
        <span className="text-xs text-brand font-semibold">{expanded ? 'Hide' : 'Show'} list</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 border-t border-[#f0b95c] pt-2">
          {outliers.map((o) => (
            <div key={o.po} className="flex justify-between text-xs">
              <span className="font-semibold">{o.po} · {o.supplier}</span>
              <span className="text-[#7b7571]">ESD {formatDateShort(o.esd)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
