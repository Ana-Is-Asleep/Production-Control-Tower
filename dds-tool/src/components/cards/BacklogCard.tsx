'use client';

import { useState } from 'react';
import { Card } from '../shared/Card';
import { formatDateShort } from '../../lib/dateUtils';
import type { BacklogSummary, PurchaseLine } from '../../types';

interface BacklogCardProps {
  backlog: BacklogSummary;
}

function BacklogRow({ line, label, color }: { line: PurchaseLine; label: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div>
        <span className="text-xs font-medium text-dark">{line.po}</span>
        <span className="text-xs text-muted ml-2">{line.sku}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>{line.destination}</span>
        <span>PGRD {formatDateShort(line.pgrd)}</span>
        {line.esd && <span>ESD {formatDateShort(line.esd)}</span>}
        <span className={`w-2 h-2 rounded-full ${color}`} />
      </div>
    </div>
  );
}

export function BacklogCard({ backlog }: BacklogCardProps) {
  const [expanded, setExpanded] = useState(false);

  const total = backlog.critical.length + backlog.recent.length + backlog.atRisk.length;

  return (
    <Card className="h-full">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Backlog</h3>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted hover:text-dark transition-colors"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-fail" />
              <span className="text-sm text-dark">Critical</span>
              <span className="text-xs text-muted">&gt;14d no ASD</span>
            </div>
            <span className="font-serif text-2xl font-bold text-fail">{backlog.critical.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-warn" />
              <span className="text-sm text-dark">Recent</span>
              <span className="text-xs text-muted">last 14d no ASD</span>
            </div>
            <span className="font-serif text-2xl font-bold text-warn">{backlog.recent.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand" />
              <span className="text-sm text-dark">At Risk</span>
              <span className="text-xs text-muted">ESD &gt; PGRD</span>
            </div>
            <span className="font-serif text-2xl font-bold text-brand">{backlog.atRisk.length}</span>
          </div>
        </div>

        {total === 0 && (
          <div className="mt-4 text-xs text-pass font-medium text-center py-2 bg-pass-bg rounded-lg">
            ✓ No backlog items
          </div>
        )}
      </div>

      {expanded && total > 0 && (
        <div className="border-t border-border p-5 space-y-4">
          {backlog.critical.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-fail uppercase tracking-widest mb-2">Critical ({backlog.critical.length})</h4>
              {backlog.critical.map((l) => <BacklogRow key={`${l.po}-${l.line}`} line={l} label="Critical" color="bg-fail" />)}
            </div>
          )}
          {backlog.recent.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-warn uppercase tracking-widest mb-2">Recent ({backlog.recent.length})</h4>
              {backlog.recent.map((l) => <BacklogRow key={`${l.po}-${l.line}`} line={l} label="Recent" color="bg-warn" />)}
            </div>
          )}
          {backlog.atRisk.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-brand uppercase tracking-widest mb-2">At Risk ({backlog.atRisk.length})</h4>
              {backlog.atRisk.map((l) => <BacklogRow key={`${l.po}-${l.line}`} line={l} label="At Risk" color="bg-brand" />)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
