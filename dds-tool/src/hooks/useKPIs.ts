'use client';

import { useMemo } from 'react';
import { getISOWeek, getISOWeekYear, lastCompletedWeek } from '../lib/dateUtils';
import { computeKPI, computeExpectedSOT, classifyBacklog, aggregateSOTRate, SOT_TARGET, OTIF_TARGET } from '../lib/kpiFormulas';
import type { PurchaseLine, WeeklyKPIPoint, BacklogSummary } from '../types';

export function useKPIs(weeklyLines: PurchaseLine[], accumulatingLines: PurchaseLine[], allD2cLines?: PurchaseLine[]) {
  const today = useMemo(() => new Date(), []);
  const { week: lastWeek, year: lastYear } = lastCompletedWeek();

  const scored = useMemo(
    () => weeklyLines.map(l => ({ line: l, kpi: computeKPI(l) })),
    [weeklyLines]
  );

  // only lines that actually have the dates needed to evaluate each KPI
  const sotLines  = useMemo(() => scored.filter(r => r.kpi.sotResult !== null), [scored]);
  const otifLines = useMemo(() => scored.filter(r => r.kpi.otif !== null), [scored]);

  // Uses PO-header weighting for PGRD ≥ WK27 2026, line-count for earlier periods.
  // today passed so unshipped lines in closed PGRD weeks count as SOT failures.
  const sotPct = useMemo(() => aggregateSOTRate(weeklyLines, today), [weeklyLines, today]);

  const otifPct = useMemo(() => {
    if (!otifLines.length) return null;
    return Math.round(otifLines.filter(r => r.kpi.otif).length / otifLines.length * 100);
  }, [otifLines]);

  const failingLines = useMemo(
    () => scored.filter(r => r.kpi.sotFail || r.kpi.otifFail).map(r => r.line),
    [scored]
  );

  // 10-week window: 6 past + current + 3 future
  // future weeks get estimated SOT from ESD, OTIF can't be predicted so it stays null
  // the modulo handles rollover from W52 → W01 — don't simplify this or year boundaries break
  const weeklyTrend = useMemo((): WeeklyKPIPoint[] => {
    const points: WeeklyKPIPoint[] = [];

    for (let offset = -6; offset <= 3; offset++) {
      const raw = lastWeek + offset;
      const week = ((raw - 1 + 52) % 52) + 1;
      const year = raw <= 0 ? lastYear - 1 : raw > 52 ? lastYear + 1 : lastYear;
      const isFuture = offset > 0;

      const src = isFuture && allD2cLines ? allD2cLines : (allD2cLines ?? accumulatingLines);
      const wLines = src.filter(l => l.pgrd && getISOWeek(l.pgrd) === week && getISOWeekYear(l.pgrd) === year);
      const kpis = wLines.map(computeKPI);

      // SOT uses PO-header weighting for WK27+ PGRD, line-count for earlier weeks.
      // Pass today so that unshipped lines in closed PGRD weeks count as failures.
      const sotPct_  = isFuture ? null : aggregateSOTRate(wLines, today);
      // OTIF: actual for past weeks, predicted for future weeks using EGRD vs PGRD + cqty
      const otif = kpis.filter(k => k.otif !== null);
      const otifPct_ = otif.length ? Math.round(otif.filter(k => k.otif).length / otif.length * 100) : null;

      // for future weeks, estimate SOT from Shiptify ESD vs PGRD
      const expLines = isFuture ? wLines.filter(l => computeExpectedSOT(l) !== null) : [];
      const expSot   = expLines.length ? Math.round(expLines.filter(l => computeExpectedSOT(l)).length / expLines.length * 100) : null;

      // stacked bar values — using distinct POs
      // unshipped "as of week W" = no ASD, or ASD came in a later week
      const wasUnshippedAsOf = (l: PurchaseLine) => !l.asd || (getISOWeekYear(l.asd) > year || (getISOWeekYear(l.asd) === year && getISOWeek(l.asd) > week));
      const allSrc = allD2cLines ?? accumulatingLines;

      const thisWeekPOs = new Set(wLines.map(l => l.po));

      // Shipped this week (has ASD in week W) — includes SOT YES and NOK, but not backlog
      const posShipped = isFuture ? 0 : new Set(
        wLines.filter(l => l.asd && !wasUnshippedAsOf(l)).map(l => l.po)
      ).size;

      // PGRD = this week, not yet shipped by end of week W
      // For future weeks: exclude POs predicted on track (ESD ≤ PGRD)
      const posBacklog = new Set(wLines.filter(l => {
        if (!wasUnshippedAsOf(l)) return false;
        if (isFuture && computeExpectedSOT(l) === true) return false;
        return true;
      }).map(l => l.po)).size;

      // Future weeks only: POs predicted to ship on time (ESD ≤ PGRD)
      const posPredictedSOT = isFuture
        ? new Set(wLines.filter(l => computeExpectedSOT(l) === true).map(l => l.po)).size
        : 0;

      // POs from earlier PGRD weeks (2026+) still unshipped as of this week
      const pastPOBacklog = new Set(
        allSrc.filter(l =>
          l.pgrd &&
          l.pgrd.getFullYear() >= 2026 &&
          (getISOWeekYear(l.pgrd) < year || (getISOWeekYear(l.pgrd) === year && getISOWeek(l.pgrd) < week)) &&
          wasUnshippedAsOf(l) &&
          !thisWeekPOs.has(l.po)
        ).map(l => l.po)
      ).size;

      points.push({
        isoWeek:       `${year}-W${String(week).padStart(2, '0')}`,
        weekLabel:     `W${String(week).padStart(2, '0')}`,
        sotPct:        isFuture ? expSot  : sotPct_,
        otifPct:       otifPct_,  // predicted for future weeks (uses EGRD vs PGRD + cqty), actual for past
        totalLines:    wLines.length,
        totalPOs:      new Set(wLines.map(l => l.po)).size,
        posShipped,
        posBacklog,
        pastPOBacklog,
        posPredictedSOT,
        isCurrent:     offset === 0,
        isFuture,
      });
    }

    return points;
  }, [accumulatingLines, lastWeek, lastYear, allD2cLines]);

  const backlogSummary = useMemo((): BacklogSummary => {
    const critical: PurchaseLine[] = [];
    const recent: PurchaseLine[]   = [];
    const futureBacklog: PurchaseLine[] = [];

    // use allD2cLines when available so future-PGRD POs (next 1-3 weeks) also show in future backlog
    // accumulatingLines only goes up to lastWeek so it misses upcoming POs with no ESD booked
    const src = allD2cLines ?? accumulatingLines;
    for (const line of src) {
      const type = classifyBacklog(line, today);
      if      (type === 'backlog-critical') critical.push(line);
      else if (type === 'backlog-recent')   recent.push(line);
      else if (type === 'future-backlog')   futureBacklog.push(line);
    }

    return { critical, recent, futureBacklog };
  }, [accumulatingLines, allD2cLines, today]);

  // EDD (not ESD) is the Shiptify booking indicator — ESD is Expected Receipt Date which is always filled
  const notBookedLines = useMemo(
    () => accumulatingLines.filter(l => !l.asd && !l.edd),
    [accumulatingLines]
  );

  return { sotPct, otifPct, sotTarget: SOT_TARGET, otifTarget: OTIF_TARGET, failingLines, scored, weeklyTrend, backlogSummary, notBookedLines };
}
