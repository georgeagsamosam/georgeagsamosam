<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { fullDate } from '../schedule.js'

const props = defineProps({
  // from stripModel()
  model: { type: Object, required: true },
  // "now" in hours from the start of the strip, or null when it's outside
  nowH: { type: Number, default: null },
  selectedKey: { type: String, required: true }
})
const emit = defineEmits(['select', 'pick'])

const ZOOMS = [
  { days: 3, label: '3 days' },
  { days: 7, label: 'Week' },
  { days: 14, label: '2 weeks' }
]

const scroller = ref(null)
const viewW = ref(700)
const zoom = ref(7)

const dayW = computed(() => Math.max(28, viewW.value / zoom.value))
const hourW = computed(() => dayW.value / 24)
const totalW = computed(() => dayW.value * props.model.days)
const px = (h) => h * hourW.value + 'px'
const showHours = computed(() => dayW.value >= 150)

const barLabel = (b) => {
  const w = (b.to - b.from) * hourW.value
  if (w >= 70) return `${b.short} ${b.compact}`
  if (w >= 24) return b.short
  return ''
}

// ---- scrolling ----
const scrollToHour = (h, behavior = 'smooth') => {
  const el = scroller.value
  if (!el) return
  el.scrollTo({ left: Math.max(0, h * hourW.value - el.clientWidth * 0.3), behavior })
}
const jumpNow = () => scrollToHour(props.nowH ?? 0)
const page = (dir) => scroller.value?.scrollBy({ left: dir * 7 * dayW.value, behavior: 'smooth' })

// keep the same moment centred when the zoom level or width changes
const keepCentre = async (change) => {
  const el = scroller.value
  const centre = el ? (el.scrollLeft + el.clientWidth / 2) / hourW.value : 0
  change()
  await nextTick()
  if (el) el.scrollLeft = centre * hourW.value - el.clientWidth / 2
}
const setZoom = (days) => keepCentre(() => (zoom.value = days))

// bring a picked day (e.g. from the calendar) into view when it's off-screen
watch(
  () => props.selectedKey,
  (key) => {
    const el = scroller.value
    const col = props.model.dayCols.find((d) => d.key === key)
    if (!el || !col) return
    const left = col.i * dayW.value
    if (left < el.scrollLeft || left + dayW.value > el.scrollLeft + el.clientWidth) {
      scrollToHour(col.i * 24 + 12)
    }
  }
)

// ---- drag to pan with a mouse (touch already scrolls natively) ----
let drag = null
let suppressClick = false
const onDown = (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  drag = { x: e.clientX, left: scroller.value.scrollLeft, moved: false, id: e.pointerId }
}
const onMove = (e) => {
  if (!drag) return
  const dx = e.clientX - drag.x
  if (!drag.moved && Math.abs(dx) < 5) return
  if (!drag.moved) {
    drag.moved = true
    scroller.value.setPointerCapture(drag.id)
  }
  scroller.value.scrollLeft = drag.left - dx
}
const onUp = () => {
  if (drag?.moved) suppressClick = true
  drag = null
}
const onClickCapture = (e) => {
  if (!suppressClick) return
  suppressClick = false
  e.stopPropagation()
  e.preventDefault()
}

let ro
onMounted(() => {
  const el = scroller.value
  viewW.value = el.clientWidth
  if (viewW.value < 480) zoom.value = 3
  ro = new ResizeObserver(() => {
    if (el.clientWidth !== viewW.value) keepCentre(() => (viewW.value = el.clientWidth))
  })
  ro.observe(el)
  nextTick(() => scrollToHour(props.nowH ?? 0, 'auto'))
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <section class="sd-card sd-strip">
    <div class="sd-strip__top">
      <div>
        <h2>Shift strip</h2>
        <p class="sd-sub">Everyone's shifts on one line. Drag or swipe to move, tap a day to open it.</p>
      </div>
      <div class="sd-strip__ctrls">
        <div class="sd-segctl" role="group" aria-label="Zoom">
          <button
            v-for="z in ZOOMS"
            :key="z.days"
            type="button"
            :aria-pressed="zoom === z.days"
            @click="setZoom(z.days)"
          >
            {{ z.label }}
          </button>
        </div>
        <button class="sd-icon-btn" type="button" aria-label="Back one week" @click="page(-1)">‹</button>
        <button class="sd-btn" type="button" :disabled="nowH === null" @click="jumpNow">Now</button>
        <button class="sd-icon-btn" type="button" aria-label="Forward one week" @click="page(1)">›</button>
      </div>
    </div>

    <div class="sd-strip__body">
      <!-- fixed name column -->
      <div class="sd-strip__names">
        <div class="sd-strip__corner"></div>
        <button
          v-for="r in model.rows"
          :key="r.id"
          type="button"
          class="sd-strip__name"
          :class="{ me: r.isMe }"
          :title="`Show ${r.name}'s schedule`"
          @click="emit('pick', r.id)"
        >
          <span class="sd-avatar sd-avatar--sm">{{ r.initials }}</span>
          <span class="sd-strip__nm">{{ r.name }}</span>
        </button>
        <div class="sd-strip__name sd-strip__name--gap" title="Hours with nobody on shift">
          <span class="sd-strip__nm">No one on</span>
        </div>
      </div>

      <!-- scrolling timeline -->
      <div
        ref="scroller"
        class="sd-strip__scroller"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @click.capture="onClickCapture"
      >
        <div class="sd-strip__canvas" :style="{ width: totalW + 'px', '--day': dayW + 'px' }">
          <button
            v-for="d in model.dayCols"
            :key="d.key"
            type="button"
            class="sd-strip__day"
            :class="{
              weekend: d.weekend,
              today: nowH !== null && Math.floor(nowH / 24) === d.i,
              sel: d.key === selectedKey,
              hours: showHours
            }"
            :style="{ left: d.i * dayW + 'px', width: dayW + 'px' }"
            :aria-label="fullDate(d.date)"
            :aria-pressed="d.key === selectedKey"
            @click="emit('select', d.date)"
          >
            <span class="sd-strip__month">{{ d.month }}</span>
            <span class="sd-strip__dlabel">
              <b>{{ dayW >= 56 ? d.weekday : d.weekday[0] }}</b> {{ d.day }}
            </span>
            <span v-if="showHours" class="sd-strip__hrs" aria-hidden="true">
              <i style="left: 25%">6A</i><i style="left: 50%">12P</i><i style="left: 75%">6P</i>
            </span>
          </button>

          <div class="sd-strip__lanes">
            <div v-for="r in model.rows" :key="r.id" class="sd-strip__lane" :class="{ me: r.isMe }">
              <button
                v-for="(b, i) in r.bars"
                :key="i"
                type="button"
                class="sd-strip__bar"
                :class="['k-' + b.key, { cl: b.clippedLeft, cr: b.clippedRight }]"
                :style="{ left: px(b.from), width: px(b.to - b.from) }"
                :title="b.title"
                :aria-label="b.title"
                @click="emit('select', b.date)"
              >
                {{ barLabel(b) }}
              </button>
            </div>
            <div class="sd-strip__lane sd-strip__lane--gap">
              <span
                v-for="(g, i) in model.gaps"
                :key="i"
                class="sd-strip__gap"
                :style="{ left: px(g.from), width: px(g.to - g.from) }"
                :title="`No one on shift for ${g.to - g.from}h`"
              ></span>
            </div>
          </div>

          <div v-if="nowH !== null" class="sd-strip__now" :style="{ left: px(nowH) }">
            <span>Now</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
