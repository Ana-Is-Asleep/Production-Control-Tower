'use client';

import { useMemo, useState } from 'react';
import { Save, Download } from 'lucide-react';
import { APPROVED_METRICS, buildCustomReport, type CustomReportConfig, type GroupById, type MetricId, type ReportContext } from '../../lib/reportBuilders';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { saveSavedReport } from '../../lib/savedReports';
import { ReportPreviewPanel } from './ReportPreviewPanel';

interface CustomReportBuilderProps {
  ctx: ReportContext;
  onSaved: () => void;
}

const METRIC_GROUPS = [...new Set(APPROVED_METRICS.map((m) => m.group))];

// A guided builder, not a BI canvas: Level + Group By + approved Metrics only. There is no
// formula editor and no way to define a new metric — every checkbox here maps 1:1 to an existing
// approved calculation (see reportBuilders.ts's metricValue()).
export function CustomReportBuilder({ ctx, onSaved }: CustomReportBuilderProps) {
  const [level, setLevel] = useState<'po' | 'line'>('po');
  const [groupBy, setGroupBy] = useState<GroupById>('supplier');
  const [metrics, setMetrics] = useState<MetricId[]>(['pos_in_scope', 'sot_pct', 'otif_pct']);
  const [saveName, setSaveName] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const config: CustomReportConfig = { level, groupBy, metrics };
  const result = useMemo(() => buildCustomReport(config, ctx), [config, ctx]);

  const toggleMetric = (id: MetricId) => {
    setMetrics((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const handleSave = () => {
    const name = saveName.trim() || `Custom report — ${new Date().toLocaleDateString()}`;
    saveSavedReport(name, config, ctx.filterLabel);
    setSaveName('');
    setSavedMsg(`Saved as "${name}"`);
    onSaved();
    setTimeout(() => setSavedMsg(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[32%_1fr] gap-4 h-full min-h-0">
      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 overflow-y-auto space-y-5">
        <div>
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">1. Data Level</p>
          <div className="flex gap-2">
            {(['po', 'line'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`flex-1 text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
                  level === l ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'
                }`}
              >
                {l === 'po' ? 'PO LEVEL' : 'LINE LEVEL'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#9c9794] mt-1.5">
            {level === 'po'
              ? 'One row per Purchase Order. All metrics are always calculated by distinct PO.'
              : 'Adds a Line Detail sheet to the export. Grouped metrics still count distinct POs, never lines — switching level never changes a KPI\'s value.'}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">2. Group By</p>
          <div className="flex gap-2">
            {(['supplier', 'week'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors capitalize ${
                  groupBy === g ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">3. Metrics <span className="text-[10px] font-normal normal-case text-[#9c9794]">(approved only)</span></p>
          <div className="space-y-3">
            {METRIC_GROUPS.map((group) => (
              <div key={group}>
                <p className="text-[10px] font-semibold text-[#9c9794] uppercase tracking-wide mb-1">{group}</p>
                <div className="space-y-1">
                  {APPROVED_METRICS.filter((m) => m.group === group).map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-[#403833] cursor-pointer">
                      <input type="checkbox" checked={metrics.includes(m.id)} onChange={() => toggleMetric(m.id)} className="accent-brand" />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#f4f1ef] pt-3">
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">Save Report</p>
          <div className="flex gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Report name…"
              className="flex-1 text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5"
            />
            <button onClick={handleSave} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors">
              <Save size={13} /> Save
            </button>
          </div>
          {savedMsg && <p className="text-[11px] text-pass mt-1.5">{savedMsg}</p>}
        </div>
      </div>

      <div className="bg-[#f5f2ee] rounded-lg border border-[#e9e3df] p-4 overflow-y-auto flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <p className="text-sm font-bold text-[#403833]">Report Preview</p>
          <button
            onClick={() => downloadWorkbook('Custom Report', result.sheets)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors"
          >
            <Download size={13} /> Export Excel
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {metrics.length === 0 ? (
            <p className="text-xs text-[#9c9794]">Select at least one metric to preview the report.</p>
          ) : (
            <ReportPreviewPanel title="Custom Report" result={result} />
          )}
        </div>
      </div>
    </div>
  );
}
