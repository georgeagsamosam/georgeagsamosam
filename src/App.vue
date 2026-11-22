<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import NowCard from '@/components/NowCard.vue'
import MonthCalendar from '@/components/MonthCalendar.vue'
import DayTimeline from '@/components/DayTimeline.vue'
import UpcomingList from '@/components/UpcomingList.vue'
import {
  CREW, dateKey, dayTimeline, fullDate, monthGrid, monthName, nowCardModel,
  onShiftNow, sameDay, startOfDay, upcomingDays,
} from '@/schedule.js'

const version = '1.3'
const STORAGE_KEY = 'sd.crew'

const loadCrew = () => {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(saved) && saved >= 0 && saved < CREW.length ? saved : 0
  } catch (e) {
    return 0
  }
}

const crewIdx = ref(loadCrew())
const now = ref(new Date())
const selected = ref(startOfDay(new Date()))
const viewMonth = ref(new Date(selected.value.getFullYear(), selected.value.getMonth(), 1))

watch(crewIdx, (v) => {
  try { localStorage.setItem(STORAGE_KEY, String(v)) } catch (e) { /* private mode etc. */ }
})

// keep "now" fresh (countdowns, who's on duty, midnight rollover)
let timer
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 30 * 1000) })
onBeforeUnmount(() => clearInterval(timer))

const today = computed(() => startOfDay(now.value))
const selectedKey = computed(() => dateKey(selected.value))
const person = computed(() => CREW[crewIdx.value])

const nowModel = computed(() => nowCardModel(crewIdx.value, now.value))
const onNow = computed(() => onShiftNow(now.value))
const calTitle = computed(() => `${monthName(viewMonth.value)} ${viewMonth.value.getFullYear()}`)
const weeks = computed(() => monthGrid(viewMonth.value, crewIdx.value, today.value))
const timelineRows = computed(() => dayTimeline(selected.value, crewIdx.value))
const upcoming = computed(() => upcomingDays(crewIdx.value, now.value, 7))
const selectedIsToday = computed(() => sameDay(selected.value, now.value))
const nowPct = computed(() =>
  selectedIsToday.value ? ((now.value.getHours() * 60 + now.value.getMinutes()) / 1440) * 100 : null,
)

const selectDate = (date) => {
  selected.value = startOfDay(date)
  viewMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
}
const goToday = () => {
  now.value = new Date()
  selectDate(now.value)
}
const shiftMonth = (n) => {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + n, 1)
}

// tap the version 5 times quickly to see the build mode (same hidden check as before)
let taps = []
const showVersion = () => {
  const t = Date.now()
  taps = [...taps.filter((x) => t - x < 2000), t]
  if (taps.length >= 5) {
    taps = []
    alert(`${import.meta.env.MODE}: ${version}`)
  }
}
</script>

<template>
  <div class="sd-app">
    <header class="sd-top">
      <div>
        <h1>Shift Schedule</h1>
        <p>{{ person.name }}</p>
      </div>
      <button type="button" class="sd-btn sd-btn--primary" @click="goToday">Today</button>
    </header>

    <nav class="sd-crew" role="tablist" aria-label="Choose a person">
      <button
        v-for="p in CREW"
        :key="p.id"
        type="button"
        role="tab"
        class="sd-crew__btn"
        :aria-selected="p.id === crewIdx"
        @click="crewIdx = p.id"
      >
        <span class="sd-avatar">{{ p.initials }}</span>
        {{ p.short }}
        <span v-if="onNow[p.id]" class="sd-crew__dot" title="On shift now"></span>
      </button>
    </nav>
    <p class="sd-crew__note"><i></i> Green dot = on shift right now</p>

    <div class="sd-layout">
      <div class="sd-col">
        <NowCard :model="nowModel" />
        <MonthCalendar
          :title="calTitle"
          :weeks="weeks"
          :selected-key="selectedKey"
          @select="selectDate"
          @prev="shiftMonth(-1)"
          @next="shiftMonth(1)"
        />
      </div>
      <div class="sd-col">
        <DayTimeline :title="fullDate(selected)" :is-today="selectedIsToday" :now-pct="nowPct" :rows="timelineRows" />
        <UpcomingList :days="upcoming" :selected-key="selectedKey" @select="selectDate" />
      </div>
    </div>

    <p class="sd-foot" @click.prevent="showVersion">v{{ version }}</p>
  </div>
</template>
