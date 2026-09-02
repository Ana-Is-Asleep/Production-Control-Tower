'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Sidebar } from '../shell/Sidebar';
import { APP_DICT_ENTRIES, type DictCategory } from '../../lib/dictionaryEntries';

const CATEGORY_ORDER: DictCategory[] = ['KPI', 'Date Field', 'Calculated Field', 'PO / Line Field', 'Status'];
const CATEGORY_TINT: Record<DictCategory, string> = {
  KPI: 'bg-[#fff7ed] text-brand',
  'Date Field': 'bg-[#eef2ff] text-[#4338ca]',
  'Calculated Field': 'bg-[#f0fdf4] text-pass',
  'PO / Line Field': 'bg-[#f4f1ef] text-[#58524e]',
  Status: 'bg-[#fef3c7] text-[#92400e]',
};

// App-wide, read-only reference — covers KPIs, date fields, calculated fields, PO/Line fields and
// statuses. Every entry comes from APP_DICT_ENTRIES (dictionaryEntries.ts), which only reuses
// existing code comments/constants; nothing here can be edited from the UI (KPI governance: the
// Control Tower's calculation code remains the single source of truth).
export function DataDictionaryPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DictCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return APP_DICT_ENTRIES.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (!q) return true;
      return e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    });
  }, [query, category]);

  const grouped = CATEGORY_ORDER.map((cat) => ({ cat, entries: filtered.filter((e) => e.category === cat) })).filter((g) => g.entries.length > 0);

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#e9e3df] px-5 py-2.5 shrink-0">
          <h1 className="text-base font-bold text-[#403833] tracking-tight">Production Control Tower</h1>
          <div className="flex items-center gap-1.5 text-xs text-[#9c9794] mt-0.5">
            <span>Dashboard</span><span className="text-[#d6cfc9]">›</span><span className="text-[#403833] font-medium">Data Dictionary</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3">
            <div className="flex items-center gap-2 bg-[#f9f7f6] border border-[#e9e3df] rounded-lg px-3 py-2">
              <Search size={14} className="text-[#9c9794]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search definitions, fields or KPIs…" className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setCategory('all')} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${category === 'all' ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'}`}>All</button>
              {CATEGORY_ORDER.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${category === c ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#7b7571] hover:border-[#403833]'}`}>{c}</button>
              ))}
            </div>
          </div>

          {grouped.length === 0 && <p className="text-sm text-[#9c9794] text-center py-8">No matching definitions.</p>}

          {grouped.map(({ cat, entries }) => (
            <div key={cat} className="bg-white rounded-lg border border-[#e9e3df] p-4">
              <p className="text-xs font-bold text-[#403833] uppercase tracking-wide mb-3">{cat}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {entries.map((e) => (
                  <div key={e.label} className="border border-[#f4f1ef] rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#403833]">{e.label}</p>
                      <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_TINT[e.category]}`}>{e.category}</span>
                    </div>
                    <p className="text-[11px] text-[#58524e] mt-1.5 leading-relaxed">{e.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-[#9c9794]">Source: {e.source}</p>
                      {e.target && <p className="text-[10px] font-semibold text-brand">Target: {e.target}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
