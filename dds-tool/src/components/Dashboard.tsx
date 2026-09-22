'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { StatusFilter } from './actions/ActionsTabs';
import { buildSotOtifHref } from '../lib/sotOtifParams';
import { buildRootCauseHref } from '../lib/rootCauseParams';
import { buildMissingEsdHref } from '../lib/missingEsdParams';
import { buildBacklogHref } from '../lib/backlogParams';
import { buildInvoicesHref } from '../lib/invoicesParams';
import { buildLeadTimeHref } from '../lib/leadTimeParams';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';
import type { InvoiceParseMeta } from '../lib/invoiceParser';
import type { ActionType } from '../types/actions';

export function Dashboard() {
  const { allLines, setAllLines, invoices, setInvoices, setInvoiceMeta, globalFilters, setGlobalFilters } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actionsDrawerOpen, setActionsDrawerOpen] = useState(false);
  const [actionsTab, setActionsTab] = useState<ActionType>('flag');
  const [actionsStatusFilter, setActionsStatusFilter] = useState<StatusFilter>('open');
  const { actions, runRules, addAction, updateAction } = useActions();

  const { filters, setFilters: _setFilters, cleanedLines, filteredLines, weekRangeLines, weeksInRange, allSuppliers, curWeek, curYear } =
    useFilters(allLines, globalFilters);
  const { isChinaSupplier } = useVendorMapping();
  const kpis = useKPIs(weekRangeLines, filteredLines, weeksInRange, isChinaSupplier);

  // POs surviving the supplier/channel/category filters (not the week range) — flags are
  // filtered against this so they respect the same non-date filters as the rest of the dashboard.
  const filteredPOs = useMemo(() => new Set(filteredLines.map((l) => l.po)), [filteredLines]);

  const setFilters = (f: typeof filters) => {
    _setFilters(f);
    setGlobalFilters(f);
  };

  const handleLoad = (lines: PurchaseLine[], inv?: InvoiceRow[], invMeta?: InvoiceParseMeta) => {
    setAllLines(lines);
    if (inv) setInvoices(inv);
    if (invMeta) setInvoiceMeta(invMeta);
  };

  // Runs against the same cleaned pool every KPI/section uses (2026+, no Comps/Other SKUs, no
  // same-site transfers) — not the raw upload — so flags never fire for POs the rest of the app
  // already treats as out of scope (e.g. Marketing POs whose SKUs categorize as Comps/Other).
  // A useEffect (not the handleLoad call site) because cleanedLines depends on the vendor mapping,
  // which loads asynchronously and lags one render behind the raw upload.
  useEffect(() => {
    if (cleanedLines.length > 0) runRules(cleanedLines, isChinaSupplier);
  }, [cleanedLines, runRules, isChinaSupplier]);

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
            <div
              className="flex-1 min-w-0 flex flex-col overflow-hidden transition-[padding] duration-150"
              style={actionsDrawerOpen ? { paddingRight: 416 } : undefined}
            >
              <PageHeader
                filters={filters}
                onChange={setFilters}
                allSuppliers={allSuppliers}
                curWeek={curWeek}
                curYear={curYear}
                showCurrentWeek
                compact={actionsDrawerOpen}
                centerContent={
                  <ActionsBadgeDrawer
                    actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers} filters={filters}
                    tab={actionsTab} onTabChange={setActionsTab} statusFilter={actionsStatusFilter} onStatusFilterChange={setActionsStatusFilter}
                    open={actionsDrawerOpen} onOpenChange={setActionsDrawerOpen}
                  />
                }
              />
              <div className="p-1.5 flex-1 min-h-0 flex flex-col gap-1.5 w-full overflow-y-auto">
                <div style={{ flex: '3 1 140px' }} className="min-h-0">
                  <TopGraphSection
                    points={kpis.topGraph}
                    sotTarget={kpis.sotTarget}
                    otifTarget={kpis.otifTarget}
                    drillDownHref={buildSotOtifHref(filters)}
                  />
                </div>
                <div style={{ flex: '4 1 150px', gridTemplateRows: 'minmax(150px, 1fr)' }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 min-h-0">
                  <RootCauseSection lines={filteredLines} drillDownHref={buildRootCauseHref(filters)} />
                  <MissingESDSection lines={filteredLines} drillDownHref={buildMissingEsdHref(filters)} />
                  <BacklogSection lines={filteredLines} drillDownHref={buildBacklogHref(filters)} />
                </div>
                <div style={{ flex: '2 1 115px', gridTemplateRows: 'minmax(115px, 1fr)' }} className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 min-h-0">
                  <InvoicesSection invoices={invoices} supplierFilter={filters.suppliers} drillDownHref={buildInvoicesHref(filters.suppliers)} />
                  <LeadTimeSection lines={weekRangeLines} drillDownHref={buildLeadTimeHref(filters)} />
                </div>
              </div>
            </div>
          </div>
        )}

        <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
      </div>
    </div>
  );
}
