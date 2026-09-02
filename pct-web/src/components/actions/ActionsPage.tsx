'use client';

import { useMemo, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import { useActions } from '../../hooks/useActions';
import { useData } from '../../context/DataContext';
import { emailToDisplayName } from '../../lib/scmEmails';
import { daysOpen, reasonBucket } from '../../lib/actionsUtils';
import { currentISOWeek, shiftISOWeek, getISOWeek, getISOWeekYear, isoWeekLabel } from '../../lib/dateUtils';
import { WEEK_RANGE_MIN, WEEK_RANGE_MAX } from '../../hooks/useFilters';
import { WeekRangeStepper } from '../shared/WeekRangeStepper';
import { Sidebar } from '../shell/Sidebar';
import { Badge } from '../shared/Badge';
import { ActionDetailModal } from './ActionDetailModal';
import { detailSheet } from '../../lib/reportBuilders';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import type { ActionItem, ActionStatus, ActionType } from '../../types/actions';

type TabFilter = 'all' | ActionType;

interface Filters {
  status: ActionStatus | 'all';
  suppliers: string[];
  owners: string[];
  reasons: string[];
  poSearch: string;
}
const DEFAULT_FILTERS: Filters = { status: 'all', suppliers: [], owners: [], reasons: [], poSearch: '' };

const STATUS_BADGE: Record<ActionStatus, { variant: 'pass' | 'fail' | 'warn' | 'neutral'; label: string }> = {
  open: { variant: 'fail', label: 'Open' },
  in_progress: { variant: 'warn', label: 'In Progress' },
  blocked: { variant: 'neutral', label: 'Blocked' },
  closed: { variant: 'pass', label: 'Closed' },
};

// Full Actions management page — central view over ALL Flags and Open Points, open and closed,
// per the sidebar's permanent "Actions" nav item. The quick drawer/panel on the Dashboard stays
// separate and lightweight; this page is where the complete history lives.
export function ActionsPage() {
  const { actions, updateAction } = useActions();
  const { allLines } = useData();

  const { week: curWeek, year: curYear } = useMemo(() => currentISOWeek(), []);
  const [tab, setTab] = useState<TabFilter>('all');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [weekRange, setWeekRange] = useState({ start: WEEK_RANGE_MIN, end: WEEK_RANGE_MAX }); // default: no period restriction, unlike Raw Data/dashboard
  const [selected, setSelected] = useState<ActionItem | null>(null);

  const weekKeySet = useMemo(() => {
    const keys = new Set<string>();
    for (let offset = weekRange.start; offset <= weekRange.end; offset++) {
      const { week, year } = shiftISOWeek(curWeek, curYear, offset);
      keys.add(`${year}-${week}`);
    }
    return keys;
  }, [weekRange, curWeek, curYear]);

  const allSuppliers = useMemo(() => [...new Set(allLines.map((l) => l.supplier))].sort(), [allLines]);
  const availableOwners = useMemo(() => [...new Set(actions.map((a) => a.owner).filter(Boolean))].sort(), [actions]);
  const availableReasons = useMemo(() => [...new Set(actions.map(reasonBucket))].sort(), [actions]);

  const matchesCommonFilters = (a: ActionItem) => {
    if (filters.status !== 'all' && a.status !== filters.status) return false;
    if (filters.suppliers.length && (!a.supplierName || !filters.suppliers.includes(a.supplierName))) return false;
    if (filters.owners.length && !filters.owners.includes(a.owner)) return false;
    if (filters.reasons.length && !filters.reasons.includes(reasonBucket(a))) return false;
    if (filters.poSearch.trim() && !(a.poReference ?? '').toLowerCase().includes(filters.poSearch.trim().toLowerCase())) return false;
    const created = new Date(a.createdAt);
    if (isNaN(created.getTime()) || !weekKeySet.has(`${getISOWeekYear(created)}-${getISOWeek(created)}`)) return false;
    return true;
  };

  const withoutTab = useMemo(() => actions.filter(matchesCommonFilters), [actions, filters, weekKeySet]); // eslint-disable-line react-hooks/exhaustive-deps
  const flagCount = withoutTab.filter((a) => a.type === 'flag').length;
  const openPointCount = withoutTab.filter((a) => a.type === 'open_point').length;

  const filtered = useMemo(
    () => (tab === 'all' ? withoutTab : withoutTab.filter((a) => a.type === tab)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [withoutTab, tab]
  );

  const today = useMemo(() => new Date(), []);
  const openActions = filtered.filter((a) => a.status !== 'closed');
  const closedActions = filtered.filter((a) => a.status === 'closed');
  const closedDaysOpen = closedActions.map((a) => daysOpen(a, today)).filter((d): d is number => d !== null);
  const avgTimeOpenClosed = closedDaysOpen.length ? Math.round((closedDaysOpen.reduce((s, d) => s + d, 0) / closedDaysOpen.length) * 10) / 10 : null;

  const scopeIsDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS)
    && weekRange.start === WEEK_RANGE_MIN && weekRange.end === WEEK_RANGE_MAX && tab === 'all';

  const handleExport = () => {
    const columns = ['Type', 'Supplier', 'PO Number', 'Reason', 'Owner', 'Status', 'Created Date', 'Closed Date', 'Time Open (days)', 'Resolution Reason', 'Comments'];
    const rows = filtered.map((a) => [
      a.type === 'flag' ? 'Flag' : 'Open Point',
      a.supplierName ?? '—',
      a.poReference ?? '—',
      a.description,
      a.owner ? emailToDisplayName(a.owner) : '—',
      STATUS_BADGE[a.status].label,
      new Date(a.createdAt),
      a.closedAt ? new Date(a.closedAt) : null,
      daysOpen(a, today),
      a.resolutionReason ?? '—',
      a.comment || '—',
    ]);
    downloadWorkbook('Actions', [detailSheet('Actions', columns, rows)]);
  };

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#e9e3df] px-5 py-2.5 shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-[#403833] tracking-tight">Production Control Tower</h1>
            <div className="flex items-center gap-1.5 text-xs text-[#9c9794] mt-0.5">
              <span>Dashboard</span><span className="text-[#d6cfc9]">›</span><span className="text-[#403833] font-medium">Actions</span>
            </div>
          </div>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors">
            <Download size={13} /> Export
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* KPI summary — reacts to the current filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Actions', value: filtered.length },
              { label: 'Open Actions', value: openActions.length, sub: filtered.length ? `${Math.round((openActions.length / filtered.length) * 100)}% of total` : undefined },
              { label: 'Closed Actions', value: closedActions.length, sub: filtered.length ? `${Math.round((closedActions.length / filtered.length) * 100)}% of total` : undefined },
              { label: 'Flags', value: flagCount, sub: withoutTab.length ? `${Math.round((flagCount / withoutTab.length) * 100)}% of total` : undefined },
              { label: 'Open Points', value: openPointCount, sub: withoutTab.length ? `${Math.round((openPointCount / withoutTab.length) * 100)}% of total` : undefined },
              { label: 'Avg. Time Open (closed)', value: avgTimeOpenClosed !== null ? `${avgTimeOpenClosed}d` : '—' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-lg border border-[#e9e3df] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794]">{k.label}</p>
                <p className="text-xl font-extrabold text-[#403833] leading-tight mt-1">{k.value}</p>
                {k.sub && <p className="text-[10px] text-[#9c9794] mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9c9794] -mt-2">Avg. Time Open is averaged over closed actions in the current view (createdAt → closedAt) — open actions are still counting up and would skew a blended average.</p>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[#e9e3df]">
            {([['all', `All (${withoutTab.length})`], ['flag', `Flags (${flagCount})`], ['open_point', `Open Points (${openPointCount})`]] as [TabFilter, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`text-sm font-semibold px-4 py-2 border-b-2 transition-colors ${tab === key ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as ActionStatus | 'all' }))} className="text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="closed">Closed</option>
              </select>
              <select multiple={false} value={filters.suppliers[0] ?? ''} onChange={(e) => setFilters((f) => ({ ...f, suppliers: e.target.value ? [e.target.value] : [] }))} className="text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
                <option value="">All suppliers</option>
                {allSuppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.owners[0] ?? ''} onChange={(e) => setFilters((f) => ({ ...f, owners: e.target.value ? [e.target.value] : [] }))} className="text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
                <option value="">All owners</option>
                {availableOwners.map((o) => <option key={o} value={o}>{emailToDisplayName(o)}</option>)}
              </select>
              <select value={filters.reasons[0] ?? ''} onChange={(e) => setFilters((f) => ({ ...f, reasons: e.target.value ? [e.target.value] : [] }))} className="text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
                <option value="">All reasons</option>
                {availableReasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="flex items-center gap-1.5 border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
                <Search size={13} className="text-[#9c9794]" />
                <input value={filters.poSearch} onChange={(e) => setFilters((f) => ({ ...f, poSearch: e.target.value }))} placeholder="Search by PO number" className="text-xs outline-none w-full" />
              </div>
            </div>
            <div className="flex items-end gap-3 flex-wrap border-t border-[#f4f1ef] pt-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Created period</label>
                <WeekRangeStepper min={WEEK_RANGE_MIN} max={WEEK_RANGE_MAX} value={weekRange} onChange={setWeekRange} curWeek={curWeek} curYear={curYear} />
              </div>
              {!scopeIsDefault && (
                <button onClick={() => { setFilters(DEFAULT_FILTERS); setWeekRange({ start: WEEK_RANGE_MIN, end: WEEK_RANGE_MAX }); setTab('all'); }} className="flex items-center gap-1 text-xs text-[#9c9794] hover:text-fail transition-colors ml-auto">
                  <RotateCcw size={12} /> Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-[#403833] text-white">
                    {['Type', 'Supplier', 'PO Number', 'Reason', 'Owner / POC', 'Status', 'Created', 'Closed', 'Time Open', 'Resolution Reason', 'Comments'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-8 text-[#9c9794]">No actions match the current filters.</td></tr>
                  )}
                  {filtered.map((a) => {
                    const created = new Date(a.createdAt);
                    const closed = a.closedAt ? new Date(a.closedAt) : null;
                    const comment = a.comment.length > 50 ? `${a.comment.slice(0, 50)}…` : a.comment;
                    return (
                      <tr key={a.id} onClick={() => setSelected(a)} className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6] cursor-pointer">
                        <td className="px-3 py-1.5"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${a.type === 'flag' ? 'bg-[#fff7ed] text-brand' : 'bg-[#eef2ff] text-[#4338ca]'}`}>{a.type === 'flag' ? 'Flag' : 'Open Point'}</span></td>
                        <td className="px-3 py-1.5 text-[#403833]">{a.supplierName || '—'}</td>
                        <td className="px-3 py-1.5 text-[#403833]">{a.poReference || '—'}</td>
                        <td className="px-3 py-1.5 text-[#403833] max-w-[220px] truncate">{a.description}</td>
                        <td className="px-3 py-1.5 text-[#403833]">{a.owner ? emailToDisplayName(a.owner) : '—'}</td>
                        <td className="px-3 py-1.5"><Badge variant={STATUS_BADGE[a.status].variant}>{STATUS_BADGE[a.status].label}</Badge></td>
                        <td className="px-3 py-1.5 text-[#403833]">{isNaN(created.getTime()) ? '—' : `${isoWeekLabel(created)} ${getISOWeekYear(created)}`}</td>
                        <td className="px-3 py-1.5 text-[#403833]">{closed ? `${isoWeekLabel(closed)} ${getISOWeekYear(closed)}` : '—'}</td>
                        <td className="px-3 py-1.5 text-[#403833]">{daysOpen(a, today) ?? '—'} days</td>
                        <td className="px-3 py-1.5 text-[#403833] max-w-[160px] truncate">{a.resolutionReason || '—'}</td>
                        <td className="px-3 py-1.5 text-[#7b7571] max-w-[200px] truncate">{comment || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <ActionDetailModal
          action={selected}
          onClose={() => setSelected(null)}
          onSave={(patch) => updateAction(selected.id, patch)}
        />
      )}
    </div>
  );
}
