'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Download, BookOpen, RotateCcw, Search } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFilters, WEEK_RANGE_MIN, WEEK_RANGE_MAX, WEEK_RANGE_DEFAULT } from '../../hooks/useFilters';
import { useVendorMapping } from '../../hooks/useVendorMapping';
import { currentISOWeek, shiftISOWeek, getISOWeek, getISOWeekYear, formatDateShort } from '../../lib/dateUtils';
import { getChannel } from '../../lib/channelUtils';
import { categorizeSKU } from '../../lib/skuUtils';
import {
  PO_COLUMNS, LINE_COLUMNS, DATE_FIELDS, buildPORows, buildLineRows, rawStatusText, statusTint,
  type PORow, type LineRow, type ColumnDef, type DateFieldId,
} from '../../lib/rawDataColumns';
import { detailSheet } from '../../lib/reportBuilders';
import { downloadWorkbook } from '../../lib/xlsxWriter';
import { Sidebar } from '../shell/Sidebar';
import { VendorDropdown } from '../shared/VendorDropdown';
import { ChannelDropdown } from '../shared/ChannelDropdown';
import { CategoryDropdown } from '../shared/CategoryDropdown';
import { MultiCheckDropdown } from '../leadTime/MultiCheckDropdown';
import { WeekRangeStepper } from '../shared/WeekRangeStepper';
import { Badge } from '../shared/Badge';
import { ColumnsPanel } from './ColumnsPanel';
import type { Channel } from '../../lib/channelUtils';
import type { SKUCategory } from '../../lib/skuUtils';

type Level = 'po' | 'line';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];

interface Scope {
  suppliers: string[];
  channels: string[];
  categories: string[];
  warehouses: string[];
  skuSearch: string;
  statuses: string[];
}
const DEFAULT_SCOPE: Scope = { suppliers: [], channels: [], categories: [], warehouses: [], skuSearch: '', statuses: [] };

function sortValue(v: unknown): string | number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return String(v ?? '');
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (v instanceof Date) return formatDateShort(v);
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
}

// Raw Data — a data workspace, not a dashboard: no charts, no KPI cards, no insight panels. Every
// column reuses either a raw BC field or an existing approved calculation (rawDataColumns.ts is
// the single registry both this page and its Excel export read from).
export function RawDataPage() {
  const { allLines } = useData();
  const { isChinaSupplier } = useVendorMapping();
  const { filteredLines: basePool } = useFilters(allLines); // cleaned pool, no supplier/channel/category restriction

  const today = useMemo(() => new Date(), []);
  const { week: curWeek, year: curYear } = useMemo(() => currentISOWeek(), []);

  const [level, setLevel] = useState<Level>('po');
  const [scope, setScope] = useState<Scope>(DEFAULT_SCOPE);
  const [dateField, setDateField] = useState<DateFieldId>('egrd');
  const [weekRange, setWeekRange] = useState(WEEK_RANGE_DEFAULT);
  const [poSearch, setPoSearch] = useState('');
  const [sort, setSort] = useState<{ id: string; dir: SortDir } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [poVisible, setPoVisible] = useState(new Set(PO_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id)));
  const [lineVisible, setLineVisible] = useState(new Set(LINE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id)));

  const availableWarehouses = useMemo(() => [...new Set(basePool.map((l) => l.destination))].sort(), [basePool]);
  const availableStatuses = useMemo(() => [...new Set(basePool.map(rawStatusText))].sort(), [basePool]);

  const dateFieldDef = DATE_FIELDS.find((f) => f.id === dateField)!;

  const weekKeySet = useMemo(() => {
    const keys = new Set<string>();
    for (let offset = weekRange.start; offset <= weekRange.end; offset++) {
      const { week, year } = shiftISOWeek(curWeek, curYear, offset);
      keys.add(`${year}-${week}`);
    }
    return keys;
  }, [weekRange, curWeek, curYear]);

  const scoped = useMemo(() => {
    let result = basePool;
    if (scope.suppliers.length) result = result.filter((l) => scope.suppliers.includes(l.supplier));
    if (scope.channels.length) result = result.filter((l) => scope.channels.includes(getChannel(l.destination)));
    if (scope.categories.length) result = result.filter((l) => scope.categories.includes(categorizeSKU(l.sku)));
    if (scope.warehouses.length) result = result.filter((l) => scope.warehouses.includes(l.destination));
    if (scope.statuses.length) result = result.filter((l) => scope.statuses.includes(rawStatusText(l)));
    if (scope.skuSearch.trim()) {
      const q = scope.skuSearch.trim().toLowerCase();
      result = result.filter((l) => l.sku.toLowerCase().includes(q));
    }
    result = result.filter((l) => {
      const d = dateFieldDef.getValue(l);
      return d && weekKeySet.has(`${getISOWeekYear(d)}-${getISOWeek(d)}`);
    });
    return result;
  }, [basePool, scope, dateFieldDef, weekKeySet]);

  const poRows = useMemo(() => buildPORows(scoped, isChinaSupplier, today), [scoped, isChinaSupplier, today]);
  const lineRows = useMemo(() => buildLineRows(scoped), [scoped]);

  const poRowsFiltered = useMemo(
    () => (poSearch.trim() ? poRows.filter((r) => r.rollup.po.toLowerCase().includes(poSearch.trim().toLowerCase())) : poRows),
    [poRows, poSearch]
  );
  const lineRowsFiltered = useMemo(
    () => (poSearch.trim() ? lineRows.filter((r) => r.line.po.toLowerCase().includes(poSearch.trim().toLowerCase())) : lineRows),
    [lineRows, poSearch]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PO/Line column defs are only ever rendered against their own matching row array below, this just lets one render path serve both
  const activeColumns: ColumnDef<any>[] = level === 'po'
    ? PO_COLUMNS.filter((c) => poVisible.has(c.id))
    : LINE_COLUMNS.filter((c) => lineVisible.has(c.id));
  const activeRows: (PORow | LineRow)[] = level === 'po' ? poRowsFiltered : lineRowsFiltered;

  const sortedRows = useMemo(() => {
    if (!sort) return activeRows;
    const col = activeColumns.find((c) => c.id === sort.id);
    if (!col) return activeRows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...activeRows].sort((a, b) => {
      const av = sortValue(col.getValue(a));
      const bv = sortValue(col.getValue(b));
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [activeRows, sort, activeColumns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = sortedRows.slice(page * pageSize, page * pageSize + pageSize);

  const scopeIsDefault = JSON.stringify(scope) === JSON.stringify(DEFAULT_SCOPE) && dateField === 'egrd'
    && weekRange.start === WEEK_RANGE_DEFAULT.start && weekRange.end === WEEK_RANGE_DEFAULT.end && !poSearch;

  const toggleSort = (id: string) => setSort((s) => (s?.id === id ? { id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: 'asc' }));
  const toggleExpand = (po: string) => setExpanded((s) => { const next = new Set(s); if (next.has(po)) next.delete(po); else next.add(po); return next; });

  const handleExport = () => {
    const columns = activeColumns.map((c) => c.label);
    const rows = sortedRows.map((r) => activeColumns.map((c) => {
      const v = c.getValue(r);
      return v instanceof Date || typeof v === 'number' || v === null || v === undefined ? v : String(v);
    }));
    downloadWorkbook(level === 'po' ? 'Raw Data - PO Level' : 'Raw Data - PO Line Level', [detailSheet('Raw Data', columns, rows)]);
  };

  const uniquePOs = useMemo(() => new Set(scoped.map((l) => l.po)).size, [scoped]);
  const dateRangeLabel = weekKeySet.size > 0
    ? `${dateFieldDef.id.toUpperCase()}: W${String(shiftISOWeek(curWeek, curYear, weekRange.start).week).padStart(2, '0')} ${shiftISOWeek(curWeek, curYear, weekRange.start).year} – W${String(shiftISOWeek(curWeek, curYear, weekRange.end).week).padStart(2, '0')} ${shiftISOWeek(curWeek, curYear, weekRange.end).year}`
    : '—';

  if (allLines.length === 0) {
    return (
      <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[#403833]">No data loaded</p>
          <p className="text-sm text-[#9c9794]">Go back to the overview and upload your data export.</p>
          <Link href="/" className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-soft transition-colors">
            ← Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#e9e3df] px-5 py-2.5 shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-[#403833] tracking-tight">Production Control Tower</h1>
            <div className="flex items-center gap-1.5 text-xs text-[#9c9794] mt-0.5">
              <span>Dashboard</span><span className="text-[#d6cfc9]">›</span><span className="text-[#403833] font-medium">Raw Data</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9c9794]">Last refreshed: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <Link href="/data-dictionary" className="flex items-center gap-1.5 text-xs font-semibold text-[#403833] border border-[#e9e3df] rounded-lg px-3 py-1.5 hover:border-[#403833] transition-colors">
              <BookOpen size={13} /> Data dictionary
            </Link>
            <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 hover:bg-brand-soft transition-colors">
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Simple data summary — context only, not KPI cards */}
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 flex items-center gap-8 flex-wrap">
            <div><p className="text-2xl font-extrabold text-[#403833] leading-none">{uniquePOs.toLocaleString()}</p><p className="text-[11px] text-[#9c9794] mt-1">POs</p></div>
            <div><p className="text-2xl font-extrabold text-[#403833] leading-none">{scoped.length.toLocaleString()}</p><p className="text-[11px] text-[#9c9794] mt-1">PO Lines</p></div>
            <div><p className="text-xs font-bold text-[#403833]">Date range</p><p className="text-[11px] text-[#9c9794] mt-1">{dateRangeLabel}</p></div>
            <div><p className="text-xs font-bold text-[#403833]">Suppliers</p><p className="text-[11px] text-[#9c9794] mt-1">{scope.suppliers.length === 0 ? 'All suppliers' : `${scope.suppliers.length} selected`}</p></div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-[#e9e3df] p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <VendorDropdown allSuppliers={[...new Set(basePool.map((l) => l.supplier))].sort()} selected={scope.suppliers} onChange={(s) => setScope((c) => ({ ...c, suppliers: s }))} />
              <ChannelDropdown selected={scope.channels as Channel[]} onChange={(s) => setScope((c) => ({ ...c, channels: s }))} />
              <CategoryDropdown selected={scope.categories as SKUCategory[]} onChange={(s) => setScope((c) => ({ ...c, categories: s }))} />
              <MultiCheckDropdown label="Warehouse" emptyLabel="All warehouses" options={availableWarehouses} selected={scope.warehouses} onChange={(s) => setScope((c) => ({ ...c, warehouses: s }))} />
              <MultiCheckDropdown label="Status" emptyLabel="All statuses" options={availableStatuses} selected={scope.statuses} onChange={(s) => setScope((c) => ({ ...c, statuses: s }))} />
            </div>
            <div className="flex items-center gap-2">
              <Search size={13} className="text-[#9c9794]" />
              <input value={scope.skuSearch} onChange={(e) => setScope((c) => ({ ...c, skuSearch: e.target.value }))} placeholder="Search SKU code or description…" className="flex-1 text-xs border border-[#e9e3df] rounded-lg px-2.5 py-1.5" />
            </div>
            <div className="flex items-end gap-3 flex-wrap border-t border-[#f4f1ef] pt-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Date field</label>
                <select value={dateField} onChange={(e) => setDateField(e.target.value as DateFieldId)} className="text-xs font-medium text-[#403833] border border-[#e9e3df] rounded-lg px-2.5 py-1.5 bg-white">
                  {DATE_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">Period</label>
                <WeekRangeStepper min={WEEK_RANGE_MIN} max={WEEK_RANGE_MAX} value={weekRange} onChange={setWeekRange} curWeek={curWeek} curYear={curYear} />
              </div>
              {!scopeIsDefault && (
                <button onClick={() => { setScope(DEFAULT_SCOPE); setDateField('egrd'); setWeekRange(WEEK_RANGE_DEFAULT); setPoSearch(''); }} className="flex items-center gap-1 text-xs text-[#9c9794] hover:text-fail transition-colors ml-auto">
                  <RotateCcw size={12} /> Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Data level tabs + table */}
          <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 flex-wrap gap-2">
              <div className="flex items-center gap-1 border-b border-[#e9e3df] -mb-px">
                {(['po', 'line'] as const).map((l) => (
                  <button key={l} onClick={() => { setLevel(l); setPage(0); setSort(null); }} className={`text-sm font-semibold px-4 py-2 border-b-2 transition-colors ${level === l ? 'border-brand text-brand' : 'border-transparent text-[#9c9794] hover:text-[#403833]'}`}>
                    {l === 'po' ? 'PO Level' : 'PO Line Level'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pb-2">
                <div className="flex items-center gap-1.5 border border-[#e9e3df] rounded-lg px-2.5 py-1.5">
                  <Search size={13} className="text-[#9c9794]" />
                  <input value={poSearch} onChange={(e) => { setPoSearch(e.target.value); setPage(0); }} placeholder="Search by PO number" className="text-xs outline-none w-40" />
                </div>
                <ColumnsPanel columns={level === 'po' ? PO_COLUMNS : LINE_COLUMNS} visible={level === 'po' ? poVisible : lineVisible} onChange={level === 'po' ? setPoVisible : setLineVisible} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#403833] text-white">
                    {level === 'po' && <th className="px-2 py-2 w-8"></th>}
                    {activeColumns.map((c) => (
                      <th key={c.id} onClick={() => toggleSort(c.id)} className={`px-3 py-2 font-semibold uppercase tracking-wide text-[10px] cursor-pointer select-none hover:bg-[#4d453f] ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                        {c.label} {sort?.id === c.id && (sort.dir === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr><td colSpan={activeColumns.length + (level === 'po' ? 1 : 0)} className="text-center py-8 text-[#9c9794]">No records match the current filters.</td></tr>
                  )}
                  {pageRows.map((row, i) => {
                    const isPO = level === 'po';
                    const poNum = isPO ? (row as PORow).rollup.po : null;
                    const isExpanded = poNum ? expanded.has(poNum) : false;
                    return (
                      <Fragment key={i}>
                        <tr className="border-b border-[#f4f1ef] hover:bg-[#f9f7f6]">
                          {isPO && (
                            <td className="px-2 py-1.5 cursor-pointer" onClick={() => poNum && toggleExpand(poNum)}>
                              {isExpanded ? <ChevronDown size={14} className="text-[#7b7571]" /> : <ChevronRight size={14} className="text-[#7b7571]" />}
                            </td>
                          )}
                          {activeColumns.map((c) => {
                            const v = c.getValue(row);
                            return (
                              <td key={c.id} className={`px-3 py-1.5 text-[#403833] ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                                {c.group === 'Status' ? <Badge variant={statusTint(String(v))}>{String(v)}</Badge> : renderCell(v)}
                              </td>
                            );
                          })}
                        </tr>
                        {isPO && isExpanded && (
                          <tr>
                            <td colSpan={activeColumns.length + 1} className="bg-[#f9f7f6] px-4 py-2">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-[#9c9794] uppercase text-[9px] tracking-wide">
                                    <th className="text-left px-2 py-1">Line</th><th className="text-left px-2 py-1">SKU</th><th className="text-left px-2 py-1">Category</th>
                                    <th className="text-right px-2 py-1">Qty Ordered</th><th className="text-right px-2 py-1">Qty Confirmed</th>
                                    <th className="text-left px-2 py-1">PGRD</th><th className="text-left px-2 py-1">EGRD</th><th className="text-left px-2 py-1">ESD</th><th className="text-left px-2 py-1">ASD</th><th className="text-left px-2 py-1">EDD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row as PORow).rollup.lines.map((l) => (
                                    <tr key={l.line} className="border-t border-[#e9e3df]">
                                      <td className="px-2 py-1">{l.line}</td><td className="px-2 py-1">{l.sku}</td><td className="px-2 py-1">{categorizeSKU(l.sku)}</td>
                                      <td className="px-2 py-1 text-right">{l.qty.toLocaleString()}</td><td className="px-2 py-1 text-right">{l.cqty.toLocaleString()}</td>
                                      <td className="px-2 py-1">{renderCell(l.pgrd)}</td><td className="px-2 py-1">{renderCell(l.egrd)}</td><td className="px-2 py-1">{renderCell(l.esd)}</td><td className="px-2 py-1">{renderCell(l.asd)}</td><td className="px-2 py-1">{renderCell(l.edd)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-[#f4f1ef] flex-wrap gap-2">
              <p className="text-[11px] text-[#9c9794]">Showing {pageRows.length === 0 ? 0 : page * pageSize + 1} to {Math.min(sortedRows.length, (page + 1) * pageSize)} of {sortedRows.length.toLocaleString()} {level === 'po' ? 'POs' : 'lines'}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#9c9794]">Rows per page:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="text-[11px] border border-[#e9e3df] rounded px-1.5 py-1">
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="text-[11px] font-semibold px-2 py-1 rounded border border-[#e9e3df] disabled:opacity-40">‹</button>
                  <span className="text-[11px] text-[#403833] px-2">{page + 1} / {pageCount}</span>
                  <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="text-[11px] font-semibold px-2 py-1 rounded border border-[#e9e3df] disabled:opacity-40">›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
