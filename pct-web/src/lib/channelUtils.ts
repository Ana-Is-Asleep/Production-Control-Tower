import type { PurchaseLine } from '../types';

export type Channel = 'Offline' | 'Online';

// Offline = delivered to one of these BC location codes (the retail/offline warehouse network).
// Everything else defaults to Online (D2C) — this replaces the old hard D2C-only pre-filter in
// useFilters.ts. Offline/Online is now a selectable filter dimension, not a hard gate.
const OFFLINE_LOCATIONS = ['DVT1_UK', 'REN1_FR', 'KNR1_DE', 'DBS1_ES', 'DBS1_GB', 'BB_NL', 'BETE_NL'];

export function getChannel(destination: string): Channel {
  return OFFLINE_LOCATIONS.includes(destination) ? 'Offline' : 'Online';
}

export function lineChannel(line: PurchaseLine): Channel {
  return getChannel(line.destination);
}
