'use client';

import { useEffect, useState } from 'react';
import type { ReasonCategory } from '../lib/reasonClassification';

export interface ClassificationEntry {
  category: ReasonCategory;
  cleaned_summary: string;
}

// Classifies the given raw loss-reason strings via /api/classify-reason (Claude Haiku,
// cached server-side). Fetches only reasons not already in the local cache.
export function useReasonClassification(rawReasons: string[]) {
  const [map, setMap] = useState<Record<string, ClassificationEntry>>({});
  const [loading, setLoading] = useState(false);

  const unique = [...new Set(rawReasons.map((r) => r.trim()).filter(Boolean))];
  const key = unique.slice().sort().join('|');

  useEffect(() => {
    const missing = unique.filter((r) => !(r in map));
    if (missing.length === 0) return;

    let cancelled = false;
    setLoading(true);
    fetch('/api/classify-reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reasons: missing }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('classify-reason failed'))))
      .then((data: { results: { reason: string; category: ReasonCategory; cleaned_summary: string }[] }) => {
        if (cancelled) return;
        setMap((prev) => {
          const next = { ...prev };
          data.results.forEach((r) => { next[r.reason] = { category: r.category, cleaned_summary: r.cleaned_summary }; });
          return next;
        });
      })
      .catch((err) => console.error('useReasonClassification: fetch failed', err))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { classifications: map, loading };
}
