import { describe, it, expect } from 'vitest'
import { getSched } from '../utils.js'
import { addDays, dayInfo, getStatus, nowCardModel, dayTimeline } from '../schedule.js'

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
