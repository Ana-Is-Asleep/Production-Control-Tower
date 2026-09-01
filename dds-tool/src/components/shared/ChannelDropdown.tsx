'use client';

import { useState, useRef, useEffect } from 'react';
import type { Channel } from '../../lib/channelUtils';

const CHANNELS: Channel[] = ['Offline', 'Online'];

interface ChannelDropdownProps {
  selected: Channel[];
  onChange: (s: Channel[]) => void;
}

// Mirrors VendorDropdown/CategoryDropdown — a second, dropdown-style affordance over the exact
// same `filters.channels` state the pill row already controls (no new filter logic).
export function ChannelDropdown({ selected, onChange }: ChannelDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = selected.length === 0 ? 'All channels' : selected.length === 1 ? selected[0] : `${selected.length} channels`;
  const toggle = (c: Channel) => onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[13px] font-medium text-[#403833] bg-white border border-[#e9e3df] rounded-lg px-3 h-9 hover:border-[#9c9794]"
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <span className="text-[#7b7571] text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-48 py-1" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#58524e] hover:bg-[#f9f7f6]'}`}>
            All channels {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#e9e3df] my-1" />
          {CHANNELS.map((c) => (
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
