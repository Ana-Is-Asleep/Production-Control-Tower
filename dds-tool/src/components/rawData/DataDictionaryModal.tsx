'use client';

import { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { DictEntry } from '../../lib/rawDataColumns';

interface DataDictionaryModalProps {
  entries: DictEntry[]; // PO + PO Line columns, already deduped by label upstream
  onClose: () => void;
}

const TYPE_TINT: Record<DictEntry['type'], string> = {
  Text: 'bg-[#f4f1ef] text-[#58524e]',
  Date: 'bg-[#eef2ff] text-[#4338ca]',
  Number: 'bg-[#f0fdf4] text-pass',
  Calculated: 'bg-[#fff7ed] text-brand',
};

export function DataDictionaryModal({ entries, onClose }: DataDictionaryModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9e3df] shrink-0">
          <p className="text-sm font-bold text-[#403833]">Data Dictionary</p>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#f5f2ee] text-[#7b7571]"><X size={16} /></button>
        </div>
        <div className="px-4 py-2.5 border-b border-[#e9e3df] shrink-0">
          <div className="flex items-center gap-2 bg-[#f9f7f6] border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
            <Search size={13} className="text-[#9c9794]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              className="flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.map((e) => (
            <div key={`${e.level}-${e.label}`} className="border border-[#f4f1ef] rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#403833]">{e.label}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_TINT[e.type]}`}>{e.type}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#f5f2ee] text-[#9c9794]">{e.level}</span>
                </div>
              </div>
              <p className="text-[11px] text-[#58524e] mt-1">{e.description}</p>
              <p className="text-[10px] text-[#9c9794] mt-1">Source: {e.source}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-xs text-[#9c9794] text-center py-6">No matching fields.</p>}
        </div>
      </div>
    </div>
  );
}
