'use client';

import { useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';

export default function NotBookedPage() {
  const router = useRouter();
  const { allLines, globalFilters } = useData();
  const { weeklyLines, accumulatingLines, lastWeek, lastYear } = useFilters(allLines, globalFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines);
  const lines = kpis.notBookedLines;

  return (
    <div className="min-h-screen bg-white page-enter">
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#111] transition-colors">
          â† Dashboard
        </button>
        <span className="text-[#D0D0D0]">/</span>
        <span className="text-sm font-semibold text-[#111]">Not Booked</span>
        <div className="flex-1" />
        <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
          W{String(lastWeek).padStart(2, '0')} {lastYear}
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-8" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">Lines without ESD</p>
          <p className="font-serif text-7xl font-bold text-[#111]">{lines.length}</p>
          {lines.length === 0 && <p className="text-pass text-sm font-medium mt-2">âœ“ All lines have pickup booked</p>}
        </div>

        {lines.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-[#F0F0F0]">
              <p className="text-[11px] uppercase tracking-widest text-[#AAA]">Lines missing pickup booking</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-white">
                  {['PO', 'Line', 'SKU', 'Vendor', 'Destination', 'PGRD', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={`${l.po}-${l.line}`} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2.5 font-medium text-[#111]">{l.po}</td>
                    <td className="px-4 py-2.5 text-[#555]">{l.line}</td>
                    <td className="px-4 py-2.5 text-[#555]">{l.sku}</td>
                    <td className="px-4 py-2.5 text-[#555]">{l.supplier}</td>
                    <td className="px-4 py-2.5 text-[#555]">{l.destination}</td>
                    <td className="px-4 py-2.5 text-[#555]">{formatDateShort(l.pgrd)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-[#FEE2E2] text-fail px-2 py-0.5 rounded-full">No ESD</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

