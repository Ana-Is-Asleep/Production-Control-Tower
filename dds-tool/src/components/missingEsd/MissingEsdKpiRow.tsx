'use client';

import { AlertTriangle, Clock, FileText } from 'lucide-react';

interface MissingEsdKpiRowProps {
  needingActionCount: number;
  overdueCount: number;
  notUrgentCount: number;
  totalCount: number;
}

// Merges the old "Needing Action / Overdue" pair and the separate "Urgent / Not Urgent" filter
// toggle into one KPI split: Needing Action (EGRD overdue or within 3 weeks) vs Not Urgent (EGRD
// more than 3 weeks away) — the same two buckets computeMissingEsdRows already assigns via
// `urgency`, just no longer split across two different UI pieces. Each card carries its own
// criteria as a description so the split is legible without reading code.
export function MissingEsdKpiRow({ needingActionCount, overdueCount, notUrgentCount, totalCount }: MissingEsdKpiRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-fail-bg rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-fail shrink-0"><AlertTriangle size={14} /></span>
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Needing Action</p>
        </div>
        <p className="text-[11px] text-[#7b7571] mb-2">EGRD overdue or within the next 3 weeks</p>
        <p className="text-3xl font-extrabold leading-none text-fail">{needingActionCount}</p>
        <p className="text-xs text-[#7b7571] mt-1">POs missing ESD</p>
        <p className="text-xs font-semibold text-fail mt-1">{overdueCount} already overdue</p>
      </div>

      <div className="bg-[#f5f2ee] rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[#7b7571] shrink-0"><Clock size={14} /></span>
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Not Urgent</p>
        </div>
        <p className="text-[11px] text-[#7b7571] mb-2">EGRD more than 3 weeks away</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{notUrgentCount}</p>
        <p className="text-xs text-[#7b7571] mt-1">POs missing ESD</p>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-[#f5f2ee] flex items-center justify-center text-[#7b7571] shrink-0"><FileText size={14} /></span>
          <p className="text-xs font-bold text-[#403833] uppercase tracking-wide">Total Missing ESD</p>
        </div>
        <p className="text-[11px] text-[#7b7571] mb-2">Current open POs without ESD</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{totalCount}</p>
      </div>

      <div className="bg-[#fff7ed] rounded-lg border border-brand/30 p-4 text-xs text-[#58524e]" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-2">About this split</p>
        <p className="flex items-start gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-fail shrink-0 mt-1" />
          <span><span className="font-semibold text-[#403833]">Needing Action:</span> EGRD is in the past or within the next 3 weeks.</span>
        </p>
        <p className="flex items-start gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#c8c0bb] shrink-0 mt-1" />
          <span><span className="font-semibold text-[#403833]">Not Urgent:</span> EGRD is more than 3 weeks away.</span>
        </p>
      </div>
    </div>
  );
}
