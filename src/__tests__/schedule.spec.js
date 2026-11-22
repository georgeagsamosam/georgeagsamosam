import { describe, it, expect } from 'vitest'
import { getSched } from '../utils.js'
import {
  CREW, addDays, dayInfo, getStatus, nowCardModel, dayTimeline, dutyBoard, stripModel, hoursFrom
} from '../schedule.js'

// Find the first date where `idx` starts a night shift that is followed by a
// day whose own code is "Day Off" (the confusing case: off on paper, but still
// working 12AM-6AM).
function findNightThenOff(idx) {
  for (let i = 0; i < 112; i++) {
    const d = addDays(new Date(2026, 10, 1), i)
    if (getSched(d, idx) === '39' && getSched(addDays(d, 1), idx) === '0') return d
  }
  throw new Error('no night->off day found')
}

describe('rotation', () => {
  it('repeats every 56 days and matches the known start', () => {
    const start = new Date(2023, 6, 10)
    expect(getSched(start, 0)).toBe('0')
    expect(getSched(start, 1)).toBe('4')
    expect(getSched(addDays(start, 56), 0)).toBe(getSched(start, 0))
    expect(getSched(addDays(start, -56), 2)).toBe(getSched(start, 2))
  })

  it('does not depend on the time of day', () => {
    const midnight = new Date(2026, 10, 22, 0, 0)
    const evening = new Date(2026, 10, 22, 23, 59)
    for (let i = 0; i < 4; i++) expect(getSched(evening, i)).toBe(getSched(midnight, i))
  })
})

describe('overnight shift', () => {
  it('flags the day after a night shift as carry-over, even when it is a day off', () => {
    const night = findNightThenOff(0)
    const next = addDays(night, 1)
    expect(dayInfo(night, 0).spill).toBe(true)
    expect(dayInfo(next, 0).code).toBe('0')
    expect(dayInfo(next, 0).carry).toBe(true)
  })

  it('is "on shift" at 3AM on the carry-over day and "off" after 6AM', () => {
    const next = addDays(findNightThenOff(0), 1)
    const at3 = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 3)
    const at7 = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 7)
    const on = nowCardModel(0, at3)
    expect(on.state).toBe('on')
    expect(on.key).toBe('nt')
    expect(on.badge).toBe('Started yesterday 10PM')
    expect(on.detail).toBe('Ends in 3h 0m')
    expect(nowCardModel(0, at7).state).toBe('off')
  })

  it('draws a 12AM-6AM segment on the carry-over day and a 10PM-12AM segment on the start day', () => {
    const night = findNightThenOff(0)
    const row = (d) => dayTimeline(d, 0)[0]
    const carry = row(addDays(night, 1)).segments
    expect(carry).toHaveLength(1)
    expect(carry[0]).toMatchObject({ kind: 'carry', left: 0, width: 25 })
    const start = row(night).segments.find((s) => s.kind === 'spill')
    expect(start.left).toBeCloseTo((22 / 24) * 100)
    expect(start.left + start.width).toBeCloseTo(100)
  })

  it('reports the shift end on the following day', () => {
    const night = findNightThenOff(0)
    const at23 = new Date(night.getFullYear(), night.getMonth(), night.getDate(), 23)
    const { current } = getStatus(0, at23)
    expect(current.end.getDate()).toBe(addDays(night, 1).getDate())
    expect(current.end.getHours()).toBe(6)
  })
})

describe('on duty board', () => {
  it('splits the crew into on now / up next / off, covering everyone once', () => {
    for (let h = 0; h < 56 * 24; h += 5) {
      const t = new Date(2026, 10, 1, h, 17)
      const b = dutyBoard(t)
      const ids = [...b.on, ...b.upNext, ...b.rest, ...b.idle].map((p) => p.id).sort()
      expect(ids).toEqual(CREW.map((p) => p.id))
      expect(b.gap).toBe(b.on.length === 0)
      for (const p of b.on) {
        expect(getStatus(p.id, t).state).toBe('on')
        expect(p.progress).toBeGreaterThanOrEqual(0)
        expect(p.progress).toBeLessThanOrEqual(100)
      }
      expect(b.upNext.length).toBeGreaterThan(0)
    }
  })

  it('shows the night worker on at 3AM the day after a night shift', () => {
    const next = addDays(findNightThenOff(0), 1)
    const b = dutyBoard(new Date(next.getFullYear(), next.getMonth(), next.getDate(), 3))
    const me = b.on.find((p) => p.id === 0)
    expect(me).toMatchObject({ key: 'nt', endsIn: '3h 0m', progress: 62.5 })
  })
})

describe('shift strip', () => {
  it('draws a night shift as one bar across midnight', () => {
    const night = findNightThenOff(0)
    const m = stripModel(addDays(night, -2), 10, 0)
    const bar = m.rows[0].bars.find((b) => b.from === 2 * 24 + 22)
    expect(bar).toMatchObject({ key: 'nt', to: 3 * 24 + 6, clippedLeft: false, clippedRight: false })
  })

  it('clips a night shift carried in from the day before the strip', () => {
    const night = findNightThenOff(0)
    const m = stripModel(addDays(night, 1), 3, 0)
    expect(m.rows[0].bars[0]).toMatchObject({ key: 'nt', from: 0, to: 6, clippedLeft: true })
  })

  it('reports hours with nobody on shift as gaps', () => {
    const m = stripModel(new Date(2026, 10, 1), 56, 0)
    const gapHours = m.gaps.reduce((n, g) => n + g.to - g.from, 0)
    const busy = new Set()
    for (const r of m.rows) for (const b of r.bars) for (let h = b.from; h < b.to; h++) busy.add(h)
    expect(gapHours).toBe(m.hours - busy.size)
    for (const g of m.gaps) expect(busy.has(g.from)).toBe(false)
  })

  it('positions now in hours from the strip start', () => {
    expect(hoursFrom(new Date(2026, 10, 20), new Date(2026, 10, 23, 13, 30))).toBe(3 * 24 + 13.5)
  })
})
