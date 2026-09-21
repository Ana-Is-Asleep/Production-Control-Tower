'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useActions } from '../../hooks/useActions';
import { ActionCard } from '../actions/ActionCard';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';
import type { ActionItem } from '../../types/actions';

interface RootCauseActionQueueProps {
  lines: PurchaseLine[]; // same scope as the rest of the page — used only to look up each PO's PGRD for grouping
  filteredPOs: Set<string>;
}

interface WeekGroup {
  key: string;
  label: string;
  sortKey: number;
  items: ActionItem[];
}

// The SCM-facing queue that actually produces the Root Cause data going forward: every PO that
// missed SOT (rule R002, raised on the SOT/OTIF page) needs a manually-selected root cause before
// it can be closed — see ActionCard's root-cause dropdown for the actual capture/validation.
// Grouped by PGRD week rather than by SOT outcome, since that's the cadence SCMs already review
// POs in everywhere else in the app.
export function RootCauseActionQueue({ lines, filteredPOs }: RootCauseActionQueueProps) {
  const { actions, updateAction } = useActions();
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  const pgrdByPO = useMemo(() => {
    const map = new Map<string, Date>();
    lines.forEach((l) => { if (l.pgrd && !map.has(l.po)) map.set(l.po, l.pgrd); });
    return map;
  }, [lines]);

  const groups = useMemo((): WeekGroup[] => {
    const pending = actions.filter((a) =>
      a.type === 'flag' && a.ruleKey === 'R002' && a.status !== 'closed' &&
      (!a.poReference || filteredPOs.has(a.poReference))
    );

    const byWeek = new Map<string, WeekGroup>();
    pending.forEach((a) => {
      const pgrd = a.poReference ? pgrdByPO.get(a.poReference) : undefined;
      const key = pgrd ? `${getISOWeekYear(pgrd)}-${String(getISOWeek(pgrd)).padStart(2, '0')}` : 'unknown';
      const label = pgrd ? `PGRD W${String(getISOWeek(pgrd)).padStart(2, '0')} ${getISOWeekYear(pgrd)}` : 'PGRD unknown';
      if (!byWeek.has(key)) byWeek.set(key, { key, label, items: [], sortKey: pgrd ? pgrd.getTime() : Infinity });
      byWeek.get(key)!.items.push(a);
    });

    return [...byWeek.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [actions, filteredPOs, pgrdByPO]);

  const totalPending = groups.reduce((s, g) => s + g.items.length, 0);

  const toggleWeek = (key: string) => setCollapsedWeeks((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-[#403833]">POs Needing a Root Cause</p>
          <p className="text-[11px] text-[#9c9794]">POs that missed SOT, awaiting a root cause — grouped by PGRD week</p>
        </div>
        <span className="text-xs font-semibold text-[#7b7571] shrink-0">{totalPending} pending</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-[#9c9794] py-4 text-center">No POs pending a root cause.</p>
      ) : (
        groups.map((g) => {
          const collapsed = collapsedWeeks.has(g.key);
          return (
            <div key={g.key} className="space-y-2">
              <button
                onClick={() => toggleWeek(g.key)}
                className="w-full flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wide text-[#9c9794] pt-1 hover:text-[#403833] transition-colors"
              >
                <span>{g.label} ({g.items.length})</span>
                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              {!collapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {g.items.map((a) => (
                    <ActionCard key={a.id} action={a} onSave={(patch) => updateAction(a.id, patch)} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
