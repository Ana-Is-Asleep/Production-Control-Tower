'use client';

import { createContext, useContext, useState } from 'react';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';
import { DEFAULT_FILTERS, type ActiveFilters } from '../hooks/useFilters';

interface DataContextType {
  allLines: PurchaseLine[];
  setAllLines: (lines: PurchaseLine[]) => void;
  invoices: InvoiceRow[];
  setInvoices: (rows: InvoiceRow[]) => void;
  // global filters persist across page navigation so drill-downs inherit dashboard selections
  globalFilters: ActiveFilters;
  setGlobalFilters: (f: ActiveFilters) => void;
}

const DataContext = createContext<DataContextType>({
  allLines: [],
  setAllLines: () => {},
  invoices: [],
  setInvoices: () => {},
  globalFilters: DEFAULT_FILTERS,
  setGlobalFilters: () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [allLines, setAllLines] = useState<PurchaseLine[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [globalFilters, setGlobalFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);

  return (
    <DataContext.Provider value={{ allLines, setAllLines, invoices, setInvoices, globalFilters, setGlobalFilters }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
