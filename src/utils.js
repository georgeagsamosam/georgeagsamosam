// Calendar Cycle started at July 10, 2023

export const millisecondsPerDay = 1000 * 60 * 60 * 24

const AM = ['0', '4', '4', '4', '4', '0', '4',	'4', '4', '0', '0', '4', '4', '4']
const PM = ['4', '0', '13', '13', '13', '13', '0', '0', '13', '13', '13', '13', '0', '39']
const NT = ['39', '39', '0', '39', '39', '39', '0', '39', '39', '39', '39', '0', '0', '13']
const RL = ['13', '13', '39', '0', '0', '4', '13*', '13', '0', '4', '4', '39', '13*', '0']

/**
 *
 * @returns [[56], [56], [56], [56]]
 */
function getCycles () {
  const cycles = []
  const patterns = [
    [AM, PM, NT, RL],
    [PM, NT, RL, AM],
    [RL, AM, PM, NT],
    [NT, RL, AM, PM],
  ]
  for (let i = 0; i < patterns.length; i++) {
    const nestedArray = []
    for (let j = 0; j < patterns[i].length; j++) {
      nestedArray.push(patterns[i][j])
    }
    cycles.push([].concat(...nestedArray))
  }
  return cycles
}
const CYCLES = getCycles()

// Whole calendar days since the Unix epoch, counted from the date's *local*
// year/month/day. (The old code floored the raw timestamp, which is a UTC day
// and drifts by one day for "now" in zones like Manila after 8AM.)
const dayNumber = (date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / millisecondsPerDay)

const totalDays_Jul_10_2023 = dayNumber(new Date(2023, 6, 10))

export const getSched = (date, idx) => {
  const daysCount = dayNumber(date) - totalDays_Jul_10_2023
  const mod = daysCount % 56
  const offset = mod < 0 ? mod + 56 : mod

  return CYCLES[idx][offset]
}

export const codeToLabel = {
  '4': '6AM-2PM',
  '13': '2PM-10PM',
  '39': '10PM-6AM',
  '0': 'Day Off',
  '13*': 'Schedule OT',
}
