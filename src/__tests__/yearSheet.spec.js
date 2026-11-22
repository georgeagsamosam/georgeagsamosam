import { describe, it, expect } from 'vitest'
import { getSched } from '../utils.js'
import { CREW, addDays } from '../schedule.js'
import { colName, crc32, dateSerial } from '../xlsx.js'
import { SHIFT_COLUMNS, buildYearWorkbook, dailyText, yearDaily, yearRoster } from '../yearSheet.js'

describe('xlsx helpers', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 25, 26, 32, 701, 702].map(colName)).toEqual(['A', 'Z', 'AA', 'AG', 'ZZ', 'AAA'])
  })

  it('computes CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('converts dates to spreadsheet serials', () => {
    expect(dateSerial(new Date(1900, 0, 1))).toBe(2)
    expect(dateSerial(new Date(2026, 0, 1))).toBe(46023)
  })
})

describe('year roster', () => {
  it('splits every month into the 1-15 and 16-end cut-offs', () => {
    for (const year of [2026, 2028]) {
      const months = yearRoster(year)
      expect(months).toHaveLength(12)
      let total = 0
      for (const m of months) {
        const [a, b] = m.cutoffs
        expect([a.from, a.to, b.from]).toEqual([1, 15, 16])
        expect(b.to).toBe(new Date(year, m.month + 1, 0).getDate())
        expect(a.days).toHaveLength(15)
        total += a.days.length + b.days.length
        for (const cut of m.cutoffs) {
          expect(cut.crew.map((p) => p.id)).toEqual(CREW.map((p) => p.id))
          for (const p of cut.crew) expect(p.cells).toHaveLength(cut.days.length)
        }
      }
      expect(total).toBe(year === 2028 ? 366 : 365)
      expect(months[1].cutoffs[1].label).toBe(year === 2028 ? 'Feb 16–29' : 'Feb 16–28')
    }
  })

  it('matches the rotation, flags Sundays and counts totals per cut-off', () => {
    const cut = yearRoster(2026)[2].cutoffs[1] // Mar 16-31
    cut.days.forEach((d) => expect(d.sunday).toBe(d.date.getDay() === 0))
    expect(cut.days.find((d) => d.day === 22).sunday).toBe(true) // Mar 22, 2026 is a Sunday
    cut.crew.forEach((p) => {
      p.cells.forEach((cell, i) => expect(cell.code).toBe(getSched(new Date(2026, 2, 16 + i), p.id)))
      expect(p.workDays).toBe(p.cells.filter((c) => c.code !== '0').length)
      expect(p.nights).toBe(p.cells.filter((c) => c.code === '39').length)
      expect(p.overtime).toBe(p.cells.filter((c) => c.code === '13*').length)
    })
  })
})

describe('daily list', () => {
  it('has one row per date', () => {
    const rows = yearDaily(2026)
    expect(rows).toHaveLength(365)
    expect(rows[0].date).toEqual(new Date(2026, 0, 1))
    expect(rows[364].date).toEqual(new Date(2026, 11, 31))
  })

  it('flags a day off that starts with last night\'s shift', () => {
    let d = new Date(2026, 0, 1)
    while (!(getSched(d, 0) === '39' && getSched(addDays(d, 1), 0) === '0')) d = addDays(d, 1)
    const row = yearDaily(2026).find((r) => +r.date === +addDays(d, 1))
    expect(row.cells[0]).toEqual({ key: 'off', text: 'OFF (NT until 6AM)' })
    expect(dailyText({ works: true, carry: false, shift: { short: 'AM', range: '6AM–2PM' } })).toBe('AM 6AM–2PM')
  })
})

describe('who is on each shift', () => {
  it('lists every crew member exactly once per day under their shift', () => {
    for (const row of yearDaily(2026)) {
      const names = row.byShift.flatMap((s) => (s ? s.split(', ') : [])).map((n) => n.replace(' (OT)', ''))
      expect(names.sort()).toEqual(CREW.map((p) => p.short).sort())
      SHIFT_COLUMNS.forEach((col, k) => {
        for (const p of CREW) {
          const code = getSched(row.date, p.id)
          const listed = row.byShift[k].split(', ').some((n) => n.replace(' (OT)', '') === p.short)
          expect(listed).toBe(col.codes.includes(code))
        }
      })
    }
  })

  it('marks overtime in the PM column', () => {
    const row = yearDaily(2026).find((r) => r.byShift[1].includes('(OT)'))
    expect(row).toBeTruthy()
    const p = CREW.find((c) => row.byShift[1].includes(`${c.short} (OT)`))
    expect(getSched(row.date, p.id)).toBe('13*')
  })
})

describe('workbook file', () => {
  it('is a zip with the xlsx parts', () => {
    const bytes = buildYearWorkbook(2026)
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const text = new TextDecoder().decode(bytes)
    for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet13.xml']) {
      expect(text).toContain(part)
    }
    expect(text).toContain('<sheet name="January"')
    expect(text).toContain('<sheet name="December"')
    expect(text).toContain('<sheet name="Daily"')
    expect(text).toContain('Rodelio')
  })
})
