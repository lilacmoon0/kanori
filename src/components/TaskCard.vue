<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { Task } from '../types'
import { useFocusStore } from '../stores/focusSessions'
import FocusWidget from './FocusWidget.vue'
import { useTasksStore } from '../stores/tasks'

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
const tasksStore = useTasksStore()

const effectiveThemeColor = computed(() => (props.task as any).theme_color || props.theme_color)
const effectiveBgColor = computed(
  () => (props.task as any).background_color || props.background_color,
)
const effectiveTextColor = computed(() => (props.task as any).color || props.color)

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
const editProgress = ref<number>(0)
const editEstimated = ref<number>(0)

// New Color State Refs
const editThemeColor = ref('')
const editBackgroundColor = ref('')
const editTextColor = ref('')

const saving = ref(false)
const editError = ref('')
const titleRef = ref<HTMLInputElement | null>(null)

// Watch for task changes to initialize edit form
watch(
  () => props.task,
  (t) => {
    if (!t) return
    editTitle.value = t.title || ''
    editDescription.value = t.description || ''
    editProgress.value = t.progress ?? 0
    editEstimated.value = t.estimated_minutes ?? 0

    // Initialize colors from the Task object first, fallback to props/defaults
    editThemeColor.value = (t as any).theme_color || props.theme_color
    editBackgroundColor.value = (t as any).background_color || props.background_color
    editTextColor.value = (t as any).color || props.color
  },
  { immediate: true, deep: true },
)

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
      progress: Number(editProgress.value) || 0,
      estimated_minutes: Number(editEstimated.value) || 0,
      // Save color preferences
      theme_color: editThemeColor.value,
      background_color: editBackgroundColor.value,
      color: editTextColor.value,
    })
    emit('edit', updated)
    editing.value = false
  } catch (e: any) {
    editError.value = e?.message ?? String(e)
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
        <button class="icon" title="Edit" @click="openEdit">✏️</button>
        <button class="icon" title="Delete" @click="emit('remove', task.id)">X</button>
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

    <FocusWidget :task-id="task.id" />

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
            <label class="lbl">Progress %</label>
            <input
              type="number"
              v-model.number="editProgress"
              min="0"
              max="100"
              class="small-input"
            />
          </div>
          <div class="edit-col small">
            <label class="lbl">Est. minutes</label>
            <input type="number" v-model.number="editEstimated" min="0" class="small-input" />
          </div>
        </div>

        <!-- New Color Selection Row -->
        <div class="edit-row fields-row">
          <div class="edit-col small">
            <label class="lbl">Theme</label>
            <div class="color-wrapper">
              <input
                type="color"
                v-model="editThemeColor"
                class="color-input"
                title="Progress bar & button color"
              />
              <span class="color-val">{{ editThemeColor }}</span>
            </div>
          </div>
          <div class="edit-col small">
            <label class="lbl">Background</label>
            <div class="color-wrapper">
              <input
                type="color"
                v-model="editBackgroundColor"
                class="color-input"
                title="Card background color"
              />
              <span class="color-val">{{ editBackgroundColor }}</span>
            </div>
          </div>
          <div class="edit-col small">
            <label class="lbl">Text</label>
            <div class="color-wrapper">
              <input type="color" v-model="editTextColor" class="color-input" title="Text color" />
              <span class="color-val">{{ editTextColor }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="edit-actions">
          <button class="btn-save" @click="saveEdit" :disabled="saving">Save</button>
          <button class="btn-cancel" @click="closeEdit">Cancel</button>
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
  gap: 4px;
}

.icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--card-text);
  opacity: 0.7;
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
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
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
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.8;
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
</style>
