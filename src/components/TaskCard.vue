<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import type { Task } from '../types'
import { useFocusStore } from '../stores/focusSessions'
import { useTasksStore } from '../stores/tasks'
import { Check, Pause, Pencil, Play, Timer, Trash2, X } from 'lucide-vue-next'

// Define Props Interface for cleaner syntax and environment compatibility
interface TaskCardProps {
  task: Task
  theme_color?: string
  background_color?: string
  color?: string
}

// Props with defaults
const props = withDefaults(defineProps<TaskCardProps>(), {
  theme_color: '#10b981', // Default Green
  background_color: '#ffffff', // Default White
  color: '#1f2937', // Default Dark Gray
})

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'remove', id: number): void
}>()

const focusStore = useFocusStore()
const { activeByTask } = storeToRefs(focusStore)
const tasksStore = useTasksStore()

const effectiveThemeColor = computed(() => props.task.theme_color || props.theme_color)
const effectiveBgColor = computed(() => props.task.background_color || props.background_color)
const effectiveTextColor = computed(() => props.task.color || props.color)

// CSS Variables based on Resolved Colors
const rootStyles = computed(() => ({
  '--card-bg': effectiveBgColor.value,
  '--card-text': effectiveTextColor.value,
  '--card-theme': effectiveThemeColor.value,
  '--card-border':
    effectiveBgColor.value === '#ffffff'
      ? '#e5e7eb'
      : `color-mix(in srgb, ${effectiveTextColor.value}, transparent 80%)`,
  '--card-input-bg':
    effectiveBgColor.value === '#ffffff'
      ? '#ffffff'
      : `color-mix(in srgb, ${effectiveBgColor.value}, white 10%)`,
}))

const focusedMinutes = computed(() => focusStore.totalMinutesForTask(props.task.id))

const progressStyle = computed(() => ({
  width: `${Math.min(100, Math.max(0, props.task.progress))}%`,
}))

// --- Edit State ---
const editing = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editEstimated = ref<number>(0)

// New Color State Refs
const editThemeColor = ref('')
const editBackgroundColor = ref('')
const editTextColor = ref('')

const saving = ref(false)
const editError = ref('')
const titleRef = ref<HTMLInputElement | null>(null)

// Minimal focus controls state (inline)
const elapsedSec = ref(0)
const ticker = ref<number | null>(null)
const paused = ref(false)
const activeSession = computed(() => activeByTask.value[props.task.id] || null)

function tickElapsed() {
  if (!paused.value) {
    elapsedSec.value += 1
  }
}

const elapsedText = computed(() => {
  const m = Math.floor(elapsedSec.value / 60)
  const s = elapsedSec.value % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

watch(
  () => activeSession.value?.id,
  () => {
    if (activeSession.value) {
      // start local timer
      paused.value = false
      elapsedSec.value = 0
      if (ticker.value) window.clearInterval(ticker.value)
      ticker.value = window.setInterval(tickElapsed, 1000)
    } else {
      // clear when session ends
      paused.value = false
      if (ticker.value) {
        window.clearInterval(ticker.value)
        ticker.value = null
      }
      elapsedSec.value = 0
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (ticker.value) window.clearInterval(ticker.value)
})

async function startFocusQuick() {
  await focusStore.start(props.task.id, '')
}

function stopFocusQuick() {
  if (!activeSession.value) return
  // Pause locally without ending the session
  paused.value = true
  if (ticker.value) {
    window.clearInterval(ticker.value)
    ticker.value = null
  }
}

async function endFocusQuick() {
  if (!activeSession.value) return
  await focusStore.stop(activeSession.value.id, true)
  paused.value = false
  if (ticker.value) {
    window.clearInterval(ticker.value)
    ticker.value = null
  }
}

function onFocusButtonClick() {
  if (!activeSession.value) {
    startFocusQuick()
  } else {
    if (paused.value) {
      // resume
      paused.value = false
      if (ticker.value) window.clearInterval(ticker.value)
      ticker.value = window.setInterval(tickElapsed, 1000)
    } else {
      // pause
      stopFocusQuick()
    }
  }
}

// Watch for task changes to initialize edit form
watch(
  () => props.task,
  (t) => {
    if (!t) return
    editTitle.value = t.title || ''
    editDescription.value = t.description || ''
    editEstimated.value = t.estimated_minutes ?? 0

    // Initialize colors from the Task object first, fallback to props/defaults
    editThemeColor.value = t.theme_color || props.theme_color
    editBackgroundColor.value = t.background_color || props.background_color
    editTextColor.value = t.color || props.color
  },
  { immediate: true, deep: true },
)

// Palettes and presets (for color selection)
// Unified palette used for theme, background, and text
const commonPalette = ['#111827', '#374151', '#6b7280', '#000000', '#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6', '#10b981', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6']

// Palette menu (single teleported dropdown) with auto positioning
type PaletteKind = 'theme' | 'bg' | 'text'
const openPalette = ref<PaletteKind | null>(null)
const menuPos = ref<{ top: number; left: number } | null>(null)

const MENU_W = 360
const MENU_H = 224

function computeMenuPosition(anchorEl: HTMLElement) {
  const rect = anchorEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top = rect.bottom + 6
  let left = rect.left
  if (top + MENU_H > vh - 8 && rect.top - 6 - MENU_H >= 8) {
    top = rect.top - 6 - MENU_H
  }
  if (left + MENU_W > vw - 8) {
    left = Math.max(8, vw - MENU_W - 8)
  }
  if (left < 8) left = 8
  if (top < 8) top = 8
  return { top, left }
}

function openPaletteMenu(kind: PaletteKind, e: MouseEvent) {
  e.stopPropagation()
  const current = openPalette.value
  if (current === kind) {
    openPalette.value = null
    return
  }
  const target = e.currentTarget as HTMLElement
  menuPos.value = computeMenuPosition(target)
  openPalette.value = kind
}

function pickColor(c: string) {
  if (!openPalette.value) return
  if (openPalette.value === 'theme') editThemeColor.value = c
  else if (openPalette.value === 'bg') editBackgroundColor.value = c
  else editTextColor.value = c
  openPalette.value = null
}

function isSelected(c: string) {
  if (openPalette.value === 'theme') return editThemeColor.value === c
  if (openPalette.value === 'bg') return editBackgroundColor.value === c
  if (openPalette.value === 'text') return editTextColor.value === c
  return false
}

function closePalettes() {
  openPalette.value = null
}

function onDocClick() {
  closePalettes()
}

function onWindowChange() {
  // Close on resize/scroll to avoid misaligned menus
  closePalettes()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', onWindowChange)
  window.addEventListener('scroll', onWindowChange, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})

function openEdit() {
  editError.value = ''
  editing.value = true
  nextTick(() => titleRef.value?.focus())
}

function closeEdit() {
  editing.value = false
}

async function saveEdit() {
  if (!props.task) return
  saving.value = true
  editError.value = ''
  try {
    const updated = await tasksStore.update(props.task.id, {
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      estimated_minutes: Number(editEstimated.value) || 0,
      // Save color preferences
      theme_color: editThemeColor.value,
      background_color: editBackgroundColor.value,
      color: editTextColor.value,
    })
    emit('edit', updated)
    editing.value = false
  } catch (err: unknown) {
    editError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('text/task-id', String(props.task.id))
  e.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <div class="card" :style="rootStyles" draggable="true" @dragstart="onDragStart">
    <div class="card-header">
      <h4 class="title">
        <router-link :to="`/tasks/${task.id}`">{{ task.title }}</router-link>
      </h4>
      <div class="actions">
        <!-- Show timer and End only during an active focus -->
        <template v-if="activeSession">
          <div class="focus-min">
            <span class="focus-time">{{ elapsedText }}</span>
            <button
              class="focus-toggle"
              :title="paused ? 'Resume' : 'Pause'"
              :aria-label="paused ? 'Resume focus' : 'Pause focus'"
              @click="onFocusButtonClick"
            >
              <Play v-if="paused" :size="14" />
              <Pause v-else :size="14" />
            </button>
            <button class="focus-end" title="End" aria-label="End focus" @click="endFocusQuick">
              <Check :size="14" />
            </button>
          </div>
        </template>
        <template v-else>
          <button class="focus-toggle" title="Focus" aria-label="Start focus" @click="onFocusButtonClick">
            <Timer :size="14" />
          </button>
        </template>

        <button class="icon" title="Edit" aria-label="Edit" @click="openEdit">
          <Pencil :size="16" />
        </button>
        <button class="icon" title="Delete" aria-label="Delete" @click="emit('remove', task.id)">
          <Trash2 :size="16" />
        </button>
      </div>
    </div>
    <p class="desc" v-if="task.description">{{ task.description }}</p>

    <div class="progress">
      <div class="bar" :style="progressStyle"></div>
    </div>
    <div class="meta">
      <span>Progress: {{ task.progress }}%</span>
      <span>Est: {{ task.estimated_minutes }}m</span>
      <span>Focused: {{ focusedMinutes }}m</span>
    </div>
    <div v-if="editing" class="edit-panel">
      <div class="edit-panel-inner">
        <!-- Title -->
        <div class="edit-row">
          <div class="edit-col">
            <label class="lbl">Title</label>
            <input ref="titleRef" v-model="editTitle" class="small-input" />
          </div>
        </div>

        <!-- Description -->
        <div class="edit-row">
          <div class="edit-col">
            <label class="lbl">Description</label>
            <textarea v-model="editDescription" rows="2" class="small-textarea"></textarea>
          </div>
        </div>

        <!-- Numbers -->
        <div class="edit-row fields-row">
          <div class="edit-col small">
            <label class="lbl">Est. minutes</label>
            <input type="number" v-model.number="editEstimated" min="0" class="small-input" />
          </div>
        </div>

        <!-- Per-field color palettes (open on click instead of color picker) -->
        <div class="edit-row fields-row">
          <div class="edit-col small">
            <label class="lbl">Theme</label>
            <button class="color-wrapper" @click.stop="openPaletteMenu('theme', $event)">
              <span class="swatch" :style="{ background: editThemeColor }"></span>
              <span class="color-val">{{ editThemeColor }}</span>
            </button>
          </div>
          <div class="edit-col small">
            <label class="lbl">Background</label>
            <button class="color-wrapper" @click.stop="openPaletteMenu('bg', $event)">
              <span class="swatch" :style="{ background: editBackgroundColor }"></span>
              <span class="color-val">{{ editBackgroundColor }}</span>
            </button>
          </div>
          <div class="edit-col small">
            <label class="lbl">Text</label>
            <button class="color-wrapper" @click.stop="openPaletteMenu('text', $event)">
              <span class="swatch" :style="{ background: editTextColor }"></span>
              <span class="color-val">{{ editTextColor }}</span>
            </button>
          </div>
        </div>

        <!-- Teleported palette menu -->
        <teleport to="body">
          <div
            v-if="openPalette && menuPos"
            class="palette-menu"
            :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
            @click.stop
          >
            <div class="color-palette">
              <button
                v-for="c in commonPalette"
                :key="'p-' + c"
                class="swatch"
                :style="{ background: c, border: isSelected(c) ? '2px solid rgba(0,0,0,0.18)' : '1px solid rgba(0,0,0,0.06)' }"
                @click="pickColor(c)"
                :title="c"
              />
            </div>
          </div>
        </teleport>

        <!-- Actions -->
        <div class="edit-actions">
          <button class="btn-save" @click="saveEdit" :disabled="saving" aria-label="Save" title="Save">
            <Check :size="16" />
          </button>
          <button class="btn-cancel" @click="closeEdit" aria-label="Cancel" title="Cancel">
            <X :size="16" />
          </button>
        </div>
        <p v-if="editError" class="error">{{ editError }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main Card Styles */
.card {
  background: var(--card-bg);
  color: var(--card-text);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  transition:
    box-shadow 0.12s ease,
    transform 0.08s ease;
  position: relative;
  cursor: grab;
}

.card:hover {
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08);
  transform: translateY(-2px);
}

.card:active {
  cursor: grabbing;
}

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 14px;
  cursor: pointer;
}

.card-header .title a {
  color: inherit;
  text-decoration: none;
}

.card-header .title a:hover {
  text-decoration: underline;
}

.actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.focus-min {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.focus-time {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  opacity: 0.8;
}
.focus-toggle,
.focus-end {
  border: 1px solid var(--card-border);
  background: var(--card-input-bg);
  color: var(--card-text);
  border-radius: 999px;
  padding: 0 8px;
  height: 22px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.focus-end:disabled { opacity: 0.5; cursor: not-allowed }

.icon {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--card-text);
  opacity: 0.7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon:hover {
  opacity: 1;
  color: var(--card-theme);
}

.desc {
  color: var(--card-text);
  opacity: 0.75;
  font-size: 12px;
  margin: 0;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Progress */
.progress {
  width: 100%;
  height: 8px;
  background: rgba(128, 128, 128, 0.15);
  border-radius: 999px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: var(--card-theme);
}

/* Meta */
.meta {
  display: flex;
  gap: 12px;
  color: var(--card-text);
  opacity: 0.6;
  font-size: 12px;
  align-items: center;
}

/* Edit Panel */
.edit-panel {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 10px;
  margin-top: 8px;
}

.edit-panel-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.edit-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.lbl {
  font-size: 12px;
  color: var(--card-text);
  opacity: 0.9;
  margin-bottom: 4px;
  display: block;
}

.small-input,
.small-textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--card-border);
  background: var(--card-input-bg);
  color: var(--card-text);
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.small-input:focus,
.small-textarea:focus {
  outline: 2px solid var(--card-theme);
  border-color: transparent;
}

.fields-row {
  display: flex;
  gap: 8px;
}

.field.small {
  flex: 1;
}

/* Color Picker Styles */
.color-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--card-input-bg);
  border: 1px solid var(--card-border);
  padding: 4px;
  border-radius: 6px;
  height: 32px; /* Match height of text inputs approximately */
  box-sizing: border-box;
}

.color-palette {
  display: grid;
  grid-template-columns: repeat(8, 28px);
  gap: 8px;
  align-items: center;
}

.palette-menu {
  position: fixed;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  background: #ffffff;
  border: 1px solid var(--card-border, #e5e7eb);
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 12px 28px rgba(16, 24, 40, 0.14);
  width: 280px; /* matches 8 columns: 8*28 + 7*8 + 2*10 padding */
  max-width: 90vw;
}

.swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.swatch:hover,
.swatch:focus-visible {
  transform: scale(1.08);
  box-shadow: 0 0 0 2px var(--card-border);
  outline: none;
}

/* no single change-color button in per-field palette mode */

.color-input {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.color-val {
  font-size: 10px;
  color: var(--card-text);
  opacity: 0.7;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
}

/* Actions */
.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-save {
  background: var(--card-theme);
  color: var(--card-text);
  border: none;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-save:hover {
  opacity: 0.9;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--card-text);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel:hover {
  opacity: 1;
  background: rgba(128, 128, 128, 0.05);
}

.error {
  color: #ef4444;
  font-size: 12px;
  margin: 0;
}

/* Tiny focus bar */
.focusbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 4px 8px;
  border: 1px solid var(--card-border);
  background: color-mix(in srgb, var(--card-theme), #ffffff 88%);
  color: var(--card-text);
  border-radius: 999px;
  width: max-content;
}
.focus-time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  opacity: 0.9;
}
.focus-stop,
.focus-resume,
.focus-close {
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--card-text);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
.focus-stop {
  border-color: rgba(239, 68, 68, 0.3);
}
.focus-resume {
  border-color: rgba(16, 185, 129, 0.3);
}
.focus-close {
  padding: 0 6px;
}

/* removed unified preset window and progress-edit styles */
</style>
