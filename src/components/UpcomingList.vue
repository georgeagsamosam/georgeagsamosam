<script setup>
defineProps({
  days: { type: Array, required: true },
  selectedKey: { type: String, required: true },
})
defineEmits(['select'])
</script>

<template>
  <section class="sd-card">
    <h2>Next 7 days</h2>
    <p class="sd-sub">Night shifts show the 6AM finish on the following day</p>
    <ul class="sd-up">
      <li v-for="d in days" :key="d.key">
        <button type="button" class="sd-up__row" :class="{ sel: d.key === selectedKey }" @click="$emit('select', d.date)">
          <span class="sd-up__date">
            <b>{{ d.weekday }}</b>
            <span>{{ d.day }}</span>
          </span>
          <span class="sd-up__lines">
            <span v-for="(l, i) in d.lines" :key="i" class="sd-line" :class="'k-' + l.key">
              {{ l.kind === 'carry' ? '☾ ' : '' }}{{ l.text }} <em v-if="l.note">({{ l.note }})</em>
            </span>
          </span>
          <span v-if="d.rel" class="sd-badge">{{ d.rel }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
