'use client';

import { useMemo, useState } from 'react';
import { Save, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  APPROVED_METRICS, buildCustomReport, DEFAULT_REPORT_CONFIG, LINE_FIELDS, LINE_FIELD_LABELS,
  type CustomReportConfig, type GroupById, type MetricId, type ReportContext, type LineFieldId, type TimeBasis,
} from '../../lib/reportBuilders';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { saveSavedReport } from '../../lib/savedReports';
import type { Channel } from '../../lib/channelUtils';
import type { SKUCategory } from '../../lib/skuUtils';
import { VendorDropdown } from '../shared/VendorDropdown';
import { ChannelDropdown } from '../shared/ChannelDropdown';
import { CategoryDropdown } from '../shared/CategoryDropdown';
import { MultiCheckDropdown } from '../leadTime/MultiCheckDropdown';
import { Seg } from '../shared/Seg';
import { ReportPreviewPanel } from './ReportPreviewPanel';

interface CustomReportBuilderProps {
  ctx: ReportContext;
  onSaved: () => void;
}

const METRIC_GROUPS = [...new Set(APPROVED_METRICS.map((m) => m.group))];
const TIME_BASIS_OPTIONS: { value: TimeBasis; label: string }[] = [
  { value: 'pgrd', label: 'PGRD' }, { value: 'egrd', label: 'EGRD' }, { value: 'esd', label: 'ESD' }, { value: 'asd', label: 'ASD' },
];
const STEPS = ['Scope', 'Time', 'Data level', 'Fields & calculations', 'Aggregation', 'Visualizations', 'Preview & export'] as const;

// A guided 7-step builder, not a BI canvas: every choice below maps 1:1 onto an existing approved
// calculation or raw field — Scope/Time/Level/Aggregation only decide WHICH lines a report runs
// over and how they're grouped, never what a metric formula means (reportBuilders.ts's
// metricValue() is the single source of truth for that, untouched here).
export function CustomReportBuilder({ ctx, onSaved }: CustomReportBuilderProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<CustomReportConfig>(DEFAULT_REPORT_CONFIG);
  const [saveName, setSaveName] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const availableSuppliers = useMemo(() => [...new Set(ctx.filteredLines.map((l) => l.supplier))].sort(), [ctx.filteredLines]);
  const availableWarehouses = useMemo(() => [...new Set(ctx.filteredLines.map((l) => l.destination))].sort(), [ctx.filteredLines]);

  const result = useMemo(() => buildCustomReport(config, ctx), [config, ctx]);

  const patchScope = (patch: Partial<CustomReportConfig['scope']>) => setConfig((c) => ({ ...c, scope: { ...c.scope, ...patch } }));
  const toggleMetric = (id: MetricId) => setConfig((c) => ({ ...c, metrics: c.metrics.includes(id) ? c.metrics.filter((m) => m !== id) : [...c.metrics, id] }));
  const toggleField = (id: LineFieldId) => setConfig((c) => ({ ...c, fields: c.fields.includes(id) ? c.fields.filter((f) => f !== id) : [...c.fields, id] }));

  const handleSave = () => {
    const name = saveName.trim() || `Custom report — ${new Date().toLocaleDateString()}`;
    saveSavedReport(name, config, ctx.filterLabel);
    setSaveName('');
    setSavedMsg(`Saved as "${name}"`);
    onSaved();
    setTimeout(() => setSavedMsg(null), 3000);
  };

  const canPreview = config.structure === 'detailed' || config.metrics.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[32%_1fr] gap-4 h-full min-h-0">
      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 overflow-y-auto flex flex-col">
        <div className="flex items-center gap-1 mb-4 shrink-0 overflow-x-auto pb-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border transition-colors ${
                i === step ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#9c9794] hover:border-[#403833]'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">{i + 1}</span>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Select the scope for your report</p>
              <p className="text-[11px] text-[#9c9794]">Narrows the dashboard's current filter selection further — it can't widen it.</p>
              <div className="grid grid-cols-2 gap-2">
                <VendorDropdown allSuppliers={availableSuppliers} selected={config.scope.suppliers} onChange={(s) => patchScope({ suppliers: s })} />
                <ChannelDropdown selected={config.scope.channels as Channel[]} onChange={(s) => patchScope({ channels: s })} />
                <CategoryDropdown selected={config.scope.categories as SKUCategory[]} onChange={(s) => patchScope({ categories: s })} />
                <MultiCheckDropdown label="Warehouses" emptyLabel="All warehouses" options={availableWarehouses} selected={config.scope.warehouses} onChange={(s) => patchScope({ warehouses: s })} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794]">Specific SKU (optional)</label>
                <input
                  value={config.scope.skuSearch}
                  onChange={(e) => patchScope({ skuSearch: e.target.value })}
                  placeholder="Search SKU code…"
                  className="mt-1 w-full text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Time basis</p>
              <p className="text-[11px] text-[#9c9794]">Which date field defines this report's period and weekly grouping.</p>
              <Seg options={TIME_BASIS_OPTIONS} value={config.timeBasis} onChange={(v) => setConfig((c) => ({ ...c, timeBasis: v }))} />
              <div className="border-t border-[#f4f1ef] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9c9794] mb-1">Period</p>
                <p className="text-xs text-[#403833]">{ctx.filterLabel.split('·').pop()?.trim()}</p>
                <p className="text-[10px] text-[#9c9794] mt-1">Follows the dashboard's week-range filter — change it in the top bar.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Data level</p>
              <div className="flex gap-2">
                {(['po', 'line'] as const).map((l) => (
                  <button
                    key={l}
                    disabled={config.structure === 'detailed'}
                    onClick={() => setConfig((c) => ({ ...c, level: l }))}
                    className={`flex-1 text-xs font-bold px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      config.level === l ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'
                    }`}
                  >
                    {l === 'po' ? 'PO LEVEL' : 'LINE LEVEL'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#9c9794]">
                {config.structure === 'detailed'
                  ? 'Detailed exports are always one row per PO line.'
                  : config.level === 'po'
                    ? 'One row per Purchase Order. All metrics are always calculated by distinct PO.'
                    : 'Adds a Line Detail sheet to the export. Grouped metrics still count distinct POs, never lines.'}
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Structure</p>
              <div className="flex gap-2">
                {(['aggregated', 'detailed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setConfig((c) => ({ ...c, structure: s }))}
                    className={`flex-1 text-xs font-bold px-3 py-2 rounded-lg border transition-colors capitalize ${
                      config.structure === s ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {config.structure === 'aggregated' ? (
                <>
                  <p className="text-xs font-bold text-[#403833] uppercase tracking-wide pt-1">Calculations <span className="text-[10px] font-normal normal-case text-[#9c9794]">(approved only)</span></p>
                  <div className="space-y-3">
                    {METRIC_GROUPS.map((group) => (
                      <div key={group}>
                        <p className="text-[10px] font-semibold text-[#9c9794] uppercase tracking-wide mb-1">{group}</p>
                        <div className="space-y-1">
                          {APPROVED_METRICS.filter((m) => m.group === group).map((m) => (
                            <label key={m.id} className="flex items-center gap-2 text-xs text-[#403833] cursor-pointer">
                              <input type="checkbox" checked={config.metrics.includes(m.id)} onChange={() => toggleMetric(m.id)} className="accent-brand" />
                              {m.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-[#403833] uppercase tracking-wide pt-1">Fields</p>
                  <div className="grid grid-cols-2 gap-1">
                    {LINE_FIELDS.map((f) => (
                      <label key={f} className="flex items-center gap-2 text-xs text-[#403833] cursor-pointer">
                        <input type="checkbox" checked={config.fields.includes(f)} onChange={() => toggleField(f)} className="accent-brand" />
                        {LINE_FIELD_LABELS[f]}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#9c9794]">No aggregation, no charts — a polished raw data table exactly as selected.</p>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Group by</p>
              {config.structure === 'detailed' ? (
                <p className="text-[11px] text-[#9c9794]">Detailed reports skip grouping entirely — not applicable.</p>
              ) : (
                <div className="flex gap-2">
                  {(['supplier', 'week'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setConfig((c) => ({ ...c, groupBy: g as GroupById }))}
                      className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors capitalize ${
                        config.groupBy === g ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Visualizations</p>
              <p className="text-[11px] text-[#9c9794]">KPI cards and the data table are always included. Charts are optional.</p>
              <label className={`flex items-center gap-2 text-xs cursor-pointer ${config.structure === 'detailed' || config.groupBy !== 'week' ? 'opacity-40 cursor-not-allowed' : 'text-[#403833]'}`}>
                <input
                  type="checkbox"
                  disabled={config.structure === 'detailed' || config.groupBy !== 'week'}
                  checked={config.includeChart}
                  onChange={(e) => setConfig((c) => ({ ...c, includeChart: e.target.checked }))}
                  className="accent-brand"
                />
                Weekly evolution line chart (Summary sheet)
              </label>
              {config.groupBy !== 'week' && config.structure === 'aggregated' && (
                <p className="text-[10px] text-[#9c9794]">Only available when grouping by week.</p>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="border-t border-[#f4f1ef] pt-3">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">Save report</p>
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
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-3 border-t border-[#f4f1ef] shrink-0">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-xs font-semibold text-[#58524e] px-3 py-1.5 rounded-lg border border-[#e9e3df] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#403833]"
          >
            <ChevronLeft size={13} /> Back
          </button>
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={step === STEPS.length - 1}
            className="flex items-center gap-1 text-xs font-semibold text-white bg-[#403833] px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2f2925]"
          >
            Next: {STEPS[Math.min(STEPS.length - 1, step + 1)]} <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="bg-[#f5f2ee] rounded-lg border border-[#e9e3df] p-4 overflow-y-auto flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <p className="text-sm font-bold text-[#403833]">Report Preview</p>
          <button
            onClick={() => downloadWorkbook('Custom Report', result.sheets)}
            disabled={!canPreview}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} /> Export Excel
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!canPreview ? (
            <p className="text-xs text-[#9c9794]">Select at least one calculation to preview the report.</p>
          ) : (
            <ReportPreviewPanel title="Custom Report" result={result} />
          )}
        </div>
      </div>
    </div>
  );
}
