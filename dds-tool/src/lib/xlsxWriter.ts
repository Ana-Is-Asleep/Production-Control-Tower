import * as fflate from 'fflate';

// Minimal OOXML (.xlsx) writer — no new dependency, reuses the same `fflate` zip library
// xlsxUtils.ts already uses to READ .xlsx files. Plain cell values only (numbers + inline
// strings, no shared-strings table, no styles, no embedded charts) — enough to produce a real,
// Excel-openable multi-sheet workbook. Chart-in-Excel is a follow-up, not attempted here.

export type CellValue = string | number | null | undefined;

export interface SheetDef {
  name: string;
  rows: CellValue[][];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colName(idx: number): string {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(value: CellValue, colIdx: number, rowIdx: number): string {
  const ref = `${colName(colIdx)}${rowIdx + 1}`;
  if (value === null || value === undefined || value === '') return `<c r="${ref}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml(rows: CellValue[][]): string {
  const rowsXml = rows
    .map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cellXml(v, ci, ri)).join('')}</row>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet';
}

function workbookXml(sheets: SheetDef[]): string {
  const sheetsXml = sheets
    .map((s, i) => `<sheet name="${escapeXml(sanitizeSheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

export function buildWorkbook(sheets: SheetDef[]): Uint8Array {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': enc.encode(contentTypesXml(sheets.length)),
    '_rels/.rels': enc.encode(rootRelsXml()),
    'xl/workbook.xml': enc.encode(workbookXml(sheets)),
    'xl/_rels/workbook.xml.rels': enc.encode(workbookRelsXml(sheets.length)),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = enc.encode(sheetXml(s.rows));
  });
  return fflate.zipSync(files, { level: 6 });
}

export function downloadWorkbook(filename: string, sheets: SheetDef[]): void {
  const bytes = buildWorkbook(sheets);
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
