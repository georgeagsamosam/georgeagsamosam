<script setup>
defineProps({
  title: { type: String, required: true },
  isToday: { type: Boolean, default: false },
  // percent position of "now" on the 24h track, or null when the day isn't today
  nowPct: { type: Number, default: null },
  rows: { type: Array, required: true },
})
defineEmits(['pick'])

const SCALE = [
  { label: '12A', left: 0 },
  { label: '6A', left: 25 },
  { label: '12P', left: 50 },
  { label: '6P', left: 75 },
  { label: '12A', left: 100 },
]
</script>

<template>
  <section class="sd-card sd-tl">
    <div class="sd-tl__head">
      <div>
        <h2>{{ title }}</h2>
        <p class="sd-sub">Who is on duty, hour by hour</p>
      </div>
      <span v-if="isToday" class="sd-badge">Today</span>
    </div>

    <div class="sd-tl__scale" aria-hidden="true">
      <span v-for="(s, i) in SCALE" :key="i" :style="{ left: s.left + '%' }">{{ s.label }}</span>
    </div>

    <div v-for="r in rows" :key="r.id" class="sd-tl__row" :class="{ me: r.isMe }">
      <div class="sd-tl__who">
        <span class="sd-avatar" :class="'k-' + r.key">{{ r.initial }}</span>
        <span class="sd-tl__name">{{ r.name }}</span>
        <span class="sd-tl__lines">
          <span v-for="(l, i) in r.lines" :key="i" class="sd-line" :class="'k-' + l.key">
            {{ l.text }} <em v-if="l.note">({{ l.note }})</em>
          </span>
        </span>
      </div>
      <div class="sd-tl__track" aria-hidden="true">
        <div
          v-for="(s, i) in r.segments"
          :key="i"
          class="sd-seg"
          :class="['k-' + s.key, s.kind]"
          :style="{ left: s.left + '%', width: s.width + '%' }"
        >{{ s.label }}</div>
        <i v-if="nowPct !== null" class="sd-tl__now" :style="{ left: nowPct + '%' }"></i>
      </div>
    </div>
  </section>
</template>
