// Centralizes hex values used directly in chart fill/stroke props (which bypass Tailwind classes).
// These mirror the existing semantic tokens already defined in tailwind.config.ts / globals.css
// (text-pass/text-fail/text-warn, brand, navy, etc.) — don't invent a new palette, just reuse it here
// so every new chart imports from one place instead of hardcoding hex per-component.
export const COLOR = {
  brand: '#FF8900',
  brandSoft: '#FFA236',
  navy: '#403833',
  muted: '#9c9794',
  border: '#e9e3df',
  pass: '#15803d',
  passBg: '#DCFCE7',
  fail: '#dc2626',
  failBg: '#FEE2E2',
  warn: '#F59E0B',
  warnBg: '#FEF3C7',
  purple: '#6469aa',
  green: '#34A853',
} as const;

// Top Graph bars: light orange = total POs, dark orange = shipped subset
export const BAR_TOTAL = 'rgba(255, 137, 0, 0.28)';
export const BAR_SHIPPED = COLOR.brand;

// SOT/OTIF lines
export const LINE_SOT = COLOR.brand;
export const LINE_OTIF = COLOR.pass;

export const CATEGORY_COLORS = {
  Beds: COLOR.purple,
  Mattresses: COLOR.brand,
  Accessories: COLOR.green,
  'Comps/Other': '#8A8A8A',
} as const;

export function passFailColor(value: number | null, target: number): string {
  if (value === null) return COLOR.muted;
  return value >= target ? COLOR.pass : COLOR.fail;
}
