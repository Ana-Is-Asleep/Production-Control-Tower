'use client';

interface BacklogEsdPassedCalloutProps {
  count: number;
  onViewList: () => void;
}

// Current backlog POs whose planned ship date has already come and gone with no Actual Ship Date
// confirmed yet — these were expected to have shipped by now, so they're the most actionable
// subset of the backlog rather than just aging quietly. Zero is the common case, so it collapses
// to a compact confirmation rather than reserving a big empty-looking card.
export function BacklogEsdPassedCallout({ count, onViewList }: BacklogEsdPassedCalloutProps) {
  if (count === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex items-center gap-2" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-bold text-[#403833]">ESD Passed but No ASD</p>
        <p className="text-xs text-pass ml-auto">0 POs — No current exceptions</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833]">ESD Passed but No ASD</p>
      <p className="text-3xl font-extrabold leading-none text-fail mt-2">{count} <span className="text-sm font-semibold text-[#9c9794]">POs</span></p>
      <p className="text-[11px] text-[#7b7571] mt-2">These POs have an ESD in the past but no Actual Ship Date (ASD) confirmed yet.</p>
      <button onClick={onViewList} className="text-xs text-brand font-semibold hover:underline mt-auto pt-2 text-left">
        View list →
      </button>
    </div>
  );
}
