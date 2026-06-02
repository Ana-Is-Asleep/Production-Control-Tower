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
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  const suppliers = useMemo(() => [...new Set(failingLines.map((l) => l.supplier))].sort(), [failingLines]);

  const visibleLines = useMemo(() => {
    if (selectedSuppliers.length === 0) return failingLines;
    return failingLines.filter((l) => selectedSuppliers.includes(l.supplier));
  }, [failingLines, selectedSuppliers]);

  const annotatedCount = visibleLines.filter((l) => isAnnotated(`${l.po}-${l.line}`)).length;
  const progress = visibleLines.length > 0 ? Math.round((annotatedCount / visibleLines.length) * 100) : 100;
  const allDone = progress === 100 && visibleLines.length > 0;

  const handleAnnotation = (key: string, field: string, value: string) => {
    const data = { [field]: value } as Partial<typeof annotations[string]>;
    if (annotations[key]) updateAnnotation(key, data);
    else addAnnotation(key, data);
  };

  const toggleSupplier = (s: string) => {
    setSelectedSuppliers((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="prepare-modal relative bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* modal header */}
        <div className="px-6 py-5 border-b border-[#F0F0F0] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#111] text-lg">Prepare for Meeting</h2>
            <p className="text-xs text-[#888] mt-0.5">{failingLines.length} lines need a root cause before Wednesday</p>
          </div>
          <button onClick={onClose} className="text-[#AAA] hover:text-[#111] transition-colors text-lg">✕</button>
        </div>

        {/* progress bar */}
        <div className="px-6 py-3 border-b border-[#F7F7F7]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#888]">{annotatedCount} of {visibleLines.length} annotated</span>
            <span className={`text-xs font-semibold ${allDone ? 'text-pass' : 'text-[#888]'}`}>{progress}%</span>
          </div>
          <div className="w-full bg-[#F5F5F5] rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${allDone ? 'bg-pass' : 'bg-brand'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* supplier filter */}
        {suppliers.length > 1 && (
          <div className="px-6 py-3 border-b border-[#F7F7F7] flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSuppliers([])}
              className={`text-xs px-3 py-1 rounded-full border font-medium filter-pill ${selectedSuppliers.length === 0 ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555]'}`}
            >
              All
            </button>
            {suppliers.map((s) => (
              <button
                key={s}
                onClick={() => toggleSupplier(s)}
                className={`text-xs px-3 py-1 rounded-full border font-medium filter-pill ${selectedSuppliers.includes(s) ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555]'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* lines */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {visibleLines.length === 0 && (
            <p className="text-center text-[#AAA] text-sm py-8">No failing lines — great job!</p>
          )}
          {visibleLines.map((line) => {
            const key = `${line.po}-${line.line}`;
            const kpi = computeKPI(line);
            const entry = annotations[key];
            const reason = entry?.reason as ReasonCode | undefined;
            const needsTm = reason && TM_REASONS.includes(reason);
            const needsScm = reason === 'other';
            const done = isAnnotated(key);

            return (
              <div
                key={key}
                className={`border rounded-xl p-4 transition-all duration-200 ${done ? 'border-[#D1FAE5] bg-[#F9FFFC]' : 'border-[#F0F0F0] bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-sm text-[#111]">{line.po}</span>
                    <span className="text-xs text-[#888]">L{line.line}</span>
                    <span className="text-xs font-medium text-[#555]">{line.sku}</span>
                    <span className="text-[10px] text-[#AAA]">{categorizeSKU(line.sku)}</span>
                    <span className="text-xs text-[#AAA]">{line.supplier}</span>
                    <span className="text-xs text-[#AAA]">{line.destination}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {kpi.sotFail && <span className="text-[10px] bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">SOT</span>}
                    {kpi.otifFail && <span className="text-[10px] bg-[#FEF3C7] text-warn px-2 py-0.5 rounded-full font-medium">OTIF</span>}
                    {done && <span className="text-pass text-sm">✓</span>}
                  </div>
                </div>

                <div className="flex gap-3 items-center text-xs text-[#AAA] mb-3">
                  <span>PGRD {formatDateShort(line.pgrd)}</span>
                  {line.asd && <span>ASD {formatDateShort(line.asd)}</span>}
                  {line.esd ? <span>ESD {formatDateShort(line.esd)}</span> : <span className="text-fail">No ESD</span>}
                </div>

                <select
                  value={reason ?? ''}
                  onChange={(e) => handleAnnotation(key, 'reason', e.target.value)}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none transition-colors ${reason ? 'border-[#111] text-[#111]' : 'border-[#E0E0E0] text-[#AAA]'}`}
                >
                  <option value="">Select root cause...</option>
                  {REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {needsTm && (
                  <input
                    type="text"
                    placeholder="TM comment (required)"
                    value={entry?.tmComment ?? ''}
                    onChange={(e) => handleAnnotation(key, 'tmComment', e.target.value)}
                    className="mt-2 w-full text-sm border border-brand rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                )}
                {needsScm && (
                  <input
                    type="text"
                    placeholder="SCM comment (required)"
                    value={entry?.scmComment ?? ''}
                    onChange={(e) => handleAnnotation(key, 'scmComment', e.target.value)}
                    className="mt-2 w-full text-sm border border-[#F59E0B] rounded-lg px-3 py-2 focus:outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-[#F0F0F0] space-y-3">
          <div className="flex gap-3">
            <input type="text" placeholder="TM Name" value={tmName} onChange={(e) => setTmName(e.target.value)}
              className="flex-1 text-sm border border-[#E0E0E0] rounded-lg px-3 py-2 focus:outline-none focus:border-brand" />
            <input type="text" placeholder="TM meeting notes..." value={tmComment} onChange={(e) => setTmComment(e.target.value)}
              className="flex-[3] text-sm border border-[#E0E0E0] rounded-lg px-3 py-2 focus:outline-none focus:border-brand" />
          </div>
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${allDone ? 'bg-pass text-white' : 'bg-[#111] text-white hover:bg-[#333]'}`}
          >
            {allDone ? '✓ All done — ready for Wednesday!' : `Save progress (${annotatedCount}/${visibleLines.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
