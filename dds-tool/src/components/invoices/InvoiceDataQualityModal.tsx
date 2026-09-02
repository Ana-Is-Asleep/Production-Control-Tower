'use client';

import { LargeModal } from '../shared/LargeModal';
import type { InvoiceParseMeta } from '../../lib/invoiceParser';

interface InvoiceDataQualityModalProps {
  meta: InvoiceParseMeta | null;
  onClose: () => void;
}

// ETL diagnostics moved out of the main analytical page and into this secondary panel — the
// operational user sees invoice insights first, this is only for someone auditing the pipeline.
export function InvoiceDataQualityModal({ meta, onClose }: InvoiceDataQualityModalProps) {
  return (
    <LargeModal title="Data Quality / Data Info" onClose={onClose}>
      {!meta ? (
        <p className="text-sm text-[#9c9794]">No parsing diagnostics available for the currently loaded invoice data (it may have been loaded before this tracking was added — re-upload the invoice export to see this).</p>
      ) : (
        <div className="bg-white rounded-lg border border-[#e9e3df] divide-y divide-[#f4f1ef] max-w-md">
          {[
            ['Rows in file', meta.rowsInFile],
            ['Archived rows removed', meta.archivedRemoved],
            ['Unrecognised cost centres removed', meta.unrecognizedCostCenterRemoved],
            ['Duplicate rows dropped', meta.duplicateRowsDropped],
            ['Rows analysed', meta.rowsAnalyzed],
            ['SCF suppliers matched', meta.scfSuppliersMatched],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-[#7b7571]">{label}</span>
              <span className="font-semibold text-[#403833]">{(value as number).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </LargeModal>
  );
}
