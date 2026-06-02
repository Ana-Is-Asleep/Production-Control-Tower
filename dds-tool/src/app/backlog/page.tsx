'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1',
  'Mattresses': '#FF8900',
  'Accessories': '#34A853',
  'Comps/Other': '#8A8A8A',
};

type BacklogTab = 'critical' | 'recent' | 'at-risk';

// reusable vendor dropdown, same pattern as dashboard
function VendorDropdown({ vendors, selected, onChange }: { vendors: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const label = selected.length === 0 ? 'All vendors' : selected.length === 1 ? selected[0] : `${selected.length} vendors`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${selected.length > 0 ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
      >
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="opacity-40 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#F0F0F0] rounded-xl shadow-lg z-50 w-64 py-1 max-h-64 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#555] hover:bg-[#F9F9F9]'}`}>
            All vendors {selected.length === 0 && '✓'}
          </button>
          <div className="border-t border-[#F5F5F5] my-1" />
          {vendors.map((v) => (
            <button key={v} onClick={() => toggle(v)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#F9F9F9]">
              <span className={selected.includes(v) ? 'text-[#111] font-medium' : 'text-[#555]'}>{v}</span>
              {selected.includes(v) && <span className="text-brand">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BacklogTable({ lines }: { lines: PurchaseLine[] }) {
  if (lines.length === 0) return (
    <div className="text-center py-10 text-[#CCC] text-sm">No lines match the current filters</div>
  );

  return (
    <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#111] text-white">
            {['PO', 'SKU', 'Category', 'Vendor', 'Destination', 'PGRD', 'ESD'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const cat = categorizeSKU(l.sku);
            return (
              <tr key={`${l.po}-${l.line}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] transition-colors">
                <td className="px-4 py-2.5 font-semibold text-[#111] whitespace-nowrap">{l.po}</td>
                <td className="px-4 py-2.5 text-[#555] font-mono text-xs">{l.sku}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[cat] }}>{cat}</span>
                </td>
                <td className="px-4 py-2.5 text-[#555]">{l.supplier}</td>
                <td className="px-4 py-2.5 text-[#555]">{l.destination}</td>
                <td className="px-4 py-2.5 text-[#555] whitespace-nowrap">{formatDateShort(l.pgrd)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {l.esd
                    ? <span className="text-[#555]">{formatDateShort(l.esd)}</span>
                    : <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">No ESD</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BacklogPage() {
  const router = useRouter();
  const { allLines } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines);
  const kpis = useKPIs(weeklyLines, accumulatingLines);
  const { critical, recent, atRisk } = kpis.backlogSummary;

  const [activeTab, setActiveTab] = useState<BacklogTab>('critical');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SKUCategory[]>([]);

  const allLines_ = [...critical, ...recent, ...atRisk];
  const allVendors = useMemo(() => [...new Set(allLines_.map((l) => l.supplier))].sort(), [critical, recent, atRisk]);

  const applyFilters = (lines: PurchaseLine[]) => {
    let result = lines;
    if (selectedVendors.length > 0) result = result.filter((l) => selectedVendors.includes(l.supplier));
    if (selectedCategories.length > 0) result = result.filter((l) => selectedCategories.includes(categorizeSKU(l.sku)));
    return result;
  };

  const toggleCat = (c: SKUCategory) =>
    setSelectedCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const tabLines = applyFilters(activeTab === 'critical' ? critical : activeTab === 'recent' ? recent : atRisk);

  const TABS = [
    { key: 'critical' as BacklogTab, label: 'Critical', count: applyFilters(critical).length, total: critical.length, color: 'text-fail', dot: 'bg-fail', border: 'border-fail' },
    { key: 'recent'   as BacklogTab, label: 'Recent',   count: applyFilters(recent).length,   total: recent.length,   color: 'text-warn', dot: 'bg-warn', border: 'border-warn' },
    { key: 'at-risk'  as BacklogTab, label: 'At Risk',  count: applyFilters(atRisk).length,   total: atRisk.length,   color: 'text-brand', dot: 'bg-brand', border: 'border-brand' },
  ];

  return (
    <div className="min-h-screen bg-white page-enter">
      {/* header */}
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">← Dashboard</button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Backlog</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      {/* summary cards */}
      <div className="px-6 pt-6 grid grid-cols-3 gap-4 max-w-4xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`text-left bg-white rounded-2xl border-2 p-5 transition-all ${activeTab === t.key ? t.border : 'border-[#F0F0F0] hover:border-[#E0E0E0]'}`}
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${t.dot}`} />
              <span className="text-[11px] uppercase tracking-widest text-[#AAA]">{t.label}</span>
            </div>
            <p className={`font-serif text-5xl font-bold ${t.color}`}>{t.count}</p>
            {t.count !== t.total && <p className="text-xs text-[#AAA] mt-1">of {t.total} total</p>}
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
        <VendorDropdown vendors={allVendors} selected={selectedVendors} onChange={setSelectedVendors} />
        <span className="text-[#E0E0E0]">|</span>
        {SKU_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => toggleCat(c)}
            className="text-xs px-3 py-1 rounded-full border font-medium transition-all"
            style={selectedCategories.includes(c)
              ? { background: CATEGORY_COLORS[c], color: 'white', borderColor: CATEGORY_COLORS[c] }
              : { borderColor: '#E0E0E0', color: '#555' }}
          >
            {c}
          </button>
        ))}
        {(selectedVendors.length > 0 || selectedCategories.length > 0) && (
          <button
            onClick={() => { setSelectedVendors([]); setSelectedCategories([]); }}
            className="text-xs text-[#AAA] hover:text-fail transition-colors ml-1"
          >
            Clear filters ✕
          </button>
        )}
        <span className="ml-auto text-xs text-[#AAA]">{tabLines.length} line{tabLines.length !== 1 ? 's' : ''}</span>
      </div>

      {/* table */}
      <div className="px-6 pb-8">
        <BacklogTable lines={tabLines} />
      </div>
    </div>
  );
}
