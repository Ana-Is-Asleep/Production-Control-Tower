'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useActions } from '../../hooks/useActions';
import { CardHeader } from '../shared/CardHeader';
import { ROOT_CAUSE_REASONS, ROOT_CAUSE_REASON_LABELS, type RootCauseReason } from '../../types/actions';
import type { PurchaseLine } from '../../types';

interface RootCauseSectionProps {
  lines: PurchaseLine[]; // scopes the pending/submitted counts to the currently filtered POs
  drillDownHref: string;
}

// Fixed hue per reason, in the same declared order as ROOT_CAUSE_REASONS — never cycled/reassigned
// by rank, so a given reason always reads as the same color everywhere it appears.
const ROOT_CAUSE_COLORS: Record<RootCauseReason, string> = {
  capacity_issues: '#eb6834',
  components_delay: '#2a78d6',
  covers: '#1baf7a',
  transport_issues: '#eda100',
  container_availability: '#4a3aa7',
  inbound_capacity: '#e87ba4',
};

// Root Cause is no longer inferred from free-text loss reasons — it's the SCM-submitted answer
// captured when closing an R002 (missed SOT) flag (see RootCauseActionQueue.tsx). This card shows
// how many POs are still waiting on that answer and the breakdown of what's been submitted so
// far, instead of the old AI-classified-reasons-by-week chart.
export function RootCauseSection({ lines, drillDownHref }: RootCauseSectionProps) {
  const { actions } = useActions();
  const filteredPOs = useMemo(() => new Set(lines.map((l) => l.po)), [lines]);

  const { pendingCount, submittedByReason, totalSubmitted } = useMemo(() => {
    const r002 = actions.filter((a) => a.type === 'flag' && a.ruleKey === 'R002' && (!a.poReference || filteredPOs.has(a.poReference)));
    const pending = r002.filter((a) => a.status !== 'closed').length;
    const submitted = r002.filter((a) => !!a.rootCauseReason);
    const totals = new Map<RootCauseReason, number>();
    submitted.forEach((a) => { if (a.rootCauseReason) totals.set(a.rootCauseReason, (totals.get(a.rootCauseReason) ?? 0) + 1); });
    const ranked = ROOT_CAUSE_REASONS
      .map((r): [RootCauseReason, number] => [r, totals.get(r) ?? 0])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    return { pendingCount: pending, submittedByReason: ranked, totalSubmitted: submitted.length };
  }, [actions, filteredPOs]);

  return (
    <Link
      href={drillDownHref}
      className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-3 py-2.5 cursor-pointer flex flex-col h-full overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <CardHeader title="Root Cause" subtitle="SCM-submitted root causes for missed SOT" />
      <div className="grid grid-cols-2 gap-1.5 shrink-0 mt-1.5">
        <div className="rounded-lg border border-[#e9e3df] px-2 py-1.5 bg-fail-bg">
          <p className="text-[9px] uppercase tracking-widest text-[#9c9794] truncate">Pending</p>
          <p className="text-lg font-extrabold leading-none mt-0.5 text-fail">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-[#e9e3df] px-2 py-1.5 bg-[#f5f2ee]">
          <p className="text-[9px] uppercase tracking-widest text-[#9c9794] truncate">Submitted</p>
          <p className="text-lg font-extrabold leading-none mt-0.5 text-[#403833]">{totalSubmitted}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 mt-1.5 overflow-y-auto space-y-1">
        {submittedByReason.length === 0 ? (
          <p className="text-[10px] text-[#b5aaa5]">No root causes submitted yet.</p>
        ) : (
          submittedByReason.map(([reason, count]) => (
            <div key={reason} className="flex items-center gap-1.5 text-[10px] text-[#58524e]">
              <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: ROOT_CAUSE_COLORS[reason] }} />
              <span className="flex-1 truncate">{ROOT_CAUSE_REASON_LABELS[reason]}</span>
              <span className="font-semibold text-[#403833]">{count}</span>
            </div>
          ))
        )}
      </div>
    </Link>
  );
}
