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
const starting_date = new Date(2023, 6, 10).valueOf()
const totalDays_Jul_10_2023 = Math.floor(starting_date / millisecondsPerDay)

export const getSched = (date, idx) => {
  const totalDaysFromDate = Math.floor(date.valueOf() / millisecondsPerDay)
  const daysCount = totalDaysFromDate - totalDays_Jul_10_2023
  const mod = daysCount % 56
  const offset = mod < 0 ? mod + 56 : mod
  
  return getCycles()[idx][offset]
}

export const codeToLabel = {
  '4': '6AM-2PM',
  '13': '2PM-10PM',
  '39': '10PM-6AM',
  '0': 'Day Off',
  '13*': 'Schedule OT',
}
// console.log(JSON.stringify(getCycles()[0]))
// console.log(JSON.stringify(getCycles()[1]))
// console.log(JSON.stringify(getCycles()[2]))
// console.log(JSON.stringify(getCycles()[3]))