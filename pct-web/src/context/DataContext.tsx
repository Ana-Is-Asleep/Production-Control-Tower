'use client';

import { createContext, useContext, useState } from 'react';
import type { PurchaseLine } from '../types';
import type { InvoiceRow } from '../types/invoice';
import type { InvoiceParseMeta } from '../lib/invoiceParser';
import { DEFAULT_FILTERS, type ActiveFilters } from '../hooks/useFilters';

interface DataContextType {
  allLines: PurchaseLine[];
  setAllLines: (lines: PurchaseLine[]) => void;
  invoices: InvoiceRow[];
  setInvoices: (rows: InvoiceRow[]) => void;
  invoiceMeta: InvoiceParseMeta | null;
  setInvoiceMeta: (meta: InvoiceParseMeta | null) => void;
  // global filters persist across page navigation so drill-downs inherit dashboard selections
  globalFilters: ActiveFilters;
  setGlobalFilters: (f: ActiveFilters) => void;
}

const DataContext = createContext<DataContextType>({
  allLines: [],
  setAllLines: () => {},
  invoices: [],
  setInvoices: () => {},
  invoiceMeta: null,
  setInvoiceMeta: () => {},
  globalFilters: DEFAULT_FILTERS,
  setGlobalFilters: () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [allLines, setAllLines] = useState<PurchaseLine[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceParseMeta | null>(null);
  const [globalFilters, setGlobalFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);

  return (
    <DataContext.Provider value={{ allLines, setAllLines, invoices, setInvoices, invoiceMeta, setInvoiceMeta, globalFilters, setGlobalFilters }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
