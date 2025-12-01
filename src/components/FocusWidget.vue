<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFocusStore } from '../stores/focusSessions'

const props = defineProps<{ taskId: number }>()
const focusStore = useFocusStore()
const { sessions, activeByTask } = storeToRefs(focusStore)

const active = computed(() => activeByTask.value[props.taskId] || null)
const ticking = ref<number | null>(null)
const elapsed = ref(0) // seconds

function updateElapsed() {
  const s = active.value
  if (!s) {
    elapsed.value = 0
    return
  }
  const start = new Date(s.started_at).getTime()
  const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now()
  elapsed.value = Math.max(0, Math.floor((end - start) / 1000))
}

onMounted(() => {
  updateElapsed()
  ticking.value = window.setInterval(updateElapsed, 1000)
  if (!sessions.value.length) focusStore.fetchAll()
})
onUnmounted(() => {
  if (ticking.value) window.clearInterval(ticking.value)
})

const elapsedText = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${m}m ${s}s`
})

const starting = ref(false)
const stopping = ref(false)
const notes = ref('')

async function start() {
  starting.value = true
  try {
    await focusStore.start(props.taskId, notes.value)
  } finally {
    starting.value = false
  }
}

async function stop(success: boolean) {
  if (!active.value) return
  stopping.value = true
  try {
    await focusStore.stop(active.value.id, success)
  } finally {
    stopping.value = false
  }
}
</script>

<template>
  <div class="focus">
    <template v-if="!active">
      <div class="row">
        <input v-model="notes" class="notes" placeholder="Focus notes (optional)" />
        <button class="start" :disabled="starting" @click="start">🌱 Start Focus</button>
      </div>
    </template>
    <template v-else>
      <div class="row running">
        <span class="timer">🌳 {{ elapsedText }}</span>
        <button class="success" :disabled="stopping" @click="stop(true)">✔️ Complete</button>
        <button class="fail" :disabled="stopping" @click="stop(false)">⏹️ Stop</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.focus {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 8px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.notes {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.start {
  background: #10b981;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.running .timer {
  font-weight: 600;
  color: #065f46;
}
.success {
  background: #059669;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.fail {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
</style>
