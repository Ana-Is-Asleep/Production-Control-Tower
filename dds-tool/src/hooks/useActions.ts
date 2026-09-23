'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActionItem } from '../types/actions';
import { loadActions, saveActions } from '../lib/actionsStorage';
import { runRulesEngine, pruneStaleR002Flags } from '../lib/rulesEngine';
import { defaultScmForVendor } from '../lib/supplierScmMapping';
import type { IsChinaSupplier } from '../lib/kpiFormulas';
import type { PurchaseLine } from '../types';

// One-time backfill for flags created before owner auto-assignment existed (or before a
// supplier was added to the SCM mapping) — fills in owner from supplierCode without touching
// anything else, so it doesn't conflict with "never modify an existing flag" for status/dedup.
function backfillOwners(actions: ActionItem[]): ActionItem[] {
  let changed = false;
  const next = actions.map((a) => {
    if (a.type !== 'flag' || a.owner || !a.supplierCode) return a;
    const owner = defaultScmForVendor(a.supplierCode);
    if (!owner) return a;
    changed = true;
    return { ...a, owner };
  });
  return changed ? next : actions;
}

// One-time backfill for actions saved before commentLog/closedAt existed — wraps the old single
// `comment` string into a one-entry history (dated at updatedAt, the closest available timestamp;
// the true original comment date isn't recoverable) and derives closedAt from updatedAt for
// already-closed items, so "Time Open" and comment history don't show blank/wrong for old data.
function backfillActionHistory(actions: ActionItem[]): ActionItem[] {
  let changed = false;
  const next = actions.map((a) => {
    let patched = a;
    if (!patched.commentLog && patched.comment.trim()) {
      changed = true;
      patched = { ...patched, commentLog: [{ text: patched.comment, at: patched.updatedAt }] };
    }
    if (patched.status === 'closed' && !patched.closedAt) {
      changed = true;
      patched = { ...patched, closedAt: patched.updatedAt };
    }
    return patched;
  });
  return changed ? next : actions;
}

export function useActions() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  // localStorage isn't available during SSR — hydrate on mount instead of in useState's initializer
  useEffect(() => {
    const loaded = loadActions();
    const backfilled = backfillActionHistory(backfillOwners(loaded));
    if (backfilled !== loaded) saveActions(backfilled);
    setActions(backfilled);
  }, []);

  // evaluates every rule against the newly uploaded lines and appends only the new flags —
  // called once per upload
  const runRules = useCallback((lines: PurchaseLine[], isChinaSupplier: IsChinaSupplier) => {
    setActions((prev) => {
      const pruned = pruneStaleR002Flags(lines, prev, isChinaSupplier, new Date());
      const newFlags = runRulesEngine(lines, pruned, isChinaSupplier);
      if (newFlags.length === 0 && pruned === prev) return prev;
      const next = newFlags.length > 0 ? [...pruned, ...newFlags] : pruned;
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
      const next = prev.map((a) => {
        if (a.id !== id) return a;
        const now = new Date().toISOString();
        let merged: ActionItem = { ...a, ...patch, updatedAt: now };
        // closedAt/commentLog are bookkeeping the UI never sets directly — derived here so every
        // caller (drawer, full Actions page) gets the same behavior for free.
        if (patch.status === 'closed' && a.status !== 'closed') merged.closedAt = now;
        else if (patch.status && patch.status !== 'closed' && a.status === 'closed') merged = { ...merged, closedAt: undefined, resolutionReason: undefined };
        if (patch.comment !== undefined && patch.comment.trim() && patch.comment !== a.comment) {
          merged.commentLog = [...(a.commentLog ?? []), { text: patch.comment, at: now }];
        }
        return merged;
      });
      saveActions(next);
      return next;
    });
  }, []);

  return { actions, runRules, addAction, updateAction };
}
