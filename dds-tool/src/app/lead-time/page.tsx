'use client';

import { Suspense } from 'react';
import { LeadTimeDrilldown } from '../../components/leadTime/LeadTimeDrilldown';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LeadTimeDrilldown />
    </Suspense>
  );
}
