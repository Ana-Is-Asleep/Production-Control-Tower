'use client';

import type { ReactNode } from 'react';

export type KpiTint = 'pass' | 'fail' | 'warn' | 'neutral';

const TINT_BG: Record<KpiTint, string> = {
  pass: 'bg-pass-bg',
  fail: 'bg-fail-bg',
  warn: 'bg-warn-bg',
  neutral: 'bg-[#f5f2ee]',
};

interface KpiBoxProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  tint?: KpiTint;
  sub?: ReactNode;
  className?: string;
}

// Standalone KPI numbers as bordered/tinted boxes instead of bare text on the card background —
// shared across the SOT/OTIF, Backlog, and Invoices cards so the pattern stays identical.
export function KpiBox({ label, value, valueClassName = 'text-[#403833]', tint = 'neutral', sub, className = '' }: KpiBoxProps) {
  return (
    <div className={`rounded-lg border border-[#e9e3df] px-3 py-2.5 ${TINT_BG[tint]} ${className}`}>
      <p className="text-[10px] uppercase tracking-widest text-[#9c9794] truncate">{label}</p>
      <p className={`kpi-number font-extrabold leading-none mt-1 ${valueClassName}`}>{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}
