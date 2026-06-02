'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { computeKPI } from '../../lib/kpiFormulas';
import { formatDateShort } from '../../lib/dateUtils';

type Tab = 'all' | 'not-sot' | 'not-otif' | 'not-both';

export default function SKUPage() {
  const router = useRouter();
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
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">
          ← Dashboard
        </button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">SKU Deep Dive</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#F7F7F7]'}`}
            >
              {t.label}
              <span className={`text-xs rounded-full px-1.5 ${tab === t.key ? 'bg-white/20 text-white' : 'bg-[#EBEBEB] text-[#888]'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-white">
                {['PO', 'Line', 'SKU', 'Supplier', 'Dest.', 'PGRD', 'ASD', 'ESD', 'SOT', 'OTIF'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.po}-${r.line}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
                  <td className="px-3 py-2.5 font-medium text-[#111]">{r.po}</td>
                  <td className="px-3 py-2.5 text-[#555]">{r.line}</td>
                  <td className="px-3 py-2.5 text-[#555]">{r.sku}</td>
                  <td className="px-3 py-2.5 text-[#555]">{r.supplier}</td>
                  <td className="px-3 py-2.5 text-[#555]">{r.destination}</td>
                  <td className="px-3 py-2.5 text-[#555]">{formatDateShort(r.pgrd)}</td>
                  <td className="px-3 py-2.5 text-[#555]">{formatDateShort(r.asd)}</td>
                  <td className="px-3 py-2.5">
                    {r.esd ? formatDateShort(r.esd) : <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full">No booking</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.kpi.sotResult === null ? <span className="text-[#CCC]">—</span>
                      : r.kpi.sotResult ? <span className="text-pass font-bold">✓</span>
                      : <span className="text-fail font-bold">✗</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.kpi.otif === null ? <span className="text-[#CCC]">—</span>
                      : r.kpi.otif ? <span className="text-pass font-bold">✓</span>
                      : <span className="text-warn font-bold">✗</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[#AAA] text-sm">No lines</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
