'use client';

import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { computeKPI } from '../lib/kpiFormulas';
import { categorizeSKU } from '../lib/skuUtils';
import { formatDateShort } from '../lib/dateUtils';
import type { PurchaseLine, ReasonCode } from '../types';

const REASON_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'supplier_delay',        label: 'Supplier delay' },
  { value: 'capacity_constraints',  label: 'Capacity constraints' },
  { value: 'material_shortage',     label: 'Material shortage' },
  { value: 'quality_issues',        label: 'Quality issues' },
  { value: 'documentation_issue',   label: 'Documentation issue' },
  { value: 'transit_delay',         label: 'Transit delay' },
  { value: 'booking_not_made',      label: 'Booking not made (Shiptify)' },
  { value: 'data_issue',            label: 'Data issue (ASD/ESD missing)' },
  { value: 'other',                 label: 'Other' },
];

const TM_REASONS: ReasonCode[] = ['transit_delay', 'booking_not_made'];

interface PrepareModalProps {
  onClose: () => void;
  failingLines: PurchaseLine[];
}

export function PrepareModal({ onClose, failingLines }: PrepareModalProps) {
  const { annotations, addAnnotation, updateAnnotation, isAnnotated, tmComment, setTmComment, tmName, setTmName } = useData();
  const [step, setStep] = useState(1);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  const allVendors = useMemo(() => [...new Set(failingLines.map((l) => l.supplier))].sort(), [failingLines]);

  const visibleLines = useMemo(() => {
    if (selectedVendors.length === 0) return failingLines;
    return failingLines.filter((l) => selectedVendors.includes(l.supplier));
  }, [failingLines, selectedVendors]);

  const annotatedCount = visibleLines.filter((l) => isAnnotated(`${l.po}-${l.line}`)).length;
  const progress = visibleLines.length > 0 ? Math.round((annotatedCount / visibleLines.length) * 100) : 100;
  const allDone = annotatedCount === visibleLines.length && visibleLines.length > 0;

  const handleAnnotation = (key: string, field: string, value: string) => {
    const data = { [field]: value } as Partial<typeof annotations[string]>;
    if (annotations[key]) updateAnnotation(key, data);
    else addAnnotation(key, data);
  };

  const toggleVendor = (s: string) =>
    setSelectedVendors((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const STEPS = [
    { n: 1, label: 'Select vendors' },
    { n: 2, label: 'Add root causes' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="prepare-modal relative bg-white rounded-lg w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* header */}
        <div className="px-6 py-5 border-b border-[#e9e3df] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#403833] text-base">Prepare for Meeting</h2>
            <p className="text-xs text-[#9c9794] mt-0.5">{failingLines.length} lines out of target · W22 2026</p>
          </div>
          <button onClick={onClose} className="text-[#b5aaa5] hover:text-[#403833] transition-colors">?</button>
        </div>

        {/* step indicator */}
        <div className="px-6 py-4 border-b border-[#e9e3df] flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <button
                onClick={() => { if (s.n < step || (s.n === 2 && step === 1 && (selectedVendors.length > 0 || true))) setStep(s.n); }}
                className="flex items-center gap-2"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s.n ? 'bg-[#403833] text-white' : step > s.n ? 'bg-pass text-white' : 'bg-[#e9e3df] text-[#9c9794]'}`}>
                  {step > s.n ? '?' : s.n}
                </span>
                <span className={`text-xs font-medium ${step === s.n ? 'text-[#403833]' : step > s.n ? 'text-pass' : 'text-[#9c9794]'}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="mx-3 text-[#e9e3df] text-xs">—</span>}
            </div>
          ))}
          {/* progress */}
          {step === 2 && (
            <div className="ml-auto flex items-center gap-2">
              <div className="w-24 bg-[#f4f1ef] rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${allDone ? 'bg-pass' : 'bg-brand'}`} style={{ width: `${progress}%` }} />
              </div>
              <span className={`text-xs font-semibold ${allDone ? 'text-pass' : 'text-[#7b7571]'}`}>{annotatedCount}/{visibleLines.length}</span>
            </div>
          )}
        </div>

        {/* step 1 — select vendors */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <p className="text-sm text-[#58524e]">Which vendors are you responsible for? Select all that apply.</p>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedVendors([])}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all ${selectedVendors.length === 0 ? 'border-[#403833] bg-[#403833] text-white' : 'border-[#e9e3df] text-[#58524e] hover:border-[#CCC]'}`}
              >
                All vendors
                {selectedVendors.length === 0 && <span>?</span>}
              </button>
              {allVendors.map((v) => (
                <button
                  key={v}
                  onClick={() => toggleVendor(v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${selectedVendors.includes(v) ? 'border-brand bg-[#faf7f3] text-[#403833] font-medium' : 'border-[#e9e3df] text-[#58524e] hover:border-[#CCC]'}`}
                >
                  <span>{v}</span>
                  <span className="text-xs text-[#9c9794]">{failingLines.filter((l) => l.supplier === v).length} lines</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* step 2 — root causes */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {visibleLines.length === 0 && (
              <p className="text-center text-[#9c9794] text-sm py-8">No failing lines for selected vendors.</p>
            )}
            {visibleLines.map((line) => {
              const key = `${line.po}-${line.line}`;
              const kpi = computeKPI(line);
              const entry = annotations[key];
              const reason = entry?.reason as ReasonCode | undefined;
              const done = isAnnotated(key);

              return (
                <div key={key} className={`border rounded-lg p-4 transition-all duration-200 ${done ? 'border-[#D1FAE5] bg-[#FAFFFE]' : 'border-[#e9e3df]'}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#403833]">{line.po}</span>
                        <span className="text-xs text-[#7b7571]">{line.sku}</span>
                        <span className="text-[10px] bg-[#f4f1ef] text-[#7b7571] px-1.5 py-0.5 rounded">{categorizeSKU(line.sku)}</span>
                        <span className="text-xs text-[#9c9794]">{line.supplier}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-[#b5aaa5] mt-1">
                        <span>PGRD {formatDateShort(line.pgrd)}</span>
                        {line.asd && <span>ASD {formatDateShort(line.asd)}</span>}
                        {line.esd ? <span>ESD {formatDateShort(line.esd)}</span> : <span className="text-fail">No ESD</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {kpi.sotFail && <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">SOT</span>}
                      {kpi.otifFail && <span className="text-[10px] bg-[#FEF3C7] text-warn px-2 py-0.5 rounded-full font-medium">OTIF</span>}
                      {done && <span className="text-pass font-bold">?</span>}
                    </div>
                  </div>

                  <select
                    value={reason ?? ''}
                    onChange={(e) => handleAnnotation(key, 'reason', e.target.value)}
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none transition-colors bg-white ${reason ? 'border-[#403833] text-[#403833]' : 'border-[#E8E8E8] text-[#9c9794]'}`}
                  >
                    <option value="">Select root cause...</option>
                    {REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>

                  {reason && TM_REASONS.includes(reason) && (
                    <input type="text" placeholder="TM comment (required)"
                      value={entry?.tmComment ?? ''}
                      onChange={(e) => handleAnnotation(key, 'tmComment', e.target.value)}
                      className="mt-2 w-full text-sm border border-brand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand" />
                  )}
                  {reason === 'other' && (
                    <input type="text" placeholder="SCM comment (required)"
                      value={entry?.scmComment ?? ''}
                      onChange={(e) => handleAnnotation(key, 'scmComment', e.target.value)}
                      className="mt-2 w-full text-sm border border-[#F59E0B] rounded-lg px-3 py-2 focus:outline-none" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* footer */}
        <div className="px-6 py-4 border-t border-[#e9e3df] flex items-center justify-between gap-3">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="text-sm text-[#7b7571] hover:text-[#403833] transition-colors">? Back</button>
          ) : <div />}
          {step < 2 ? (
            <button
              onClick={() => setStep(2)}
              className="bg-[#403833] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#58524e] transition-colors"
            >
              {`Continue with ${selectedVendors.length === 0 ? 'all' : selectedVendors.length} vendor${selectedVendors.length === 1 ? '' : 's'} ?`}
            </button>
          ) : (
            <button
              onClick={onClose}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${allDone ? 'bg-pass text-white' : 'bg-[#403833] text-white hover:bg-[#58524e]'}`}
            >
              {allDone ? '? All lines annotated — ready for review' : `Save & close (${annotatedCount}/${visibleLines.length} done)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
