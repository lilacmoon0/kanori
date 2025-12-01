<script setup lang="ts">
import type { Task, TaskStatus } from '../types'
import TaskCard from './TaskCard.vue'
import { useTasksStore } from '../stores/tasks'

const props = defineProps<{
  title: string
  status: TaskStatus
  tasks: Task[]
}>()

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'remove', id: number): void
}>()

const tasksStore = useTasksStore()

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer && (e.dataTransfer.dropEffect = 'move')
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
  <section class="column" @dragover="onDragOver" @drop="onDrop">
    <header class="column-header">
      <h3>{{ title }}</h3>
      <span class="count">{{ tasks.length }}</span>
    </header>
    <div class="list">
      <TaskCard
        v-for="t in tasks"
        :key="t.id"
        :task="t"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
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
  min-height: 200px;
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
}
</style>
