<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFocusStore } from '../stores/focusSessions'

const props = defineProps<{ taskId?: number }>()
const focusStore = useFocusStore()
const { sessions } = storeToRefs(focusStore)

const data = computed(() => {
  const list = props.taskId
    ? sessions.value.filter((s) => s.task === props.taskId)
    : sessions.value
  // Take last 10 sessions by id/time (assumes latest first)
  return list.slice(0, 10).map((s) => ({
    id: s.id,
    minutes: s.duration_minutes || 0,
    label: new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }))
})

const max = computed(() => Math.max(30, ...data.value.map((d) => d.minutes)))
</script>

<template>
  <div class="wrap">
    <svg class="chart" viewBox="0 0 220 80" preserveAspectRatio="none">
      <g v-for="(d, i) in data" :key="d.id">
        <rect
          :x="i * 20 + 10"
          :y="80 - (d.minutes / max) * 70 - 5"
          width="14"
          :height="(d.minutes / max) * 70"
          rx="3"
          ry="3"
          fill="#60a5fa"
        />
      </g>
    </svg>
    <div class="labels">
      <span v-for="d in data" :key="d.id" class="label">{{ d.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chart {
  width: 100%;
  height: 80px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.labels {
  display: flex;
  gap: 6px;
  justify-content: flex-start;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 10px;
}
.label {
  width: 20px;
  text-align: center;
}
</style>
