import { differenceInDays, startOfISOWeek, startOfWeek, addWeeks, startOfDay } from 'date-fns';
import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { PurchaseLine, KPIResult, BacklogType } from '../types';

// Europe uses Sunday-aligned weeks
const SUN_WEEK = { weekStartsOn: 0 as const };
const weekOf = (d: Date) => startOfWeek(d, SUN_WEEK);

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

// Sunday-aligned backlog classification per Europe spec
// cw = current week, nw1/nw2 = next 1/2 weeks, cw+3 = 3+ weeks ahead
export function classifyBacklog(line: PurchaseLine, today: Date): BacklogType {
  if (line.asd) return 'shipped';
  // skip if no date, happens with open POs
  if (!line.pgrd) return 'on-track';

  const cw  = weekOf(startOfDay(today));
  const nw1 = addWeeks(cw, 1);
  const nw2 = addWeeks(cw, 2);
  const nw3 = addWeeks(cw, 3);

  const pgrdWeek = weekOf(line.pgrd);
  const esdWeek  = line.esd ? weekOf(line.esd) : null;

  const isThisWeek  = pgrdWeek.getTime() === cw.getTime();
  const isPastWeek  = pgrdWeek  < cw;
  const isNw1       = pgrdWeek.getTime() === nw1.getTime();
  const isNw2       = pgrdWeek.getTime() === nw2.getTime();
  const isNw3Plus   = pgrdWeek >= nw3;

  const hasEsd           = !!line.esd;
  const esdIsThisWeek    = esdWeek ? esdWeek.getTime() === cw.getTime() : false;
  const esdLaterThanPgrd = line.esd && line.pgrd ? line.esd > line.pgrd : false;

  // PGRD before this week + no ASD → Backlog (critical or recent)
  if (isPastWeek) {
    const daysPast = differenceInDays(startOfDay(today), line.pgrd);
    return daysPast > 14 ? 'backlog-critical' : 'backlog-recent';
  }

  // PGRD this week
  if (isThisWeek) {
    if (hasEsd && esdIsThisWeek) return 'on-track'; // grace period — ESD confirms this week
    return 'future-backlog';                          // no ESD or ESD slipped past this week
  }

  // PGRD next week or week after + no ESD → Future Backlog
  if ((isNw1 || isNw2) && !hasEsd) return 'future-backlog';

  // PGRD >= cw+3 + no ESD → On Track
  if (isNw3Plus && !hasEsd) return 'on-track';

  // PGRD in future + ESD even later than PGRD → Future Backlog
  if (!isPastWeek && !isThisWeek && esdLaterThanPgrd) return 'future-backlog';

  return 'on-track';
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
