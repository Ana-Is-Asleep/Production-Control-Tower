'use client';

import type { SupplierBacklogSummary } from '../../lib/backlogAggregation';

interface BacklogSupplierRankingProps {
  summary: SupplierBacklogSummary[];
}

const TOP_N = 5;

// Ranked by CURRENT backlog count only — Expected Future Backlog is a different population and
// isn't part of this ranking. No week-over-week trend/chronic-vs-spike claim, since a genuine
// comparison isn't computable from this live, mutate-in-place data source.
export function BacklogSupplierRanking({ summary }: BacklogSupplierRankingProps) {
  const top = summary.slice(0, TOP_N);
  const rest = summary.slice(TOP_N);
  const others = rest.length
    ? {
        supplier: 'Others',
        count: rest.reduce((s, r) => s + r.count, 0),
        pctOfBacklog: rest.reduce((s, r) => s + r.pctOfBacklog, 0),
        avgAgeDays: Math.round(rest.reduce((s, r) => s + r.avgAgeDays * r.count, 0) / Math.max(1, rest.reduce((s, r) => s + r.count, 0))),
        noEsdCount: rest.reduce((s, r) => s + r.noEsdCount, 0),
      }
    : null;
  const maxCount = Math.max(1, ...top.map((s) => s.count));

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col min-h-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">Supplier Exposure — Current Backlog</p>
      <p className="text-[11px] text-[#9c9794] mb-3">Backlog POs by supplier</p>
      {top.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-6 text-center">No backlog in scope</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">
                <th className="text-left pb-1.5">Supplier</th>
                <th className="pb-1.5"></th>
                <th className="text-center pb-1.5 px-2">POs</th>
                <th className="text-center pb-1.5 px-2">% of backlog</th>
                <th className="text-center pb-1.5 px-2">Avg Age</th>
                <th className="text-center pb-1.5 px-2">No ESD</th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => (
                <tr key={s.supplier} className="border-t border-[#f4f1ef]">
                  <td className="py-2 font-semibold text-[#403833] whitespace-nowrap">{s.supplier}</td>
                  <td className="py-2 px-2 w-24">
                    <div className="h-1.5 rounded-full bg-[#f5f2ee] overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max((s.count / maxCount) * 100, 4)}%` }} />
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center text-[#403833]">{s.count}</td>
                  <td className="py-2 px-2 text-center text-[#58524e]">{s.pctOfBacklog}%</td>
                  <td className="py-2 px-2 text-center text-[#58524e]">{s.avgAgeDays}d</td>
                  <td className="py-2 px-2 text-center" style={{ color: s.noEsdCount > 0 ? '#dc2626' : '#c8c0bb' }}>{s.noEsdCount}</td>
                </tr>
              ))}
              {others && (
                <tr className="border-t border-[#f4f1ef] text-[#7b7571]">
                  <td className="py-2 font-semibold whitespace-nowrap">Others</td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2 text-center">{others.count}</td>
                  <td className="py-2 px-2 text-center">{others.pctOfBacklog}%</td>
                  <td className="py-2 px-2 text-center">{others.avgAgeDays}d</td>
                  <td className="py-2 px-2 text-center" style={{ color: others.noEsdCount > 0 ? '#dc2626' : '#c8c0bb' }}>{others.noEsdCount}</td>
                </tr>
              )}
              <tr className="border-t-2 border-[#403833] font-bold text-[#403833]">
                <td className="py-2">Total</td>
                <td className="py-2 px-2"></td>
                <td className="py-2 px-2 text-center">{summary.reduce((s, r) => s + r.count, 0)}</td>
                <td className="py-2 px-2 text-center">100%</td>
                <td className="py-2 px-2 text-center">
                  {Math.round(summary.reduce((s, r) => s + r.avgAgeDays * r.count, 0) / Math.max(1, summary.reduce((s, r) => s + r.count, 0)))}d
                </td>
                <td className="py-2 px-2 text-center">{summary.reduce((s, r) => s + r.noEsdCount, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
