'use client';

import { useEffect, useState } from 'react';
import { classifyReasonByKeywords, type ClassifiedReason } from '../lib/reasonClassification';

export type ClassificationEntry = ClassifiedReason;

// Classifies raw loss-reason strings via /api/classify-reason (Claude Haiku, in-memory cache only —
// root-cause text never gets persisted to Airtable — keyword-fallback server-side if the AI call
// fails). If the fetch itself can't even reach the server, falls back to the local keyword
// classifier so the dashboard never just shows everything as unclassified.
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
      .then((data: { results: ({ reason: string } & ClassifiedReason)[] }) => {
        if (cancelled) return;
        setMap((prev) => {
          const next = { ...prev };
          data.results.forEach((r) => {
            const { reason, ...entry } = r;
            next[reason] = entry;
          });
          return next;
        });
      })
      .catch((err) => {
        console.error('useReasonClassification: fetch failed, using local keyword classifier', err);
        if (cancelled) return;
        setMap((prev) => {
          const next = { ...prev };
          missing.forEach((r) => { next[r] = classifyReasonByKeywords(r); });
          return next;
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { classifications: map, loading };
}
