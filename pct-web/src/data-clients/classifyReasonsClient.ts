import { classifyReasonByKeywords, type ClassifiedReason } from '../lib/reasonClassification';

// Static/local now, real AI classification endpoint later. A static site has no server to run
// the Anthropic call the original Next.js route made (src/app/api/classify-reason/route.ts),
// so this always uses the local keyword classifier today — set VITE_CLASSIFY_REASON_API_URL to
// point this at a real serverless endpoint later without touching useReasonClassification or
// anything else that consumes classifyReasons().
//
// The keyword fallback covers the same category set but is materially weaker than the AI path:
// no multi-language handling, no secondary category/confidence/supplier-tag, coarser matching.
// That's an accepted, pre-existing degradation (the original app already fell back to this same
// function when the Anthropic key was unavailable) — not something introduced by this migration.
export async function classifyReasons(rawReasons: string[]): Promise<Record<string, ClassifiedReason>> {
  const unique = [...new Set(rawReasons.map((r) => r.trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  const apiUrl = import.meta.env.VITE_CLASSIFY_REASON_API_URL as string | undefined;
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons: unique }),
      });
      if (res.ok) {
        const data: { results: ({ reason: string } & ClassifiedReason)[] } = await res.json();
        const map: Record<string, ClassifiedReason> = {};
        data.results.forEach((r) => {
          const { reason, ...entry } = r;
          map[reason] = entry;
        });
        return map;
      }
    } catch (err) {
      console.error('classifyReasons: API fetch failed, falling back to local keyword classifier', err);
    }
  }

  const map: Record<string, ClassifiedReason> = {};
  unique.forEach((r) => { map[r] = classifyReasonByKeywords(r); });
  return map;
}
