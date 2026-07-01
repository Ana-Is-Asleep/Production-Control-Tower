'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';
import { categorizeSKU, SKU_CATEGORIES, type SKUCategory } from '../../lib/skuUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

function KpiCard({ label, value, unit, delta, deltaGood }: { label: string; value: string | number; unit?: string; delta?: string; deltaGood?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-[#F0F0F0] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#AAA] mb-2">{label}</p>
      <p className="text-[26px] font-bold leading-none text-[#111] tracking-tight">
        {value}{unit && <span className="text-[13px] font-semibold text-[#AAA] ml-1">{unit}</span>}
      </p>
      {delta && (
        <p className={`text-[12px] font-semibold mt-1.5 ${deltaGood ? 'text-pass' : 'text-fail'}`}>{delta}</p>
      )}
    </div>
  );
}

export default function NotBookedPage() {
  const router = useRouter();
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines);
  const lines = kpis.notBookedLines;

  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<SKUCategory | 'All'>('All');

  // group by PO, sorted by most urgent PGRD first
  const byPO = useMemo(() => {
    const map = new Map<string, { po: string; vendor: string; destination: string; pgrd: Date | null; lines: PurchaseLine[] }>();
    for (const l of lines) {
      if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, destination: l.destination, pgrd: l.pgrd, lines: [] });
      map.get(l.po)!.lines.push(l);
    }
    return [...map.values()].sort((a, b) => (a.pgrd?.getTime() ?? 0) - (b.pgrd?.getTime() ?? 0));
  }, [lines]);

  // category breakdown counts
  const catCounts = useMemo(() => {
    const counts: Record<SKUCategory, Set<string>> = { Beds: new Set(), Mattresses: new Set(), Accessories: new Set(), 'Comps/Other': new Set() };
    for (const l of lines) counts[categorizeSKU(l.sku)].add(l.po);
    return counts;
  }, [lines]);

  const totalPOs   = byPO.length;
  const totalLines = lines.length;
  const activePOs  = new Set(accumulatingLines.map(l => l.po)).size;
  const pctUnbooked = activePOs > 0 ? Math.round(totalPOs / activePOs * 100) : 0;
  const mostUrgentPgrd = byPO[0]?.pgrd;

  // filter table by category
  const filteredPOs = useMemo(() =>
    selectedCat === 'All'
      ? byPO
      : byPO.filter(g => g.lines.some(l => categorizeSKU(l.sku) === selectedCat)),
    [byPO, selectedCat]
  );

  return (
    <div className="min-h-screen bg-[#F4F4F6] page-enter">
      <header className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">
          &larr; Dashboard
        </button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Not Booked</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="POs not booked"
            value={totalPOs}
            delta={totalPOs === 0 ? 'All POs have pickup booked' : `${totalLines} lines affected`}
            deltaGood={totalPOs === 0}
          />
          <KpiCard
            label="% of active POs"
            value={pctUnbooked}
            unit="%"
            delta={pctUnbooked === 0 ? 'clean' : `out of ${activePOs} active POs`}
            deltaGood={pctUnbooked === 0}
          />
          <KpiCard
            label="Most urgent PGRD"
            value={mostUrgentPgrd ? formatDateShort(mostUrgentPgrd) ?? '—' : '—'}
            delta={mostUrgentPgrd ? 'Earliest unbooked delivery' : 'No unbooked POs'}
            deltaGood={!mostUrgentPgrd}
          />
          <KpiCard
            label="By category"
            value={`${catCounts.Beds.size}B · ${catCounts.Mattresses.size}M · ${catCounts.Accessories.size}A`}
            delta="Beds · Mattresses · Accessories"
            deltaGood={false}
          />
        </div>

        {/* category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCat('All')}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${selectedCat === 'All' ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}>
            All categories
          </button>
          {SKU_CATEGORIES.map((c) => (
            <button key={c}
              onClick={() => setSelectedCat(c)}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all"
              style={selectedCat === c
                ? { background: CATEGORY_COLORS[c], color: 'white', borderColor: CATEGORY_COLORS[c] }
                : { borderColor: '#E0E0E0', color: '#555' }}>
              {c}
              {catCounts[c].size > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">{catCounts[c].size}</span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-[#AAA]">{filteredPOs.length} PO{filteredPOs.length !== 1 ? 's' : ''}</span>
        </div>

        {/* PO list */}
        {filteredPOs.length > 0 ? (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#F0F0F0]">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">POs missing pickup booking — click to expand lines</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['PO', 'Vendor', 'Destination', 'PGRD', 'Category', 'Lines'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map((group) => {
                  const cats = [...new Set(group.lines.map(l => categorizeSKU(l.sku)))];
                  return (
                    <Fragment key={group.po}>
                      <tr
                        onClick={() => setExpandedPO(expandedPO === group.po ? null : group.po)}
                        className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#111]">
                          <span className="flex items-center gap-2">
                            <span className="text-[#CCC] text-xs">{expandedPO === group.po ? '▾' : '▸'}</span>
                            {group.po}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#555]">{group.vendor}</td>
                        <td className="px-4 py-3 text-[#555]">{group.destination}</td>
                        <td className="px-4 py-3 text-[#555] whitespace-nowrap">{formatDateShort(group.pgrd)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {cats.map(c => (
                              <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[c] }}>{c}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">
                            {group.lines.length} line{group.lines.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>
                      {expandedPO === group.po && (
                        <tr className="bg-[#FFFAFA]">
                          <td colSpan={6} className="px-6 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[#AAA] border-b border-[#F0F0F0]">
                                  {['Line', 'SKU', 'Category', 'PGRD', 'Qty'].map((h) => (
                                    <th key={h} className="py-1.5 pr-6 text-left font-medium uppercase text-[10px] tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.lines.map((l) => {
                                  const cat = categorizeSKU(l.sku);
                                  return (
                                    <tr key={`${l.po}-${l.line}`} className="border-b border-[#F5F5F5] last:border-0">
                                      <td className="py-1.5 pr-6 text-[#888]">{l.line}</td>
                                      <td className="py-1.5 pr-6 font-mono text-[#555]">{l.sku}</td>
                                      <td className="py-1.5 pr-6">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[cat] }}>{cat}</span>
                                      </td>
                                      <td className="py-1.5 pr-6 text-[#888]">{formatDateShort(l.pgrd)}</td>
                                      <td className="py-1.5 pr-6 text-[#888]">{l.qty}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 text-center text-[#CCC]" style={{ boxShadow: 'var(--shadow-card)' }}>
            {totalPOs === 0 ? 'All POs have pickup booked' : 'No POs match the selected category'}
          </div>
        )}
      </div>
    </div>
  );
}
