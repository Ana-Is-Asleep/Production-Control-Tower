'use client';

import { LT_TARGET_DAYS, type HeatmapData, type LTBucket } from '../../lib/leadTimeAnalytics';

interface LeadTimeHeatmapProps {
  data: HeatmapData;
  buckets: LTBucket[];
  onSelectCell: (bucketKey: string, rowKey: string) => void;
}

// Diverging scale centered on the 30-day target: green the further under, red the further over —
// unlike a plain sequential "heat" scale, direction matters here (under vs over target).
function cellStyle(avg: number) {
  const delta = avg - LT_TARGET_DAYS;
  const intensity = Math.min(Math.abs(delta) / 30, 1); // saturate at 30 days off-target
  const alpha = 0.12 + intensity * 0.75;
  const color = delta <= 0 ? `rgba(21, 128, 61, ${alpha.toFixed(2)})` : `rgba(220, 38, 38, ${alpha.toFixed(2)})`;
  return { background: color, color: intensity > 0.55 ? '#fff' : '#403833' };
}

export function LeadTimeHeatmap({ data, buckets, onSelectCell }: LeadTimeHeatmapProps) {
  const cellMap = new Map(data.cells.map((c) => [`${c.bucketKey}|${c.rowKey}`, c]));

  if (data.rows.length === 0 || buckets.length === 0) {
    return <p className="text-xs text-[#9c9794] py-6 text-center">No POs in scope</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] whitespace-nowrap sticky left-0 bg-white">Row</th>
            {buckets.map((b) => (
              <th key={b.key} className="px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#9c9794] whitespace-nowrap">{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row} className="border-t border-[#f4f1ef]">
              <td className="px-2 py-1 font-semibold text-[#403833] whitespace-nowrap sticky left-0 bg-white">{row}</td>
              {buckets.map((b) => {
                const cell = cellMap.get(`${b.key}|${row}`);
                return (
                  <td key={b.key} className="p-0.5">
                    {cell ? (
                      <button
                        onClick={() => onSelectCell(b.key, row)}
                        title={`${row} · ${b.label}: avg ${cell.avg}d over ${cell.count} POs`}
                        className="w-full h-7 min-w-[40px] rounded text-[11px] font-semibold flex items-center justify-center transition-transform hover:scale-105"
                        style={cellStyle(cell.avg)}
                      >
                        {cell.avg}
                      </button>
                    ) : (
                      <div className="w-full h-7 min-w-[40px] rounded bg-[#f9f7f6]" />
                    )}
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
