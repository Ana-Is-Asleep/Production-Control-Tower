'use client';

import { useMemo } from 'react';
import { getISOWeek, getISOWeekYear } from '../lib/dateUtils';
import {
  computeSOTLine, computeOTIFLine, computeLineResult,
  aggregateByPOHeader, SOT_TARGET, OTIF_TARGET,
  type IsChinaSupplier,
} from '../lib/kpiFormulas';
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
// the global weekRange filter rather than a fixed 10-week window.
export function useKPIs(lines: PurchaseLine[], weeksInRange: WeekInRange[], isChinaSupplier: IsChinaSupplier) {
  const today = useMemo(() => new Date(), []);

  const topGraph = useMemo((): TopGraphPoint[] => {
    return weeksInRange.map(({ offset, week, year, isCurrent, isFuture, label }) => {
      const weekLines = lines.filter(l => l.pgrd && getISOWeek(l.pgrd) === week && getISOWeekYear(l.pgrd) === year);
      const totalPOs = new Set(weekLines.map(l => l.po)).size;

      // shipped subset: PO has at least one line whose relevant date falls in this same PGRD week
      // (future weeks use edd — the real Shiptify booking date; l.esd is just an EGRD alias)
      const shippedPOSet = new Set<string>();
      weekLines.forEach(l => {
        const relevant = isFuture ? l.edd : l.asd;
        if (relevant && getISOWeek(relevant) === week && getISOWeekYear(relevant) === year) {
          shippedPOSet.add(l.po);
        }
      });
      const shippedPOs = shippedPOSet.size;

      const sotPct = aggregateByPOHeader(weekLines, (l) => computeSOTLine(l, isChinaSupplier(l.vendorCode), today));
      const otifPct = aggregateByPOHeader(weekLines, (l) => computeOTIFLine(l, isChinaSupplier(l.vendorCode)).otif);

      return {
        offset, week, year, isCurrent, isFuture,
        weekLabel: label,
        totalPOs,
        shippedPOs,
        backlogPOs: totalPOs - shippedPOs,
        // isCurrent week appears on both series so the solid/dashed line segments connect visually
        sotPastPct: !isFuture || isCurrent ? sotPct : null,
        sotFuturePct: isFuture || isCurrent ? sotPct : null,
        otifPastPct: !isFuture || isCurrent ? otifPct : null,
        otifFuturePct: isFuture || isCurrent ? otifPct : null,
      };
    });
  }, [lines, weeksInRange, isChinaSupplier, today]);

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
        esd: poLines.find(l => l.edd)?.edd ?? null,
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
