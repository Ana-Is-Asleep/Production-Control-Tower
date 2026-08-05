'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../shared/DataTable';
import { SlideOver } from '../shared/SlideOver';
import { getISOWeek, getISOWeekYear } from '../../lib/dateUtils';
import type { WeekInRange } from '../../hooks/useFilters';
import type { PurchaseLine } from '../../types';

interface MissingESDSectionProps {
  lines: PurchaseLine[];
  weeksInRange: WeekInRange[];
  supplierFilterActive: boolean;
}

interface QualifyingPO {
  po: string;
  supplier: string;
  qty: number;
}

interface WeekRow {
  weekLabel: string;
  offset: number;
  isFuture: boolean;
  pos: QualifyingPO[];
}

// Small hover popover showing supplier breakdown — only relevant when Supplier filter = All.
function SupplierBreakdownHover({ pos }: { pos: QualifyingPO[] }) {
  const [open, setOpen] = useState(false);
  const bySupplier = useMemo(() => {
    const map = new Map<string, number>();
    pos.forEach((p) => map.set(p.supplier, (map.get(p.supplier) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [pos]);

  if (pos.length === 0) return <span className="text-[#b5aaa5]">0</span>;

  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="kpi-number font-extrabold text-lg text-fail cursor-default">{pos.length}</span>
      {open && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg py-2 px-3 w-56 text-left"
          style={{ boxShadow: 'var(--shadow-card-hover)' }}
        >
          <p className="text-[10px] uppercase tracking-widest text-[#9c9794] mb-1">By supplier</p>
          {bySupplier.map(([supplier, count]) => (
            <div key={supplier} className="flex justify-between text-xs py-0.5">
              <span className="text-[#403833] truncate mr-2">{supplier}</span>
              <span className="font-semibold text-[#7b7571]">{count}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

export function MissingESDSection({ lines, weeksInRange, supplierFilterActive }: MissingESDSectionProps) {
  const [open, setOpen] = useState(false);
  const [detailWeek, setDetailWeek] = useState<WeekRow | null>(null);

  const rows = useMemo((): WeekRow[] => {
    return weeksInRange.map((week) => {
      const weekLines = lines.filter(
        (l) => l.pgrd && getISOWeek(l.pgrd) === week.week && getISOWeekYear(l.pgrd) === week.year
      );
      const byPO = new Map<string, PurchaseLine[]>();
      weekLines.forEach((l) => {
        if (!byPO.has(l.po)) byPO.set(l.po, []);
        byPO.get(l.po)!.push(l);
      });

      const pos: QualifyingPO[] = [];
      byPO.forEach((poLines, po) => {
        const noESD = poLines.every((l) => !l.esd);
        const totalQty = poLines.reduce((s, l) => s + l.cqty, 0);
        if (noESD && totalQty > 1) pos.push({ po, supplier: poLines[0].supplier, qty: totalQty });
      });

      return { weekLabel: week.label, offset: week.offset, isFuture: week.isFuture, pos };
    });
  }, [lines, weeksInRange]);

  const totalMissing = useMemo(() => rows.reduce((s, r) => s + r.pos.length, 0), [rows]);
  const worstWeek = useMemo(
    () => [...rows].sort((a, b) => b.pos.length - a.pos.length)[0] ?? null,
    [rows]
  );

  const columns: Column<WeekRow>[] = [
    { key: 'week', header: 'PGRD Week', render: (r) => r.weekLabel },
    { key: 'when', header: 'When', render: (r) => (r.isFuture ? 'Future' : r.offset === 0 ? 'Current' : 'Past') },
    {
      key: 'count',
      header: 'POs missing ESD (qty > 1)',
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); setDetailWeek(r); }} className="cursor-pointer">
          {supplierFilterActive || r.pos.length === 0
            ? <span className={`kpi-number font-extrabold text-lg ${r.pos.length ? 'text-fail' : 'text-[#b5aaa5]'}`}>{r.pos.length}</span>
            : <SupplierBreakdownHover pos={r.pos} />}
        </button>
      ),
    },
  ];

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-[#9c9794]">Missing ESD</p>
          <p className="text-[10px] text-brand font-semibold">Drill down →</p>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className={`kpi-number font-extrabold text-3xl leading-none ${totalMissing === 0 ? 'text-pass' : 'text-fail'}`}>{totalMissing}</p>
          <p className="text-[10px] text-[#9c9794] mt-1">POs missing ESD (qty &gt; 1) across range</p>
          {worstWeek && worstWeek.pos.length > 0 && (
            <p className="text-xs mt-2 text-[#7b7571]">
              Worst week: <span className="font-semibold text-[#403833]">{worstWeek.weekLabel}</span> ({worstWeek.pos.length})
            </p>
          )}
        </div>
      </div>

      <SlideOver open={open} onClose={() => { setOpen(false); setDetailWeek(null); }} title="Missing ESD — by PGRD week" width="w-[760px]">
        <DataTable columns={columns} data={rows} rowKey={(r) => r.weekLabel + r.offset} />
        {detailWeek && (
          <div className="p-5 space-y-2 border-t border-[#f4f1ef]">
            <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">{detailWeek.weekLabel} — qualifying POs</p>
            {detailWeek.pos.map((p) => (
              <div key={p.po} className="flex items-center justify-between border border-[#e9e3df] rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-[#403833]">{p.po}</p>
                  <p className="text-xs text-[#9c9794]">{p.supplier}</p>
                </div>
                <span className="text-xs font-semibold text-[#7b7571]">{p.qty} units</span>
              </div>
            ))}
            {detailWeek.pos.length === 0 && <p className="text-sm text-[#9c9794]">No qualifying POs.</p>}
          </div>
        )}
      </SlideOver>
    </>
  );
}
