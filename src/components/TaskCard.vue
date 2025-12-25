<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { InputInstance } from 'element-plus'
import type { Task } from '../types'
import { useTasksStore } from '../stores/tasks'
import { useFocusStore } from '../stores/focusSessions'
import { Pencil, Trash2, Clock } from 'lucide-vue-next'

interface TaskCardProps {
  task: Task
  theme_color?: string
  background_color?: string
}

const props = withDefaults(defineProps<TaskCardProps>(), {
  theme_color: '#409eff',
  background_color: '#ffffff'
})

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'remove', id: number): void
}>()

const tasksStore = useTasksStore()
const focusStore = useFocusStore()

// --- Dynamic Styles ---
const effectiveThemeColor = computed(() => props.task.theme_color || props.theme_color)
const effectiveBgColor = computed(() => props.task.background_color || props.background_color)

const rootStyles = computed(() => ({
  '--card-bg': effectiveBgColor.value,
  '--card-text': '#1f2937', 
  '--card-theme': effectiveThemeColor.value,
  '--card-border': effectiveBgColor.value === '#ffffff' ? '#e4e7ed' : 'transparent',
}))

const progressStyle = computed(() => ({
  width: `${Math.min(100, Math.max(0, props.task.progress))}%`,
  background: effectiveThemeColor.value
}))

const focusedMinutes = computed(() => focusStore.totalMinutesForTask(props.task.id) || 0)
const estimatedMinutes = computed(() => Math.round(Number(props.task.estimated_minutes)) || 0)

// --- Edit State ---
const editing = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editEstimated = ref<number>(0)
const editThemeColor = ref('')
const editBackgroundColor = ref('')
const saving = ref(false)
const titleRef = ref<InputInstance | null>(null)

const quickMins = [15, 30, 60]

watch(() => props.task, (t) => {
  if (!t) return
  editTitle.value = t.title || ''
  editDescription.value = t.description || ''
  editEstimated.value = t.estimated_minutes ?? 0
  editThemeColor.value = t.theme_color || props.theme_color
  editBackgroundColor.value = t.background_color || props.background_color
}, { immediate: true })


const commonPalette = ['#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6']
type PaletteKind = 'theme' | 'bg'
const openPalette = ref<PaletteKind | null>(null)
const menuPos = ref<{ top: number; left: number } | null>(null)

function openPaletteMenu(kind: PaletteKind, e: MouseEvent) {
  e.stopPropagation()
  if (openPalette.value === kind) { openPalette.value = null; return }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menuPos.value = { top: rect.bottom + window.scrollY + 8, left: rect.left }
  openPalette.value = kind
}

function pickColor(c: string) {
  if (openPalette.value === 'theme') editThemeColor.value = c
  else editBackgroundColor.value = c
  openPalette.value = null
}

const closePalettes = () => { openPalette.value = null }
onMounted(() => document.addEventListener('click', closePalettes))
onBeforeUnmount(() => document.removeEventListener('click', closePalettes))

async function saveEdit() {
  saving.value = true
  try {
    const updated = await tasksStore.update(props.task.id, {
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      estimated_minutes: Number(editEstimated.value) || 0,
      theme_color: editThemeColor.value,
      background_color: editBackgroundColor.value,
    })
    emit('edit', updated)
    editing.value = false
  } finally { saving.value = false }
}
</script>

<template>
  <el-card 
    class="premium-card" 
    :class="{ 'is-editing': editing }" 
    :style="rootStyles" 
    shadow="hover"
  >
    <div v-if="!editing" class="view-content">
      <div class="card-header">
        <h4 class="title">
          <router-link :to="`/tasks/${task.id}`">{{ task.title }}</router-link>
        </h4>
        <div class="hover-actions">
          <el-button text circle @click="editing = true; nextTick(() => titleRef?.focus())"><Pencil :size="14" /></el-button>
          <el-popconfirm title="Delete task?" @confirm="emit('remove', task.id)">
            <template #reference><el-button text circle><Trash2 :size="14" /></el-button></template>
          </el-popconfirm>
        </div>
      </div>

      <p v-if="task.description" class="desc">{{ task.description }}</p>

      <div class="card-footer">
        <div class="progress-meta">
          <Clock :size="12" />
          <span>{{ focusedMinutes }}<small>/{{ estimatedMinutes }}m</small></span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="progressStyle"></div>
        </div>
      </div>
    </div>

    <div v-else class="edit-panel">
      <div class="edit-fields">
        <el-input ref="titleRef" v-model="editTitle" placeholder="Task Title" class="title-input" />
        <el-input v-model="editDescription" type="textarea" :rows="2" placeholder="Add notes..." class="desc-input" />

        <div class="edit-grid">
          <div class="section-block">
            <label class="premium-label">Estimate</label>
            <div class="estimate-wrapper">
              <div class="quick-chips">
                <button v-for="min in quickMins" :key="min" 
                  class="time-chip" :class="{ active: editEstimated === min }"
                  @click="editEstimated = min"
                >
                  {{ min }}m
                </button>
              </div>
              <div class="custom-input">
                <input type="number" v-model.number="editEstimated" />
                <span>min</span>
              </div>
            </div>
          </div>
          
          <div class="section-block">
            <label class="premium-label">Colors</label>
            <div class="color-row">
              <button class="color-btn theme-btn" title="Theme" @click.stop="openPaletteMenu('theme', $event)" :style="{ background: editThemeColor }">
                <span class="inner-dot"></span>
              </button>
              <button class="color-btn" title="Background" @click.stop="openPaletteMenu('bg', $event)" :style="{ background: editBackgroundColor }"></button>
            </div>
          </div>
        </div>
      </div>

      <div class="edit-actions">
        <el-button text size="small" @click="editing = false">Cancel</el-button>
        <el-button type="primary" round size="small" :loading="saving" @click="saveEdit">Save</el-button>
      </div>
    </div>

    <teleport to="body">
      <div v-if="openPalette && menuPos" class="palette-popup" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }" @click.stop>
        <div class="palette-grid">
          <button v-for="c in commonPalette" :key="c" class="swatch" :style="{ background: c }" @click="pickColor(c)"></button>
        </div>
      </div>
    </teleport>
  </el-card>
</template>

<style scoped>

.premium-card {
  background: var(--card-bg);
  color: var(--card-text);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  transition: all 0.3s ease;
  width: 100%;
  height: auto; 
  min-height: 140px;
  overflow: visible !important;
}

:deep(.el-card__body) { 
  padding: 20px !important; 
  height: 100%;
  display: flex;
  flex-direction: column;
}


.card-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.title { margin: 0; font-size: 1.1rem; font-weight: 700; }
.title a { color: inherit; text-decoration: none; }
.hover-actions { opacity: 0; display: flex; gap: 4px; }
.premium-card:hover .hover-actions { opacity: 1; }
.desc { font-size: 0.9rem; opacity: 0.6; margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }


.edit-fields { display: flex; flex-direction: column; gap: 12px; }
.title-input :deep(.el-input__inner) { font-weight: 700; border: none; background: transparent; padding: 0; font-size: 1.1rem; }

.edit-grid {
  display: flex;
  flex-wrap: wrap; 
  gap: 20px;
  border-top: 1px solid rgba(0,0,0,0.05);
  padding-top: 12px;
}

.section-block { flex: 1; min-width: 140px; }
.premium-label { font-size: 10px; font-weight: 800; text-transform: uppercase; opacity: 0.4; margin-bottom: 8px; display: block; }

/* Estimate Controls */
.estimate-wrapper { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.quick-chips { display: flex; gap: 4px; }
.time-chip {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.1);
  background: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.time-chip.active { background: var(--card-theme); color: white; border-color: var(--card-theme); }

.custom-input {
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.05);
  padding: 2px 8px;
  border-radius: 8px;
  width: 70px;
}
.custom-input input { width: 100%; border: none; background: transparent; font-size: 12px; font-weight: 700; outline: none; text-align: center; }
.custom-input span { font-size: 10px; opacity: 0.5; }


.color-row { display: flex; gap: 8px; }
.color-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.theme-btn .inner-dot { width: 4px; height: 4px; background: white; border-radius: 50%; }

.edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }


.progress-bar-bg { width: 100%; height: 6px; background: rgba(0,0,0,0.05); border-radius: 10px; overflow: hidden; margin-top: auto; }
.progress-bar-fill { height: 100%; transition: width 0.3s ease; }
.progress-meta { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700; margin-bottom: 6px; }


.palette-popup {
  position: absolute; z-index: 9999; background: white; padding: 12px;
  border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); border: 1px solid #eee;
}
.palette-grid { display: grid; grid-template-columns: repeat(4, 28px); gap: 6px; }
.swatch { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #f0f0f0; cursor: pointer; }
</style>