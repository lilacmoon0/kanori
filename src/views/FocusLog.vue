<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useFocusStore } from '../stores/focusSessions'
import { useTasksStore } from '../stores/tasks'

const focus = useFocusStore()
const tasks = useTasksStore()

onMounted(async () => {
  if (!tasks.items.length) await tasks.fetchAll()
  await focus.fetchAll()
})

const total = computed(() => focus.totalMinutesAll())

function taskTitle(id: number) {
  return tasks.items.find((t) => t.id === id)?.title || `Task #${id}`
}
</script>

<template>
  <div class="page">
    <h2>Focus Sessions</h2>
    <p class="total">
      Total focused: <strong>{{ total }} minutes</strong>
    </p>

    <table class="table">
      <thead>
        <tr>
          <th>When</th>
          <th>Task</th>
          <th>Duration</th>
          <th>Success</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in focus.sessions" :key="s.id">
          <td>{{ new Date(s.started_at).toLocaleString() }}</td>
          <td>{{ taskTitle(s.task) }}</td>
          <td>{{ s.duration_minutes }}m</td>
          <td>{{ s.success ? 'Yes' : 'No' }}</td>
          <td class="notes">{{ s.notes }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page {
  padding: 16px;
}
.total {
  color: #374151;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  border-bottom: 1px solid #e5e7eb;
  padding: 8px;
  text-align: left;
}
.notes {
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
