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

// Parses xl/worksheets/sheet*.xml into rows of raw values.
// Dates remain as Excel serial numbers (handled by parseDate in callers).
function parseWorksheetRows(xml: string, ss: string[]): unknown[][] {
  const rows: unknown[][] = [];
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
      const raw = cell.match(/<v>([^<]*)<\/v>/)?.[1] ?? '';
      let val: unknown;
      if (type === 's') val = ss[+raw] ?? '';
      else if (type === 'b') val = raw === '1';
      else if (type === 'str' || type === 'e') val = decodeXml(raw);
      else if (type === 'inlineStr') val = decodeXml(cell.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? '');
      else if (raw) val = +raw;
      if (val !== undefined) row[colIdx] = val;
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

// Reads any .xlsx file — XLSX is a ZIP, so we unzip with fflate and parse the XML directly.
// This handles large files (150K+ rows) that SheetJS 0.18.5 fails on silently.
export function readXlsxFile(file: File): Promise<XlsxWorkbook> {
  return file.arrayBuffer().then((buf) => {
    const dec = (u: Uint8Array) => new TextDecoder().decode(u);
    const unzipped = fflate.unzipSync(new Uint8Array(buf), {
      filter: (f) =>
        f.name === 'xl/sharedStrings.xml' ||
        f.name === 'xl/workbook.xml' ||
        f.name.startsWith('xl/worksheets/'),
    });

    const ss = unzipped['xl/sharedStrings.xml']
      ? parseSharedStrings(dec(unzipped['xl/sharedStrings.xml']))
      : [];

    let sheetName = 'Sheet1';
    if (unzipped['xl/workbook.xml']) {
      const m = dec(unzipped['xl/workbook.xml']).match(/<sheet\b[^>]+name="([^"]+)"/);
      if (m) sheetName = decodeXml(m[1]);
    }

    const sheetKey = Object.keys(unzipped)
      .sort()
      .find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    if (!sheetKey) throw new Error('No worksheet found in XLSX file');

    return { sheetName, rows: parseWorksheetRows(dec(unzipped[sheetKey]), ss) };
  });
}
