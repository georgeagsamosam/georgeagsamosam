// Minimal, dependency-free .xlsx writer. It covers what a printable schedule
// needs: shared strings, numbers, cell styles (font, fill, border, alignment,
// number format), merged cells, column widths, row heights, frozen panes,
// autofilter and print setup. Output is an uncompressed ZIP, which Excel,
// Google Sheets and LibreOffice all open.

const enc = new TextEncoder()
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** 0-based column index -> letters (0 -> A, 26 -> AA). */
export function colName(c) {
  let s = ''
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
/** 0-based row/col -> "B3". */
export const ref = (r, c) => `${colName(c)}${r + 1}`

/** Excel date serial for a local calendar date (days since 1899-12-30). */
export const dateSerial = (d) =>
  Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000)

// ---------- zip (store only) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1980-01-01

/** files: [{ name, data: Uint8Array }] -> zip bytes */
export function zip(files) {
  const chunks = []
  const central = []
  let offset = 0
  for (const { name, data } of files) {
    const nameBytes = enc.encode(name)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // stored
    local.setUint16(10, 0, true)
    local.setUint16(12, DOS_DATE, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    chunks.push(new Uint8Array(local.buffer), nameBytes, data)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true)
    cd.setUint16(12, 0, true)
    cd.setUint16(14, DOS_DATE, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, data.length, true)
    cd.setUint32(24, data.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), nameBytes)

    offset += 30 + nameBytes.length + data.length
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)

  const all = [...chunks, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0))
  let p = 0
  for (const b of all) {
    out.set(b, p)
    p += b.length
  }
  return out
}

// ---------- styles ----------

/**
 * Style spec (all optional):
 *  { bold, italic, size, color: 'RRGGBB', fill: 'RRGGBB', border: 'RRGGBB',
 *    align: 'left'|'center'|'right', valign, wrap, numFmt: 'mmm d, yyyy' }
 */
class Styles {
  constructor() {
    this.fonts = ['<font><sz val="10"/><name val="Arial"/></font>']
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>']
    this.numFmts = []
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
    this.cache = new Map()
  }

  static idx(list, xml) {
    const i = list.indexOf(xml)
    if (i >= 0) return i
    list.push(xml)
    return list.length - 1
  }

  get(spec = {}) {
    const key = JSON.stringify(spec)
    if (this.cache.has(key)) return this.cache.get(key)

    const font = Styles.idx(
      this.fonts,
      `<font>${spec.bold ? '<b/>' : ''}${spec.italic ? '<i/>' : ''}<sz val="${spec.size || 10}"/>` +
        `${spec.color ? `<color rgb="FF${spec.color}"/>` : ''}<name val="Arial"/></font>`,
    )
    const fill = spec.fill
      ? Styles.idx(
          this.fills,
          `<fill><patternFill patternType="solid"><fgColor rgb="FF${spec.fill}"/><bgColor indexed="64"/></patternFill></fill>`,
        )
      : 0
    // spec.edges = { left: { style: 'medium', color: 'RRGGBB' }, top: ... } overrides single sides
    const side = (n) => {
      const e = spec.edges?.[n]
      if (e) return `<${n} style="${e.style || 'medium'}"><color rgb="FF${e.color}"/></${n}>`
      return spec.border ? `<${n} style="thin"><color rgb="FF${spec.border}"/></${n}>` : `<${n}/>`
    }
    const border = Styles.idx(
      this.borders,
      `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`,
    )
    let numFmt = 0
    if (spec.numFmt) {
      let i = this.numFmts.indexOf(spec.numFmt)
      if (i < 0) i = this.numFmts.push(spec.numFmt) - 1
      numFmt = 164 + i
    }
    const align =
      spec.align || spec.valign || spec.wrap
        ? `<alignment${spec.align ? ` horizontal="${spec.align}"` : ''} vertical="${spec.valign || 'center'}"${spec.wrap ? ' wrapText="1"' : ''}/>`
        : ''
    const xf =
      `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"` +
      ` applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`
    const id = Styles.idx(this.xfs, xf)
    this.cache.set(key, id)
    return id
  }

  xml() {
    const list = (tag, items) => `<${tag} count="${items.length}">${items.join('')}</${tag}>`
    const numFmts = this.numFmts.length
      ? list('numFmts', this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`))
      : ''
    return (
      XML +
      `<styleSheet xmlns="${NS_MAIN}">${numFmts}${list('fonts', this.fonts)}${list('fills', this.fills)}` +
      `${list('borders', this.borders)}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `${list('cellXfs', this.xfs)}<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    )
  }
}

// ---------- workbook ----------

class Sheet {
  constructor(wb, name) {
    this.wb = wb
    this.name = name
    this.rows = new Map() // r -> Map(c -> { v, s })
    this.heights = new Map()
    this.cols = [] // { c, width }
    this.merges = []
    this.freeze = null // { rows, cols }
    this.filter = null // "A1:F366"
    // { landscape, fitWidth, onePage (fit width AND height), breaks: [row index after which to break],
    //   titleRows: [from, to], footer }
    this.print = {}
  }

  /** value: string | number | null; style: spec object */
  set(r, c, value, style) {
    if (!this.rows.has(r)) this.rows.set(r, new Map())
    this.rows.get(r).set(c, { v: value, s: style ? this.wb.styles.get(style) : 0 })
    return this
  }
  merge(r1, c1, r2, c2) {
    this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`)
    return this
  }
  width(c, width) {
    this.cols.push({ c, width })
    return this
  }
  height(r, pt) {
    this.heights.set(r, pt)
    return this
  }

  xml() {
    const { freeze, print } = this
    const rowIds = [...new Set([...this.rows.keys(), ...this.heights.keys()])].sort((a, b) => a - b)

    let maxR = 0
    let maxC = 0
    const sheetData = rowIds
      .map((r) => {
        const cells = [...(this.rows.get(r) || new Map()).entries()].sort((a, b) => a[0] - b[0])
        const ht = this.heights.has(r) ? ` ht="${this.heights.get(r)}" customHeight="1"` : ''
        maxR = Math.max(maxR, r)
        const body = cells
          .map(([c, { v, s }]) => {
            maxC = Math.max(maxC, c)
            const at = `r="${ref(r, c)}"${s ? ` s="${s}"` : ''}`
            if (v === null || v === undefined || v === '') return `<c ${at}/>`
            if (typeof v === 'number') return `<c ${at}><v>${v}</v></c>`
            return `<c ${at} t="s"><v>${this.wb.str(v)}</v></c>`
          })
          .join('')
        return `<row r="${r + 1}"${ht}>${body}</row>`
      })
      .join('')

    let pane = ''
    if (freeze && (freeze.rows || freeze.cols)) {
      const active = freeze.rows && freeze.cols ? 'bottomRight' : freeze.rows ? 'bottomLeft' : 'topRight'
      pane =
        `<pane${freeze.cols ? ` xSplit="${freeze.cols}"` : ''}${freeze.rows ? ` ySplit="${freeze.rows}"` : ''}` +
        ` topLeftCell="${ref(freeze.rows || 0, freeze.cols || 0)}" activePane="${active}" state="frozen"/>` +
        `<selection pane="${active}"/>`
    }
    const first = this.wb.sheets[0] === this ? ' tabSelected="1"' : ''
    const cols = this.cols.length
      ? `<cols>${[...this.cols]
          .sort((a, b) => a.c - b.c)
          .map(({ c, width }) => `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`)
          .join('')}</cols>`
      : ''
    const merges = this.merges.length
      ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : ''
    const footer = print.footer ? `<headerFooter><oddFooter>${esc(print.footer)}</oddFooter></headerFooter>` : ''
    const breaks = print.breaks?.length
      ? `<rowBreaks count="${print.breaks.length}" manualBreakCount="${print.breaks.length}">` +
        print.breaks.map((r) => `<brk id="${r + 1}" max="16383" man="1"/>`).join('') +
        '</rowBreaks>'
      : ''

    return (
      XML +
      `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      (print.fitWidth ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '') +
      `<dimension ref="A1:${ref(maxR, maxC)}"/>` +
      `<sheetViews><sheetView workbookViewId="0"${first}>${pane}</sheetView></sheetViews>` +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      cols +
      `<sheetData>${sheetData}</sheetData>` +
      (this.filter ? `<autoFilter ref="${this.filter}"/>` : '') +
      merges +
      '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>' +
      `<pageSetup orientation="${print.landscape ? 'landscape' : 'portrait'}"` +
      (print.fitWidth ? ` fitToWidth="1" fitToHeight="${print.onePage ? 1 : 0}"` : '') +
      '/>' +
      footer +
      breaks +
      '</worksheet>'
    )
  }
}

export class Workbook {
  constructor() {
    this.styles = new Styles()
    this.sheets = []
    this.strings = []
    this.stringIdx = new Map()
  }

  addSheet(name) {
    const sheet = new Sheet(this, name)
    this.sheets.push(sheet)
    return sheet
  }

  str(s) {
    s = String(s)
    if (!this.stringIdx.has(s)) {
      this.stringIdx.set(s, this.strings.length)
      this.strings.push(s)
    }
    return this.stringIdx.get(s)
  }

  /** -> Uint8Array of the .xlsx file */
  toBytes() {
    const n = this.sheets.length
    const quoted = (s) => `'${s.name.replace(/'/g, "''")}'`
    // worksheets first so every string is registered before sharedStrings is written
    const sheetXml = this.sheets.map((s) => s.xml())

    const defined = []
    this.sheets.forEach((s, i) => {
      if (s.print.titleRows) {
        const [a, b] = s.print.titleRows
        defined.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${esc(quoted(s))}!$${a + 1}:$${b + 1}</definedName>`)
      }
      if (s.filter) {
        const abs = s.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')
        defined.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(quoted(s))}!${abs}</definedName>`)
      }
    })

    const workbook =
      XML +
      `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
      this.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets>' +
      (defined.length ? `<definedNames>${defined.join('')}</definedNames>` : '') +
      '</workbook>'

    const rel = (id, type, target) => `<Relationship Id="${id}" Type="${NS_REL}/${type}" Target="${target}"/>`
    const workbookRels =
      XML +
      `<Relationships xmlns="${NS_PKG}">` +
      this.sheets.map((_, i) => rel(`rId${i + 1}`, 'worksheet', `worksheets/sheet${i + 1}.xml`)).join('') +
      rel(`rId${n + 1}`, 'styles', 'styles.xml') +
      rel(`rId${n + 2}`, 'sharedStrings', 'sharedStrings.xml') +
      '</Relationships>'

    const ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml'
    const contentTypes =
      XML +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      `<Override PartName="/xl/workbook.xml" ContentType="${ct}.sheet.main+xml"/>` +
      this.sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${ct}.worksheet+xml"/>`)
        .join('') +
      `<Override PartName="/xl/styles.xml" ContentType="${ct}.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="${ct}.sharedStrings+xml"/>` +
      '</Types>'

    const rootRels =
      XML +
      `<Relationships xmlns="${NS_PKG}">${rel('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`

    const shared =
      XML +
      `<sst xmlns="${NS_MAIN}" count="${this.strings.length}" uniqueCount="${this.strings.length}">` +
      this.strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('') +
      '</sst>'

    const file = (name, text) => ({ name, data: enc.encode(text) })
    return zip([
      file('[Content_Types].xml', contentTypes),
      file('_rels/.rels', rootRels),
      file('xl/workbook.xml', workbook),
      file('xl/_rels/workbook.xml.rels', workbookRels),
      file('xl/styles.xml', this.styles.xml()),
      file('xl/sharedStrings.xml', shared),
      ...sheetXml.map((x, i) => file(`xl/worksheets/sheet${i + 1}.xml`, x)),
    ])
  }
}
