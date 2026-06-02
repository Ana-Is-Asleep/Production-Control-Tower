'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../context/DataContext';
import { useFilters } from '../hooks/useFilters';
import { useAnnotations } from '../hooks/useAnnotations';
import { useKPIs } from '../hooks/useKPIs';
import { UploadPanel } from './upload/UploadPanel';
import { OpenActions } from './shared/OpenActions';
import { Button } from './shared/Button';
import type { PurchaseLine } from '../types';

export function Dashboard() {
  const router = useRouter();
  const { allLines, setAllLines } = useData();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { weeklyLines, accumulatingLines, allSuppliers, lastWeek, lastYear, filters, setFilters } = useFilters(allLines);
  const annotations = useAnnotations();
  const kpis = useKPIs(weeklyLines, accumulatingLines);

  const allAnnotated = useMemo(() => {
    if (kpis.failingLines.length === 0) return allLines.length > 0;
    return kpis.failingLines.every((l) => annotations.isAnnotated(`${l.po}-${l.line}`));
  }, [kpis.failingLines, annotations, allLines.length]);

  const handleLoad = (lines: PurchaseLine[]) => {
    setAllLines(lines);
    annotations.reset();
  };

  const hasData = allLines.length > 0;

  return (
    <div className="min-h-screen w-full bg-white page-enter">
      {/* header */}
      <header className="bg-white border-b border-[#F0F0F0] px-6 py-3 flex items-center gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-serif font-bold text-brand text-xl">emma.</span>
          <span className="text-[#D0D0D0] text-xs">|</span>
          <span className="text-[#111] text-sm font-semibold">DDS Meeting Tool · P2W EU D2C</span>
        </div>
        <div className="flex-1" />
        {hasData && (
          <>
            <span className="text-xs bg-[#F7F7F7] border border-[#EBEBEB] rounded-lg px-3 py-1.5 text-[#555] font-medium">
              W{String(lastWeek).padStart(2, '0')} {lastYear}
            </span>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>↑ Upload</Button>
            <button
              disabled={!allAnnotated}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${allAnnotated ? 'bg-brand text-white' : 'bg-[#F0F0F0] text-[#AAA] cursor-not-allowed'}`}
            >
              {allAnnotated && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              Ready for Meeting
            </button>
          </>
        )}
        {!hasData && (
          <Button onClick={() => setUploadOpen(true)}>↑ Upload BC Files</Button>
        )}
      </header>

      {/* empty state */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
          <div className="text-center space-y-2">
            <p className="font-serif text-5xl font-bold text-[#111]">Ready when you are.</p>
            <p className="text-[#888] text-base mt-3">Upload your Business Central exports to see this week&apos;s data.</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="mt-2 bg-brand text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-brand-soft transition-colors"
          >
            ↑ Upload BC Files
          </button>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 opacity-30 pointer-events-none select-none w-full max-w-2xl">
            {['SOT + OTIF', 'Backlog', 'Not Booked', 'SKU Deep Dive'].map((label) => (
              <div key={label} className="bg-[#F7F7F7] rounded-2xl p-5 flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#AAA]">{label}</span>
                <span className="font-serif text-4xl font-bold text-[#CCC]">—</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* dashboard grid */}
      {hasData && (
        <div className="p-5 space-y-4">
          {/* primary KPI row */}
          <div className="grid grid-cols-3 gap-4">
            {/* SOT + OTIF card */}
            <div
              onClick={() => router.push('/sot-otif')}
              className="bg-white rounded-2xl border border-[#F0F0F0] p-6 cursor-pointer card-lift"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">SOT + OTIF</p>
              <div className="flex items-end gap-6 mb-4">
                <div>
                  <p className="font-serif text-5xl font-bold text-[#111]">
                    {kpis.sotPct !== null ? `${kpis.sotPct}%` : '—'}
                  </p>
                  <p className="text-xs text-[#888] mt-1">SOT · target 90%</p>
                  {kpis.sotPct !== null && (
                    <p className={`text-xs font-medium mt-0.5 ${kpis.sotPct >= 90 ? 'text-pass' : 'text-fail'}`}>
                      {kpis.sotPct >= 90 ? '↑' : '↓'} {Math.abs(kpis.sotPct - 90)}pp
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-serif text-5xl font-bold text-[#111]">
                    {kpis.otifPct !== null ? `${kpis.otifPct}%` : '—'}
                  </p>
                  <p className="text-xs text-[#888] mt-1">OTIF · target 90%</p>
                  {kpis.otifPct !== null && (
                    <p className={`text-xs font-medium mt-0.5 ${kpis.otifPct >= 90 ? 'text-pass' : 'text-warn'}`}>
                      {kpis.otifPct >= 90 ? '↑' : '↓'} {Math.abs(kpis.otifPct - 90)}pp
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-brand font-medium">View detail →</p>
            </div>

            {/* Backlog card */}
            <div
              onClick={() => router.push('/backlog')}
              className="bg-white rounded-2xl border border-[#F0F0F0] p-6 cursor-pointer card-lift"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Backlog</p>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-fail" />
                    <span className="text-sm text-[#555]">Critical</span>
                  </div>
                  <span className="font-serif text-3xl font-bold text-fail">{kpis.backlogSummary.critical.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-warn" />
                    <span className="text-sm text-[#555]">Recent</span>
                  </div>
                  <span className="font-serif text-3xl font-bold text-warn">{kpis.backlogSummary.recent.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand" />
                    <span className="text-sm text-[#555]">At Risk</span>
                  </div>
                  <span className="font-serif text-3xl font-bold text-brand">{kpis.backlogSummary.atRisk.length}</span>
                </div>
              </div>
              <p className="text-xs text-brand font-medium">View detail →</p>
            </div>

            {/* Not Booked card */}
            <div
              onClick={() => router.push('/not-booked')}
              className="bg-white rounded-2xl border border-[#F0F0F0] p-6 cursor-pointer card-lift"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-4">Not Booked</p>
              <p className="font-serif text-6xl font-bold text-[#111] mb-1">{kpis.notBookedLines.length}</p>
              <p className="text-xs text-[#888] mb-4">lines without ESD this week</p>
              <p className="text-xs text-brand font-medium">View detail →</p>
            </div>
          </div>

          {/* secondary row */}
          <div className="grid grid-cols-4 gap-4">
            {/* SKU Deep Dive */}
            <div
              onClick={() => router.push('/sku')}
              className="bg-white rounded-2xl border border-[#F0F0F0] p-5 cursor-pointer card-lift"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">SKU Deep Dive</p>
              <p className="font-serif text-4xl font-bold text-[#111]">{weeklyLines.length}</p>
              <p className="text-xs text-[#888] mt-1">total lines this week</p>
              <p className="text-xs text-brand font-medium mt-3">View detail →</p>
            </div>

            {/* Invoices */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 card-lift" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">Invoices</p>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#555]">Overdue</span>
                  <span className="font-serif text-2xl font-bold text-fail">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#555]">P2W</span>
                  <span className="font-serif text-2xl font-bold text-warn">1</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#555]">On time</span>
                  <span className="font-serif text-2xl font-bold text-pass">14</span>
                </div>
              </div>
            </div>

            {/* Pickup Distribution */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 card-lift col-span-2" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#AAA] mb-3">Pickup Distribution</p>
              <div className="flex items-end gap-2 h-16">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
                  const count = weeklyLines.filter((l) => l.asd && l.asd.getDay() === i + 1).length;
                  const max = Math.max(1, ...(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((_, j) =>
                    weeklyLines.filter((l) => l.asd && l.asd.getDay() === j + 1).length
                  )));
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-brand rounded-t-sm transition-all"
                        style={{ height: `${Math.max(4, (count / max) * 48)}px`, opacity: count === 0 ? 0.15 : 1 }}
                      />
                      <span className="text-[10px] text-[#AAA]">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
      <OpenActions />
    </div>
  );
}
