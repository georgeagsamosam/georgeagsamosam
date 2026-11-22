<script setup>
defineProps({
  model: { type: Object, required: true },
})
</script>

<template>
  <section class="sd-card sd-now" :class="'k-' + model.key" :data-state="model.state" aria-live="polite">
    <p class="sd-now__status">
      <span class="sd-pulse" :class="{ on: model.state === 'on' }"></span>
      {{ model.headline }}
      <span v-if="model.badge" class="sd-badge k-nt">☾ {{ model.badge }}</span>
    </p>

    <div class="sd-now__body">
      <div>
        <p class="sd-now__label">{{ model.label }}</p>
        <p class="sd-now__title">{{ model.title }}</p>
        <p v-if="model.range" class="sd-now__range">{{ model.range }}</p>
      </div>
      <div v-if="model.detail" class="sd-now__time">
        <strong>{{ model.detail }}</strong>
        <span>{{ model.detail2 }}</span>
      </div>
    </div>

    <p v-if="model.next" class="sd-now__next">
      Next shift: <b>{{ model.next.title }} {{ model.next.range }}</b> · {{ model.next.when }} (in {{ model.next.startsIn }})
    </p>
  </section>
</template>
