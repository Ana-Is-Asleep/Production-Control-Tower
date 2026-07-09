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

  // Uses PO-header weighting for PGRD ≥ WK27 2026, line-count for earlier periods
  const sotPct = useMemo(() => aggregateSOTRate(weeklyLines), [weeklyLines]);

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

      // SOT uses PO-header weighting for WK27+ PGRD, line-count for earlier weeks
      const sotPct_  = isFuture ? null : aggregateSOTRate(wLines);
      const otif = kpis.filter(k => k.otif !== null);
      const otifPct_ = otif.length ? Math.round(otif.filter(k => k.otif).length / otif.length * 100) : null;

      // for future weeks, estimate SOT from Shiptify ESD vs PGRD
      const expLines = isFuture ? wLines.filter(l => computeExpectedSOT(l) !== null) : [];
      const expSot   = expLines.length ? Math.round(expLines.filter(l => computeExpectedSOT(l)).length / expLines.length * 100) : null;

      // stacked bar values — using distinct POs
      // a PO counts as unshipped "as of week W" if it has no ASD or its ASD came after week W
      const wasUnshippedAsOf = (l: PurchaseLine) => !l.asd || (getISOWeek(l.asd) > week || getISOWeekYear(l.asd) > year);
      const allSrc = allD2cLines ?? accumulatingLines;

      // POs with PGRD = this week
      const thisWeekPOs = new Set(wLines.map(l => l.po));
      const posSOT     = new Set(wLines.filter(l => l.asd && !wasUnshippedAsOf(l) && computeKPI(l).sotResult).map(l => l.po)).size;
      // for future weeks: if ESD is in the same week as PGRD, the PO is on track — don't count as backlog
      const posBacklog = new Set(wLines.filter(l => {
        if (!wasUnshippedAsOf(l)) return false;
        if (isFuture && computeExpectedSOT(l) === true) return false;
        return true;
      }).map(l => l.po)).size;

      // POs from earlier weeks (2026+) still unshipped as of this week
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
        isoWeek:        `${year}-W${String(week).padStart(2, '0')}`,
        weekLabel:      `W${String(week).padStart(2, '0')}`,
        sotPct:         isFuture ? expSot    : sotPct_,
        otifPct:        isFuture ? null      : otifPct_,
        sotOutOfTarget: kpis.filter(k => k.sotFail).length,
        totalLines:     wLines.length,
        totalPOs:       new Set(wLines.map(l => l.po)).size,
        posSOT,
        posBacklog,
        pastPOBacklog,
        isCurrent:      offset === 0,
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
