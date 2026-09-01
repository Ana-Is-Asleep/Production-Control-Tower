'use client';

import type { SKUCategory } from '../../lib/skuUtils';
import type { Channel } from '../../lib/channelUtils';

interface SupplierInfoCardProps {
  supplier: string;
  categories: SKUCategory[];
  channels: Channel[];
  weekLabelStart: string;
  weekLabelEnd: string;
  weekCount: number;
}

function summarize(values: string[], allLabel: string): string {
  if (values.length === 0) return allLabel;
  if (values.length === 1) return values[0];
  return `${values.length} selected`;
}

export function SupplierInfoCard({ supplier, categories, channels, weekLabelStart, weekLabelEnd, weekCount }: SupplierInfoCardProps) {
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-3 shrink-0 w-[190px] flex flex-col gap-2.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Supplier</p>
        <p className="text-sm font-bold text-[#403833] truncate mt-0.5">{supplier}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Category</p>
        <p className="text-sm font-bold text-[#403833] truncate mt-0.5">{summarize(categories, 'All categories')}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Channel</p>
        <p className="text-sm font-bold text-[#403833] truncate mt-0.5">{summarize(channels, 'All channels')}</p>
      </div>
      <div className="border-t border-[#f4f1ef] pt-2">
        <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Evaluating period</p>
        <p className="text-sm font-bold text-[#403833] mt-0.5">{weekLabelStart} – {weekLabelEnd} <span className="text-[10px] font-medium text-[#9c9794]">({weekCount} weeks)</span></p>
      </div>
    </div>
  );
}
