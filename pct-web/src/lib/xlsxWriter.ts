import * as fflate from 'fflate';

// Minimal OOXML (.xlsx) writer — no new dependency, reuses the same `fflate` zip library
// xlsxUtils.ts already uses to READ .xlsx files. Plain cell values (numbers + inline strings, no
// shared-strings table, no styles) plus one optional native Excel chart per workbook, bound to
// the sheet's own cell ranges (not a pasted image) — enough to produce a real, Excel-openable
// multi-sheet workbook with a live chart.

export type CellValue = string | number | null | undefined;

export interface ChartSeries {
  name: string; // literal series name (cached value only, not cell-bound — keeps this simple)
  valueRange: string; // fully-qualified formula, e.g. "'Weekly Evolution'!$C$2:$C$12"
}

export interface ChartDef {
  type: 'line' | 'bar';
  title: string;
  categoryRange: string; // fully-qualified formula, e.g. "'Weekly Evolution'!$A$2:$A$12"
  series: ChartSeries[];
  anchorRow?: number; // 0-based row on the sheet the chart is placed on (default 2)
}

export interface SheetDef {
  name: string;
  rows: CellValue[][];
  chart?: ChartDef; // only the FIRST sheet with a chart across the workbook gets one, v1 keeps to one chart per export
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

function sheetXml(rows: CellValue[][], drawingRelId: string | null): string {
  const rowsXml = rows
    .map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cellXml(v, ci, ri)).join('')}</row>`)
    .join('');
  const drawingTag = drawingRelId ? `<drawing r:id="${drawingRelId}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rowsXml}</sheetData>${drawingTag}</worksheet>`;
}

function contentTypesXml(sheetCount: number, hasChart: boolean): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  const chartOverrides = hasChart
    ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}${chartOverrides}</Types>`;
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

function chartXml(chart: ChartDef): string {
  const c = escapeXml;
  // Element order inside <c:ser> is schema-enforced (idx, order, tx, marker, cat, val, smooth for
  // a line series) — Excel validates this strictly and shows a repair prompt if it's wrong.
  const seriesXml = chart.series
    .map((s, i) => `
      <c:ser>
        <c:idx val="${i}"/><c:order val="${i}"/>
        <c:tx><c:v>${c(s.name)}</c:v></c:tx>
        ${chart.type === 'line' ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : ''}
        <c:cat><c:strRef><c:f>${c(chart.categoryRange)}</c:f></c:strRef></c:cat>
        <c:val><c:numRef><c:f>${c(s.valueRange)}</c:f></c:numRef></c:val>
        ${chart.type === 'line' ? '<c:smooth val="0"/>' : ''}
      </c:ser>`)
    .join('');

  const chartTag = chart.type === 'line' ? 'lineChart' : 'barChart';
  const chartBody = chart.type === 'line'
    ? `<c:${chartTag}><c:grouping val="standard"/>${seriesXml}<c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:${chartTag}>`
    : `<c:${chartTag}><c:barDir val="col"/><c:grouping val="clustered"/>${seriesXml}<c:axId val="1"/><c:axId val="2"/></c:${chartTag}>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${c(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      ${chartBody}
      <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx>
      <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml(anchorRow: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchorRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchorRow + 18}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function drawingRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`;
}

function sheetRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
}

export function buildWorkbook(sheets: SheetDef[]): Uint8Array {
  const enc = new TextEncoder();
  const chartSheetIdx = sheets.findIndex((s) => s.chart);
  const hasChart = chartSheetIdx !== -1;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': enc.encode(contentTypesXml(sheets.length, hasChart)),
    '_rels/.rels': enc.encode(rootRelsXml()),
    'xl/workbook.xml': enc.encode(workbookXml(sheets)),
    'xl/_rels/workbook.xml.rels': enc.encode(workbookRelsXml(sheets.length)),
  };

  sheets.forEach((s, i) => {
    const drawingRelId = hasChart && i === chartSheetIdx ? 'rId1' : null;
    files[`xl/worksheets/sheet${i + 1}.xml`] = enc.encode(sheetXml(s.rows, drawingRelId));
  });

  if (hasChart) {
    const chart = sheets[chartSheetIdx].chart!;
    files[`xl/worksheets/_rels/sheet${chartSheetIdx + 1}.xml.rels`] = enc.encode(sheetRelsXml());
    files['xl/drawings/drawing1.xml'] = enc.encode(drawingXml(chart.anchorRow ?? 2));
    files['xl/drawings/_rels/drawing1.xml.rels'] = enc.encode(drawingRelsXml());
    files['xl/charts/chart1.xml'] = enc.encode(chartXml(chart));
  }

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
