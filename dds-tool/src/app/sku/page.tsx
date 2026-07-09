'use client';

import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { NavTabs } from '../../components/shared/NavTabs';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI } from '../../lib/kpiFormulas';
import { formatDateShort } from '../../lib/dateUtils';

type Tab = 'all' | 'not-sot' | 'not-otif' | 'not-both';

export default function SKUPage() {
  const { allLines } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines);
  const kpis = useKPIs(weeklyLines, accumulatingLines);
  const [tab, setTab] = useState<Tab>('all');

  const enriched = weeklyLines.map((l) => ({ ...l, kpi: computeKPI(l) }));
  const filtered = enriched.filter((l) => {
    if (tab === 'not-sot') return l.kpi.sotFail;
    if (tab === 'not-otif') return l.kpi.otifFail;
    if (tab === 'not-both') return l.kpi.sotFail && l.kpi.otifFail;
    return true;
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: enriched.length },
    { key: 'not-sot', label: 'Not SOT', count: enriched.filter((l) => l.kpi.sotFail).length },
    { key: 'not-otif', label: 'Not OTIF', count: enriched.filter((l) => l.kpi.otifFail).length },
    { key: 'not-both', label: 'Not Both', count: enriched.filter((l) => l.kpi.sotFail && l.kpi.otifFail).length },
  ];

  return (
    <div className="min-h-screen bg-white page-enter">
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

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-[#403833] text-white' : 'text-[#7b7571] hover:bg-[#f4f1ef]'}`}
            >
              {t.label}
              <span className={`text-xs rounded-full px-1.5 ${tab === t.key ? 'bg-white/20 text-white' : 'bg-[#e9e3df] text-[#7b7571]'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#403833] text-white">
                {['PO', 'Line', 'SKU', 'Vendor', 'Dest.', 'PGRD', 'ASD', 'ESD', 'SOT', 'OTIF'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.po}-${r.line}`} className="border-b border-[#e9e3df] hover:bg-[#f9f7f6]">
                  <td className="px-3 py-2.5 font-medium text-[#403833]">{r.po}</td>
                  <td className="px-3 py-2.5 text-[#58524e]">{r.line}</td>
                  <td className="px-3 py-2.5 text-[#58524e]">{r.sku}</td>
                  <td className="px-3 py-2.5 text-[#58524e]">{r.supplier}</td>
                  <td className="px-3 py-2.5 text-[#58524e]">{r.destination}</td>
                  <td className="px-3 py-2.5 text-[#58524e]">{formatDateShort(r.pgrd)}</td>
                  <td className="px-3 py-2.5 text-[#58524e]">{formatDateShort(r.asd)}</td>
                  <td className="px-3 py-2.5">
                    {r.esd ? formatDateShort(r.esd) : <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full">No booking</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.kpi.sotResult === null ? <span className="text-[#b5aaa5]">—</span>
                      : r.kpi.sotResult ? <span className="text-pass font-bold">✓</span>
                      : <span className="text-fail font-bold">✗</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.kpi.otif === null ? <span className="text-[#b5aaa5]">—</span>
                      : r.kpi.otif ? <span className="text-pass font-bold">✓</span>
                      : <span className="text-warn font-bold">✗</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[#9c9794] text-sm">No lines</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
