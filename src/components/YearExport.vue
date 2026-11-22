<script setup>
import { ref } from 'vue'
import { downloadYearWorkbook, yearFileName } from '../yearSheet.js'

const props = defineProps({
  initialYear: { type: Number, required: true },
})

const year = ref(props.initialYear)
const status = ref('')

const download = () => {
  try {
    downloadYearWorkbook(year.value)
    status.value = `Saved ${yearFileName(year.value)}`
  } catch (e) {
    status.value = 'Could not create the file on this device.'
  }
}
</script>

<template>
  <section class="sd-card sd-export">
    <div class="sd-export__text">
      <h2>Year spreadsheet</h2>
      <p class="sd-sub">
        Every crew member's shifts for the whole year: one tab per month, split into the
        1–15 and 16–end cut-offs, plus a day-by-day list. Each month prints on its own page.
        Open it in Google Sheets (File → Import → Upload) or Excel.
      </p>
    </div>
    <div class="sd-export__ctl">
      <div class="sd-export__year">
        <button class="sd-icon-btn" type="button" aria-label="Previous year" @click="year--">‹</button>
        <b class="sd-mono" aria-live="polite">{{ year }}</b>
        <button class="sd-icon-btn" type="button" aria-label="Next year" @click="year++">›</button>
      </div>
      <button type="button" class="sd-btn sd-btn--primary" @click="download">Download .xlsx</button>
    </div>
    <p v-if="status" class="sd-sub sd-export__status" role="status">{{ status }}</p>
  </section>
</template>
