<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../types'
import { useFocusStore } from '../stores/focusSessions'
import FocusWidget from './FocusWidget.vue'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  (e: 'edit', task: Task): void
  (e: 'remove', id: number): void
}>()

const focusStore = useFocusStore()
const focusedMinutes = computed(() => focusStore.totalMinutesForTask(props.task.id))

const progressStyle = computed(() => ({
  width: `${Math.min(100, Math.max(0, props.task.progress))}%`,
}))
</script>

<template>
  <div class="card" draggable="true" @dragstart="onDragStart">
    <div class="card-header">
      <h4 class="title">
        <router-link :to="`/tasks/${task.id}`">{{ task.title }}</router-link>
      </h4>
      <div class="actions">
        <button class="icon" title="Edit" @click="emit('edit', task)">✏️</button>
        <button class="icon" title="Delete" @click="emit('remove', task.id)">🗑️</button>
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
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
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
.actions {
  display: flex;
  gap: 4px;
}
.icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
}
.desc {
  color: #4b5563;
  font-size: 12px;
  margin: 0;
}
.progress {
  width: 100%;
  height: 8px;
  background: #f3f4f6;
  border-radius: 999px;
  overflow: hidden;
}
.bar {
  height: 100%;
  background: linear-gradient(90deg, #34d399, #10b981);
}
.meta {
  display: flex;
  gap: 12px;
  color: #6b7280;
  font-size: 12px;
}
</style>
<style>
.card { cursor: grab; }
.card:active { cursor: grabbing; }
</style>

<script lang="ts">
export default {
  methods: {
    onDragStart(e: DragEvent) {
      if (!e.dataTransfer) return
      e.dataTransfer.setData('text/task-id', String((this as any).task.id))
      e.dataTransfer.effectAllowed = 'move'
    },
  },
}
</script>
