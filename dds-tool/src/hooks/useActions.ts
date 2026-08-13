'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActionItem } from '../types/actions';
import { loadActions, saveActions } from '../lib/actionsStorage';
import { runRulesEngine } from '../lib/rulesEngine';
import type { PurchaseLine } from '../types';

export function useActions() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  // localStorage isn't available during SSR — hydrate on mount instead of in useState's initializer
  useEffect(() => {
    setActions(loadActions());
  }, []);

  // evaluates every rule against the newly uploaded lines and appends only the new flags —
  // called once per upload
  const runRules = useCallback((lines: PurchaseLine[]) => {
    setActions((prev) => {
      const newFlags = runRulesEngine(lines, prev);
      if (newFlags.length === 0) return prev;
      const next = [...prev, ...newFlags];
      saveActions(next);
      return next;
    });
  }, []);

  const addAction = useCallback((item: ActionItem) => {
    setActions((prev) => {
      const next = [item, ...prev];
      saveActions(next);
      return next;
    });
  }, []);

  const updateAction = useCallback((id: string, patch: Partial<ActionItem>) => {
    setActions((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a));
      saveActions(next);
      return next;
    });
  }, []);

  return { actions, runRules, addAction, updateAction };
}
