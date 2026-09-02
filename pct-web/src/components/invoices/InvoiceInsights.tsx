'use client';

import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { formatAmountsByCurrency, type SupplierExposureRow } from '../../lib/invoiceUtils';
import type { InvoiceKPIs } from '../../types/invoice';

interface InvoiceInsightsProps {
  kpis: InvoiceKPIs;
  supplierExposure: SupplierExposureRow[];
  contextLabel: string; // supplier name in single-supplier mode, '' otherwise
}

const MAX_INSIGHTS = 4;

// Prioritized by operational urgency — current-state only, calculated from whatever's in the
// currently filtered scope.
export function InvoiceInsights({ kpis, supplierExposure, contextLabel }: InvoiceInsightsProps) {
  const insights = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: 'fail' | 'warn' | 'pass' | 'neutral'; text: string }[] = [];
    const subject = contextLabel || null;

    if (kpis.overdueP2w.length > 0) {
      items.push({
        icon: AlertTriangle, tone: 'fail',
        text: `${formatAmountsByCurrency(kpis.overdueP2w)} across ${kpis.overdueP2w.length} invoice${kpis.overdueP2w.length > 1 ? 's' : ''} ${subject ? `for ${subject} ` : ''}is overdue and still awaiting approval.`,
      });
    }

    if (!subject && supplierExposure.length > 0 && kpis.overdueP2w.length > 0) {
      const top = supplierExposure[0];
      const totalOverdue = supplierExposure.reduce((s, r) => s + r.overdueCount, 0);
      if (top.overdueCount > 0 && totalOverdue > 0) {
        const share = Math.round((top.overdueCount / totalOverdue) * 100);
        items.push({ icon: AlertTriangle, tone: 'warn', text: `${top.supplier} represents ${share}% of overdue pending-approval invoices.` });
      }
    }

    const over14 = kpis.overdueP2w.filter((r) => {
      if (!r.effectiveDueDate) return false;
      return (new Date().getTime() - r.effectiveDueDate.getTime()) / 86400000 > 14;
    }).length;
    if (over14 > 0) {
      items.push({ icon: Clock, tone: 'fail', text: `${over14} overdue invoice${over14 > 1 ? 's are' : ' is'} more than 14 days past ${subject ? 'its' : 'their'} Effective Due Date.` });
    }

    if (kpis.missingGR.length > 0) {
      items.push({ icon: AlertTriangle, tone: 'warn', text: `${kpis.missingGR.length} pending invoice${kpis.missingGR.length > 1 ? 's are' : ' is'} blocked by Missing GR.` });
    }

    if (kpis.approvedNotPaidOverdue.length > 0 && items.length < MAX_INSIGHTS) {
      items.push({ icon: CheckCircle2, tone: 'pass', text: `${formatAmountsByCurrency(kpis.approvedNotPaidOverdue)} has already been approved but remains unpaid past its Effective Due Date.` });
    }

    if (items.length < MAX_INSIGHTS && kpis.totalPending.length > 0 && kpis.overdueP2w.length > 0) {
      const share = Math.round((kpis.overdueP2w.length / kpis.totalPending.length) * 100);
      items.push({ icon: TrendingUp, tone: 'neutral', text: `${share}% of pending invoices (by count) are already overdue.` });
    }

    return items.slice(0, MAX_INSIGHTS);
  }, [kpis, supplierExposure, contextLabel]);

  const toneColor: Record<string, string> = { fail: 'text-fail', warn: 'text-warn', pass: 'text-pass', neutral: 'text-[#7b7571]' };

  return (
    <div className="bg-white rounded-lg border border-[#e9e3df] p-4 h-full flex flex-col" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-sm font-bold text-[#403833] mb-3">Key Insights{contextLabel ? ` — ${contextLabel}` : ''}</p>
      {insights.length === 0 ? (
        <p className="text-xs text-[#9c9794]">No pending exposure to flag right now.</p>
      ) : (
        <div className="space-y-2.5 flex-1">
          {insights.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-2 text-xs text-[#403833]">
                <Icon size={14} className={`shrink-0 mt-0.5 ${toneColor[item.tone]}`} />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
