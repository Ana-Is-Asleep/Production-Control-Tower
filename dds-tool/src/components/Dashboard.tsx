'use client';

import { useState } from 'react';
import { useData } from '../context/DataContext';
import { NavTabs } from './shared/NavTabs';
import { useFilters } from '../hooks/useFilters';
import { useKPIs } from '../hooks/useKPIs';
import { useVendorMapping } from '../hooks/useVendorMapping';
import { UploadPanel } from './upload/UploadPanel';
import { GlobalFilterBar } from './shared/GlobalFilterBar';
import { TopGraphSection } from './sections/TopGraphSection';
import { RootCauseSection } from './sections/RootCauseSection';
import { formatFilterSummary } from '../lib/filterSummary';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';

// NOTE: Root Cause, Missing ESD, Backlog, Invoices and Lead Time sections are added
// incrementally in follow-up commits as each is rebuilt.
export function Dashboard() {
  const { allLines, setAllLines, invoices, setInvoices, globalFilters, setGlobalFilters } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { filters, setFilters: _setFilters, filteredLines, weekRangeLines, weeksInRange, allSuppliers } =
    useFilters(allLines, globalFilters);
  const { isChinaSupplier } = useVendorMapping();
  const kpis = useKPIs(weekRangeLines, weeksInRange, isChinaSupplier);

  const setFilters = (f: typeof filters) => {
    _setFilters(f);
    setGlobalFilters(f);
  };

  const handleLoad = (lines: PurchaseLine[], inv?: InvoiceRow[]) => {
    setAllLines(lines);
    if (inv) setInvoices(inv);
  };

  const hasData = allLines.length > 0;

  return (
    <div className="min-h-screen w-full bg-[#f5f2ee]">
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-bold text-brand text-xl shrink-0 tracking-tight">emma<span className="text-[#403833]">.</span></span>
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        {hasData && (
          <span className="text-xs text-[#7b7571] font-medium truncate">{formatFilterSummary(filters)}</span>
        )}
        <div className="flex-1" />
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
        <div className="page-enter">
          <GlobalFilterBar filters={filters} onChange={setFilters} allSuppliers={allSuppliers} />
          <div className="px-4 py-3 space-y-3">
            <TopGraphSection
              points={kpis.topGraph}
              deepDiveRows={kpis.deepDiveRows}
              sotTarget={kpis.sotTarget}
              otifTarget={kpis.otifTarget}
            />
            <RootCauseSection lines={weekRangeLines} weeksInRange={weeksInRange} />
            <p className="text-xs text-[#9c9794]">
              {filteredLines.length.toLocaleString()} total filtered lines · {invoices.length.toLocaleString()} invoice rows
            </p>
            {/* Missing ESD, Backlog, Invoices and Lead Time sections mount here — see follow-up commits */}
          </div>
        </div>
      )}

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
    </div>
  );
}
