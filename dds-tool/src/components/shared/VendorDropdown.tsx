'use client';

import { useState, useRef, useEffect } from 'react';

interface VendorDropdownProps {
  allSuppliers: string[];
  selected: string[];
  onChange: (s: string[]) => void;
}

export function VendorDropdown({ allSuppliers, selected, onChange }: VendorDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = selected.length === 0 ? 'All vendors' : selected.length === 1 ? selected[0] : `${selected.length} vendors`;
  const toggle = (s: string) => onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`filter-pill flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium ${selected.length > 0 ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <span className="opacity-50 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-72 py-1 max-h-72 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#58524e] hover:bg-[#f9f7f6]'}`}>
            All vendors {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#e9e3df] my-1" />
          {allSuppliers.map((s) => (
            <button key={s} onClick={() => toggle(s)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#f9f7f6]">
              <span className={selected.includes(s) ? 'text-[#403833] font-medium' : 'text-[#58524e]'}>{s}</span>
              {selected.includes(s) && <span className="text-brand text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
