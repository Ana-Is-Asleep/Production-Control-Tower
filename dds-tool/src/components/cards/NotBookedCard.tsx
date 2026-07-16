'use client';

import { Card } from '../shared/Card';
import type { PurchaseLine } from '../../types';

interface NotBookedCardProps {
  lines: PurchaseLine[];
}

export function NotBookedCard({ lines }: NotBookedCardProps) {
  return (
    <Card>
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Not Booked</h3>
        <div className="flex items-end gap-2 mb-3">
          <span className="font-sans text-3xl font-bold text-fail">{lines.length}</span>
          <span className="text-xs text-muted pb-1">lines without ESD</span>
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {lines.length === 0 && (
            <p className="text-xs text-pass font-medium">? All lines booked</p>
          )}
          {lines.slice(0, 8).map((l) => (
            <div key={`${l.po}-${l.line}`} className="flex items-center justify-between text-xs">
              <span className="text-navy font-medium">{l.po}</span>
              <span className="text-muted">{l.sku}</span>
              <span className="text-muted">{l.destination}</span>
            </div>
          ))}
          {lines.length > 8 && (
            <p className="text-xs text-muted">+{lines.length - 8} more</p>
          )}
        </div>
      </div>
    </Card>
  );
}
