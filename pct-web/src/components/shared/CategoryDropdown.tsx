'use client';

import { useState, useRef, useEffect } from 'react';
import { SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';

interface CategoryDropdownProps {
  selected: SKUCategory[];
  onChange: (s: SKUCategory[]) => void;
}

// Mirrors VendorDropdown's interaction pattern — a second, dropdown-style affordance over the
// exact same `filters.categories` state the pill row already controls (no new filter logic).
export function CategoryDropdown({ selected, onChange }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = selected.length === 0 ? 'All categories' : selected.length === 1 ? selected[0] : `${selected.length} categories`;
  const toggle = (c: SKUCategory) => onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[13px] font-medium text-[#403833] bg-white border border-[#e9e3df] rounded-lg px-2.5 h-8 hover:border-[#9c9794]"
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <span className="text-[#7b7571] text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-56 py-1" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#58524e] hover:bg-[#f9f7f6]'}`}>
            All categories {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#e9e3df] my-1" />
          {SKU_CATEGORIES.map((c) => (
            <button key={c} onClick={() => toggle(c)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#f9f7f6]">
              <span className={selected.includes(c) ? 'text-[#403833] font-medium' : 'text-[#58524e]'}>{c}</span>
              {selected.includes(c) && <span className="text-brand text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
