import { useEffect, useState } from 'react';
import type { ClassifiedReason } from '../lib/reasonClassification';
import { classifyReasons } from '../data-clients/classifyReasonsClient';

export type ClassificationEntry = ClassifiedReason;

// Classifies raw loss-reason strings via classifyReasonsClient (real endpoint if configured,
// local keyword fallback otherwise — see that file's comment for why).
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
    classifyReasons(missing)
      .then((results) => {
        if (cancelled) return;
        setMap((prev) => ({ ...prev, ...results }));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { classifications: map, loading };
}
