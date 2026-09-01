'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, MoreVertical } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { formatDateShort, currentISOWeek } from '../../lib/dateUtils';
import {
  parseMissingEsdParams, buildMissingEsdParams, type UrgencyFilter,
} from '../../lib/missingEsdParams';
import { computeMissingEsdRows, findConsolidationRisks, EGRD_NEEDING_ACTION_WEEKS } from '../../lib/missingEsdAggregation';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { MissingEsdKpiRow } from './MissingEsdKpiRow';
import { MissingEsdEgrdChart } from './MissingEsdEgrdChart';
import { MissingEsdSupplierExposure } from './MissingEsdSupplierExposure';
import { MissingEsdInsights } from './MissingEsdInsights';
import { MissingEsdTable } from './MissingEsdTable';

function bucketGroup(key: string): 'needing' | 'not_urgent' {
  if (key === 'overdue') return 'needing';
  if (key.startsWith('w')) return Number(key.slice(1)) < EGRD_NEEDING_ACTION_WEEKS ? 'needing' : 'not_urgent';
  return 'not_urgent';
}

export function MissingEsdDrilldown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allLines } = useData();

  const initial = useMemo(() => parseMissingEsdParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Missing ESD is a current-state view, not a snapshot: filteredLines (supplier/category/channel
  // only) is used instead of weekRangeLines, so there's no PGRD week-range restriction here.
  const { filters, setFilters, filteredLines, allSuppliers, curWeek: sotCurWeek, curYear: sotCurYear } =
    useFilters(allLines, initial.filters);

  // the actual current ISO week (not the "last completed week" useFilters anchors SOT/OTIF
  // scoring to) — EGRD-week buckets are forward-looking from today, not lagged by a week
  const { week: curWeek, year: curYear } = useMemo(() => currentISOWeek(), []);

  const [urgency, setUrgency] = useState<UrgencyFilter>(initial.urgency);
  const [selectedBucketKeys, setSelectedBucketKeys] = useState<string[] | null>(null);

  useEffect(() => {
    const params = buildMissingEsdParams(filters, urgency);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, urgency, pathname]);

  const allRows = useMemo(() => computeMissingEsdRows(filteredLines), [filteredLines]);
  const needingActionRows = useMemo(() => allRows.filter((r) => r.urgency !== 'watchlist'), [allRows]);
  const notUrgentRows = useMemo(() => allRows.filter((r) => r.urgency === 'watchlist'), [allRows]);
  const overdueCount = useMemo(() => allRows.filter((r) => r.urgency === 'overdue').length, [allRows]);

  const scopeRows = urgency === 'urgent' ? needingActionRows : notUrgentRows;
  const risks = useMemo(() => findConsolidationRisks(scopeRows), [scopeRows]);

  const handleTabChange = (u: UrgencyFilter) => {
    setUrgency(u);
    setSelectedBucketKeys(null);
  };

  const handleChartSelect = (key: string | null) => {
    if (key === null) {
      setSelectedBucketKeys(null);
      return;
    }
    setUrgency(bucketGroup(key) === 'needing' ? 'urgent' : 'watchlist');
    setSelectedBucketKeys([key]);
  };

  const handleSupplierClick = (supplier: string) => {
    setFilters({ ...filters, suppliers: [supplier] });
  };

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
          curWeek={sotCurWeek}
          curYear={sotCurYear}
          showWeekRange={false}
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-6">
              <MissingEsdEgrdChart
                rows={allRows}
                curWeek={curWeek}
                curYear={curYear}
                selectedBucketKeys={selectedBucketKeys}
                onSelectBucket={handleChartSelect}
              />
            </div>
            <div className="lg:col-span-4">
              <MissingEsdSupplierExposure rows={allRows} onSupplierClick={handleSupplierClick} />
            </div>
            <div className="lg:col-span-2">
              <MissingEsdInsights rows={allRows} curWeek={curWeek} curYear={curYear} />
            </div>
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

          <div>
            <div className="flex items-center gap-1 mb-3">
              {(['urgent', 'watchlist'] as UrgencyFilter[]).map((u) => (
                <button
                  key={u}
                  onClick={() => handleTabChange(u)}
                  className={`text-sm font-semibold px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    urgency === u ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'
                  }`}
                >
                  {u === 'urgent' ? `Needing Action (${needingActionRows.length})` : `Not Urgent (${notUrgentRows.length})`}
                </button>
              ))}
            </div>
            <MissingEsdTable
              rows={scopeRows}
              tab={urgency}
              curWeek={curWeek}
              curYear={curYear}
              selectedBucketKeys={selectedBucketKeys}
              onSelectBucketKeys={setSelectedBucketKeys}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
