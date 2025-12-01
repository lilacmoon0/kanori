<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TaskBoard from '../components/TaskBoard.vue'
import TimeStats from '../components/TimeStats.vue'
import { useTasksStore } from '../stores/tasks'

const tasks = useTasksStore()
const title = ref('')
const description = ref('')
const creating = ref(false)
const err = ref('')

onMounted(() => {
  if (!tasks.items.length) tasks.fetchAll()
})

async function addTask() {
  if (!title.value.trim()) return
  creating.value = true
  err.value = ''
  try {
    await tasks.create({
      title: title.value.trim(),
      description: description.value.trim(),
      status: 'todo',
      progress: 0,
      estimated_minutes: 0,
    })
    title.value = ''
    description.value = ''
  } catch (e: unknown) {
    err.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="page">
    <header class="header">
      <h2>Life Management Dashboard</h2>
      <div class="new">
        <input v-model="title" placeholder="New task title" />
        <input v-model="description" placeholder="Description (optional)" />
        <button :disabled="creating" @click="addTask">Add</button>
      </div>
      <p v-if="err" class="error">{{ err }}</p>
    </header>

    <TaskBoard />

    <section class="stats">
      <h3>Recent Focus Activity</h3>
      <TimeStats />
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.new {
  display: flex;
  gap: 8px;
}
.new input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.new button {
  padding: 6px 10px;
  border: none;
  background: #2563eb;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
}
.stats {
  margin-top: 8px;
}
.error { color:#b91c1c; }
</style>
