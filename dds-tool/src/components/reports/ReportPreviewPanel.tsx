'use client';

import type { ReportResult } from '../../lib/reportBuilders';

const TINT_CLASS: Record<string, string> = {
  pass: 'bg-pass-bg text-pass',
  fail: 'bg-fail-bg text-fail',
  warn: 'bg-warn-bg text-warn',
  neutral: 'bg-[#f5f2ee] text-[#403833]',
};

interface ReportPreviewPanelProps {
  title: string;
  result: ReportResult;
}

// Generic renderer for any ReportResult — every report (library or custom-built) goes through
// this exact same component, so a report's presentation never quietly diverges from another's.
export function ReportPreviewPanel({ title, result }: ReportPreviewPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-[#403833]">{title}</p>
        <p className="text-xs text-[#9c9794] mt-0.5">{result.contextLabel}</p>
      </div>

      {result.kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {result.kpis.map((k) => (
            <div key={k.label} className={`rounded-lg px-3 py-2.5 ${TINT_CLASS[k.tint ?? 'neutral']}`}>
              <p className="text-[10px] uppercase tracking-widest opacity-70 truncate">{k.label}</p>
              <p className="text-lg font-extrabold leading-none mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {result.tables.map((t) => (
        <div key={t.title} className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden">
          <p className="text-xs font-bold text-[#403833] px-3 pt-2.5 pb-1.5">{t.title}</p>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#403833] text-white">
                  {t.columns.map((c) => (
                    <th key={c} className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.length === 0 && (
                  <tr><td colSpan={t.columns.length} className="text-center py-4 text-[#9c9794]">No data in scope</td></tr>
                )}
                {t.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#f4f1ef]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-[#403833] whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
