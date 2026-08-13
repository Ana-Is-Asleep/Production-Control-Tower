import { computeLineResult, aggregateSOTRate, type IsChinaSupplier } from './kpiFormulas';
import { COLOR } from './statusColors';
import type { PurchaseLine } from '../types';

// Thresholds used throughout the SOT/OTIF drill-down for color-coding: >=90 good, 70-89 warn,
// <70 bad, null (no POs that week) empty/grey.
export function sotTier(pct: number | null): 'good' | 'warn' | 'bad' | 'empty' {
  if (pct === null) return 'empty';
  if (pct >= 90) return 'good';
  if (pct >= 70) return 'warn';
  return 'bad';
}

export function sotTierColor(pct: number | null): { bg: string; text: string } {
  const tier = sotTier(pct);
  if (tier === 'good') return { bg: COLOR.passBg, text: COLOR.pass };
  if (tier === 'warn') return { bg: COLOR.warnBg, text: COLOR.warn };
  if (tier === 'bad') return { bg: COLOR.failBg, text: COLOR.fail };
  return { bg: '#f5f2ee', text: COLOR.muted };
}

// Same tiers, but also gives a solid "selected" variant (dark bg + white text) for tiles/badges
// that need an active state, not just a static light-tint reading.
export function sotTierPalette(pct: number | null): { lightBg: string; lightText: string; darkBg: string } {
  const tier = sotTier(pct);
  if (tier === 'good') return { lightBg: COLOR.passBg, lightText: COLOR.pass, darkBg: COLOR.pass };
  if (tier === 'warn') return { lightBg: COLOR.warnBg, lightText: COLOR.warn, darkBg: COLOR.warn };
  if (tier === 'bad') return { lightBg: COLOR.failBg, lightText: COLOR.fail, darkBg: COLOR.fail };
  return { lightBg: '#f5f2ee', lightText: COLOR.muted, darkBg: COLOR.muted };
}

export interface PORollup {
  po: string;
  supplier: string;
  pgrd: Date | null;
  egrd: Date | null;
  esd: Date | null;
  asd: Date | null;
  destination: string;
  lines: PurchaseLine[];
  sot: boolean | null;
  otif: boolean | null;
}

function majority(vals: boolean[]): boolean | null {
  if (!vals.length) return null;
  return vals.filter(Boolean).length / vals.length >= 0.5;
}

// Collapses lines to one row per PO — mirrors the same "first non-null wins for dates, majority
// vote for pass/fail" rule useKPIs.ts already uses for its deepDiveRows, so PO-level SOT/OTIF here
// stays consistent with the rest of the app rather than introducing a second definition.
export function rollupByPO(lines: PurchaseLine[], isChinaSupplier: IsChinaSupplier, today: Date): PORollup[] {
  const byPO = new Map<string, PurchaseLine[]>();
  for (const l of lines) {
    if (!byPO.has(l.po)) byPO.set(l.po, []);
    byPO.get(l.po)!.push(l);
  }

  const rows: PORollup[] = [];
  for (const [po, poLines] of byPO) {
    const results = poLines.map((l) => computeLineResult(l, isChinaSupplier, today));
    const sotVals = results.map((r) => r.sot).filter((v): v is boolean => v !== null);
    const otifVals = results.map((r) => r.otif).filter((v): v is boolean => v !== null);
    rows.push({
      po,
      supplier: poLines[0].supplier,
      pgrd: poLines[0].pgrd,
      egrd: poLines.find((l) => l.egrd)?.egrd ?? null,
      esd: poLines.find((l) => l.esd)?.esd ?? null,
      asd: poLines.find((l) => l.asd)?.asd ?? null,
      destination: poLines[0].destination,
      lines: poLines,
      sot: majority(sotVals),
      otif: majority(otifVals),
    });
  }
  return rows;
}

export type Trend = 'up' | 'down' | 'flat';

// Compares the average SOT rate of the last 2 weeks (in the given ordered week list) against the
// 2 weeks before that. A >2pp move either way counts as a real trend; anything smaller is "flat".
export function computeTrend(
  weeks: { week: number; year: number }[],
  lines: PurchaseLine[],
  isChinaSupplier: IsChinaSupplier,
  today: Date,
  getWeek: (l: PurchaseLine) => { week: number; year: number } | null
): Trend {
  if (weeks.length < 4) return 'flat';
  const last2 = weeks.slice(-2);
  const prev2 = weeks.slice(-4, -2);

  const rateFor = (ws: { week: number; year: number }[]) => {
    const keySet = new Set(ws.map((w) => `${w.year}-${w.week}`));
    const scoped = lines.filter((l) => {
      const wk = getWeek(l);
      return wk && keySet.has(`${wk.year}-${wk.week}`);
    });
    return aggregateSOTRate(scoped, isChinaSupplier, today);
  };

  const a = rateFor(last2);
  const b = rateFor(prev2);
  if (a === null || b === null) return 'flat';
  if (a > b + 2) return 'up';
  if (a < b - 2) return 'down';
  return 'flat';
}
