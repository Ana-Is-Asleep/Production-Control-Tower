import { differenceInDays } from 'date-fns';
import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { PurchaseLine, KPIResult, BacklogType } from '../types';

// SOT = shipped in the same ISO week as PGRD, and quantity within ±3% tolerance
// the 3% band is intentional — BC rounding means exact match is unreliable
export function computeSOT(line: PurchaseLine): boolean | null {
  // skip if no ASD, means it hasn't shipped yet
  if (!line.asd || !line.pgrd) return null;
  const sameWeek =
    getISOWeek(line.asd) === getISOWeek(line.pgrd) &&
    getISOWeekYear(line.asd) === getISOWeekYear(line.pgrd);
  const inFull = line.cqty >= line.qty * 0.97 && line.cqty <= line.qty * 1.03;
  return sameWeek && inFull;
}

// OTIF = expected receipt on or before PGRD, and quantity within ±3%
export function computeOTIF(line: PurchaseLine): { ot: boolean | null; inFull: boolean | null; otif: boolean | null } {
  // skip if no EGRD, can't evaluate on-time without an expected date
  if (!line.egrd || !line.pgrd) return { ot: null, inFull: null, otif: null };
  const ot = line.egrd <= line.pgrd;
  const inFull = line.cqty >= line.qty * 0.97 && line.cqty <= line.qty * 1.03;
  return { ot, inFull, otif: ot && inFull };
}

export function computeKPI(line: PurchaseLine): KPIResult {
  const sotResult = computeSOT(line);
  const { ot, inFull, otif } = computeOTIF(line);
  return {
    sotResult,
    sotFail: sotResult === false,
    otif,
    ot,
    inFull,
    otifFail: otif === false || ot === false,
  };
}

export function classifyBacklog(line: PurchaseLine, today: Date): BacklogType {
  // already shipped, not a backlog item
  if (line.asd) return 'on-time';
  // skip if no date, happens with open POs
  if (!line.pgrd) return 'on-time';
  const daysPast = differenceInDays(today, line.pgrd);
  if (daysPast > 14) return 'critical';
  if (daysPast > 0) return 'recent';
  // at-risk = hasn't missed PGRD yet but ESD is already past it
  if (line.esd && line.pgrd && line.esd > line.pgrd) return 'at-risk';
  return 'on-time';
}

// expected SOT: if ESD falls in same ISO week as PGRD, the line is on track to be SOT
// only applies to lines that haven't shipped yet (no ASD)
export function computeExpectedSOT(line: PurchaseLine): boolean | null {
  if (line.asd) return null; // already shipped, use actual SOT
  if (!line.esd || !line.pgrd) return null;
  return getISOWeek(line.esd) === getISOWeek(line.pgrd) &&
    getISOWeekYear(line.esd) === getISOWeekYear(line.pgrd);
}

export const SOT_TARGET = 90;
export const OTIF_TARGET = 90;
