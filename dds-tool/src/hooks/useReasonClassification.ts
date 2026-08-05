'use client';

import { useMemo } from 'react';
import { classifyReasonByKeywords, type ReasonCategory } from '../lib/reasonClassification';

export interface ClassificationEntry {
  category: ReasonCategory;
  cleaned_summary: string;
}

// Deterministic keyword classification — synchronous, no network call, no API key, no cost.
export function useReasonClassification(rawReasons: string[]) {
  const unique = useMemo(() => [...new Set(rawReasons.map((r) => r.trim()).filter(Boolean))], [rawReasons]);
  const key = unique.slice().sort().join('|');

  const classifications = useMemo((): Record<string, ClassificationEntry> => {
    const map: Record<string, ClassificationEntry> = {};
    unique.forEach((r) => { map[r] = classifyReasonByKeywords(r); });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { classifications, loading: false };
}
