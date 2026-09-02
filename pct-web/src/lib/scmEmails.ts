// Extracted from the "SCM" column of "Supply Chain Managers - Email Automation.xlsx"
// (Emma Operations - 2600 - Transportation / 13 - Automations), deduplicated.
export const SCM_EMAILS = [
  'adriana.reis@emma-sleep.com',
  'ana.gomes@emma-sleep.com',
  'charlie.damore@emma-sleep.com',
  'chiara.delprete@emma-sleep.com',
  'lara.schafer@emma-sleep.com',
  'mahmut.cagrici@emma-sleep.com',
  'manuel.sousa@emma-sleep.com',
  'mario.giron@emma-sleep.com',
  'prithviraj.chauhan@emma-sleep.com',
  'tabata.cervone@emma-sleep.com',
  'tobi.fu@emma-sleep.com',
  'valentin.lamy@emma-sleep.com',
] as const;

// "ana.gomes@emma-sleep.com" -> "Ana Gomes" — owners are stored as email (the stable identifier)
// but always displayed by name.
export function emailToDisplayName(email: string): string {
  if (!email) return '';
  const local = email.split('@')[0];
  return local
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
