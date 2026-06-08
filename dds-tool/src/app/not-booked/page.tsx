'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';
import { categorizeSKU, type SKUCategory } from '../../lib/skuUtils';
import type { PurchaseLine } from '../../types';

const CATEGORY_COLORS: Record<SKUCategory, string> = {
  'Beds': '#6366F1', 'Mattresses': '#FF8900', 'Accessories': '#34A853', 'Comps/Other': '#8A8A8A',
};

export default function NotBookedPage() {
  const router = useRouter();
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines);
  const lines = kpis.notBookedLines;

  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  // group lines by PO
  const byPO = useMemo(() => {
    const map = new Map<string, { po: string; vendor: string; destination: string; pgrd: Date | null; lines: PurchaseLine[] }>();
    for (const l of lines) {
      if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, destination: l.destination, pgrd: l.pgrd, lines: [] });
      map.get(l.po)!.lines.push(l);
    }
    return [...map.values()].sort((a, b) => (a.pgrd?.getTime() ?? 0) - (b.pgrd?.getTime() ?? 0));
  }, [lines]);

  const totalPOs = byPO.length;

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

      <div className="max-w-4xl mx-auto px-6 py-5 space-y-5">
        {/* hero */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-2">POs without pickup booking</p>
          <p className={`kpi-number font-extrabold text-7xl leading-none ${totalPOs === 0 ? 'text-pass' : 'text-fail'}`}>{totalPOs}</p>
          <p className="text-xs text-[#888] mt-2">{lines.length} lines across {totalPOs} POs</p>
          {totalPOs === 0 && <p className="text-pass text-sm font-medium mt-2">All POs have pickup booked</p>}
        </div>

        {/* PO list */}
        {byPO.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#F0F0F0]">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">POs missing pickup booking — click to expand lines</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['PO', 'Vendor', 'Destination', 'PGRD', 'Lines'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byPO.map((group) => (
                  <Fragment key={group.po}>
                    <tr
                      key={group.po}
                      onClick={() => setExpandedPO(expandedPO === group.po ? null : group.po)}
                      className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                    >
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
                        <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full font-medium">
                          {group.lines.length} line{group.lines.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                    {expandedPO === group.po && (
                      <tr className="bg-[#FFFAFA]">
                        <td colSpan={5} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[#AAA] border-b border-[#F0F0F0]">
                                {['Line', 'SKU', 'Category', 'PGRD'].map((h) => (
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
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
