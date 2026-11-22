<script setup>
defineProps({
  board: { type: Object, required: true },
  clockText: { type: String, required: true },
  selectedId: { type: Number, required: true }
})
defineEmits(['pick'])
</script>

<template>
  <section class="sd-card sd-duty" :class="board.gap ? 'k-off' : 'k-' + board.on[0].key" aria-live="polite">
    <div class="sd-duty__head">
      <p class="sd-duty__status">
        <span class="sd-pulse" :class="{ on: !board.gap }"></span>
        {{ board.gap ? 'Nobody on shift right now' : 'On duty now' }}
      </p>
      <span class="sd-duty__clock">{{ clockText }}</span>
    </div>

    <!-- who is working -->
    <button
      v-for="p in board.on"
      :key="p.id"
      type="button"
      class="sd-duty__on"
      :class="['k-' + p.key, { me: p.id === selectedId }]"
      @click="$emit('pick', p.id)"
    >
      <span class="sd-avatar sd-avatar--lg" :class="'k-' + p.key">{{ p.initials }}</span>
      <span class="sd-duty__who">
        <span class="sd-duty__name">{{ p.fullName }}</span>
        <span class="sd-duty__shift">{{ p.title }} · <span class="sd-mono">{{ p.range }}</span></span>
      </span>
      <span class="sd-duty__left">
        <strong>{{ p.endsIn }}</strong>
        <span>left</span>
      </span>
      <span class="sd-duty__bar" role="progressbar" :aria-valuenow="Math.round(p.progress)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${p.name}'s shift progress`">
        <i :style="{ width: p.progress + '%' }"></i>
      </span>
      <span class="sd-duty__ends">
        <span>Started {{ p.startedAt }}</span>
        <span>Ends {{ p.endsAt }}</span>
      </span>
    </button>

    <!-- handover -->
    <div v-if="board.upNext.length" class="sd-duty__next">
      <p class="sd-duty__label">
        {{ board.gap ? 'Next on' : 'Hands over to' }}
        <span class="sd-badge" :class="'k-' + board.upNext[0].key">in {{ board.upNext[0].startsIn }}</span>
      </p>
      <button
        v-for="p in board.upNext"
        :key="p.id"
        type="button"
        class="sd-duty__person"
        :class="['k-' + p.key, { me: p.id === selectedId }]"
        @click="$emit('pick', p.id)"
      >
        <span class="sd-avatar" :class="'k-' + p.key">{{ p.initials }}</span>
        <span class="sd-duty__who">
          <span class="sd-duty__name">{{ p.name }}</span>
          <span class="sd-duty__shift">{{ p.title }} · {{ p.startsAt }}</span>
        </span>
      </button>
    </div>

    <!-- everyone else -->
    <div v-if="board.rest.length || board.idle.length" class="sd-duty__rest">
      <p class="sd-duty__label">Off now</p>
      <div class="sd-duty__chips">
        <button
          v-for="p in board.rest"
          :key="p.id"
          type="button"
          class="sd-duty__chip"
          :class="{ me: p.id === selectedId }"
          :title="`${p.name}: next ${p.title} ${p.range}, ${p.startsAt}`"
          @click="$emit('pick', p.id)"
        >
          <span class="sd-avatar sd-avatar--sm">{{ p.initials }}</span>
          <span>
            <b>{{ p.name }}</b>
            <span class="sd-duty__chipnext">
              next <span class="sd-line" :class="'k-' + p.key">{{ p.short }}</span> {{ p.startsAt }}
            </span>
          </span>
        </button>
        <button
          v-for="p in board.idle"
          :key="p.id"
          type="button"
          class="sd-duty__chip"
          :class="{ me: p.id === selectedId }"
          @click="$emit('pick', p.id)"
        >
          <span class="sd-avatar sd-avatar--sm">{{ p.initials }}</span>
          <span><b>{{ p.name }}</b><span class="sd-duty__chipnext">no shift in 2 weeks</span></span>
        </button>
      </div>
    </div>
  </section>
</template>
