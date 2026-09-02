'use client';

interface MissingEsdKpiRowProps {
  needingActionCount: number;
  overdueCount: number;
  notUrgentCount: number;
  totalCount: number;
}

// Needing Action / Not Urgent / Total Missing ESD, each carrying its own criteria as a
// description so the split is legible without reading code — no icons, no repeated counts,
// just the three numbers plus a small explanatory card.
export function MissingEsdKpiRow({ needingActionCount, overdueCount, notUrgentCount, totalCount }: MissingEsdKpiRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-fail-bg rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-1">Needing Action</p>
        <p className="text-3xl font-extrabold leading-none text-fail">{needingActionCount}</p>
        <p className="text-xs text-[#7b7571] mt-1">POs missing ESD</p>
        <p className="text-[11px] text-[#7b7571] mt-2">EGRD is in the past or within the next 3 weeks</p>
        <p className="text-xs font-semibold text-fail mt-2">{overdueCount} already overdue</p>
      </div>

      <div className="bg-[#f5f2ee] rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-1">Not Urgent</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{notUrgentCount}</p>
        <p className="text-xs text-[#7b7571] mt-1">POs missing ESD</p>
        <p className="text-[11px] text-[#7b7571] mt-2">EGRD is more than 3 weeks away</p>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-1">Total Missing ESD</p>
        <p className="text-3xl font-extrabold leading-none text-[#403833]">{totalCount}</p>
        <p className="text-[11px] text-[#7b7571] mt-2">Current open POs without ESD</p>
      </div>

      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 text-xs text-[#58524e]" style={{ boxShadow: 'var(--shadow-card)' }}>
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
