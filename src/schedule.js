// View-model helpers for the dashboard.
//
// The raw rotation (utils.js) stores one code per calendar day. The night
// shift ('39', 10PM-6AM) starts on the day it is stored but ends at 6AM on the
// NEXT day, so on that next day the person is still working from 12AM to 6AM
// even though their code may say "Day Off". Everything here is built around
// that: every day knows about the night shift carried over from yesterday.

import { getSched } from './utils.js'

export const CREW = [
  { id: 0, name: 'George Agsamosam', short: 'George', initials: 'GA' },
  { id: 1, name: 'Dennis De Leon', short: 'Dennis', initials: 'DL' },
  { id: 2, name: 'Rodel Sibayan', short: 'Rodel', initials: 'RS' },
  { id: 3, name: 'Rodelio Villaflores', short: 'Rodelio', initials: 'RV' },
]

// start/end are hours from midnight of the day the shift starts (end > 24 means
// it runs into the next day).
export const SHIFTS = {
  '4': { key: 'am', short: 'AM', title: 'Morning', range: '6AM–2PM', start: 6, end: 14 },
  '13': { key: 'pm', short: 'PM', title: 'Afternoon', range: '2PM–10PM', start: 14, end: 22 },
  '13*': { key: 'ot', short: 'OT', title: 'Overtime', range: '2PM–10PM', start: 14, end: 22 },
  '39': { key: 'nt', short: 'NT', title: 'Night', range: '10PM–6AM', start: 22, end: 30 },
  '0': { key: 'off', short: 'OFF', title: 'Day off', range: '', start: null, end: null },
}
export const NIGHT = SHIFTS['39']
export const LEGEND = ['4', '13', '39', '13*', '0'].map((code) => ({ code, ...SHIFTS[code] }))

const MS_DAY = 24 * 60 * 60 * 1000
const pad = (n) => String(n).padStart(2, '0')
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const weekdayShort = (d) => WEEKDAYS[d.getDay()].slice(0, 3)
export const monthName = (d) => MONTHS[d.getMonth()]
export const monthShort = (d) => MONTHS[d.getMonth()].slice(0, 3)
export const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Whole calendar days from a to b (DST-safe).
export const diffDays = (a, b) =>
  Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS_DAY,
  )

export const clock = (d) => {
  const h = d.getHours()
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

export const fullDate = (d) => `${WEEKDAYS[d.getDay()]}, ${monthName(d)} ${d.getDate()}`

// "today" / "tomorrow" / "yesterday" / "Mon Nov 23"
export const relativeDay = (d, today) => {
  const n = diffDays(today, d)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return `${weekdayShort(d)} ${monthShort(d)} ${d.getDate()}`
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export const duration = (ms) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * Everything about one person on one calendar day.
 *  - code/shift:   the shift that STARTS on this day
 *  - carry:        true when last night's night shift is still running (12AM-6AM)
 *  - spill:        true when this day's shift runs past midnight into tomorrow
 */
export function dayInfo(date, idx) {
  const code = getSched(date, idx)
  const carry = getSched(addDays(date, -1), idx) === '39'
  return { code, shift: SHIFTS[code], carry, spill: code === '39', works: code !== '0' }
}

// Human text lines for a day, e.g. for the timeline and the upcoming list.
export function dayLines(date, idx) {
  const { code, shift, carry, spill, works } = dayInfo(date, idx)
  const lines = []
  if (carry) {
    lines.push({ kind: 'carry', key: 'nt', text: 'Night shift until 6AM', note: 'from last night' })
  }
  if (spill) {
    lines.push({ kind: 'main', key: 'nt', text: `Night 10PM → 6AM ${weekdayShort(addDays(date, 1))}`, note: '' })
  } else if (works) {
    lines.push({ kind: 'main', key: shift.key, text: `${shift.title} ${shift.range}`, note: '' })
  } else {
    lines.push({ kind: 'main', key: 'off', text: carry ? 'Off after 6AM' : 'Day off', note: '' })
  }
  return lines
}

export function dayLabel(date, idx) {
  const lines = dayLines(date, idx)
  return `${fullDate(date)}. ` + lines.map((l) => l.text + (l.note ? ` (${l.note})` : '')).join('. ')
}

// Start/end Date objects for a shift that starts on `date`.
export function shiftWindow(date, code) {
  const s = SHIFTS[code]
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  return { start: new Date(y, m, d, s.start), end: new Date(y, m, d, s.end) }
}

/**
 * Month grid for the calendar: always 6 weeks, Sunday first, with the
 * neighbouring months' days included (flagged inMonth: false).
 */
export function monthGrid(viewMonth, idx, today) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const gridStart = addDays(first, -first.getDay())
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(gridStart, w * 7 + i)
      const info = dayInfo(date, idx)
      week.push({
        date,
        key: dateKey(date),
        day: date.getDate(),
        inMonth: date.getMonth() === first.getMonth(),
        isToday: sameDay(date, today),
        code: info.code,
        shiftKey: info.shift.key,
        short: info.shift.short,
        carry: info.carry,
        spill: info.spill,
        label: dayLabel(date, idx),
      })
    }
    weeks.push(week)
  }
  return weeks
}

/**
 * One row per crew member for the 24h timeline of `date`.
 * Segments are positioned in percent of the 24h track.
 */
export function dayTimeline(date, selectedIdx) {
  return CREW.map((person) => {
    const info = dayInfo(date, person.id)
    const segments = []
    if (info.carry) {
      segments.push({ key: 'nt', kind: 'carry', left: 0, width: (6 / 24) * 100, label: '☾ → 6A' })
    }
    if (info.works) {
      const s = info.shift
      const to = Math.min(s.end, 24)
      segments.push({
        key: s.key,
        kind: info.spill ? 'spill' : 'main',
        left: (s.start / 24) * 100,
        width: ((to - s.start) / 24) * 100,
        label: info.spill ? '☾ →' : `${s.range.replace(/AM|PM/g, (x) => x[0])}`,
      })
    }
    return {
      id: person.id,
      name: person.short,
      initial: person.initials,
      isMe: person.id === selectedIdx,
      // colour the avatar by what they're doing most of the day; a carried-over night shift counts as night
      key: info.works ? info.shift.key : info.carry ? 'nt' : 'off',
      carry: info.carry,
      segments,
      lines: dayLines(date, person.id),
    }
  })
}

/** The next `count` days (from `from`) for one person. */
export function upcomingDays(idx, from, count) {
  const today = startOfDay(from)
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i)
    return {
      date,
      key: dateKey(date),
      weekday: weekdayShort(date),
      day: date.getDate(),
      rel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : '',
      lines: dayLines(date, idx),
    }
  })
}

/**
 * Live status of one person at `now`: on shift (including a night shift that
 * started yesterday) or off, plus their next shift.
 */
export function getStatus(idx, now) {
  const today = startOfDay(now)
  const windows = []
  for (let off = -1; off <= 14; off++) {
    const date = addDays(today, off)
    const code = getSched(date, idx)
    if (code === '0') continue
    windows.push({ code, shift: SHIFTS[code], date, ...shiftWindow(date, code) })
  }
  const current = windows.find((w) => w.start <= now && now < w.end) || null
  const next = windows.find((w) => w.start > now) || null
  return { state: current ? 'on' : 'off', current, next }
}

/** Text for the "right now" card. */
export function nowCardModel(idx, now) {
  const today = startOfDay(now)
  const { state, current, next } = getStatus(idx, now)

  const nextInfo = next && {
    key: next.shift.key,
    title: next.shift.title,
    range: next.shift.range,
    when: `${cap(relativeDay(next.date, today))} · ${clock(next.start)}`,
    startsIn: duration(next.start - now),
  }

  if (current) {
    const started = startOfDay(current.start) < today
    return {
      state: 'on',
      headline: 'On shift now',
      label: 'Current shift',
      key: current.shift.key,
      title: current.shift.title,
      range: current.shift.range,
      badge: started ? 'Started yesterday 10PM' : '',
      detail: `Ends in ${duration(current.end - now)}`,
      detail2: `${clock(current.end)} ${relativeDay(startOfDay(current.end), today)}`,
      next: nextInfo,
    }
  }
  return {
    state: 'off',
    headline: 'Off duty',
    label: 'Next shift',
    key: next ? next.shift.key : 'off',
    title: next ? next.shift.title : 'No shift in the next 2 weeks',
    range: next ? next.shift.range : '',
    badge: '',
    detail: next ? `Starts in ${duration(next.start - now)}` : '',
    detail2: next ? `${cap(relativeDay(next.date, today))} · ${clock(next.start)}` : '',
    next: null,
  }
}

/** Who is on shift right now (by crew id), for the dots on the crew picker. */
export const onShiftNow = (now) => CREW.map((p) => getStatus(p.id, now).state === 'on')
