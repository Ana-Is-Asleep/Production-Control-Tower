'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { formatFilterSummary } from '../../lib/filterSummary';
import { formatDateShort } from '../../lib/dateUtils';
import {
  parseMissingEsdParams, buildMissingEsdParams, type UrgencyFilter,
} from '../../lib/missingEsdParams';
import { computeMissingEsdRows, findConsolidationRisks } from '../../lib/missingEsdAggregation';
import { MissingEsdTable } from './MissingEsdTable';

export function MissingEsdDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initial = useMemo(() => parseMissingEsdParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  // read-only: this page inherits the dashboard's filters, it never changes them
  const { filters, weekRangeLines } = useFilters(allLines, initial.filters);

  const [urgency, setUrgency] = useState<UrgencyFilter>(initial.urgency);

  useEffect(() => {
    const params = buildMissingEsdParams(filters, urgency);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, urgency, pathname]);

  const allRows = useMemo(() => computeMissingEsdRows(weekRangeLines), [weekRangeLines]);
  const urgentRows = useMemo(() => allRows.filter((r) => r.urgency !== 'watchlist'), [allRows]);
  const overdueCount = useMemo(() => allRows.filter((r) => r.urgency === 'overdue').length, [allRows]);

  const scopeRows = useMemo(
    () => (urgency === 'urgent' ? allRows.filter((r) => r.urgency !== 'watchlist') : allRows.filter((r) => r.urgency === 'watchlist')),
    [allRows, urgency]
  );

  const risks = useMemo(() => findConsolidationRisks(scopeRows), [scopeRows]);

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
        <p className="text-sm text-[#9c9794]">Go back to the overview and upload your data export.</p>
        <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
          ← Back to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex flex-col overflow-hidden">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-[#403833] hover:text-brand transition-colors shrink-0">
          <span>←</span> Overview
        </Link>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">Missing ESD Detail</span>
        <span className="text-[#e9e3df]">|</span>
        <span className="text-xs text-[#7b7571] truncate">Filtered by: {formatFilterSummary(filters)}</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2">
          <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1">Needing Action (today + 3 wks)</p>
            <p className="font-extrabold text-2xl leading-none text-[#403833]">{urgentRows.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-[#e9e3df] px-4 py-3 flex-1 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1">Overdue</p>
            <p className="font-extrabold text-2xl leading-none" style={{ color: '#dc2626' }}>{overdueCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(['urgent', 'watchlist'] as UrgencyFilter[]).map((u) => (
            <button
              key={u}
              onClick={() => setUrgency(u)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                urgency === u ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'
              }`}
            >
              {u === 'urgent' ? 'Urgent' : 'Not Urgent (Watchlist)'}
            </button>
          ))}
        </div>

        {risks.length > 0 && (
          <div className="space-y-2">
            {risks.map((risk) => (
              <div key={`${risk.supplier}__${risk.egrd.toDateString()}`} className="bg-[#FFF3E0] border border-[#f0b95c] rounded-lg px-4 py-2.5 text-sm text-[#403833]">
                ⚠ {risk.supplier} — {risk.poCount} unbooked POs due EGRD {formatDateShort(risk.egrd)}, pickup likely delayed to Monday.
              </div>
            ))}
          </div>
        )}

        <MissingEsdTable rows={scopeRows} />
      </div>
    </div>
  );
}
