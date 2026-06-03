import { differenceInDays } from 'date-fns';
import type { PurchaseLine } from '../types';
import { categorizeSKU } from './skuUtils';
import { AGREED_LEAD_TIMES, TARGET_LT, avgAgreedLTByCategory } from '../data/leadTimeData';

export interface LeadTimeResult {
  line: PurchaseLine;
  plannedLT: number | null;   // orderDate → PGRD
  expectedLT: number | null;  // orderDate → EGRD
  actualLT: number | null;    // orderDate → ASD (only if shipped)
  agreedLT: number;           // from the agreed LT table, falls back to category avg
  targetLT: number;           // always 30
  // vs agreed LT
  vsAgreed: number | null;    // actualLT - agreedLT (negative = early, positive = late)
  // vs target
  vsTarget: number | null;    // actualLT - 30
}

// agreed LT lookup: try supplier code match first, fall back to category average
function lookupAgreedLT(line: PurchaseLine): number {
  const cat = categorizeSKU(line.sku);
  // try to fuzzy-match vendor name to supplier code
  // e.g. "Kayfoam Woolfson" → KF_IE, "Sinomax..." → SNX1_CN
  // for now use category average until file upload maps codes to vendor names
  return avgAgreedLTByCategory(cat);
}

export function computeLeadTime(line: PurchaseLine): LeadTimeResult {
  const { orderDate, pgrd, egrd, asd } = line;
  const plannedLT = orderDate && pgrd ? differenceInDays(pgrd, orderDate) : null;
  const expectedLT = orderDate && egrd ? differenceInDays(egrd, orderDate) : null;
  const actualLT = orderDate && asd ? differenceInDays(asd, orderDate) : null;
  const agreedLT = lookupAgreedLT(line);

  return {
    line,
    plannedLT,
    expectedLT,
    actualLT,
    agreedLT,
    targetLT: TARGET_LT,
    vsAgreed: actualLT !== null ? actualLT - agreedLT : null,
    vsTarget: actualLT !== null ? actualLT - TARGET_LT : null,
  };
}

export interface LeadTimeSummary {
  avgPlannedLT: number | null;
  avgExpectedLT: number | null;
  avgActualLT: number | null;
  avgAgreedLT: number;
  targetLT: number;
  // early = actualLT < agreedLT
  earlyCount: number;
  avgDaysEarly: number | null;
  avgDaysEarlyVsTarget: number | null;
  // late = actualLT > agreedLT
  lateCount: number;
  avgDaysLate: number | null;
  avgDaysLateVsTarget: number | null;
  onTimeCount: number;
  totalEvaluable: number;
}

export function summariseLeadTimes(lines: PurchaseLine[]): LeadTimeSummary {
  const results = lines.map(computeLeadTime);

  const avg = (nums: (number | null)[]) => {
    const valid = nums.filter((n): n is number => n !== null);
    return valid.length > 0 ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length) : null;
  };

  const shipped = results.filter((r) => r.actualLT !== null);
  const early = shipped.filter((r) => r.vsAgreed !== null && r.vsAgreed < 0);
  const late  = shipped.filter((r) => r.vsAgreed !== null && r.vsAgreed > 0);
  const onTime = shipped.filter((r) => r.vsAgreed === 0);

  return {
    avgPlannedLT:  avg(results.map((r) => r.plannedLT)),
    avgExpectedLT: avg(results.map((r) => r.expectedLT)),
    avgActualLT:   avg(shipped.map((r) => r.actualLT)),
    avgAgreedLT:   Math.round(results.reduce((s, r) => s + r.agreedLT, 0) / Math.max(results.length, 1)),
    targetLT:      TARGET_LT,
    earlyCount:    early.length,
    avgDaysEarly:  early.length > 0 ? Math.round(early.reduce((s, r) => s + Math.abs(r.vsAgreed!), 0) / early.length) : null,
    avgDaysEarlyVsTarget: early.length > 0 ? avg(early.map((r) => r.vsTarget)) : null,
    lateCount:     late.length,
    avgDaysLate:   late.length > 0 ? Math.round(late.reduce((s, r) => s + r.vsAgreed!, 0) / late.length) : null,
    avgDaysLateVsTarget: late.length > 0 ? avg(late.map((r) => r.vsTarget)) : null,
    onTimeCount:   onTime.length,
    totalEvaluable: shipped.length,
  };
}
