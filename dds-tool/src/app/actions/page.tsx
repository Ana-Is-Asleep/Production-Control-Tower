'use client';

import { useState, useMemo, useEffect } from 'react';
import { NavTabs } from '../../components/shared/NavTabs';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort, getISOWeek } from '../../lib/dateUtils';
import { computeKPIs, filterByChannel, formatAmountsByCurrency } from '../../lib/invoiceUtils';
import type { PurchaseLine } from '../../types';
import type { InvoiceRow } from '../../types/invoice';

const STORAGE_KEY = 'dds-actions-v1';

type ActionEntry = { comment: string; done: boolean; updatedAt: string };
type ActionsStore = Record<string, ActionEntry>;

function loadStore(): ActionsStore {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function groupByPO(lines: PurchaseLine[]) {
  const map = new Map<string, {
    po: string; vendor: string; pgrd: Date | null; egrd: Date | null;
    esd: Date | null; lines: PurchaseLine[];
  }>();
  for (const l of lines) {
    if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, pgrd: l.pgrd, egrd: l.egrd, esd: l.esd, lines: [] });
    const entry = map.get(l.po)!;
    entry.lines.push(l);
    if (!entry.egrd && l.egrd) entry.egrd = l.egrd;
    if (!entry.esd && l.esd) entry.esd = l.esd;
  }
  return [...map.values()].sort((a, b) => (a.pgrd?.getTime() ?? 0) - (b.pgrd?.getTime() ?? 0));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function DeltaBadge({ days, label }: { days: number | null; label: string }) {
  if (days === null) return null;
  const color = days > 0 ? '#DC2626' : days < 0 ? '#34A853' : '#9c9794';
  return (
    <span className="text-[10px] text-[#9c9794]">
      {label} <span style={{ color }} className="font-semibold">{days > 0 ? `+${days}d` : `${days}d`}</span>
    </span>
  );
}

function ActionRow({
  id, po, vendor, pgrd, egrd, esd, bookedCount, totalQty, totalCqty, lineCount, badge, badgeColor, showEsd, store, onUpdate,
}: {
  id: string; po: string; vendor: string; pgrd: Date | null; egrd: Date | null; esd: Date | null;
  bookedCount: number; totalQty: number; totalCqty: number;
  lineCount: number; badge: string; badgeColor: string; showEsd?: boolean;
  store: ActionsStore; onUpdate: (id: string, u: Partial<ActionEntry>) => void;
}) {
  const entry = store[id];
  const done = entry?.done ?? false;
  const isBooked = bookedCount > 0;
  const dPgrdEgrd = daysBetween(pgrd, egrd);
  const dEgrdEsd  = daysBetween(egrd, esd);
  const dPgrdEsd  = daysBetween(pgrd, esd);
  return (
    <div className={`flex gap-4 items-start px-4 py-3 rounded-xl border transition-all ${done ? 'opacity-40 bg-[#f9f7f6] border-[#f4f1ef]' : 'bg-white border-[#e9e3df]'}`}
      style={{ boxShadow: done ? 'none' : 'var(--shadow-card)' }}>
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-[#403833] text-sm">{po}</span>
          <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: badgeColor }}>{badge}</span>
          {pgrd && <span className="text-[11px] text-[#9c9794]">PGRD {formatDateShort(pgrd)}</span>}
          {egrd && <span className="text-[11px] text-[#9c9794]">EGRD {formatDateShort(egrd)}</span>}
          {showEsd && esd && <span className="text-[11px] text-[#6469aa] font-semibold">Ships {formatDateShort(esd)}</span>}
          {!showEsd && esd && <span className="text-[11px] text-[#b5aaa5]">ESD {formatDateShort(esd)}</span>}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isBooked ? 'bg-[#34A853]/10 text-[#34A853]' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
            {isBooked ? `Booked${bookedCount < lineCount ? ` ${bookedCount}/${lineCount}` : ''}` : 'Not booked'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <DeltaBadge days={dPgrdEgrd} label="PGRD→EGRD" />
          <DeltaBadge days={dEgrdEsd}  label="EGRD→ESD" />
          <DeltaBadge days={dPgrdEsd}  label="PGRD→ESD" />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium text-[#58524e]">{vendor}</p>
          <p className="text-[10px] text-[#b5aaa5]">
            {lineCount} line{lineCount !== 1 ? 's' : ''} ·{' '}
            <span className={totalCqty < totalQty ? 'text-[#F59E0B] font-semibold' : ''}>
              {totalCqty.toLocaleString()} / {totalQty.toLocaleString()} confirmed
            </span>
          </p>
        </div>
      </div>
      <div className="flex gap-2 items-center w-72 shrink-0">
        <textarea
          value={entry?.comment ?? ''}
          onChange={e => onUpdate(id, { comment: e.target.value })}
          placeholder="Comment, action owner, ETA…"
          disabled={done}
          rows={2}
          className="flex-1 text-xs border border-[#e9e3df] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#403833] text-[#403833] placeholder-[#c8c0bb] disabled:bg-[#f9f7f6] disabled:text-[#b5aaa5]"
        />
        <button
          onClick={() => onUpdate(id, { done: !done })}
          className={`shrink-0 w-16 text-[11px] font-bold px-2 py-2 rounded-lg border transition-all ${done ? 'bg-[#34A853] text-white border-[#34A853]' : 'border-[#e9e3df] text-[#9c9794] hover:border-[#34A853] hover:text-[#34A853]'}`}
        >
          {done ? '✓ Done' : 'Done'}
        </button>
      </div>
    </div>
  );
}

function InvoiceRow_({ inv, store, onUpdate }: {
  inv: InvoiceRow; store: ActionsStore; onUpdate: (id: string, u: Partial<ActionEntry>) => void;
}) {
  const id = `inv-${inv.invoice}`;
  const entry = store[id];
  const done = entry?.done ?? false;
  return (
    <div className={`flex gap-4 items-start px-4 py-3 rounded-xl border transition-all ${done ? 'opacity-40 bg-[#f9f7f6] border-[#f4f1ef]' : 'bg-white border-[#e9e3df]'}`}
      style={{ boxShadow: done ? 'none' : 'var(--shadow-card)' }}>
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-[#403833] text-sm">{inv.invoice}</span>
          <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-[#DC2626]">Overdue</span>
          {inv.effectiveDueDate && <span className="text-[11px] text-[#9c9794]">Due {formatDateShort(inv.effectiveDueDate)}</span>}
        </div>
        <p className="text-xs font-medium text-[#58524e]">{inv.name}</p>
        <p className="text-[10px] text-[#b5aaa5]">{inv.currency} {inv.importedInvoiceAmount?.toLocaleString()}</p>
      </div>
      <div className="flex gap-2 items-center w-72 shrink-0">
        <textarea
          value={entry?.comment ?? ''}
          onChange={e => onUpdate(id, { comment: e.target.value })}
          placeholder="What's driving it? Who owns the action?"
          disabled={done}
          rows={2}
          className="flex-1 text-xs border border-[#e9e3df] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#403833] text-[#403833] placeholder-[#c8c0bb] disabled:bg-[#f9f7f6]"
        />
        <button
          onClick={() => onUpdate(id, { done: !done })}
          className={`shrink-0 w-16 text-[11px] font-bold px-2 py-2 rounded-lg border transition-all ${done ? 'bg-[#34A853] text-white border-[#34A853]' : 'border-[#e9e3df] text-[#9c9794] hover:border-[#34A853] hover:text-[#34A853]'}`}
        >
          {done ? '✓ Done' : 'Done'}
        </button>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-[#b5aaa5] text-center py-8">{msg}</p>;
}

// ── Supplier overview card ────────────────────────────────────────────────────

function SupplierCard({ name, overduePOs, notBookedPOs, storeProgress, onStart }: {
  name: string; overduePOs: number; notBookedPOs: number;
  storeProgress: { done: number; total: number } | null;
  onStart: () => void;
}) {
  const pct = storeProgress && storeProgress.total > 0
    ? Math.round(storeProgress.done / storeProgress.total * 100)
    : null;
  const allDone = pct === 100;
  const hasIssues = overduePOs > 0 || notBookedPOs > 0;

  return (
    <button
      onClick={onStart}
      className={`text-left bg-white rounded-2xl border p-4 w-full transition-all hover:border-[#403833] hover:shadow-md
        ${allDone ? 'border-[#34A853]/30 opacity-60' : 'border-[#e9e3df]'}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="font-bold text-[#403833] text-sm leading-snug">{name}</p>
        {pct !== null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2
            ${allDone ? 'bg-[#34A853]/10 text-[#34A853]' : 'bg-[#f4f1ef] text-[#9c9794]'}`}>
            {allDone ? '✓' : `${pct}%`}
          </span>
        )}
      </div>

      <div className="space-y-0.5 mb-3 min-h-[32px]">
        {overduePOs > 0 && (
          <p className="text-[11px] text-[#DC2626]">· {overduePOs} overdue PO{overduePOs !== 1 ? 's' : ''}</p>
        )}
        {notBookedPOs > 0 && (
          <p className="text-[11px] text-[#9c9794]">· {notBookedPOs} not booked</p>
        )}
        {!hasIssues && (
          <p className="text-[11px] text-[#34A853]">· No urgent issues</p>
        )}
      </div>

      {pct !== null && (
        <div className="h-1 bg-[#f4f1ef] rounded-full mb-2">
          <div className="h-1 rounded-full transition-all"
            style={{ width: `${pct}%`, background: allDone ? '#34A853' : '#F59E0B' }} />
        </div>
      )}

      <p className="text-[10px] text-[#9c9794]">
        {storeProgress ? `${storeProgress.done}/${storeProgress.total} done` : 'Not started'} · Review →
      </p>
    </button>
  );
}

// ── Wizard step bar ───────────────────────────────────────────────────────────

const STEP_LABELS  = ['Past Performance', 'Backlog', 'Forward Outlook', 'Recovery'];
const STEP_ACCENTS = ['#DC2626', '#F59E0B', '#6469aa', '#34A853'];

function StepBar({ step, onStep, openCounts }: {
  step: number; onStep: (s: number) => void; openCounts: number[];
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEP_LABELS.map((label, i) => {
        const isActive = i === step;
        const isDone   = openCounts[i] === 0 && i !== step;
        const accent   = STEP_ACCENTS[i];
        return (
          <button
            key={i}
            onClick={() => onStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${isActive ? 'bg-[#403833] text-white' : 'text-[#58524e] hover:bg-[#f4f1ef]'}`}
          >
            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0`}
              style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : isDone ? '#34A853' : openCounts[i] > 0 ? accent : '#f4f1ef',
                color: isActive ? 'white' : isDone ? 'white' : openCounts[i] > 0 ? 'white' : '#9c9794',
              }}>
              {isDone ? '✓' : openCounts[i] > 0 ? openCounts[i] : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const { allLines, globalFilters, invoices } = useData();
  const [supplier, setSupplier] = useState('');
  const [step, setStep]         = useState(0);
  const [store, setStore]       = useState<ActionsStore>({});

  useEffect(() => { setStore(loadStore()); }, []);

  const preFilteredLines = useMemo(() => {
    const suppliers = supplier ? [supplier] : (globalFilters?.suppliers ?? []);
    if (suppliers.length === 0) return allLines;
    return allLines.filter(l => suppliers.includes(l.supplier));
  }, [allLines, supplier, globalFilters?.suppliers]);

  const { weeklyLines, accumulatingLines, allD2cLines, lastWeek, lastYear } = useFilters(preFilteredLines, {
    suppliers: [],
    categories: globalFilters?.categories ?? [],
    pgrdWeek: globalFilters?.pgrdWeek ?? null,
  });

  const allSuppliers = useMemo(
    () => [...new Set(allLines.map(l => l.supplier))].sort(),
    [allLines]
  );

  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);
  const invoiceKPIs = useMemo(() => computeKPIs(filterByChannel(invoices, 'All')), [invoices]);

  const pastPOs     = useMemo(() => groupByPO(kpis.failingLines),                [kpis.failingLines]);
  const criticalPOs = useMemo(() => groupByPO(kpis.backlogSummary.critical),     [kpis.backlogSummary.critical]);
  const recentPOs   = useMemo(() => groupByPO(kpis.backlogSummary.recent),       [kpis.backlogSummary.recent]);
  const futurePOs   = useMemo(() => groupByPO(kpis.backlogSummary.futureBacklog),[kpis.backlogSummary.futureBacklog]);
  const notBooked   = useMemo(() => groupByPO(kpis.notBookedLines),              [kpis.notBookedLines]);

  function update(id: string, u: Partial<ActionEntry>) {
    setStore(prev => {
      const existing: ActionEntry = prev[id] ?? { comment: '', done: false, updatedAt: new Date().toISOString() };
      const next = { ...prev, [id]: { ...existing, ...u, updatedAt: new Date().toISOString() } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function openCount(keys: string[]) {
    return keys.filter(k => !store[k]?.done).length;
  }

  const s1Open = openCount(pastPOs.map(p => `past-${p.po}`));
  const s2Open = openCount([...criticalPOs.map(p => `crit-${p.po}`), ...recentPOs.map(p => `rec-${p.po}`)]);
  const s3Open = openCount(futurePOs.map(p => `out-${p.po}`));
  const s4Open = openCount([...notBooked.map(p => `nb-${p.po}`), ...invoiceKPIs.overdueP2w.map(i => `inv-${i.invoice}`)]);
  const openCounts = [s1Open, s2Open, s3Open, s4Open];
  const totalOpen  = s1Open + s2Open + s3Open + s4Open;

  // ── Per-supplier overview stats (overview mode only) ─────────────────────
  const poToSupplier = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of allLines) map.set(l.po, l.supplier);
    return map;
  }, [allLines]);

  const supplierOverdueMap = useMemo(() => {
    const today = new Date();
    const map = new Map<string, { overdue: Set<string>; notBooked: Set<string> }>();
    for (const l of allLines) {
      if (!map.has(l.supplier)) map.set(l.supplier, { overdue: new Set(), notBooked: new Set() });
      const s = map.get(l.supplier)!;
      if (l.pgrd && l.pgrd < today && !l.asd) s.overdue.add(l.po);
      if (!l.edd && !l.asd && l.pgrd && l.pgrd.getFullYear() >= 2025) s.notBooked.add(l.po);
    }
    return map;
  }, [allLines]);

  const supplierStoreProgress = useMemo(() => {
    const result = new Map<string, { done: number; total: number }>();
    for (const [key, entry] of Object.entries(store)) {
      const po  = key.replace(/^(past|crit|rec|out|nb)-/, '');
      const sup = poToSupplier.get(po);
      if (!sup) continue;
      if (!result.has(sup)) result.set(sup, { done: 0, total: 0 });
      const s = result.get(sup)!;
      s.total++;
      if (entry.done) s.done++;
    }
    return result;
  }, [store, poToSupplier]);

  function startReview(s: string) {
    setSupplier(s);
    setStep(0);
  }

  // ── Sorted supplier list for overview: urgent first ─────────────────────
  const sortedSuppliers = useMemo(() => {
    return [...allSuppliers].sort((a, b) => {
      const aStats = supplierOverdueMap.get(a);
      const bStats = supplierOverdueMap.get(b);
      const aScore = (aStats?.overdue.size ?? 0) * 3 + (aStats?.notBooked.size ?? 0);
      const bScore = (bStats?.overdue.size ?? 0) * 3 + (bStats?.notBooked.size ?? 0);
      return bScore - aScore;
    });
  }, [allSuppliers, supplierOverdueMap]);

  const hasData = allLines.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f2ee] page-enter">

      {/* Header */}
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

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {!supplier && (
        <div className="px-6 py-6 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#403833]">Weekly DDS Review</h1>
            <p className="text-sm text-[#9c9794] mt-0.5">Select a supplier to start your step-by-step review</p>
          </div>

          {!hasData ? (
            <p className="text-sm text-[#b5aaa5] text-center py-16">Upload data to begin</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedSuppliers.map(s => {
                const stats = supplierOverdueMap.get(s);
                return (
                  <SupplierCard
                    key={s}
                    name={s}
                    overduePOs={stats?.overdue.size ?? 0}
                    notBookedPOs={stats?.notBooked.size ?? 0}
                    storeProgress={supplierStoreProgress.get(s) ?? null}
                    onStart={() => startReview(s)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── WIZARD ────────────────────────────────────────────────────────── */}
      {!!supplier && (
        <div className="px-6 py-5 max-w-4xl mx-auto space-y-5">

          {/* Wizard header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSupplier('')}
                className="text-xs text-[#9c9794] hover:text-[#403833] transition-colors flex items-center gap-1"
              >
                ← Overview
              </button>
              <span className="text-[#d5cdc6]">·</span>
              <select
                value={supplier}
                onChange={e => { setSupplier(e.target.value); setStep(0); }}
                className="text-sm font-bold text-[#403833] bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {totalOpen > 0
              ? <p className="text-[#DC2626] font-extrabold text-2xl leading-none">{totalOpen} open</p>
              : <p className="text-[#34A853] font-bold text-sm">All done ✓</p>
            }
          </div>

          {/* Step bar */}
          <div className="bg-white rounded-2xl border border-[#e9e3df] px-5 py-3" style={{ boxShadow: 'var(--shadow-card)' }}>
            <StepBar step={step} onStep={setStep} openCounts={openCounts} />
          </div>

          {/* ── Step 1: Past Performance ─────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e9e3df] bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)', borderLeft: '4px solid #DC2626' }}>
                <div className="px-6 pt-5 pb-4 space-y-4">
                  {/* Auto data summary */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c9794]">SOT</span>
                      <span className={`text-2xl font-extrabold leading-none ${(kpis.sotPct ?? 0) >= 90 ? 'text-[#34A853]' : 'text-[#DC2626]'}`}>
                        {kpis.sotPct !== null ? `${kpis.sotPct}%` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c9794]">OTIF</span>
                      <span className={`text-2xl font-extrabold leading-none ${(kpis.otifPct ?? 0) >= 90 ? 'text-[#34A853]' : 'text-[#DC2626]'}`}>
                        {kpis.otifPct !== null ? `${kpis.otifPct}%` : '—'}
                      </span>
                    </div>
                    <div className="text-xs text-[#9c9794]">
                      <span className="font-semibold text-[#DC2626]">{pastPOs.length}</span> POs not shipped on time
                      {pastPOs.length > 0 && (
                        <>
                          {' · '}
                          <span className={pastPOs.filter(p => p.lines.some(l => l.edd)).length === pastPOs.length ? 'text-[#34A853]' : 'text-[#DC2626]'}>
                            {pastPOs.filter(p => p.lines.some(l => l.edd)).length}/{pastPOs.length} booked
                          </span>
                          {' · '}
                          <span className={pastPOs.filter(p => !p.egrd).length > 0 ? 'text-[#F59E0B]' : 'text-[#34A853]'}>
                            {pastPOs.filter(p => !p.egrd).length} missing EGRD
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ESD by week — auto-answers "when will they ship?" */}
                  {pastPOs.length > 0 && (() => {
                    const byWeek = new Map<string, number>();
                    let noEsd = 0;
                    for (const p of pastPOs) {
                      if (p.esd) {
                        const label = `W${String(getISOWeek(p.esd)).padStart(2, '0')}`;
                        byWeek.set(label, (byWeek.get(label) ?? 0) + 1);
                      } else {
                        noEsd++;
                      }
                    }
                    const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c9794]">Ships</span>
                        {weeks.map(([w, n]) => (
                          <span key={w} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#6469aa]/10 text-[#6469aa]">
                            {w}: {n} PO{n !== 1 ? 's' : ''}
                          </span>
                        ))}
                        {noEsd > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DC2626]/10 text-[#DC2626]">
                            No ESD: {noEsd}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* What to check */}
                  <div className="rounded-xl px-4 py-3 space-y-1 bg-[#DC262608]">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#DC2626]">What to check</p>
                    {['When will they be shipped (by week)?', 'Are all POs booked? Any missing ASD cases?', 'Why were POs delayed? — clear split of root causes', 'Is EGRD properly updated? How many POs are missing EGRD?'].map((q, i) => (
                      <p key={i} className="text-[11px] text-[#403833] leading-relaxed">· {q}</p>
                    ))}
                  </div>
                </div>
              </div>

              {pastPOs.length === 0
                ? <Empty msg={`No late POs for ${supplier} this week`} />
                : pastPOs.map(p => (
                  <ActionRow key={`past-${p.po}`} id={`past-${p.po}`}
                    po={p.po} vendor={p.vendor} pgrd={p.pgrd} egrd={p.egrd} esd={p.esd}
                    bookedCount={p.lines.filter(l => l.edd !== null).length}
                    totalQty={p.lines.reduce((s, l) => s + l.qty, 0)} totalCqty={p.lines.reduce((s, l) => s + l.cqty, 0)}
                    lineCount={p.lines.length} badge="Late" badgeColor="#DC2626"
                    store={store} onUpdate={update} />
                ))
              }
            </div>
          )}

          {/* ── Step 2: Backlog Management ────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e9e3df] bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)', borderLeft: '4px solid #F59E0B' }}>
                <div className="px-6 pt-5 pb-4 space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#DC2626]">Critical</span>
                      <span className="text-2xl font-extrabold leading-none text-[#DC2626]">{criticalPOs.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B]">Recent</span>
                      <span className="text-2xl font-extrabold leading-none text-[#F59E0B]">{recentPOs.length}</span>
                    </div>
                    {criticalPOs.length > 0 && (
                      <p className="text-xs text-[#9c9794]">
                        <span className={criticalPOs.filter(p => p.lines.some(l => l.edd)).length === criticalPOs.length ? 'text-[#34A853]' : 'text-[#DC2626]'}>
                          {criticalPOs.filter(p => p.lines.some(l => l.edd)).length}/{criticalPOs.length} critical booked
                        </span>
                        {' · '}
                        <span className={criticalPOs.filter(p => !p.esd).length > 0 ? 'text-[#F59E0B]' : ''}>
                          {criticalPOs.filter(p => !p.esd).length} missing ship date
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl px-4 py-3 space-y-1 bg-[#F59E0B08]">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#F59E0B]">What to check</p>
                    {['Critical: When will they be shipped? What is blocking execution?', 'Critical: Is EGRD fully updated? Are bookings in place?', 'Recent: Are we preventing these from becoming critical?'].map((q, i) => (
                      <p key={i} className="text-[11px] text-[#403833] leading-relaxed">· {q}</p>
                    ))}
                  </div>
                </div>
              </div>

              {criticalPOs.length === 0 && recentPOs.length === 0
                ? <Empty msg="No backlog POs" />
                : <>
                  {criticalPOs.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-[#DC2626]">Critical backlog</p>}
                  {criticalPOs.map(p => (
                    <ActionRow key={`crit-${p.po}`} id={`crit-${p.po}`}
                      po={p.po} vendor={p.vendor} pgrd={p.pgrd} egrd={p.egrd} esd={p.esd}
                      bookedCount={p.lines.filter(l => l.edd !== null).length}
                      totalQty={p.lines.reduce((s, l) => s + l.qty, 0)} totalCqty={p.lines.reduce((s, l) => s + l.cqty, 0)}
                      lineCount={p.lines.length} badge="Critical" badgeColor="#DC2626"
                      showEsd store={store} onUpdate={update} />
                  ))}
                  {recentPOs.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] mt-2">Recent backlog</p>}
                  {recentPOs.map(p => (
                    <ActionRow key={`rec-${p.po}`} id={`rec-${p.po}`}
                      po={p.po} vendor={p.vendor} pgrd={p.pgrd} egrd={p.egrd} esd={p.esd}
                      bookedCount={p.lines.filter(l => l.edd !== null).length}
                      totalQty={p.lines.reduce((s, l) => s + l.qty, 0)} totalCqty={p.lines.reduce((s, l) => s + l.cqty, 0)}
                      lineCount={p.lines.length} badge="Recent" badgeColor="#F59E0B"
                      showEsd store={store} onUpdate={update} />
                  ))}
                </>
              }
            </div>
          )}

          {/* ── Step 3: Forward Performance Outlook ───────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e9e3df] bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)', borderLeft: '4px solid #6469aa' }}>
                <div className="px-6 pt-5 pb-4 space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c9794]">At risk</span>
                      <span className="text-2xl font-extrabold leading-none text-[#6469aa]">{futurePOs.length}</span>
                    </div>
                    {futurePOs.length > 0 && (
                      <p className="text-xs text-[#9c9794]">
                        <span className={futurePOs.filter(p => !p.lines.some(l => l.edd)).length > 0 ? 'text-[#DC2626]' : 'text-[#34A853]'}>
                          {futurePOs.filter(p => !p.lines.some(l => l.edd)).length} not booked
                        </span>
                        {' · '}
                        {futurePOs.filter(p => p.egrd && p.esd && p.esd > p.egrd).length} with ESD after EGRD
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl px-4 py-3 space-y-1 bg-[#6469aa08]">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#6469aa]">What to check</p>
                    {['Is everything properly booked?', 'Does EGRD = Booking? If not, why is there a gap?', 'Does supplier have raw materials to produce by target week?', 'Future backlog — consider PGRD vs ESD gap.'].map((q, i) => (
                      <p key={i} className="text-[11px] text-[#403833] leading-relaxed">· {q}</p>
                    ))}
                  </div>
                </div>
              </div>

              {futurePOs.length === 0
                ? <Empty msg="No future backlog risk" />
                : futurePOs.map(p => (
                  <ActionRow key={`out-${p.po}`} id={`out-${p.po}`}
                    po={p.po} vendor={p.vendor} pgrd={p.pgrd} egrd={p.egrd} esd={p.esd}
                    bookedCount={p.lines.filter(l => l.edd !== null).length}
                    totalQty={p.lines.reduce((s, l) => s + l.qty, 0)} totalCqty={p.lines.reduce((s, l) => s + l.cqty, 0)}
                    lineCount={p.lines.length} badge="At risk" badgeColor="#6469aa"
                    showEsd store={store} onUpdate={update} />
                ))
              }
            </div>
          )}

          {/* ── Step 4: Recovery & Additional Risks ───────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e9e3df] bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)', borderLeft: '4px solid #34A853' }}>
                <div className="px-6 pt-5 pb-4 space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c9794]">Not booked</span>
                      <span className="text-2xl font-extrabold leading-none text-[#403833]">{notBooked.length}</span>
                    </div>
                    {invoiceKPIs.overdueP2w.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9c9794]">Overdue inv.</span>
                        <span className="text-2xl font-extrabold leading-none text-[#DC2626]">{invoiceKPIs.overdueP2w.length}</span>
                        <span className="text-xs text-[#9c9794]">— {formatAmountsByCurrency(invoiceKPIs.overdueP2w)}</span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl px-4 py-3 space-y-1 bg-[#34A85308]">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#34A853]">What to check</p>
                    {['POs not booked — when will ESD be confirmed?', 'Overdue invoices — what is driving it? (CMR, GR, documentation, transport)', 'When will it be resolved? Who owns the action?'].map((q, i) => (
                      <p key={i} className="text-[11px] text-[#403833] leading-relaxed">· {q}</p>
                    ))}
                  </div>
                </div>
              </div>

              {notBooked.length === 0 && invoiceKPIs.overdueP2w.length === 0
                ? <Empty msg="No risks flagged" />
                : <>
                  {notBooked.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8A8A]">Missing pickup booking</p>}
                  {notBooked.map(p => (
                    <ActionRow key={`nb-${p.po}`} id={`nb-${p.po}`}
                      po={p.po} vendor={p.vendor} pgrd={p.pgrd} egrd={p.egrd} esd={p.esd}
                      bookedCount={p.lines.filter(l => l.edd !== null).length}
                      totalQty={p.lines.reduce((s, l) => s + l.qty, 0)} totalCqty={p.lines.reduce((s, l) => s + l.cqty, 0)}
                      lineCount={p.lines.length} badge="No ESD" badgeColor="#8A8A8A"
                      store={store} onUpdate={update} />
                  ))}
                  {invoiceKPIs.overdueP2w.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-[#DC2626] mt-2">Overdue invoices (P2W)</p>}
                  {invoiceKPIs.overdueP2w.map(inv => (
                    <InvoiceRow_ key={`inv-${inv.invoice}`} inv={inv} store={store} onUpdate={update} />
                  ))}
                </>
              }
            </div>
          )}

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : setSupplier('')}
              className="text-sm font-semibold text-[#58524e] hover:text-[#403833] px-4 py-2 rounded-lg border border-[#e9e3df] bg-white hover:border-[#403833] transition-all"
            >
              {step === 0 ? '← Overview' : '← Previous'}
            </button>

            {step < 3
              ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="text-sm font-semibold text-white px-6 py-2 rounded-lg bg-[#403833] hover:bg-[#58524e] transition-all"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => setSupplier('')}
                  className={`text-sm font-semibold px-6 py-2 rounded-lg transition-all ${totalOpen === 0 ? 'bg-[#34A853] text-white' : 'bg-[#403833] text-white hover:bg-[#58524e]'}`}
                >
                  {totalOpen === 0 ? 'Done ✓ → Overview' : 'Back to Overview'}
                </button>
              )
            }
          </div>

        </div>
      )}

    </div>
  );
}
