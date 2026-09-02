'use client';

import { REASON_CATEGORY_LABELS, type ReasonCategory } from '../../lib/reasonClassification';
import type { SupplierCategoryMatrix } from '../../lib/rootCauseAggregation';

interface SupplierHeatmapProps {
  matrix: SupplierCategoryMatrix;
  onSelectCell: (supplier: string, category: ReasonCategory) => void;
}

// Cell intensity scales with count relative to the matrix max — a simple sequential heat scale
// (0% = near-white, 100% = full brand orange), independent of category color so the "heat"
// reads consistently across the whole grid rather than each column having a different hue.
function cellStyle(count: number, maxCell: number) {
  if (count === 0) return { background: '#fff', color: '#c8c0bb' };
  const intensity = count / maxCell;
  const alpha = 0.12 + intensity * 0.75;
  return { background: `rgba(255, 137, 0, ${alpha.toFixed(2)})`, color: intensity > 0.55 ? '#fff' : '#403833' };
}

export function SupplierHeatmap({ matrix, onSelectCell }: SupplierHeatmapProps) {
  if (matrix.suppliers.length === 0 || matrix.categories.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Supplier × Root Cause</p>
        <p className="text-xs text-[#9c9794] py-6 text-center">No flagged POs in scope</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 overflow-x-auto" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-3">Supplier × Root Cause</p>
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] whitespace-nowrap">Supplier</th>
            {matrix.categories.map((cat) => (
              <th key={cat} className="px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#9c9794] whitespace-nowrap" style={{ maxWidth: 90 }}>
                <span className="block truncate" title={REASON_CATEGORY_LABELS[cat]}>{REASON_CATEGORY_LABELS[cat]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.suppliers.map((supplier) => (
            <tr key={supplier} className="border-t border-[#f4f1ef]">
              <td className="px-2 py-1 font-semibold text-[#403833] whitespace-nowrap">{supplier}</td>
              {matrix.categories.map((cat) => {
                const count = matrix.cellCount(supplier, cat);
                const style = cellStyle(count, matrix.maxCell);
                return (
                  <td key={cat} className="p-0.5">
                    <button
                      onClick={() => count > 0 && onSelectCell(supplier, cat)}
                      className="w-full h-7 rounded text-[11px] font-semibold flex items-center justify-center transition-transform hover:scale-105"
                      style={style}
                      disabled={count === 0}
                    >
                      {count > 0 ? count : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
