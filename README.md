# Production Control Tower

Internal supply chain tool for emma's Production Control team. Upload Business Central purchase
order exports and get a single view of SOT/OTIF performance, backlog, missing bookings, invoicing,
lead times, and root-cause tracking — plus a guided weekly workflow for SCMs to resolve their own
flagged actions.

## Branching & deploys

- **`main`** — production. Vercel builds and deploys from this branch automatically.
- **`dev`** — everything else. Push work-in-progress here first; Vercel gives it its own preview
  deployment on a separate URL, so nothing lands in front of real users until it's been checked.
- Merge `dev` → `main` only once a change has been verified in the preview deployment.

## What it does

The app has a main dashboard and several drill-down pages, all responsive to supplier, channel,
category, and PGRD-week filters:

| Section | What it shows |
|---|---|
| **Dashboard** | Compact cards summarizing SOT/OTIF, Backlog, Missing ESD, and Root Cause, each linking to its own full drill-down. |
| **SOT & OTIF** | % of POs shipped on time and in full vs. the 90% target, trended by week. Per-supplier scorecard, a Supplier × Root Cause heatmap, and a weekly performance strip. |
| **Backlog** | POs past their PGRD with no ASD yet, split by how overdue they are. Per-supplier breakdown. |
| **Missing ESD** | POs with EGRD already in the past and no shipment booked (no ESD) — the earliest-warning signal, before a PO can even be evaluated for SOT. |
| **Root Cause** | Analysis of *why* POs missed SOT — driven entirely by root causes SCMs submit while resolving their flagged actions (see My Actions below), not by AI-guessed text. |
| **Invoicing** | Overdue and pending-approval invoices, aging buckets, and supplier exposure. |
| **Lead Time** | Production lead time (Order Date → ASD) vs. target, per supplier and SKU category. |
| **My Actions** | A guided, one-task-at-a-time workflow: an SCM picks their name and a PGRD week, then works through every PO action assigned to them (grouped by what's actually being asked — book a shipment, explain a miss, etc.), followed by any outstanding Open Points. |
| **All Actions** | The full searchable history of every flag and Open Point, across every SCM, open or closed. |
| **Raw Data** | The uploaded Business Central export, filterable and exportable. |

## Running it

Needs Node.js 20+. The app is pure client-side — nothing persists server-side except the two
Airtable/Anthropic-backed API routes noted below; uploaded data and actions live in the browser's
`localStorage` for the session.

```bash
cd dds-tool
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Needs `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`,
and an Anthropic key (see `dds-tool/.env.example`) for the vendor-mapping (China-supplier detection)
and loss-reason-classification API routes — everything else works without them.

### Uploading data

Drag your Business Central exports into the Upload panel: Purchase Header and Purchase Lines are
required; an invoices export is optional. Files are auto-detected by column headers.

## KPI formulas

**SOT (Shipped On Time)** — per line, compared against the PGRD week (China suppliers: PGRD − 1 week):
- PGRD week already closed: on-time if `Week(ASD) <= threshold week`; no ASD at all = a hard fail.
- PGRD week current or future: on-time if `Week(ESD) <= threshold week`; no ESD yet = undetermined (doesn't count either way).

**OTIF (On Time In Full)**
```
Week(EGRD) <= threshold week   AND   CQTY >= QTY
```

Weeks are ISO (Monday–Sunday), PGRD is always a week-ending Sunday.

## Tech stack

- **Next.js 15** (App Router, client-only — no server components, no SSR)
- **TypeScript**
- **Tailwind CSS**
- **Recharts** for charts
- **xlsx** for parsing BC exports (formula/HTML injection disabled)
- **date-fns** for date logic

## Repo layout

```
dds-tool/
  src/
    app/           routes — one folder per page (App Router)
    components/    Dashboard, drill-downs, Actions/My Actions, shared UI
    context/       DataContext — uploaded PO lines, invoices, global filters
    hooks/         useFilters, useKPIs, useActions, useVendorMapping
    lib/           business logic — kpiFormulas, rulesEngine, poAggregation, bcParser
    types/         shared TypeScript interfaces
```
