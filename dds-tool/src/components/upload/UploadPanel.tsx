'use client';

import { useState, useCallback } from 'react';
import { SlideOver } from '../shared/SlideOver';
import { Button } from '../shared/Button';
import { parseFiles, type ParseResult } from '../../lib/bcParser';
import type { PurchaseLine } from '../../types';

const D2C_LOCATIONS = ['DS0_FR', 'GXO1_FR', 'LN_IT', 'DS_ES', 'DSV1_UK', 'MS_IE', 'HA_DE'];

interface UploadPanelProps {
  open: boolean;
  onClose: () => void;
  onLoad: (lines: PurchaseLine[]) => void;
}

export function UploadPanel({ open, onClose, onLoad }: UploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(async (newFiles: File[]) => {
    const xlsxFiles = newFiles.filter((f) => f.name.endsWith('.xlsx'));
    if (xlsxFiles.length < 2) {
      setError('Please upload exactly 2 XLSX files (Header + Lines)');
      return;
    }
    setFiles(xlsxFiles.slice(0, 2));
    setError(null);
    setLoading(true);
    try {
      const res = await parseFiles(xlsxFiles[0], xlsxFiles[1]);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse files — check the format and try again');
    } finally {
      setLoading(false);
    }
  }, []);

  const d2cCount = result
    ? result.lines.filter((l) => D2C_LOCATIONS.includes(l.destination) && l.pgrd?.getFullYear() === 2026).length
    : 0;

  const handleLoad = () => {
    if (!result) return;
    onLoad(result.lines);
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title="Upload Business Central Data" width="w-[480px]">
      <div className="p-6 space-y-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => document.getElementById('file-input')?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-brand bg-brand-dim' : 'border-border hover:border-brand-soft'}`}
        >
          <div className="text-3xl mb-3">📂</div>
          <p className="text-sm text-dark font-medium">Drag & drop 2 XLSX files here</p>
          <p className="text-xs text-muted mt-1">or click to browse</p>
          <input
            id="file-input"
            type="file"
            accept=".xlsx"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {error && (
          <div className="bg-fail-bg text-fail-text text-sm px-3 py-2 rounded-lg">{error}</div>
        )}

        {loading && (
          <div className="text-sm text-muted text-center py-4">Parsing files...</div>
        )}

        {result && !loading && (
          <div className="space-y-3">
            <div className="border border-border rounded-lg divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-sm text-dark">Purchase Header</span>
                </div>
                <span className="text-xs text-muted">{result.headerCount} rows</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-sm text-dark">Purchase Lines</span>
                </div>
                <span className="text-xs text-muted">{result.lineCount} rows</span>
              </div>
            </div>

            <div className="text-xs text-muted space-y-1">
              <div className="flex justify-between">
                <span>Lines matched</span>
                <span className="font-medium text-dark">{result.matchedCount} / {result.lineCount}</span>
              </div>
              {result.unmatchedCount > 0 && (
                <div className="flex justify-between">
                  <span>Unmatched</span>
                  <span className="text-warn font-medium">{result.unmatchedCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Vendors</span>
                <span className="font-medium text-dark">{result.suppliers.length}</span>
              </div>
              <div className="flex justify-between">
                <span>D2C lines after filter</span>
                <span className="font-medium text-brand">{d2cCount}</span>
              </div>
            </div>

            <Button className="w-full justify-center" onClick={handleLoad}>
              Load Data →
            </Button>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
