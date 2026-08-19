import type { ReasonCategory } from '../../lib/reasonClassification';

// Fixed hue assignment (never re-cycled/reordered) — the first 8 are a validated colorblind-safe
// categorical set (each hue chosen to stay distinguishable from its neighbors); the last 4 are
// additional, clearly distinct tones (dark navy, brown, slate, neutral gray) since 12 categories
// exceeds what a single validated set covers. Shared between the dashboard card and the
// full-page drill-down so the same category always reads as the same color everywhere.
export const CATEGORY_PALETTE: Record<ReasonCategory, string> = {
  production_capacity_constraint: '#2a78d6', // blue
  component_supply_delay: '#eb6834',         // orange
  holiday_plant_shutdown: '#1baf7a',         // aqua
  machine_production_issue: '#eda100',       // yellow
  truck_rounding_pallet_configuration_error: '#e87ba4', // magenta
  po_reshuffling_erp_issue: '#2f9e44',       // green
  transport_warehouse_slot_capacity: '#4a3aa7', // violet
  quality_issue: '#e34948',                  // red
  it_issue: '#0d366b',                       // dark navy
  forecast_order_quantity_mismatch: '#8a5a2b', // brown
  administrative_planning_error: '#64748b',  // slate
  other_unclear: '#9c9794',                  // neutral gray
};
