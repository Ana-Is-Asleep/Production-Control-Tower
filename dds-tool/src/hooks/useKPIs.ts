'use client';

import { useMemo } from 'react';
import { getISOWeek, getISOWeekYear, isoWeekKey, isoWeekLabel, lastCompletedWeek, weekRangeFor } from '../lib/dateUtils';
import { computeKPI, computeExpectedSOT, classifyBacklog, SOT_TARGET, OTIF_TARGET } from '../lib/kpiFormulas';
import type { PurchaseLine, WeeklyKPIPoint, BacklogSummary } from '../types';

export function useKPIs(weeklyLines: PurchaseLine[], accumulatingLines: PurchaseLine[]) {
  const today = useMemo(() => new Date(), []);
  const { week: lastWeek, year: lastYear } = lastCompletedWeek();

  const kpiResults = useMemo(
    () => weeklyLines.map((l) => ({ line: l, kpi: computeKPI(l) })),
    [weeklyLines]
  );

  // only count lines where SOT/OTIF is actually evaluable (has the required dates)
  const sotLines = useMemo(() => kpiResults.filter((r) => r.kpi.sotResult !== null), [kpiResults]);
  const otifLines = useMemo(() => kpiResults.filter((r) => r.kpi.otif !== null), [kpiResults]);

  const sotPct = useMemo(() => {
    if (sotLines.length === 0) return null;
    const pass = sotLines.filter((r) => r.kpi.sotResult === true).length;
    return Math.round((pass / sotLines.length) * 100);
  }, [sotLines]);

  const otifPct = useMemo(() => {
    if (otifLines.length === 0) return null;
    const pass = otifLines.filter((r) => r.kpi.otif === true).length;
    return Math.round((pass / otifLines.length) * 100);
  }, [otifLines]);

  // these are the lines that need an annotation before the meeting can start
  const failingLines = useMemo(
    () => kpiResults.filter((r) => r.kpi.sotFail || r.kpi.otifFail).map((r) => r.line),
    [kpiResults]
  );

  // 10-week window: 6 past + 1 current + 3 future
  // future weeks show line counts (PGRDs planned) but no KPI % — can't score what hasn't shipped
  // pretty please don't touch the offset math :) it handles year boundaries and 52-week rollover
  const weeklyTrend = useMemo((): WeeklyKPIPoint[] => {
    const points: WeeklyKPIPoint[] = [];
    for (let offset = -6; offset <= 3; offset++) {
      const targetWeek = lastWeek + offset;
      const adjustedWeek = ((targetWeek - 1 + 52) % 52) + 1;
      const adjustedYear = targetWeek <= 0 ? lastYear - 1 : targetWeek > 52 ? lastYear + 1 : lastYear;
      const key = `${adjustedYear}-W${String(adjustedWeek).padStart(2, '0')}`;
      const label = `W${String(adjustedWeek).padStart(2, '0')}`;
      const isCurrent = offset === 0;
      const isFuture = offset > 0;

      const wLines = accumulatingLines.filter((l) => {
        if (!l.pgrd) return false;
        return getISOWeek(l.pgrd) === adjustedWeek && getISOWeekYear(l.pgrd) === adjustedYear;
      });

      const wKpis = wLines.map((l) => computeKPI(l));
      const wSot = wKpis.filter((k) => k.sotResult !== null);
      const wOtif = wKpis.filter((k) => k.otif !== null);
      const wSotPct = wSot.length > 0 ? Math.round((wSot.filter((k) => k.sotResult).length / wSot.length) * 100) : null;
      const wOtifPct = wOtif.length > 0 ? Math.round((wOtif.filter((k) => k.otif).length / wOtif.length) * 100) : null;
      const sotFails = wKpis.filter((k) => k.sotFail).length;
      const totalPOs = new Set(wLines.map((l) => l.po)).size;
      // for future weeks: estimate SOT using ESD vs PGRD
      const expSotLines = isFuture ? wLines.filter((l) => computeExpectedSOT(l) !== null) : [];
      const expSotPct = isFuture && expSotLines.length > 0
        ? Math.round(expSotLines.filter((l) => computeExpectedSOT(l) === true).length / expSotLines.length * 100)
        : null;

      points.push({
        isoWeek: key,
        weekLabel: label,
        sotPct: isFuture ? expSotPct : wSotPct,
        otifPct: isFuture ? null : wOtifPct,
        sotOutOfTarget: sotFails,
        totalLines: wLines.length,
        totalPOs,
        isCurrent,
        isFuture,
      });
    }
    return points;
  }, [accumulatingLines, lastWeek, lastYear]);

  const backlogSummary = useMemo((): BacklogSummary => {
    const critical: PurchaseLine[] = [];
    const recent: PurchaseLine[] = [];
    const atRisk: PurchaseLine[] = [];
    for (const line of accumulatingLines) {
      const type = classifyBacklog(line, today);
      if (type === 'critical') critical.push(line);
      else if (type === 'recent') recent.push(line);
      else if (type === 'at-risk') atRisk.push(line);
    }
    return { critical, recent, atRisk };
  }, [accumulatingLines, today]);

  const notBookedLines = useMemo(
    () => weeklyLines.filter((l) => !l.esd),
    [weeklyLines]
  );

  return {
    sotPct,
    otifPct,
    sotTarget: SOT_TARGET,
    otifTarget: OTIF_TARGET,
    failingLines,
    kpiResults,
    weeklyTrend,
    backlogSummary,
    notBookedLines,
  };
}
