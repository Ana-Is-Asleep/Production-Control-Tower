'use client';

import { useState, useCallback } from 'react';
import { SlideOver } from '../shared/SlideOver';
import { Button } from '../shared/Button';
import { detectBCFileKind, parseLinesFromRows, parseHeadersFromRows, joinLinesWithHeaders } from '../../lib/bcParser';
import { parseInvoiceFile, type InvoiceParseMeta } from '../../lib/invoiceParser';
import { readXlsxFile } from '../../lib/xlsxUtils';
import type { PurchaseLine } from '../../types';
import type { InvoiceRow } from '../../types/invoice';

const D2C_LOCATIONS = ['DS0_FR', 'GXO1_FR', 'LN_IT', 'DS_ES', 'DSV1_UK', 'MS_IE', 'HA_DE'];

interface UploadPanelProps {
  open: boolean;
  onClose: () => void;
  onLoad: (lines: PurchaseLine[], invoices?: InvoiceRow[], invoiceMeta?: InvoiceParseMeta) => void;
}

function looksLikeInvoice(f: File) {
  const n = f.name.toLowerCase();
  return n.includes('invoice') || n.includes('un-posted') || n.includes('posted');
}

interface Result {
  lines: PurchaseLine[];
  lineCount: number;
  suppliers: string[];
}

export function UploadPanel({ open, onClose, onLoad }: UploadPanelProps) {
  const [result, setResult]             = useState<Result | null>(null);
  const [headerJoined, setHeaderJoined] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [invoiceRows, setInvoiceRows]   = useState<InvoiceRow[]>([]);
  const [invoiceMeta, setInvoiceMeta]   = useState<InvoiceParseMeta | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [dragging, setDragging]         = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    const xlsx = files.filter((f) => f.name.endsWith('.xlsx'));
    if (xlsx.length === 0) { setError('Drop at least one .xlsx file'); return; }
    setError(null);
    setLoading(true);
    try {
      const invoiceFile = xlsx.find(looksLikeInvoice);
      const bcCandidates = xlsx.filter((f) => f !== invoiceFile);

      // BC exports share the same generic filename pattern, so the Purchase Header vs Purchase
      // Line file can only be told apart by content (the report title in row 1).
      const bcFiles = await Promise.all(bcCandidates.map(async (file) => ({ file, ...(await readXlsxFile(file)) })));
      const linesFile  = bcFiles.find((f) => detectBCFileKind(f.rows) === 'lines');
      const headerFile = bcFiles.find((f) => detectBCFileKind(f.rows) === 'header');

      if (!linesFile) { setError('Could not identify a Purchase Order Lines file.'); setLoading(false); return; }

      let lines = parseLinesFromRows(linesFile.rows);
      if (headerFile) {
        lines = joinLinesWithHeaders(lines, parseHeadersFromRows(headerFile.rows));
      }
      const suppliers = [...new Set(lines.map((l) => l.supplier).filter(Boolean))];

      const parsedInvoices = invoiceFile ? await parseInvoiceFile(invoiceFile) : null;

      setResult({ lines, lineCount: lines.length, suppliers });
      setHeaderJoined(!!headerFile);
      setInvoiceRows(parsedInvoices?.rows ?? []);
      setInvoiceMeta(parsedInvoices?.meta ?? null);
      setInvoiceCount(parsedInvoices ? parsedInvoices.rows.length : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse — check the file format');
    } finally {
      setLoading(false);
    }
  }, []);

  const d2cCount = result
    ? result.lines.filter((l) => D2C_LOCATIONS.includes(l.destination) && l.pgrd?.getFullYear() === 2026).length
    : 0;

  return (
    <SlideOver open={open} onClose={onClose} title="Upload Data" width="w-[480px]">
      <div className="p-6 space-y-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => document.getElementById('file-input')?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-brand bg-brand-dim' : 'border-border hover:border-brand-soft'}`}
        >
          <div className="text-3xl mb-3">📂</div>
          <p className="text-sm text-dark font-medium">Drag & drop your XLSX files here</p>
          <p className="text-xs text-muted mt-1">Purchase Lines · Purchase Header (optional, for vendor names) · Invoices (optional)</p>
          <input id="file-input" type="file" accept=".xlsx" multiple className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))} />
        </div>

        {error   && <div className="bg-fail-bg text-fail-text text-sm px-3 py-2 rounded-lg">{error}</div>}
        {loading && <div className="text-sm text-muted text-center py-4">Parsing… this may take a moment for large files</div>}

        {result && !loading && (
          <div className="space-y-3">
            <div className="border border-border rounded-lg divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2"><span className="text-green-600">✓</span><span className="text-sm text-dark">Purchase Lines</span></div>
                <span className="text-xs text-muted">{result.lineCount.toLocaleString()} rows</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={headerJoined ? 'text-green-600' : 'text-[#c8c0bb]'}>{headerJoined ? '✓' : '—'}</span>
                  <span className="text-sm text-dark">Purchase Header</span>
                </div>
                <span className="text-xs text-muted">{headerJoined ? 'vendor names joined' : 'not uploaded'}</span>
              </div>
              {invoiceCount !== null && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2"><span className="text-green-600">✓</span><span className="text-sm text-dark">Invoices</span></div>
                  <span className="text-xs text-muted">{invoiceCount.toLocaleString()} rows</span>
                </div>
              )}
            </div>
            {!headerJoined && (
              <div className="bg-warn-bg text-warn-text text-xs px-3 py-2 rounded-lg">
                No Purchase Header file detected — vendor names will be blank. Upload it alongside the Lines file to fix this.
              </div>
            )}
            <div className="text-xs text-muted space-y-1">
              <div className="flex justify-between"><span>Vendors</span><span className="font-medium text-dark">{result.suppliers.length}</span></div>
              <div className="flex justify-between"><span>D2C lines (2026)</span><span className="font-medium text-brand">{d2cCount.toLocaleString()}</span></div>
            </div>
            <Button className="w-full justify-center" onClick={() => { onLoad(result.lines, invoiceRows.length > 0 ? invoiceRows : undefined, invoiceMeta ?? undefined); onClose(); }}>
              Load Data →
            </Button>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
