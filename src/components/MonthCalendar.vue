<script setup>
import { WEEKDAY_HEADERS, LEGEND } from '../schedule.js'

defineProps({
  title: { type: String, required: true },
  weeks: { type: Array, required: true },
  selectedKey: { type: String, required: true },
})
defineEmits(['select', 'prev', 'next'])
</script>

<template>
  <section class="sd-card sd-cal">
    <div class="sd-cal__head">
      <button class="sd-icon-btn" type="button" aria-label="Previous month" @click="$emit('prev')">‹</button>
      <h2>{{ title }}</h2>
      <button class="sd-icon-btn" type="button" aria-label="Next month" @click="$emit('next')">›</button>
    </div>

    <div class="sd-cal__dow" aria-hidden="true">
      <span v-for="d in WEEKDAY_HEADERS" :key="d">{{ d }}</span>
    </div>

    <div class="sd-cal__grid">
      <template v-for="week in weeks" :key="week[0].key">
        <button
          v-for="cell in week"
          :key="cell.key"
          type="button"
          class="sd-cell"
          :class="[
            'k-' + cell.shiftKey,
            { out: !cell.inMonth, today: cell.isToday, sel: cell.key === selectedKey, carry: cell.carry, spill: cell.spill },
          ]"
          :aria-label="cell.label"
          :aria-pressed="cell.key === selectedKey"
          @click="$emit('select', cell.date)"
        >
          <span class="sd-cell__num">{{ cell.day }}</span>
          <span v-if="cell.carry" class="sd-cell__carry">☾–6A</span>
          <span class="sd-cell__chip">{{ cell.short }}{{ cell.spill ? ' ›' : '' }}</span>
        </button>
      </template>
    </div>

    <ul class="sd-legend">
      <li v-for="s in LEGEND" :key="s.code" :class="'k-' + s.key">
        <span class="sd-swatch">{{ s.short }}</span>{{ s.key === 'off' ? 'Day off' : s.title + ' ' + s.range }}
      </li>
      <li><span class="sd-swatch sd-swatch--carry">☾–6A</span>Night shift still running in the morning</li>
    </ul>
  </section>
</template>
