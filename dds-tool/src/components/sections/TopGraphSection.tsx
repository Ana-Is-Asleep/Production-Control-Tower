'use client';

import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { SlideOver } from '../shared/SlideOver';
import { DataTable, type Column } from '../shared/DataTable';
import { formatDateShort } from '../../lib/dateUtils';
import { BAR_TOTAL, BAR_SHIPPED, LINE_SOT, LINE_OTIF, COLOR } from '../../lib/statusColors';
import type { TopGraphPoint, DeepDiveRow } from '../../hooks/useKPIs';

interface TopGraphSectionProps {
  points: TopGraphPoint[];
  deepDiveRows: DeepDiveRow[];
  sotTarget: number;
  otifTarget: number;
}

function pctLabel(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

export function TopGraphSection({ points, deepDiveRows, sotTarget, otifTarget }: TopGraphSectionProps) {
  const [open, setOpen] = useState(false);

  const latestPast = [...points].reverse().find((p) => !p.isFuture);
  const currentSOT = latestPast?.sotPastPct ?? null;
  const currentOTIF = latestPast?.otifPastPct ?? null;

  const columns: Column<DeepDiveRow>[] = [
    { key: 'po', header: 'PO', render: (r) => r.po, sortable: true },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier, sortable: true },
    { key: 'pgrd', header: 'PGRD', render: (r) => formatDateShort(r.pgrd), sortable: true },
    { key: 'ship', header: 'ASD / ESD', render: (r) => r.asd ? formatDateShort(r.asd) : (r.esd ? `${formatDateShort(r.esd)} (ESD)` : '—') },
    { key: 'egrd', header: 'EGRD', render: (r) => formatDateShort(r.egrd) },
    {
      key: 'sot', header: 'SOT', render: (r) => (
        <span className={r.sot === null ? 'text-[#b5aaa5]' : r.sot ? 'text-pass font-semibold' : 'text-fail font-semibold'}>
          {r.sot === null ? '—' : r.sot ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'otif', header: 'OTIF', render: (r) => (
        <span className={r.otif === null ? 'text-[#b5aaa5]' : r.otif ? 'text-pass font-semibold' : 'text-fail font-semibold'}>
          {r.otif === null ? '—' : r.otif ? 'Yes' : 'No'}
        </span>
      ),
    },
    { key: 'china', header: 'China', render: (r) => r.isChina ? <span className="text-brand font-semibold">CN</span> : '—' },
  ];

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="kpi-card bg-white rounded-lg border border-[#e9e3df] px-5 py-4 cursor-pointer flex flex-col h-full"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">SOT · {sotTarget}% target</p>
              <p className={`kpi-number font-extrabold text-4xl leading-none ${currentSOT === null ? 'text-[#c8c0bb]' : currentSOT >= sotTarget ? 'text-pass' : 'text-fail'}`}>
                {pctLabel(currentSOT)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#9c9794] mb-1">OTIF · {otifTarget}% target</p>
              <p className={`kpi-number font-extrabold text-4xl leading-none ${currentOTIF === null ? 'text-[#c8c0bb]' : currentOTIF >= otifTarget ? 'text-pass' : 'text-fail'}`}>
                {pctLabel(currentOTIF)}
              </p>
            </div>
          </div>
          <p className="text-xs text-brand font-semibold">Drill down →</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={COLOR.border} vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fill: COLOR.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: COLOR.muted, fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
              <YAxis yAxisId="pos" orientation="right" hide />
              <ReferenceLine yAxisId="pct" y={90} stroke={COLOR.border} strokeDasharray="4 4" />
              <Bar yAxisId="pos" dataKey="shippedPOs" stackId="poStack" fill={BAR_SHIPPED} radius={[0, 0, 0, 0]} name="Shipped POs" />
              <Bar yAxisId="pos" dataKey="backlogPOs" stackId="poStack" fill={BAR_TOTAL} radius={[2, 2, 0, 0]} name="Remaining POs" />
              <Line yAxisId="pct" dataKey="sotPastPct" stroke={LINE_SOT} strokeWidth={2} dot={{ r: 3, fill: LINE_SOT, strokeWidth: 0 }} name="SOT % (actual)" connectNulls />
              <Line yAxisId="pct" dataKey="sotFuturePct" stroke={LINE_SOT} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: LINE_SOT, strokeWidth: 0 }} name="SOT % (projected)" connectNulls />
              <Line yAxisId="pct" dataKey="otifPastPct" stroke={LINE_OTIF} strokeWidth={2} dot={{ r: 3, fill: LINE_OTIF, strokeWidth: 0 }} name="OTIF % (actual)" connectNulls />
              <Line yAxisId="pct" dataKey="otifFuturePct" stroke={LINE_OTIF} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: LINE_OTIF, strokeWidth: 0 }} name="OTIF % (projected)" connectNulls />
              <Tooltip
                contentStyle={{ background: COLOR.navy, border: 'none', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
                labelStyle={{ color: COLOR.brandSoft, fontWeight: 700 }}
                itemStyle={{ color: '#f9f7f6' }}
                formatter={(v, n) => { const s = String(n); return [s.includes('%') ? `${v}%` : `${v} POs`, s]; }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="SOT / OTIF — Purchase Order Detail" width="w-[900px]">
        <DataTable columns={columns} data={deepDiveRows} rowKey={(r) => r.po} />
      </SlideOver>
    </>
  );
}
