'use client';

import { useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';
import type { PurchaseLine } from '../../types';

function BacklogTable({ lines, label, color }: { lines: PurchaseLine[]; label: string; color: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className={`px-5 py-3 flex items-center gap-2 border-b border-[#F0F0F0]`}>
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <p className="text-[11px] uppercase tracking-widest text-[#AAA]">{label} <span className="text-[#CCC]">({lines.length})</span></p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#111] text-white">
            {['PO', 'SKU', 'Vendor', 'Destination', 'PGRD', 'ESD'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={`${l.po}-${l.line}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
              <td className="px-4 py-2.5 font-medium text-[#111]">{l.po}</td>
              <td className="px-4 py-2.5 text-[#555]">{l.sku}</td>
              <td className="px-4 py-2.5 text-[#555]">{l.supplier}</td>
              <td className="px-4 py-2.5 text-[#555]">{l.destination}</td>
              <td className="px-4 py-2.5 text-[#555]">{formatDateShort(l.pgrd)}</td>
              <td className="px-4 py-2.5">
                {l.esd ? formatDateShort(l.esd) : <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full">No ESD</span>}
              </td>
            </tr>
          ))}
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
  const total = critical.length + recent.length + atRisk.length;

  return (
    <div className="min-h-screen bg-white page-enter">
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">
          ← Dashboard
        </button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Backlog</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Critical', count: critical.length, color: 'text-fail', dot: 'bg-fail', sub: '>14d no ASD' },
            { label: 'Recent', count: recent.length, color: 'text-warn', dot: 'bg-warn', sub: 'last 14d no ASD' },
            { label: 'At Risk', count: atRisk.length, color: 'text-brand', dot: 'bg-brand', sub: 'ESD > PGRD' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-[#F0F0F0] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                <p className="text-[11px] uppercase tracking-widest text-[#AAA]">{item.label}</p>
              </div>
              <p className={`font-serif text-6xl font-bold ${item.color}`}>{item.count}</p>
              <p className="text-xs text-[#888] mt-2">{item.sub}</p>
            </div>
          ))}
        </div>

        {total === 0 && (
          <div className="text-center py-12 bg-[#F9FFF9] rounded-2xl border border-[#E0F5E0]">
            <p className="text-pass font-semibold text-lg">✓ No backlog items</p>
            <p className="text-sm text-[#888] mt-1">All lines are on track</p>
          </div>
        )}

        <BacklogTable lines={critical} label="Critical" color="bg-fail" />
        <BacklogTable lines={recent} label="Recent" color="bg-warn" />
        <BacklogTable lines={atRisk} label="At Risk" color="bg-brand" />
      </div>
    </div>
  );
}
