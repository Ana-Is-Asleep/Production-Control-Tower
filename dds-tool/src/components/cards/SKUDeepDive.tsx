'use client';

import { useState } from 'react';
import { SlideOver } from '../shared/SlideOver';
import { DataTable, type Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Card } from '../shared/Card';
import { formatDateShort } from '../../lib/dateUtils';
import { computeKPI } from '../../lib/kpiFormulas';
import type { PurchaseLine } from '../../types';

type Tab = 'all' | 'not-sot' | 'not-otif' | 'not-both';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not-sot', label: 'Not SOT' },
  { key: 'not-otif', label: 'Not OTIF' },
  { key: 'not-both', label: 'Not Both' },
];

interface SKUDeepDiveProps {
  lines: PurchaseLine[];
}

export function SKUDeepDive({ lines }: SKUDeepDiveProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  const enriched = lines.map((l) => ({ ...l, kpi: computeKPI(l) }));

  const filtered = enriched.filter((l) => {
    if (tab === 'not-sot') return l.kpi.sotFail;
    if (tab === 'not-otif') return l.kpi.otifFail;
    if (tab === 'not-both') return l.kpi.sotFail && l.kpi.otifFail;
    return true;
  });

  const columns: Column<typeof filtered[0]>[] = [
    { key: 'po', header: 'PO', render: (r) => <span className="font-medium text-navy">{r.po}</span> },
    { key: 'line', header: 'Line', render: (r) => r.line },
    { key: 'sku', header: 'SKU', render: (r) => r.sku },
    { key: 'supplier', header: 'Vendor', render: (r) => r.supplier },
    { key: 'destination', header: 'Dest.', render: (r) => r.destination },
    { key: 'pgrd', header: 'PGRD', render: (r) => formatDateShort(r.pgrd) },
    { key: 'asd', header: 'ASD', render: (r) => formatDateShort(r.asd) },
    {
      key: 'esd', header: 'ESD',
      render: (r) => r.esd
        ? formatDateShort(r.esd)
        : <span className="inline-block bg-fail-bg text-fail-text text-xs px-2 py-0.5 rounded-full">No pickup booked</span>
    },
    {
      key: 'sot', header: 'SOT',
      render: (r) => r.kpi.sotResult === null ? <span className="text-muted">—</span>
        : r.kpi.sotResult ? <span className="text-pass font-bold">✓</span> : <span className="text-fail font-bold">✗</span>
    },
    {
      key: 'otif', header: 'OTIF',
      render: (r) => r.kpi.otif === null ? <span className="text-muted">—</span>
        : r.kpi.otif ? <span className="text-pass font-bold">✓</span> : <span className="text-warn font-bold">✗</span>
    },
    { key: 'status', header: 'Status', render: (r) => <span className="text-xs text-muted">{r.status}</span> },
  ];

  const notSotCount = enriched.filter((l) => l.kpi.sotFail).length;
  const notOtifCount = enriched.filter((l) => l.kpi.otifFail).length;

  return (
    <>
      <Card className="cursor-pointer hover:border-brand-soft transition-colors" >
        <div className="p-4" onClick={() => setOpen(true)}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">SKU Deep Dive</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark">Total lines</span>
              <span className="font-serif text-2xl font-bold text-navy">{lines.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark">SOT fails</span>
              <span className="font-serif text-xl font-bold text-fail">{notSotCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark">OTIF fails</span>
              <span className="font-serif text-xl font-bold text-warn">{notOtifCount}</span>
            </div>
          </div>
          <p className="text-xs text-brand mt-3">→ Open detail view</p>
        </div>
      </Card>

      <SlideOver open={open} onClose={() => setOpen(false)} title="SKU Deep Dive">
        <div className="p-4 space-y-4">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-navy text-white' : 'text-muted hover:bg-canvas'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <DataTable columns={columns} data={filtered} rowKey={(r) => `${r.po}-${r.line}`} />
        </div>
      </SlideOver>
    </>
  );
}
