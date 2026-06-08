'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { PurchaseLine, AnnotationEntry, ReasonCode } from '../types';
import type { InvoiceRow } from '../types/invoice';
import type { ActiveFilters } from '../hooks/useFilters';

// annotations live here so they survive page navigation
const TM_REASONS: ReasonCode[] = ['transit_delay', 'booking_not_made'];

interface DataContextType {
  allLines: PurchaseLine[];
  setAllLines: (lines: PurchaseLine[]) => void;
  invoices: InvoiceRow[];
  setInvoices: (rows: InvoiceRow[]) => void;
  // global filters persist across page navigation so drill-downs inherit dashboard selections
  globalFilters: ActiveFilters;
  setGlobalFilters: (f: ActiveFilters) => void;
  annotations: Record<string, AnnotationEntry>;
  tmComment: string;
  setTmComment: (v: string) => void;
  tmName: string;
  setTmName: (v: string) => void;
  addAnnotation: (key: string, data: Partial<AnnotationEntry>) => void;
  updateAnnotation: (key: string, data: Partial<AnnotationEntry>) => void;
  isAnnotated: (key: string) => boolean;
  resetAnnotations: () => void;
}

const DEFAULT_FILTERS: ActiveFilters = { suppliers: [], categories: [], pgrdWeek: null };

const DataContext = createContext<DataContextType>({
  allLines: [],
  setAllLines: () => {},
  invoices: [],
  setInvoices: () => {},
  globalFilters: DEFAULT_FILTERS,
  setGlobalFilters: () => {},
  annotations: {},
  tmComment: '',
  setTmComment: () => {},
  tmName: '',
  setTmName: () => {},
  addAnnotation: () => {},
  updateAnnotation: () => {},
  isAnnotated: () => false,
  resetAnnotations: () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [allLines, setAllLines] = useState<PurchaseLine[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [globalFilters, setGlobalFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [annotations, setAnnotations] = useState<Record<string, AnnotationEntry>>({});
  const [tmComment, setTmComment] = useState('');
  const [tmName, setTmName] = useState('');

  const addAnnotation = useCallback((key: string, data: Partial<AnnotationEntry>) => {
    setAnnotations((prev) => ({
      ...prev,
      [key]: { poLine: key, reason: data.reason ?? 'other', tmComment: '', scmComment: '', annotatedAt: new Date(), ...data },
    }));
  }, []);

  const updateAnnotation = useCallback((key: string, data: Partial<AnnotationEntry>) => {
    setAnnotations((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: { ...prev[key], ...data, annotatedAt: new Date() } };
    });
  }, []);

  const isAnnotated = useCallback((key: string): boolean => {
    const entry = annotations[key];
    if (!entry?.reason) return false;
    if (TM_REASONS.includes(entry.reason) && !tmComment.trim()) return false;
    if (entry.reason === 'other' && !entry.scmComment?.trim()) return false;
    return true;
  }, [annotations, tmComment]);

  const resetAnnotations = useCallback(() => {
    setAnnotations({});
    setTmComment('');
    setTmName('');
  }, []);

  return (
    <DataContext.Provider value={{ allLines, setAllLines, invoices, setInvoices, globalFilters, setGlobalFilters, annotations, tmComment, setTmComment, tmName, setTmName, addAnnotation, updateAnnotation, isAnnotated, resetAnnotations }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
