'use client';

import { useMemo } from 'react';
import { getISOWeek, getISOWeekYear, shiftISOWeek } from '../lib/dateUtils';
import {
  computeSOTLine, computeOTIFLine, computeLineResult,
  aggregateByPOHeader, SOT_TARGET, OTIF_TARGET,
  type IsChinaSupplier,
} from '../lib/kpiFormulas';
import { rollupByPO } from '../lib/poAggregation';
import type { WeekInRange } from './useFilters';
import type { PurchaseLine } from '../types';

export interface TopGraphPoint {
  offset: number;
  weekLabel: string;
  week: number;
  year: number;
  isCurrent: boolean;
  isFuture: boolean;
  totalPOs: number;
  shippedPOs: number;
  backlogPOs: number;
  pastAccumulatedBacklog: number;
  sotPastPct: number | null;
  sotFuturePct: number | null;
  otifPastPct: number | null;
  otifFuturePct: number | null;
}

export interface DeepDiveRow {
  po: string;
  supplier: string;
  isChina: boolean;
  pgrd: Date | null;
  asd: Date | null;
  esd: Date | null;
  egrd: Date | null;
  sot: boolean | null;
  otif: boolean | null;
}

// The Top Graph: PGRD-week bars (PO volume, shipped vs backlog) + SOT/OTIF % lines, driven by
// the global weekRange filter rather than a fixed 10-week window. `fullPoolLines` is the same
// supplier/category/channel scope as `lines` but NOT limited to the displayed week range — needed
// so a past week's "accumulated backlog carried forward" can reach back to POs requested before
// the visible window even starts, rather than under-counting at the window's edge.
export function useKPIs(lines: PurchaseLine[], fullPoolLines: PurchaseLine[], weeksInRange: WeekInRange[], isChinaSupplier: IsChinaSupplier) {
  const today = useMemo(() => new Date(), []);

  // One row per PO (PGRD/ASD resolved across its lines) across the full, non-week-limited pool —
  // already floored at 2026 PGRD upstream by useFilters, so "start counting from 2026" falls out
  // for free rather than needing its own cutoff here.
  const poRollups = useMemo(() => rollupByPO(fullPoolLines, isChinaSupplier, today), [fullPoolLines, isChinaSupplier, today]);

  const topGraph = useMemo((): TopGraphPoint[] => {
    return weeksInRange.map(({ offset, week, year, isCurrent, isFuture, label, weekStart }) => {
      const weekLines = lines.filter(l => l.pgrd && getISOWeek(l.pgrd) === week && getISOWeekYear(l.pgrd) === year);
      const totalPOs = new Set(weekLines.map(l => l.po)).size;

      // shipped subset: PO has at least one line whose relevant date falls in this same PGRD week
      const shippedPOSet = new Set<string>();
      weekLines.forEach(l => {
        const relevant = isFuture ? l.esd : l.asd;
        if (relevant && getISOWeek(relevant) === week && getISOWeekYear(relevant) === year) {
          shippedPOSet.add(l.po);
        }
      });
      const shippedPOs = shippedPOSet.size;

      // Backlog carried forward from EVERY earlier PGRD week (not just this one) that's still
      // unshipped as of this week's end — only meaningful for completed weeks; a current/future
      // week hasn't "completed" yet, so there's nothing to have accumulated into by its end.
      let pastAccumulatedBacklog = 0;
      if (!isFuture && !isCurrent) {
        const weekEnd = shiftISOWeek(week, year, 1).weekStart; // exclusive — start of the following week
        pastAccumulatedBacklog = poRollups.filter((r) =>
          r.pgrd && r.pgrd < weekStart && (!r.asd || r.asd >= weekEnd)
        ).length;
      }

      const sotPct = aggregateByPOHeader(weekLines, (l) => computeSOTLine(l, isChinaSupplier(l.vendorCode), today));
      const otifPct = aggregateByPOHeader(weekLines, (l) => computeOTIFLine(l, isChinaSupplier(l.vendorCode)).otif);

      return {
        offset, week, year, isCurrent, isFuture,
        weekLabel: label,
        totalPOs,
        shippedPOs,
        backlogPOs: totalPOs - shippedPOs,
        pastAccumulatedBacklog,
        // isCurrent week appears on both series so the solid/dashed line segments connect visually
        sotPastPct: !isFuture || isCurrent ? sotPct : null,
        sotFuturePct: isFuture || isCurrent ? sotPct : null,
        otifPastPct: !isFuture || isCurrent ? otifPct : null,
        otifFuturePct: isFuture || isCurrent ? otifPct : null,
      };
    });
  }, [lines, poRollups, weeksInRange, isChinaSupplier, today]);

  // per-PO deep-dive rows for the whole active week range (Top Graph slide-over)
  const deepDiveRows = useMemo((): DeepDiveRow[] => {
    const byPO = new Map<string, PurchaseLine[]>();
    lines.forEach(l => {
      if (!byPO.has(l.po)) byPO.set(l.po, []);
      byPO.get(l.po)!.push(l);
    });

    return [...byPO.entries()].map(([po, poLines]) => {
      const results = poLines.map(l => computeLineResult(l, isChinaSupplier, today));
      const sotVals = results.map(r => r.sot).filter((v): v is boolean => v !== null);
      const otifVals = results.map(r => r.otif).filter((v): v is boolean => v !== null);
      const first = poLines[0];
      return {
        po,
        supplier: first.supplier,
        isChina: isChinaSupplier(first.vendorCode),
        pgrd: first.pgrd,
        asd: poLines.find(l => l.asd)?.asd ?? null,
        esd: poLines.find(l => l.esd)?.esd ?? null,
        egrd: poLines.find(l => l.egrd)?.egrd ?? null,
        // PO-level result = its lines' Yes/No average rounded to a pass/fail (matches the PO-level % definition)
        sot: sotVals.length ? sotVals.filter(Boolean).length / sotVals.length >= 0.5 : null,
        otif: otifVals.length ? otifVals.filter(Boolean).length / otifVals.length >= 0.5 : null,
      };
    }).sort((a, b) => (a.pgrd?.getTime() ?? 0) - (b.pgrd?.getTime() ?? 0));
  }, [lines, isChinaSupplier, today]);

  const overallSOT = useMemo(
    () => aggregateByPOHeader(lines, (l) => computeSOTLine(l, isChinaSupplier(l.vendorCode), today)),
    [lines, isChinaSupplier, today]
  );
  const overallOTIF = useMemo(
    () => aggregateByPOHeader(lines, (l) => computeOTIFLine(l, isChinaSupplier(l.vendorCode)).otif),
    [lines, isChinaSupplier]
  );

  return { topGraph, deepDiveRows, overallSOT, overallOTIF, sotTarget: SOT_TARGET, otifTarget: OTIF_TARGET };
}
