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

// Parse a chunk of worksheet XML (may be partial — must contain only complete <row>...</row> blocks).
// Appends to results in-place for streaming efficiency.
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
      const raw = cell.match(/<v>([^<]*)<\/v>/)?.[1] ?? '';
      let val: unknown;
      if (type === 's') val = ss[+raw] ?? '';
      else if (type === 'b') val = raw === '1';
      else if (type === 'str' || type === 'e') val = decodeXml(raw);
      else if (type === 'inlineStr') {
        // <is><t>text</t></is> — text is inside <is> not <v>
        val = decodeXml(cell.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? '');
      }
      else if (raw) val = +raw;
      if (val !== undefined) row[colIdx] = val;
    }
    if (row.length > 0) results.push(row);
  }
}

// Reads any .xlsx file using fflate's STREAMING API so the 500+ MB uncompressed
// worksheet XML is never held entirely in memory — we parse rows chunk by chunk.
export function readXlsxFile(file: File): Promise<XlsxWorkbook> {
  return file.arrayBuffer().then(
    (buf) =>
      new Promise<XlsxWorkbook>((resolve, reject) => {
        const rows: unknown[][] = [];
        let ss: string[] = [];
        let sheetName = 'Sheet1';

        // Per-file text buffers (shared strings + workbook are small, fine to buffer)
        let wbXml = '';
        let ssXml = '';
        // For the worksheet we keep only a tiny seam between chunks
        let worksheetSeam = '';

        let filesExpected = 0;
        let filesDone = 0;
        const checkDone = () => {
          if (filesDone >= filesExpected) {
            if (worksheetSeam.length > 0) {
              parseRowsInto(worksheetSeam, ss, rows);
              worksheetSeam = '';
            }
            resolve({ sheetName, rows });
          }
        };

        const unzipper = new fflate.Unzip();
        unzipper.register(fflate.UnzipInflate);

        unzipper.onfile = (f) => {
          if (f.name === 'xl/workbook.xml') {
            filesExpected++;
            const d = new TextDecoder();
            f.ondata = (err, chunk, final) => {
              if (err) return reject(err);
              wbXml += d.decode(chunk, { stream: !final });
              if (final) {
                const m = wbXml.match(/<sheet\b[^>]+name="([^"]+)"/);
                if (m) sheetName = decodeXml(m[1]);
                filesDone++;
                checkDone();
              }
            };
            f.start();
          } else if (f.name === 'xl/sharedStrings.xml') {
            filesExpected++;
            const d = new TextDecoder();
            f.ondata = (err, chunk, final) => {
              if (err) return reject(err);
              ssXml += d.decode(chunk, { stream: !final });
              if (final) {
                ss = parseSharedStrings(ssXml);
                filesDone++;
                checkDone();
              }
            };
            f.start();
          } else if (f.name.includes('/worksheets/') && f.name.endsWith('.xml')) {
            filesExpected++;
            const d = new TextDecoder();
            f.ondata = (err, chunk, final) => {
              if (err) return reject(err);
              // Decode this chunk and prepend any incomplete row from previous chunk
              const text = worksheetSeam + d.decode(chunk, { stream: !final });
              if (final) {
                parseRowsInto(text, ss, rows);
                worksheetSeam = '';
                filesDone++;
                checkDone();
              } else {
                // Only process up to the last complete </row> — keep the rest as seam
                const end = text.lastIndexOf('</row>');
                if (end !== -1) {
                  parseRowsInto(text.slice(0, end + 6), ss, rows);
                  worksheetSeam = text.slice(end + 6);
                } else {
                  worksheetSeam = text;
                }
              }
            };
            f.start();
          }
        };

        try {
          unzipper.push(new Uint8Array(buf), true);
        } catch (err) {
          reject(err);
        }
      })
  );
}
