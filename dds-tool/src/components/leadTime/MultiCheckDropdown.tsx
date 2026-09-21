'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface MultiCheckDropdownProps {
  label: string;
  emptyLabel: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

// Generic searchable multi-select, modeled on the dashboard's VendorDropdown — used here for SKU
// group/variation selection, but kept generic since neither is specific to this page's data shape.
export function MultiCheckDropdown({ label, emptyLabel, options, selected, onChange }: MultiCheckDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query]
  );

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const buttonLabel = selected.length === 0 ? emptyLabel : selected.length <= 2 ? selected.join(', ') : `${selected.length} selected`;

  return (
    <div ref={ref} className="flex flex-col gap-1 relative">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">{label}</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="filter-pill flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium border-[#e9e3df] text-[#58524e] bg-white cursor-pointer text-left justify-between hover:border-[#403833] transition-colors"
      >
        <span className="truncate max-w-[180px]">{buttonLabel}</span>
        <span className="opacity-50 text-[10px] shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 w-72 bg-white border border-[#e9e3df] rounded-lg p-2.5" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full px-2.5 py-2 border border-[#e9e3df] rounded-lg text-sm mb-2"
          />
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="text-xs font-semibold text-brand hover:underline mb-2">Clear all</button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-[#9c9794] px-1 py-2">No matches</p>}
            {filtered.map((o) => (
              <label key={o} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-[#f9f7f6] cursor-pointer text-sm">
                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="accent-[#403833]" />
                <span className="text-[#403833]">{o}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
