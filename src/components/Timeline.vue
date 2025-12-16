<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBlocksStore } from '../stores/blocks'
import { useTasksStore } from '../stores/tasks'
import { useDayBoundsStore } from '../stores/dayBounds'
import type { Block } from '../types'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Check,
  Clock,
} from 'lucide-vue-next'

const blocksStore = useBlocksStore()
const tasksStore = useTasksStore()
const dayBoundsStore = useDayBoundsStore()

// Modal state
const showModal = ref(false)
const showBoundsModal = ref(false)
const selectedTaskId = ref<number | null>(null)
const startDate = ref('')
const editingBlockId = ref<number | null>(null)

// Day selection (YYYY-MM-DD)
const selectedDate = ref('')

// Wake/Sleep bounds (set once)
const wakeTime = ref('')
const sleepTime = ref('')

// Helpers
const pad = (n: number) => n.toString().padStart(2, '0')

const parseSelectedYmd = (ymd: string) => {
  const now = new Date()
  const [ys, ms, ds] = ymd.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)

  return {
    y: Number.isFinite(y) ? y : now.getFullYear(),
    m: Number.isFinite(m) ? m : now.getMonth() + 1,
    d: Number.isFinite(d) ? d : now.getDate(),
  }
}

// Format Date -> datetime-local value
const toLocalDateTimeInputValue = (date: Date) => {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

// Convert local datetime-local value to UTC ISO string.
// This prevents the backend from interpreting a naive string as UTC (which would shift on readback).
const toUtcISOStringFromLocalInput = (value: string) => {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return value

  const [ys, ms, ds] = datePart.split('-')
  const [hs, mins] = timePart.split(':')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  const h = Number(hs)
  const min = Number(mins)

  const localDate = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0)
  return localDate.toISOString()
}

const parseHm = (hm: string) => {
  const [hs, ms] = String(hm || '').split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

const minutesToHm = (mins: number) => {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

const saveBounds = () => {
  const wake = parseHm(wakeTime.value)
  const sleep = parseHm(sleepTime.value)
  if (wake === null || sleep === null) {
    alert('Please enter valid wake and sleep times (HH:MM).')
    return
  }
  if (sleep <= wake) {
    alert('Sleep time must be after wake time.')
    return
  }
  dayBoundsStore.set({ wake: wakeTime.value, sleep: sleepTime.value })
  showBoundsModal.value = false
}

// Initialize selected day + start datetime
const initializeDate = () => {
  const now = new Date()
  selectedDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  startDate.value = toLocalDateTimeInputValue(now)
}

const resetForm = () => {
  selectedTaskId.value = null
  editingBlockId.value = null
  // Keep selected day but reset start time to now (same day if today, else leave?)
  const base = new Date()
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  base.setFullYear(y, m - 1, d)
  startDate.value = toLocalDateTimeInputValue(base)
}

// Create / update / delete
const submitBlock = async () => {
  if (selectedTaskId.value === null) {
    alert('Please select a task')
    return
  }
  if (!startDate.value) {
    alert('Please select a start time')
    return
  }

  try {
    const payload = {
      task: selectedTaskId.value,
      start_date: toUtcISOStringFromLocalInput(startDate.value),
    } as Partial<Block>

    if (editingBlockId.value !== null) {
      await blocksStore.update(editingBlockId.value, payload)
    } else {
      await blocksStore.create(payload)
    }
    resetForm()
    showModal.value = false
  } catch (error) {
    console.error('Failed to save block:', error)
    alert('Failed to save block')
  }
}

const editBlock = (block: Block) => {
  editingBlockId.value = block.id
  selectedTaskId.value = block.task
  startDate.value = toLocalDateTimeInputValue(new Date(block.start_date))
  showModal.value = true
}

const deleteBlock = async (id: number) => {
  if (confirm('Are you sure you want to delete this block?')) {
    try {
      await blocksStore.remove(id)
    } catch (error) {
      console.error('Failed to delete block:', error)
      alert('Failed to delete block')
    }
  }
}

const getTaskTitle = (taskId: number) => {
  const task = tasksStore.items.find((t) => t.id === taskId)
  return task ? task.title : `Task #${taskId}`
}

const getTaskThemeColor = (taskId: number) => {
  const task = tasksStore.items.find((t) => t.id === taskId)
  const direct = task?.theme_color || task?.color
  if (direct) return direct

  // Deterministic fallback palette (reuses colors already present in the app)
  const palette = ['#4a90e2', '#10b981', '#e66666', '#1c5fb8', '#2E7D32', '#66BB6A', '#A5D6A7']
  return palette[Math.abs(taskId) % palette.length]!
}

// Day slider controls
const changeDay = (delta: number) => {
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  selectedDate.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  resetForm()
}

// Blocks for selected day
const blocksForSelectedDay = computed(() => {
  return blocksStore.items.filter((b) => {
    const d = new Date(b.start_date)
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return dateStr === selectedDate.value
  })
})

const wakeMinutes = computed(() => parseHm(wakeTime.value))
const sleepMinutes = computed(() => parseHm(sleepTime.value))
const hasBounds = computed(() => wakeMinutes.value !== null && sleepMinutes.value !== null)
const boundsValid = computed(() =>
  hasBounds.value && (sleepMinutes.value as number) > (wakeMinutes.value as number),
)

const minutesRange = computed(() => {
  if (!boundsValid.value) return 0
  return (sleepMinutes.value as number) - (wakeMinutes.value as number)
})

const PX_PER_MINUTE = 1
const timelineHeightPx = computed(() => {
  const h = minutesRange.value * PX_PER_MINUTE
  return Math.max(480, Math.min(1800, h))
})

const blocksSorted = computed(() => {
  return [...blocksForSelectedDay.value].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  )
})

const markerForMinutes = (minutesFromMidnight: number) => {
  if (!boundsValid.value) return 0
  const start = wakeMinutes.value as number
  const end = sleepMinutes.value as number
  const clamped = Math.max(start, Math.min(end, minutesFromMidnight))
  const ratio = (clamped - start) / (end - start)
  return ratio * timelineHeightPx.value
}

const blockStartMinutes = (block: Block) => {
  const d = new Date(block.start_date)
  return d.getHours() * 60 + d.getMinutes()
}

const blockEndMinutes = (block: Block) => {
  const fallback = blockStartMinutes(block) + 30
  if (!block.end_date) return fallback
  const d = new Date(block.end_date)
  const mins = d.getHours() * 60 + d.getMinutes()
  // Guard against bad data (or missing end) that would yield 0/negative durations
  return mins > blockStartMinutes(block) ? mins : fallback
}

const blockTopPx = (block: Block) => markerForMinutes(blockStartMinutes(block))
const blockHeightPx = (block: Block) => {
  const top = markerForMinutes(blockStartMinutes(block))
  const bottom = markerForMinutes(blockEndMinutes(block))
  return Math.max(10, bottom - top)
}

const blockStyleVars = (block: Block) => {
  const c = getTaskThemeColor(block.task)
  return {
    '--task-color': c,
  } as Record<string, string>
}

const hourTicks = computed(() => {
  if (!boundsValid.value) return [] as { label: string; top: number }[]
  const start = wakeMinutes.value as number
  const end = sleepMinutes.value as number
  const firstHour = Math.ceil(start / 60)
  const lastHour = Math.floor(end / 60)
  const ticks: { label: string; top: number }[] = []
  for (let h = firstHour; h <= lastHour; h++) {
    const mins = h * 60
    ticks.push({ label: `${pad(h)}:00`, top: markerForMinutes(mins) })
  }
  return ticks
})

const timelineTrackRef = ref<HTMLElement | null>(null)

const setStartDateFromMinutes = (minutesFromMidnight: number) => {
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  const hm = minutesToHm(minutesFromMidnight)
  const [hs, ms] = hm.split(':')
  const date = new Date(y, m - 1, d, Number(hs), Number(ms), 0)
  startDate.value = toLocalDateTimeInputValue(date)
}

const onTimelineClick = (e: MouseEvent) => {
  if (!boundsValid.value) {
    showBoundsModal.value = true
    return
  }
  const el = timelineTrackRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const y = e.clientY - rect.top
  const ratio = Math.max(0, Math.min(1, y / rect.height))
  const mins = (wakeMinutes.value as number) + ratio * minutesRange.value
  const rounded = Math.round(mins / 5) * 5
  editingBlockId.value = null
  setStartDateFromMinutes(rounded)
  showModal.value = true
}

const cancelForm = () => {
  showModal.value = false
  resetForm()
}

const openBoundsEditor = () => {
  showBoundsModal.value = true
}

const cancelBounds = () => {
  showBoundsModal.value = false
  const existing = dayBoundsStore.get()
  if (existing) {
    wakeTime.value = existing.wake
    sleepTime.value = existing.sleep
  }
}

const formatTimeOnly = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatTimeRange = (block: Block) => {
  const start = formatTimeOnly(block.start_date)
  const end = block.end_date ? formatTimeOnly(block.end_date) : minutesToHm(blockStartMinutes(block) + 30)
  return `${start}–${end}`
}

onMounted(() => {
  initializeDate()
  const existing = dayBoundsStore.get()
  if (existing) {
    wakeTime.value = existing.wake
    sleepTime.value = existing.sleep
  }
  tasksStore.fetchAll()
  blocksStore.fetchAll()
})
</script>

<template>
  <div class="timeline-container">
    <!-- Day selection slider -->
    <div class="day-slider">
      <button class="day-nav-btn" @click="changeDay(-1)" aria-label="Previous day" title="Previous day">
        <ChevronLeft :size="18" />
      </button>

      <div class="day-current">
        <input type="date" v-model="selectedDate" />
      </div>

      <button class="day-nav-btn" @click="changeDay(1)" aria-label="Next day" title="Next day">
        <ChevronRight :size="18" />
      </button>
    </div>

    <div class="header">
      <h2>Time Blocks</h2>
    </div>

    <!-- Task + time modal (create/edit) -->
    <div v-if="showModal" class="modal-overlay" @click.self="cancelForm">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">{{ editingBlockId ? 'Edit Block' : 'New Block' }}</h3>
          <button type="button" class="icon-btn" @click="cancelForm" aria-label="Close" title="Close">
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="submitBlock">
          <div class="form-group">
            <label for="task">Task *</label>
            <select id="task" v-model="selectedTaskId" required>
              <option :value="null" disabled>-- Select a Task --</option>
              <option v-for="task in tasksStore.items" :key="task.id" :value="task.id">
                {{ task.title }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="start-date">Start Time *</label>
            <input id="start-date" v-model="startDate" type="datetime-local" required />
          </div>

          <div class="form-actions">
            <button
              type="button"
              @click="cancelForm"
              class="btn-secondary icon-btn"
              aria-label="Cancel"
              title="Cancel"
            >
              <X :size="18" />
            </button>
            <button
              type="submit"
              class="btn-primary icon-btn"
              :aria-label="editingBlockId ? 'Save block' : 'Create block'"
              :title="editingBlockId ? 'Save' : 'Create'"
            >
              <Check :size="18" />
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Bounds modal (set/edit wake/sleep) -->
    <div v-if="showBoundsModal" class="modal-overlay" @click.self="cancelBounds">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Day Bounds</h3>
          <button type="button" class="icon-btn" @click="cancelBounds" aria-label="Close" title="Close">
            <X :size="18" />
          </button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="wake">Wake *</label>
            <input id="wake" type="time" v-model="wakeTime" />
          </div>
          <div class="form-group">
            <label for="sleep">Sleep *</label>
            <input id="sleep" type="time" v-model="sleepTime" />
          </div>
        </div>

        <div v-if="hasBounds && !boundsValid" class="bounds-error">Sleep must be after wake.</div>

        <div class="form-actions">
          <button
            type="button"
            @click="cancelBounds"
            class="btn-secondary icon-btn"
            aria-label="Cancel"
            title="Cancel"
          >
            <X :size="18" />
          </button>
          <button
            type="button"
            class="btn-primary icon-btn"
            @click="saveBounds"
            aria-label="Save"
            title="Save"
          >
            <Check :size="18" />
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="blocksStore.loading" class="loading">Loading blocks...</div>

    <!-- Error State -->
    <div v-else-if="blocksStore.error" class="error">
      {{ blocksStore.error }}
    </div>

    <!-- Day Timeline (true scale) -->
    <div v-else class="day-timeline">
      <div v-if="!boundsValid" class="empty-state">
        <p>Set wake and sleep times to view the day timeline.</p>
        <button
          type="button"
          class="btn-primary icon-btn"
          @click="openBoundsEditor"
          aria-label="Set day bounds"
          title="Set day bounds"
        >
          <Clock :size="18" />
        </button>
      </div>

      <div v-else class="mainline-wrap">
        <div class="mainline" :style="{ height: timelineHeightPx + 'px' }" ref="timelineTrackRef" @click="onTimelineClick">
          <!-- center line -->
          <div class="line"></div>

          <!-- hour ticks -->
          <div v-for="t in hourTicks" :key="t.label" class="tick" :style="{ top: t.top + 'px' }">
            <div class="tick-label">{{ t.label }}</div>
            <div class="tick-mark"></div>
          </div>

          <!-- wake marker -->
          <div class="marker marker-system marker-top" :style="{ top: '0px' }" @click.stop>
            <div class="dot dot-system"></div>
            <div class="bubble">
              <div class="bubble-title-row">
                <div class="bubble-title">Wake</div>
                <div class="bubble-actions inline">
                  <button
                    type="button"
                    class="mini"
                    @click.stop="openBoundsEditor"
                    aria-label="Edit day bounds"
                    title="Edit day bounds"
                  >
                    <Pencil :size="16" />
                  </button>
                </div>
              </div>
              <div class="bubble-sub">{{ wakeTime }}</div>
            </div>
          </div>

          <!-- blocks (duration-aware) -->
          <div
            v-for="block in blocksSorted"
            :key="block.id"
            class="block-item"
            :style="{ top: blockTopPx(block) + 'px', height: blockHeightPx(block) + 'px', ...blockStyleVars(block) }"
            @click.stop
          >
            <div class="block-core">
              <div class="block-pill" />
            </div>
            <div class="bubble" :style="{ borderColor: 'var(--task-color)' }">
              <div class="bubble-title-row">
                <div class="bubble-title">{{ getTaskTitle(block.task) }}</div>
                <div class="bubble-actions inline">
                  <button
                    type="button"
                    class="mini"
                    @click.stop="editBlock(block)"
                    aria-label="Edit block"
                    title="Edit"
                  >
                    <Pencil :size="16" />
                  </button>
                  <button
                    type="button"
                    class="mini danger"
                    @click.stop="deleteBlock(block.id)"
                    aria-label="Delete block"
                    title="Delete"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
              <div class="bubble-sub">{{ formatTimeRange(block) }}</div>
            </div>
          </div>

          <!-- sleep marker -->
          <div
            class="marker marker-system marker-bottom"
            :style="{ top: timelineHeightPx + 'px' }"
            @click.stop
          >
            <div class="dot dot-system"></div>
            <div class="bubble">
              <div class="bubble-title">Sleep</div>
              <div class="bubble-sub">{{ sleepTime }}</div>
            </div>
          </div>
        </div>

        <div v-if="blocksSorted.length === 0" class="empty-state below">
          <p>No blocks for this day. Click on the timeline to add one.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px;
}

/* Day slider */
.day-slider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.day-nav-btn {
  border: none;
  background: #f1f3f5;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.day-nav-btn:hover {
  background: #e2e6ea;
}

.day-current input[type='date'] {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #ced4da;
  font-size: 14px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header h2 {
  margin: 0;
  color: #2c3e50;
}

/* Form card */
.form-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.bounds-error {
  margin-top: 10px;
  font-size: 13px;
  color: #dc3545;
}

.form-card h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 14px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  background: white;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-primary {
  background: #4a90e2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #357abd;
}

.btn-secondary {
  background: white;
  color: #495057;
  border: 1px solid #ced4da;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.icon-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-secondary:hover {
  background: #f8f9fa;
}

/* States */
.loading,
.error,
.empty-state {
  text-align: center;
  padding: 24px;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

/* Day timeline */
.day-timeline {
  margin-top: 8px;
}

.mainline-wrap {
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 18px 18px;
  background: white;
  max-width: 620px;
  margin: 0 auto;
}

.mainline {
  position: relative;
  width: 100%;
  cursor: pointer;
  --line-x: 44px;
}

.line {
  position: absolute;
  left: var(--line-x);
  top: 0;
  bottom: 0;
  width: 2px;
  background: #dee2e6;
}

.tick {
  position: absolute;
  left: 0;
  width: 100%;
  transform: translateY(-50%);
  pointer-events: none;
}

.tick-label {
  position: absolute;
  left: 0;
  font-size: 12px;
  color: #868e96;
}

.tick-mark {
  position: absolute;
  left: var(--line-x);
  width: 18px;
  height: 1px;
  transform: translateX(-50%);
  background: #e9ecef;
}

.marker {
  position: absolute;
  left: var(--line-x);
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(520px, calc(100% - var(--line-x) - 8px));
}

.marker-top {
  transform: translateY(0);
}

.marker-bottom {
  transform: translateY(-100%);
}

/* Stadium marker (replaces circle) */
.dot {
  width: 20px;
  height: 12px;
  border-radius: 9999px;
  background: #4a90e2;
  border: 3px solid white;
  box-shadow: 0 0 0 1px #dee2e6;
  flex: 0 0 auto;
  margin-left: -13px;
}

.dot-system {
  background: #868e96;
}

.bubble {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  padding: 10px 12px;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
  max-width: 200px;
}

/* Duration-aware blocks */
.block-item {
  position: absolute;
  left: var(--line-x);
  transform: none;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(520px, calc(100% - var(--line-x) - 8px));
}

.block-core {
  width: 22px;
  display: flex;
  justify-content: center;
  align-items: stretch;
  height: 100%;
  flex: 0 0 auto;
  margin-left: -11px;
}

.block-pill {
  width: 14px;
  height: 100%;
  border-radius: 9999px;
  background: var(--task-color);
  border: 3px solid white;
  box-shadow: 0 0 0 1px #dee2e6;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}

.modal {
  width: min(520px, 100%);
  background: white;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  padding: 16px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  color: #2c3e50;
}

.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6c757d;
  line-height: 1;
}

.icon-btn:hover {
  color: #2c3e50;
}

.bubble-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.bubble-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.bubble-sub {
  margin-top: 2px;
  color: #6c757d;
  font-size: 12px;
}

.bubble-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.bubble-actions.inline {
  margin-top: 0;
}

.mini {
  border: 1px solid #ced4da;
  background: white;
  color: #495057;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mini:hover {
  background: #f1f3f5;
}

.mini.danger {
  border-color: #f1aeb5;
  color: #c92a2a;
}

.empty-state.below {
  padding: 14px 0 0;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .marker {
    width: calc(100% - 12px);
  }

  .block-item {
    width: calc(100% - 12px);
  }
}
</style>
