<template>
  <div class="grid">
    <div class="text-center">
      <div class="flex content-center">
        <select v-model="idx" class="w-full my-1 font-sans rounded">
          <option value="0">Agsamosam, George</option>
          <option value="1">De Leon, Dennis</option>
          <option value="2">Sibayan, Rodel</option>
          <option value="3">Villaflores, Rodelio</option>
        </select>
        <button @click.stop="goToDateToday"
          class="px-1 ml-1 text-sm text-white uppercase rounded-md shadow bg-sky-500">Today</button>
      </div>
    </div>
    <div class="w-full mx-auto text-center">
      <VCalendar ref="calendar" borderless transparent isDark class="w-full" @did-move="didMove" @dayfocusin="dayclick"
        :attributes="attributes" />
    </div>
    <div v-if="scheds" class="p-3 mt-2 font-sans text-center text-white bg-gray-600 rounded-lg">
      <span class="font-bold">{{ selectedDate }}</span>
      <div class="mb-3" v-for="sched in scheds" :key="sched.name">

        <div :class="{
          'bg-red-500': sched.sched === '0',
          'bg-sky-500': sched.sched === '4',
          'bg-yellow-500': sched.sched === '13',
          'bg-purple-500': sched.sched === '39',
          'bg-orange-500': sched.sched === '13*'
        }" class="px-2 py-1 my-1 bg-gray-200 rounded-full">

          <p class="leading-none">
            <span class="text-xs">{{ convertCodeToLabel(sched.sched) }}</span><br />
            <span class="text-sm font-bold">{{ sched.name }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
  <div class="absolute bottom-0 left-0 w-full mx-auto text-xs text-center text-white" @click.prevent="showVersion">
    v1.2</div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getSched, codeToLabel } from '@/utils.js'
const version = 1.1

const idx = ref(0)
const theDate = ref(new Date())
const scheds = ref(null)
const selectedDate = ref(null)
const calendar = ref(null)

const red = '#f87171'
const yellow = '#fde047'
const blue = '#7dd3fc'
const violet = '#c4b5fd'
const orange = '#fb923c'

const goToDateToday = () => {
  calendar.value.focusDate(new Date())
}

const convertCodeToLabel = (code) => {
  return codeToLabel[code]
}
const getMonthName = (m) => {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]
}
const getDateDay = (d) => {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]
}
const dayclick = (val) => {
  scheds.value = []
  selectedDate.value = val.ariaLabel
  const temp = [{
    name: 'Agsamosam, George',
    sched: getSched(val.date, 0)
  },
  {
    name: 'De Leon, Dennis',
    sched: getSched(val.date, 1)
  }, {
    name: 'Sibayan, Rodel',
    sched: getSched(val.date, 2)
  }, {
    name: 'Villaflores, Rodelio',
    sched: getSched(val.date, 3)
  }]
  for (let i = 0; i < temp.length; i++) {
    if (temp[i].sched === '0') scheds.value.push(temp[i])
  }
  for (let i = 0; i < temp.length; i++) {
    if (temp[i].sched === '4') scheds.value.push(temp[i])
  }
  for (let i = 0; i < temp.length; i++) {
    if (temp[i].sched === '13') scheds.value.push(temp[i])
  }
  for (let i = 0; i < temp.length; i++) {
    if (temp[i].sched === '39') scheds.value.push(temp[i])
  }
  for (let i = 0; i < temp.length; i++) {
    if (temp[i].sched === '13*') scheds.value.push(temp[i])
  }
}

const didMove = (val) => {
  theDate.value = new Date(val[0].year, val[0].month - 1)
}
const attributes = computed(() => {
  const month = theDate.value.getMonth()
  const year = theDate.value.getFullYear()
  const numDays = new Date(year, month + 1, 0).getDate()
  const s_0 = []
  const s_4 = []
  const s_13 = []
  const s_39 = []
  const s_13star = []
  for (let i = 1; i <= numDays; i++) {
    const bufferDate = new Date(year, month, i)
    const sched = getSched(bufferDate, idx.value)
    if (sched === '0') {
      s_0.push(bufferDate)
    } else if (sched === '4') {
      s_4.push(bufferDate)
    } else if (sched === '13') {
      s_13.push(bufferDate)
    } else if (sched === '13*') {
      s_13star.push(bufferDate)
    } else if (sched === '39') {
      s_39.push(bufferDate)
    }
  }
  // console.log('s_0', s_0.map(x => x.getDate()))
  // console.log('s_4', s_4.map(x => x.getDate()))
  // console.log('s_13', s_13.map(x => x.getDate()))
  // console.log('s_13star', s_13star.map(x => x.getDate()))
  // console.log('s_39', s_39.map(x => x.getDate()))
  // console.log(year, month)
  // console.log({ start: new Date(year, month, 1), end: new Date(year, month, numDays) })

  return [
    {
      dates: { start: new Date(year, month, 1), end: new Date(year, month, numDays) },
      content: {
        style: {
          fontFamily: 'Fira Code',
          fontWeight: '900',
        }
      }
    },
    {
      dot: true,
      dates: new Date(),
    },
    {
      content: {
        style: {
          color: red,
        },
      },
      dates: s_0
    },
    {
      content: {
        style: {
          color: blue,
        }
      },
      dates: s_4
    },
    {
      content: {
        style: {
          color: yellow,
        }
      },
      dates: s_13
    },
    {
      content: {
        style: {
          color: orange,
        }
      },
      dates: s_13star
    },
    {
      content: {
        style: {
          color: violet,
        },
      },
      dates: s_39
    },
  ]
})

onMounted(() => {
  const theDate = new Date()
  didMove([{
    year: theDate.getFullYear(),
    month: theDate.getMonth() + 1,
    monthComps: {
      numDays: new Date(theDate.getFullYear(), theDate.getMonth() + 1, 0).getDate()
    }
  }])
  dayclick({
    ariaLabel: `${getDateDay(theDate.getDay())}, ${getMonthName(theDate.getMonth())} ${theDate.getDate()}, ${theDate.getFullYear()}`,
    date: theDate
  })
})
console.log('import.meta.env.MODE', import.meta.env.MODE)
let count = 0
function debounce (func, delay) {
  let timeoutId;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeoutId);
    count++
    timeoutId = setTimeout(() => {
      func.apply(context, args);

    }, delay);
  };
}
const showVersion = debounce(() => {
  if (count >= 5) alert(`${import.meta.env.MODE}: ${version}`)
  else count = 0
}, 500)


</script>
