'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActionItem } from '../types/actions';
import { loadActions, saveActions } from '../lib/actionsStorage';
import { runRulesEngine } from '../lib/rulesEngine';
import { SUPPLIER_SCM_MAP } from '../lib/supplierScmMapping';
import type { PurchaseLine } from '../types';

// One-time backfill for flags created before owner auto-assignment existed (or before a
// supplier was added to the SCM mapping) — fills in owner from supplierCode without touching
// anything else, so it doesn't conflict with "never modify an existing flag" for status/dedup.
function backfillOwners(actions: ActionItem[]): ActionItem[] {
  let changed = false;
  const next = actions.map((a) => {
    if (a.type !== 'flag' || a.owner || !a.supplierCode) return a;
    const owner = SUPPLIER_SCM_MAP[a.supplierCode.trim()];
    if (!owner) return a;
    changed = true;
    return { ...a, owner };
  });
  return changed ? next : actions;
}

export function useActions() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  // localStorage isn't available during SSR — hydrate on mount instead of in useState's initializer
  useEffect(() => {
    const loaded = loadActions();
    const backfilled = backfillOwners(loaded);
    if (backfilled !== loaded) saveActions(backfilled);
    setActions(backfilled);
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
