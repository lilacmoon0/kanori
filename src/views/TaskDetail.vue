<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTasksStore } from '../stores/tasks'
import { useFocusStore } from '../stores/focusSessions'
import TimeStats from '../components/TimeStats.vue'
import FocusWidget from '../components/FocusWidget.vue'
import type { TaskStatus } from '../types'

const route = useRoute()
const id = Number(route.params.id)
const tasks = useTasksStore()
const focus = useFocusStore()

const task = computed(() => tasks.items.find((t) => t.id === id) || null)
const editableTitle = ref('')
const editableDesc = ref('')
const editableStatus = ref<TaskStatus>('todo')
const editableProgress = ref(0)
const editableEstimate = ref(0)

onMounted(async () => {
  if (!tasks.items.length) await tasks.fetchAll()
  await focus.fetchAll()
  if (task.value) load()
})

function load() {
  if (!task.value) return
  editableTitle.value = task.value.title
  editableDesc.value = task.value.description
  editableStatus.value = task.value.status
  editableProgress.value = task.value.progress
  editableEstimate.value = task.value.estimated_minutes
}

async function save() {
  if (!task.value) return
  await tasks.update(task.value.id, {
    title: editableTitle.value,
    description: editableDesc.value,
    status: editableStatus.value,
    progress: editableProgress.value,
    estimated_minutes: editableEstimate.value,
  })
}
</script>

<template>
  <div class="page" v-if="task">
    <header class="header">
      <h2>Task Details</h2>
    </header>
    <section class="grid">
      <div class="left">
        <label>Title <input v-model="editableTitle" /></label>
        <label>Description <textarea v-model="editableDesc" rows="4" /></label>
        <label
          >Status
          <select v-model="editableStatus">
            <option value="todo">To Do</option>
            <option value="doing">General Doing</option>
            <option value="today">Today Doing</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label
          >Progress (0-100)
          <input type="number" min="0" max="100" v-model.number="editableProgress"
        /></label>
        <label
          >Estimate (minutes) <input type="number" min="0" v-model.number="editableEstimate"
        /></label>
        <button class="save" @click="save">Save</button>
      </div>
      <div class="right">
        <h3>Focus</h3>
        <FocusWidget :task-id="task.id" />
        <h3>Time Visualization</h3>
        <TimeStats :task-id="task.id" />
      </div>
    </section>
  </div>
  <div v-else class="page">Loading…</div>
</template>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #374151;
}
input,
textarea,
select {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.save {
  width: max-content;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
</style>
