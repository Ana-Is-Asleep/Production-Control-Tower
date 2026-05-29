'use client';

import type { PurchaseLine, ReasonCode, AnnotationEntry } from '../../types';
import { formatDateShort } from '../../lib/dateUtils';
import { Badge } from './Badge';

const REASON_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'supplier_delay', label: 'Supplier delay' },
  { value: 'capacity_constraints', label: 'Capacity constraints' },
  { value: 'material_shortage', label: 'Material shortage' },
  { value: 'quality_issues', label: 'Quality issues' },
  { value: 'documentation_issue', label: 'Documentation issue' },
  { value: 'transit_delay', label: 'Transit delay' },
  { value: 'booking_not_made', label: 'Booking not made (Shiptify)' },
  { value: 'data_issue', label: 'Data issue (ASD/ESD missing)' },
  { value: 'other', label: 'Other' },
];

const TM_REASONS: ReasonCode[] = ['transit_delay', 'booking_not_made'];

interface AnnotationRowProps {
  line: PurchaseLine;
  sotFail: boolean;
  otifFail: boolean;
  entry: AnnotationEntry | undefined;
  onUpdate: (key: string, data: Partial<AnnotationEntry>) => void;
}

export function AnnotationRow({ line, sotFail, otifFail, entry, onUpdate }: AnnotationRowProps) {
  const key = `${line.po}-${line.line}`;
  const reason = entry?.reason;
  const needsTmComment = reason && TM_REASONS.includes(reason);
  const needsScmComment = reason === 'other';

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-canvas/50">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-navy">{line.po}-L{line.line}</span>
        <span className="text-xs text-muted">{line.sku}</span>
        <span className="text-xs text-muted">{line.destination}</span>
        <span className="text-xs text-muted">PGRD {formatDateShort(line.pgrd)}</span>
        {line.asd && <span className="text-xs text-muted">ASD {formatDateShort(line.asd)}</span>}
        {line.esd && <span className="text-xs text-muted">ESD {formatDateShort(line.esd)}</span>}
        {sotFail && <Badge variant="fail">SOT Fail</Badge>}
        {otifFail && <Badge variant="warn">OTIF Fail</Badge>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={entry?.reason ?? ''}
          onChange={(e) => onUpdate(key, { reason: e.target.value as ReasonCode })}
          className="text-xs border border-border rounded px-2 py-1 bg-white text-dark focus:outline-none focus:border-brand"
        >
          <option value="">Select reason...</option>
          {REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {needsTmComment && (
        <div>
          <input
            type="text"
            placeholder="TM comment (required)"
            value={entry?.tmComment ?? ''}
            onChange={(e) => onUpdate(key, { tmComment: e.target.value })}
            className="w-full text-xs border border-brand rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      )}
      {needsScmComment && (
        <div>
          <input
            type="text"
            placeholder="SCM comment (required)"
            value={entry?.scmComment ?? ''}
            onChange={(e) => onUpdate(key, { scmComment: e.target.value })}
            className="w-full text-xs border border-warn rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-warn"
          />
        </div>
      )}
    </div>
  );
}
