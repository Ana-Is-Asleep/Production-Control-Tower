import type { PurchaseLine } from '../types';
import type { ActionItem } from '../types/actions';
import { lookupScmEmail } from './supplierScmMapping';
import { getChannel } from './channelUtils';
import { categorizeSKU } from './skuUtils';
import { rollupByPO } from './poAggregation';
import type { IsChinaSupplier } from './kpiFormulas';

function scmForLine(line: PurchaseLine): string {
  return lookupScmEmail(line.vendorCode, getChannel(line.destination), categorizeSKU(line.sku));
}

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
      owner: scmForLine(line),
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
      owner: scmForLine(r.lines[0]),
      comment: '',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  }

  return newFlags;
}

// One-time correction for a boundary bug in computeSOTLine (fixed 2026-09-22): a PO whose PGRD
// fell in the CURRENT, still-open week was wrongly hard-failed for lacking an ASD, so some R002
// flags were created for POs that were never actually a definite SOT miss. Removes any *open*
// R002 flag whose PO no longer evaluates to a miss under the corrected formula — never touches an
// already-closed flag (a human already acted on it) or one that's still a genuine miss. Runs
// automatically on every upload, since PO data itself isn't persisted across sessions.
export function pruneStaleR002Flags(lines: PurchaseLine[], existingActions: ActionItem[], isChinaSupplier: IsChinaSupplier, today: Date): ActionItem[] {
  const openR002 = existingActions.filter((a) => a.type === 'flag' && a.ruleKey === 'R002' && a.status !== 'closed' && a.poReference);
  if (openR002.length === 0) return existingActions;

  const sotByPO = new Map(rollupByPO(lines, isChinaSupplier, today).map((r) => [r.po, r.sot]));
  const staleIds = new Set(
    openR002
      .filter((a) => {
        const sot = sotByPO.get(a.poReference!);
        return sot !== undefined && sot !== false; // undefined = PO not in this dataset, leave alone
      })
      .map((a) => a.id)
  );
  if (staleIds.size === 0) return existingActions;
  return existingActions.filter((a) => !staleIds.has(a.id));
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
