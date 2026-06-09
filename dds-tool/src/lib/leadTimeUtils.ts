import { differenceInDays } from 'date-fns';
import type { PurchaseLine } from '../types';
import { categorizeSKU } from './skuUtils';
import { TARGET_LT, avgAgreedLTByCategory } from '../data/leadTimeData';

// Production LT = order date → actual ship date
// we also track planned (order → PGRD) and expected (order → EGRD) for comparison
// target is 30 days for everyone, agreed LT varies by supplier

export interface LeadTimeResult {
  line: PurchaseLine;
  plannedLT: number | null;
  expectedLT: number | null;
  productionLT: number | null; // the main one — only available after shipment
  agreedLT: number;
  targetLT: number;
  vsAgreed: number | null;  // negative = early, positive = late
  vsTarget: number | null;
}

// using category avg for now — will be more accurate when supplier code → vendor name mapping exists
function lookupAgreedLT(line: PurchaseLine): number {
  return avgAgreedLTByCategory(categorizeSKU(line.sku));
}

// open POs and unshipped lines can't be scored yet
function canScore(line: PurchaseLine): boolean {
  return line.status.toLowerCase() !== 'open' && !!line.asd;
}

export function computeLeadTime(line: PurchaseLine): LeadTimeResult {
  const { orderDate: od, pgrd, egrd, asd } = line;
  const plannedLT    = od && pgrd ? differenceInDays(pgrd, od) : null;
  const expectedLT   = od && egrd ? differenceInDays(egrd, od) : null;
  const productionLT = od && asd  ? differenceInDays(asd,  od) : null;
  const agreedLT = lookupAgreedLT(line);

  return {
    line, plannedLT, expectedLT, productionLT, agreedLT,
    targetLT: TARGET_LT,
    vsAgreed: productionLT != null ? productionLT - agreedLT : null,
    vsTarget: productionLT != null ? productionLT - TARGET_LT : null,
  };
}

export interface LeadTimeSummary {
  avgPlannedLT: number | null;
  avgExpectedLT: number | null;
  avgProductionLT: number | null;
  avgAgreedLT: number;
  targetLT: number;
  earlyCount: number;
  avgDaysEarly: number | null;
  avgDaysEarlyVsTarget: number | null;
  lateCount: number;
  avgDaysLate: number | null;
  avgDaysLateVsTarget: number | null;
  onTimeCount: number;
  totalEvaluable: number;
}

export function summariseLeadTimes(lines: PurchaseLine[]): LeadTimeSummary {
  const results = lines.map(computeLeadTime);
  const avg = (nums: (number | null)[]) => {
    const vals = nums.filter((n): n is number => n != null);
    return vals.length ? Math.round(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
  };

  const shipped = results.filter(r => canScore(r.line) && r.productionLT != null);
  const early   = shipped.filter(r => r.vsAgreed != null && r.vsAgreed < 0);
  const late    = shipped.filter(r => r.vsAgreed != null && r.vsAgreed > 0);
  const onTime  = shipped.filter(r => r.vsAgreed === 0);
  // count distinct POs not lines — one PO often has multiple lines with the same LT
  const distinctPOs = (arr: typeof shipped) => new Set(arr.map(r => r.line.po)).size;

  return {
    avgPlannedLT:         avg(results.map(r => r.plannedLT)),
    avgExpectedLT:        avg(results.map(r => r.expectedLT)),
    avgProductionLT:      avg(shipped.map(r => r.productionLT)),
    avgAgreedLT:          Math.round(results.reduce((s, r) => s + r.agreedLT, 0) / Math.max(results.length, 1)),
    targetLT:             TARGET_LT,
    earlyCount:           distinctPOs(early),
    avgDaysEarly:         early.length ? Math.round(early.reduce((s, r) => s + Math.abs(r.vsAgreed!), 0) / early.length) : null,
    avgDaysEarlyVsTarget: early.length ? avg(early.map(r => r.vsTarget)) : null,
    lateCount:            distinctPOs(late),
    avgDaysLate:          late.length  ? Math.round(late.reduce((s, r) => s + r.vsAgreed!, 0) / late.length) : null,
    avgDaysLateVsTarget:  late.length  ? avg(late.map(r => r.vsTarget)) : null,
    onTimeCount:          distinctPOs(onTime),
    totalEvaluable:       distinctPOs(shipped),
  };
}
