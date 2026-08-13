'use client';

import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { NavTabs } from './shared/NavTabs';
import { useFilters } from '../hooks/useFilters';
import { useKPIs } from '../hooks/useKPIs';
import { useVendorMapping } from '../hooks/useVendorMapping';
import { useActions } from '../hooks/useActions';
import { UploadPanel } from './upload/UploadPanel';
import { GlobalFilterBar } from './shared/GlobalFilterBar';
import { TopGraphSection } from './sections/TopGraphSection';
import { RootCauseSection } from './sections/RootCauseSection';
import { MissingESDSection } from './sections/MissingESDSection';
import { BacklogSection } from './sections/BacklogSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { LeadTimeSection } from './sections/LeadTimeSection';
import { ActionsBadgeDrawer } from './actions/ActionsBadgeDrawer';
import { ActionsSidePanel } from './actions/ActionsSidePanel';
import { formatFilterSummary } from '../lib/filterSummary';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';

export function Dashboard() {
  const { allLines, setAllLines, invoices, setInvoices, globalFilters, setGlobalFilters } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);
  // Switch between the two Actions UI variants — 'badge' (floating badge + slide-in drawer) or
  // 'panel' (always-visible right panel that shrinks the main content area). Toggled live via
  // the header button below rather than a code constant, so both are actually reachable in the UI.
  const [actionsUiMode, setActionsUiMode] = useState<'badge' | 'panel'>('badge');
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
    <div className="h-screen w-full bg-[#f5f2ee] flex flex-col overflow-hidden">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 shrink-0">
        <img src="/emma-logo.svg" alt="emma" className="h-6 w-auto shrink-0" />
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        {hasData && (
          <span className="text-xs text-[#7b7571] font-medium truncate">{formatFilterSummary(filters)}</span>
        )}
        <div className="flex-1" />
        {hasData && (
          <button
            onClick={() => setActionsUiMode((m) => (m === 'badge' ? 'panel' : 'badge'))}
            title="Switch Actions UI variant"
            className="text-xs border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] hover:border-brand hover:text-brand shrink-0"
          >
            Actions: {actionsUiMode === 'badge' ? 'Badge' : 'Panel'}
          </button>
        )}
        <button onClick={() => setUploadOpen(true)} className="filter-pill text-xs border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] hover:border-brand hover:text-brand shrink-0">
          ↑ Upload
        </button>
      </header>

      {!hasData && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4 page-enter">
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
          <div className="flex-1 min-w-0 flex flex-col">
            <GlobalFilterBar filters={filters} onChange={setFilters} allSuppliers={allSuppliers} curWeek={curWeek} curYear={curYear} />
            <div className="px-4 py-3 flex-1 min-h-0 flex flex-col gap-3 w-full max-w-[1400px] mx-auto overflow-hidden">
              <div className="flex-[5] min-h-0 overflow-hidden">
                <TopGraphSection
                  points={kpis.topGraph}
                  deepDiveRows={kpis.deepDiveRows}
                  sotTarget={kpis.sotTarget}
                  otifTarget={kpis.otifTarget}
                />
              </div>
              <div className="flex-[3] min-h-0 grid grid-cols-3 gap-3 overflow-hidden">
                <RootCauseSection lines={weekRangeLines} weeksInRange={weeksInRange} />
                <MissingESDSection lines={weekRangeLines} weeksInRange={weeksInRange} supplierFilterActive={filters.suppliers.length > 0} />
                <BacklogSection lines={filteredLines} />
              </div>
              <div className="flex-[2] min-h-0 grid grid-cols-2 gap-3 overflow-hidden">
                <InvoicesSection invoices={invoices} supplierFilter={filters.suppliers} />
                <LeadTimeSection lines={weekRangeLines} />
              </div>
            </div>
          </div>
          {actionsUiMode === 'panel' && (
            <ActionsSidePanel actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers} />
          )}
        </div>
      )}

      {hasData && actionsUiMode === 'badge' && (
        <ActionsBadgeDrawer actions={actions} onSave={updateAction} onAddOpenPoint={addAction} filteredPOs={filteredPOs} allSuppliers={allSuppliers} />
      )}

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
    </div>
  );
}
