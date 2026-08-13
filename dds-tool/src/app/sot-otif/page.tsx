'use client';

import { Suspense } from 'react';
import { SotOtifDrilldown } from '../../components/sotOtif/SotOtifDrilldown';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SotOtifDrilldown />
    </Suspense>
  );
}
