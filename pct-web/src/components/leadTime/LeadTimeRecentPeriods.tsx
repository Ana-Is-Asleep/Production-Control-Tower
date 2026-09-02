'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LT_TARGET_DAYS, type PeriodSummary, type DrillRow } from '../../lib/leadTimeAnalytics';

interface LeadTimeRecentPeriodsProps {
  periods: PeriodSummary[];
  getDrillRows: (bucketKey: string) => DrillRow[];
}

const COLLAPSED_COUNT = 5;

export function LeadTimeRecentPeriods({ periods, getDrillRows }: LeadTimeRecentPeriodsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // most recent first
  const ordered = [...periods].reverse();
  const visible = showAll ? ordered : ordered.slice(0, COLLAPSED_COUNT);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-[#403833]">Recent Periods Detail</p>
        <p className="text-[11px] text-[#9c9794]">Click a period to view the underlying POs</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#403833] text-white">
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap w-6"></th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Period</th>
            <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">POs in Scope</th>
            <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Average Lead Time</th>
            <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">vs Target ({LT_TARGET_DAYS}d)</th>
            <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Meeting Target</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr><td colSpan={6} className="text-center py-6 text-[#9c9794]">No periods in scope</td></tr>
          )}
          {visible.map((p) => {
            const isExpanded = expanded === p.bucketKey;
            return (
              <Fragment key={p.bucketKey}>
                <tr
                  onClick={() => setExpanded(isExpanded ? null : p.bucketKey)}
                  className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6] cursor-pointer"
                >
                  <td className="px-4 py-2 text-[#9c9794]">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td className="px-4 py-2 font-semibold text-[#403833] whitespace-nowrap">{p.label}</td>
                  <td className="px-4 py-2 text-center text-[#58524e]">{p.poCount}</td>
                  <td className="px-4 py-2 text-center text-[#403833] font-semibold">{p.avgLeadDays !== null ? `${p.avgLeadDays}d` : '—'}</td>
                  <td className="px-4 py-2 text-center font-semibold" style={{ color: p.vsTargetDays === null ? '#c8c0bb' : p.vsTargetDays > 0 ? '#dc2626' : '#15803d' }}>
                    {p.vsTargetDays !== null ? `${p.vsTargetDays > 0 ? '+' : ''}${p.vsTargetDays}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.meetingTarget === null ? <span className="text-[#c8c0bb]">—</span> : p.meetingTarget ? <span className="text-pass font-bold">✓</span> : <span className="text-fail font-bold">✕</span>}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="bg-[#f9f7f6] px-4 py-2 max-h-64 overflow-y-auto">
                        {getDrillRows(p.bucketKey).length === 0 ? (
                          <p className="text-[11px] text-[#9c9794] py-2">No scored POs in this period.</p>
                        ) : (
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-[#9c9794]">
                                <th className="text-left font-semibold uppercase tracking-wide pb-1">PO</th>
                                <th className="text-left font-semibold uppercase tracking-wide pb-1">Supplier</th>
                                <th className="text-right font-semibold uppercase tracking-wide pb-1">Lead Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getDrillRows(p.bucketKey).slice(0, 20).map((r) => (
                                <tr key={r.po} className="border-t border-[#e9e3df]">
                                  <td className="py-1 text-[#403833] font-semibold">{r.po}</td>
                                  <td className="py-1 text-[#58524e]">{r.supplier}</td>
                                  <td className="py-1 text-right text-[#403833] font-semibold">{r.leadDays}d</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {ordered.length > COLLAPSED_COUNT && (
        <div className="px-4 py-2.5 border-t border-[#e9e3df]">
          <button onClick={() => setShowAll((v) => !v)} className="text-xs text-brand font-semibold hover:underline">
            {showAll ? 'Show recent periods only' : `View all periods (${ordered.length}) →`}
          </button>
        </div>
      )}
    </div>
  );
}
