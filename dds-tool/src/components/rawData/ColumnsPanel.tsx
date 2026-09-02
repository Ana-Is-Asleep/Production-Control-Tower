'use client';

import { useState, useRef, useEffect } from 'react';
import { Columns3 } from 'lucide-react';
import type { ColumnDef, ColumnGroup } from '../../lib/rawDataColumns';

const GROUP_ORDER: ColumnGroup[] = ['Identifiers', 'Supply', 'Dates', 'Quantities', 'Calculated', 'Status'];

interface ColumnsPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this panel only ever reads id/label/group, never getValue, so it doesn't need to be generic over Row (and being generic here is exactly what broke TS's inference at the PO-vs-Line ternary call site)
  columns: ColumnDef<any>[];
  visible: Set<string>;
  onChange: (visible: Set<string>) => void;
}

// Column visibility only — every entry here maps to an existing raw or approved-calculated field
// (see rawDataColumns.ts). There is no way to add a new field or formula from this panel.
export function ColumnsPanel({ columns, visible, onChange }: ColumnsPanelProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(visible);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#403833] bg-white border border-[#e9e3df] rounded-lg px-3 py-1.5 hover:border-[#403833] transition-colors"
      >
        <Columns3 size={13} /> Columns ({visible.size})
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e9e3df] rounded-lg shadow-lg z-50 w-64 max-h-96 overflow-y-auto py-2" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          {GROUP_ORDER.map((group) => {
            const cols = columns.filter((c) => c.group === group);
            if (cols.length === 0) return null;
            return (
              <div key={group} className="px-3 py-1.5">
                <p className="text-[10px] font-bold text-[#9c9794] uppercase tracking-wide mb-1">{group}</p>
                <div className="space-y-1">
                  {cols.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs text-[#403833] cursor-pointer">
                      <input type="checkbox" checked={visible.has(c.id)} onChange={() => toggle(c.id)} className="accent-brand" />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
