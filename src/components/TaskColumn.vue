<script setup lang="ts">
import type { Task, TaskStatus } from '../types'
import TaskCard from './TaskCard.vue'
import { useTasksStore } from '../stores/tasks'
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { useColumnsStore } from '../stores/columns'
import { MoreVertical, RotateCcw, X, Plus } from 'lucide-vue-next'
import Draggable from 'vuedraggable'

const props = withDefaults(
  defineProps<{
    title: string
    status: TaskStatus
    tasks: Task[]
    defaultColor?: string
    sortable?: boolean
    externalDropSelector?: string
  }>(),
  {
    defaultColor: '#f3f4f6',
    sortable: true,
    externalDropSelector: '',
  },
)

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'remove', id: number): void
  (e: 'card-color', title: string): void
  (e: 'external-drop', payload: { taskId: number; clientX: number; clientY: number }): void
}>()

const tasksStore = useTasksStore()
const columnsStore = useColumnsStore()

onMounted(() => {
  columnsStore.registerDefaultColor(props.status, props.defaultColor || '')
})

const menuOpen = ref(false)
const addPopoverOpen = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const creating = ref(false)
const addErr = ref('')

const localTasks = ref<Task[]>([])
const sorting = ref(false)

const draggingTaskId = ref<number | null>(null)
const lastPoint = ref<{ x: number; y: number } | null>(null)

function onPointerMove(e: PointerEvent) {
  lastPoint.value = { x: e.clientX, y: e.clientY }
}

function onTouchMove(e: TouchEvent) {
  const t = e.touches.item(0)
  if (!t) return
  lastPoint.value = { x: t.clientX, y: t.clientY }
}

function startTrackingPointer() {
  lastPoint.value = null
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
}

function stopTrackingPointer() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('touchmove', onTouchMove)
}

const storedColor = columnsStore.getColor(props.status)
const columnColor = computed(() => storedColor.value || props.defaultColor || '')
const palette = ['#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6']

function pickColor(color: string) {
  columnsStore.setColor(props.status, color)
  closeMenu()
}

function resetColor() {
  columnsStore.setColor(props.status, null)
  closeMenu()
}

function closeMenu() {
  menuOpen.value = false
}

function toggleAdd() {
  addPopoverOpen.value = !addPopoverOpen.value
}

async function createTask() {
  if (!newTitle.value.trim()) return
  creating.value = true
  addErr.value = ''
  try {
    await tasksStore.create({
      title: newTitle.value.trim(),
      description: newDescription.value.trim(),
      status: props.status,
      progress: 0,
      estimated_minutes: 0,
    })
    newTitle.value = ''
    newDescription.value = ''
    addPopoverOpen.value = false
  } catch (e: unknown) {
    addErr.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

watch(
  () => props.tasks,
  (next) => {
    if (sorting.value) return
    localTasks.value = [...(next || [])]
  },
  { immediate: true, deep: true },
)

type SortableStartEvent = { item?: { dataset?: Record<string, string> } }
type SortableEndEvent = { originalEvent?: { clientX?: number; clientY?: number } }

function onSortStart(evt: unknown) {
  sorting.value = true
  const e = evt as SortableStartEvent | null
  const idRaw = e?.item?.dataset?.taskId
  if (idRaw == null) {
    draggingTaskId.value = null
  } else {
    const id = Number(idRaw)
    draggingTaskId.value = Number.isFinite(id) ? id : null
  }
  startTrackingPointer()
}

function onSortEnd(evt: unknown) {
  sorting.value = false

  // Fire an external drop (e.g. onto Timeline) if configured.
  const taskId = draggingTaskId.value
  draggingTaskId.value = null

  const e = evt as SortableEndEvent | null
  const x = e?.originalEvent?.clientX ?? lastPoint.value?.x
  const y = e?.originalEvent?.clientY ?? lastPoint.value?.y

  stopTrackingPointer()

  if (props.externalDropSelector && taskId != null && x != null && y != null) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (el?.closest(props.externalDropSelector)) {
      emit('external-drop', { taskId, clientX: x, clientY: y })
    }
  }

  // Re-sync to the store-derived order in case it changed during drag.
  localTasks.value = [...(props.tasks || [])]
}

onBeforeUnmount(() => {
  stopTrackingPointer()
})

type DragChangeEvent = {
  added?: { element?: { id?: number | string }; newIndex?: number }
  moved?: { element?: { id?: number | string }; newIndex?: number }
}

async function onDragChange(evt: unknown) {
  const e = evt as DragChangeEvent | null
  // VueDraggable emits { added, removed, moved }.
  // We only need to update the store when an item is added to this column
  // or moved within this column.
  if (e?.added?.element?.id != null) {
    await tasksStore.moveOrReorder(Number(e.added.element.id), props.status, Number(e.added.newIndex ?? 0))
    return
  }
  if (e?.moved?.element?.id != null) {
    await tasksStore.moveOrReorder(Number(e.moved.element.id), props.status, Number(e.moved.newIndex ?? 0))
  }
}
</script>

<template>
  <el-card
    class="premium-column"
    shadow="never"
    :body-style="{ padding: '12px', display: 'flex', flexDirection: 'column', flex: '1' }"
    :style="columnColor ? { '--col-bg': columnColor } : { '--col-bg': props.defaultColor }"
  >
    <template #header>
      <div class="column-header">
        <div class="col-title">
          <span class="col-title-text">{{ title }}</span>
          <span class="task-count-badge">{{ tasks.length }}</span>
        </div>

        <el-popover v-model:visible="menuOpen" placement="bottom-end" trigger="click" width="220">
          <template #reference>
            <el-button class="menu-trigger-btn" text circle aria-label="Column menu" title="Column menu">
              <MoreVertical :size="18" />
            </el-button>
          </template>

          <div class="menu-popover">
            <div class="color-palette">
              <template v-for="c in palette" :key="c">
                <button
                  class="swatch"
                  :style="{
                    background: c,
                    boxShadow: columnColor === c ? '0 0 0 2px var(--el-color-primary)' : '0 0 0 1px rgba(0,0,0,0.05)',
                  }"
                  @click="pickColor(c)"
                  :title="c"
                />
              </template>
            </div>

            <div class="menu-actions">
              <el-button size="small" @click="resetColor" link>
                <RotateCcw :size="14" style="margin-right: 4px" /> Reset
              </el-button>
              <el-button size="small" @click="closeMenu" link>
                <X :size="14" />
              </el-button>
            </div>
          </div>
        </el-popover>
      </div>
    </template>

    <Draggable
      class="list premium-scrollbar"
      :list="localTasks"
      item-key="id"
      group="tasks"
      :sort="props.sortable"
      :animation="200"
      :delay="220"
      ghost-class="drag-ghost"
      :delay-on-touch-only="true"
      :force-fallback="true"
      @start="onSortStart"
      @end="onSortEnd"
      @change="onDragChange"
    >
      <template #item="{ element }">
        <div class="card-row" :data-task-id="element.id">
          <TaskCard :task="element" @edit="emit('edit', $event)" @remove="emit('remove', $event)" />
        </div>
      </template>

      <template #footer>
        <div class="add-area">
          <el-popover
            v-model:visible="addPopoverOpen"
            placement="bottom"
            width="320"
            trigger="manual"
            :show-arrow="true"
            @after-leave="() => { addErr = ''; newTitle = ''; newDescription = '' }"
          >
            <template #reference>
              <div class="add-inner">
                <button class="ghost-add-button" @click="toggleAdd">
                  <Plus :size="16" />
                  <span>Add new task</span>
                </button>
              </div>
            </template>
            <el-card shadow="never" class="add-form-card">
              <el-space direction="vertical" size="small" fill style="width: 100%">
                <el-input v-model="newTitle" placeholder="What needs to be done?" class="premium-input" />
                <el-input v-model="newDescription" placeholder="Description (optional)" class="premium-input" />
                <div class="add-actions">
                  <el-button link @click="addPopoverOpen = false">Cancel</el-button>
                  <el-button type="primary" :loading="creating" @click="createTask" round>
                    Add Task
                  </el-button>
                </div>
                <el-alert v-if="addErr" :title="addErr" type="error" show-icon :closable="false" />
              </el-space>
            </el-card>
          </el-popover>
        </div>
      </template>
    </Draggable>
  </el-card>
</template>

<style scoped>
/* 1. Main Column Aesthetic */
.premium-column {
  --col-bg: #f3f4f6;
  background: var(--col-bg) !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
  border-radius: 12px !important;
  transition: box-shadow 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  /* Responsive Width Logic */
  width: 100%;
  min-width: 280px;
  max-width: 450px;
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .premium-column {
    width: 88vw;
    min-width: 88vw;
    scroll-snap-align: center;
    margin-right: 12px;
  }
}

.premium-column:hover {
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
}

/* 2. Header Polish */
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.col-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.col-title-text {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1e293b;
  letter-spacing: -0.01em;
}

.task-count-badge {
  background: rgba(0, 0, 0, 0.05);
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.menu-trigger-btn {
  color: #94a3b8;
}

/* 3. The List & Scrollbar */
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 100px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 4px; /* Space for card shadows */
}

.premium-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.premium-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

/* 4. Drag & Drop Visuals */
.drag-ghost {
  opacity: 0.4;
  background: #cbd5e1 !important;
  border-radius: 10px;
}

/* 5. Add Area Polish */
.add-area {
  margin-top: 12px;
}

.ghost-add-button {
  width: 100%;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: transparent;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.ghost-add-button:hover {
  background: rgba(255, 255, 255, 0.6);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.add-form-card {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.premium-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.add-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.swatch {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  transition: transform 0.2s;
}

.swatch:hover {
  transform: scale(1.1);
}

:deep(.el-card__header) {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0,0,0,0.03);
}
</style>

<style scoped>
.column {
  background: var(--el-fill-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.column.is-drop-target {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.col-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.col-title-text {
  font-weight: 700;
  line-height: 1.2;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  max-height: 70vh;
  touch-action: pan-y;
}

.card-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-area {
  width: 100%;
  margin-top: auto;
  margin-bottom: 4px;
}

.add-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.add-inner {
  box-sizing: border-box;
  width: 100%;
}
.menu-popover {
  display: flex;
  flex-direction: column;
}
.color-palette {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.menu-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.swatch {
  width: 28px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
}

:deep(.el-card__header) {
  padding: 10px 12px;
}
</style>
