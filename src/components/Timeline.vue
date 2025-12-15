<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBlocksStore } from '../stores/blocks'
import { useTasksStore } from '../stores/tasks'
import type { Block } from '../types'

const blocksStore = useBlocksStore()
const tasksStore = useTasksStore()

// Form state
const showForm = ref(false)
const selectedTaskId = ref<number | null>(null)
const startDate = ref('')

// Day selection (YYYY-MM-DD)
const selectedDate = ref('')

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

// Initialize selected day + start datetime
const initializeDate = () => {
  const now = new Date()
  selectedDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  startDate.value = toLocalDateTimeInputValue(now)
}

const resetForm = () => {
  selectedTaskId.value = null
  // Keep selected day but reset start time to now (same day if today, else leave?)
  const base = new Date()
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  base.setFullYear(y, m - 1, d)
  startDate.value = toLocalDateTimeInputValue(base)
}

// Create / delete
const createBlock = async () => {
  if (selectedTaskId.value === null) {
    alert('Please select a task')
    return
  }
  if (!startDate.value) {
    alert('Please select a start time')
    return
  }

  try {
    await blocksStore.create({
      task: selectedTaskId.value,
      start_date: toUtcISOStringFromLocalInput(startDate.value),
    })
    resetForm()
    showForm.value = false
  } catch (error) {
    console.error('Failed to create block:', error)
    alert('Failed to create block')
  }
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

// Formatting helpers
const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

const getTaskTitle = (taskId: number) => {
  const task = tasksStore.items.find((t) => t.id === taskId)
  return task ? task.title : `Task #${taskId}`
}

// Day slider controls
const changeDay = (delta: number) => {
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  selectedDate.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Timeline data
const hours = Array.from({ length: 24 }, (_, i) => i)
const slotMinutes = [0, 30]

// Blocks for selected day
const blocksForSelectedDay = computed(() => {
  return blocksStore.items.filter((b) => {
    const d = new Date(b.start_date)
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return dateStr === selectedDate.value
  })
})

// Map blocks by rounded slot "HH:MM"
const blocksBySlot = computed(() => {
  const map = new Map<string, Block[]>()
  for (const block of blocksForSelectedDay.value) {
    const d = new Date(block.start_date)
    const hour = d.getHours()
    // Assign to 00 or 30 based on minutes
    const minuteSlot = d.getMinutes() >= 30 ? 30 : 0
    const key = `${pad(hour)}:${pad(minuteSlot)}`
    const existing = map.get(key) ?? []
    existing.push(block)
    map.set(key, existing)
  }
  return map
})

const getBlockForSlot = (hour: number, minute: number) => {
  const key = `${pad(hour)}:${pad(minute)}`
  const list = blocksBySlot.value.get(key)
  return list && list.length > 0 ? list[0] : null
}

// When user clicks an empty slot on the timeline
const selectSlot = (hour: number, minute: number) => {
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  const date = new Date(y, m - 1, d, hour, minute, 0)
  startDate.value = toLocalDateTimeInputValue(date)
  showForm.value = true
}

const formatHourLabel = (hour: number) => {
  return `${pad(hour)}:00`
}

onMounted(() => {
  initializeDate()
  tasksStore.fetchAll()
  blocksStore.fetchAll()
})
</script>

<template>
  <div class="timeline-container">
    <!-- Day selection slider -->
    <div class="day-slider">
      <button class="day-nav-btn" @click="changeDay(-1)">‹</button>

      <div class="day-current">
        <input type="date" v-model="selectedDate" />
      </div>

      <button class="day-nav-btn" @click="changeDay(1)">›</button>
    </div>

    <div class="header">
      <h2>Time Blocks</h2>
      <button @click="showForm = !showForm" class="btn-primary">
        {{ showForm ? 'Cancel' : '+ New Block' }}
      </button>
    </div>

    <!-- Create Block Form -->
    <div v-if="showForm" class="form-card">
      <h3>Create Time Block</h3>
      <form @submit.prevent="createBlock">
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
          <button type="button" @click="showForm = false" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Create Block</button>
        </div>
      </form>
    </div>

    <!-- Loading State -->
    <div v-if="blocksStore.loading" class="loading">Loading blocks...</div>

    <!-- Error State -->
    <div v-else-if="blocksStore.error" class="error">
      {{ blocksStore.error }}
    </div>

    <!-- Day Timeline -->
    <div v-else class="day-timeline">
      <div v-if="blocksStore.items.length === 0" class="empty-state">
        <p>No time blocks yet. Click on the timeline to add one.</p>
      </div>

      <div class="timeline-grid">
        <div v-for="hour in hours" :key="hour" class="timeline-row">
          <div class="hour-label">
            {{ formatHourLabel(hour) }}
          </div>

          <div class="hour-slots">
            <div v-for="minute in slotMinutes" :key="minute" class="slot-wrapper">
              <div class="slot" @click="!getBlockForSlot(hour, minute) && selectSlot(hour, minute)">
                <template v-if="getBlockForSlot(hour, minute)">
                  <div class="slot-block">
                    <div class="slot-block-title">
                      {{ getTaskTitle(getBlockForSlot(hour, minute)!.task) }}
                    </div>
                    <div class="slot-block-time">
                      {{ formatDateTime(getBlockForSlot(hour, minute)!.start_date) }}
                    </div>
                    <button
                      class="slot-block-delete"
                      @click.stop="deleteBlock(getBlockForSlot(hour, minute)!.id)"
                    >
                      ×
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div class="slot-empty">
                    <!-- subtle hint only on some slots if you like -->
                    <!-- <span>+</span> -->
                  </div>
                </template>
              </div>
              <div class="slot-minute-label">
                {{ minute.toString().padStart(2, '0') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  max-width: 900px;
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

.timeline-grid {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.timeline-row {
  display: grid;
  grid-template-columns: 70px 1fr;
  border-bottom: 1px solid #f1f3f5;
}

.timeline-row:last-child {
  border-bottom: none;
}

.hour-label {
  background: #f8f9fa;
  padding: 8px 10px;
  font-size: 12px;
  color: #868e96;
  display: flex;
  align-items: flex-start;
}

.hour-slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 00, 30 */
  border-left: 1px solid #f1f3f5;
}

.slot-wrapper {
  position: relative;
  border-left: 1px solid #f8f9fa;
}

.slot {
  min-height: 36px;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: stretch;
}

.slot:hover .slot-empty {
  background: #f1f3f5;
}

.slot-empty {
  flex: 1;
  border-radius: 4px;
  transition: background 0.1s;
}

/* Block inside slot */
.slot-block {
  position: relative;
  background: #e7f3ff;
  border-radius: 6px;
  padding: 4px 8px 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.slot-block-title {
  font-size: 13px;
  font-weight: 600;
  color: #1c5fb8;
  padding-right: 16px;
}

.slot-block-time {
  font-size: 11px;
  color: #495057;
}

.slot-block-delete {
  position: absolute;
  top: 2px;
  right: 4px;
  background: none;
  border: none;
  color: #c92a2a;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.slot-minute-label {
  position: absolute;
  bottom: 2px;
  right: 6px;
  font-size: 10px;
  color: #adb5bd;
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

  .timeline-row {
    grid-template-columns: 55px 1fr;
  }

  .hour-label {
    font-size: 11px;
    padding: 6px 6px;
  }
}
</style>
