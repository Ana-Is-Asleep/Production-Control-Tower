'use client';

import { Card } from '../shared/Card';

export function InvoicesCard() {
  return (
    <Card>
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Invoices</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark">Overdue</span>
            <div className="text-right">
              <span className="font-serif text-xl font-bold text-fail">3</span>
              <span className="text-xs text-muted ml-1">/ €12,450</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark">P2W</span>
            <span className="font-serif text-xl font-bold text-warn">1</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark">On time</span>
            <span className="font-serif text-xl font-bold text-pass">14</span>
          </div>
        </div>
        <div className="mt-3 flex gap-1 items-end h-8">
          {[4, 6, 3, 8, 5, 7, 3].map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-brand-dim rounded-sm"
              style={{ height: `${(v / 8) * 100}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted mt-1">7-week trend</p>
      </div>
    </Card>
  );
}
