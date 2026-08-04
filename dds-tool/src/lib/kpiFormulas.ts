import { startOfWeek, addWeeks } from 'date-fns';
import type { PurchaseLine } from '../types';

// Weeks run Monday–Sunday (ISO standard). PGRD is always a Sunday representing the week-ending date.
const MON = { weekStartsOn: 1 as const };
export const weekOf = (d: Date) => startOfWeek(d, MON);

export type IsChinaSupplier = (vendorCode: string) => boolean;

export interface LineResult {
  line: PurchaseLine;
  isChina: boolean;
  isFutureWeek: boolean;
  sot: boolean | null;
  ot: boolean | null;
  inFull: boolean | null;
  otif: boolean | null;
}

// SOT (Shipped On Time), per line:
// — on-time if the relevant ship date is on/before the threshold week.
// — past PGRD week: compare ASD. future PGRD week: compare ESD (no ESD yet ⇒ undetermined).
// — China suppliers: threshold is PGRD - 1 week instead of PGRD (for both ASD and ESD comparisons).
// A past-PGRD-week line with no ASD at all is a hard SOT failure (the week has closed, it never shipped).
export function computeSOTLine(line: PurchaseLine, isChina: boolean, today: Date): boolean | null {
  if (!line.pgrd) return null;
  const pgrdW = weekOf(line.pgrd);
  const thresholdW = isChina ? addWeeks(pgrdW, -1) : pgrdW;
  const isFutureWeek = pgrdW > weekOf(today);

  if (isFutureWeek) {
    if (!line.esd) return null; // not yet booked — undetermined, doesn't count either way
    return weekOf(line.esd) <= thresholdW;
  }
  if (!line.asd) return false; // week has closed with no shipment — SOT failure
  return weekOf(line.asd) <= thresholdW;
}

// OTIF (On Time In Full), per line:
// — on-time: EGRD ≤ PGRD (China: EGRD ≤ PGRD - 1 week). Always PGRD vs EGRD — no past/future switching.
// — in-full: Qty Confirmed ≥ Qty Requested (exact, no tolerance).
export function computeOTIFLine(line: PurchaseLine, isChina: boolean): { ot: boolean | null; inFull: boolean | null; otif: boolean | null } {
  if (!line.pgrd || !line.egrd) return { ot: null, inFull: null, otif: null };
  const pgrdW = weekOf(line.pgrd);
  const thresholdW = isChina ? addWeeks(pgrdW, -1) : pgrdW;
  const ot = weekOf(line.egrd) <= thresholdW;
  const inFull = line.cqty >= line.qty;
  return { ot, inFull, otif: ot && inFull };
}

export function computeLineResult(line: PurchaseLine, isChinaSupplier: IsChinaSupplier, today: Date): LineResult {
  const isChina = isChinaSupplier(line.vendorCode);
  const sot = computeSOTLine(line, isChina, today);
  const { ot, inFull, otif } = computeOTIFLine(line, isChina);
  const isFutureWeek = !!line.pgrd && weekOf(line.pgrd) > weekOf(today);
  return { line, isChina, isFutureWeek, sot, ot, inFull, otif };
}

// PO-level %: average of a PO's lines' Yes(100)/No(0), ignoring lines whose result is null (undetermined).
// Header-level %: equal-weighted average across POs — (SOT_PO1 + SOT_PO2 + ...) / count(POs).
// Every PO counts the same regardless of line count or quantity. Used for both SOT and OTIF.
export function aggregateByPOHeader(lines: PurchaseLine[], perLine: (line: PurchaseLine) => boolean | null): number | null {
  const byPO = new Map<string, boolean[]>();
  for (const line of lines) {
    const result = perLine(line);
    if (result === null) continue;
    if (!byPO.has(line.po)) byPO.set(line.po, []);
    byPO.get(line.po)!.push(result);
  }
  if (byPO.size === 0) return null;

  let sumOfPORates = 0;
  byPO.forEach((results) => {
    sumOfPORates += results.filter(Boolean).length / results.length;
  });
  return Math.round((sumOfPORates / byPO.size) * 100);
}

export function aggregateSOTRate(lines: PurchaseLine[], isChinaSupplier: IsChinaSupplier, today: Date): number | null {
  return aggregateByPOHeader(lines, (l) => computeSOTLine(l, isChinaSupplier(l.vendorCode), today));
}

export function aggregateOTIFRate(lines: PurchaseLine[], isChinaSupplier: IsChinaSupplier): number | null {
  return aggregateByPOHeader(lines, (l) => computeOTIFLine(l, isChinaSupplier(l.vendorCode)).otif);
}

export const SOT_TARGET = 90;
export const OTIF_TARGET = 90;

// Backlog definition (Section 4): PGRD in the past AND ASD still empty.
export function isBacklog(line: PurchaseLine, today: Date): boolean {
  if (!line.pgrd) return false;
  return weekOf(line.pgrd) < weekOf(today) && !line.asd;
}

// Expected backlog: PGRD in the future but ESD already booked for a date AFTER PGRD.
export function isExpectedBacklog(line: PurchaseLine, today: Date): boolean {
  if (!line.pgrd || !line.esd) return false;
  return weekOf(line.pgrd) > weekOf(today) && line.esd > line.pgrd;
}
