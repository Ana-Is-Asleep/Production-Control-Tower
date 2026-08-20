'use client';

import { Suspense } from 'react';
import { BacklogDrilldown } from '../../components/backlog/BacklogDrilldown';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BacklogDrilldown />
    </Suspense>
  );
}
