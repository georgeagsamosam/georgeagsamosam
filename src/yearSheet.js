// Whole-year schedule as a spreadsheet (.xlsx) for Google Sheets, Excel or
// printing.
//  - One tab per month, split into the two pay cut-offs (1-15 and 16-end).
//    Each tab prints on exactly one landscape page, so a month is never split
//    across pages, in Excel or in Google Sheets.
//  - "Daily": one row per date with every crew member's shift and, beside it,
//    who is on each shift (AM / PM / NT / off). Filterable,
//    with a page break before each month.
// Weeks run Sunday to Saturday (like the dashboard calendar). Sundays are red
// and each week starts with a heavier divider line.

import { CREW, LEGEND, MONTHS, WEEKDAY_HEADERS, addDays, dayInfo } from './schedule.js'
import { Workbook, XLSX_MIME, colName, dateSerial } from './xlsx.js'

// Print-friendly versions of the dashboard's shift colours (light fill, dark text).
export const SHEET_COLORS = {
  am: { fill: 'DBEEFB', text: '075985' },
  pm: { fill: 'FEF3C7', text: '92400E' },
  nt: { fill: 'EDE9FE', text: '5B21B6' },
  ot: { fill: 'FFEDD5', text: '9A3412' },
  off: { fill: 'FDECEC', text: 'B91C1C' },
}

export const CUTOFFS = [
  [1, 15],
  [16, 31],
]
const SLOTS = 16 // widest cut-off (16-31)

const daysInMonth = (year, m) => new Date(year, m + 1, 0).getDate()

const dayMeta = (date) => ({
  date,
  day: date.getDate(),
  weekday: WEEKDAY_HEADERS[date.getDay()],
  sunday: date.getDay() === 0,
  saturday: date.getDay() === 6,
})

/** Month-by-month roster for `year`, each month split into its two cut-offs. */
export function yearRoster(year) {
  return MONTHS.map((name, m) => {
    const last = daysInMonth(year, m)
    const cutoffs = CUTOFFS.map(([from, max], n) => {
      const to = Math.min(max, last)
      const days = Array.from({ length: to - from + 1 }, (_, i) => dayMeta(new Date(year, m, from + i)))
      const crew = CREW.map((p) => {
        const cells = days.map(({ date }) => {
          const info = dayInfo(date, p.id)
          return { code: info.code, key: info.shift.key, short: info.shift.short, carry: info.carry }
        })
        const count = (fn) => cells.filter(fn).length
        return {
          id: p.id,
          name: p.short,
          cells,
          workDays: count((c) => c.code !== '0'),
          nights: count((c) => c.code === '39'),
          overtime: count((c) => c.code === '13*'),
        }
      })
      return { n: n + 1, label: `${name.slice(0, 3)} ${from}–${to}`, from, to, days, crew }
    })
    return { name, month: m, cutoffs }
  })
}

// "AM 6AM–2PM", "OFF", or "OFF (NT until 6AM)" when last night's shift runs into the day off.
export function dailyText(info) {
  const s = info.shift
  if (info.works) return `${s.short} ${s.range}`
  return info.carry ? 'OFF (NT until 6AM)' : 'OFF'
}

// Columns of the "who's on" table beside the daily list. OT runs 2PM-10PM, so
// it shares the PM column (marked "(OT)").
export const SHIFT_COLUMNS = [
  { key: 'am', title: 'AM 6AM–2PM', codes: ['4'] },
  { key: 'pm', title: 'PM 2PM–10PM', codes: ['13', '13*'] },
  { key: 'nt', title: 'NT 10PM–6AM', codes: ['39'] },
  { key: 'off', title: 'Day off', codes: ['0'] },
]

/** One row per date of `year`. */
export function yearDaily(year) {
  const rows = []
  for (let date = new Date(year, 0, 1); date.getFullYear() === year; date = addDays(date, 1)) {
    const infos = CREW.map((p) => dayInfo(date, p.id))
    rows.push({
      ...dayMeta(date),
      cells: infos.map((info) => ({ key: info.shift.key, text: dailyText(info) })),
      // names per shift column, e.g. ['Rodel', 'Dennis, Rodelio (OT)', 'George', '']
      byShift: SHIFT_COLUMNS.map((col) =>
        CREW.filter((p) => col.codes.includes(infos[p.id].code))
          .map((p) => p.short + (infos[p.id].code === '13*' ? ' (OT)' : ''))
          .join(', '),
      ),
    })
  }
  return rows
}

// ---------- styling ----------

const GRID = 'CBD5E1'
const INK = '0F172A'
const MUTED = '64748B'
const HEAD = '1E293B'
const SUN_RED = 'DC2626'
const SUN_TEXT = 'B91C1C'
const SUN_FILL = 'FEE2E2'
const SAT_FILL = 'E2E8F0'
const WEEK_LINE = { style: 'medium', color: '334155' }

const headStyle = { bold: true, fill: HEAD, color: 'FFFFFF', border: HEAD, align: 'center' }
const shiftStyle = (key, extra) => ({
  fill: SHEET_COLORS[key].fill,
  color: SHEET_COLORS[key].text,
  bold: true,
  border: GRID,
  align: 'center',
  ...extra,
})
// heavier line on the left of every Sunday column = start of a new week
const weekEdge = (day) => (day?.sunday ? { edges: { left: WEEK_LINE } } : {})

// ---------- month tabs ----------

const COL_TOTALS = 1 + SLOTS // Days, Night, OT
const LAST_COL = COL_TOTALS + 2
const BLOCK_FIRST = 4 // first cut-off block starts on this row (0-based)
const BLOCK = 2 + CREW.length + 1 // header + weekday row + crew rows + spacer

function addMonthSheet(wb, year, month) {
  const ws = wb.addSheet(month.name)

  ws.width(0, 13)
  for (let c = 1; c <= SLOTS; c++) ws.width(c, 6.4)
  for (let c = COL_TOTALS; c <= LAST_COL; c++) ws.width(c, 7)

  ws.set(0, 0, `${month.name} ${year}`, { bold: true, size: 16, color: INK }).height(0, 28)
  ws.set(0, 6, 'Shift Schedule', { bold: true, size: 11, color: MUTED, align: 'right' })
  ws.merge(0, 0, 0, 5).merge(0, 6, 0, LAST_COL)

  // legend: one coloured box per shift, 3 day-columns wide each
  ws.set(1, 0, 'Legend', { bold: true, color: MUTED })
  LEGEND.forEach((s, i) => {
    const c = 1 + i * 3
    const text = s.key === 'off' ? 'OFF  Day off' : s.key === 'ot' ? `OT  ${s.range} overtime` : `${s.short}  ${s.range}`
    for (let k = 0; k < 3; k++) ws.set(1, c + k, k ? null : text, shiftStyle(s.key, { size: 9 }))
    ws.merge(1, c, 1, c + 2)
  })
  ws.set(1, 16, 'Sun', { bold: true, size: 9, fill: SUN_FILL, color: SUN_TEXT, border: GRID, align: 'center' })
  ws.set(1, 17, '= Sunday, new week', { italic: true, size: 9, color: MUTED })
  ws.merge(1, 17, 1, LAST_COL)
  ws.height(1, 20)
  ws.set(2, 0, 'NT (night) starts at 10PM and finishes at 6AM the next morning.', { italic: true, size: 9, color: MUTED })
  ws.merge(2, 0, 2, LAST_COL)
  ws.height(3, 8)

  month.cutoffs.forEach((cut, i) => {
    const r = BLOCK_FIRST + i * BLOCK

    // header: cut-off label, day numbers (Sundays in red), totals
    ws.set(r, 0, cut.label, { ...headStyle, align: 'left' })
    ws.set(r + 1, 0, cut.n === 1 ? '1st cut-off' : '2nd cut-off', {
      italic: true, size: 8, color: MUTED, fill: 'F1F5F9', border: GRID,
    })
    for (let s = 0; s < SLOTS; s++) {
      const day = cut.days[s]
      const c = 1 + s
      ws.set(r, c, day ? day.day : null, { ...headStyle, ...(day?.sunday ? { fill: SUN_RED, border: SUN_RED } : {}), ...weekEdge(day) })
      const wd = !day
        ? { fill: 'F8FAFC', border: GRID }
        : day.sunday
          ? { bold: true, fill: SUN_FILL, color: SUN_TEXT }
          : day.saturday
            ? { bold: true, fill: SAT_FILL, color: INK }
            : { fill: 'F1F5F9', color: MUTED }
      ws.set(r + 1, c, day ? day.weekday : null, { size: 9, border: GRID, align: 'center', ...wd, ...weekEdge(day) })
    }
    ;['Days', 'Night', 'OT'].forEach((t, k) => {
      ws.set(r, COL_TOTALS + k, t, { ...headStyle, size: 9 })
      ws.set(r + 1, COL_TOTALS + k, null, { fill: 'F1F5F9', border: GRID })
    })
    ws.height(r, 20).height(r + 1, 18)

    cut.crew.forEach((p, k) => {
      const row = r + 2 + k
      ws.set(row, 0, p.name, { bold: true, color: INK, border: GRID })
      for (let s = 0; s < SLOTS; s++) {
        const day = cut.days[s]
        const cell = p.cells[s]
        if (cell) ws.set(row, 1 + s, cell.short, shiftStyle(cell.key, weekEdge(day)))
        else ws.set(row, 1 + s, null, { fill: 'F8FAFC', border: GRID })
      }
      ;[p.workDays, p.nights, p.overtime].forEach((v, t) =>
        ws.set(row, COL_TOTALS + t, v, { bold: t === 0, color: t === 0 ? INK : MUTED, border: GRID, align: 'center' }),
      )
      ws.height(row, 24)
    })
    ws.height(r + BLOCK - 1, 14)
  })

  ws.print = {
    landscape: true,
    fitWidth: true,
    onePage: true,
    footer: `&LShift Schedule ${year}&R${month.name} ${year}`,
  }
}

// ---------- daily list ----------

function addDailySheet(wb, year) {
  const ws = wb.addSheet('Daily')
  const rows = yearDaily(year)

  // left table: one column per person; right table (after a gap column): one column per shift
  const gapCol = 2 + CREW.length
  const shiftCol = gapCol + 1
  const lastCol = shiftCol + SHIFT_COLUMNS.length - 1

  ws.width(0, 13).width(1, 6).width(gapCol, 2)
  ws.set(0, 0, 'Date', headStyle).set(0, 1, 'Day', headStyle)
  CREW.forEach((p, i) => {
    ws.width(2 + i, 18)
    ws.set(0, 2 + i, p.short, headStyle)
  })
  SHIFT_COLUMNS.forEach((col, i) => {
    ws.width(shiftCol + i, col.key === 'pm' || col.key === 'off' ? 19 : 14)
    ws.set(0, shiftCol + i, col.title, shiftStyle(col.key, { border: HEAD, edges: { bottom: { style: 'medium', color: HEAD } } }))
  })
  ws.height(0, 20)

  const breaks = []
  rows.forEach((row, i) => {
    const r = i + 1
    const first = row.day === 1
    if (first && i > 0) breaks.push(r - 1) // each month starts on a new printed page
    const edge = row.sunday && !first ? { edges: { top: WEEK_LINE } } : {}
    const tone = row.sunday ? { fill: SUN_FILL, color: SUN_TEXT, bold: true } : row.saturday ? { fill: SAT_FILL } : {}
    ws.set(r, 0, dateSerial(row.date), { border: GRID, numFmt: 'mmm d, yyyy', align: 'left', ...tone, ...(first ? { bold: true } : {}), ...edge })
    ws.set(r, 1, row.weekday, { border: GRID, align: 'center', color: row.saturday ? INK : MUTED, ...tone, ...edge })
    row.cells.forEach((cell, k) => ws.set(r, 2 + k, cell.text, shiftStyle(cell.key, { bold: false, ...edge })))
    row.byShift.forEach((names, k) => {
      const key = SHIFT_COLUMNS[k].key
      if (names) ws.set(r, shiftCol + k, names, shiftStyle(key, { bold: key !== 'off', align: 'left', ...edge }))
      else if (key === 'off') ws.set(r, shiftCol + k, '—', { border: GRID, color: MUTED, align: 'center', ...edge })
      // nobody covering a shift: make it stand out
      else ws.set(r, shiftCol + k, 'Nobody', { border: GRID, bold: true, fill: SUN_RED, color: 'FFFFFF', align: 'center', ...edge })
    })
  })

  ws.freeze = { rows: 1, cols: 2 }
  ws.filter = `A1:${colName(lastCol)}${rows.length + 1}`
  ws.print = {
    landscape: true,
    fitWidth: true,
    titleRows: [0, 0],
    breaks,
    footer: `&LShift Schedule ${year} – Daily&RPage &P of &N`,
  }
}

/** The whole-year workbook as .xlsx bytes. */
export function buildYearWorkbook(year) {
  const wb = new Workbook()
  yearRoster(year).forEach((month) => addMonthSheet(wb, year, month))
  addDailySheet(wb, year)
  return wb.toBytes()
}

export const yearFileName = (year) => `shift-schedule-${year}.xlsx`

/** Build the workbook and hand it to the browser as a download. */
export function downloadYearWorkbook(year) {
  const blob = new Blob([buildYearWorkbook(year)], { type: XLSX_MIME })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = yearFileName(year)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
