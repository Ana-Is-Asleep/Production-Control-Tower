# Production Control Tower

Internal supply chain tool for emma's Production Control team. Upload Business Central purchase
order exports and get a single view of SOT/OTIF performance, backlog, missing bookings, invoicing,
lead times, and root-cause tracking — plus a guided weekly workflow for SCMs to resolve their own
flagged actions.

## Repo structure

This repo currently contains **two implementations of the same app**, kept in lockstep feature-for-feature:

```
dds-tool/   Next.js 15 (App Router) — current production app, deployed on Vercel
pct-web/    Vite + React Router — migration target for moving off Vercel, not yet deployed
```

Every change is mirrored between the two. `dds-tool` is the one currently live; `pct-web` exists so
the app can move to a different hosting platform without a rewrite. Whether `pct-web` eventually
replaces `dds-tool` outright, or both keep being maintained side by side, is still an open decision —
until it's made, treat both as equally real.

## Branching & deploys

- **`main`** — production. Vercel builds and deploys `dds-tool` from this branch automatically.
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

Both apps need Node.js 20+ and read their data entirely client-side (nothing persists server-side
except the two Anthropic/Airtable-backed API routes noted below) — actions and uploaded data live in
the browser's `localStorage` for the session.

### dds-tool (Next.js)

```bash
cd dds-tool
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Needs `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`,
and an Anthropic key (see `.env.example`) for the vendor-mapping and loss-reason-classification API
routes — everything else works without them.

### pct-web (Vite)

```bash
cd pct-web
npm install
npm run dev
```

Opens on Vite's default port. No server-side API routes — this app is fully static/client-side.

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

| | dds-tool | pct-web |
|---|---|---|
| Framework | Next.js 15 (App Router, client-only) | Vite + React Router |
| Language | TypeScript | TypeScript |
| Styling | Tailwind CSS | Tailwind CSS |
| Charts | Recharts | Recharts |
| Parsing | `xlsx` (formula/HTML injection disabled) | `xlsx` |
| Dates | `date-fns` | `date-fns` |

## Repo layout (per app)

```
src/
  app/ or pages via App.tsx   routes — one per drill-down page
  components/                 Dashboard, drill-downs, Actions/My Actions, shared UI
  context/                    DataContext — uploaded PO lines, invoices, global filters
  hooks/                      useFilters, useKPIs, useActions, useVendorMapping
  lib/                        business logic — kpiFormulas, rulesEngine, poAggregation, bcParser
  types/                      shared TypeScript interfaces
```
