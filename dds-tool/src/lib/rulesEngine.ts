import type { PurchaseLine } from '../types';
import type { ActionItem } from '../types/actions';

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
      poReference: line.po,
      supplierCode: line.vendorCode,
      supplierName: line.supplier,
      description: `PO ${line.po} — EGRD in the past with no booking. Delay likely.`,
      owner: '',
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
export function runRulesEngine(lines: PurchaseLine[], existingActions: ActionItem[]): ActionItem[] {
  const today = new Date();
  return [
    ...evaluateR001(lines, existingActions, today),
  ];
}
