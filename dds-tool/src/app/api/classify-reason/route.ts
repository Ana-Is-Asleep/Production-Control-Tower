import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  REASON_CATEGORIES, hashReason, isSubstantiveReason, classifyReasonByKeywords,
  type ClassifiedReason, type ReasonCategory,
} from '../../../lib/reasonClassification';

const TABLE_ID = 'tblmx3HMJYqXFD47I'; // loss_reason_classifications, base appC7tN7h8yeftyVV
const BATCH_SIZE = 20;

// Fallback in-memory cache — used only if the Airtable cache table is unreachable.
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
  // No key configured — fall back to the deterministic keyword classifier rather than "other".
  if (!apiKey) {
    return reasons.map((r) => classifyReasonByKeywords(r));
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You classify free-text loss-reason notes written by suppliers on purchase orders for a
mattress/bed/furniture supply chain (emma Sleep, P2W EU D2C). The text is often terse, misspelled, or in French.

Categories and what belongs in each:
- material_shortage: any wording about not receiving, only partially receiving, or being short on
  quantity/units/pieces/raw material — e.g. "we did not received this material", "only received 120 units
  instead of 252", "we have not received this item", "20 unit no received", missing TPE (a material). ALSO
  includes "delay in delivering <component>" (e.g. "delay in delivering covers, PO-E-52843") — this means the
  supplier failed to supply/produce that material component, it is NOT a transit_delay just because the word
  "delay" appears. A trailing PO number in the text (e.g. "PO-E-52843") is just cross-referencing which order
  was affected, not a separate signal — ignore it for classification purposes.
- quality_issue: physical damage, defects, or broken/poor-condition goods — e.g. "3 units with boxes damaged",
  "damaged pallet arrives", "les palettes en mauvais état", theft/robbery of goods in transit.
- documentation_delay: missing or incorrect paperwork, labels, or identification — e.g. "without supplier labels",
  "received without identification", missing packing list.
- customs_delay: customs clearance, duties, import/export hold-ups.
- carrier_issue: a problem caused by the carrier/courier/driver specifically (wrong truck, carrier error) —
  distinct from generic transit delay.
- booking_not_made: no Shiptify/carrier booking was made for the shipment at all.
- truck_rounding_issue: the shipment couldn't fit / there wasn't enough space on the truck — e.g. "lack of space
  in the truck", "not enough space", "truck full" — this is a loading/capacity-fit problem, distinct from a
  carrier's own fault (carrier_issue) or a supplier's production capacity (supplier_capacity).
- transit_delay: the shipment itself is late/delayed while physically in transit (already shipped, en route),
  for reasons not covered by a more specific category above — do NOT use this just because the word "delay"
  appears; check first whether it's actually about a material/component not being ready (material_shortage).
- supplier_capacity: "over capacity" — the PO quantity placed with the supplier exceeds what they can actually
  produce/handle — or general factory/staffing capacity constraints, overbooking.
- other: use ONLY when the text genuinely doesn't describe a supply-chain delay/issue (e.g. an unrelated
  administrative note, or a note simply referencing another PO/line as the real cause without describing what
  that cause was) — do not use "other" just because you're unsure; pick the closest real category above first.

Respond with ONLY a raw JSON object of the exact shape {"results": [{"category": string, "cleaned_summary": string}, ...]}
— one entry per input reason, in the same order, no markdown, no code fences, no commentary. "category" MUST be
exactly one of: ${REASON_CATEGORIES.join(', ')}. "cleaned_summary" is a short (<=12 word) plain-English summary.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
    return reasons.map((r, i) => {
      const result = parsed.results[i];
      const category = (result?.category ?? '') as ReasonCategory;
      if (!REASON_CATEGORIES.includes(category)) return classifyReasonByKeywords(r);
      return { category, cleaned_summary: result?.cleaned_summary ?? r };
    });
  } catch (err) {
    // Anthropic call failed (bad key, rate limit, etc.) — fall back to the keyword classifier
    // instead of dumping the whole batch into "other".
    console.error('classify-reason: Anthropic call failed, falling back to keyword classifier', err);
    return reasons.map((r) => classifyReasonByKeywords(r));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { reasons?: unknown };
    const reasons = Array.isArray(body.reasons) ? body.reasons.filter((r): r is string => typeof r === 'string') : [];
    if (reasons.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Junk (bare numbers, single characters, etc.) never reaches the model — it's not a real
    // loss reason and shouldn't cost an API call or get force-bucketed into "other".
    const uniqueRaw = [...new Set(reasons.map((r) => r.trim()).filter(isSubstantiveReason))];
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
      const trimmed = raw.trim();
      if (!isSubstantiveReason(trimmed)) {
        return { reason: raw, category: 'other' as ReasonCategory, cleaned_summary: '' };
      }
      const hash = hashReason(trimmed);
      const entry = cached.get(hash) ?? classifyReasonByKeywords(trimmed);
      return { reason: raw, ...entry };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('classify-reason route failed:', err);
    return NextResponse.json({ error: 'classification failed' }, { status: 500 });
  }
}
