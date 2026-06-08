# DDS - Production Control Tower

Internal tool for the **P2W EU D2C** supply chain team at emma. Built for the weekly DDS (Daily Direction Setting) meeting. Upload your Business Central exports and get a clean view of SOT, OTIF, backlog, invoices, lead times and pickups all in one place.

## What it does

The tool has a main dashboard and several drill-down pages. Everything responds to vendor, category, and PGRD week filters.

| Section | What it shows |
|---|---|
| **SOT + OTIF** | % of POs shipped on time and in full vs the 90% target. Trend chart for the last 6 weeks + 3 future. Click a week bar to filter the breakdown table. Vendor drill-down shows which POs are pulling the score down and their BC loss reason. |
| **Backlog** | POs without ASD, split into Critical (>14d overdue), Recent (14d or less), and Future Backlog (ESD already slipping). Stacked bar chart by vendor. |
| **Not Booked** | POs where Shiptify has not confirmed a pickup booking (no EDD in BC). Grouped by PO with expandable lines. |
| **Invoices** | Overdue P2W, Total Pending, Due by End of Week, Approved Awaiting Payment with SCF due date recalculation per supplier. Online/Offline channel filter. Supplier breakdown table for overdue. |
| **Lead Times** | Production LT (Order Date to ASD) vs agreed LT and 30-day target. Per-vendor bar chart. Early/late split with averages. |
| **Pickups** | Upcoming Shiptify bookings (next real calendar week) as bars, historical average per day of week as a dashed line. Click into days to see which POs are scheduled. |
| **Prepare for Meeting** | Two-step flow: pick your vendors, add root causes for every failing line. Progress bar. Ready button goes green when everything is annotated. |

## Running it

### GitHub Codespaces

1. Go to the repo on GitHub
2. Click **Code** > **Codespaces** > **Create codespace on main**
3. It runs `npm install` automatically when the environment starts
4. In the terminal: `cd dds-tool && npm run dev`
5. A browser tab opens on port 3000

### Local

You need Node.js 20+.

```bash
git clone https://github.com/Ana-Is-Asleep/Production-Control-Tower
cd Production-Control-Tower/dds-tool
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
cd dds-tool
docker build -t dds-tool .
docker run -p 3000:3000 dds-tool
```

### Anywhere else

No environment variables needed, everything runs client-side.

```bash
npm run build
npm start
```

## Uploading data

Drag all your files at once into the Upload panel (top right).

| File | What it is | Required |
|---|---|---|
| Purchase Header | BC Purchase Header export | Yes |
| Purchase Lines | BC Purchase Order Lines export | Yes |
| Invoices | `Un-Posted_and_posted_invoices.xlsx` | Optional |

Files are auto-detected by their column headers, no renaming needed. The extended 46-column Lines file gives you more accurate ESD data (Expected Shipping Date) vs the default 20-column export.

## Filters

| Filter | What it does |
|---|---|
| **Vendor** | Filters everything: SOT, backlog, pickups, lead times, invoices all update |
| **Category** | Beds / Mattresses / Accessories / Comps/Other, derived from the SKU code |
| **Week** | Switches the analysis to a different PGRD week. Pickups always show the next real calendar week regardless. |

Filters persist when you drill down. If Flex 2000 is selected and you click Backlog, the backlog page shows Flex 2000 only.

## KPI formulas

**SOT (Shipped On Time)**
```
Week(ASD) <= Week(PGRD)  AND  CQTY >= 0.97 x QTY
```

**OTIF (On Time In Full)**
```
Week(EGRD) <= Week(PGRD)  AND  CQTY >= 0.97 x QTY
```

**Expected SOT** (future weeks, predicted from Shiptify booking)
```
Week(ESD) <= Week(PGRD)
```

**Production Lead Time**
```
ASD - Order Date  (days, target = 30)
```

Weeks are Sunday-aligned (Europe spec). 3% quantity tolerance on in-full because BC rounds confirmed quantities.

## Tech stack

- **Next.js 15** App Router, pure client-side (no server components, no API routes)
- **TypeScript**
- **Tailwind CSS**
- **Recharts** for charts
- **xlsx** for parsing BC exports (formula/HTML injection disabled)
- **date-fns** for date logic

## Repo structure

```
dds-tool/
  src/
    app/           next.js pages (one folder per route)
    components/    Dashboard, PrepareModal, UploadPanel, shared UI
    context/       DataContext: BC lines, invoices, annotations, global filters
    hooks/         useFilters, useKPIs, useAnnotations
    lib/           business logic: kpiFormulas, bcParser, invoiceUtils, leadTimeUtils, skuUtils
    types/         TypeScript interfaces
    data/          agreed lead time sample data (Airtable integration coming)
```

## Coming up

- Airtable integration for agreed lead times
- Lead time file upload
- Backlog recovery timeline
