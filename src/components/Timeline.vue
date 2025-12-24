<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useBlocksStore } from '../stores/blocks'
import { useTasksStore } from '../stores/tasks'
import { useDayBoundsStore } from '../stores/dayBounds'
import type { DayBounds } from '../stores/dayBounds'
import { useAuthStore } from '../stores/auth'
import { useFocusStore } from '../stores/focusSessions'
import { getSetting, updateSetting } from '../api/setting'
import type { Block } from '../types'
import TaskColumn from './TaskColumn.vue'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Clock,
  Play,
  Pause,
  Check,
} from 'lucide-vue-next'

const blocksStore = useBlocksStore()
const tasksStore = useTasksStore()
const dayBoundsStore = useDayBoundsStore()
const authStore = useAuthStore()
const focusStore = useFocusStore()

const todayTasks = tasksStore.byStatus('today')

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

function addMinutesToUtcIso(utcIso: string, minutes: number) {
  const base = new Date(utcIso).getTime()
  if (!Number.isFinite(base)) return utcIso
  const mins = Number(minutes)
  if (!Number.isFinite(mins)) return utcIso
  return new Date(base + mins * 60_000).toISOString()
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

function utcIsoForSelectedDayMinutes(minutesFromMidnight: number) {
  const { y, m, d } = parseSelectedYmd(selectedDate.value)
  const hh = Math.floor(minutesFromMidnight / 60)
  const mm = Math.round(minutesFromMidnight % 60)
  const date = new Date(y, m - 1, d, hh, mm, 0)
  const startLocal = toLocalDateTimeInputValue(date)
  return toUtcISOStringFromLocalInput(startLocal)
}

function asDayBounds(value: unknown): DayBounds | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.wake === 'string' && typeof v.sleep === 'string') {
    return { wake: v.wake, sleep: v.sleep }
  }
  return null
}

function parseDayBoundsFromSetting(dayBoundsValue: unknown): DayBounds | null {
  // Accept either a single object or a list containing a bounds object.
  const direct = asDayBounds(dayBoundsValue)
  if (direct) return direct

  if (Array.isArray(dayBoundsValue) && dayBoundsValue.length > 0) {
    return asDayBounds(dayBoundsValue[0])
  }

  return null
}

const saveBounds = async () => {
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

  const next = { wake: wakeTime.value, sleep: sleepTime.value }
  dayBoundsStore.set(next)

  if (authStore.isAuthenticated) {
    try {
      await updateSetting({ day_bounds: [next] })
    } catch (error) {
      console.error('Failed to save day bounds to setting endpoint:', error)
      alert('Failed to sync day bounds to your account. Please try again.')
    }
  }
  showBoundsModal.value = false
}

const didFetchSetting = ref(false)

async function hydrateDayBoundsFromApiSetting() {
  if (!authStore.isAuthenticated) return

  try {
    const setting = await getSetting()
    const fromApi = parseDayBoundsFromSetting(setting?.day_bounds)
    if (fromApi) {
      dayBoundsStore.set(fromApi)
      wakeTime.value = fromApi.wake
      sleepTime.value = fromApi.sleep
      return
    }

    // No bounds stored server-side yet: ask the user to set day bounds.
    showBoundsModal.value = true
  } catch (error) {
    console.error('Failed to load setting from API:', error)
    // Keep running; the user can still set bounds via the modal.
  }
}

watch(
  () => authStore.isAuthenticated,
  (authed) => {
    if (!authed) return
    if (didFetchSetting.value) return
    didFetchSetting.value = true
    void hydrateDayBoundsFromApiSetting()
  },
  { immediate: true },
)

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
    const est = taskEstimatedMinutes(selectedTaskId.value)
    const payload = {
      task: selectedTaskId.value,
      start_date: toUtcISOStringFromLocalInput(startDate.value),
    } as Partial<Block>

    // Always submit end_date if the task has an estimate.
    if (est != null) {
      payload.end_date = addMinutesToUtcIso(payload.start_date as string, est)
    } else if (editingBlockId.value !== null) {
      // Otherwise, preserve the existing end_date duration (if any) when changing start.
      const existing = blocksStore.items.find((b) => b.id === editingBlockId.value)
      if (existing?.end_date) {
        const startMs = new Date(existing.start_date).getTime()
        const endMs = new Date(existing.end_date).getTime()
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
          const durMin = Math.round((endMs - startMs) / 60_000)
          payload.end_date = addMinutesToUtcIso(payload.start_date as string, durMin)
        }
      }
    }

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
  try {
    const block = blocksStore.items.find((b) => b.id === id)
    if (block) {
      const active = activeFocusForTask(block.task)
      if (active) {
        // If the focused task's block is deleted, end the session (treat as not successful).
        await focusStore.stop(active.id, false)
      }
      focusStore.clearPause()
    }
    await blocksStore.remove(id)
  } catch (error) {
    console.error('Failed to delete block:', error)
    alert('Failed to delete block')
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
  const start = blockStartMinutes(block)
  const fallback = start + 30

  if (block.end_date) {
    const d = new Date(block.end_date)
    const mins = d.getHours() * 60 + d.getMinutes()
    // Guard against bad data (or missing end) that would yield 0/negative durations
    if (mins > start) return mins
  }

  return fallback
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

// --- Swipe navigation (mobile) ---
const swipeStart = ref<{ x: number; y: number; t: number } | null>(null)
const swipeIndicator = ref<'prev' | 'next' | null>(null)
let swipeIndicatorTimer: number | null = null

function flashSwipeIndicator(dir: 'prev' | 'next') {
  swipeIndicator.value = dir
  if (swipeIndicatorTimer != null) window.clearTimeout(swipeIndicatorTimer)
  swipeIndicatorTimer = window.setTimeout(() => {
    swipeIndicator.value = null
    swipeIndicatorTimer = null
  }, 450)
}

function isInteractiveEl(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return !!el.closest(
    'input, textarea, select, button, a, .el-input, .el-select, .el-date-editor, .el-picker-panel, .el-dialog, .el-overlay, .el-button',
  )
}

function isBlockEl(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el?.closest('.block-item')
}

function onTouchStart(e: TouchEvent) {
  if (showModal.value || showBoundsModal.value) return
  if (isInteractiveEl(e.target)) return
  if (isDraggingBlock.value || isBlockEl(e.target)) return
  if (e.touches.length !== 1) return
  const touch = e.touches.item(0)
  if (!touch) return
  swipeStart.value = { x: touch.clientX, y: touch.clientY, t: Date.now() }
}

function onTouchEnd(e: TouchEvent) {
  if (!swipeStart.value) return
  if (isDraggingBlock.value) {
    swipeStart.value = null
    return
  }
  const start = swipeStart.value
  swipeStart.value = null
  if (e.changedTouches.length !== 1) return
  const touch = e.changedTouches.item(0)
  if (!touch) return
  const dx = touch.clientX - start.x
  const dy = touch.clientY - start.y

  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX < 60) return
  if (absX < absY * 1.2) return
  if (Date.now() - start.t > 650) return

  // Swipe left -> next day, swipe right -> previous day.
  const dir = dx < 0 ? 'next' : 'prev'
  flashSwipeIndicator(dir)
  changeDay(dir === 'next' ? 1 : -1)
}

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

// --- Drag-to-reschedule blocks ---
const isDraggingBlock = ref(false)
const draggingBlockId = ref<number | null>(null)
const draggingTopPx = ref<number | null>(null)
const draggingStartMinutes = ref<number | null>(null)

const BLOCK_LONGPRESS_MS = 800
const BLOCK_CANCEL_MOVE_PX = 14

type BlockDragState = {
  blockId: number
  pointerId: number
  startClientY: number
  startMinutes: number
  durationMinutes: number
  moved: boolean
}

let blockDrag: BlockDragState | null = null

type PendingBlockDragState = {
  blockId: number
  pointerId: number
  startClientX: number
  startClientY: number
  lastClientY: number
  startMinutes: number
  durationMinutes: number
  captureEl: HTMLElement | null
}

let pendingBlockDrag: PendingBlockDragState | null = null
let pendingBlockDragTimer: number | null = null

function preventTouchScroll(e: TouchEvent) {
  // Only active during a drag; prevents the browser from scrolling the page.
  e.preventDefault()
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function roundTo5(mins: number) {
  return Math.round(mins / 5) * 5
}

function clearPendingBlockDrag() {
  if (pendingBlockDragTimer != null) {
    window.clearTimeout(pendingBlockDragTimer)
    pendingBlockDragTimer = null
  }
  pendingBlockDrag = null
  window.removeEventListener('pointermove', onPendingBlockPointerMove)
  window.removeEventListener('pointerup', onPendingBlockPointerUp)
  window.removeEventListener('pointercancel', onPendingBlockPointerUp)
}

function beginBlockDrag(state: {
  blockId: number
  pointerId: number
  startClientY: number
  startMinutes: number
  durationMinutes: number
  captureEl?: HTMLElement | null
}) {
  if (state.captureEl) {
    try {
      state.captureEl.setPointerCapture(state.pointerId)
    } catch {
      // Ignore if unsupported.
    }
  }

  isDraggingBlock.value = true
  draggingBlockId.value = state.blockId
  draggingStartMinutes.value = state.startMinutes
  draggingTopPx.value = markerForMinutes(state.startMinutes)

  blockDrag = {
    blockId: state.blockId,
    pointerId: state.pointerId,
    startClientY: state.startClientY,
    startMinutes: state.startMinutes,
    durationMinutes: state.durationMinutes,
    moved: false,
  }

  // While dragging on touch devices, prevent the page from scrolling.
  window.addEventListener('touchmove', preventTouchScroll, { passive: false })

  window.addEventListener('pointermove', onBlockPointerMove, { passive: false })
  window.addEventListener('pointerup', onBlockPointerUp, { passive: false })
  window.addEventListener('pointercancel', onBlockPointerUp, { passive: false })
}

function onPendingBlockPointerMove(e: PointerEvent) {
  if (!pendingBlockDrag) return
  if (e.pointerId !== pendingBlockDrag.pointerId) return

  pendingBlockDrag.lastClientY = e.clientY
  const dx = e.clientX - pendingBlockDrag.startClientX
  const dy = e.clientY - pendingBlockDrag.startClientY
  if (Math.hypot(dx, dy) >= BLOCK_CANCEL_MOVE_PX) {
    // Finger moved before long-press: treat as a normal scroll gesture.
    clearPendingBlockDrag()
  }
}

function onPendingBlockPointerUp(e: PointerEvent) {
  if (!pendingBlockDrag) return
  if (e.pointerId !== pendingBlockDrag.pointerId) return
  clearPendingBlockDrag()
}

function onBlockPointerDown(block: Block, e: PointerEvent) {
  if (!boundsValid.value) return
  if (showModal.value || showBoundsModal.value) return
  if (isInteractiveEl(e.target)) return
  if (e.button !== 0) return

  const el = timelineTrackRef.value
  if (!el) return

  // Touch: require long-press before enabling drag.
  if (e.pointerType === 'touch') {
    // Don't block scrolling here; only take over once drag activates.
    // We rely on CSS (user-select/touch-callout) + contextmenu.prevent to avoid long-press menus.
    e.stopPropagation()

    // Don't start another pending drag.
    clearPendingBlockDrag()

    const startMins = blockStartMinutes(block)
    const endMins = blockEndMinutes(block)
    const est = taskEstimatedMinutes(block.task)
    const duration = Math.max(10, block.end_date ? endMins - startMins : (est ?? (endMins - startMins)))

    pendingBlockDrag = {
      blockId: block.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientY: e.clientY,
      startMinutes: startMins,
      durationMinutes: duration,
      captureEl: (e.currentTarget as HTMLElement | null) ?? null,
    }

    window.addEventListener('pointermove', onPendingBlockPointerMove, { passive: true })
    window.addEventListener('pointerup', onPendingBlockPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPendingBlockPointerUp, { passive: true })

    pendingBlockDragTimer = window.setTimeout(() => {
      if (!pendingBlockDrag) return
      const s = pendingBlockDrag
      clearPendingBlockDrag()

      // Start dragging from the current finger Y so the block doesn't jump.
      beginBlockDrag({
        blockId: s.blockId,
        pointerId: s.pointerId,
        startClientY: s.lastClientY,
        startMinutes: s.startMinutes,
        durationMinutes: s.durationMinutes,
        captureEl: s.captureEl,
      })
    }, BLOCK_LONGPRESS_MS)

    return
  }

  // Mouse/pen: start immediately.
  e.preventDefault()
  e.stopPropagation()

  const startMins = blockStartMinutes(block)
  const endMins = blockEndMinutes(block)
  const est = taskEstimatedMinutes(block.task)
  const duration = Math.max(10, block.end_date ? endMins - startMins : (est ?? (endMins - startMins)))

  beginBlockDrag({
    blockId: block.id,
    pointerId: e.pointerId,
    startClientY: e.clientY,
    startMinutes: startMins,
    durationMinutes: duration,
    captureEl: (e.currentTarget as HTMLElement | null) ?? null,
  })
}

function onBlockPointerMove(e: PointerEvent) {
  if (!blockDrag) return
  if (e.pointerId !== blockDrag.pointerId) return
  if (!boundsValid.value) return

  e.preventDefault()

  const dy = e.clientY - blockDrag.startClientY
  if (!blockDrag.moved && Math.abs(dy) >= 3) blockDrag.moved = true

  const start = wakeMinutes.value as number
  const end = sleepMinutes.value as number
  const range = minutesRange.value
  if (range <= 0 || timelineHeightPx.value <= 0) return

  const deltaMinutes = (dy / timelineHeightPx.value) * range
  const raw = blockDrag.startMinutes + deltaMinutes
  const maxStart = end - blockDrag.durationMinutes
  const clamped = clamp(raw, start, maxStart)
  const rounded = roundTo5(clamped)

  draggingStartMinutes.value = rounded
  draggingTopPx.value = markerForMinutes(rounded)
}

async function onBlockPointerUp(e: PointerEvent) {
  if (!blockDrag) return
  if (e.pointerId !== blockDrag.pointerId) return

  e.preventDefault()

  const state = blockDrag
  blockDrag = null

  window.removeEventListener('pointermove', onBlockPointerMove)
  window.removeEventListener('pointerup', onBlockPointerUp)
  window.removeEventListener('pointercancel', onBlockPointerUp)
  window.removeEventListener('touchmove', preventTouchScroll)

  const moved = state.moved
  const blockId = state.blockId
  const newStart = draggingStartMinutes.value

  isDraggingBlock.value = false
  draggingBlockId.value = null
  draggingTopPx.value = null
  draggingStartMinutes.value = null

  if (!moved || newStart == null) return

  const block = blocksStore.items.find((b) => b.id === blockId)
  if (!block) return

  const payload: Partial<Block> = {
    start_date: utcIsoForSelectedDayMinutes(newStart),
  }

  // Keep end_date in sync with the move.
  // If the block already has an end_date, shift it by the same delta minutes as start_date.
  // If it does not have an end_date yet, derive it from the task estimate (if any).
  if (block.end_date) {
    const oldStart = blockStartMinutes(block)
    const oldEnd = blockEndMinutes(block)
    const deltaMin = newStart - oldStart
    payload.end_date = utcIsoForSelectedDayMinutes(oldEnd + deltaMin)
  } else {
    const est = taskEstimatedMinutes(block.task)
    if (est != null) {
      payload.end_date = utcIsoForSelectedDayMinutes(newStart + est)
    }
  }

  try {
    await blocksStore.update(blockId, payload)
  } catch (error) {
    console.error('Failed to move block:', error)
    alert('Failed to move block')
  }
}

async function createBlockFromTaskDrop(taskId: number, clientY: number) {
  if (!boundsValid.value) {
    showBoundsModal.value = true
    return
  }
  const el = timelineTrackRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const y = clientY - rect.top
  const ratio = Math.max(0, Math.min(1, y / rect.height))
  const mins = (wakeMinutes.value as number) + ratio * minutesRange.value
  const rounded = Math.round(mins / 5) * 5

  // Convert minutes + selected day to a UTC start_date for API.
  const { y: yy, m, d } = parseSelectedYmd(selectedDate.value)
  const hm = minutesToHm(rounded)
  const [hs, ms] = hm.split(':')
  const date = new Date(yy, m - 1, d, Number(hs), Number(ms), 0)
  const startLocal = toLocalDateTimeInputValue(date)
  const startUtcIso = toUtcISOStringFromLocalInput(startLocal)

  const est = taskEstimatedMinutes(taskId)
  const endUtcIso = est != null ? addMinutesToUtcIso(startUtcIso, est) : null

  try {
    await blocksStore.create({
      task: taskId,
      start_date: startUtcIso,
      ...(endUtcIso ? { end_date: endUtcIso } : {}),
    } as Partial<Block>)
  } catch (error) {
    console.error('Failed to create block from drop:', error)
    alert('Failed to create block')
  }
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
  const end = block.end_date ? formatTimeOnly(block.end_date) : minutesToHm(blockEndMinutes(block))
  return `${start}–${end}`
}

// --- Focus-on-block (timer + card fill) ---
const focusNowMs = ref(Date.now())
let focusTicker: number | null = null

const markDoneInFlightByBlockId = ref<Record<number, true>>({})

async function maybeMarkActiveBlockDone() {
  const taskId = globalActiveTaskId()
  if (taskId == null) return
  const blockId = focusStore.activeBlockId
  if (blockId == null) return

  const block = blocksStore.items.find((b) => b.id === blockId)
  if (!block) return
  if (block.done) return

  const est = taskEstimatedMinutes(taskId)
  if (est == null) return
  const elapsedMin = effectiveElapsedMsForTask(taskId) / 60000
  if (elapsedMin < est) return

  if (markDoneInFlightByBlockId.value[blockId]) return
  markDoneInFlightByBlockId.value = { ...markDoneInFlightByBlockId.value, [blockId]: true }
  try {
    await blocksStore.update(blockId, { done: true } as Partial<Block>)
  } catch (error) {
    console.error('Failed to mark block done:', error)
  } finally {
    if (markDoneInFlightByBlockId.value[blockId]) {
      const next = { ...markDoneInFlightByBlockId.value }
      delete next[blockId]
      markDoneInFlightByBlockId.value = next
    }
  }
}

function startFocusTicker() {
  if (focusTicker != null) return
  focusNowMs.value = Date.now()
  focusTicker = window.setInterval(() => {
    focusNowMs.value = Date.now()
    void maybeMarkActiveBlockDone()
  }, 1000)
}

function stopFocusTicker() {
  if (focusTicker == null) return
  window.clearInterval(focusTicker)
  focusTicker = null
}

function activeFocusForTask(taskId: number) {
  return focusStore.activeByTask[taskId] || null
}

function isFocusingTask(taskId: number) {
  return !!activeFocusForTask(taskId)
}

function globalActiveTaskId() {
  const entry = Object.entries(focusStore.activeByTask).find(([, s]) => !!s)
  return entry ? Number(entry[0]) : null
}

function canStartFocusForTask(taskId: number) {
  const activeTask = globalActiveTaskId()
  return activeTask == null || activeTask === taskId
}

function taskEstimatedMinutes(taskId: number) {
  const task = tasksStore.items.find((t) => t.id === taskId)
  const est = task?.estimated_minutes
  if (!Number.isFinite(est as number)) return null
  const n = Number(est)
  if (n <= 0) return null
  return n
}

function effectiveElapsedMsForTask(taskId: number) {
  return focusStore.effectiveElapsedMs(taskId, focusNowMs.value)
}

function formatTinyTimer(taskId: number) {
  const ms = effectiveElapsedMsForTask(taskId)
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function completedMinutesForBlock(block: Block) {
  const entry = focusStore.completedBlocks?.[block.id]
  if (!entry) return null
  const minutes = Number(entry.minutes)
  if (!Number.isFinite(minutes) || minutes < 0) return 0
  return minutes
}

function minutesSpentForBlock(block: Block) {
  const active = activeFocusForTask(block.task)
  if (active) return effectiveElapsedMsForTask(block.task) / 60000
  const completed = completedMinutesForBlock(block)
  if (completed != null) return completed
  return 0
}

function blockPlannedDurationMinutes(block: Block) {
  if (block.end_date) {
    const startMs = new Date(block.start_date).getTime()
    const endMs = new Date(block.end_date).getTime()
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return Math.max(10, Math.round((endMs - startMs) / 60000))
    }
  }

  return 30
}

function isBlockCompleted(block: Block) {
  return !!block.done
}

function fillPercentForBlock(block: Block) {
  if (block.done) return 100
  const target = taskEstimatedMinutes(block.task) ?? blockPlannedDurationMinutes(block)
  if (!Number.isFinite(target) || target <= 0) return 0
  const pct = (minutesSpentForBlock(block) / target) * 100
  // Keep <100% unless the backend says it's done.
  return Math.max(0, Math.min(99.9, pct))
}

async function onBlockFocusStart(block: Block) {
  if (!canStartFocusForTask(block.task)) {
    alert('Finish the current focus (Done) before starting another.')
    return
  }
  try {
    // Ensure we have task estimates before starting focus so fill/height are correct.
    if (!tasksStore.items.length && !tasksStore.loading) {
      await tasksStore.fetchAll()
    }
    await focusStore.start(block.task, '', block.id)
    focusStore.clearPause()
  } catch (error) {
    console.error('Failed to start focus:', error)
    alert('Finish the current focus (Done) before starting another.')
  }
}

async function onBlockFocusDone(block: Block) {
  const active = activeFocusForTask(block.task)
  if (!active) return
  try {
    await focusStore.stop(active.id, true)
  } catch (error) {
    console.error('Failed to stop focus:', error)
    alert('Failed to stop focus')
  }
}

watch(
  () => Object.values(focusStore.activeByTask).map((s) => s?.id || 0).join(','),
  (ids) => {
    if (ids && ids !== '0') startFocusTicker()
    else stopFocusTicker()
  },
  { immediate: true },
)

// --- Current time indicator (only for today) ---
const now = ref(new Date())
let nowTimer: number | null = null

function updateNow() {
  now.value = new Date()
}

const todayYmd = computed(() => {
  const d = now.value
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

const showNowIndicator = computed(() => boundsValid.value && selectedDate.value === todayYmd.value)

const axisFillHeightPx = computed(() => {
  if (!boundsValid.value) return 0
  // YYYY-MM-DD lexicographic compare is safe.
  if (selectedDate.value < todayYmd.value) return timelineHeightPx.value
  if (selectedDate.value > todayYmd.value) return 0
  return nowTopPx.value
})

const nowMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
const nowTopPx = computed(() => (showNowIndicator.value ? markerForMinutes(nowMinutes.value) : 0))
const nowLabel = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`)

const nowMarkerVariant = computed(() => {
  if (!showNowIndicator.value) return 'mid' as const
  const px = nowTopPx.value
  const h = timelineHeightPx.value
  if (px <= 6) return 'top' as const
  if (px >= h - 6) return 'bottom' as const
  return 'mid' as const
})

onMounted(() => {
  initializeDate()
  updateNow()
  if (nowTimer == null) {
    // Update at a low cadence; minute precision is enough.
    nowTimer = window.setInterval(updateNow, 30_000)
  }
  const existing = dayBoundsStore.get()
  if (existing) {
    wakeTime.value = existing.wake
    sleepTime.value = existing.sleep
  }

  // Fetch in parallel; blocks should render even while tasks are still loading.
  void tasksStore.fetchAll()
  void blocksStore.fetchAll()
  void focusStore.fetchAll()
})

onBeforeUnmount(() => {
  clearPendingBlockDrag()
  stopFocusTicker()
  if (nowTimer != null) {
    window.clearInterval(nowTimer)
    nowTimer = null
  }
  window.removeEventListener('pointermove', onBlockPointerMove)
  window.removeEventListener('pointerup', onBlockPointerUp)
  window.removeEventListener('pointercancel', onBlockPointerUp)
  window.removeEventListener('touchmove', preventTouchScroll)
})
</script>

<template>
  <div
    class="timeline-container"
    :class="{ 'swipe-flash-prev': swipeIndicator === 'prev', 'swipe-flash-next': swipeIndicator === 'next' }"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div class="timeline-layout">
      <div class="today-panel">
        <TaskColumn
          title="Today"
          status="today"
          :tasks="todayTasks"
          default-color="#fee2e2"
          :sortable="false"
          external-drop-selector="[data-timeline-drop]"
          @remove="tasksStore.remove($event)"
          @external-drop="createBlockFromTaskDrop($event.taskId, $event.clientY)"
        />
      </div>

      <div class="timeline-pane">
        <div class="timeline-inner">
          <div v-if="swipeIndicator" class="swipe-indicator" :class="swipeIndicator">
            <ChevronLeft v-if="swipeIndicator === 'prev'" :size="18" />
            <ChevronRight v-else :size="18" />
            <span>{{ swipeIndicator === 'prev' ? 'Previous day' : 'Next day' }}</span>
          </div>

          <!-- Day selection slider -->
          <div class="day-slider">
            <el-button circle @click="changeDay(-1)" aria-label="Previous day" title="Previous day">
              <ChevronLeft :size="18" />
            </el-button>

            <div class="day-current">
              <el-date-picker
                v-model="selectedDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="Select day"
              />
            </div>

            <el-button circle @click="changeDay(1)" aria-label="Next day" title="Next day">
              <ChevronRight :size="18" />
            </el-button>
          </div>
        <el-dialog
          v-model="showModal"
          :title="editingBlockId ? 'Edit Block' : 'New Block'"
          width="520px"
          @close="cancelForm"
        >
          <el-form label-position="top">
            <el-form-item label="Task *">
              <el-select v-model="selectedTaskId" placeholder="Select a task" filterable clearable>
                <el-option
                  v-for="task in tasksStore.items"
                  :key="task.id"
                  :label="task.title"
                  :value="task.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Start Time *">
              <el-date-picker
                v-model="startDate"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm"
                placeholder="Select start time"
              />
            </el-form-item>
          </el-form>

          <template #footer>
            <el-button @click="cancelForm">Cancel</el-button>
            <el-button type="primary" @click="submitBlock">{{ editingBlockId ? 'Save' : 'Create' }}</el-button>
          </template>
        </el-dialog>

        <!-- Bounds modal (set/edit wake/sleep) -->
        <el-dialog v-model="showBoundsModal" title="Day Bounds" width="520px" @close="cancelBounds">
          <el-form label-position="top">
            <el-row :gutter="12">
              <el-col :xs="24" :sm="12">
                <el-form-item label="Wake *">
                  <el-time-select v-model="wakeTime" start="00:00" step="00:05" end="23:55" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="Sleep *">
                  <el-time-select v-model="sleepTime" start="00:00" step="00:05" end="23:55" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-alert v-if="hasBounds && !boundsValid" title="Sleep must be after wake." type="error" show-icon />
          </el-form>

          <template #footer>
            <el-button @click="cancelBounds">Cancel</el-button>
            <el-button type="primary" @click="saveBounds">Save</el-button>
          </template>
        </el-dialog>

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
              <el-button type="primary" @click="openBoundsEditor" aria-label="Set day bounds" title="Set day bounds">
                <Clock :size="18" />
                <span style="margin-left: 6px">Set day bounds</span>
              </el-button>
            </div>

            <div v-else class="mainline-wrap">
              <div
                class="mainline"
                data-timeline-drop
                :style="{ height: timelineHeightPx + 'px' }"
                ref="timelineTrackRef"
                @click="onTimelineClick"
              >
          <!-- time axis: single thick empty track + filled portion (today only) -->
          <div class="axis-track" aria-hidden="true">
            <div v-if="axisFillHeightPx > 0" class="axis-fill" :style="{ height: axisFillHeightPx + 'px' }"></div>
          </div>
          <div
            v-if="showNowIndicator"
            class="now-marker"
            :class="`now-marker--${nowMarkerVariant}`"
            :style="{ top: nowTopPx + 'px' }"
            aria-hidden="true"
          >
            <div class="now-dot"></div>
            <div class="now-label">{{ nowLabel }}</div>
          </div>

          <!-- axis line replaced by .axis-track -->

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
                  <el-button
                    text
                    circle
                    size="small"
                    @click.stop="openBoundsEditor"
                    aria-label="Edit day bounds"
                    title="Edit day bounds"
                  >
                    <Pencil :size="16" />
                  </el-button>
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
            :class="{ dragging: draggingBlockId === block.id }"
            :style="{
              top:
                draggingBlockId === block.id && draggingTopPx != null
                  ? draggingTopPx + 'px'
                  : blockTopPx(block) + 'px',
              height: blockHeightPx(block) + 'px',
              ...blockStyleVars(block),
            }"
            @pointerdown="onBlockPointerDown(block, $event)"
            @contextmenu.prevent
            @click.stop
          >
            <div class="block-core">
              <div
                class="block-pill"
                :class="{ 'is-complete': isBlockCompleted(block) }"
              />
            </div>
            <div
              class="bubble bubble-block"
              :class="{ 'is-complete': isBlockCompleted(block) }"
              :style="{
                borderColor: 'var(--task-color)',
                '--focus-fill-pct': fillPercentForBlock(block) + '%',
              }"
            >
              <div class="bubble-content">
                <div class="bubble-title-row">
                  <div class="bubble-title">{{ getTaskTitle(block.task) }}</div>
                  <div class="bubble-actions inline">
                    <template v-if="isFocusingTask(block.task)">
                      <el-button
                        text
                        circle
                        size="small"
                        class="mini-icon-btn"
                        :aria-label="focusStore.isPaused(block.task) ? 'Resume focus timer' : 'Stop focus timer temporarily'"
                        :title="focusStore.isPaused(block.task) ? 'Resume' : 'Stop'"
                        @click.stop="focusStore.isPaused(block.task) ? focusStore.resume(block.task) : focusStore.pause(block.task)"
                      >
                        <Play v-if="focusStore.isPaused(block.task)" :size="14" />
                        <Pause v-else :size="14" />
                      </el-button>

                      <el-button
                        text
                        circle
                        size="small"
                        class="mini-icon-btn"
                        type="success"
                        aria-label="Done (end focus session)"
                        title="Done"
                        @click.stop="onBlockFocusDone(block)"
                      >
                        <Check :size="14" />
                      </el-button>
                    </template>
                    <template v-else>
                      <el-button
                        text
                        circle
                        size="small"
                        class="mini-icon-btn"
                        type="primary"
                        aria-label="Focus (start timer)"
                        :title="canStartFocusForTask(block.task) ? 'Focus' : 'Finish current focus (Done) first'"
                        @click.stop="onBlockFocusStart(block)"
                        :disabled="!canStartFocusForTask(block.task)"
                      >
                        <Play :size="14" />
                      </el-button>
                    </template>

                    <el-button
                      text
                      circle
                      size="small"
                      class="mini-icon-btn"
                      @click.stop="editBlock(block)"
                      aria-label="Edit block"
                      title="Edit"
                    >
                      <Pencil :size="16" />
                    </el-button>
                    <el-popconfirm
                      title="Delete this block?"
                      confirm-button-text="Delete"
                      cancel-button-text="Cancel"
                      confirm-button-type="danger"
                      @confirm="deleteBlock(block.id)"
                    >
                      <template #reference>
                        <el-button
                          text
                          circle
                          size="small"
                          type="danger"
                          class="mini-icon-btn"
                          aria-label="Delete block"
                          title="Delete"
                        >
                          <Trash2 :size="16" />
                        </el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </div>

                <div class="bubble-sub">{{ formatTimeRange(block) }}</div>
              </div>

              <div v-if="isFocusingTask(block.task)" class="focus-tiny-timer" aria-hidden="true">
                {{ formatTinyTimer(block.task) }}
              </div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  --timeline-accent: #f36593;
  max-width: 1100px;
  margin: 0 auto;
  padding: clamp(12px, 2.5vw, 20px);
  position: relative;
}

.timeline-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.today-panel {
  --column-list-max-height: min(42vh, 360px);
  margin-top: 50px;
}

.timeline-pane {
  min-width: 0;
}

.timeline-inner {
  width: 100%;
  max-width: 760px;
  position: relative;
}

@media (min-width: 900px) {
  /* Full-width on desktop so the timeline can truly sit centered in the viewport,
     while Today stays at the far left. */
  .timeline-container {
    max-width: none;
    margin: 0;
  }

  .timeline-layout {
    display: grid;
    grid-template-columns: 360px minmax(0, 760px) 1fr;
    align-items: start;
    column-gap: 16px;
  }

  .today-panel {
    grid-column: 1;
  }

  .timeline-pane {
    grid-column: 2;
  }
}

.block-item {
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.block-item.dragging {
  cursor: grabbing;
  z-index: 6;
  touch-action: none;
}

.swipe-indicator {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.78);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(6px);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
  animation: swipe-pill 450ms ease both;
  max-width: calc(100% - 24px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.swipe-indicator.prev {
  left: 10px;
  transform: translateY(-50%);
}

.swipe-indicator.next {
  right: 10px;
  transform: translateY(-50%);
}

.timeline-container.swipe-flash-prev::before,
.timeline-container.swipe-flash-next::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border-radius: 12px;
  animation: swipe-flash 450ms ease both;
}

.timeline-container.swipe-flash-prev::before {
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.16), transparent 42%);
}

.timeline-container.swipe-flash-next::before {
  background: linear-gradient(270deg, rgba(37, 99, 235, 0.16), transparent 42%);
}

@keyframes swipe-pill {
  0% {
    opacity: 0;
    transform: translateY(-50%) scale(0.98);
  }
  18% {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-50%) scale(0.98);
  }
}

@keyframes swipe-flash {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
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
  border-color: var(--timeline-accent);
  box-shadow: 0 0 0 3px rgba(243, 101, 147, 0.18);
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
  background: var(--timeline-accent);
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
  filter: brightness(0.95);
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
  width: 100%;
  overflow-x: hidden;
}

.mainline {
  position: relative;
  width: 100%;
  cursor: pointer;
  --line-x: 44px;
  --axis-w: 10px;
}

.axis-track {
  position: absolute;
  left: calc(var(--line-x) - (var(--axis-w) / 2));
  top: 0;
  bottom: 0;
  width: var(--axis-w);
  border-radius: 999px;
  background: #e9ecef;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.axis-fill {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  background: var(--timeline-accent);
  border-radius: 999px;
}

.now-marker {
  position: absolute;
  left: var(--line-x);
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  z-index: 3;
  pointer-events: none;
}

.now-marker--top {
  transform: translateY(0);
}

.now-marker--bottom {
  transform: translateY(-100%);
}

.now-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--timeline-accent);
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #dee2e6;
  margin-left: -5px;
}

.now-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--timeline-accent);
  background: #fff;
  padding: 2px 8px;
  border-radius: 999px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
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
  max-width: calc(var(--line-x) - 10px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tick-mark {
  position: absolute;
  left: var(--line-x);
  width: 18px;
  height: 1px;
  transform: translateX(-50%);
  background: #e9ecef;
  display: none;
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
  background: var(--timeline-accent);
  border: 3px solid white;
  box-shadow: 0 0 0 1px #dee2e6;
  flex: 0 0 auto;
  margin-left: -13px;
}

.dot-system {
  width: 25px;
  height: 3px;
  border-radius: 9999px;
  background: #000000;
  border: none;
  box-shadow: none;
  margin-left: -13px;
}

.bubble {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  padding: 10px 12px;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
  max-width: 100%;
  min-width: 0;
}

/* Timeline blocks should be "empty" outlines (colored border, no fill). */
.bubble.bubble-block {
  --focus-fill-pct: 0%;
  background: #fff;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.bubble.bubble-block::before {
  content: '';
  position: absolute;
  inset: 0;
  width: var(--focus-fill-pct);
  background: var(--task-color);
  opacity: 0.18;
  pointer-events: none;
}

.bubble.bubble-block.is-complete::before {
  width: 100%;
  opacity: 0.85;
}

.bubble.bubble-block.is-complete {
  border-color: var(--task-color);
}

.bubble.bubble-block.is-complete .bubble-title,
.bubble.bubble-block.is-complete .bubble-sub,
.bubble.bubble-block.is-complete .focus-tiny-timer {
  color: #fff;
}

.bubble.bubble-block.is-complete .mini-icon-btn {
  color: #fff;
}

.block-pill.is-complete {
  background: var(--task-color);
  border-color: var(--task-color);
}

.bubble-content {
  position: relative;
  z-index: 1;
}

.mini-icon-btn {
  width: 26px;
  height: 26px;
  padding: 0;
}

.focus-progress {
  margin-top: 8px;
}

.focus-progress-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  overflow: hidden;
}

.focus-progress-fill {
  height: 100%;
  width: 0%;
  background: var(--task-color);
  opacity: 0.6;
  transition: width 0.35s linear;
}

.focus-tiny-timer {
  position: absolute;
  right: 8px;
  bottom: 6px;
  z-index: 2;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
  pointer-events: none;
}

/* Duration-aware blocks */
.block-item {
  position: absolute;
  left: var(--line-x);
  transform: none;
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - var(--line-x) - 8px);
  z-index: 2;
}

.block-core {
  width: 22px;
  position: relative;
  z-index: 4;
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
  background: #fff;
  border: 2px solid var(--task-color);
  box-shadow: none;
  position: relative;
  z-index: 4;
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
  min-width: 0;
}

.bubble-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex: 0 0 auto;
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
  .timeline-container {
    padding: 12px;
  }

  .mainline-wrap {
    padding: 12px;
    max-width: none;
  }

 

  :deep(.el-dialog) {
    max-width: calc(100vw - 24px);
    margin: 12px auto;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  /* Keep blocks inside the available width (account for left gutter). */
 .marker,
  .block-item {
    width: calc(100% - var(--line-x) - 8px);
  }

  .bubble {
    max-width: none;
  }
}
</style>
