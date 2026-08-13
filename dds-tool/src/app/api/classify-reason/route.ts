import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  REASON_CATEGORIES, hashReason, isSubstantiveReason, classifyReasonByKeywords,
  type ClassifiedReason, type ReasonCategory, type ComponentType,
} from '../../../lib/reasonClassification';

const BATCH_SIZE = 20;

// In-memory only — root-cause loss-reason text must never be persisted to Airtable (or any
// external store). This cache resets on every server restart/redeploy, which is fine: it only
// exists to avoid re-classifying the same text repeatedly within a running server instance.
const memoryCache = new Map<string, ClassifiedReason>();

async function classifyBatch(reasons: string[]): Promise<ClassifiedReason[]> {
  const apiKey = process.env.controltower;
  // No key configured — fall back to the deterministic keyword classifier rather than "other_unclear".
  if (!apiKey) {
    return reasons.map((r) => classifyReasonByKeywords(r));
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a classifier specialized in delay/loss causes for Purchase Orders in a mattress and
furniture supply chain. You will receive the raw value of the Loss Reason Code field for individual PO lines —
free text written by different people, often mixing English, German, Portuguese and Spanish, with spelling
errors, extra whitespace, and PO numbers, dates or quantities embedded in the text.

Classify each line independently into exactly one primary category from the fixed taxonomy below.

Normalization rules (always apply before classifying):
- Trim whitespace, treat case differences as equivalent.
- Treat obvious spelling/formatting variants as equivalent: "reshuffling" / "reschuffling", "TPE delay" /
  "TPE delays" / "TPE Delays " (extra spaces), "Pakistan" / "Pakisan".
- Mentally translate non-English terms before classifying (e.g. "Pedido > Capacidad acordada" = Spanish/Portuguese
  for "Order > agreed Capacity"; "Bezüge kommen" = German for "covers arriving"; "Anlieferung der covers 2 Wochen
  zu spät" = "cover delivery 2 weeks late").
- When the text contains multiple causes concatenated (e.g. "TPE delay & defective covers", "wrong pallet
  quantity, production availability"), use the cause mentioned first as the primary category and record the
  second one in secondary_category (and secondary_component_type if applicable).
- PO numbers (e.g. "PO-E-51201"), dates, and internal references (e.g. "moved to PO-E-53333", "reorganization
  PO-E-54871") do not change the category — treat them as noise for classification purposes.

Categories:
- component_supply_delay: missing or delayed delivery/production of any physical product component: cover/textile,
  fabric, springs/metal, or TPE. These four families share the same root cause (a supplier failing to deliver a
  component) so they live in a single category — use component_type to say which is involved (Cover/Textile,
  Fabric, Springs/Metal, or TPE). Examples: "covers LT", "Cover Delays", "cover & mattress bag delays", "delay in
  the covers delivery coming from Ikano", "no covers available", "defective cover" (Cover/Textile); "UK fabric's
  leadtime is longer than normal", "fabrics delivery from BD is delayed" (Fabric); "Springs delay LPT -
  PO-E-51201", "lack of springs from Agro", "L&P delays" (Springs/Metal); "TPE Delays", "TPE delay & defective
  covers" (TPE).
- production_capacity_constraint: the factory/supplier does not have enough capacity for the order placed (not a
  missing component — a hard capacity ceiling). Examples: "Order > agreed Capacity", "Capacity Constraints", "over
  capacity", "very difficult to produce", "affected by other lines".
- holiday_plant_shutdown: stoppage due to public holidays or a seasonal shutdown. Examples: "Eid Holidays
  Pakistan", "Winter shutdown - week 52 and 1", "holiday break", "Emma shipping limited during holiday".
- transport_warehouse_slot_capacity: no slot/availability at the warehouse or on the transport leg, or the wrong
  type of transport equipment for the cargo (e.g. a refrigerated container needed). Does NOT include loading
  calculation errors — those belong to truck_rounding_pallet_configuration_error. Examples: "no inbound slot at
  HA_DE", "the capacity of cooling ctnr in rail smaller than by sea", "no available slots", "frigo truck/cooling
  units".
- truck_rounding_pallet_configuration_error: a miscalculation of how many units/pallets fit in a truck or
  container (truck rounding), including wrong quantity per pallet or wrong packing multiple. Examples: "Wrong
  Truck Rounding", "wrong pallet quantity", "wrong multiple - 6 units/1 pallet", "lack of space in the truck",
  "too many pallets included in this PO, one of them has not fit into trailer".
- po_reshuffling_erp_issue: PO reorganization, date changes driven by an internal decision, or an ERP system
  error/limitation (not a general IT infrastructure failure). Examples: "PO reshuffling", "Rescheduling caused by
  the ERP system", "reorganization PO-E-54871", "moved to PO-E-53333", "NQ error-daily plan reorganization".
- it_issue: general IT/systems infrastructure failure reported as the direct cause, with no mention of plan
  reorganization. Example: "IT issues".
- forecast_order_quantity_mismatch: a gap between what was ordered, forecasted, or confirmed — at the level of
  total order quantity, not physical loading/packing. Examples: "the actual order is higher than the forecast
  number", "we confirmed 120 in file", "fcast deviation".
- quality_issue: a product/component quality defect, distinct from equipment breakdown. Examples: "Quality
  Issues", "1pcs short shipped caused by defective covers" (when the focus is the defect itself, not the missing
  component).
- machine_production_issue: equipment breakdown or a production-process failure that blocks manufacturing even
  though the component is available. Examples: "had to be postponed due to a defective machine", "technical issue
  with our packaging", "due to machine issues, we were unable to manufacture the extensions on time".
- administrative_planning_error: a human planning error not covered above (wrong leadtime assumption, PO received
  late on the internal side). Examples: "Wrong Leadtimes Assumptions", "PO received later", "missed in PO
  placement", "lead time not respected".
- other_unclear: text too vague, cut off, or without enough information to classify with confidence ("storno",
  "internal issue", "0 for emma request"). Use this instead of forcing one of the above when confidence is low —
  but do not use it just because you're unsure; pick the closest real category first.

Respond with ONLY a raw JSON object of the exact shape:
{"results": [{"category": string, "component_type": string|null, "secondary_category": string|null,
"secondary_component_type": string|null, "supplier_tag": string|null, "confidence": "high"|"medium"|"low",
"cleaned_summary": string}, ...]}
— one entry per input line, in the same order, no markdown, no code fences, no commentary. "category" and
"secondary_category" MUST be exactly one of: ${REASON_CATEGORIES.join(', ')} (or null for secondary_category).
"component_type"/"secondary_component_type" MUST be exactly one of "Cover/Textile", "Fabric", "Springs/Metal",
"TPE", or null (only set when the corresponding category is component_supply_delay). "supplier_tag" is a short
supplier name/code mentioned in the text (e.g. Ikano, BD, Agro, Bekaert, L&P), or null. "cleaned_summary" is a
short (<=12 word) plain-English summary.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
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
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
      results: {
        category: string; component_type: string | null; secondary_category: string | null;
        secondary_component_type: string | null; supplier_tag: string | null;
        confidence: string; cleaned_summary: string;
      }[];
    };

    return reasons.map((r, i) => {
      const result = parsed.results[i];
      const category = (result?.category ?? '') as ReasonCategory;
      if (!REASON_CATEGORIES.includes(category)) return classifyReasonByKeywords(r);
      const secondaryCategory = result?.secondary_category as ReasonCategory | null;
      return {
        category,
        cleaned_summary: result?.cleaned_summary ?? r,
        componentType: (result?.component_type as ComponentType | null) ?? null,
        secondaryCategory: secondaryCategory && REASON_CATEGORIES.includes(secondaryCategory) ? secondaryCategory : null,
        secondaryComponentType: (result?.secondary_component_type as ComponentType | null) ?? null,
        supplierTag: result?.supplier_tag ?? null,
        confidence: (['high', 'medium', 'low'].includes(result?.confidence) ? result.confidence : 'medium') as ClassifiedReason['confidence'],
      };
    });
  } catch (err) {
    // Anthropic call failed (bad key, rate limit, etc.) — fall back to the keyword classifier
    // instead of dumping the whole batch into "other_unclear".
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
    // loss reason and shouldn't cost an API call or get force-bucketed into "other_unclear".
    const uniqueRaw = [...new Set(reasons.map((r) => r.trim()).filter(isSubstantiveReason))];
    const hashOf = new Map(uniqueRaw.map((r) => [r, hashReason(r)]));

    const cached = new Map<string, ClassifiedReason>();
    for (const [, hash] of hashOf) {
      if (memoryCache.has(hash)) cached.set(hash, memoryCache.get(hash)!);
    }

    const unseen = uniqueRaw.filter((raw) => !cached.has(hashOf.get(raw)!));

    for (let i = 0; i < unseen.length; i += BATCH_SIZE) {
      const batch = unseen.slice(i, i + BATCH_SIZE);
      const results = await classifyBatch(batch);
      batch.forEach((raw, idx) => {
        const hash = hashOf.get(raw)!;
        const result = results[idx];
        cached.set(hash, result);
        memoryCache.set(hash, result);
      });
    }

    // return results aligned to the original (non-deduped) request order
    const results = reasons.map((raw) => {
      const trimmed = raw.trim();
      if (!isSubstantiveReason(trimmed)) {
        return { reason: raw, category: 'other_unclear' as ReasonCategory, cleaned_summary: '' };
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
