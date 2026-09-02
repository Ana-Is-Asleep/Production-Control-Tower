'use client';

import { useState } from 'react';
import { Copy, Trash2, Eye, Download } from 'lucide-react';
import { buildCustomReport, type ReportContext } from '../../lib/reportBuilders';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { deleteSavedReport, duplicateSavedReport, type SavedReport } from '../../lib/savedReports';
import { ReportPreviewPanel } from './ReportPreviewPanel';

interface SavedReportsTabProps {
  reports: SavedReport[];
  ctx: ReportContext;
  onChange: () => void;
}

// Reopening a saved report reruns its stored CONFIG (level/group/metrics) against whatever data
// is currently loaded — never a frozen snapshot, and never a stored formula.
export function SavedReportsTab({ reports, ctx, onChange }: SavedReportsTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (reports.length === 0) {
    return <p className="text-sm text-[#9c9794] text-center py-12">No saved reports yet — build one in Custom Report Builder and save it.</p>;
  }

  const open = reports.find((r) => r.id === openId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className={`bg-white rounded-lg border p-3 ${openId === r.id ? 'border-brand' : 'border-[#e9e3df]'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#403833] truncate">{r.name}</p>
                <p className="text-[10px] text-[#9c9794] mt-0.5">
                  {r.config.level === 'po' ? 'PO Level' : 'Line Level'} · Group by {r.config.groupBy} · {r.config.metrics.length} metric{r.config.metrics.length === 1 ? '' : 's'}
                </p>
                <p className="text-[10px] text-[#c8c0bb] mt-0.5">Saved {new Date(r.createdAt).toLocaleDateString()} · {r.filterLabel}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button title="Open" onClick={() => setOpenId(r.id)} className="p-1.5 rounded hover:bg-[#f5f2ee] text-[#58524e]"><Eye size={14} /></button>
                <button title="Duplicate" onClick={() => { duplicateSavedReport(r.id); onChange(); }} className="p-1.5 rounded hover:bg-[#f5f2ee] text-[#58524e]"><Copy size={14} /></button>
                <button title="Delete" onClick={() => { deleteSavedReport(r.id); if (openId === r.id) setOpenId(null); onChange(); }} className="p-1.5 rounded hover:bg-fail-bg text-fail"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#f5f2ee] rounded-lg border border-[#e9e3df] p-4 min-h-[200px]">
        {!open ? (
          <p className="text-xs text-[#9c9794] text-center py-8">Select a saved report to preview it.</p>
        ) : (
          <>
            <div className="flex items-center justify-end mb-3">
              <button
                onClick={() => downloadWorkbook(open.name, buildCustomReport(open.config, ctx).sheets)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors"
              >
                <Download size={13} /> Export Excel
              </button>
            </div>
            <ReportPreviewPanel title={open.name} result={buildCustomReport(open.config, ctx)} />
          </>
        )}
      </div>
    </div>
  );
}
