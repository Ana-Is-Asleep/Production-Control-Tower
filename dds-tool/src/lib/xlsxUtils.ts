import * as fflate from 'fflate';

export interface XlsxWorkbook {
  sheetName: string;
  rows: unknown[][];
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const part of xml.split(/<(?:x:)?si>/).slice(1)) {
    const texts: string[] = [];
    for (const m of part.matchAll(/<(?:x:)?t(?:\s[^>]*)?>([^<]*)<\/(?:x:)?t>/g)) {
      texts.push(decodeXml(m[1]));
    }
    out.push(texts.join(''));
  }
  return out;
}

function colToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n - 1;
}

// Matches both plain <row ...> and namespace-prefixed <x:row ...>
const ROW_OPEN  = /<(?:x:)?row[ >]/g;
const CELL_OPEN = /<(?:x:)?c[ >]/g;

function parseRowsInto(xml: string, ss: string[], results: unknown[][]): void {
  // Split on row open tags (plain or x: prefixed)
  const rowParts = xml.split(ROW_OPEN);
  for (let ri = 1; ri < rowParts.length; ri++) {
    const row: unknown[] = [];
    const cellParts = rowParts[ri].split(CELL_OPEN);
    for (let ci = 1; ci < cellParts.length; ci++) {
      const cell = cellParts[ci];
      const rM = cell.match(/\br="([A-Z]+)\d+"/);
      if (!rM) continue;
      const colIdx = colToIndex(rM[1]);
      const type = cell.match(/\bt="([^"]+)"/)?.[1] ?? '';
      // Match <v> or <x:v>
      const raw  = cell.match(/<(?:x:)?v>([^<]*)<\/(?:x:)?v>/)?.[1] ?? '';
      let val: unknown;
      if      (type === 's')        val = ss[+raw] ?? '';
      else if (type === 'b')        val = raw === '1';
      else if (type === 'str' || type === 'e') val = decodeXml(raw);
      else if (type === 'inlineStr') val = decodeXml(cell.match(/<(?:x:)?t[^>]*>([^<]*)<\/(?:x:)?t>/)?.[1] ?? '');
      else if (raw)                 val = +raw;
      if (val !== undefined) row[colIdx] = val;
    }
    if (row.length > 0) results.push(row);
  }
}

// The worksheet XML can be 500+ MB — TextDecoder fails silently on arrays that large.
// Fix: decode in 8 MB slices and parse rows as they arrive. Only a tiny seam is kept
// between chunks (the partial <row> at the boundary, always < 1 row ≈ a few KB).
function parseWorksheetFromBytes(bytes: Uint8Array, ss: string[]): unknown[][] {
  const CHUNK = 8 * 1024 * 1024;
  const dec = new TextDecoder();
  const results: unknown[][] = [];
  let seam = '';
  // Matches both </row> and </x:row>
  const closeTag = '</row>';
  const closeTagX = '</x:row>';

  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    const chunk = dec.decode(bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length)));
    const text = seam + chunk;
    // Find the last closing row tag (either form)
    const lastX     = text.lastIndexOf(closeTagX);
    const lastPlain = text.lastIndexOf(closeTag);
    const lastClose = Math.max(lastX !== -1 ? lastX + closeTagX.length : -1,
                               lastPlain !== -1 ? lastPlain + closeTag.length : -1);
    if (lastClose === -1) {
      seam = text;
      continue;
    }
    parseRowsInto(text.slice(0, lastClose), ss, results);
    seam = text.slice(lastClose);
  }

  if (seam.length > 0) parseRowsInto(seam, ss, results);
  return results;
}

export function readXlsxFile(file: File): Promise<XlsxWorkbook> {
  return file.arrayBuffer().then((buf) => {
    const dec = (u: Uint8Array) => new TextDecoder().decode(u);

    const unzipped = fflate.unzipSync(new Uint8Array(buf));

    const ss = unzipped['xl/sharedStrings.xml'] ? parseSharedStrings(dec(unzipped['xl/sharedStrings.xml'])) : [];

    let sheetName = 'Sheet1';
    if (unzipped['xl/workbook.xml']) {
      const m = dec(unzipped['xl/workbook.xml']).match(/<(?:x:)?sheet\b[^>]+name="([^"]+)"/);
      if (m) sheetName = decodeXml(m[1]);
    }

    const sheetKey = Object.keys(unzipped).sort().find((k) => k.includes('/worksheets/') && k.endsWith('.xml'));
    if (!sheetKey) throw new Error('No worksheet found in XLSX');

    const rows = parseWorksheetFromBytes(unzipped[sheetKey], ss);

    return { sheetName, rows };
  });
}
