'use client';

import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { Sidebar } from './shell/Sidebar';
import { PageHeader } from './shell/PageHeader';
import { useFilters } from '../hooks/useFilters';
import { useKPIs } from '../hooks/useKPIs';
import { useVendorMapping } from '../hooks/useVendorMapping';
import { useActions } from '../hooks/useActions';
import { UploadPanel } from './upload/UploadPanel';
import { TopGraphSection } from './sections/TopGraphSection';
import { RootCauseSection } from './sections/RootCauseSection';
import { MissingESDSection } from './sections/MissingESDSection';
import { BacklogSection } from './sections/BacklogSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { LeadTimeSection } from './sections/LeadTimeSection';
import { ActionsBadgeDrawer } from './actions/ActionsBadgeDrawer';
import { ActionsSidePanel } from './actions/ActionsSidePanel';
import type { StatusFilter } from './actions/ActionsTabs';
import { buildSotOtifHref } from '../lib/sotOtifParams';
import { buildRootCauseHref } from '../lib/rootCauseParams';
import { buildMissingEsdHref } from '../lib/missingEsdParams';
import { buildBacklogHref } from '../lib/backlogParams';
import { buildInvoicesHref } from '../lib/invoicesParams';
import { buildLeadTimeHref } from '../lib/leadTimeParams';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';
import type { ActionType } from '../types/actions';

export function Dashboard() {
  const { allLines, setAllLines, invoices, setInvoices, globalFilters, setGlobalFilters } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);
  // Switch between the two Actions UI variants — 'badge' (floating badge + slide-in drawer) or
  // 'panel' (always-visible right panel that shrinks the main content area). Toggled live via
  // the header button below rather than a code constant, so both are actually reachable in the UI.
  const [actionsUiMode, setActionsUiMode] = useState<'badge' | 'panel'>('badge');
  // tab/statusFilter live here (not inside ActionsTabs) so switching between badge and panel mode
  // keeps the same tab and filter selected instead of resetting each time.
  const [actionsTab, setActionsTab] = useState<ActionType>('flag');
  const [actionsStatusFilter, setActionsStatusFilter] = useState<StatusFilter>('open');
  const { actions, runRules, addAction, updateAction } = useActions();

  const { filters, setFilters: _setFilters, filteredLines, weekRangeLines, weeksInRange, allSuppliers, curWeek, curYear } =
    useFilters(allLines, globalFilters);
  const { isChinaSupplier } = useVendorMapping();
  const kpis = useKPIs(weekRangeLines, weeksInRange, isChinaSupplier);

  // POs surviving the supplier/channel/category filters (not the week range) — flags are
  // filtered against this so they respect the same non-date filters as the rest of the dashboard.
  const filteredPOs = useMemo(() => new Set(filteredLines.map((l) => l.po)), [filteredLines]);

  const setFilters = (f: typeof filters) => {
    _setFilters(f);
    setGlobalFilters(f);
  };

  const handleLoad = (lines: PurchaseLine[], inv?: InvoiceRow[]) => {
    setAllLines(lines);
    if (inv) setInvoices(inv);
    runRules(lines);
  };

  const hasData = allLines.length > 0;

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!hasData && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4 page-enter">
            <div className="text-center">
              <p className="text-2xl font-semibold text-[#403833]">No data loaded</p>
              <p className="text-[#9c9794] text-sm mt-2">Upload your Business Central exports to begin the review.</p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="bg-brand text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors"
            >
              Upload BC Files
            </button>
          </div>
        )}

        {hasData && (
          <div className="page-enter flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <PageHeader
                filters={filters}
                onChange={setFilters}
                allSuppliers={allSuppliers}
                curWeek={curWeek}
                curYear={curYear}
                onUpload={() => setUploadOpen(true)}
                actionsUiMode={actionsUiMode}
                onToggleActionsUiMode={() => setActionsUiMode((m) => (m === 'badge' ? 'panel' : 'badge'))}
              />
              <div className={`p-4 flex-1 min-h-0 flex flex-col gap-4 w-full max-w-[1400px] 2xl:max-w-[1680px] mx-auto overflow-y-auto ${actionsUiMode === 'badge' ? 'pb-16' : ''}`}>
                <div style={{ flex: '4 0 300px' }}>
                  <TopGraphSection
                    points={kpis.topGraph}
                    sotTarget={kpis.sotTarget}
                    otifTarget={kpis.otifTarget}
                    drillDownHref={buildSotOtifHref(filters)}
                  />
                </div>
                <div style={{ flex: '3 0 260px' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <RootCauseSection lines={weekRangeLines} weeksInRange={weeksInRange} drillDownHref={buildRootCauseHref(filters)} />
                  <MissingESDSection lines={weekRangeLines} weeksInRange={weeksInRange} drillDownHref={buildMissingEsdHref(filters)} />
                  <BacklogSection lines={filteredLines} drillDownHref={buildBacklogHref(filters)} />
                </div>
                <div style={{ flex: '2 0 220px' }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InvoicesSection invoices={invoices} supplierFilter={filters.suppliers} drillDownHref={buildInvoicesHref(filters.suppliers)} />
                  <LeadTimeSection lines={weekRangeLines} drillDownHref={buildLeadTimeHref(filters)} />
                </div>
              </div>
            </div>
            {actionsUiMode === 'panel' && (
              <ActionsSidePanel
                actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers}
                tab={actionsTab} onTabChange={setActionsTab} statusFilter={actionsStatusFilter} onStatusFilterChange={setActionsStatusFilter}
              />
            )}
          </div>
        )}

        {hasData && actionsUiMode === 'badge' && (
          <ActionsBadgeDrawer
            actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers}
            tab={actionsTab} onTabChange={setActionsTab} statusFilter={actionsStatusFilter} onStatusFilterChange={setActionsStatusFilter}
          />
        )}

        <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
      </div>
    </div>
  );
}
