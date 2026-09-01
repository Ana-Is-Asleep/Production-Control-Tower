'use client';

import { computeSupplierExposure, type MissingEsdRow, type SupplierExposureRow } from '../../lib/missingEsdAggregation';

interface MissingEsdSupplierExposureProps {
  rows: MissingEsdRow[];
}

function ExposureRow({ row, isTotal }: { row: SupplierExposureRow; isTotal?: boolean }) {
  const needingActionPct = row.total ? Math.round((row.needingAction / row.total) * 100) : 0;
  const notUrgentPct = row.total ? Math.round((row.notUrgent / row.total) * 100) : 0;
  return (
    <tr className={isTotal ? 'border-t-2 border-[#403833] font-bold' : 'border-b border-[#f4f1ef]'}>
      <td className={`px-3 py-2 whitespace-nowrap ${isTotal ? 'text-[#403833]' : 'text-[#403833] font-semibold'}`}>{row.supplier}</td>
      <td className="px-2 py-2">
        {!isTotal && (
          <div className="h-2 rounded-full bg-[#f5f2ee] overflow-hidden w-full min-w-[60px]">
            <div className="h-2 rounded-full bg-fail" style={{ width: `${needingActionPct}%` }} />
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-center text-[#403833]">{row.total}</td>
      <td className="px-2 py-2 text-center text-fail">{row.needingAction} <span className="text-[#9c9794] font-normal">({needingActionPct}%)</span></td>
      <td className="px-2 py-2 text-center text-[#7b7571]">{row.notUrgent} <span className="text-[#9c9794] font-normal">({notUrgentPct}%)</span></td>
    </tr>
  );
}

// Top-5-suppliers-by-volume breakdown of the same Needing Action / Not Urgent split shown in the
// KPI row above, so a concentration problem ("most of the exposure sits with one supplier") is
// visible without cross-referencing the PO table.
export function MissingEsdSupplierExposure({ rows }: MissingEsdSupplierExposureProps) {
  const { top, others, total } = computeSupplierExposure(rows);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3 shrink-0">Exposure by Supplier <span className="text-[11px] font-medium text-[#9c9794]">(by total missing ESD)</span></p>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">
              <th className="px-3 py-1.5 text-left whitespace-nowrap">Supplier</th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5 text-center whitespace-nowrap">Missing ESD</th>
              <th className="px-2 py-1.5 text-center whitespace-nowrap">Needing Action</th>
              <th className="px-2 py-1.5 text-center whitespace-nowrap">Not Urgent</th>
            </tr>
          </thead>
          <tbody>
            {top.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-[#9c9794]">No POs match the current selection</td></tr>
            )}
            {top.map((row) => <ExposureRow key={row.supplier} row={row} />)}
            {others && <ExposureRow row={others} />}
            {top.length > 0 && <ExposureRow row={total} isTotal />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
