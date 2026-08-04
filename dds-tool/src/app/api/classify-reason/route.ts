import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  REASON_CATEGORIES, hashReason, normalizeReason,
  type ClassifiedReason, type ReasonCategory,
} from '../../../lib/reasonClassification';

const TABLE_ID = 'tblmx3HMJYqXFD47I'; // loss_reason_classifications, base appC7tN7h8yeftyVV
const BATCH_SIZE = 20;

// Fallback in-memory cache — used only if the Airtable cache table is unreachable
// (e.g. missing env vars in this environment). The real cache is the Airtable table above,
// created via MCP for this project; classify-reason always checks it first.
const memoryCache = new Map<string, ClassifiedReason>();

interface AirtableRecord {
  id: string;
  fields: { reason_hash?: string; raw_reason?: string; category?: string; cleaned_summary?: string };
}

function airtableHeaders() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return null;
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

async function loadFromAirtable(hashes: string[]): Promise<Map<string, ClassifiedReason>> {
  const result = new Map<string, ClassifiedReason>();
  const headers = airtableHeaders();
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!headers || !baseId || hashes.length === 0) return result;

  try {
    // Airtable formulas get unwieldy past ~50 ORs — chunk defensively
    for (let i = 0; i < hashes.length; i += 40) {
      const chunk = hashes.slice(i, i + 40);
      const formula = `OR(${chunk.map((h) => `{reason_hash}='${h.replace(/'/g, "\\'")}'`).join(',')})`;
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${TABLE_ID}`);
      url.searchParams.set('filterByFormula', formula);
      const res = await fetch(url.toString(), { headers, cache: 'no-store' });
      if (!res.ok) continue;
      const json = (await res.json()) as { records: AirtableRecord[] };
      for (const r of json.records) {
        if (!r.fields.reason_hash) continue;
        const category = (r.fields.category ?? 'other') as ReasonCategory;
        result.set(r.fields.reason_hash, {
          category: REASON_CATEGORIES.includes(category) ? category : 'other',
          cleaned_summary: r.fields.cleaned_summary ?? '',
        });
      }
    }
  } catch (err) {
    console.error('classify-reason: Airtable read failed, falling back to memory cache', err);
  }
  return result;
}

async function writeToAirtable(entries: { hash: string; raw: string; result: ClassifiedReason }[]) {
  const headers = airtableHeaders();
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!headers || !baseId || entries.length === 0) return;

  try {
    // Airtable create allows up to 10 records per call
    for (let i = 0; i < entries.length; i += 10) {
      const chunk = entries.slice(i, i + 10);
      await fetch(`https://api.airtable.com/v0/${baseId}/${TABLE_ID}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: chunk.map((e) => ({
            fields: {
              reason_hash: e.hash,
              raw_reason: e.raw,
              category: e.result.category,
              cleaned_summary: e.result.cleaned_summary,
            },
          })),
        }),
      });
    }
  } catch (err) {
    console.error('classify-reason: Airtable write failed (cache not persisted)', err);
  }
}

async function classifyBatch(reasons: string[]): Promise<ClassifiedReason[]> {
  const apiKey = process.env.controltower;
  if (!apiKey) {
    return reasons.map(() => ({ category: 'other' as ReasonCategory, cleaned_summary: '' }));
  }

  const client = new Anthropic({ apiKey });

  // Strict JSON-only system prompt with defensive parsing below — avoids depending on a
  // specific SDK version's structured-output typings, and degrades gracefully (category:
  // 'other') if Claude's response isn't valid JSON for any reason.
  const systemPrompt =
    'You classify supply-chain shipment delay reasons. You respond with ONLY a raw JSON object of the exact ' +
    `shape {"results": [{"category": string, "cleaned_summary": string}, ...]} — one entry per input reason, ` +
    `in the same order, no markdown, no code fences, no commentary. "category" MUST be exactly one of: ` +
    `${REASON_CATEGORIES.join(', ')}. "cleaned_summary" is a short (<=12 word) plain-English summary of the reason.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: reasons.map((r, i) => `${i + 1}. ${r}`).join('\n'),
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text block in response');

    // Defensive extraction: strip any accidental code fences/prose before the JSON object.
    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('no JSON object found in response');
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { results: { category: string; cleaned_summary: string }[] };
    return reasons.map((_, i) => {
      const r = parsed.results[i];
      const category = (r?.category ?? 'other') as ReasonCategory;
      return {
        category: REASON_CATEGORIES.includes(category) ? category : 'other',
        cleaned_summary: r?.cleaned_summary ?? '',
      };
    });
  } catch (err) {
    console.error('classify-reason: Anthropic call failed, defaulting batch to "other"', err);
    return reasons.map(() => ({ category: 'other' as ReasonCategory, cleaned_summary: '' }));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { reasons?: unknown };
    const reasons = Array.isArray(body.reasons) ? body.reasons.filter((r): r is string => typeof r === 'string') : [];
    if (reasons.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const uniqueRaw = [...new Set(reasons.map((r) => r.trim()).filter(Boolean))];
    const hashOf = new Map(uniqueRaw.map((r) => [r, hashReason(r)]));

    // 1. check Airtable cache, then in-memory fallback
    const cached = await loadFromAirtable([...hashOf.values()]);
    for (const [raw, hash] of hashOf) {
      if (!cached.has(hash) && memoryCache.has(hash)) cached.set(hash, memoryCache.get(hash)!);
      void raw;
    }

    const unseen = uniqueRaw.filter((raw) => !cached.has(hashOf.get(raw)!));

    // 2. classify unseen reasons in Anthropic-friendly batches
    const newlyClassified: { hash: string; raw: string; result: ClassifiedReason }[] = [];
    for (let i = 0; i < unseen.length; i += BATCH_SIZE) {
      const batch = unseen.slice(i, i + BATCH_SIZE);
      const results = await classifyBatch(batch);
      batch.forEach((raw, idx) => {
        const hash = hashOf.get(raw)!;
        const result = results[idx];
        cached.set(hash, result);
        memoryCache.set(hash, result);
        newlyClassified.push({ hash, raw, result });
      });
    }

    // 3. write new results back to the cache table (best-effort, non-blocking for the response)
    void writeToAirtable(newlyClassified);

    // 4. return results aligned to the original (non-deduped) request order
    const results = reasons.map((raw) => {
      const hash = hashReason(raw.trim());
      const entry = cached.get(hash) ?? { category: 'other' as ReasonCategory, cleaned_summary: '' };
      return { reason: raw, ...entry };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('classify-reason route failed:', err);
    return NextResponse.json({ error: 'classification failed' }, { status: 500 });
  }
}
