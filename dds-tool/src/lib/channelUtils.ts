import type { PurchaseLine } from '../types';

export type Channel = 'Offline' | 'D2C';

// Offline = delivered to one of these BC location codes (the retail/offline warehouse network).
// Everything else defaults to D2C — this replaces the old hard D2C-only pre-filter in useFilters.ts.
// Offline/D2C is now a selectable filter dimension, not a hard gate.
const OFFLINE_LOCATIONS = ['DVT1_UK', 'REN1_FR', 'KNR1_DE', 'DBS1_ES', 'DBS1_GB', 'BB_NL', 'BETE_NL'];

export function getChannel(destination: string): Channel {
  return OFFLINE_LOCATIONS.includes(destination) ? 'Offline' : 'D2C';
}

export function lineChannel(line: PurchaseLine): Channel {
  return getChannel(line.destination);
}
