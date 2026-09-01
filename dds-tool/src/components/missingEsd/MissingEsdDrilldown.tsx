'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { formatDateShort } from '../../lib/dateUtils';
import {
  parseMissingEsdParams, buildMissingEsdParams, type UrgencyFilter,
} from '../../lib/missingEsdParams';
import { computeMissingEsdRows, findConsolidationRisks } from '../../lib/missingEsdAggregation';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { MissingEsdKpiRow } from './MissingEsdKpiRow';
import { MissingEsdUrgencyProfile } from './MissingEsdUrgencyProfile';
import { MissingEsdSupplierExposure } from './MissingEsdSupplierExposure';
import { MissingEsdInsights } from './MissingEsdInsights';
import { MissingEsdTable } from './MissingEsdTable';

export function MissingEsdDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initial = useMemo(() => parseMissingEsdParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { filters, setFilters, weekRangeLines, allSuppliers, curWeek, curYear } =
    useFilters(allLines, initial.filters);

  const [urgency, setUrgency] = useState<UrgencyFilter>(initial.urgency);

  useEffect(() => {
    const params = buildMissingEsdParams(filters, urgency);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, urgency, pathname]);

  const allRows = useMemo(() => computeMissingEsdRows(weekRangeLines), [weekRangeLines]);
  const needingActionRows = useMemo(() => allRows.filter((r) => r.urgency !== 'watchlist'), [allRows]);
  const notUrgentRows = useMemo(() => allRows.filter((r) => r.urgency === 'watchlist'), [allRows]);
  const overdueCount = useMemo(() => allRows.filter((r) => r.urgency === 'overdue').length, [allRows]);

  const scopeRows = urgency === 'urgent' ? needingActionRows : notUrgentRows;
  const risks = useMemo(() => findConsolidationRisks(scopeRows), [scopeRows]);

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your data export.</p>
          <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
            ← Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Missing ESD Detail' }]}
          filters={filters}
          onChange={setFilters}
          allSuppliers={allSuppliers}
          curWeek={curWeek}
          curYear={curYear}
          rightActions={
            <>
              <button
                title="Export (coming soon)"
                disabled
                className="flex items-center gap-1.5 text-xs font-semibold text-[#7b7571] border border-[#e9e3df] rounded-lg px-2.5 h-8 opacity-60 cursor-not-allowed"
              >
                <Download size={13} />
                Export
              </button>
              <button
                title="More options (coming soon)"
                disabled
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#e9e3df] text-[#7b7571] opacity-60 cursor-not-allowed"
              >
                <MoreVertical size={15} />
              </button>
            </>
          }
        />

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <MissingEsdKpiRow
            needingActionCount={needingActionRows.length}
            overdueCount={overdueCount}
            notUrgentCount={notUrgentRows.length}
            totalCount={allRows.length}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-stretch">
            <MissingEsdUrgencyProfile rows={allRows} />
            <MissingEsdInsights rows={allRows} />
          </div>

          <MissingEsdSupplierExposure rows={allRows} />

          {risks.length > 0 && (
            <div className="space-y-2">
              {risks.map((risk) => (
                <div key={`${risk.supplier}__${risk.egrd.toDateString()}`} className="bg-[#FFF3E0] border border-[#f0b95c] rounded-lg px-4 py-2.5 text-sm text-[#403833]">
                  ⚠ {risk.supplier} — {risk.poCount} unbooked POs due EGRD {formatDateShort(risk.egrd)}, pickup likely delayed to Monday.
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center gap-1 mb-3">
              {(['urgent', 'watchlist'] as UrgencyFilter[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={`text-sm font-semibold px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    urgency === u ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'
                  }`}
                >
                  {u === 'urgent' ? `Needing Action (${needingActionRows.length})` : `Not Urgent (${notUrgentRows.length})`}
                </button>
              ))}
            </div>
            <MissingEsdTable rows={scopeRows} />
          </div>
        </div>
      </div>
    </div>
  );
}
