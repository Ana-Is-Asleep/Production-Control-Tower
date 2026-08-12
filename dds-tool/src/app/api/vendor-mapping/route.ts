import { NextResponse } from 'next/server';

// "1st Mile Data" base, md_locations table — maps vendor_code -> location_code.
// Table ID is hardcoded (no separate env var for it); base ID + API key come from env.
const TABLE_ID = 'tblS7twUlNjMt9OLf';

export interface VendorMappingEntry {
  vendorCode: string;
  locationCode: string;
  channels: string[];
}

interface AirtableRecord {
  id: string;
  fields: {
    location_code?: string;
    channels?: string[];
    vendor_code?: string;
    'id_vendor_emm (from vendor_code_link)'?: string;
  };
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Simple in-module cache — this table changes rarely, so avoid re-hitting Airtable on every request.
let cache: { data: VendorMappingEntry[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error('AIRTABLE_API_KEY / AIRTABLE_BASE_ID not configured');
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${TABLE_ID}`);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      // this table is small and rarely changes — we own the caching via the in-module cache above
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Airtable request failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as AirtableListResponse;
    records.push(...json.records);
    offset = json.offset;
  } while (offset);

  return records;
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(cache.data);
    }

    const records = await fetchAllRecords();
    // id_vendor_emm is the lookup that mirrors the real Business Central vendor number —
    // vendor_code is a separate internal identifier and does NOT match BC exports, so it's
    // only used as a fallback for records where the emm lookup is empty.
    const data: VendorMappingEntry[] = records
      .filter((r) => r.fields['id_vendor_emm (from vendor_code_link)'] || r.fields.vendor_code)
      .map((r) => ({
        vendorCode: String(r.fields['id_vendor_emm (from vendor_code_link)'] || r.fields.vendor_code || ''),
        locationCode: String(r.fields.location_code ?? ''),
        channels: r.fields.channels ?? [],
      }));

    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    // Never let a transient Airtable outage break the dashboard — the client-side hook already
    // defaults isChinaSupplier() to false when the mapping is unavailable.
    console.error('vendor-mapping route failed:', err);
    return NextResponse.json({ error: 'vendor mapping unavailable' }, { status: 502 });
  }
}
