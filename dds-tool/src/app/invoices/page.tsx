'use client';

import { Suspense } from 'react';
import { InvoicesDrilldown } from '../../components/invoices/InvoicesDrilldown';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InvoicesDrilldown />
    </Suspense>
  );
}
