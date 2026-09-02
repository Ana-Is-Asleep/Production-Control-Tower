import { DEFAULT_REPORT_CONFIG, type CustomReportConfig } from './reportBuilders';

// Saved Reports store CONFIGURATION only (level/group/metrics/filters) — never a data snapshot
// and never a custom formula. Reopening a saved report reruns it against whatever data is
// currently loaded, per spec. This app has no backend, so localStorage is the persistence layer —
// consistent with the rest of this client-only app (the uploaded data itself is in-memory only
// and doesn't survive a reload either; a saved report's CONFIG surviving a reload is strictly more
// than what exists today, not less).
export interface SavedReport {
  id: string;
  name: string;
  config: CustomReportConfig;
  filterLabel: string; // display-only snapshot of the filter context at save time
  createdAt: string;
}

const STORAGE_KEY = 'pct_saved_reports_v1';

// Backfills configs saved before the Scope/Time-basis/Structure wizard fields existed, so reports
// saved with the older {level, groupBy, metrics} shape still reopen instead of crashing on the
// now-required config.scope.* lookups.
function withConfigDefaults(config: Partial<CustomReportConfig>): CustomReportConfig {
  return {
    ...DEFAULT_REPORT_CONFIG,
    ...config,
    scope: { ...DEFAULT_REPORT_CONFIG.scope, ...config.scope },
  };
}

export function loadSavedReports(): SavedReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const reports: SavedReport[] = raw ? JSON.parse(raw) : [];
    return reports.map((r) => ({ ...r, config: withConfigDefaults(r.config) }));
  } catch {
    return [];
  }
}

function persist(reports: SavedReport[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function saveSavedReport(name: string, config: CustomReportConfig, filterLabel: string): SavedReport {
  const report: SavedReport = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, config, filterLabel, createdAt: new Date().toISOString() };
  persist([...loadSavedReports(), report]);
  return report;
}

export function deleteSavedReport(id: string): void {
  persist(loadSavedReports().filter((r) => r.id !== id));
}

export function duplicateSavedReport(id: string): SavedReport | null {
  const all = loadSavedReports();
  const source = all.find((r) => r.id === id);
  if (!source) return null;
  const copy: SavedReport = { ...source, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: `${source.name} (copy)`, createdAt: new Date().toISOString() };
  persist([...all, copy]);
  return copy;
}
