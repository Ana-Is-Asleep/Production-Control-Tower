import { differenceInDays, startOfWeek, addWeeks } from 'date-fns';
import { getISOWeek, getISOWeekYear } from './dateUtils';
import type { PurchaseLine, KPIResult, BacklogType } from '../types';

// Weeks run Monday–Sunday (ISO standard). Sunday is the last day of the week.
const MON = { weekStartsOn: 1 as const };
const weekOf = (d: Date) => startOfWeek(d, MON);

// SOT: shipped on time (ASD week ≤ PGRD week) AND in full (cqty = 100% of qty)
// From WK27 2026 onwards aggregation uses PO-header weighting — see aggregateSOTRate()
export function computeSOT(line: PurchaseLine): boolean | null {
  if (!line.asd || !line.pgrd) return null;
  const onTime = weekOf(line.asd) <= weekOf(line.pgrd);
  const inFull = line.cqty >= line.qty;
  return onTime && inFull;
}

// East Asia destinations require EGRD to be at least 1 week BEFORE PGRD (not same week).
// Standard destinations: EGRD ≤ PGRD week is enough.
function isEastAsia(destination: string): boolean {
  const d = (destination ?? '').toLowerCase();
  return d.includes('east asia') || d.includes('china') || d.includes(' cn') || d === 'cn'
    || d.includes('japan') || d.includes(' jp') || d === 'jp'
    || d.includes('korea') || d.includes(' kr') || d === 'kr'
    || d.includes('vietnam') || d.includes(' vn') || d === 'vn'
    || d.includes('thailand') || d.includes(' th') || d === 'th'
    || d.includes('apac') || d.includes('sea') || d.includes('asia');
}

// OTIF: supplier confirms delivery on or before PGRD week, same qty threshold.
// East Asia exception: EGRD must be strictly before PGRD (one week lead time required).
export function computeOTIF(line: PurchaseLine): { ot: boolean | null; inFull: boolean | null; otif: boolean | null } {
  if (!line.egrd || !line.pgrd) return { ot: null, inFull: null, otif: null };
  const egrdW = weekOf(line.egrd);
  const pgrdW = weekOf(line.pgrd);
  const ot = isEastAsia(line.destination) ? egrdW < pgrdW : egrdW <= pgrdW;
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

// From WK27 2026 (PGRD ≥ June 29, 2026) the SOT aggregation method changed:
// — Before WK27: SOT = Σ lines YES / Σ lines  (every PO line counted equally)
// — WK27 onwards: SOT = Σ(SOT% per PO) / Σ POs  (every PO counted equally regardless of line count)
// Per-line SOT YES/NO is unchanged — only the aggregation formula changed.
export const SOT_PO_HEADER_CUTOFF = new Date(2026, 5, 29); // June 29, 2026 = first day of WK27 2026

// today: used to classify lines with no ASD.
// — If PGRD week < current week → SOT failure (week closed, line never shipped).
// — If PGRD week ≥ current week → exclude (still open, not yet determined).
export function aggregateSOTRate(lines: PurchaseLine[], today?: Date): number | null {
  const currentWeekStart = today ? weekOf(today) : null;
  let numOld = 0, denOld = 0;
  const byPO = new Map<string, { yes: number; total: number }>();

  for (const l of lines) {
    if (!l.pgrd) continue; // no PGRD = can't categorize

    let result: boolean;
    if (!l.asd) {
      // No shipment yet: failure if the PGRD week is already closed, otherwise skip.
      if (currentWeekStart && weekOf(l.pgrd) < currentWeekStart) {
        result = false;
      } else {
        continue;
      }
    } else {
      const r = computeSOT(l);
      if (r === null) continue;
      result = r;
    }

    if (l.pgrd < SOT_PO_HEADER_CUTOFF) {
      // Pre-WK27: line-count weighted
      denOld++;
      if (result) numOld++;
    } else {
      // WK27+: PO-header weighted — every PO counts equally
      if (!byPO.has(l.po)) byPO.set(l.po, { yes: 0, total: 0 });
      const e = byPO.get(l.po)!;
      e.total++;
      if (result) e.yes++;
    }
  }

  const denNew = byPO.size;
  if (!denOld && !denNew) return null;

  // Each PO in the new period contributes its SOT rate (0–1) as one "vote"
  let rateNew = 0;
  byPO.forEach(e => { rateNew += e.yes / e.total; });

  return Math.round((numOld + rateNew) / (denOld + denNew) * 100);
}
