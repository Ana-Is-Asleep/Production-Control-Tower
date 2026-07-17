'use client';

import { useState, useMemo, useEffect } from 'react';
import { NavTabs } from '../../components/shared/NavTabs';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../hooks/useFilters';
import { useKPIs } from '../../hooks/useKPIs';
import { formatDateShort } from '../../lib/dateUtils';
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
  const map = new Map<string, { po: string; vendor: string; pgrd: Date | null; esd: Date | null; lines: PurchaseLine[] }>();
  for (const l of lines) {
    if (!map.has(l.po)) map.set(l.po, { po: l.po, vendor: l.supplier, pgrd: l.pgrd, esd: l.esd, lines: [] });
    map.get(l.po)!.lines.push(l);
  }
  return [...map.values()].sort((a, b) => (a.pgrd?.getTime() ?? 0) - (b.pgrd?.getTime() ?? 0));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionRow({
  id, po, vendor, pgrd, esd, lineCount, badge, badgeColor, store, onUpdate,
}: {
  id: string; po: string; vendor: string; pgrd: Date | null; esd: Date | null;
  lineCount: number; badge: string; badgeColor: string;
  store: ActionsStore; onUpdate: (id: string, u: Partial<ActionEntry>) => void;
}) {
  const entry = store[id];
  const done = entry?.done ?? false;
  return (
    <div className={`flex gap-4 items-start px-4 py-3 rounded-xl border transition-all ${done ? 'opacity-40 bg-[#f9f7f6] border-[#f4f1ef]' : 'bg-white border-[#e9e3df]'}`}
      style={{ boxShadow: done ? 'none' : 'var(--shadow-card)' }}>
      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-[#403833] text-sm">{po}</span>
          <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: badgeColor }}>{badge}</span>
          {pgrd && <span className="text-[11px] text-[#9c9794]">PGRD {formatDateShort(pgrd)}</span>}
          {esd && <span className="text-[11px] text-[#b5aaa5]">ESD {formatDateShort(esd)}</span>}
        </div>
        <p className="text-xs font-medium text-[#58524e]">{vendor}</p>
        <p className="text-[10px] text-[#b5aaa5]">{lineCount} line{lineCount !== 1 ? 's' : ''}</p>
      </div>
      {/* Comment + done */}
      <div className="flex gap-2 items-center w-80 shrink-0">
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
      <div className="flex gap-2 items-center w-80 shrink-0">
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

function Section({
  num, title, accent, prompts, summary, children, open, total,
}: {
  num: string; title: string; accent: string; prompts: string[];
  summary: React.ReactNode; children: React.ReactNode; open: number; total: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const done = total - open;
  return (
    <div className="bg-white rounded-2xl border border-[#e9e3df] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        style={{ borderLeft: `4px solid ${accent}` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold text-[#403833]">{num}. {title}</span>
          {total > 0 ? (
            <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: open > 0 ? accent : '#b5aaa5' }}>
              {open > 0 ? `${open} open` : 'All done ✓'}
            </span>
          ) : (
            <span className="text-[11px] text-[#b5aaa5]">No items</span>
          )}
          {done > 0 && open > 0 && <span className="text-[11px] text-[#b5aaa5]">{done} done</span>}
        </div>
        <span className="text-[#b5aaa5] text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-4 border-t border-[#f4f1ef]">
          {/* Auto summary */}
          <div className="pt-4 text-xs text-[#58524e]">{summary}</div>

          {/* What to check prompts */}
          <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: `${accent}18` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>What to check</p>
            {prompts.map((p, i) => (
              <p key={i} className="text-[11px] text-[#403833] leading-relaxed">· {p}</p>
            ))}
          </div>

          {/* Items */}
          <div className="space-y-2">{children}</div>
        </div>
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-[#b5aaa5] text-center py-6">{msg}</p>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const { allLines, globalFilters, invoices } = useData();
  const [supplier, setSupplier] = useState('');
  const [store, setStore] = useState<ActionsStore>({});

  useEffect(() => { setStore(loadStore()); }, []);

  const appliedFilters = useMemo(() => ({
    ...(globalFilters ?? {}),
    suppliers: supplier ? [supplier] : (globalFilters?.suppliers ?? []),
  }), [globalFilters, supplier]);

  const { weeklyLines, accumulatingLines, allD2cLines, allSuppliers, lastWeek, lastYear } = useFilters(allLines, appliedFilters);
  const kpis = useKPIs(weeklyLines, accumulatingLines, allD2cLines);
  const invoiceKPIs = useMemo(() => computeKPIs(filterByChannel(invoices, 'All')), [invoices]);

  const pastPOs     = useMemo(() => groupByPO(kpis.failingLines),                  [kpis.failingLines]);
  const criticalPOs = useMemo(() => groupByPO(kpis.backlogSummary.critical),        [kpis.backlogSummary.critical]);
  const recentPOs   = useMemo(() => groupByPO(kpis.backlogSummary.recent),          [kpis.backlogSummary.recent]);
  const futurePOs   = useMemo(() => groupByPO(kpis.backlogSummary.futureBacklog),   [kpis.backlogSummary.futureBacklog]);
  const notBooked   = useMemo(() => groupByPO(kpis.notBookedLines),                 [kpis.notBookedLines]);

  function update(id: string, u: Partial<ActionEntry>) {
    setStore(prev => {
      const existing: ActionEntry = prev[id] ?? { comment: '', done: false, updatedAt: new Date().toISOString() };
      const next = { ...prev, [id]: { ...existing, ...u, updatedAt: new Date().toISOString() } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function counts(keys: string[]) {
    const open = keys.filter(k => !store[k]?.done).length;
    return { total: keys.length, open };
  }

  const s1 = counts(pastPOs.map(p => `past-${p.po}`));
  const s2 = counts([...criticalPOs.map(p => `crit-${p.po}`), ...recentPOs.map(p => `rec-${p.po}`)]);
  const s3 = counts(futurePOs.map(p => `out-${p.po}`));
  const s4 = counts([...notBooked.map(p => `nb-${p.po}`), ...invoiceKPIs.overdueP2w.map(i => `inv-${i.invoice}`)]);
  const totalOpen = s1.open + s2.open + s3.open + s4.open;
  const isFiltered = !!supplier;

  return (
    <div className="min-h-screen bg-[#f5f2ee] page-enter">
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

      <div className="px-6 py-5 max-w-4xl mx-auto space-y-5">

        {/* Top bar: supplier filter + count */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1.5">Filter by supplier</p>
            <select
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              className="text-sm border border-[#e9e3df] rounded-xl px-4 py-2 bg-white focus:outline-none focus:border-[#403833] text-[#403833] font-semibold cursor-pointer"
            >
              <option value="">All suppliers</option>
              {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {isFiltered && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-[#9c9794]">Open actions for {supplier}</p>
              <p className="text-4xl font-extrabold leading-none" style={{ color: totalOpen > 0 ? '#DC2626' : '#34A853' }}>{totalOpen}</p>
            </div>
          )}
        </div>

        {/* ── 1. Past Performance ───────────────────────────────────────── */}
        <Section
          num="1" title="Past Performance" accent="#DC2626"
          prompts={[
            'When will they be shipped (by week)?',
            'Are all POs booked? Any missing ASD cases?',
            'Why were POs delayed? — clear split of root causes',
            'Is EGRD properly updated? How many POs are missing EGRD?',
          ]}
          summary={
            <span>
              SOT <strong>{kpis.sotPct ?? '—'}%</strong>
              {' · '}OTIF <strong>{kpis.otifPct ?? '—'}%</strong>
              {' · '}<strong>{pastPOs.length}</strong> POs not shipped on time
            </span>
          }
          open={s1.open} total={s1.total}
        >
          {pastPOs.length === 0
            ? <Empty msg={supplier ? `No late POs for ${supplier} this week` : 'No late POs this week'} />
            : pastPOs.map(p => (
              <ActionRow key={`past-${p.po}`} id={`past-${p.po}`}
                po={p.po} vendor={p.vendor} pgrd={p.pgrd} esd={p.esd}
                lineCount={p.lines.length} badge="Late" badgeColor="#DC2626"
                store={store} onUpdate={update} />
            ))
          }
        </Section>

        {/* ── 2. Backlog Management ─────────────────────────────────────── */}
        <Section
          num="2" title="Backlog Management" accent="#F59E0B"
          prompts={[
            'Critical: When will they be shipped? What is blocking execution?',
            'Critical: Is EGRD fully updated? Are bookings in place?',
            'Recent: Are we preventing these from becoming critical?',
            'Recent: Same questions with focus on early correction.',
          ]}
          summary={
            <span>
              <strong className="text-[#DC2626]">{criticalPOs.length} critical</strong>
              {' · '}
              <strong className="text-[#F59E0B]">{recentPOs.length} recent</strong>
              {' · '}
              <strong>{futurePOs.length} future</strong> backlog POs
            </span>
          }
          open={s2.open} total={s2.total}
        >
          {criticalPOs.length === 0 && recentPOs.length === 0
            ? <Empty msg="No backlog POs" />
            : <>
                {criticalPOs.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#DC2626]">Critical backlog</p>
                )}
                {criticalPOs.map(p => (
                  <ActionRow key={`crit-${p.po}`} id={`crit-${p.po}`}
                    po={p.po} vendor={p.vendor} pgrd={p.pgrd} esd={p.esd}
                    lineCount={p.lines.length} badge="Critical" badgeColor="#DC2626"
                    store={store} onUpdate={update} />
                ))}
                {recentPOs.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] mt-3">Recent backlog</p>
                )}
                {recentPOs.map(p => (
                  <ActionRow key={`rec-${p.po}`} id={`rec-${p.po}`}
                    po={p.po} vendor={p.vendor} pgrd={p.pgrd} esd={p.esd}
                    lineCount={p.lines.length} badge="Recent" badgeColor="#F59E0B"
                    store={store} onUpdate={update} />
                ))}
              </>
          }
        </Section>

        {/* ── 3. Forward Performance Outlook ───────────────────────────── */}
        <Section
          num="3" title="Forward Performance Outlook" accent="#6469aa"
          prompts={[
            'Is everything properly booked?',
            'Does EGRD = Booking? If not, why is there a gap?',
            'Does supplier have raw materials to produce by target week?',
            'What are the expected delays and root causes?',
            'Future backlog — consider PGRD vs ESD gap.',
          ]}
          summary={
            <span>
              <strong>{futurePOs.length}</strong> POs at risk in upcoming weeks
            </span>
          }
          open={s3.open} total={s3.total}
        >
          {futurePOs.length === 0
            ? <Empty msg="No future backlog risk" />
            : futurePOs.map(p => (
              <ActionRow key={`out-${p.po}`} id={`out-${p.po}`}
                po={p.po} vendor={p.vendor} pgrd={p.pgrd} esd={p.esd}
                lineCount={p.lines.length} badge="At risk" badgeColor="#6469aa"
                store={store} onUpdate={update} />
            ))
          }
        </Section>

        {/* ── 4. Recovery & Additional Risks ───────────────────────────── */}
        <Section
          num="4" title="Recovery & Additional Risks" accent="#34A853"
          prompts={[
            'POs not booked — when will ESD be confirmed?',
            'Overdue invoices — what is driving it? (CMR, GR, documentation, transport)',
            'When will it be resolved? Who owns the action?',
          ]}
          summary={
            <span>
              <strong>{notBooked.length}</strong> POs missing pickup booking
              {invoiceKPIs.overdueP2w.length > 0 && (
                <> · <strong className="text-[#DC2626]">{invoiceKPIs.overdueP2w.length}</strong> overdue invoices — {formatAmountsByCurrency(invoiceKPIs.overdueP2w)}</>
              )}
            </span>
          }
          open={s4.open} total={s4.total}
        >
          {notBooked.length === 0 && invoiceKPIs.overdueP2w.length === 0
            ? <Empty msg="No risks flagged" />
            : <>
                {notBooked.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8A8A]">Missing pickup booking</p>
                )}
                {notBooked.map(p => (
                  <ActionRow key={`nb-${p.po}`} id={`nb-${p.po}`}
                    po={p.po} vendor={p.vendor} pgrd={p.pgrd} esd={p.esd}
                    lineCount={p.lines.length} badge="No ESD" badgeColor="#8A8A8A"
                    store={store} onUpdate={update} />
                ))}
                {invoiceKPIs.overdueP2w.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#DC2626] mt-3">Overdue invoices (P2W)</p>
                )}
                {invoiceKPIs.overdueP2w.map(inv => (
                  <InvoiceRow_ key={`inv-${inv.invoice}`} inv={inv} store={store} onUpdate={update} />
                ))}
              </>
          }
        </Section>

      </div>
    </div>
  );
}
