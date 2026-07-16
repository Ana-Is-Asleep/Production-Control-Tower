'use client';

import { Button } from '../shared/Button';
import type { FilterState } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  allSuppliers: string[];
  lastWeek: number;
  lastYear: number;
  onOpenUpload: () => void;
  allAnnotated: boolean;
}

export function FilterBar({ filters, setFilters, allSuppliers, lastWeek, lastYear, onOpenUpload, allAnnotated }: FilterBarProps) {
  const toggleSupplier = (s: string) => {
    const current = filters.suppliers;
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    setFilters({ ...filters, suppliers: next });
  };

  const clearSuppliers = () => setFilters({ ...filters, suppliers: [] });

  const displaySuppliers = filters.suppliers.length === 0 ? 'All Suppliers' : filters.suppliers.join(', ');

  return (
    <header className="bg-card border-b border-border px-5 py-3 flex items-center gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-sans font-bold text-brand text-xl">emma.</span>
        <span className="text-muted text-xs">|</span>
        <span className="text-navy text-sm font-semibold">DDS Meeting Tool · P2W EU D2C</span>
      </div>

      <div className="flex-1" />

      <div className="relative group">
        <button className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 hover:border-brand-soft transition-colors text-dark">
          <span className="max-w-[200px] truncate">{displaySuppliers}</span>
          <span className="text-muted text-xs">?</span>
        </button>
        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg min-w-[200px] py-1 hidden group-hover:block z-50">
          <button
            onClick={clearSuppliers}
            className="w-full text-left px-3 py-1.5 text-xs text-muted hover:bg-canvas"
          >
            All Suppliers
          </button>
          {allSuppliers.map((s) => (
            <button
              key={s}
              onClick={() => toggleSupplier(s)}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-canvas ${filters.suppliers.includes(s) ? 'text-brand font-medium' : 'text-dark'}`}
            >
              {filters.suppliers.includes(s) && <span>?</span>}
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs bg-canvas border border-border rounded-lg px-3 py-1.5 text-secondary font-medium shrink-0">
        PGRD: W{String(lastWeek).padStart(2, '0')} {lastYear}
      </div>

      <Button variant="outline" size="sm" onClick={onOpenUpload}>
        ? Upload
      </Button>

      <button
        disabled={!allAnnotated}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
          allAnnotated
            ? 'bg-brand text-white'
            : 'bg-gray-100 text-muted cursor-not-allowed'
        }`}
      >
        {allAnnotated && (
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        )}
        Ready for Meeting
      </button>
    </header>
  );
}
