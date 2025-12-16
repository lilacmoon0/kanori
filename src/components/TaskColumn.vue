<script setup lang="ts">
import type { Task, TaskStatus } from '../types'
import TaskCard from './TaskCard.vue'
import { useTasksStore } from '../stores/tasks'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useColumnsStore } from '../stores/columns'
import { MoreVertical, RotateCcw, X, Plus } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  status: TaskStatus
  tasks: Task[]
}>()

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'remove', id: number): void
  (e: 'card-color', title: string): void
}>()

const tasksStore = useTasksStore()
const columnsStore = useColumnsStore()

const menuOpen = ref(false)
const headerRef = ref<HTMLElement | null>(null)
const addOpen = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const creating = ref(false)
const addErr = ref('')

const columnColor = computed(() => columnsStore.getColor(props.status).value || '')

const palette = ['#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6']

function pickColor(color: string) {
  columnsStore.setColor(props.status, color)
  closeMenu()
}

function resetColor() {
  columnsStore.setColor(props.status, null)
  closeMenu()
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node
  if (headerRef.value && !headerRef.value.contains(target)) {
    closeMenu()
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function toggleAdd() {
  addOpen.value = !addOpen.value
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
    addOpen.value = false
  } catch (e: unknown) {
    addErr.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  const idStr = e.dataTransfer?.getData('text/task-id')
  const id = idStr ? Number(idStr) : NaN
  if (!isNaN(id)) {
    await tasksStore.moveTo(id, props.status)
  }
}
</script>

<template>
  <section
    class="column"
    @dragover="onDragOver"
    @drop="onDrop"
    :style="columnColor ? { background: columnColor } : {}"
  >
    <header class="column-header" ref="headerRef">
      <h3>{{ title }}</h3>

      <div style="display: flex; align-items: center; justify-content: center">
        <div class="col-menu">
          <button
            class="menu-toggle"
            @click.stop="toggleMenu"
            aria-haspopup="true"
            :aria-expanded="menuOpen"
            aria-label="Column menu"
            title="Column menu"
          >
            <MoreVertical :size="18" />
          </button>

          <div v-if="menuOpen" class="menu-popover">
            <div class="color-palette">
              <template v-for="c in palette" :key="c">
                <button
                  class="swatch"
                  :style="{
                    background: c,
                    border:
                      columnColor === c
                        ? '2px solid rgba(0,0,0,0.12)'
                        : '1px solid rgba(0,0,0,0.06)',
                  }"
                  @click="pickColor(c)"
                  :title="c"
                />
              </template>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 8px">
              <button class="menu-item" @click="resetColor" aria-label="Reset color" title="Reset color">
                <RotateCcw :size="16" />
              </button>
              <button class="menu-item" @click="closeMenu" aria-label="Close menu" title="Close menu">
                <X :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="list">
      <TaskCard
        v-for="t in tasks"
        :key="t.id"
        :task="t"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />

      <div class="add-area">
        <div v-if="addOpen" class="add-form">
          <div
            class="add-inner"
            style="
              background: white;
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
            "
          >
            <input v-model="newTitle" placeholder="Task title" />
            <input v-model="newDescription" placeholder="Description (optional)" />

            <div class="add-actions">
              <button @click="createTask" :disabled="creating" aria-label="Add task" title="Add task">
                <Plus :size="16" />
              </button>
              <button @click="addOpen = false" aria-label="Cancel" title="Cancel">
                <X :size="16" />
              </button>
            </div>

            <p v-if="addErr" class="error">{{ addErr }}</p>
          </div>
        </div>

        <div class="add-inner">
          <button v-if="!addOpen" class="add-new" @click="toggleAdd">
            <Plus :size="16" />
            <span>Add new task</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.column {
  background: #f9fafb;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
  width: 100%;
  box-sizing: border-box;
}
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.count {
  color: #6b7280;
  font-size: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.add-area {
  width: 100%;
  margin-top: auto;
  margin-bottom: 4px;
}

.add-new {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px dashed #d1d5db;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.add-form input {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  height: 34px;
  background-color: white;
}

.add-actions {
  display: flex;
  gap: 8px;
}
.add-actions button:first-child {
  background: #10b981;
  color: white;
  border: none;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.add-actions button:last-child {
  background: transparent;
  border: 1px solid #d1d5db;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.error {
  color: #b91c1c;
  margin-top: 6px;
}

.add-inner {
  box-sizing: border-box;
  padding: 12px;
  width: 100%;
}
.add-inner .add-new {
  width: 100%;
}
.add-inner input {
  width: 100%;
  box-sizing: border-box;
}

.col-menu {
  position: relative;
}
.menu-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.menu-popover {
  position: absolute;
  right: 0;
  top: 28px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px;
  z-index: 20;
  display: flex;
  flex-direction: column;
}
.menu-item {
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.menu-item:hover {
  background: rgba(0, 0, 0, 0.04);
}
.color-palette {
  display: flex;
  gap: 6px;
}
.swatch {
  width: 28px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
