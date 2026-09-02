'use client';

import { Suspense } from 'react';
import { ActionsPage } from '../../components/actions/ActionsPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ActionsPage />
    </Suspense>
  );
}
