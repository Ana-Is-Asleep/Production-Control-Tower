'use client';

import { Suspense } from 'react';
import { RootCauseDrilldown } from '../../components/rootCause/RootCauseDrilldown';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RootCauseDrilldown />
    </Suspense>
  );
}
