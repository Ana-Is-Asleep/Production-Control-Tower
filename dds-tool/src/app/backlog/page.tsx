'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useData } from '../../context/DataContext';
import { NavTabs } from '../../components/shared/NavTabs';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';
import { categorizeSKU, SKU_CATEGORIES, SKUCategory } from '../../lib/skuUtils';
import type { PurchaseLine } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6469aa',
  'Mattresses': '#FF8900',
  'Accessories': '#34A853',
  'Comps/Other': '#8A8A8A',
};

type BacklogTab = 'critical' | 'recent' | 'future-backlog';

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
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${selected.length > 0 ? 'bg-[#403833] text-white border-[#403833]' : 'border-[#e9e3df] text-[#58524e] hover:border-[#403833]'}`}
      >
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="opacity-40 text-[10px]">?</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-64 py-1 max-h-64 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <button onClick={() => onChange([])} className={`w-full text-left px-4 py-2 text-xs font-medium ${selected.length === 0 ? 'text-brand' : 'text-[#58524e] hover:bg-[#f9f7f6]'}`}>
            All vendors {selected.length === 0 && '?'}
          </button>
          <div className="border-t border-[#e9e3df] my-1" />
          {vendors.map((v) => (
            <button key={v} onClick={() => toggle(v)} className="w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#f9f7f6]">
              <span className={selected.includes(v) ? 'text-[#403833] font-medium' : 'text-[#58524e]'}>{v}</span>
              {selected.includes(v) && <span className="text-brand">?</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BacklogTable({ lines }: { lines: PurchaseLine[] }) {
  if (lines.length === 0) return (
    <div className="text-center py-10 text-[#b5aaa5] text-sm">No POs match the current filters</div>
  );

  // group by PO — one row per PO, show line count and all unique categories
  const grouped = useMemo(() => {
    const map = new Map<string, { lines: PurchaseLine[]; categories: Set<SKUCategory> }>();
    lines.forEach((l) => {
      if (!map.has(l.po)) map.set(l.po, { lines: [], categories: new Set() });
      const g = map.get(l.po)!;
      g.lines.push(l);
      g.categories.add(categorizeSKU(l.sku));
    });
    return [...map.entries()].map(([po, g]) => ({
      po,
      vendor: g.lines[0].supplier,
      destination: g.lines[0].destination,
      pgrd: g.lines[0].pgrd,
      esd: g.lines.find(l => l.esd)?.esd ?? null,
      lineCount: g.lines.length,
      categories: [...g.categories],
      hasNoEsd: g.lines.some(l => !l.esd),
    }));
  }, [lines]);

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#403833] text-white">
            {['PO', 'Category', 'Vendor', 'Destination', 'PGRD', 'ESD', 'Lines'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map((g) => (
            <tr key={g.po} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6] transition-colors">
              <td className="px-4 py-2.5 font-semibold text-[#403833] whitespace-nowrap">{g.po}</td>
              <td className="px-4 py-2.5">
                <div className="flex gap-1 flex-wrap">
                  {g.categories.map((c) => (
                    <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[c] }}>{c}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 text-[#58524e]">{g.vendor}</td>
              <td className="px-4 py-2.5 text-[#58524e]">{g.destination}</td>
              <td className="px-4 py-2.5 text-[#58524e] whitespace-nowrap">{formatDateShort(g.pgrd)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {g.hasNoEsd
                  ? <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">No ESD</span>
                  : <span className="text-[#58524e]">{formatDateShort(g.esd)}</span>}
              </td>
              <td className="px-4 py-2.5 text-[#7b7571] text-xs">{g.lineCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BacklogPage() {
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);
  const { critical, recent, futureBacklog } = kpis.backlogSummary;

  const [activeTab, setActiveTab] = useState<BacklogTab>('critical');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SKUCategory[]>([]);

  const allLines_ = [...critical, ...recent, ...futureBacklog];
  const allVendors = useMemo(() => [...new Set(allLines_.map((l) => l.supplier))].sort(), [critical, recent, futureBacklog]);

  // count distinct POs, not lines
  const distinctPOs = (lines: PurchaseLine[]) => new Set(lines.map((l) => l.po)).size;

  const applyFilters = (lines: PurchaseLine[]) => {
    let result = lines;
    if (selectedVendors.length > 0) result = result.filter((l) => selectedVendors.includes(l.supplier));
    if (selectedCategories.length > 0) result = result.filter((l) => selectedCategories.includes(categorizeSKU(l.sku)));
    return result;
  };

  const toggleCat = (c: SKUCategory) =>
    setSelectedCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const tabLines = applyFilters(activeTab === 'critical' ? critical : activeTab === 'recent' ? recent : futureBacklog);

  // bar chart data: backlog by vendor (top 10)
  const chartData = useMemo(() => {
    const map = new Map<string, { critical: number; recent: number; futureBacklog: number }>();
    [...critical, ...recent, ...futureBacklog].forEach((l) => {
      if (!map.has(l.supplier)) map.set(l.supplier, { critical: 0, recent: 0, futureBacklog: 0 });
      const e = map.get(l.supplier)!;
      if (critical.includes(l)) e.critical++;
      else if (recent.includes(l)) e.recent++;
      else e.futureBacklog++;
    });
    return [...map.entries()]
      .map(([vendor, v]) => ({ vendor: vendor.split(' ')[0], ...v, total: v.critical + v.recent + v.futureBacklog }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [critical, recent, futureBacklog]);

  const TABS = [
    { key: 'critical' as BacklogTab, label: 'Critical', count: distinctPOs(applyFilters(critical)), total: distinctPOs(critical), color: 'text-fail', dot: 'bg-fail', border: 'border-fail' },
    { key: 'recent'   as BacklogTab, label: 'Recent',   count: distinctPOs(applyFilters(recent)),   total: distinctPOs(recent),   color: 'text-warn', dot: 'bg-warn', border: 'border-warn' },
    { key: 'future-backlog'  as BacklogTab, label: 'Future Backlog',  count: distinctPOs(applyFilters(futureBacklog)),   total: distinctPOs(futureBacklog),   color: 'text-brand', dot: 'bg-brand', border: 'border-brand' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f2ee] page-enter">
      {/* header */}
      <header className="bg-white border-b border-[#e9e3df] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-30">
        <span className="font-bold text-brand text-xl shrink-0 tracking-tight">emma<span className="text-[#403833]">.</span></span>
        <span className="text-[#d5cdc6]">|</span>
        <span className="text-[#403833] text-sm font-semibold shrink-0">DDS</span>
        <NavTabs className="ml-2" />
        <div className="flex-1" />
        <span className="text-xs bg-[#f4f1ef] border border-[#e9e3df] rounded-lg px-3 py-1.5 text-[#58524e] font-medium shrink-0">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      {/* summary cards */}
      {(() => {
        const noEsdLines = [...critical, ...recent, ...futureBacklog].filter(l => !l.esd);
        const noEsdPOs = new Set(noEsdLines.map(l => l.po)).size;
        return (
          <div className="px-6 pt-5 grid grid-cols-4 gap-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`text-left bg-white rounded-lg border-2 p-4 transition-all ${activeTab === t.key ? t.border : 'border-[#e9e3df] hover:border-[#e9e3df]'}`}
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794]">{t.label}</p>
                </div>
                <p className={`text-[26px] font-bold leading-none tracking-tight ${t.color}`}>{t.count}</p>
                <p className="text-[12px] font-semibold mt-1.5 text-[#9c9794]">
                  {t.count !== t.total ? `of ${t.total} total POs` : 'POs'}
                </p>
              </button>
            ))}
            <div className="bg-white rounded-lg border border-[#e9e3df] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#CCC]" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9c9794]">No ESD</p>
              </div>
              <p className={`text-[26px] font-bold leading-none tracking-tight ${noEsdPOs > 0 ? 'text-fail' : 'text-pass'}`}>{noEsdPOs}</p>
              <p className={`text-[12px] font-semibold mt-1.5 ${noEsdPOs > 0 ? 'text-fail' : 'text-pass'}`}>
                {noEsdPOs > 0 ? 'POs missing pickup booking' : 'all POs have ESD'}
              </p>
            </div>
          </div>
        );
      })()}

      {/* backlog by vendor chart */}
      {chartData.length > 0 && (
        <div className="mx-6 mt-4 bg-white rounded-lg p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-4">Backlog by Vendor</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
              <XAxis dataKey="vendor" tick={{ fill: '#9c9794', fontSize: 11 }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: '#9c9794', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#FF8900', fontWeight: 700 }} />
              <Legend verticalAlign="top" align="right" iconSize={8} formatter={(v) => <span style={{ color: '#58524e', fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="critical" stackId="a" fill="#DC3545" name="Critical" radius={[0,0,0,0]} />
              <Bar dataKey="recent" stackId="a" fill="#F59E0B" name="Recent" />
              <Bar dataKey="futureBacklog" stackId="a" fill="#FF8900" name="Future Backlog" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* filters */}
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
        <VendorDropdown vendors={allVendors} selected={selectedVendors} onChange={setSelectedVendors} />
        <span className="text-[#e9e3df]">|</span>
        {SKU_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => toggleCat(c)}
            className="text-xs px-3 py-1 rounded-full border font-medium transition-all"
            style={selectedCategories.includes(c)
              ? { background: CATEGORY_COLORS[c], color: '#f9f7f6', borderColor: CATEGORY_COLORS[c] }
              : { borderColor: '#e9e3df', color: '#58524e' }}
          >
            {c}
          </button>
        ))}
        {(selectedVendors.length > 0 || selectedCategories.length > 0) && (
          <button
            onClick={() => { setSelectedVendors([]); setSelectedCategories([]); }}
            className="text-xs text-[#9c9794] hover:text-fail transition-colors ml-1"
          >
            Clear filters ?
          </button>
        )}
        <span className="ml-auto text-xs text-[#9c9794]">{tabLines.length} line{tabLines.length !== 1 ? 's' : ''}</span>
      </div>

      {/* table */}
      <div className="px-6 pb-8">
        <BacklogTable lines={tabLines} />
      </div>
    </div>
  );
}
