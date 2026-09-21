import type { PurchaseLine } from '../types';
import type { ActionItem } from '../types/actions';
import { SUPPLIER_SCM_MAP } from './supplierScmMapping';
import { rollupByPO } from './poAggregation';
import type { IsChinaSupplier } from './kpiFormulas';

// Rules only evaluate PO data from this date onwards, regardless of the dashboard's week filter.
const RULES_DATA_FLOOR = new Date(2026, 0, 1);

// R001 — a PO has an EGRD in the past with no ESD recorded (no booking made) — flag it as a
// likely delay. One flag per PO: skips POs that already have an open-or-closed R001 flag from
// a previous upload (never duplicates, never auto-closes).
function evaluateR001(lines: PurchaseLine[], existingActions: ActionItem[], today: Date): ActionItem[] {
  const alreadyFlagged = new Set(
    existingActions.filter((a) => a.type === 'flag' && a.ruleKey === 'R001').map((a) => a.poReference)
  );
  const seenThisRun = new Set<string>();
  const newFlags: ActionItem[] = [];

  for (const line of lines) {
    if (!line.pgrd || line.pgrd < RULES_DATA_FLOOR) continue;
    if (!line.egrd || line.egrd >= today) continue;
    if (line.esd) continue; // has a booking
    if (alreadyFlagged.has(line.po) || seenThisRun.has(line.po)) continue;

    seenThisRun.add(line.po);
    const now = new Date().toISOString();
    newFlags.push({
      id: crypto.randomUUID(),
      type: 'flag',
      ruleKey: 'R001',
      bucket: 'missing_esd',
      poReference: line.po,
      supplierCode: line.vendorCode,
      supplierName: line.supplier,
      description: `EGRD in the past with no booking. Delay likely.`,
      owner: SUPPLIER_SCM_MAP[line.vendorCode?.trim()] ?? '',
      comment: '',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  }

  return newFlags;
}

// R002 — a PO's SOT result is a definite miss (majority of its lines shipped after the SOT
// threshold week, or the week closed with nothing shipped at all — see kpiFormulas.ts's
// computeSOTLine/rollupByPO's majority vote, reused as-is). Flags every PO currently in scope,
// not just newly-late ones, per Ana's "retroactive" call — this backfills the root cause queue
// immediately instead of waiting weeks for new misses to accumulate. One flag per PO, same
// never-duplicate/never-auto-close contract as R001. Closing requires a root cause (enforced in
// the UI, not here — the rule only ever creates flags, never edits/closes them).
function evaluateR002(lines: PurchaseLine[], existingActions: ActionItem[], isChinaSupplier: IsChinaSupplier, today: Date): ActionItem[] {
  const alreadyFlagged = new Set(
    existingActions.filter((a) => a.type === 'flag' && a.ruleKey === 'R002').map((a) => a.poReference)
  );
  const rollups = rollupByPO(lines, isChinaSupplier, today);
  const newFlags: ActionItem[] = [];

  for (const r of rollups) {
    if (r.sot !== false) continue; // only a definite miss — not null (undetermined/not yet due)
    if (alreadyFlagged.has(r.po)) continue;

    const now = new Date().toISOString();
    newFlags.push({
      id: crypto.randomUUID(),
      type: 'flag',
      ruleKey: 'R002',
      bucket: 'sot_otif',
      poReference: r.po,
      supplierCode: r.lines[0].vendorCode,
      supplierName: r.supplier,
      description: 'Missed SOT target. Root cause needed.',
      owner: SUPPLIER_SCM_MAP[r.lines[0].vendorCode?.trim()] ?? '',
      comment: '',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  }

  return newFlags;
}

// Runs every rule against the freshly uploaded lines and returns only the NEW flags to append —
// existing flags (open or closed) are never touched, per rule R001's "never auto-closed" contract.
export function runRulesEngine(lines: PurchaseLine[], existingActions: ActionItem[], isChinaSupplier: IsChinaSupplier): ActionItem[] {
  const today = new Date();
  return [
    ...evaluateR001(lines, existingActions, today),
    ...evaluateR002(lines, existingActions, isChinaSupplier, today),
  ];
}
