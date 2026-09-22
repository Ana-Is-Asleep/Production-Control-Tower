import type { RootCauseReason } from '../../types/actions';

// Fixed hue per SCM-submitted root cause reason, in the same declared order as ROOT_CAUSE_REASONS
// — never cycled/reassigned by rank, so a given reason always reads as the same color everywhere
// it appears (dashboard card, Root Cause Detail page).
export const ROOT_CAUSE_REASON_PALETTE: Record<RootCauseReason, string> = {
  capacity_issues: '#eb6834',
  components_delay: '#2a78d6',
  covers: '#1baf7a',
  transport_issues: '#eda100',
  container_availability: '#4a3aa7',
  inbound_capacity: '#e87ba4',
};
