'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useActions } from '../../hooks/useActions';
import { useData } from '../../context/DataContext';
import { Sidebar } from '../shell/Sidebar';
import { SCM_EMAILS, emailToDisplayName } from '../../lib/scmEmails';
import { reasonBucket } from '../../lib/actionsUtils';
import {
  buildPgrdWeekOptions, buildPOQueue, buildOpenPointQueue, progressBucket,
  type ActionWeek,
} from '../../lib/myActionsUtils';
import { formatDateShort } from '../../lib/dateUtils';
import type { ActionItem, ActionStatus } from '../../types/actions';
import { ResolvePOScreen } from './myActions/ResolvePOScreen';
import { ResolveOpenPointScreen } from './myActions/ResolveOpenPointScreen';

type Screen = 'select' | 'overview' | 'resolve-po' | 'po-complete' | 'resolve-op' | 'all-done';

const STATUS_LABELS: Record<ActionStatus, string> = { open: 'Open', in_progress: 'In Progress', blocked: 'Blocked', closed: 'Closed' };
const STATUS_DOT: Record<ActionStatus, string> = { open: 'bg-fail', in_progress: 'bg-warn', blocked: 'bg-[#9c9794]', closed: 'bg-pass' };

function weekKeyOf(w: ActionWeek) { return `${w.year}-${w.week}`; }

// Guided, one-task-at-a-time workflow for SCMs: pick who you are + which PGRD week you're working
// on, then walk through every PO action assigned to you (and afterwards, your outstanding Open
// Points) one screen at a time — a weekly task inbox, not another filterable dashboard. The
// existing /actions page (ActionsPage.tsx) remains the full searchable overview across everyone.
export function MyActionsPage() {
  const { actions, updateAction } = useActions();
  const { allLines } = useData();

  const [scm, setScm] = useState('');
  const [weekKey, setWeekKey] = useState('');
  const [screen, setScreen] = useState<Screen>('select');
  const [loadedWeek, setLoadedWeek] = useState<ActionWeek | null>(null);
  const [poQueueIds, setPoQueueIds] = useState<string[]>([]);
  const [currentPoId, setCurrentPoId] = useState<string | null>(null);
  const [opQueueIds, setOpQueueIds] = useState<string[]>([]);
  const [currentOpId, setCurrentOpId] = useState<string | null>(null);

  const weekOptions = useMemo(() => buildPgrdWeekOptions(actions, allLines, scm || null), [actions, allLines, scm]);
  const outstandingOpenPoints = useMemo(() => (scm ? buildOpenPointQueue(actions, scm) : []), [actions, scm]);

  // Always re-derived from the live actions array (never a frozen snapshot), so status/root-cause
  // edits made while stepping through the queue are reflected immediately everywhere they're shown.
  const poQueue = useMemo(() => poQueueIds.map((id) => actions.find((a) => a.id === id)).filter((a): a is ActionItem => !!a), [poQueueIds, actions]);
  const opQueue = useMemo(() => opQueueIds.map((id) => actions.find((a) => a.id === id)).filter((a): a is ActionItem => !!a), [opQueueIds, actions]);

  const completedPoCount = poQueue.filter((a) => progressBucket(a.status) === 'completed').length;
  const inProgressPoCount = poQueue.filter((a) => progressBucket(a.status) === 'in_progress').length;
  const todoPoCount = poQueue.filter((a) => progressBucket(a.status) === 'todo').length;
  const completedOpCount = opQueue.filter((a) => a.status === 'closed').length;

  const reset = () => {
    setScm(''); setWeekKey(''); setScreen('select'); setLoadedWeek(null);
    setPoQueueIds([]); setCurrentPoId(null); setOpQueueIds([]); setCurrentOpId(null);
  };

  const handleLoad = () => {
    const week = weekOptions.find((w) => weekKeyOf(w) === weekKey);
    if (!scm || !week) return;
    const queue = buildPOQueue(actions, allLines, scm, week);
    setLoadedWeek(week);
    setPoQueueIds(queue.map((a) => a.id));
    setScreen('overview');
  };

  const startPoQueue = (startId?: string) => {
    setCurrentPoId(startId ?? poQueue[0]?.id ?? null);
    setScreen('resolve-po');
  };

  const afterPoQueueDone = () => {
    const pending = buildOpenPointQueue(actions, scm);
    if (pending.length > 0) {
      setScreen('po-complete');
    } else {
      setScreen('all-done');
    }
  };

  const startOpQueue = () => {
    const pending = buildOpenPointQueue(actions, scm);
    setOpQueueIds(pending.map((a) => a.id));
    setCurrentOpId(pending[0]?.id ?? null);
    setScreen('resolve-op');
  };

  const scmName = scm ? emailToDisplayName(scm) : '';

  return (
    <div className="h-screen w-full bg-[#f5f2ee] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#e9e3df] px-5 py-2.5 shrink-0 flex items-center gap-3">
          {screen === 'select' || screen === 'overview' ? (
            <div>
              <h1 className="text-base font-bold text-[#403833] tracking-tight">Production Control Tower</h1>
              <div className="flex items-center gap-1.5 text-xs text-[#9c9794] mt-0.5">
                <span>Dashboard</span><span className="text-[#d6cfc9]">›</span><span className="text-[#403833] font-medium">My Actions</span>
              </div>
            </div>
          ) : (
            <button onClick={() => setScreen(loadedWeek ? 'overview' : 'select')} className="flex items-center gap-1.5 text-xs font-semibold text-[#7b7571] hover:text-[#403833] transition-colors">
              <ArrowLeft size={14} /> Back to list
            </button>
          )}
        </div>

        {screen === 'select' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-extrabold text-[#403833]">My Actions</h2>
              <p className="text-sm text-[#9c9794] mt-1">Work through your PO actions and open points, week by week.</p>

              <div className="bg-white rounded-lg border border-[#e9e3df] p-5 mt-5 flex items-end gap-3 flex-wrap">
                <div className="min-w-[220px]">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">SCM</label>
                  <select
                    value={scm}
                    onChange={(e) => { setScm(e.target.value); setWeekKey(''); }}
                    className="w-full text-sm border border-[#e9e3df] rounded-lg px-3 py-2"
                  >
                    <option value="">Select your name…</option>
                    {SCM_EMAILS.map((email) => <option key={email} value={email}>{emailToDisplayName(email)}</option>)}
                  </select>
                </div>
                <div className="min-w-[180px]">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9c9794] block mb-1">PGRD Week</label>
                  <select
                    value={weekKey}
                    onChange={(e) => setWeekKey(e.target.value)}
                    className="w-full text-sm border border-[#e9e3df] rounded-lg px-3 py-2"
                  >
                    <option value="">Select a week…</option>
                    {weekOptions.map((w) => <option key={weekKeyOf(w)} value={weekKeyOf(w)}>{w.label} ({w.count})</option>)}
                  </select>
                </div>
                <button
                  onClick={handleLoad}
                  disabled={!scm || !weekKey}
                  className="text-sm font-semibold text-white bg-brand rounded-lg px-5 py-2 hover:bg-brand-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Load my actions →
                </button>
              </div>

              {scm && weekOptions.length === 0 && (
                <div className="bg-white rounded-lg border border-[#e9e3df] p-5 mt-4">
                  {outstandingOpenPoints.length > 0 ? (
                    <>
                      <p className="text-sm font-semibold text-[#403833]">No PO actions require your input right now.</p>
                      <p className="text-xs text-[#9c9794] mt-1">
                        You do have {outstandingOpenPoints.length} Open Point{outstandingOpenPoints.length === 1 ? '' : 's'} assigned to you.
                      </p>
                      <button onClick={startOpQueue} className="mt-3 text-sm font-semibold text-white bg-brand rounded-lg px-4 py-2 hover:bg-brand-soft transition-colors">
                        Review Open Points →
                      </button>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-[#403833]">You have no actions assigned to you right now. 🎉</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'overview' && loadedWeek && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="max-w-4xl">
              <h2 className="text-xl font-extrabold text-[#403833]">{loadedWeek.label} · {scmName}</h2>
              <p className="text-sm text-[#9c9794] mt-1">{poQueue.length} PO action{poQueue.length === 1 ? '' : 's'} require your input</p>

              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 h-2 bg-white border border-[#e9e3df] rounded-full overflow-hidden">
                  <div className="h-full bg-brand transition-all" style={{ width: `${poQueue.length ? (completedPoCount / poQueue.length) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-semibold text-[#403833] shrink-0">
                  {completedPoCount} of {poQueue.length} completed — {poQueue.length ? Math.round((completedPoCount / poQueue.length) * 100) : 0}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'To do', value: todoPoCount, dot: 'bg-fail' },
                  { label: 'In progress', value: inProgressPoCount, dot: 'bg-warn' },
                  { label: 'Completed', value: completedPoCount, dot: 'bg-pass' },
                  { label: 'Open points (after POs)', value: outstandingOpenPoints.length, dot: 'bg-[#9c9794]' },
                ].map((k) => (
                  <div key={k.label} className="bg-white rounded-lg border border-[#e9e3df] px-3 py-2.5 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${k.dot}`} />
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-[#403833] leading-none">{k.value}</p>
                      <p className="text-[10px] text-[#9c9794] truncate">{k.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-lg border border-[#e9e3df] overflow-hidden mt-5">
                <div className="px-4 py-3 border-b border-[#f4f1ef]">
                  <p className="text-xs font-bold text-[#403833]">PO Actions ({poQueue.length})</p>
                </div>
                {poQueue.length === 0 ? (
                  <p className="text-center py-8 text-sm text-[#9c9794]">No PO actions for this SCM in {loadedWeek.label}.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#9c9794]">
                        {['#', 'PO Number', 'Supplier', 'Reason', 'PGRD Week', 'PGRD', 'ESD', 'Status', ''].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {poQueue.map((a, i) => {
                        const line = allLines.find((l) => l.po === a.poReference);
                        return (
                          <tr key={a.id} onClick={() => startPoQueue(a.id)} className="border-t border-[#f4f1ef] hover:bg-[#f9f7f6] cursor-pointer">
                            <td className="px-3 py-2 text-[#9c9794]">{i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-[#403833] whitespace-nowrap">{a.poReference}</td>
                            <td className="px-3 py-2 text-[#403833] max-w-[180px] truncate">{a.supplierName || '—'}</td>
                            <td className="px-3 py-2 text-[#58524e] max-w-[200px] truncate">{reasonBucket(a)}</td>
                            <td className="px-3 py-2 text-[#403833] whitespace-nowrap">{loadedWeek.label}</td>
                            <td className="px-3 py-2 text-[#403833] whitespace-nowrap">{formatDateShort(line?.pgrd ?? null)}</td>
                            <td className="px-3 py-2 text-[#403833] whitespace-nowrap">{formatDateShort(line?.esd ?? null)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 bg-[#f5f2ee] text-[#58524e]">
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
                                {STATUS_LABELS[a.status]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[#9c9794]">›</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {poQueue.length > 0 && (
                <div className="flex justify-end mt-4">
                  <button onClick={() => startPoQueue()} className="text-sm font-semibold text-white bg-brand rounded-lg px-5 py-2 hover:bg-brand-soft transition-colors">
                    {completedPoCount > 0 ? 'Continue' : 'Start'} resolving →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'resolve-po' && currentPoId && loadedWeek && (
          <ResolvePOScreen
            queue={poQueue}
            currentId={currentPoId}
            weekLabel={loadedWeek.label}
            onSave={(id, patch) => updateAction(id, patch)}
            onSelect={setCurrentPoId}
            onNext={afterPoQueueDone}
            onPrevious={() => {
              const idx = poQueue.findIndex((a) => a.id === currentPoId);
              if (idx > 0) setCurrentPoId(poQueue[idx - 1].id);
            }}
          />
        )}

        {screen === 'po-complete' && loadedWeek && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 flex items-center justify-center">
            <div className="max-w-md w-full bg-[#fff7ed] border border-brand/20 rounded-lg p-8 text-center">
              <CheckCircle2 size={40} className="text-pass mx-auto" />
              <h2 className="text-lg font-extrabold text-[#403833] mt-3">{loadedWeek.label} PO actions complete!</h2>
              <p className="text-sm text-[#7b7571] mt-1">You&apos;ve resolved all {poQueue.length} PO actions assigned to you for {loadedWeek.label}.</p>

              <div className="bg-white border border-[#e9e3df] rounded-lg p-4 mt-5 text-left">
                <p className="text-xs font-bold text-[#403833]">One more thing</p>
                <p className="text-xs text-[#7b7571] mt-1">You have {outstandingOpenPoints.length} Open Point{outstandingOpenPoints.length === 1 ? '' : 's'} assigned to you that need an update.</p>
                <button onClick={startOpQueue} className="mt-3 w-full text-sm font-semibold text-white bg-brand rounded-lg px-4 py-2 hover:bg-brand-soft transition-colors">
                  Review Open Points →
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'resolve-op' && currentOpId && (
          <ResolveOpenPointScreen
            queue={opQueue}
            currentId={currentOpId}
            onSave={(id, patch) => updateAction(id, patch)}
            onSelect={setCurrentOpId}
            onNext={() => setScreen('all-done')}
            onPrevious={() => {
              const idx = opQueue.findIndex((a) => a.id === currentOpId);
              if (idx > 0) setCurrentOpId(opQueue[idx - 1].id);
            }}
          />
        )}

        {screen === 'all-done' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 flex items-center justify-center">
            <div className="max-w-md w-full bg-[#f0faf4] border border-pass/30 rounded-lg p-8 text-center">
              <CheckCircle2 size={40} className="text-pass mx-auto" />
              <h2 className="text-lg font-extrabold text-[#403833] mt-3">You&apos;re all caught up! 🎉</h2>
              <p className="text-sm text-[#7b7571] mt-1">{loadedWeek ? `${loadedWeek.label} · ` : ''}{scmName}</p>

              <div className="bg-white border border-[#e9e3df] rounded-lg p-4 mt-5 space-y-2 text-left">
                {loadedWeek && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#58524e]">PO actions</span>
                    <span className="font-semibold text-[#403833] flex items-center gap-1.5">{completedPoCount} / {poQueue.length} <CheckCircle2 size={13} className="text-pass" /></span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#58524e]">Open Points</span>
                  <span className="font-semibold text-[#403833] flex items-center gap-1.5">{completedOpCount} / {opQueue.length} <CheckCircle2 size={13} className="text-pass" /></span>
                </div>
              </div>
              <p className="text-xs text-[#9c9794] mt-3">No further actions require your attention.</p>
              <button onClick={reset} className="mt-4 text-sm font-semibold text-[#403833] border border-[#e9e3df] rounded-lg px-4 py-2 hover:border-[#403833] transition-colors">
                Back to My Actions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
