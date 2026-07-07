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
  for (const part of xml.split('<si>').slice(1)) {
    const texts: string[] = [];
    for (const m of part.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)) {
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

function parseRowsInto(xml: string, ss: string[], results: unknown[][]): void {
  const rowParts = xml.split('<row ');
  for (let ri = 1; ri < rowParts.length; ri++) {
    const row: unknown[] = [];
    const cellParts = rowParts[ri].split('<c ');
    for (let ci = 1; ci < cellParts.length; ci++) {
      const cell = cellParts[ci];
      const rM = cell.match(/\br="([A-Z]+)\d+"/);
      if (!rM) continue;
      const colIdx = colToIndex(rM[1]);
      const type = cell.match(/\bt="([^"]+)"/)?.[1] ?? '';
      const raw  = cell.match(/<v>([^<]*)<\/v>/)?.[1] ?? '';
      let val: unknown;
      if      (type === 's')        val = ss[+raw] ?? '';
      else if (type === 'b')        val = raw === '1';
      else if (type === 'str' || type === 'e') val = decodeXml(raw);
      else if (type === 'inlineStr') val = decodeXml(cell.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? '');
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

  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    const chunk = dec.decode(bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length)));
    const text = seam + chunk;
    const lastClose = text.lastIndexOf('</row>');
    if (lastClose === -1) {
      seam = text;
      continue;
    }
    parseRowsInto(text.slice(0, lastClose + 6), ss, results);
    seam = text.slice(lastClose + 6);
  }

  if (seam.length > 0) parseRowsInto(seam, ss, results);
  return results;
}

export function readXlsxFile(file: File): Promise<XlsxWorkbook> {
  return file.arrayBuffer().then((buf) => {
    const dec = (u: Uint8Array) => new TextDecoder().decode(u);

    let unzipped: fflate.Unzipped;
    try {
      unzipped = fflate.unzipSync(new Uint8Array(buf));
      console.log('[xlsxUtils] unzip OK — keys:', Object.keys(unzipped).map(k => `${k}(${unzipped[k].length})`));
    } catch (e) {
      console.error('[xlsxUtils] unzipSync threw:', e);
      throw e;
    }

    let ss: string[] = [];
    try {
      ss = unzipped['xl/sharedStrings.xml'] ? parseSharedStrings(dec(unzipped['xl/sharedStrings.xml'])) : [];
    } catch (e) { console.error('[xlsxUtils] sharedStrings threw:', e); throw e; }

    let sheetName = 'Sheet1';
    try {
      if (unzipped['xl/workbook.xml']) {
        const m = dec(unzipped['xl/workbook.xml']).match(/<sheet\b[^>]+name="([^"]+)"/);
        if (m) sheetName = decodeXml(m[1]);
      }
    } catch (e) { console.error('[xlsxUtils] workbook threw:', e); throw e; }

    const sheetKey = Object.keys(unzipped).sort().find((k) => k.includes('/worksheets/') && k.endsWith('.xml'));
    if (!sheetKey) throw new Error('No worksheet found in XLSX');

    console.log('[xlsxUtils] sheetKey:', sheetKey, 'bytes:', unzipped[sheetKey].length);

    let rows: unknown[][] = [];
    try {
      rows = parseWorksheetFromBytes(unzipped[sheetKey], ss);
      console.log('[xlsxUtils] parsed rows:', rows.length);
    } catch (e) { console.error('[xlsxUtils] parseWorksheet threw:', e); throw e; }

    return { sheetName, rows };
  });
}
