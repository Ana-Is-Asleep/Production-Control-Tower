import * as fflate from 'fflate';

// Minimal OOXML (.xlsx) writer — no new dependency, reuses the same `fflate` zip library
// xlsxUtils.ts already uses to READ .xlsx files. Adds a small fixed style palette (Emma brand
// colors, number formats, borders, frozen header rows) plus native Excel charts (bound to the
// sheet's own cell ranges, not pasted images) so exported reports look like a designed Emma
// workbook rather than a raw system extract.

export type RawValue = string | number | Date | null | undefined;

// A fixed, named style palette — resolved to concrete cellXfs entries at build time. Keeping this
// as a closed enum (rather than a free-form style object per cell) is what makes every exported
// sheet visually consistent without each report builder having to know OOXML.
export type StyleName =
  | 'title'
  | 'subtitle'
  | 'label'
  | 'kpiLabel'
  | 'kpiValue'
  | 'kpiValuePass'
  | 'kpiValueFail'
  | 'kpiValueWarn'
  | 'tableHeader'
  | 'tableCell'
  | 'tableCellAlt'
  | 'percent'
  | 'percentAlt'
  | 'integer'
  | 'integerAlt'
  | 'currency'
  | 'currencyAlt'
  | 'date'
  | 'dateAlt'
  | 'statusPass'
  | 'statusFail'
  | 'statusNeutral';

export interface StyledCell {
  value: RawValue;
  style?: StyleName;
}

export type CellValue = RawValue | StyledCell;

export interface ChartSeries {
  name: string; // literal series name (cached value only, not cell-bound — keeps this simple)
  valueRange: string; // fully-qualified formula, e.g. "'Weekly Evolution'!$C$2:$C$12"
}

export interface ChartDef {
  type: 'line' | 'bar' | 'barHorizontal';
  title: string;
  categoryRange: string; // fully-qualified formula, e.g. "'Weekly Evolution'!$A$2:$A$12"
  series: ChartSeries[];
  // Anchor cell (0-based). Charts are sized to a fixed 8-col x 15-row footprint so multiple
  // charts placed on a grid never overlap as long as callers space anchors out.
  anchorCol?: number;
  anchorRow?: number;
}

export interface SheetDef {
  name: string;
  rows: CellValue[][];
  charts?: ChartDef[];
  freezeHeaderRow?: boolean; // freeze row 1 — used on every data/table sheet
  autoFilter?: boolean; // adds a filter dropdown to the header row
  colWidths?: number[]; // approximate character widths; falls back to a sane default
  hidden?: boolean; // e.g. Chart Data support sheets
}

const CHART_WIDTH_COLS = 8;
const CHART_HEIGHT_ROWS = 15;

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

// Excel serial date: days since 1899-12-30 (Excel's epoch quirk — 1900 is treated as a leap year).
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
function toExcelSerial(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EXCEL_EPOCH_MS) / 86400000);
}

// ---------------------------------------------------------------------------
// Style palette — Emma brand colors, resolved to fixed cellXfs indices.
// ---------------------------------------------------------------------------

const COLOR = {
  navy: '403833',
  brand: 'FF8900',
  brandSoft: 'FFA236',
  canvas: 'F5F2EE',
  white: 'FFFFFF',
  muted: '7B7571',
  border: 'E9E3DF',
  pass: '15803D',
  passBg: 'DCFCE7',
  fail: 'DC2626',
  failBg: 'FEE2E2',
  warn: 'B45309',
  warnBg: 'FEF3C7',
};

interface FontDef { bold?: boolean; sz?: number; color?: string; }
interface FillDef { color: string; }
interface XfDef { fontIdx: number; fillIdx: number; borderIdx: number; numFmtId: number; align?: 'left' | 'center' | 'right'; wrap?: boolean; }

const FONTS: FontDef[] = [
  {}, // 0 default
  { bold: true, sz: 18, color: COLOR.navy }, // 1 title
  { color: COLOR.muted, sz: 10 }, // 2 subtitle
  { bold: true, color: COLOR.muted, sz: 9 }, // 3 label
  { bold: true, color: COLOR.navy, sz: 10 }, // 4 kpiLabel
  { bold: true, color: COLOR.brand, sz: 16 }, // 5 kpiValue
  { bold: true, color: COLOR.pass, sz: 16 }, // 6 kpiValuePass
  { bold: true, color: COLOR.fail, sz: 16 }, // 7 kpiValueFail
  { bold: true, color: COLOR.warn, sz: 16 }, // 8 kpiValueWarn
  { bold: true, color: COLOR.white, sz: 10 }, // 9 tableHeader
  { color: COLOR.navy, sz: 10 }, // 10 tableCell
  { bold: true, color: COLOR.pass, sz: 10 }, // 11 statusPass
  { bold: true, color: COLOR.fail, sz: 10 }, // 12 statusFail
  { color: COLOR.muted, sz: 10 }, // 13 statusNeutral
];

const FILLS: FillDef[] = [
  { color: '' }, // 0 none
  { color: COLOR.navy }, // 1 tableHeader bg
  { color: COLOR.canvas }, // 2 alt row / kpi label bg
  { color: COLOR.passBg }, // 3
  { color: COLOR.failBg }, // 4
  { color: COLOR.warnBg }, // 5
];

// numFmtId: 0 = General (built-in). Custom formats start at 164 per OOXML convention.
const NUM_FMTS: { id: number; code: string }[] = [
  { id: 164, code: '0.0%' },
  { id: 165, code: '#,##0' },
  { id: 166, code: '#,##0.00' },
  { id: 167, code: 'dd\\-mmm\\-yyyy' },
];
const FMT_PERCENT = 164;
const FMT_INTEGER = 165;
const FMT_CURRENCY = 166;
const FMT_DATE = 167;

// borderIdx: 0 = none, 1 = thin all-round gray, 2 = thin bottom only (header underline)
const BORDERS = ['none', 'thinAll', 'thinBottom'] as const;

const XF: Record<StyleName, XfDef> = {
  title: { fontIdx: 1, fillIdx: 0, borderIdx: 0, numFmtId: 0 },
  subtitle: { fontIdx: 2, fillIdx: 0, borderIdx: 0, numFmtId: 0 },
  label: { fontIdx: 3, fillIdx: 0, borderIdx: 0, numFmtId: 0 },
  kpiLabel: { fontIdx: 4, fillIdx: 2, borderIdx: 1, numFmtId: 0, align: 'left' },
  kpiValue: { fontIdx: 5, fillIdx: 2, borderIdx: 1, numFmtId: 0, align: 'left' },
  kpiValuePass: { fontIdx: 6, fillIdx: 3, borderIdx: 1, numFmtId: 0, align: 'left' },
  kpiValueFail: { fontIdx: 7, fillIdx: 4, borderIdx: 1, numFmtId: 0, align: 'left' },
  kpiValueWarn: { fontIdx: 8, fillIdx: 5, borderIdx: 1, numFmtId: 0, align: 'left' },
  tableHeader: { fontIdx: 9, fillIdx: 1, borderIdx: 1, numFmtId: 0, align: 'left' },
  tableCell: { fontIdx: 10, fillIdx: 0, borderIdx: 1, numFmtId: 0 },
  tableCellAlt: { fontIdx: 10, fillIdx: 2, borderIdx: 1, numFmtId: 0 },
  percent: { fontIdx: 10, fillIdx: 0, borderIdx: 1, numFmtId: FMT_PERCENT, align: 'right' },
  percentAlt: { fontIdx: 10, fillIdx: 2, borderIdx: 1, numFmtId: FMT_PERCENT, align: 'right' },
  integer: { fontIdx: 10, fillIdx: 0, borderIdx: 1, numFmtId: FMT_INTEGER, align: 'right' },
  integerAlt: { fontIdx: 10, fillIdx: 2, borderIdx: 1, numFmtId: FMT_INTEGER, align: 'right' },
  currency: { fontIdx: 10, fillIdx: 0, borderIdx: 1, numFmtId: FMT_CURRENCY, align: 'right' },
  currencyAlt: { fontIdx: 10, fillIdx: 2, borderIdx: 1, numFmtId: FMT_CURRENCY, align: 'right' },
  date: { fontIdx: 10, fillIdx: 0, borderIdx: 1, numFmtId: FMT_DATE },
  dateAlt: { fontIdx: 10, fillIdx: 2, borderIdx: 1, numFmtId: FMT_DATE },
  statusPass: { fontIdx: 11, fillIdx: 0, borderIdx: 1, numFmtId: 0 },
  statusFail: { fontIdx: 12, fillIdx: 0, borderIdx: 1, numFmtId: 0 },
  statusNeutral: { fontIdx: 13, fillIdx: 0, borderIdx: 1, numFmtId: 0 },
};

const STYLE_NAMES = Object.keys(XF) as StyleName[];
// cellXfs index 0 is reserved (default "Normal" style) — named styles start at 1.
const STYLE_INDEX: Record<StyleName, number> = STYLE_NAMES.reduce((acc, name, i) => {
  acc[name] = i + 1;
  return acc;
}, {} as Record<StyleName, number>);

function stylesXml(): string {
  const numFmtsXml = NUM_FMTS.map((f) => `<numFmt numFmtId="${f.id}" formatCode="${escapeXml(f.code)}"/>`).join('');
  const fontsXml = FONTS.map((f) => `<font>${f.sz ? `<sz val="${f.sz}"/>` : '<sz val="11"/>'}${f.bold ? '<b/>' : ''}${f.color ? `<color rgb="FF${f.color}"/>` : ''}<name val="Calibri"/></font>`).join('');
  const fillsXml = FILLS.map((f) => (f.color ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${f.color}"/></patternFill></fill>` : '<fill><patternFill patternType="none"/></fill>')).join('');
  const borderThin = `<left style="thin"><color rgb="FF${COLOR.border}"/></left><right style="thin"><color rgb="FF${COLOR.border}"/></right><top style="thin"><color rgb="FF${COLOR.border}"/></top><bottom style="thin"><color rgb="FF${COLOR.border}"/></bottom>`;
  const borderBottom = `<left/><right/><top/><bottom style="thin"><color rgb="FF${COLOR.border}"/></bottom>`;
  const bordersXml = `<border></border><border>${borderThin}</border><border>${borderBottom}</border>`;

  const cellXfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>']; // index 0 default
  STYLE_NAMES.forEach((name) => {
    const xf = XF[name];
    const borderId = BORDERS.indexOf(xf.borderIdx === 1 ? 'thinAll' : xf.borderIdx === 2 ? 'thinBottom' : 'none');
    const alignXml = xf.align || xf.wrap ? `<alignment${xf.align ? ` horizontal="${xf.align}"` : ''}${xf.wrap ? ' wrapText="1"' : ''} vertical="center"/>` : '';
    cellXfs.push(
      `<xf numFmtId="${xf.numFmtId}" fontId="${xf.fontIdx}" fillId="${xf.fillIdx}" borderId="${borderId}" applyFont="1" applyFill="1" applyBorder="1"${xf.numFmtId ? ' applyNumberFormat="1"' : ''}${alignXml ? ' applyAlignment="1"' : ''}>${alignXml}</xf>`
    );
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="${NUM_FMTS.length}">${numFmtsXml}</numFmts>
  <fonts count="${FONTS.length}">${fontsXml}</fonts>
  <fills count="${FILLS.length}">${fillsXml}</fills>
  <borders count="3">${bordersXml}</borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

// ---------------------------------------------------------------------------
// Sheet / cell XML
// ---------------------------------------------------------------------------

function normalizeCell(v: CellValue): StyledCell {
  if (v !== null && typeof v === 'object' && !(v instanceof Date) && 'value' in v) return v as StyledCell;
  return { value: v as RawValue };
}

function cellXml(v: CellValue, colIdx: number, rowIdx: number): string {
  const ref = `${colName(colIdx)}${rowIdx + 1}`;
  const { value, style } = normalizeCell(v);
  const s = style ? ` s="${STYLE_INDEX[style]}"` : '';

  if (value === null || value === undefined || value === '') return `<c r="${ref}"${s}/>`;
  if (value instanceof Date) return `<c r="${ref}"${s}><v>${toExcelSerial(value)}</v></c>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetViewXml(freezeHeaderRow: boolean | undefined): string {
  if (!freezeHeaderRow) return '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  return `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
}

function colsXml(widths: number[] | undefined, colCount: number): string {
  if (!widths || widths.length === 0) return '';
  const cols = Array.from({ length: colCount }, (_, i) => widths[i] ?? 14);
  return `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
}

function sheetXml(sheet: SheetDef, colCount: number, drawingRelId: string | null): string {
  const rowsXml = sheet.rows
    .map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cellXml(v, ci, ri)).join('')}</row>`)
    .join('');
  const drawingTag = drawingRelId ? `<drawing r:id="${drawingRelId}"/>` : '';
  const lastCol = colName(Math.max(0, colCount - 1));
  const autoFilterTag = sheet.autoFilter && sheet.rows.length > 0 ? `<autoFilter ref="A1:${lastCol}${sheet.rows.length}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${sheetViewXml(sheet.freezeHeaderRow)}${colsXml(sheet.colWidths, colCount)}<sheetData>${rowsXml}</sheetData>${autoFilterTag}${drawingTag}</worksheet>`;
}

function contentTypesXml(sheetCount: number, chartCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  const chartOverrides = Array.from({ length: chartCount }, (_, i) =>
    `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}${chartOverrides}</Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet';
}

function workbookXml(sheets: SheetDef[]): string {
  const sheetsXml = sheets
    .map((s, i) => `<sheet name="${escapeXml(sanitizeSheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"${s.hidden ? ' state="hidden"' : ''}/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  const stylesRel = `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}${stylesRel}</Relationships>`;
}

function chartXml(chart: ChartDef): string {
  const c = escapeXml;
  // Element order inside <c:ser> is schema-enforced (idx, order, tx, marker, cat, val, smooth for
  // a line series) — Excel validates this strictly and shows a repair prompt if it's wrong.
  const brandFill = `<c:spPr><a:solidFill><a:srgbClr val="${COLOR.brand}"/></a:solidFill></c:spPr>`;
  const seriesXml = chart.series
    .map((s, i) => `
      <c:ser>
        <c:idx val="${i}"/><c:order val="${i}"/>
        <c:tx><c:v>${c(s.name)}</c:v></c:tx>
        ${i === 0 ? brandFill : ''}
        ${chart.type === 'line' ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : ''}
        <c:cat><c:strRef><c:f>${c(chart.categoryRange)}</c:f></c:strRef></c:cat>
        <c:val><c:numRef><c:f>${c(s.valueRange)}</c:f></c:numRef></c:val>
        ${chart.type === 'line' ? '<c:smooth val="0"/>' : ''}
      </c:ser>`)
    .join('');

  const isHorizontal = chart.type === 'barHorizontal';
  const chartTag = chart.type === 'line' ? 'lineChart' : 'barChart';
  const chartBody = chart.type === 'line'
    ? `<c:${chartTag}><c:grouping val="standard"/>${seriesXml}<c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:${chartTag}>`
    : `<c:${chartTag}><c:barDir val="${isHorizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/>${seriesXml}<c:axId val="1"/><c:axId val="2"/></c:${chartTag}>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1"><a:solidFill><a:srgbClr val="${COLOR.navy}"/></a:solidFill></a:rPr><a:t>${c(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      ${chartBody}
      <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${isHorizontal ? 'l' : 'b'}"/><c:crossAx val="2"/></c:catAx>
      <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${isHorizontal ? 'b' : 'l'}"/><c:crossAx val="1"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml(charts: { chart: ChartDef; chartFileIdx: number }[]): string {
  const anchors = charts
    .map(({ chart, chartFileIdx }) => {
      const col = chart.anchorCol ?? 0;
      const row = chart.anchorRow ?? 2;
      return `
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${col + CHART_WIDTH_COLS}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + CHART_HEIGHT_ROWS}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="${chartFileIdx + 2}" name="Chart ${chartFileIdx + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${chartFileIdx + 1}"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}
</xdr:wsDr>`;
}

function drawingRelsXml(chartCount: number): string {
  const rels = Array.from({ length: chartCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${i + 1}.xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function sheetRelsXml(drawingIdx: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIdx + 1}.xml"/></Relationships>`;
}

export function buildWorkbook(sheets: SheetDef[]): Uint8Array {
  const enc = new TextEncoder();

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': new Uint8Array(), // placeholder, filled below once chart count is known
    '_rels/.rels': enc.encode(rootRelsXml()),
    'xl/workbook.xml': enc.encode(workbookXml(sheets)),
    'xl/_rels/workbook.xml.rels': enc.encode(workbookRelsXml(sheets.length)),
    'xl/styles.xml': enc.encode(stylesXml()),
  };

  let chartFileCount = 0;
  let drawingFileCount = 0;

  sheets.forEach((sheet, i) => {
    const colCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
    const charts = sheet.charts ?? [];
    let drawingRelId: string | null = null;

    if (charts.length > 0) {
      const drawingIdx = drawingFileCount++;
      drawingRelId = 'rId1';
      const chartRefs = charts.map((chart) => ({ chart, chartFileIdx: chartFileCount++ }));
      files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = enc.encode(sheetRelsXml(drawingIdx));
      files[`xl/drawings/drawing${drawingIdx + 1}.xml`] = enc.encode(drawingXml(chartRefs));
      files[`xl/drawings/_rels/drawing${drawingIdx + 1}.xml.rels`] = enc.encode(drawingRelsXml(charts.length));
      chartRefs.forEach(({ chart, chartFileIdx }) => {
        files[`xl/charts/chart${chartFileIdx + 1}.xml`] = enc.encode(chartXml(chart));
      });
    }

    files[`xl/worksheets/sheet${i + 1}.xml`] = enc.encode(sheetXml(sheet, colCount, drawingRelId));
  });

  files['[Content_Types].xml'] = enc.encode(contentTypesXml(sheets.length, chartFileCount));

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
