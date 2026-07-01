import { differenceInDays, startOfWeek, addWeeks } from 'date-fns';
import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { PurchaseLine, KPIResult, BacklogType } from '../types';

// europe uses sunday-aligned weeks, not monday ISO — changing this breaks backlog for EU
const SUN = { weekStartsOn: 0 as const };
const weekOf = (d: Date) => startOfWeek(d, SUN);

// SOT: shipped same week or earlier than planned — time only, no quantity check
// (IN FULL is an OTIF dimension, not SOT — verified against BC's own SOT? flag)
export function computeSOT(line: PurchaseLine): boolean | null {
  if (!line.asd || !line.pgrd) return null; // skip if no shipping date, happens with open POs
  return weekOf(line.asd) <= weekOf(line.pgrd);
}

// OTIF: supplier confirms delivery on or before PGRD week, same qty threshold
export function computeOTIF(line: PurchaseLine): { ot: boolean | null; inFull: boolean | null; otif: boolean | null } {
  if (!line.egrd || !line.pgrd) return { ot: null, inFull: null, otif: null };
  const ot = weekOf(line.egrd) <= weekOf(line.pgrd);
  const inFull = line.cqty >= line.qty * 0.97;
  return { ot, inFull, otif: ot && inFull };
}

export function computeKPI(line: PurchaseLine): KPIResult {
  const sot = computeSOT(line);
  const { ot, inFull, otif } = computeOTIF(line);
  return {
    sotResult: sot,
    sotFail: sot === false,
    otif,
    ot,
    inFull,
    otifFail: otif === false || ot === false,
  };
}

// classifies each unshipped PO into backlog, future risk, or on track
// based on the Europe DDS spec — sunday weeks, checking PGRD vs today
export function classifyBacklog(line: PurchaseLine, today: Date): BacklogType {
  if (line.asd) return 'shipped';
  if (!line.pgrd) return 'on-track'; // open POs without a date skip out

  const cw = weekOf(today);
  const pgrdWeek = weekOf(line.pgrd);
  const esdWeek = line.esd ? weekOf(line.esd) : null;

  // already past PGRD with no shipment = backlog, split by how long it's been sitting
  if (pgrdWeek < cw) {
    const days = differenceInDays(today, line.pgrd);
    return days > 14 ? 'backlog-critical' : 'backlog-recent';
  }

  // this week: ok if Shiptify confirms shipping this week, otherwise slipping
  if (pgrdWeek.getTime() === cw.getTime()) {
    if (esdWeek && esdWeek.getTime() === cw.getTime()) return 'on-track';
    return 'future-backlog';
  }

  const nw1 = addWeeks(cw, 1);
  const nw2 = addWeeks(cw, 2);
  const nw3 = addWeeks(cw, 3);

  if ((pgrdWeek.getTime() === nw1.getTime() || pgrdWeek.getTime() === nw2.getTime()) && !line.esd)
    return 'future-backlog'; // due in 1-2 weeks, nothing booked yet

  if (pgrdWeek >= nw3 && !line.esd)
    return 'on-track'; // 3+ weeks out, too early to worry

  if (!line.asd && line.esd && line.pgrd && line.esd > line.pgrd)
    return 'future-backlog'; // ESD already slipped past PGRD

  return 'on-track';
}

// uses ESD (Shiptify booking date) to predict if a not-yet-shipped line will be SOT
export function computeExpectedSOT(line: PurchaseLine): boolean | null {
  if (line.asd) return null; // already shipped, use actual SOT
  if (!line.esd || !line.pgrd) return null;
  return weekOf(line.esd) <= weekOf(line.pgrd);
}

export const SOT_TARGET = 90;
export const OTIF_TARGET = 90;
