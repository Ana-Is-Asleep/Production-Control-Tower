import { differenceInDays } from 'date-fns';
import type { PurchaseLine } from '../types';
import { categorizeSKU } from './skuUtils';
import { AGREED_LEAD_TIMES, TARGET_LT, avgAgreedLTByCategory } from '../data/leadTimeData';

// Production Lead Time = days from Order Date to ASD
// Excludes Open status lines and lines without ASD (not yet shipped)
// Target: 30 days

export interface LeadTimeResult {
  line: PurchaseLine;
  plannedLT: number | null;      // orderDate → PGRD (what was planned)
  expectedLT: number | null;     // orderDate → EGRD (what's expected now)
  productionLT: number | null;   // orderDate → ASD (the actual production LT — primary KPI)
  agreedLT: number;              // from the agreed LT table, falls back to category avg
  targetLT: number;              // always 30 days
  vsAgreed: number | null;       // productionLT - agreedLT (negative = early, positive = late)
  vsTarget: number | null;       // productionLT - 30
}

// open POs don't have ASD yet and are excluded from production LT
function isEligible(line: PurchaseLine): boolean {
  return line.status.toLowerCase() !== 'open' && !!line.asd;
}

// agreed LT lookup — falls back to category average until supplier code mapping is built
function lookupAgreedLT(line: PurchaseLine): number {
  const cat = categorizeSKU(line.sku);
  return avgAgreedLTByCategory(cat);
}

export function computeLeadTime(line: PurchaseLine): LeadTimeResult {
  const { orderDate, pgrd, egrd, asd } = line;
  const plannedLT    = orderDate && pgrd ? differenceInDays(pgrd, orderDate) : null;
  const expectedLT   = orderDate && egrd ? differenceInDays(egrd, orderDate) : null;
  const productionLT = orderDate && asd  ? differenceInDays(asd,  orderDate) : null;
  const agreedLT     = lookupAgreedLT(line);

  return {
    line,
    plannedLT,
    expectedLT,
    productionLT,
    agreedLT,
    targetLT: TARGET_LT,
    vsAgreed: productionLT !== null ? productionLT - agreedLT : null,
    vsTarget: productionLT !== null ? productionLT - TARGET_LT : null,
  };
}

export interface LeadTimeSummary {
  avgPlannedLT: number | null;
  avgExpectedLT: number | null;
  avgProductionLT: number | null; // the primary KPI
  avgAgreedLT: number;
  targetLT: number;
  // early = productionLT < agreedLT
  earlyCount: number;
  avgDaysEarly: number | null;
  avgDaysEarlyVsTarget: number | null;
  // late = productionLT > agreedLT
  lateCount: number;
  avgDaysLate: number | null;
  avgDaysLateVsTarget: number | null;
  onTimeCount: number;
  totalEvaluable: number; // lines with ASD and not Open
}

export function summariseLeadTimes(lines: PurchaseLine[]): LeadTimeSummary {
  const results = lines.map(computeLeadTime);

  const avg = (nums: (number | null)[]) => {
    const valid = nums.filter((n): n is number => n !== null);
    return valid.length > 0 ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length) : null;
  };

  // production LT only evaluates shipped, non-Open lines
  const shipped = results.filter((r) => isEligible(r.line) && r.productionLT !== null);
  const early   = shipped.filter((r) => r.vsAgreed !== null && r.vsAgreed < 0);
  const late    = shipped.filter((r) => r.vsAgreed !== null && r.vsAgreed > 0);
  const onTime  = shipped.filter((r) => r.vsAgreed === 0);

  return {
    avgPlannedLT:    avg(results.map((r) => r.plannedLT)),
    avgExpectedLT:   avg(results.map((r) => r.expectedLT)),
    avgProductionLT: avg(shipped.map((r) => r.productionLT)),
    avgAgreedLT:     Math.round(results.reduce((s, r) => s + r.agreedLT, 0) / Math.max(results.length, 1)),
    targetLT:        TARGET_LT,
    earlyCount:      early.length,
    avgDaysEarly:    early.length > 0 ? Math.round(early.reduce((s, r) => s + Math.abs(r.vsAgreed!), 0) / early.length) : null,
    avgDaysEarlyVsTarget: early.length > 0 ? avg(early.map((r) => r.vsTarget)) : null,
    lateCount:       late.length,
    avgDaysLate:     late.length > 0 ? Math.round(late.reduce((s, r) => s + r.vsAgreed!, 0) / late.length) : null,
    avgDaysLateVsTarget: late.length > 0 ? avg(late.map((r) => r.vsTarget)) : null,
    onTimeCount:     onTime.length,
    totalEvaluable:  shipped.length,
  };
}
