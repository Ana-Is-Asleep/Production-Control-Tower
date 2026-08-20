'use client';

import { Suspense } from 'react';
import { MissingEsdDrilldown } from '../../components/missingEsd/MissingEsdDrilldown';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MissingEsdDrilldown />
    </Suspense>
  );
}
