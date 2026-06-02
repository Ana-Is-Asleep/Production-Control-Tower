'use client';

import { createContext, useContext, useState } from 'react';
import type { PurchaseLine } from '../types';

interface DataContextType {
  allLines: PurchaseLine[];
  setAllLines: (lines: PurchaseLine[]) => void;
}

const DataContext = createContext<DataContextType>({
  allLines: [],
  setAllLines: () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [allLines, setAllLines] = useState<PurchaseLine[]>([]);
  return (
    <DataContext.Provider value={{ allLines, setAllLines }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
