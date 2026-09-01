'use client';

import type { SkuBacklogRow } from '../../lib/backlogAggregation';

interface BacklogBySkuProps {
  skus: SkuBacklogRow[];
  selectedSku: string | null;
  onSelectSku: (sku: string) => void;
}

const TOP_N = 10;

// Which actual products are driving this supplier's backlog. No SKU description exists in this
// data source (only the bare code), so the SKU column shows the code as-is rather than a
// fabricated name. Clicking a row filters the PO table below to that SKU.
export function BacklogBySku({ skus, selectedSku, onSelectSku }: BacklogBySkuProps) {
  const top = skus.slice(0, TOP_N);
  const maxCount = Math.max(1, ...top.map((s) => s.poCount));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Backlog by SKU</p>
      <p className="text-[11px] text-[#9c9794] mb-3">Top {Math.min(TOP_N, skus.length)} SKUs by current backlog</p>
      {top.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No backlog in scope</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">
                <th className="text-left pb-1.5">SKU</th>
                <th className="pb-1.5"></th>
                <th className="text-center pb-1.5 px-2">Backlog POs</th>
                <th className="text-center pb-1.5 px-2">% Backlog</th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => {
                const isSelected = selectedSku === s.sku;
                return (
                  <tr
                    key={s.sku}
                    onClick={() => onSelectSku(s.sku)}
                    className={`border-t border-[#f4f1ef] cursor-pointer transition-colors ${isSelected ? 'bg-[#fff7ed]' : 'hover:bg-[#f9f7f6]'}`}
                  >
                    <td className="py-2 font-semibold text-[#403833] whitespace-nowrap">{s.sku}</td>
                    <td className="py-2 px-2 w-24">
                      <div className="h-1.5 rounded-full bg-[#f5f2ee] overflow-hidden">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max((s.poCount / maxCount) * 100, 4)}%` }} />
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center text-[#403833]">{s.poCount}</td>
                    <td className="py-2 px-2 text-center text-[#58524e]">{s.pctOfBacklog}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
