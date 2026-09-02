'use client';

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, X, TrendingUp, Users, CalendarClock, Home, Clock3, Flag, Timer, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useVendorMapping } from '../../hooks/useVendorMapping';
import { useReasonClassification } from '../../hooks/useReasonClassification';
import { isSubstantiveReason } from '../../lib/reasonClassification';
import { formatFilterSummary } from '../../lib/filterSummary';
import { REPORT_LIBRARY, type ReportContext, type ReportDefinition } from '../../lib/reportBuilders';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { loadSavedReports } from '../../lib/savedReports';
import { Sidebar } from '../shell/Sidebar';
import { PageHeader } from '../shell/PageHeader';
import { ReportPreviewPanel } from './ReportPreviewPanel';
import { CustomReportBuilder } from './CustomReportBuilder';
import { SavedReportsTab } from './SavedReportsTab';

type Tab = 'library' | 'builder' | 'saved';

const REPORT_ICONS: Record<string, typeof TrendingUp> = {
  'sot-otif': TrendingUp,
  'supplier-performance': Users,
  'missing-esd': CalendarClock,
  'backlog-overview': Home,
  'backlog-by-supplier': Clock3,
  'root-cause': Flag,
  'lead-time': Timer,
  'invoice-status': FileSpreadsheet,
  'weekly-pack': LayoutDashboard,
};

function ReportCard({ def, onPreview, onExport }: { def: ReportDefinition; onPreview: () => void; onExport: () => void }) {
  const Icon = REPORT_ICONS[def.id] ?? TrendingUp;
  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-start gap-3 mb-2">
        <span className="w-9 h-9 rounded-lg bg-[#fff7ed] text-brand flex items-center justify-center shrink-0"><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#403833]">{def.name}</p>
          <p className="text-[11px] text-[#7b7571] mt-0.5">{def.description}</p>
        </div>
      </div>
      <p className="text-[10px] text-[#9c9794] mt-1 mb-3">Last refreshed: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      <div className="flex items-center gap-2 mt-auto">
        <button onClick={onPreview} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#403833] border border-[#e9e3df] rounded-lg px-3 py-1.5 hover:border-[#403833] transition-colors">
          <Eye size={13} /> Preview
        </button>
        <button onClick={onExport} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors">
          <Download size={13} /> Export Excel
        </button>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { allLines, invoices } = useData();
  const { isChinaSupplier } = useVendorMapping();
  const { filters, setFilters, weekRangeLines, filteredLines, weeksInRange, allSuppliers, curWeek, curYear } = useFilters(allLines);

  const today = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('library');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);

  const linesWithReasons = useMemo(() => filteredLines.filter((l) => isSubstantiveReason(l.lossReasonCode)), [filteredLines]);
  const { classifications } = useReasonClassification(linesWithReasons.map((l) => l.lossReasonCode));

  const ctx: ReportContext = useMemo(() => ({
    filteredLines,
    weekRangeLines,
    weeksInRange,
    isChinaSupplier,
    today,
    invoices,
    classifications,
    filterLabel: `${formatFilterSummary(filters)} · ${weeksInRange[0]?.label ?? ''}–${weeksInRange[weeksInRange.length - 1]?.label ?? ''}`,
    filters,
  }), [filteredLines, weekRangeLines, weeksInRange, isChinaSupplier, today, invoices, classifications, filters]);

  const savedReports = useMemo(() => loadSavedReports(), [savedVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewDef = REPORT_LIBRARY.find((d) => d.id === previewId) ?? null;
  const previewResult = useMemo(() => (previewDef ? previewDef.build(ctx) : null), [previewDef, ctx]);

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your data export.</p>
          <Link to="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
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
          breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Reports' }]}
          filters={filters}
          onChange={setFilters}
          allSuppliers={allSuppliers}
          curWeek={curWeek}
          curYear={curYear}
        />

        <div className="px-5 pt-3 flex items-center gap-1 border-b border-[#e9e3df] shrink-0">
          {([['library', 'Report Library'], ['builder', 'Custom Report Builder'], ['saved', `Saved Reports${savedReports.length ? ` (${savedReports.length})` : ''}`]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-sm font-semibold px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                tab === key ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === 'library' && (
            <div>
              <p className="text-sm font-bold text-[#403833] mb-1">Report Library</p>
              <p className="text-xs text-[#9c9794] mb-3">Run standard reports with your selected filters. Every number reuses the same calculations as the Dashboard.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {REPORT_LIBRARY.map((def) => (
                  <ReportCard
                    key={def.id}
                    def={def}
                    onPreview={() => setPreviewId(def.id)}
                    onExport={() => downloadWorkbook(def.name, def.build(ctx).sheets)}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'builder' && <CustomReportBuilder ctx={ctx} onSaved={() => setSavedVersion((v) => v + 1)} />}

          {tab === 'saved' && <SavedReportsTab reports={savedReports} ctx={ctx} onChange={() => setSavedVersion((v) => v + 1)} />}
        </div>
      </div>

      {previewDef && previewResult && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-6" onClick={() => setPreviewId(null)}>
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9e3df] shrink-0">
              <p className="text-sm font-bold text-[#403833]">{previewDef.name}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadWorkbook(previewDef.name, previewResult.sheets)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors"
                >
                  <Download size={13} /> Export Excel
                </button>
                <button onClick={() => setPreviewId(null)} className="p-1.5 rounded hover:bg-[#f5f2ee] text-[#7b7571]"><X size={16} /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              <ReportPreviewPanel title={previewDef.name} result={previewResult} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
