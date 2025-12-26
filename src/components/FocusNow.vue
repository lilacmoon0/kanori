<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Clock, Pause, Play, Check } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useFocusStore } from '@/stores/focusSessions'
import { useTasksStore } from '@/stores/tasks'
import { useBlocksStore } from '@/stores/blocks'

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

const auth = useAuthStore()
const focusStore = useFocusStore()
const tasksStore = useTasksStore()
const blocksStore = useBlocksStore()

const { activeByTask } = storeToRefs(focusStore)

const isAuthed = computed(() => auth.isAuthenticated)

const activeEntry = computed(() => {
  const entry = Object.entries(activeByTask.value).find(([, s]) => !!s)
  if (!entry) return null
  return { taskId: Number(entry[0]), session: entry[1]! }
})

const nowMs = ref(Date.now())
let ticker: number | null = null

function startTicker() {
  if (ticker != null) return
  nowMs.value = Date.now()
  ticker = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
}

function stopTicker() {
  if (ticker == null) return
  window.clearInterval(ticker)
  ticker = null
}

watch(
  () => activeEntry.value?.session?.id,
  (id) => {
    if (id) startTicker()
    else stopTicker()
  },
  { immediate: true },
)

const activeTask = computed(() => {
  const taskId = activeEntry.value?.taskId
  if (taskId == null) return null
  return tasksStore.items.find((t) => t.id === taskId) || null
})

function taskEstimatedMinutes(taskId: number) {
  const task = tasksStore.items.find((t) => t.id === taskId)
  const est = task?.estimated_minutes
  if (!Number.isFinite(est as number)) return null
  const n = Number(est)
  if (n <= 0) return null
  return n
}

function getTaskThemeColor(taskId: number) {
  const task = tasksStore.items.find((t) => t.id === taskId)
  const direct = task?.theme_color || task?.color
  if (direct) return direct
  const palette = ['#4a90e2', '#10b981', '#e66666', '#1c5fb8', '#2E7D32', '#66BB6A', '#A5D6A7']
  return palette[Math.abs(taskId) % palette.length]!
}

const activeBlock = computed(() => {
  const taskId = activeEntry.value?.taskId
  if (taskId == null) return null
  const now = nowMs.value

  if (focusStore.activeBlockId != null) {
    const byId = blocksStore.items.find((b) => b.id === focusStore.activeBlockId)
    if (byId && byId.task === taskId) return byId
  }

  const candidates = blocksStore.items.filter((b) => b.task === taskId)
  if (!candidates.length) return null

  for (const b of candidates) {
    const start = new Date(b.start_date).getTime()
    const endRaw = b.end_date ? new Date(b.end_date).getTime() : Number.NaN
    const end = Number.isFinite(endRaw) ? endRaw : start + 30 * 60_000
    if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end) return b
  }

  const past = candidates
    .map((b) => ({ b, start: new Date(b.start_date).getTime() }))
    .filter((x) => Number.isFinite(x.start) && x.start <= now)
    .sort((a, c) => c.start - a.start)

  return past[0]?.b || null
})

const timeRangeText = computed(() => {
  const b = activeBlock.value
  if (!b) return ''
  const startMs = new Date(b.start_date).getTime()
  if (!Number.isFinite(startMs)) return ''

  const est = taskEstimatedMinutes(b.task)
  const endMsRaw = b.end_date ? new Date(b.end_date).getTime() : Number.NaN
  const endMs =
    est != null
      ? startMs + est * 60_000
      : Number.isFinite(endMsRaw)
        ? endMsRaw
        : startMs + 30 * 60_000

  const s = new Date(startMs)
  const e = new Date(endMs)
  return `${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`
})

const focusFillPercent = computed(() => {
  const entry = activeEntry.value
  if (!entry) return 0
  const elapsedMs = focusStore.effectiveElapsedMs(entry.taskId, nowMs.value)
  const est = taskEstimatedMinutes(entry.taskId)

  let durationMs = 30 * 60_000
  if (est != null) {
    durationMs = est * 60_000
  } else {
    const b = activeBlock.value
    if (b) {
      const startMs = new Date(b.start_date).getTime()
      const endMs = b.end_date ? new Date(b.end_date).getTime() : Number.NaN
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
        durationMs = endMs - startMs
      }
    }
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0
  const pct = (elapsedMs / durationMs) * 100
  return Math.max(0, Math.min(99.9, pct))
})

const focusFillColor = computed(() => {
  const entry = activeEntry.value
  if (!entry) return '#4a90e2'
  return getTaskThemeColor(entry.taskId)
})

const elapsedText = computed(() => {
  const session = activeEntry.value?.session
  if (!session) return ''
  const totalSec = Math.max(
    0,
    Math.floor(focusStore.effectiveElapsedMs(session.task, nowMs.value) / 1000),
  )
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

async function onDone() {
  const session = activeEntry.value?.session
  if (!session) return
  await focusStore.stop(session.id, true)
}

onMounted(async () => {
  if (!isAuthed.value) return
  if (!tasksStore.items.length) await tasksStore.fetchAll()
  if (!blocksStore.items.length) await blocksStore.fetchAll()
  if (!focusStore.sessions.length) await focusStore.fetchAll()
})

onBeforeUnmount(() => {
  stopTicker()
})
</script>

<template>
  <div v-if="isAuthed && activeEntry" class="focus-overlay" role="status" aria-live="polite">
    <el-card
      class="focus-overlay-card"
      shadow="always"
      :style="{
        '--focus-fill-pct': focusFillPercent + '%',
        '--focus-fill-color': focusFillColor,
      }"
    >
      <div class="focus-overlay-top">
        <div class="focus-overlay-task">
          {{ activeTask?.title || `Task #${activeEntry.taskId}` }}
        </div>
        <div class="focus-overlay-time">{{ elapsedText }}</div>
      </div>

      <div v-if="activeBlock" class="focus-overlay-sub">
        <Clock :size="14" />
        <span>{{ timeRangeText }}</span>
      </div>

      <div class="focus-overlay-actions">
        <el-button
          text
          circle
          size="small"
          class="mini-icon-btn"
          :title="focusStore.isPaused(activeEntry.taskId) ? 'Resume' : 'Stop'"
          :aria-label="
            focusStore.isPaused(activeEntry.taskId)
              ? 'Resume focus timer'
              : 'Stop focus timer temporarily'
          "
          @click="
            focusStore.isPaused(activeEntry.taskId)
              ? focusStore.resume(activeEntry.taskId)
              : focusStore.pause(activeEntry.taskId)
          "
        >
          <Play v-if="focusStore.isPaused(activeEntry.taskId)" :size="14" />
          <Pause v-else :size="14" />
        </el-button>

        <el-button
          text
          circle
          size="small"
          class="mini-icon-btn"
          type="success"
          title="Done"
          aria-label="Done (end focus session)"
          @click="onDone"
        >
          <Check :size="14" />
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.focus-overlay {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  width: min(320px, calc(100vw - 24px));
  pointer-events: none;
}

@media (max-width: 48rem) {
  .focus-overlay {
    bottom: 90px;
  }
}

.focus-overlay-card {
  pointer-events: auto;
  position: relative;
  overflow: hidden;
}

.focus-overlay-card::before {
  content: '';
  position: absolute;
  inset: 0;
  width: var(--focus-fill-pct, 0%);
  background: var(--focus-fill-color, var(--el-color-primary));
  opacity: 0.18;
  pointer-events: none;
}

.focus-overlay-card :deep(.el-card__body) {
  position: relative;
  z-index: 1;
}

.focus-overlay-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.focus-overlay-title {
  font-weight: 800;
  color: var(--el-text-color-primary);
}

.focus-overlay-time {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--el-text-color-primary);
}

.focus-overlay-task {
  font-weight: 700;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-overlay-sub {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.focus-overlay-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.mini-icon-btn {
  width: 26px;
  height: 26px;
  padding: 0;
}
</style>
