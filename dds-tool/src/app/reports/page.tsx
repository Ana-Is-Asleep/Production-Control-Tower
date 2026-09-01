'use client';

import { Suspense } from 'react';
import { ReportsPage } from '../../components/reports/ReportsPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportsPage />
    </Suspense>
  );
}
