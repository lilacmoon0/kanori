<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { InputInstance } from 'element-plus'
import type { Task } from '../types'
import { useTasksStore } from '../stores/tasks'
import { useFocusStore } from '../stores/focusSessions'
import { Pencil, Trash2 } from 'lucide-vue-next'

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

const tasksStore = useTasksStore()
const focusStore = useFocusStore()

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

const progressStyle = computed(() => ({
  width: `${Math.min(100, Math.max(0, props.task.progress))}%`,
}))

const focusedMinutes = computed(() => focusStore.totalMinutesForTask(props.task.id) || 0)
const estimatedMinutes = computed(() => {
  const n = Number(props.task.estimated_minutes)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
})

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
const titleRef = ref<InputInstance | null>(null)



watch(
  () => props.task,
  (t) => {
    if (!t) return
    editTitle.value = t.title || ''
    editDescription.value = t.description || ''
    editEstimated.value = t.estimated_minutes ?? 0

    editThemeColor.value = t.theme_color || props.theme_color
    editBackgroundColor.value = t.background_color || props.background_color
    editTextColor.value = t.color || props.color
  },
  { immediate: true, deep: true },
)

const commonPalette = ['#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6']

type PaletteKind = 'theme' | 'bg' | 'text'
const openPalette = ref<PaletteKind | null>(null)
const menuPos = ref<{ top: number; left: number } | null>(null)

const MENU_W = 280
const MENU_H = 224

function computeMenuPosition(anchorEl: HTMLElement) {
  const rect = anchorEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const menuW = Math.min(MENU_W, Math.max(200, vw - 16))
  const menuH = Math.min(MENU_H, Math.max(160, vh - 16))
  let top = rect.bottom + 6
  let left = rect.left
  if (top + menuH > vh - 8 && rect.top - 6 - menuH >= 8) {
    top = rect.top - 6 - menuH
  }
  if (left + menuW > vw - 8) {
    left = Math.max(8, vw - menuW - 8)
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
  nextTick(() => titleRef.value?.focus?.())
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

</script>

<template>
  <el-card
    class="card"
    :class="{ 'is-editing': editing }"
    :style="rootStyles"
    shadow="never"
  >
    <div class="actions">
        <el-button text circle title="Edit" aria-label="Edit" @click="openEdit">
          <Pencil :size="16" />
        </el-button>
        <el-popconfirm
          title="Delete this task?"
          confirm-button-text="Delete"
          cancel-button-text="Cancel"
          confirm-button-type="danger"
          @confirm="emit('remove', task.id)"
        >
          <template #reference>
            <el-button text circle title="Delete" aria-label="Delete">
              <Trash2 :size="16" />
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    <div class="card-header">
      <h4 class="title">
        <router-link :to="`/tasks/${task.id}`">{{ task.title }}</router-link>
      </h4>
    </div>
    <p class="desc" v-if="task.description">{{ task.description }}</p>
    <div v-if="editing" class="edit-panel">
      <div class="edit-panel-inner">
        <!-- Title -->
        <div class="edit-row">
          <div class="edit-col">
            <label class="lbl">Title</label>
            <el-input ref="titleRef" v-model="editTitle" size="small" />
          </div>
        </div>

        <!-- Description -->
        <div class="edit-row">
          <div class="edit-col">
            <label class="lbl">Description</label>
            <el-input v-model="editDescription" type="textarea" :rows="2" size="small" />
          </div>
        </div>

        <!-- Numbers -->
        <div class="edit-row fields-row">
          <div class="edit-col small">
            <label class="lbl">Est. minutes</label>
            <el-input-number
              v-model="editEstimated"
              :min="0"
              size="small"
              controls-position="right"
            />
          </div>
        </div>

        <!-- Per-field color palettes (open on click instead of color picker) -->
        <div class="edit-row fields-row">
          <div class="edit-col small">
            <label class="lbl">Theme</label>
            <el-button
              class="color-wrapper"
              size="small"
              text
              @click.stop="openPaletteMenu('theme', $event)"
            >
              <span class="swatch" :style="{ background: editThemeColor }"></span>
              <span class="color-val">{{ editThemeColor }}</span>
            </el-button>
          </div>
          <div class="edit-col small">
            <label class="lbl">Background</label>
            <el-button
              class="color-wrapper"
              size="small"
              text
              @click.stop="openPaletteMenu('bg', $event)"
            >
              <span class="swatch" :style="{ background: editBackgroundColor }"></span>
              <span class="color-val">{{ editBackgroundColor }}</span>
            </el-button>
          </div>
          <div class="edit-col small">
            <label class="lbl">Text</label>
            <el-button
              class="color-wrapper"
              size="small"
              text
              @click.stop="openPaletteMenu('text', $event)"
            >
              <span class="swatch" :style="{ background: editTextColor }"></span>
              <span class="color-val">{{ editTextColor }}</span>
            </el-button>
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
                :style="{
                  background: c,
                  border: isSelected(c)
                    ? '2px solid rgba(0,0,0,0.18)'
                    : '1px solid rgba(0,0,0,0.06)',
                }"
                @click="pickColor(c)"
                :title="c"
              />
            </div>
          </div>
        </teleport>

        <!-- Actions -->
        <div class="edit-actions">
          <el-button type="primary" size="small" :loading="saving" @click="saveEdit"
            >Save</el-button
          >
          <el-button size="small" @click="closeEdit">Cancel</el-button>
        </div>
        <el-alert v-if="editError" :title="editError" type="error" show-icon />
      </div>
    </div>

    <div class="card-footer">
      <div class="progress">
        <div class="bar" :style="progressStyle"></div>
      </div>
      <div class="meta">
        <span v-if="estimatedMinutes > 0">{{ focusedMinutes }}/{{ estimatedMinutes }}m</span>
        <span v-else>{{ focusedMinutes }}m</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
/* Main Card Styles */
.card {
  background: var(--card-bg);
  color: var(--card-text);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  height: 100px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  width: 100%;
  box-sizing: border-box;
  transition:
    box-shadow 0.12s ease,
    transform 0.08s ease;
  position: relative;
  cursor: grab;
  overflow: hidden;
}

/* Element Plus wraps content in .el-card__body; lock overflow there to avoid inner scrollbars */
.card :deep(.el-card__body) {
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.card.is-editing {
  height: auto;
  overflow: visible;
}

.card.is-editing :deep(.el-card__body) {
  height: auto;
  overflow: visible;
}

.card:hover {
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08);
  transform: translateY(-2px);
}

.card:active {
  cursor: grabbing;
}

.card-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding-right: 150px;
}

.title {
  margin: 0;
  font-size: 14px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.card-header .title a {
  display: block;
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-header .title a:hover {
  text-decoration: underline;
}

.actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  gap: 4px;
  align-items: center;
  flex: 0 0 auto;
}

/* Compact the icon buttons so they don't push content outside the card */
.actions :deep(.el-button) {
  margin: 0;
}

.actions :deep(.el-button.is-circle) {
  width: 26px;
  height: 26px;
  padding: 0;
}

.actions :deep(.el-button.is-circle .el-icon) {
  margin: 0;
}

.desc {
  color: var(--card-text);
  opacity: 0.75;
  font-size: 12px;
  margin: 0;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Progress */
.progress {
  width: 100%;
  height: 6px;
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
  gap: 10px;
  color: var(--card-text);
  opacity: 0.6;
  font-size: 11px;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
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

/* Inputs now use Element Plus */

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
  top: 0;
  left: 0;
  z-index: 30;
  background: #ffffff;
  border: 1px solid var(--card-border, #e5e7eb);
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 12px 28px rgba(16, 24, 40, 0.14);
  width: 280px; /* matches 8 columns: 8*28 + 7*8 + 2*10 padding */
  max-width: 90vw;
  max-height: calc(100vh - 16px);
  overflow: auto;
}

@media (max-width: 420px) {
  .color-palette {
    grid-template-columns: repeat(6, 28px);
    gap: 6px;
  }
  .palette-menu {
    width: 232px; /* 6*28 + 5*6 + 2*10 */
  }
}

@media (max-width: 340px) {
  .color-palette {
    grid-template-columns: repeat(5, 28px);
  }
  .palette-menu {
    width: 198px; /* 5*28 + 4*6 + 2*10 */
  }
}

.swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
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

/* Errors now use Element Plus alerts */


@media (max-width: 768px) {
  .card-header {
    padding-right: 110px;
  }
}

@media (max-width: 420px) {
  .card-header {
    padding-right: 92px;
  }
}

/* removed unified preset window and progress-edit styles */
</style>
