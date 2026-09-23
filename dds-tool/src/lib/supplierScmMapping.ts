import type { Channel } from './channelUtils';
import type { SKUCategory } from './skuUtils';

// SCM (and Team Lead) assignment per (Buy-from Vendor No., Channel, Category) combination —
// extracted from "Supply Chain Managers - Email Automation.xlsx" (Emma Operations - 2600 -
// Transportation / 13 - Automations). A vendor can have a DIFFERENT SCM depending on channel and/or
// category (e.g. Sinomax's D2C Mattresses line is Mahmut, but its D2C Accessories line is
// Valentin) — this replaces the old flat vendorCode -> SCM map, which only ever captured one SCM
// per vendor and silently picked the wrong one for any vendor split across channel/category.
// "D2C" in the source sheet is this app's "Online" (see channelUtils.ts); "Comp / Others" is this
// app's "Comps/Other" (see skuUtils.ts).
export interface ScmAssignment {
  vendorCode: string;
  vendorName: string;
  channel: Channel;
  category: SKUCategory;
  scm: string;
  tl: string;
}

export const SCM_ASSIGNMENTS: ScmAssignment[] = [
  { vendorCode: '9702542', vendorName: 'Novaqui SA', channel: 'Online', category: 'Mattresses', scm: 'lara.schafer@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702542', vendorName: 'Novaqui SA', channel: 'Offline', category: 'Mattresses', scm: 'chiara.delprete@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9700004', vendorName: 'B and A Quilting (UK) Ltd', channel: 'Online', category: 'Mattresses', scm: 'chiara.delprete@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9700004', vendorName: 'B and A Quilting (UK) Ltd', channel: 'Online', category: 'Accessories', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9700004', vendorName: 'B and A Quilting (UK) Ltd', channel: 'Offline', category: 'Mattresses', scm: 'chiara.delprete@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9700004', vendorName: 'B and A Quilting (UK) Ltd', channel: 'Offline', category: 'Accessories', scm: 'manuel.sousa@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9700148', vendorName: 'BekaertDeslee NV', channel: 'Online', category: 'Comps/Other', scm: 'tabata.cervone@emma-sleep.com', tl: 'ana.gomes@emma-sleep.com' },
  { vendorCode: '9700000', vendorName: 'CT Formpolster GmbH', channel: 'Online', category: 'Mattresses', scm: 'lara.schafer@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9700000', vendorName: 'CT Formpolster GmbH', channel: 'Offline', category: 'Mattresses', scm: 'chiara.delprete@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9704538', vendorName: 'Fennobed OÜ', channel: 'Online', category: 'Beds', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9706510', vendorName: 'Fennobed Production OÜ', channel: 'Online', category: 'Beds', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702394', vendorName: 'Flex 2000', channel: 'Online', category: 'Mattresses', scm: 'adriana.reis@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702394', vendorName: 'Flex 2000', channel: 'Offline', category: 'Mattresses', scm: 'manuel.sousa@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9705857', vendorName: 'HANGZHOU JOYCE HOUSEHOLD TEXTILES CO.,LTD', channel: 'Online', category: 'Accessories', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9703579', vendorName: 'Haoxiang Furniture MFG. CO., LTD', channel: 'Online', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702690', vendorName: 'Ikano Industry Sp. z o.o.', channel: 'Online', category: 'Mattresses', scm: 'charlie.damore@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702690', vendorName: 'Ikano Industry Sp. z o.o.', channel: 'Offline', category: 'Mattresses', scm: 'manuel.sousa@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9701397', vendorName: "JOHN COTTON EUROPE' SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ", channel: 'Online', category: 'Accessories', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9705596', vendorName: 'Kalinel Ltd', channel: 'Offline', category: 'Accessories', scm: 'chiara.delprete@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9705596', vendorName: 'Kalinel Ltd', channel: 'Online', category: 'Accessories', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9700005', vendorName: 'Kayfoam Woolfson', channel: 'Online', category: 'Mattresses', scm: 'mahmut.cagrici@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9700005', vendorName: 'Kayfoam Woolfson', channel: 'Offline', category: 'Mattresses', scm: 'manuel.sousa@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9706531', vendorName: 'KUKA HOME (SINGAPORE) PTE. LTD', channel: 'Online', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9706531', vendorName: 'KUKA HOME (SINGAPORE) PTE. LTD', channel: 'Offline', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9705324', vendorName: 'Lomotex GmbH & Co. KG', channel: 'Online', category: 'Accessories', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702109', vendorName: 'Somieres Marpe Sl', channel: 'Online', category: 'Beds', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9703918', vendorName: 'Mi Casa Es Tu Casa, Lda.', channel: 'Online', category: 'Accessories', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9700767', vendorName: 'Padvaiskas ir Ko Joint-Stock Company Ltd', channel: 'Online', category: 'Beds', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9701516', vendorName: 'Rinova-Flex GmbH', channel: 'Online', category: 'Beds', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702471', vendorName: 'Sitab PE spa', channel: 'Online', category: 'Accessories', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702471', vendorName: 'Sitab PE spa', channel: 'Online', category: 'Mattresses', scm: 'adriana.reis@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702471', vendorName: 'Sitab PE spa', channel: 'Offline', category: 'Accessories', scm: 'chiara.delprete@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702471', vendorName: 'Sitab PE spa', channel: 'Offline', category: 'Mattresses', scm: 'adriana.reis@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702324', vendorName: 'Sinomax International Trading Ltd.', channel: 'Offline', category: 'Accessories', scm: 'tobi.fu@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702324', vendorName: 'Sinomax International Trading Ltd.', channel: 'Online', category: 'Mattresses', scm: 'mahmut.cagrici@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702324', vendorName: 'Sinomax International Trading Ltd.', channel: 'Online', category: 'Accessories', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702324', vendorName: 'Sinomax International Trading Ltd.', channel: 'Offline', category: 'Mattresses', scm: 'tobi.fu@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9704539', vendorName: 'VELAMEN S.A.', channel: 'Online', category: 'Accessories', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9704539', vendorName: 'VELAMEN S.A.', channel: 'Offline', category: 'Accessories', scm: 'mario.giron@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'SLEEMON HEALTHY SLEEP TECHNOLOGY CO.,LTD.', channel: 'Online', category: 'Mattresses', scm: 'mahmut.cagrici@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'Xilinmen Furniture Co., Ltd', channel: 'Online', category: 'Mattresses', scm: 'mahmut.cagrici@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'SLEEMON HEALTHY SLEEP TECHNOLOGY CO.,LTD.', channel: 'Online', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'Xilinmen Furniture Co., Ltd', channel: 'Online', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'SLEEMON HEALTHY SLEEP TECHNOLOGY CO.,LTD.', channel: 'Offline', category: 'Mattresses', scm: 'tobi.fu@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'Xilinmen Furniture Co., Ltd', channel: 'Offline', category: 'Mattresses', scm: 'tobi.fu@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9702326', vendorName: 'SLEEMON HEALTHY SLEEP TECHNOLOGY CO.,LTD.', channel: 'Offline', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9705650', vendorName: 'Qingdao Youmeng Home Furnishing Technology Co. Ltd', channel: 'Online', category: 'Mattresses', scm: 'mahmut.cagrici@emma-sleep.com', tl: 'konstantin.knoblich@emma-sleep.com' },
  { vendorCode: '9803188', vendorName: 'Haoxiang Furniture MFG. CO., LTD', channel: 'Offline', category: 'Beds', scm: 'valentin.lamy@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9706597', vendorName: 'Actona Poland Sp. Z.o.o.', channel: 'Online', category: 'Beds', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
  { vendorCode: '9706597', vendorName: 'Actona Poland Sp. Z.o.o.', channel: 'Offline', category: 'Beds', scm: 'prithviraj.chauhan@emma-sleep.com', tl: 'judith.stoeckhardt@emma-sleep.com' },
];

// Vendors from the old flat map that don't appear anywhere in the new per-channel/category sheet
// (likely out of scope of that export, e.g. inactive or not yet onboarded to it) — kept as a
// last-resort fallback so these vendors don't silently lose their SCM assignment entirely.
const LEGACY_VENDOR_FALLBACK: Record<string, string> = {
  '9701987': 'ana.gomes@emma-sleep.com',
  '9703170': 'ana.gomes@emma-sleep.com',
  '9704253': 'ana.gomes@emma-sleep.com',
  '9706412': 'ana.gomes@emma-sleep.com',
  '9706486': 'ana.gomes@emma-sleep.com',
};

// Ultimate fallback when a vendor isn't in the sheet at all (not even under LEGACY_VENDOR_FALLBACK)
// — an unowned flag is worse than one assigned to the wrong person, so it lands with Ana rather
// than silently going out with no owner.
const ULTIMATE_FALLBACK_SCM = 'ana.gomes@emma-sleep.com';

const byExactKey = new Map<string, ScmAssignment>();
const byVendorChannel = new Map<string, ScmAssignment>();
const byVendor = new Map<string, ScmAssignment>();
for (const a of SCM_ASSIGNMENTS) {
  byExactKey.set(`${a.vendorCode}__${a.channel}__${a.category}`, a);
  const vc = `${a.vendorCode}__${a.channel}`;
  if (!byVendorChannel.has(vc)) byVendorChannel.set(vc, a);
  // prefer the Online row as the vendor-level fallback, matching the old map's stated preference
  if (!byVendor.has(a.vendorCode) || a.channel === 'Online') byVendor.set(a.vendorCode, a);
}

// Looks up the SCM assigned to a vendor for a specific channel + category, falling back to
// progressively coarser matches (same vendor+channel any category, then any row for the vendor)
// when the exact combination isn't in the sheet — real BC data doesn't always hit every
// channel/category cell a vendor could theoretically have.
export function lookupScmAssignment(vendorCode: string, channel: Channel, category: SKUCategory): ScmAssignment | undefined {
  const code = vendorCode?.trim();
  if (!code) return undefined;
  return (
    byExactKey.get(`${code}__${channel}__${category}`) ??
    byVendorChannel.get(`${code}__${channel}`) ??
    byVendor.get(code)
  );
}

export function lookupScmEmail(vendorCode: string, channel: Channel, category: SKUCategory): string {
  return lookupScmAssignment(vendorCode, channel, category)?.scm ?? LEGACY_VENDOR_FALLBACK[vendorCode?.trim()] ?? ULTIMATE_FALLBACK_SCM;
}

// Vendor-only fallback for contexts with no channel/category to key on (e.g. backfilling the
// owner on an already-stored ActionItem, which doesn't record either) — prefers the vendor's
// Online-channel assignment, same preference the old flat map used.
export function defaultScmForVendor(vendorCode: string): string {
  const code = vendorCode?.trim();
  if (!code) return ULTIMATE_FALLBACK_SCM;
  return byVendor.get(code)?.scm ?? LEGACY_VENDOR_FALLBACK[code] ?? ULTIMATE_FALLBACK_SCM;
}
