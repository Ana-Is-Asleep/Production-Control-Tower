// Carries the dashboard's active supplier + week-range filter across to the full Actions page —
// same query-string convention as backlogParams.ts/leadTimeParams.ts etc, so "View all actions"
// opens already scoped to what you were looking at instead of resetting to "All suppliers".

export interface ActionsLinkParams {
  suppliers: string[];
  weekRange: { start: number; end: number };
}

export function buildActionsHref(suppliers: string[], weekRange: { start: number; end: number }): string {
  const params = new URLSearchParams();
  params.set('ws', String(weekRange.start));
  params.set('we', String(weekRange.end));
  if (suppliers.length) params.set('sup', suppliers.join(','));
  return `/actions?${params.toString()}`;
}

export function parseActionsParams(params: { get(key: string): string | null }): ActionsLinkParams | null {
  const ws = Number(params.get('ws'));
  const we = Number(params.get('we'));
  const sup = params.get('sup');
  if (!Number.isFinite(ws) || !Number.isFinite(we)) return null; // no query at all — page keeps its own defaults
  return {
    weekRange: { start: ws, end: we },
    suppliers: sup ? sup.split(',').filter(Boolean) : [],
  };
}
