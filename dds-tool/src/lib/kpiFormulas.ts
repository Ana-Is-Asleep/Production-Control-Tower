import { differenceInDays, startOfISOWeek } from 'date-fns';
import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { PurchaseLine, KPIResult, BacklogType } from '../types';

// SOT = Week(ASD) ≤ Week(PGRD) AND CQTY ≥ 0.97 × QTY
// early shipment counts as SOT — only the lower quantity bound applies
export function computeSOT(line: PurchaseLine): boolean | null {
  // skip if no ASD, means it hasn't shipped yet
  if (!line.asd || !line.pgrd) return null;
  // shipped on time if the week of ASD is the same or earlier than the week of PGRD
  const shippedOnTime = startOfISOWeek(line.asd) <= startOfISOWeek(line.pgrd);
  const inFull = line.cqty >= line.qty * 0.97;
  return shippedOnTime && inFull;
}

// On-Time = Week(EGRD) ≤ Week(PGRD)
// In-Full = CQTY ≥ 0.97 × QTY
// OTIF = On-Time AND In-Full
export function computeOTIF(line: PurchaseLine): { ot: boolean | null; inFull: boolean | null; otif: boolean | null } {
  // skip if no EGRD, can't evaluate on-time without a confirmed delivery date
  if (!line.egrd || !line.pgrd) return { ot: null, inFull: null, otif: null };
  const ot = startOfISOWeek(line.egrd) <= startOfISOWeek(line.pgrd);
  const inFull = line.cqty >= line.qty * 0.97;
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

// expected SOT using ESD: Week(ESD) ≤ Week(PGRD) — same logic as actual SOT
// only applies to lines that haven't shipped yet (no ASD)
export function computeExpectedSOT(line: PurchaseLine): boolean | null {
  if (line.asd) return null; // already shipped, use actual SOT
  if (!line.esd || !line.pgrd) return null;
  return startOfISOWeek(line.esd) <= startOfISOWeek(line.pgrd);
}

export const SOT_TARGET = 90;
export const OTIF_TARGET = 90;
